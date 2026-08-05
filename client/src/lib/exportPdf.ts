/**
 * Opens a new, styled, print-ready window containing the given text and
 * triggers the browser's native print dialog, where the user picks
 * "Save as PDF" (or an actual printer). This is entirely client-side: no
 * request is made, no file is generated or stored on any server — the
 * resulting PDF exists only wherever the user's browser saves it.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Very small markdown-ish → HTML formatter: headings, bold, bullet lists,
 * and paragraphs. Enough for Basir's replies without pulling in a full
 * markdown renderer for a print window. */
function toPrintableHtml(text: string): string {
  const lines = text.split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  const inlineFormat = (line: string) =>
    escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inlineFormat(line)}</p>`);
    }
  }
  closeList();
  return html.join("\n");
}

export function exportTextAsPdf(title: string, content: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) {
    throw new Error("تعذّر فتح نافذة الطباعة — تأكد من السماح بالنوافذ المنبثقة لهذا الموقع");
  }

  const bodyHtml = toPrintableHtml(content);

  win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 2cm; }
  body {
    font-family: "Segoe UI", Tahoma, "Arial", sans-serif;
    direction: rtl;
    text-align: right;
    line-height: 1.9;
    color: #1a1a1a;
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
  }
  h1, h2, h3 { color: #0f172a; margin: 1.2em 0 0.5em; }
  h1 { font-size: 1.6em; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.1em; }
  p { margin: 0.6em 0; }
  ul { margin: 0.6em 0; padding-inline-start: 1.4em; }
  li { margin: 0.3em 0; }
  .basir-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 1.5em;
    padding-bottom: 1em;
    border-bottom: 1px solid #e2e8f0;
  }
  .basir-header strong { font-size: 1.1em; }
  .basir-footer {
    margin-top: 2em;
    padding-top: 1em;
    border-top: 1px solid #e2e8f0;
    font-size: 0.75em;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="basir-header">
    <strong>بصير</strong>
    <span style="color:#64748b;font-size:0.85em;">المساعد الذكي في نادي بصيرة الثقافي</span>
  </div>
  ${bodyHtml}
  <div class="basir-footer">تم إنشاء هذا المستند على جهازك مباشرة عبر بصير — لم يُخزَّن على أي خادم.</div>
</body>
</html>`);
  win.document.close();

  // Give the window a beat to lay out fonts before opening the print dialog.
  win.onload = () => {
    win.focus();
    win.print();
  };
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}
