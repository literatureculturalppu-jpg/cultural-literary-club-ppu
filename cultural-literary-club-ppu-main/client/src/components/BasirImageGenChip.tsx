import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

/**
 * Renders the "[[IMGGEN|prompt]]" token Basir emits when explicitly asked
 * to generate an image. Nothing is generated until the user taps the chip;
 * the resulting image is a data URL held only in this component's state
 * and in the user's downloads folder if they save it — never uploaded or
 * stored server-side.
 */
export function BasirImageGenChip({ prompt }: { prompt: string }) {
  const [image, setImage] = useState<string | null>(null);
  const generate = trpc.basir.generateImage.useMutation({
    onSuccess: (data) => {
      setImage(`data:${data.mimeType};base64,${data.base64}`);
    },
    onError: (error) => {
      toast.error(error.message || "تعذّر توليد الصورة");
    },
  });

  if (image) {
    return (
      <div className="not-prose my-2 max-w-xs">
        <img src={image} alt={prompt} className="rounded-xl border border-border w-full" />
        <a
          href={image}
          download="basir-image.png"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          <Download className="w-3.5 h-3.5" />
          تنزيل الصورة إلى جهازك
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => generate.mutate({ prompt })}
      disabled={generate.isPending}
      className="not-prose inline-flex items-center gap-2 max-w-full my-1 mx-0.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/50 px-3 py-1.5 text-sm font-medium text-accent transition-colors align-middle disabled:opacity-60"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 shrink-0">
        {generate.isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ImagePlus className="w-3 h-3" />
        )}
      </span>
      <span className="truncate">{generate.isPending ? "جارٍ توليد الصورة..." : "توليد الصورة"}</span>
    </button>
  );
}
