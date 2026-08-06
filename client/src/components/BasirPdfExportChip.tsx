import { useState } from "react";
import { FileDown, Loader2, Check } from "lucide-react";
import { exportTextAsPdf } from "@/lib/exportPdf";
import { toast } from "sonner";

/**
 * Renders the "[[PDFGEN|title]]" token Basir emits when explicitly asked
 * for a downloadable file. Clicking it generates a real PDF file on-device
 * (html2canvas + jsPDF — see exportPdf.ts) and downloads it directly, no
 * server call and nothing ever stored outside the user's own device.
 */
export function BasirPdfExportChip({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");

  const handleClick = async () => {
    if (status === "generating") return;
    setStatus("generating");
    try {
      await exportTextAsPdf(title || "بصير", content);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("idle");
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الملف");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "generating"}
      className="not-prose inline-flex items-center gap-2 max-w-full my-1 mx-0.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/50 disabled:opacity-70 disabled:cursor-wait px-3 py-1.5 text-sm font-medium text-accent transition-colors align-middle"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 shrink-0">
        {status === "generating" ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : status === "done" ? (
          <Check className="w-3 h-3" />
        ) : (
          <FileDown className="w-3 h-3" />
        )}
      </span>
      <span className="truncate">
        {status === "generating"
          ? "جارٍ إنشاء الملف..."
          : status === "done"
            ? "تم التنزيل"
            : `تنزيل كملف PDF${title ? `: ${title}` : ""}`}
      </span>
    </button>
  );
}
