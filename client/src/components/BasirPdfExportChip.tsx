import { FileDown } from "lucide-react";
import { exportTextAsPdf } from "@/lib/exportPdf";
import { toast } from "sonner";

/**
 * Renders the "[[PDFGEN|title]]" token Basir emits when explicitly asked
 * for a downloadable file. Clicking it turns the surrounding message text
 * into a PDF using the browser's own print-to-PDF flow — no server call,
 * no file ever created or stored outside the user's own device.
 */
export function BasirPdfExportChip({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          exportTextAsPdf(title || "بصير", content);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الملف");
        }
      }}
      className="not-prose inline-flex items-center gap-2 max-w-full my-1 mx-0.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/50 px-3 py-1.5 text-sm font-medium text-accent transition-colors align-middle"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 shrink-0">
        <FileDown className="w-3 h-3" />
      </span>
      <span className="truncate">تنزيل كملف PDF{title ? `: ${title}` : ""}</span>
    </button>
  );
}
