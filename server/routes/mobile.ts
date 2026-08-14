import crypto from "crypto";
import type { Express, Request, Response } from "express";

import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { sdk } from "../_core/sdk.js";
import { sendMobilePushToUsers } from "../services/mobilePush.js";
import { notifyUserEvent } from "../services/notify.js";

const BASE = "/api/mobile/v1";
const SESSION_COOKIE = "club_web_session";
const PUBLIC_CONTENT_CDN_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const CONTENT_KINDS = ["article", "activity", "achievement", "book"] as const;
type ContentKind = (typeof CONTENT_KINDS)[number];

function allowedRedirectUris() {
  const configured = (process.env.MOBILE_ALLOWED_REDIRECT_URIS || "").split(",").map((uri) => uri.trim()).filter(Boolean);
  return new Set(["culturalclub://oauth/callback", ...configured]);
}

function isAllowedRedirectUri(value: unknown): value is string {
  return typeof value === "string" && allowedRedirectUris().has(value);
}

function queryString(value: unknown) { return typeof value === "string" ? value : ""; }
function numeric(value: unknown) { const result = Number(value); return Number.isInteger(result) && result > 0 ? result : null; }
function mobileCodeHash(code: string) { return crypto.createHash("sha256").update(code).digest("hex"); }
function envelope(data: unknown) { return { apiVersion: "1.0", generatedAt: new Date().toISOString(), data }; }
function safeWebsitePath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/") ? value.slice(0, 500) : "/";
}

function publicUser(user: NonNullable<Awaited<ReturnType<typeof db.getUserById>>>) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage, approved: user.approvalStatus === "approved" };
}

function contentUrl(kind: ContentKind, id: number) {
  const plural: Record<ContentKind, string> = { article: "articles", activity: "activities", achievement: "achievements", book: "books" };
  return `/${plural[kind]}/${id}`;
}

function normalize(kind: ContentKind, row: any) {
  const summary = kind === "article" ? row.excerpt : kind === "book" ? row.summary : row.description;
  return {
    id: row.id, type: kind, title: row.title, summary: summary || null, content: row.content || row.details || null,
    imageUrl: kind === "book" ? row.coverImageUrl || null : row.imageUrl || null,
    author: kind === "article" ? row.author || null : kind === "book" ? row.author || null : kind === "achievement" ? row.awardingOrganization || null : null,
    category: kind === "article" ? row.category || null : kind === "book" ? row.genre || null : kind === "achievement" ? row.category || null : null,
    location: row.location || null, status: row.status || null, startDate: row.startDate || null, endDate: row.endDate || null,
    year: row.year || null, createdAt: row.createdAt || null, updatedAt: row.updatedAt || null, url: contentUrl(kind, row.id),
    meta: kind === "book" ? { clubRating: row.clubRating || null, pageCount: row.pageCount || null } : kind === "achievement" ? { featured: row.featured, awardName: row.awardName || null } : {},
  };
}

async function listRows(kind: ContentKind) {
  if (kind === "article") return (await db.getArticles()).filter((article) => article.published);
  if (kind === "activity") return db.getActivities();
  if (kind === "achievement") return db.getAchievements();
  return db.getBooks();
}

async function getRow(kind: ContentKind, id: number): Promise<any | null> {
  if (kind === "article") { const row = await db.getArticleById(id); return row?.published ? row : null; }
  if (kind === "activity") return db.getActivityById(id);
  if (kind === "achievement") return db.getAchievementById(id);
  return db.getBookById(id);
}

async function authenticateMobile(req: Request) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = await sdk.verifySession(token);
  if (!session) return null;
  return db.getUserByOpenId(session.openId);
}

async function requireMobile(req: Request, res: Response) {
  const user = await authenticateMobile(req);
  if (!user) { res.status(401).json({ message: "يلزم تسجيل الدخول." }); return null; }
  return user;
}

function isAllowedSender(role: string) { return role === "admin" || role === "tech_admin"; }

