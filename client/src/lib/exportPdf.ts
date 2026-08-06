/**
 * Generates a real, downloadable PDF file entirely on the user's device —
 * no request is made, nothing is ever generated or stored on any server.
 *
 * How it works: the message is laid out off-screen as styled HTML (so the
 * browser handles Arabic text shaping/ligatures perfectly, which no
 * client-side PDF text API can do reliably), snapshotted with html2canvas,
 * then sliced into A4 pages and embedded as images in a jsPDF document.
 * Page breaks are chosen to fall between paragraphs/headings/list items
 * rather than through the middle of a line wherever that's possible.
 *
 * This replaced an earlier version that opened a new window and called
 * `window.print()`, leaving the user to manually choose "Save as PDF" —
 * that approach was blocked by popup blockers on some browsers and
 * unreliable on mobile Chrome/Safari, where the print dialog often doesn't
 * offer a PDF destination at all. This version always produces an actual
 * .pdf file and downloads it directly, on every platform.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Very small markdown-ish → HTML formatter: headings, bold, bullet lists,
 * and paragraphs. Enough for Basir's replies without pulling in a full
 * markdown renderer for the export. */
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

const EXPORT_CONTAINER_WIDTH_PX = 760;
const EXPORT_STYLE_ID = "basir-pdf-export-style";

function ensureExportStyles() {
  if (document.getElementById(EXPORT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = EXPORT_STYLE_ID;
  style.textContent = `
    .basir-pdf-export {
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      line-height: 1.9;
      color: #1a1a1a;
      background: #ffffff;
      padding: 28px 32px;
      width: ${EXPORT_CONTAINER_WIDTH_PX}px;
    }
    .basir-pdf-export h1, .basir-pdf-export h2, .basir-pdf-export h3 {
      color: #0f172a; margin: 1.2em 0 0.5em;
    }
    .basir-pdf-export h1 { font-size: 1.6em; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3em; }
    .basir-pdf-export h2 { font-size: 1.3em; }
    .basir-pdf-export h3 { font-size: 1.1em; }
    .basir-pdf-export p { margin: 0.6em 0; }
    .basir-pdf-export ul { margin: 0.6em 0; padding-inline-start: 1.4em; }
    .basir-pdf-export li { margin: 0.3em 0; }
    .basir-pdf-export .basir-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 1.5em; padding-bottom: 1em;
      border-bottom: 1px solid #e2e8f0;
    }
    .basir-pdf-export .basir-header strong { font-size: 1.1em; }
    .basir-pdf-export .basir-footer {
      margin-top: 2em; padding-top: 1em;
      border-top: 1px solid #e2e8f0;
      font-size: 0.75em; color: #64748b;
    }
  `;
  document.head.appendChild(style);
}

function buildOffscreenContainer(title: string, content: string): HTMLElement {
  ensureExportStyles();
  const container = document.createElement("div");
  container.className = "basir-pdf-export";
  // Rendered fully off-screen (not display:none — html2canvas needs real
  // layout) so nothing flashes on screen while it's generated.
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-10000px";
  container.style.zIndex = "-1";
  container.dir = "rtl";
  container.innerHTML = `
    <div class="basir-header">
      <strong>بصير</strong>
      <span style="color:#64748b;font-size:0.85em;">المساعد الذكي في نادي بصيرة الثقافي</span>
    </div>
    ${toPrintableHtml(content)}
    <div class="basir-footer">تم إنشاء هذا المستند على جهازك مباشرة عبر بصير — لم يُخزَّن على أي خادم.</div>
  `;
  void title; // title is used for the filename only; not repeated in the body (already implied by content)
  document.body.appendChild(container);
  return container;
}

/** CSS-pixel top offsets (relative to `container`) of every
 * heading/paragraph/list-item/header/footer block, used to steer page
 * breaks away from the middle of a line of text. */
function getBlockBoundaries(container: HTMLElement): number[] {
  const els = container.querySelectorAll<HTMLElement>("h1, h2, h3, p, li, .basir-header, .basir-footer");
  const containerTop = container.getBoundingClientRect().top;
  return Array.from(els)
    .map((el) => el.getBoundingClientRect().top - containerTop)
    .sort((a, b) => a - b);
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return (cleaned || "بصير").slice(0, 80);
}

/** Old fallback for browsers where canvas/PDF generation itself fails
 * (extremely rare — e.g. canvas blocked entirely) or the libraries fail to
 * load: opens a print-ready window so the user can still save a PDF
 * manually via their browser's print dialog. */
function fallbackPrintWindow(title: string, content: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) {
    throw new Error("تعذّر إنشاء الملف أو فتح نافذة الطباعة — تأكد من السماح بالنوافذ المنبثقة لهذا الموقع");
  }
  win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.9; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1, h2, h3 { color: #0f172a; margin: 1.2em 0 0.5em; }
  h1 { font-size: 1.6em; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3em; }
  h2 { font-size: 1.3em; } h3 { font-size: 1.1em; }
  p { margin: 0.6em 0; } ul { margin: 0.6em 0; padding-inline-start: 1.4em; } li { margin: 0.3em 0; }
</style></head><body>
  <h1>${escapeHtml(title || "بصير")}</h1>
  ${toPrintableHtml(content)}
</body></html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}

/**
 * Renders `content` as a downloadable PDF file named after `title`.
 * Resolves once the browser's save/download has been triggered.
 */
export async function exportTextAsPdf(title: string, content: string): Promise<void> {
  let container: HTMLElement | null = null;
  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    container = buildOffscreenContainer(title, content);

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const scaleFactor = canvas.width / container.offsetWidth;
    const containerHeightCss = container.offsetHeight;
    const boundaries = getBlockBoundaries(container);

    const marginMm = 12;
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;
    const pxPerMmCss = container.offsetWidth / contentWidthMm;
    const pageHeightCss = contentHeightMm * pxPerMmCss;

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    let cursorCss = 0;
    let first = true;

    while (cursorCss < containerHeightCss - 1) {
      let target = Math.min(cursorCss + pageHeightCss, containerHeightCss);

      if (target < containerHeightCss) {
        // Prefer breaking at the top of a block rather than mid-line: use
        // the latest block boundary that still fits, as long as it doesn't
        // make this page implausibly short (which would mean one block is
        // just taller than a full page — nothing to do there but cut it).
        const minCut = cursorCss + pageHeightCss * 0.25;
        const candidate = [...boundaries].reverse().find((b) => b > cursorCss && b <= target && b >= minCut);
        if (candidate) target = candidate;
      }

      const sliceCssHeight = target - cursorCss;
      const sliceCanvasY = Math.round(cursorCss * scaleFactor);
      const sliceCanvasHeight = Math.max(1, Math.round(sliceCssHeight * scaleFactor));

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceCanvasHeight;
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("canvas context unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sliceCanvasY,
        canvas.width,
        sliceCanvasHeight,
        0,
        0,
        canvas.width,
        sliceCanvasHeight,
      );

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.93);
      const imgHeightMm = sliceCssHeight / pxPerMmCss;
      if (!first) pdf.addPage();
      pdf.addImage(imgData, "JPEG", marginMm, marginMm, contentWidthMm, imgHeightMm);
      first = false;
      cursorCss = target;
    }

    pdf.save(`${sanitizeFileName(title)}.pdf`);
  } catch (err) {
    console.error("[Basir] PDF generation failed, falling back to print dialog", err);
    fallbackPrintWindow(title, content);
  } finally {
    container?.remove();
  }
}
