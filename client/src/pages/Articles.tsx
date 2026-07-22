import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, Clock, Tag } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import ShareButtons from "@/components/ShareButtons";

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
function ArticleCard({ article }: { article: any }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";
  const rich = parseRichContent(article.content);
  const tags = rich?.tags ?? [];
  const readingTime = rich?.readingTime;
  const additionalImages = rich?.images?.slice(1) ?? []; // صور إضافية غير الغلاف

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* صورة الغلاف */}
      {article.imageUrl && (
        <div className="relative overflow-hidden bg-muted">
          <img src={article.imageUrl} alt={article.title}
            className="w-full h-52 object-cover" loading="lazy" />
          <div className="absolute top-3 right-3 flex gap-2 flex-wrap">
            <CategoryBadge category={article.category} />
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* العنوان */}
        <h3 className="text-lg font-bold text-foreground leading-snug mb-1">{article.title}</h3>

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
            {isAdmin && (
              <Link href={`/admin/articles/${article.id}/edit`}>
                <Button variant="outline">تعديل</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Articles() {
  const { data: articles, isLoading } = trpc.articles.list.useQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";

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
              {articles && articles.length > 0
                ? articles.map((a: any) => <ArticleCard key={a.id} article={a} />)
                : <div className="col-span-full text-center py-12"><p className="text-muted-foreground text-lg">لا توجد مقالات حالياً</p></div>
              }
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