export function registerMobileRoutes(app: Express) {
  app.use(`${BASE}/auth`, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Public editorial data can be shared by all visitors. Keeping a short CDN
  // cache protects the mobile feed from cold database work while stale-while-
  // revalidate makes content updates visible quickly without blocking readers.
  const cachePublicContent = (_req: Request, res: Response, next: () => void) => {
    res.setHeader("Vercel-CDN-Cache-Control", PUBLIC_CONTENT_CDN_CACHE);
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    next();
  };

  app.get(`${BASE}/auth/google`, (req, res) => {
    const redirectUri = queryString(req.query.redirect_uri);
    if (!isAllowedRedirectUri(redirectUri)) { res.status(400).json({ message: "رابط العودة غير مسموح." }); return; }
    const state = crypto.randomBytes(24).toString("hex");
    const options = { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 };
    res.cookie("mobile_oauth_redirect", redirectUri, options);
    res.cookie("mobile_oauth_state", state, options);
    const intent = req.query.intent === "register" ? "register" : "login";
    res.redirect(302, `/api/auth/google?intent=${intent}&mobile=1`);
  });

  app.post(`${BASE}/auth/exchange`, async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const redirectUri = typeof req.body?.redirectUri === "string" ? req.body.redirectUri : "";
    if (!code || !isAllowedRedirectUri(redirectUri)) { res.status(400).json({ message: "بيانات الدخول غير صالحة." }); return; }
    const handoff = await db.consumeMobileAuthCode(mobileCodeHash(code));
    if (!handoff || handoff.redirectUri !== redirectUri) { res.status(401).json({ message: "انتهت صلاحية تسجيل الدخول. أعد المحاولة." }); return; }
    const user = await db.getUserById(handoff.userId);
    if (!user) { res.status(401).json({ message: "المستخدم غير موجود." }); return; }
    const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "عضو النادي", expiresInMs: ONE_YEAR_MS });
    void notifyUserEvent(user.id, {
      entityId: 0,
      title: "تم تسجيل الدخول إلى التطبيق",
      body: "تم تسجيل الدخول إلى حسابك بنجاح.",
      url: "/profile",
      // The active device posts this local notification after its first
      // successful exchange. Avoid racing a remote push before a first-time
      // device has registered, and avoid showing the same login alert twice.
      push: false,
    });
    res.json(envelope({ sessionToken, user: publicUser(user) }));
  });

  // The Android wrapper authenticates in the system browser, then uses this
  // one-time handoff to create the website's regular HTTP-only cookie inside
  // its WebView. The bearer token never appears in the WebView URL or page JS.
  app.post(`${BASE}/auth/web-handoff`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const handoff = crypto.randomBytes(32).toString("hex");
    const returnPath = safeWebsitePath(req.body?.returnPath);
    await db.createMobileAuthCode({ codeHash: mobileCodeHash(handoff), userId: user.id, redirectUri: WEB_SESSION_HANDOFF, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    res.json(envelope({ url: `${BASE}/auth/web-session?code=${encodeURIComponent(handoff)}&returnPath=${encodeURIComponent(returnPath)}` }));
  });

  app.get(`${BASE}/auth/web-session`, async (req, res) => {
    const code = queryString(req.query.code);
    const handoff = code ? await db.consumeMobileAuthCode(mobileCodeHash(code)) : null;
    if (!handoff || handoff.redirectUri !== WEB_SESSION_HANDOFF) { res.status(401).send("انتهت صلاحية فتح جلسة الموقع. أعد تسجيل الدخول."); return; }
    const user = await db.getUserById(handoff.userId);
    if (!user) { res.status(401).send("المستخدم غير موجود."); return; }
    const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "عضو النادي", expiresInMs: ONE_YEAR_MS });
    res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
    res.redirect(302, safeWebsitePath(req.query.returnPath));
  });

  app.get(`${BASE}/auth/me`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    res.json(envelope(publicUser(user)));
  });

  app.get(`${BASE}/feed`, cachePublicContent, async (_req, res) => {
    const [articles, activities, achievements, books] = await Promise.all(CONTENT_KINDS.map((kind) => listRows(kind)));
    const all = [...articles.map((row) => normalize("article", row)), ...activities.map((row) => normalize("activity", row)), ...achievements.map((row) => normalize("achievement", row)), ...books.map((row) => normalize("book", row))];
    all.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const highlights = [...all.filter((item) => item.type === "achievement" && item.meta.featured), ...all.filter((item) => item.type === "activity")].slice(0, 8);
    res.json(envelope({ highlights, latest: all.slice(0, 12), contentVersion: String(all[0]?.updatedAt || "empty") }));
  });

  app.get(`${BASE}/about`, cachePublicContent, async (_req, res) => {
    res.json(envelope({
      title: "عن النادي الثقافي الأدبي",
      body: "تأسس النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين برؤية واضحة لإثراء الحياة الثقافية والأدبية بين طلاب الجامعة، من خلال الأدب والفكر والفنون بمختلف تجلياتها. ويحتل الاعتناء باللغة العربية وآدابها مكانة خاصة ضمن اهتمامات النادي، بوصفها جزءاً أصيلاً من هويتنا الثقافية.",
      imageUrl: null,
      contacts: [],
    }));
  });

  app.get(`${BASE}/:resource(articles|activities|achievements|books)`, cachePublicContent, async (req, res) => {
    const kind = ({ articles: "article", activities: "activity", achievements: "achievement", books: "book" } as const)[req.params.resource as "articles"];
    const query = queryString(req.query.query).trim().toLocaleLowerCase("ar");
    const requestedLimit = Number(queryString(req.query.limit)) || 50;
    const rows = (await listRows(kind)).map((row) => normalize(kind, row)).filter((item) => !query || `${item.title} ${item.summary || ""} ${item.author || ""} ${item.category || ""}`.toLocaleLowerCase("ar").includes(query));
    res.json(envelope({ items: rows.slice(0, Math.min(requestedLimit, 100)), nextCursor: null, contentVersion: String(rows[0]?.updatedAt || "empty") }));
  });

  app.get(`${BASE}/:resource(articles|activities|achievements|books)/:id`, cachePublicContent, async (req, res) => {
    const kind = ({ articles: "article", activities: "activity", achievements: "achievement", books: "book" } as const)[req.params.resource as "articles"];
    const id = numeric(req.params.id); if (!id) { res.status(400).json({ message: "معرّف المحتوى غير صالح." }); return; }
    const row = await getRow(kind, id); if (!row) { res.status(404).json({ message: "المحتوى غير موجود." }); return; }
    res.json(envelope(normalize(kind, row)));
  });

  app.post(`${BASE}/activities/:id/subscriptions`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const activityId = numeric(req.params.id); const activity = activityId ? await db.getActivityById(activityId) : null;
    if (!activityId || !activity) { res.status(404).json({ message: "النشاط غير موجود." }); return; }
    const existing = await db.getUserActivitySubscriptions(user.id);
    if (existing.some((entry) => entry.activityId === activityId)) { res.status(409).json({ message: "أنت مسجل في هذا النشاط مسبقاً." }); return; }
    await db.createActivitySubscription({ activityId, userId: user.id, status: "pending" });
    void notifyUserEvent(user.id, {
      entityId: activityId,
      title: "تم استلام طلب انضمامك للنشاط",
      body: `النشاط: ${activity.title}`,
      url: `/activities/${activityId}`,
      type: "activity",
    });
    res.status(201).json(envelope({ success: true }));
  });

  app.get(`${BASE}/books/hub`, async (req, res) => {
    const user = await authenticateMobile(req);
    const [books, round, poll] = await Promise.all([db.getBooks(), db.getActiveSuggestionRound(), db.getActivePoll()]);
    const mySuggestion = round && user ? await db.getMySuggestionInRound(round.id, user.id) : null;
    const options = poll ? await db.getPollOptionsWithCounts(poll.id) : [];
    const ballots = poll && user ? await db.getMyBallots(poll.id, user.id) : [];
    res.json(envelope({ books: books.map((book) => normalize("book", book)), suggestionRound: round ? { id: round.id, status: round.status, mySuggestion: mySuggestion ? { id: mySuggestion.id, title: mySuggestion.title } : null } : null, poll: poll ? { id: poll.id, title: poll.title, status: poll.status, mode: poll.mode, options: options.map((option) => ({ id: option.id, title: option.title, author: option.author, coverImageUrl: option.coverImageUrl, votes: option.voteCount, selected: ballots.some((ballot) => ballot.optionId === option.id) })) } : null }));
  });

  app.post(`${BASE}/books/suggestions`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 500) { res.status(400).json({ message: "عنوان الكتاب مطلوب." }); return; }
    const round = await db.getActiveSuggestionRound(); if (!round) { res.status(409).json({ message: "لا توجد جولة اقتراحات مفتوحة." }); return; }
    if (await db.getMySuggestionInRound(round.id, user.id)) { res.status(409).json({ message: "يمكنك إرسال اقتراح واحد في الجولة الحالية." }); return; }
    await db.createSuggestion({ roundId: round.id, suggestedBy: user.id, title, author: typeof req.body?.author === "string" ? req.body.author.slice(0, 255) : null, note: typeof req.body?.note === "string" ? req.body.note.slice(0, 2000) : null });
    void notifyUserEvent(user.id, {
      entityId: round.id,
      title: "تم استلام اقتراحك للكتاب",
      body: "سيظهر لك أي تحديث مرتبط بجولة الاقتراحات.",
      url: "/books",
    });
    res.status(201).json(envelope({ success: true }));
  });

  app.post(`${BASE}/books/polls/:id/vote`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const pollId = numeric(req.params.id);
    const rawOptionIds: unknown[] = Array.isArray(req.body?.optionIds) ? req.body.optionIds : [];
    const input: number[] = rawOptionIds.map((value) => numeric(value)).filter((id): id is number => id !== null);
    const poll = pollId ? await db.getPollById(pollId) : null; if (!poll || poll.status !== "open" || !input.length) { res.status(400).json({ message: "التصويت غير متاح." }); return; }
    const validOptions = await db.getPollOptionsWithCounts(poll.id); const validIds = new Set<number>(validOptions.map((option) => option.id));
    const optionIds: number[] = input.filter((id: number) => validIds.has(id)); if (!optionIds.length || (poll.mode === "single" && optionIds.length !== 1)) { res.status(400).json({ message: "اختيار التصويت غير صالح." }); return; }
    if (poll.mode === "single") {
      await db.castVote(poll.id, optionIds[0], user.id, "single");
    } else {
      const existing = await db.getMyBallots(poll.id, user.id);
      const existingIds = new Set(existing.map((ballot) => ballot.optionId));
      for (const ballot of existing) if (!optionIds.includes(ballot.optionId)) await db.castVote(poll.id, ballot.optionId, user.id, "multiple");
      for (const optionId of optionIds) if (!existingIds.has(optionId)) await db.castVote(poll.id, optionId, user.id, "multiple");
    }
    void notifyUserEvent(user.id, {
      entityId: poll.id,
      title: "تم تسجيل تصويتك",
      body: "تم حفظ اختيارك في تصويت النادي.",
      url: "/books",
    });
    res.json(envelope({ success: true }));
  });

  app.post(`${BASE}/devices`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const pushToken = typeof req.body?.pushToken === "string" ? req.body.pushToken.trim() : "";
    const platform = typeof req.body?.platform === "string" ? req.body.platform.trim().slice(0, 24) : "unknown";
    if (!/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(pushToken)) { res.status(400).json({ message: "رمز جهاز الإشعارات غير صالح." }); return; }
    await db.upsertMobileDevice({ userId: user.id, expoPushToken: pushToken, platform });
    res.status(201).json(envelope({ success: true }));
  });

  app.get(`${BASE}/notifications`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const [items, unreadCount] = await Promise.all([db.getUserNotifications(user.id), db.countUnreadNotifications(user.id)]);
    res.json(envelope({ items, unreadCount }));
  });

  app.post(`${BASE}/notifications/:id/read`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    const id = numeric(req.params.id); if (!id) { res.status(400).json({ message: "معرّف الإشعار غير صالح." }); return; }
    await db.markNotificationRead(user.id, id); res.json(envelope({ success: true }));
  });

  app.post(`${BASE}/notifications/send`, async (req, res) => {
    const user = await requireMobile(req, res); if (!user) return;
    if (!isAllowedSender(user.role)) { res.status(403).json({ message: "هذه الصلاحية للمسؤول والمدير التقني فقط." }); return; }
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 255) : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 2000) : "";
    const target = req.body?.target === "members" ? "members" : "all";
    const url = typeof req.body?.url === "string" && req.body.url.startsWith("/") ? req.body.url.slice(0, 500) : "/";
    if (!title || !body) { res.status(400).json({ message: "العنوان ونص الرسالة مطلوبان." }); return; }
    const recipients = await db.getMobileNotificationRecipients(target);
    await db.createNotificationsForUsers(recipients.map((recipient) => recipient.id), { type: "announcement", entityId: 0, title, body, url });
    void sendMobilePushToUsers(recipients.map((recipient) => recipient.id), { title, body, data: { url, type: "announcement" } });
    res.json(envelope({ delivered: recipients.length }));
  });
}

export { isAllowedRedirectUri, mobileCodeHash };
