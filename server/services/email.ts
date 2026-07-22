import nodemailer from "nodemailer";
import { ENV } from "../_core/env.js";
import { getTodayEmailCount, incrementEmailCount } from "../db.js";

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;

  if (!ENV.smtpUser || !ENV.smtpPassword || !ENV.smtpFrom) {
    console.warn("[Email] SMTP not configured (SMTP_USER/SMTP_PASSWORD/SMTP_FROM) — skipping all email sends.");
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpPort === 465,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPassword },
  });
  return transporter;
}

/**
 * Priority tiers for outbound email, ordered exactly as requested:
 * activity acceptance + new-activity emails first, then achievements,
 * then articles, then books last.
 *
 * Brevo's free tier caps out at 300 emails/day. We stay a little under that
 * (see MAX_DAILY_EMAILS) and reserve a slice of the remaining quota for
 * higher-priority tiers, so on a busy day a burst of low-priority "new
 * book" emails can never crowd out an urgent "you're accepted" email sent
 * later that same day.
 */
export enum EmailPriority {
  ACTIVITY = 1, // نشر نشاط + قبول في نشاط (عضو أو ضيف)
  ACHIEVEMENT = 2,
  ARTICLE = 3,
  BOOK = 4,
}

const MAX_DAILY_EMAILS = 290; // small safety buffer under Brevo's 300/day cap
// How much of the daily cap must remain free before each tier is allowed to
// send. Tier 1 (activity) can always use the full quota; each lower tier
// gives up more headroom to protect the tiers above it.
const RESERVE_BEFORE_TIER: Record<EmailPriority, number> = {
  [EmailPriority.ACTIVITY]: 0,
  [EmailPriority.ACHIEVEMENT]: 60,
  [EmailPriority.ARTICLE]: 100,
  [EmailPriority.BOOK]: 140,
};

async function hasQuota(priority: EmailPriority): Promise<boolean> {
  const sentToday = await getTodayEmailCount();
  const cap = MAX_DAILY_EMAILS - RESERVE_BEFORE_TIER[priority];
  return sentToday < cap;
}

/** Sends one email. Never throws — failures (and quota skips) are logged
 * and swallowed so a flaky mail provider or a busy day can never break the
 * action that triggered it (adding an activity, approving a member, etc). */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  priority: EmailPriority = EmailPriority.ACTIVITY
): Promise<void> {
  const t = getTransporter();
  if (!t) return;

  if (!(await hasQuota(priority))) {
    console.warn(`[Email] Daily quota reached for priority tier ${EmailPriority[priority]} — skipping send to ${to}.`);
    return;
  }

  try {
    await t.sendMail({ from: ENV.smtpFrom, to, subject, html });
    await incrementEmailCount(1);
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
  }
}

/** Sends the same email (personalized per-recipient "to") to a list of
 * members. Sent as individual messages rather than one big BCC — better
 * deliverability, and keeps each recipient's address private from others.
 * Sends sequentially (not in parallel) so the quota check stays accurate
 * as it works through the list, and stops early once the tier's reserved
 * quota for the day is used up rather than failing send-by-send. */
export async function sendBulkEmail(
  recipients: { email: string | null; name?: string | null }[],
  subject: string,
  html: string,
  priority: EmailPriority = EmailPriority.ACTIVITY
): Promise<void> {
  const t = getTransporter();
  if (!t) return;
  const targets = recipients.filter((r): r is { email: string; name?: string | null } => !!r.email);
  if (targets.length === 0) return;

  for (const r of targets) {
    if (!(await hasQuota(priority))) {
      console.warn(
        `[Email] Daily quota reached for priority tier ${EmailPriority[priority]} — stopping bulk send early (${targets.length} recipients queued).`
      );
      return;
    }
    await sendEmail(r.email, subject, html, priority);
  }
}

/** Truncates plain text to a fixed number of words, appending "…" if cut. */
export function truncateWords(text: string, maxWords: number): string {
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(" ");
  if (words.length <= maxWords) return plain;
  return words.slice(0, maxWords).join(" ") + " ...";
}

