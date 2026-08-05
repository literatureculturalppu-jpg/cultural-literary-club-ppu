/**
 * Turns files the user attaches to a Basir message into either:
 *  - an inline base64 attachment (images, PDFs) sent to the model for that
 *    one request only, or
 *  - plain extracted text (txt/md/csv/json/code files) appended straight
 *    into the message content.
 *
 * Nothing here ever touches the network except the eventual `basir.chat`
 * call itself — no upload endpoint, no storage bucket, no database row.
 * Everything lives in the browser (in-memory, then in the user's own
 * localStorage chat history) for as long as the user keeps it.
 */

export type BasirInlineAttachment = {
  kind: "image" | "pdf";
  mimeType: string;
  /** Raw base64, no "data:...;base64," prefix — what gets sent to the API. */
  data: string;
  /** Small data URL for on-device display/persistence (images only). */
  thumbnail?: string;
  fileName: string;
};

export type PreparedAttachment =
  | { type: "inline"; attachment: BasirInlineAttachment }
  | { type: "text"; fileName: string; text: string }
  | { type: "rejected"; fileName: string; reason: string };

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB raw
const MAX_TEXT_CHARS = 20000;
const IMAGE_MAX_DIM = 1280;
const THUMB_MAX_DIM = 220;

const TEXT_EXTENSIONS = [
  ".txt", ".md", ".markdown", ".csv", ".json", ".log", ".xml", ".yml", ".yaml",
  ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".c", ".cpp", ".java",
  ".sql", ".sh",
];

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  const lower = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Resizes an image (keeping aspect ratio) so its longest side is <= maxDim,
 * returning a JPEG data URL. Used both for the payload sent to the model
 * (smaller = faster/cheaper) and for the on-device thumbnail. */
async function resizeImage(dataUrl: string, maxDim: number, quality = 0.85): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlToRawBase64(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  return { mimeType: match?.[1] ?? "application/octet-stream", data: match?.[2] ?? "" };
}

/** Prepares a single File for sending to/persisting alongside a Basir message. */
export async function prepareBasirFile(file: File): Promise<PreparedAttachment> {
  try {
    if (file.type.startsWith("image/")) {
      const original = await readAsDataURL(file);
      const resized = await resizeImage(original, IMAGE_MAX_DIM);
      const thumb = await resizeImage(original, THUMB_MAX_DIM, 0.7);
      const { mimeType, data } = dataUrlToRawBase64(resized);
      return {
        type: "inline",
        attachment: { kind: "image", mimeType, data, thumbnail: thumb, fileName: file.name },
      };
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (file.size > MAX_PDF_BYTES) {
        return { type: "rejected", fileName: file.name, reason: "حجم الملف أكبر من 8 ميغابايت" };
      }
      const original = await readAsDataURL(file);
      const { mimeType, data } = dataUrlToRawBase64(original);
      return {
        type: "inline",
        attachment: { kind: "pdf", mimeType: mimeType || "application/pdf", data, fileName: file.name },
      };
    }

    if (isTextLike(file)) {
      let text = await readAsText(file);
      if (text.length > MAX_TEXT_CHARS) {
        text = `${text.slice(0, MAX_TEXT_CHARS)}\n… (تم اقتصاص الملف لأنه طويل جداً)`;
      }
      return { type: "text", fileName: file.name, text };
    }

    return {
      type: "rejected",
      fileName: file.name,
      reason: "نوع الملف غير مدعوم — الأنواع المدعومة: صور، PDF، وملفات نصية",
    };
  } catch {
    return { type: "rejected", fileName: file.name, reason: "تعذّرت قراءة الملف" };
  }
}

export async function prepareBasirFiles(files: File[]): Promise<PreparedAttachment[]> {
  return Promise.all(files.map(prepareBasirFile));
}
