import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, Clock, Tag, Search, Pin } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import ShareButtons from "@/components/ShareButtons";
import { useInfiniteReveal } from "@/hooks/useInfiniteReveal";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface RichContent {
  subtitle?: string;
  content?: string;
  conclusion?: string;
  tags?: string[];
  references?: string;
  readingTime?: number | null;
  images?: { url: string; key: string }[];
}

function parseRichContent(raw: string): RichContent | null {
  try { return JSON.parse(raw) as RichContent; } catch { return null; }
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  literature:  { label: "أدب",        color: "bg-purple-100 text-purple-800" },
  grammar:     { label: "نحو وصرف",   color: "bg-blue-100 text-blue-800" },
  culture:     { label: "ثقافة",      color: "bg-green-100 text-green-800" },
  poetry:      { label: "شعر",        color: "bg-pink-100 text-pink-800" },
  criticism:   { label: "نقد أدبي",   color: "bg-orange-100 text-orange-800" },
  history:     { label: "تاريخ",      color: "bg-yellow-100 text-yellow-800" },
  research:    { label: "بحث علمي",   color: "bg-teal-100 text-teal-800" },
  general:     { label: "عام",        color: "bg-gray-100 text-gray-800" },
};

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const cat = CATEGORY_MAP[category] || { label: category, color: "bg-gray-100 text-gray-800" };
  return <Badge className={`w-fit ${cat.color}`}>{cat.label}</Badge>;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Article Card ─────────────────────────────────────────────────────────────
function ArticleCard({ article, onTogglePin }: { article: any; onTogglePin: (id: number, isPinned: boolean) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";
  const rich = parseRichContent(article.content);
  const tags = rich?.tags ?? [];
  const readingTime = rich?.readingTime;
  const additionalImages = rich?.images?.slice(1) ?? []; // صور إضافية غير الغلاف

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col ${article.isPinned ? "ring-1 ring-accent/60" : ""}`}>
      {/* صورة الغلاف */}
      {article.imageUrl && (
        <div className="relative overflow-hidden bg-muted">
          <img src={article.imageUrl} alt={article.title}
            className="w-full h-52 object-cover" loading="lazy" />
          <div className="absolute top-3 right-3 flex gap-2 flex-wrap">
            <CategoryBadge category={article.category} />
          </div>
          {article.isPinned ? <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground"><Pin className="w-3 h-3 ml-1 fill-current" /> مثبت</Badge> : null}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* العنوان */}
        <div className="flex items-start gap-2 mb-1">
          <h3 className="text-lg font-bold text-foreground leading-snug flex-1">{article.title}</h3>
          {!article.imageUrl && article.isPinned ? <Pin className="w-4 h-4 text-accent fill-current shrink-0" aria-label="مقال مثبت" /> : null}
        </div>

        {/* العنوان الفرعي */}
        {rich?.subtitle && (
          <p className="text-sm text-accent font-medium mb-2">{rich.subtitle}</p>
        )}

        {/* التصنيف (بدون صورة) */}
        {!article.imageUrl && <div className="mb-2"><CategoryBadge category={article.category} /></div>}

        {/* المقدمة */}
        {article.excerpt && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3 flex-1">
            {article.excerpt}
          </p>
        )}

        {/* الكلمات المفتاحية */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((t: string, i: number) => (
              <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />{t}
              </span>
            ))}
            {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
          </div>
        )}

        {/* مؤشر الصور الإضافية */}
        {additionalImages.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <span className="flex gap-0.5">
              {additionalImages.slice(0, 4).map((_: any, i: number) => (
                <span key={i} className="w-4 h-4 rounded bg-muted-foreground/20 inline-block" />
              ))}
            </span>
            <span>{additionalImages.length} صورة إضافية</span>
          </div>
        )}

        {/* المؤلف والتاريخ */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" /><span>{article.author}</span>
          </div>
          <div className="flex items-center gap-3">
            {readingTime && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{readingTime} د</span>
            )}
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(article.createdAt)}</span>
          </div>
        </div>

        {/* أزرار */}
        <div className="space-y-2">
          <ShareButtons title={article.title}
            url={`${window.location.origin}/articles/${article.id}`}
            description={article.excerpt || ""} />
          <div className="flex gap-2">
            <Link href={`/articles/${article.id}`} className="flex-1">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">اقرأ المقال</Button>
            </Link>
            {isAdmin && <>
              <Button variant="outline" size="icon" title={article.isPinned ? "إلغاء تثبيت المقال" : "تثبيت المقال"} onClick={() => onTogglePin(article.id, !article.isPinned)}>
                <Pin className={`w-4 h-4 ${article.isPinned ? "fill-current text-accent" : ""}`} />
              </Button>
              <Link href={`/admin/articles/${article.id}/edit`}><Button variant="outline">تعديل</Button></Link>
            </>}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Articles() {
  const { data: articles, isLoading, refetch } = trpc.articles.list.useQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";
  const [query, setQuery] = useState("");
  const togglePin = trpc.contentPins.toggle.useMutation({
    onSuccess: (_, variables) => { toast.success(variables.isPinned ? "تم تثبيت المقال" : "تم إلغاء تثبيت المقال"); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const filtered = (articles ?? []).filter((a: any) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const rich = parseRichContent(a.content);
    const cat = CATEGORY_MAP[a.category]?.label ?? a.category ?? "";
    return (
      a.title?.toLowerCase().includes(q) ||
      a.excerpt?.toLowerCase().includes(q) ||
      a.author?.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      (rich?.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    );
  });

  const { visibleCount, sentinelRef } = useInfiniteReveal(filtered.length);

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">المقالات والمحتوى</h1>
              <p className="text-lg text-muted-foreground">اقرأ مقالات ثقافية وأدبية من النادي الثقافي الأدبي</p>
            </div>
            {isAdmin && (
              <Link href="/admin/add-article">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">كتابة مقالة</Button>
              </Link>
            )}
          </div>
          <div className="relative max-w-md mt-8">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن مقالة بالعنوان أو الكاتب أو التصنيف..."
              className="w-full py-2.5 pr-11 pl-4 bg-background border border-border rounded-full text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-52 w-full" />
                  <div className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /></div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.length > 0
                ? filtered.slice(0, visibleCount).map((a: any) => <ArticleCard key={a.id} article={a} onTogglePin={(id, isPinned) => togglePin.mutate({ type: "article", id, isPinned })} />)
                : (
                  <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground text-lg">
                      {query.trim() ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد مقالات حالياً"}
                    </p>
                  </div>
                )
              }
            </div>
          )}
          {visibleCount < filtered.length && <div ref={sentinelRef} className="h-1" />}
        </div>
      </section>
    </div>
  );
}
