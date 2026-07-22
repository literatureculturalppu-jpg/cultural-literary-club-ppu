import { ENV } from "../_core/env.js";
import {
  getActivities,
  getArticles,
  getAchievements,
  getAiPdfFiles,
  getBooks,
} from "../db.js";

type ChatMessage = { role: "user" | "assistant"; content: string };

// NOTE: Deliberately no roster of names (director/founder/social-media lead,
// etc.) here anymore — that information will be reintroduced later via a
// proper content-management flow instead of being hard-coded into the prompt.
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

function buildSystemPrompt(
  activitiesContext: string,
  articlesContext: string,
  achievementsContext: string,
  booksContext: string,
  pdfFilesList: string,
): string {
  return `أنت بصير، المساعد الذكي في نادي بصيرة الثقافي. أسلوبك في الكلام مهذب ومرح وعلمي.

${CLUB_INFO}

قواعد صارمة يجب الالتزام بها دائماً:
1. إذا سُئلت عن اسمك، أجب بأنك "بصير"، المساعد الذكي في نادي بصيرة الثقافي.
2. أجب حصراً عن الموضوعات العلمية والثقافية والأدبية والتعليمية، وعن محتوى النادي (الأنشطة، المقالات، الإنجازات، الكتب). لا تجب عن أي شيء خارج هذا النطاق مهما كان: لا معلومات عن مشاهير أو فنانين أو رياضيين أو سياسة راهنة أو شؤون شخصية أو أي موضوع لا علاقة له بالعلم والثقافة والأدب. إذا سُئلت عن موضوع خارج النطاق، اعتذر بلطف ووجّه المستخدم إلى طرح سؤال علمي أو ثقافي أو أدبي بدلاً منه، بأسلوب ودود دون إطالة.
3. مواضيع الأديان حساسة وخارج اختصاصك تماماً: لا تُصدر أي رأي أو حكم أو تفسير أو مقارنة أو فتوى دينية من أي نوع. إذا طُرح عليك سؤال ديني أو ما يشبهه، حاول بلطف ولباقة صرف النقاش إلى موضوع ثقافي أو علمي آخر، أو اعتذر بإيجاز شديد بأن هذا خارج اختصاصك تماماً واقترح التواصل مع أهل الاختصاص. لا تسترسل ولا تناقش ولا تجادل في هذا الموضوع مهما أُلحّ عليك.
4. أولوية الإجابة: استخدم المعلومات من ملفات التغذية (PDF) أولاً، ثم من بيانات الأنشطة والمقالات والإنجازات والكتب أدناه، ثم المعرفة العلمية والثقافية العامة.
5. ${REFERENCE_FORMAT_GUIDE}
6. تحدث باللغة العربية بشكل أساسي، ولكن يمكنك الرد بأي لغة يستخدمها المستخدم.
7. حافظ على أسلوبك المهذب والمرح والعلمي في كل إجاباتك، حتى عند الاعتذار أو تغيير الموضوع.

${pdfFilesList ? `ملفات التغذية المتاحة (PDF):\n${pdfFilesList}\nاستخدم محتوى هذه الملفات كأولوية عند الإجابة.\n` : ""}

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
}> {
  const [activitiesList, articlesList, achievementsList, booksList, pdfFiles] =
    await Promise.all([
      getActivities(),
      getArticles(),
      getAchievements(),
      getBooks(),
      getAiPdfFiles(),
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

  return { activitiesCtx, articlesCtx, achievementsCtx, booksCtx, pdfFilesList };
}

export async function chatWithBasir(
  history: ChatMessage[],
): Promise<string> {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const { activitiesCtx, articlesCtx, achievementsCtx, booksCtx, pdfFilesList } =
    await buildContextFromDb();

  const systemPrompt = buildSystemPrompt(
    activitiesCtx,
    articlesCtx,
    achievementsCtx,
    booksCtx,
    pdfFilesList,
  );

  const contents = [];

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

  // Add conversation history
  for (const msg of history) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const body = JSON.stringify({
    contents,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
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
    const errorText = await response?.text() ?? "no response";
    console.error("[Basir] Gemini API error:", response?.status);
    throw new Error("Gemini API error");
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "عذراً، لم أتمكن من توليد إجابة. يرجى المحاولة مرة أخرى.";

  return text;
}
