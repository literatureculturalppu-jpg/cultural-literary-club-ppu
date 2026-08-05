import { Link } from "wouter";
import { CalendarDays, FileText, Trophy, BookOpen, ArrowUpLeft } from "lucide-react";

export type BasirRefType = "activity" | "article" | "achievement" | "book";

const REF_META: Record<
  BasirRefType,
  { icon: typeof CalendarDays; label: string; href: (id: string) => string }
> = {
  activity: { icon: CalendarDays, label: "نشاط", href: (id) => `/activities/${id}` },
  article: { icon: FileText, label: "مقالة", href: (id) => `/articles/${id}` },
  achievement: { icon: Trophy, label: "إنجاز", href: (id) => `/achievements/${id}` },
  book: { icon: BookOpen, label: "كتاب", href: () => `/books` },
};

/**
 * The distinctive "card-button" Basir uses to point at real club content —
 * intentionally NOT a plain underlined text link, so it reads as an action
 * ("open this") rather than a citation.
 */
export function BasirReferenceChip({
  type,
  id,
  title,
}: {
  type: BasirRefType;
  id: string;
  title: string;
}) {
  const meta = REF_META[type] ?? REF_META.article;
  const Icon = meta.icon;

  return (
    <Link
      href={meta.href(id)}
      className="not-prose inline-flex items-center gap-2 max-w-full my-1 mx-0.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/50 px-3 py-1.5 text-sm font-medium text-accent transition-colors align-middle"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 shrink-0">
        <Icon className="w-3 h-3" />
      </span>
      <span className="truncate">{title}</span>
      <span className="text-[10px] text-accent/70 shrink-0">{meta.label}</span>
      <ArrowUpLeft className="w-3 h-3 shrink-0 opacity-60" />
    </Link>
  );
}