function absoluteUrl(relativeUrl: string): string {
  return `${ENV.appBaseUrl.replace(/\/$/, "")}${relativeUrl}`;
}

const CLUB_NAME = "النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين";

const FONT_STACK =
  "'Segoe UI', Tahoma, Geneva, Arial, sans-serif";

/** Shared page shell: RTL, centered card, consistent colors across every
 * template so all club emails feel like one visual family. */
function shell(innerHtml: string): string {
  return `
  <div dir="rtl" style="background:#f4f1ea;padding:32px 16px;font-family:${FONT_STACK};">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
      ${innerHtml}
      <div style="padding:16px 24px;text-align:center;background:#faf8f3;border-top:1px solid #eee;">
        <p style="margin:0;font-size:11px;color:#9a9a9a;">هذه رسالة تلقائية من موقع النادي — لا حاجة للرد عليها.</p>
      </div>
    </div>
  </div>`;
}

function ctaButton(url: string, label = "لقراءة المزيد من التفاصيل يرجى الانتقال إلى الرابط التالي"): string {
  return `
    <p style="font-size:13px;color:#666;text-align:center;margin:20px 0 10px;">${label}</p>
    <div style="text-align:center;margin-bottom:8px;">
      <a href="${url}" style="display:inline-block;background:#8a6d3b;color:#ffffff;text-decoration:none;
        padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;">فتح الرابط</a>
    </div>`;
}

// ── نشاط جديد ────────────────────────────────────────────────────────────
export function activityEmailTemplate(params: { activityTitle: string; activityId: number }): string {
  const url = absoluteUrl(`/activities/${params.activityId}`);
  return shell(`
    <div style="padding:32px 24px 8px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#2b2b2b;">${CLUB_NAME}</h1>
    </div>
    <div style="padding:8px 24px 4px;text-align:center;">
      <p style="font-size:15px;color:#3d3d3d;margin:16px 0;">ندعوك للانضمام إلى نشاطنا القادم 🌿</p>
    </div>
    ${ctaButton(url)}
    <div style="padding:12px 24px 28px;text-align:center;">
      <p style="font-size:13px;color:#8a8a8a;margin:0;">${params.activityTitle}</p>
    </div>
  `);
}

// ── مقال جديد ────────────────────────────────────────────────────────────
export function articleEmailTemplate(params: { articleTitle: string; excerpt: string; articleId: number }): string {
  const url = absoluteUrl(`/articles/${params.articleId}`);
  const excerpt = truncateWords(params.excerpt || "", 30);
  return shell(`
    <div style="padding:32px 24px 8px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#2b2b2b;">${CLUB_NAME}</h1>
    </div>
    <div style="padding:8px 24px 4px;text-align:center;">
      <p style="font-size:15px;color:#3d3d3d;margin:16px 0 4px;">مقال جديد بانتظارك 📖</p>
      ${excerpt ? `<p style="font-size:13px;color:#666;line-height:1.8;margin:8px 0;">${excerpt}</p>` : ""}
    </div>
    ${ctaButton(url)}
    <div style="padding:12px 24px 28px;text-align:center;">
      <p style="font-size:13px;color:#8a8a8a;margin:0;">${params.articleTitle}</p>
    </div>
  `);
}

// ── كتاب جديد أضيف لمكتبة النادي ──────────────────────────────────────────
export function bookEmailTemplate(params: { bookTitle: string; author: string }): string {
  const url = absoluteUrl(`/books`);
  return shell(`
    <div style="padding:32px 24px 8px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#2b2b2b;">${CLUB_NAME}</h1>
    </div>
    <div style="padding:8px 24px 4px;text-align:center;">
      <p style="font-size:15px;color:#3d3d3d;margin:16px 0 4px;">كتاب جديد أُضيف إلى مكتبة النادي 📚</p>
      <p style="font-size:13px;color:#666;margin:4px 0;">${params.bookTitle} — ${params.author}</p>
    </div>
    ${ctaButton(url, "لاستكشاف صفحة الكتب يرجى الانتقال إلى الرابط التالي")}
    <div style="padding:0 24px 28px;"></div>
  `);
}

