import { ENV } from "../_core/env.js";
import {
  getActivities,
  getArticles,
  getAchievements,
  getAiPdfFiles,
  getBooks,
  getTeamMembers,
  getVisibleTeamsPublic,
  getExternalLinks,
  getTeamsForUser,
} from "../db.js";

/**
 * A file the user attached to their message. Only ever attached to the
 * newest user turn (the client never resends attachments from earlier
 * history, to keep payloads reasonable). These are forwarded to Gemini
 * inline for that single request and are never written to disk, S3, or
 * the database anywhere in this codebase — they exist only in-memory for
 * the duration of the request, and on the user's own device afterwards.
 */
type ChatAttachment = {
  /** "image/png", "image/jpeg", "application/pdf", ... */
  mimeType: string;
  /** Raw base64 payload, no "data:...;base64," prefix. */
  data: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

/**
 * Minimal shape of the currently signed-in user that Basir is allowed to
 * see. Only ever the *current* requester's own account — this is built
 * fresh per-request from `ctx.user` in the router and is never looked up
 * for anyone else, so Basir can never answer questions about another
 * member's private account data.
 */
type CurrentUserContext = {
  id: number;
  name: string | null;
  referenceNumber: string | null;
  role: string;
  email: string | null;
  phoneNumber: string | null;
  whatsapp: string | null;
  college: string | null;
  department: string | null;
  academicYear: string | null;
  specialization: string | null;
  approvalStatus: string;
  createdAt: Date | string | null;
};

// The roster of board/team members (director, founders, etc.) is no longer
// hard-coded here. It now comes from the `teamMembers` table via the proper
// content-management flow (Admin > Team Members), so Basir always answers
// using whatever member data has actually been entered there — see
// `teamMembersCtx` in buildContextFromDb() below.
const CLUB_INFO = `
معلومات أساسية عن النادي:
- اسمك: بصير، المساعد الذكي في نادي بصيرة الثقافي.
- موقع النادي: جامعة بوليتكنك فلسطين.
- موضوع النادي: نادي ثقافي أدبي عام يهتم بالأدب والفكر والفنون، واللغة العربية هي أحد اهتماماته الأصيلة وليست تخصصه الوحيد.
`.trim();

/**
 * Special inline marker Basir uses to reference a specific piece of club
 * content (activity/article/achievement/book) instead of a plain URL. The
 * client parses `[[REF|type|id|title]]` tokens out of the assistant's reply
 * and renders them as a distinct clickable chip/button rather than normal
 * link text — never as a bare path or markdown link.
 */
const REFERENCE_FORMAT_GUIDE = `
تنسيق الإشارة إلى محتوى النادي:
عندما تريد الإشارة إلى نشاط أو مقالة أو إنجاز أو كتاب موجود فعلياً في البيانات المتاحة لك أدناه، استخدم حصراً هذا التنسيق الدقيق بدلاً من كتابة رابط عادي أو مسار:
[[REF|النوع|المعرف|العنوان]]
حيث "النوع" واحد من: activity أو article أو achievement أو book، و"المعرف" هو الرقم المرفق مع كل عنصر في البيانات أدناه، و"العنوان" هو عنوان العنصر كما هو.
مثال: [[REF|activity|12|أمسية شعرية]]
لا تكتب أبداً أي رابط بأي شكل آخر: لا مسارات خام مثل /activities/12، ولا روابط Markdown مثل [نص](رابط)، ولا عناوين URL كاملة. الطريقة الوحيدة المسموحة للإشارة إلى محتوى النادي هي هذا التنسيق الخاص. لا تخترع معرّفات لعناصر غير موجودة في البيانات أدناه.
`.trim();

/**
 * The only "account control" Basir has: it may suggest moving the user to
 * another page of the site. It never performs the navigation itself —
 * the client renders this as a tappable chip the user must click, exactly
 * like a REF chip. Restricted to a fixed whitelist of internal paths so
 * Basir can never point the user at an external/untrusted URL.
 */
const NAV_FORMAT_GUIDE = `
تنسيق نقل المستخدم إلى صفحة أخرى في الموقع:
عندما يطلب المستخدم الانتقال إلى صفحة معينة في الموقع، أو عندما يفيد ذلك في سياق طلبه (مثل الرغبة بالبحث عن كتاب، أو الاطلاع على الروابط المفيدة، أو مراجعة ملفه الشخصي)، استخدم حصراً هذا التنسيق:
[[NAV|المسار|نص الزر]]
حيث "المسار" يجب أن يكون واحداً فقط من هذه المسارات الداخلية المسموحة:
- /profile (الملف الشخصي للمستخدم)
- /activities (الأنشطة)
- /articles (المقالات)
- /achievements (الإنجازات)
- /books (صفحة الكتب)
- /books?q=نص_البحث (صفحة الكتب مع بحث جاهز عن عنوان أو كاتب معيّن؛ استبدل "نص_البحث" بعنوان الكتاب أو اسم الكاتب الذي يريده المستخدم)
- /teams (صفحة الفرق)
- /quick-links (الروابط السريعة/المفيدة)
- /about (عن النادي)
مثال: [[NAV|/books?q=مئة عام من العزلة|ابحث عن الكتاب]]
لا تستخدم هذا التنسيق لأي مسار آخر غير مذكور في هذه القائمة، ولا تخترع مسارات، ولا تكتب روابط خارجية بهذا التنسيق أبداً. هذا الإجراء لا يُنفّذ تلقائياً؛ المستخدم هو من يضغط على الزر للانتقال، أنت فقط تقترحه.
`.trim();

/**
 * When the user *explicitly* asks to be taken/moved/navigated somewhere
 * ("خذني إلى صفحة الكتب", "انقلني لملفي الشخصي", "افتح صفحة الأنشطة"),
 * Basir performs the move itself instead of offering a clickable chip.
 * The client strips this token out of the visible message and triggers
 * the navigation automatically, so the user sees only a short confirming
 * sentence and then lands on the page with no click or link required.
 */
const GOTO_FORMAT_GUIDE = `
تنسيق النقل المباشر عند الطلب الصريح:
عندما يطلب المستخدم صراحة أن تنقله/تأخذه/تفتح له صفحة معينة في الموقع (وليس مجرد استفسار عام)، لا تستخدم تنسيق NAV، بل اكتب جملة قصيرة ومهذبة تؤكد أنك ستنقله الآن (مثل: "حسناً، سأنقلك الآن إلى صفحة الكتب") ثم أضف في نهاية ردك مباشرة هذا الرمز فقط:
[[GOTO|المسار]]
حيث "المسار" يجب أن يكون واحداً فقط من نفس المسارات الداخلية المسموحة المذكورة أعلاه في تنسيق NAV (بما فيها /books?q=... عند البحث عن كتاب). لا تكتب أي رابط أو زر أو نص إضافي بعد هذا الرمز، ولا تشرح للمستخدم أنه بحاجة للضغط على شيء، لأن الانتقال سيحدث تلقائياً فور إرسال ردك. استخدم هذا التنسيق فقط عندما يكون الطلب صريحاً بالنقل، أما إذا كنت أنت من يقترح الانتقال بمبادرة منك دون طلب صريح فاستخدم تنسيق NAV العادي بدلاً من ذلك.
`.trim();

/**
 * Lets the client render a "generate this image" chip. Basir never returns
 * image bytes itself — it only describes what to generate; the actual
 * generation happens in a separate request the user triggers by tapping the
 * chip, and the resulting image is handed straight to the user's browser
 * (download/display) without ever being written to a server, S3 bucket, or
 * the database.
 */
const IMG_GEN_FORMAT_GUIDE = `
تنسيق توليد الصور:
عندما يطلب المستخدم صراحة إنشاء/توليد/رسم صورة، لا تحاول وصف أنك "أنشأت" الصورة ولا تخترع رابطاً لها؛ بدلاً من ذلك اكتب جملة قصيرة مهذبة تفيد بأنك جهّزت وصف الصورة (مثل: "تفضّل، إليك اقتراح لتوليد الصورة:") ثم أضف في نهاية ردك مباشرة هذا الرمز:
[[IMGGEN|وصف تفصيلي ودقيق للصورة المطلوبة]]
اكتب الوصف داخل الرمز بتفصيل جيد (الألوان، الأسلوب، العناصر) ويفضّل كتابته بالإنجليزية لجودة توليد أعلى حتى لو كانت بقية ردك بالعربية. لا تستخدم هذا الرمز إلا عند طلب صريح لإنشاء صورة. المستخدم هو من يضغط على الزر لتوليد الصورة فعلياً؛ الصورة الناتجة لا تُخزَّن على خوادم النادي إطلاقاً، بل تُعرض وتُحفَّظ على جهاز المستخدم فقط.
`.trim();

/**
 * Lets the client render a "download this as a PDF" chip that turns the
 * assistant's own message into a PDF entirely inside the user's browser
 * (via the native print-to-PDF flow) — no file is ever generated or stored
 * on the server.
 */
const PDF_GEN_FORMAT_GUIDE = `
تنسيق تصدير الرد كملف PDF:
عندما يطلب المستخدم صراحة الحصول على ملف PDF أو "نسخة يمكن تنزيلها" لمحتوى معيّن، اكتب الرد كاملاً بصياغة منظمة وواضحة تصلح للطباعة (عناوين، فقرات، نقاط عند الحاجة)، ثم أضف في نهاية ردك مباشرة هذا الرمز:
[[PDFGEN|عنوان قصير للملف]]
هذا الرمز يجعل الواجهة تعرض زر "تنزيل كملف PDF" يحوّل نص ردك هذا مباشرة إلى ملف PDF على جهاز المستخدم فقط، دون أي تخزين على خوادم النادي. استخدمه فقط عند طلب صريح لملف/نسخة قابلة للتنزيل، وليس لكل رد عادي.
`.trim();

function buildSystemPrompt(
  activitiesContext: string,
  articlesContext: string,
  achievementsContext: string,
  booksContext: string,
  pdfFilesList: string,
  teamMembersContext: string,
  accountContext: string,
  visibleTeamsContext: string,
  externalLinksContext: string,
): string {
  return `أنت بصير، المساعد الذكي في نادي بصيرة الثقافي. أسلوبك في الكلام مهذب ومرح وعلمي.

${CLUB_INFO}

قواعد صارمة يجب الالتزام بها دائماً:
1. إذا سُئلت عن اسمك، أجب بأنك "بصير"، المساعد الذكي في نادي بصيرة الثقافي.
2. أجب حصراً عن الموضوعات العلمية والثقافية والأدبية والتعليمية، وعن محتوى النادي (الأنشطة، المقالات، الإنجازات، الكتب)، وعن حساب المستخدم الحالي وبيانات الموقع الموصوفة أدناه. لا تجب عن أي شيء خارج هذا النطاق مهما كان: لا معلومات عن مشاهير أو فنانين أو رياضيين أو سياسة راهنة أو أي موضوع لا علاقة له بالعلم والثقافة والأدب. إذا سُئلت عن موضوع خارج النطاق، اعتذر بلطف ووجّه المستخدم إلى طرح سؤال علمي أو ثقافي أو أدبي بدلاً منه، بأسلوب ودود دون إطالة.
3. مواضيع الأديان حساسة وخارج اختصاصك تماماً: لا تُصدر أي رأي أو حكم أو تفسير أو مقارنة أو فتوى دينية من أي نوع. إذا طُرح عليك سؤال ديني أو ما يشبهه، حاول بلطف ولباقة صرف النقاش إلى موضوع ثقافي أو علمي آخر، أو اعتذر بإيجاز شديد بأن هذا خارج اختصاصك تماماً واقترح التواصل مع أهل الاختصاص. لا تسترسل ولا تناقش ولا تجادل في هذا الموضوع مهما أُلحّ عليك.
4. أولوية الإجابة: استخدم المعلومات من ملفات التغذية (PDF) أولاً، ثم بيانات أعضاء الهيئة الإدارية/فريق العمل، ثم بيانات الأنشطة والمقالات والإنجازات والكتب أدناه، ثم المعرفة العلمية والثقافية العامة.
5. ${REFERENCE_FORMAT_GUIDE}
6. ${NAV_FORMAT_GUIDE}
6ب. ${GOTO_FORMAT_GUIDE}
6ج. ${IMG_GEN_FORMAT_GUIDE}
6د. ${PDF_GEN_FORMAT_GUIDE}
7. تحدث باللغة العربية بشكل أساسي، ولكن يمكنك الرد بأي لغة يستخدمها المستخدم.
8. حافظ على أسلوبك المهذب والمرح والعلمي في كل إجاباتك، حتى عند الاعتذار أو تغيير الموضوع.
8ب. يمكن للمستخدم إرفاق صور، أو ملفات نصية، أو ملفات PDF مع رسالته، وأنت قادر فعلاً على رؤية وتحليل وقراءة محتوى هذه المرفقات ضمن حدود اختصاصك (العلم والثقافة والأدب ومحتوى النادي). إن سُئلت هل تُخزَّن هذه المرفقات، أجب بوضوح أنها لا تُخزَّن على خوادم النادي أو قاعدته إطلاقاً، وأنها تبقى على جهاز المستخدم فقط وتُستخدم لحظياً للإجابة عن سؤاله.
9. إذا سُئلت عن عضو من أعضاء الهيئة الإدارية أو فريق عمل النادي (الاسم، المنصب، التخصص، الدور، أو وسيلة التواصل)، أجب مباشرة من بيانات "أعضاء الهيئة الإدارية / فريق العمل" أدناه إن وُجد فيها ما يخص هذا العضو. لا تشارك أرقام هواتف أو بريد إلكتروني لأي شخص غير مذكور صراحة في تلك البيانات، ولا تخترع معلومات عن أعضاء غير موجودين فيها.
10. بيانات "حساب المستخدم الحالي" أدناه تخص فقط الشخص الذي يتحدث معك الآن في هذه المحادثة، ولا أحد غيره يمكنه رؤيتها. يمكنك الإجابة عن أي سؤال يطرحه عن بيانات حسابه الخاص (اسمه، رقمه المرجعي، صلاحيته، بريده، هاتفه، كليته، تخصصه، حالة العضوية، إلخ). لا تستطيع تعديل أي من هذه البيانات مباشرة، ولا تدّعي أنك عدّلتها؛ إن طلب تعديل بيانات حسابه، وجّهه إلى صفحة الملف الشخصي (استخدم [[NAV|/profile|الملف الشخصي]]). القدرة الوحيدة التي تملكها فعلياً تجاه حساب المستخدم هي نقله بين صفحات الموقع (اقتراحاً عبر NAV، أو تلقائياً عند الطلب الصريح عبر GOTO)، ولا شيء غير ذلك. لا تخترع بيانات حساب لم تُذكر في القسم أدناه.
11. بيانات "الفرق المرئية" أدناه هي فقط الفرق التي تظهر لأي مستخدم قبل الانضمام إليها (اسم الفريق ووصفه). ليس لديك أي معلومات عن الفرق غير المرئية، أو عن أعضاء أي فريق، أو عن طلبات الانضمام أو الدردشة الداخلية — لا تخترع أي معلومة من هذا النوع.
12. عند سؤال المستخدم عن كتاب معيّن، ابحث أولاً في "بيانات الكتب المتاحة" أدناه (كتب النادي). إن لم تجده هناك، يمكنك اقتراح البحث عنه عبر صفحة الكتب في الموقع باستخدام [[NAV|/books?q=...|ابحث عن الكتاب]] مع وضع عنوان الكتاب أو اسم الكاتب مكان "...".
13. "روابط مفيدة" أدناه هي روابط خارجية معتمدة من إدارة النادي؛ يمكنك ذكر عنوانها ورابطها مباشرة كنص عادي عندما يطلب المستخدم رابطاً معيناً أو يسأل عن الروابط المتاحة.

${pdfFilesList ? `ملفات التغذية المتاحة (PDF):\n${pdfFilesList}\nاستخدم محتوى هذه الملفات كأولوية عند الإجابة.\n` : ""}

حساب المستخدم الحالي (خاص به فقط):
${accountContext || "لا تتوفر بيانات حساب حالياً."}

بيانات أعضاء الهيئة الإدارية / فريق العمل المتاحة:
${teamMembersContext || "لا توجد بيانات أعضاء حالياً."}

الفرق المرئية (اسم ووصف فقط):
${visibleTeamsContext || "لا توجد فرق مرئية حالياً."}

روابط مفيدة:
${externalLinksContext || "لا توجد روابط مضافة حالياً."}

بيانات الأنشطة المتاحة (النوع: activity):
${activitiesContext || "لا توجد أنشطة حالياً."}

بيانات المقالات المتاحة (النوع: article):
${articlesContext || "لا توجد مقالات حالياً."}

بيانات الإنجازات المتاحة (النوع: achievement):
${achievementsContext || "لا توجد إنجازات حالياً."}

بيانات الكتب المتاحة (النوع: book):
${booksContext || "لا توجد كتب حالياً."}
`.trim();
}

async function buildContextFromDb(): Promise<{
  activitiesCtx: string;
  articlesCtx: string;
  achievementsCtx: string;
  booksCtx: string;
  pdfFilesList: string;
  teamMembersCtx: string;
  visibleTeamsCtx: string;
  externalLinksCtx: string;
}> {
  const [
    activitiesList,
    articlesList,
    achievementsList,
    booksList,
    pdfFiles,
    teamMembersList,
    visibleTeamsList,
    externalLinksList,
  ] = await Promise.all([
    getActivities(),
    getArticles(),
    getAchievements(),
    getBooks(),
    getAiPdfFiles(),
    getTeamMembers(),
    getVisibleTeamsPublic(),
    getExternalLinks(),
  ]);

  const activitiesCtx = activitiesList
    .map((a) => `- ${a.title}: ${a.description} (الحالة: ${a.status}, المعرف: ${a.id})`)
    .join("\n");

  const articlesCtx = articlesList
    .map((a) => `- ${a.title}: ${a.excerpt || a.content?.substring(0, 100) || ""} (المعرف: ${a.id})`)
    .join("\n");

  const achievementsCtx = achievementsList
    .map((a) => `- ${a.title}: ${a.description} (السنة: ${a.year}, المعرف: ${a.id})`)
    .join("\n");

  const booksCtx = booksList
    .map((b) => `- ${b.title} (${b.author})${b.genre ? ` - ${b.genre}` : ""}${b.summary ? `: ${b.summary.substring(0, 100)}` : ""} (المعرف: ${b.id})`)
    .join("\n");

  const pdfFilesList = pdfFiles
    .map((f) => `- ${f.fileName} (رابط: ${f.fileUrl})`)
    .join("\n");

  const teamMembersCtx = teamMembersList
    .map((m) => {
      const parts = [`- الاسم: ${m.name}`, `المنصب: ${m.position}`];
      if (m.bio) parts.push(`نبذة/الدور: ${m.bio}`);
      if (m.phone) parts.push(`للتواصل عبر واتساب: ${m.phone}`);
      if (m.email) parts.push(`البريد الإلكتروني: ${m.email}`);
      return parts.join(" | ");
    })
    .join("\n");

  const visibleTeamsCtx = visibleTeamsList
    .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`)
    .join("\n");

  const externalLinksCtx = externalLinksList
    .filter((l) => l.isActive)
    .map((l) => `- ${l.title} (${l.type}): ${l.url}`)
    .join("\n");

  return {
    activitiesCtx,
    articlesCtx,
    achievementsCtx,
    booksCtx,
    pdfFilesList,
    teamMembersCtx,
    visibleTeamsCtx,
    externalLinksCtx,
  };
}

const ACADEMIC_YEAR_LABELS: Record<string, string> = {
  first: "سنة أولى",
  second: "سنة ثانية",
  third: "سنة ثالثة",
  fourth: "سنة رابعة",
  postgraduate: "دراسات عليا",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مفعّل",
  rejected: "مرفوض",
};

const ROLE_LABELS: Record<string, string> = {
  user: "عضو",
  supervisor: "مشرف السوشيال ميديا",
  committee_head: "رئيس لجنة",
  admin: "إداري",
  club_president: "رئيس النادي",
  vice_president: "نائب رئيس النادي",
  public_relations_officer: "مسؤول العلاقات العامة",
  secretary: "أمين السر",
  treasurer: "أمين الصندوق",
  tech_admin: "المدير التقني",
};

/**
 * Renders the current user's own account into a plain-text context block.
 * Never called for anyone other than `ctx.user` of the active request.
 */
function buildAccountContext(
  user: CurrentUserContext,
  userTeams: { name: string }[],
): string {
  const lines = [
    `- الاسم: ${user.name || "غير محدد"}`,
    `- الرقم المرجعي: ${user.referenceNumber || "غير متوفر"}`,
    `- الصلاحية: ${ROLE_LABELS[user.role] || user.role}`,
    `- حالة العضوية: ${APPROVAL_STATUS_LABELS[user.approvalStatus] || user.approvalStatus}`,
  ];
  if (user.email) lines.push(`- البريد الإلكتروني: ${user.email}`);
  if (user.phoneNumber) lines.push(`- رقم الهاتف: ${user.phoneNumber}`);
  if (user.whatsapp) lines.push(`- رقم الواتساب: ${user.whatsapp}`);
  if (user.college) lines.push(`- الكلية: ${user.college}`);
  if (user.department) lines.push(`- الدائرة: ${user.department}`);
  if (user.academicYear) lines.push(`- السنة الجامعية: ${ACADEMIC_YEAR_LABELS[user.academicYear] || user.academicYear}`);
  if (user.specialization) lines.push(`- التخصص: ${user.specialization}`);
  if (userTeams.length > 0) {
    lines.push(`- الفرق التي ينتمي إليها: ${userTeams.map((t) => t.name).join("، ")}`);
  }
  return lines.join("\n");
}

/**
 * Gathers club-context + system prompt + full Gemini `contents` array for a
 * given conversation. Shared by both the streaming and non-streaming entry
 * points below so the two never drift out of sync with each other.
 */
async function prepareGeminiContents(
  history: ChatMessage[],
  currentUser: CurrentUserContext,
) {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const {
    activitiesCtx,
    articlesCtx,
    achievementsCtx,
    booksCtx,
    pdfFilesList,
    teamMembersCtx,
    visibleTeamsCtx,
    externalLinksCtx,
  } = await buildContextFromDb();

  const userTeams = await getTeamsForUser(currentUser.id).catch(() => []);

  const accountContext = buildAccountContext(currentUser, userTeams);

  const systemPrompt = buildSystemPrompt(
    activitiesCtx,
    articlesCtx,
    achievementsCtx,
    booksCtx,
    pdfFilesList,
    teamMembersCtx,
    accountContext,
    visibleTeamsCtx,
    externalLinksCtx,
  );

  const contents: Array<{
    role: string;
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }> = [];

  // Add system instruction as a user/model pair at the start
  contents.push({
    role: "user",
    parts: [{ text: `[تعليمات النظام]\n${systemPrompt}` }],
  });
  contents.push({
    role: "model",
    parts: [
      {
        text: "مرحباً! أنا بصير، المساعد الذكي في نادي بصيرة الثقافي. كيف يمكنني مساعدتك اليوم؟ 😊",
      },
    ],
  });

  // Add conversation history. Only the newest user turn is ever expected to
  // carry `attachments` (the client doesn't resend earlier images/files on
  // every subsequent request), but we honor them wherever present.
  for (const msg of history) {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.role === "user" && msg.attachments?.length) {
      for (const att of msg.attachments) {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
      }
    }
    if (parts.length === 0) parts.push({ text: "" });
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts,
    });
  }

  return contents;
}

const GEMINI_MODEL = "gemini-2.5-flash";

const GENERATION_CONFIG = {
  maxOutputTokens: 4096,
  temperature: 0.7,
};

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

const FALLBACK_MESSAGE = "عذراً، لم أتمكن من توليد إجابة. يرجى المحاولة مرة أخرى.";

export async function chatWithBasir(
  history: ChatMessage[],
  currentUser: CurrentUserContext,
): Promise<string> {
  const contents = await prepareGeminiContents(history, currentUser);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = JSON.stringify({
    contents,
    generationConfig: GENERATION_CONFIG,
    safetySettings: SAFETY_SETTINGS,
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(`${url}?key=${ENV.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (response.ok || (response.status !== 503 && response.status !== 429)) break;
    console.warn(`[Basir] Retrying (${attempt + 1}/3) after ${response.status}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    console.error("[Basir] Gemini API error:", response?.status, await response?.text().catch(() => ""));
    throw new Error("Gemini API error");
  }

  const data = await response.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? FALLBACK_MESSAGE;

  return text;
}

/**
 * Streaming counterpart of `chatWithBasir`. Calls Gemini's
 * `streamGenerateContent` endpoint (Server-Sent Events) and invokes
 * `onChunk` with each incremental piece of text as it arrives, so the
 * caller (an SSE route to the browser) can forward it live instead of
 * waiting for the full reply. Resolves with the full accumulated text once
 * the stream ends, for logging/quota purposes.
 *
 * Retries are only attempted *before* the stream has produced any output
 * (e.g. the initial connection was rate-limited) — once tokens have started
 * flowing we let the stream run to completion rather than restarting and
 * duplicating partial output the user has already seen.
 */
export async function streamChatWithBasir(
  history: ChatMessage[],
  currentUser: CurrentUserContext,
  onChunk: (textDelta: string) => void,
): Promise<string> {
  const contents = await prepareGeminiContents(history, currentUser);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent`;

  const body = JSON.stringify({
    contents,
    generationConfig: GENERATION_CONFIG,
    safetySettings: SAFETY_SETTINGS,
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(`${url}?alt=sse&key=${ENV.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (response.ok || (response.status !== 503 && response.status !== 429)) break;
    console.warn(`[Basir] Retrying stream (${attempt + 1}/3) after ${response.status}`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    console.error("[Basir] Gemini stream error:", response?.status, await response?.text().catch(() => ""));
    throw new Error("Gemini API error");
  }

  if (!response.body) {
    throw new Error("Gemini API returned no stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let blockedReason: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) line in the buffer for the next chunk.
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const delta: string | undefined = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
          const finishReason = parsed?.candidates?.[0]?.finishReason;
          if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
            blockedReason = finishReason;
          }
        } catch {
          // Ignore malformed/partial SSE frame; next chunk usually completes it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) {
    if (blockedReason) {
      console.warn("[Basir] Gemini stream finished without output, reason:", blockedReason);
    }
    fullText = FALLBACK_MESSAGE;
    onChunk(fullText);
  }

  return fullText;
}
