import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";

export const READING_STATUS_LABELS = {
  want_to_read: "أريد قراءته",
  reading: "أقرأه الآن",
  finished: "أنهيته",
} as const;

export type ReadingStatus = keyof typeof READING_STATUS_LABELS;

export function ReadingStatusControl({ bookId, status, isAuthenticated, compact = false }: {
  bookId: number;
  status?: ReadingStatus;
  isAuthenticated: boolean;
  compact?: boolean;
}) {
  const utils = trpc.useUtils();
  const setStatus = trpc.books.setShelfStatus.useMutation({
    onSuccess: () => { void utils.books.myShelf.invalidate(); toast.success("تم تحديث قائمتك الشخصية"); },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.books.removeFromShelf.useMutation({
    onSuccess: () => { void utils.books.myShelf.invalidate(); toast.success("أزيل الكتاب من قائمتك"); },
    onError: (error) => toast.error(error.message),
  });

  if (!isAuthenticated) {
    return <Link href="/login" onClick={(event) => event.stopPropagation()}><Button variant="outline" size="sm" className="w-full text-xs">سجّل الدخول لإضافة لقائمتك</Button></Link>;
  }

  return <div className={`flex gap-2 ${compact ? "" : "pt-3 border-t border-border"}`} onClick={(event) => event.stopPropagation()}>
    <select
      value={status ?? ""}
      onChange={(event) => {
        const value = event.target.value as ReadingStatus | "";
        if (!value) remove.mutate({ bookId });
        else setStatus.mutate({ bookId, status: value });
      }}
      disabled={setStatus.isPending || remove.isPending}
      className="flex-1 h-8 px-2 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      aria-label="حالة قراءتي للكتاب"
    >
      <option value="">أضف إلى قائمتي</option>
      {Object.entries(READING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </div>;
}