// ── إنجاز جديد (تصميم فخم) ────────────────────────────────────────────────
export function achievementEmailTemplate(params: {
  title: string;
  awardName?: string | null;
  awardingOrganization?: string | null;
  achievementId: number;
}): string {
  const url = absoluteUrl(`/achievements/${params.achievementId}`);
  return `
  <div dir="rtl" style="background:#0f1115;padding:40px 16px;font-family:${FONT_STACK};">
    <div style="max-width:520px;margin:0 auto;background:linear-gradient(180deg,#1c1a14 0%,#14120e 100%);
      border-radius:18px;overflow:hidden;border:1px solid #caa14d55;">
      <div style="height:5px;background:linear-gradient(90deg,#caa14d,#f1d488,#caa14d);"></div>
      <div style="padding:40px 32px 8px;text-align:center;">
        <p style="letter-spacing:3px;font-size:11px;color:#caa14d;margin:0 0 6px;">${CLUB_NAME}</p>
        <div style="font-size:34px;margin:14px 0;">🏆</div>
        <h1 style="margin:0;font-size:22px;color:#f4e9cf;font-weight:700;">إنجاز جديد يُضاف إلى سجل النادي</h1>
      </div>
      <div style="padding:8px 32px 0;text-align:center;">
        <p style="font-size:19px;color:#ffffff;font-weight:600;margin:18px 0 6px;">${params.title}</p>
        ${params.awardName ? `<p style="font-size:14px;color:#caa14d;margin:4px 0;">${params.awardName}</p>` : ""}
        ${params.awardingOrganization ? `<p style="font-size:12px;color:#a8a29a;margin:2px 0 0;">${params.awardingOrganization}</p>` : ""}
      </div>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#caa14d,#e8c36f);color:#1c1a14;
          text-decoration:none;padding:13px 30px;border-radius:999px;font-size:14px;font-weight:700;">
          عرض تفاصيل الإنجاز
        </a>
      </div>
      <div style="padding:24px 24px 30px;text-align:center;border-top:1px solid #ffffff12;margin-top:24px;">
        <p style="margin:0;font-size:11px;color:#8a8578;">هذه رسالة تلقائية من موقع النادي — لا حاجة للرد عليها.</p>
      </div>
    </div>
  </div>`;
}

// ── قبول في نشاط (عضو أو ضيف) ─────────────────────────────────────────────
export function activityAcceptanceEmailTemplate(params: {
  recipientName: string;
  activityTitle: string;
  activityId: number;
  isGuest: boolean;
}): string {
  const url = absoluteUrl(`/activities/${params.activityId}`);
  return shell(`
    <div style="padding:36px 24px 8px;text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:#e6f4ea;display:flex;align-items:center;
        justify-content:center;margin:0 auto 16px;font-size:28px;">✅</div>
      <h1 style="margin:0;font-size:19px;color:#2b2b2b;">تم قبولك في النشاط</h1>
    </div>
    <div style="padding:8px 24px 4px;text-align:center;">
      <p style="font-size:14px;color:#3d3d3d;margin:14px 0 4px;">مرحباً ${params.recipientName}،</p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:6px 0;">
        يسعدنا إبلاغك بقبول ${params.isGuest ? "تسجيلك كضيف" : "اشتراكك"} في:
      </p>
      <p style="font-size:16px;color:#2b2b2b;font-weight:700;margin:12px 0;">${params.activityTitle}</p>
    </div>
    ${ctaButton(url, "لعرض تفاصيل النشاط يرجى الانتقال إلى الرابط التالي")}
    <div style="padding:0 24px 28px;"></div>
    <p style="text-align:center;font-size:12px;color:#8a8a8a;margin:0 0 20px;">${CLUB_NAME}</p>
  `);
}
