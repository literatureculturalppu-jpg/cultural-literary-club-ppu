import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const origin = "https://cultural-literary-club-ppu.vercel.app";
const output = join(process.cwd(), "dist", "public");
const basePath = join(output, "index.html");
const pages = {
  "/": ["النادي الثقافي الأدبي | جامعة بوليتكنك فلسطين", "النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين: أنشطة ثقافية وأدبية، مقالات، كتب، إنجازات وفعاليات طلابية."],
  "/about": ["عن النادي الثقافي الأدبي | جامعة بوليتكنك فلسطين", "تعرف على تاريخ النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين ورؤيته وأهدافه وهيئته الإدارية."],
  "/activities": ["الأنشطة والفعاليات | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "استكشف الأنشطة والفعاليات الثقافية والأدبية وورش العمل التي يقدمها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/articles": ["المقالات والمحتوى الثقافي | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "اقرأ مقالات وقراءات أدبية وثقافية ينشرها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/achievements": ["الإنجازات والجوائز | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "تعرّف على أبرز إنجازات وجوائز النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/books": ["الكتب والقراءات | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "تصفح كتبًا وقراءات مقترحة من النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/teams": ["فرق النادي | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "تعرّف على فرق ومبادرات النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/quick-links": ["روابط مفيدة | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "روابط ومصادر مفيدة يقدمها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/privacy-policy": ["سياسة الخصوصية | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "سياسة الخصوصية الخاصة بموقع النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
  "/terms-of-use": ["شروط الاستخدام | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين", "شروط استخدام موقع النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين."],
};

const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const replace = (html, pattern, value) => html.replace(pattern, value);
const base = readFileSync(basePath, "utf8");

for (const [path, [title, description]] of Object.entries(pages)) {
  const url = origin + path;
  let html = base;
  html = replace(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replace(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replace(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${url}" />`);
  html = replace(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replace(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replace(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${url}" />`);
  html = replace(html, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replace(html, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  const target = path === "/" ? basePath : join(output, path.slice(1), "index.html");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html, "utf8");
}

console.log(`Generated static SEO pages for ${Object.keys(pages).length} public routes.`);
