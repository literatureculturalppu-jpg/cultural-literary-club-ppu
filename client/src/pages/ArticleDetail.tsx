import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, User, Clock, Tag, BookOpen } from "lucide-react";
import { useState } from "react";
import ShareButtons from "@/components/ShareButtons";

interface RichContent {
  subtitle?: string;
  content?: string;
  conclusion?: string;
  tags?: string[];
  references?: string;
  readingTime?: number | null;
  images?: { url: string; key: string }[];
}

function parseRichContent(raw: string): RichContent {
  try { return JSON.parse(raw) as RichContent; }
  catch { return { content: raw }; }
}

const CATEGORY_MAP: Record<string, string> = {
  literature: "أدب", grammar: "نحو وصرف", culture: "ثقافة",
  poetry: "شعر", criticism: "نقد أدبي", history: "تاريخ",
  research: "بحث علمي", general: "عام",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

export default function ArticleDetail() {
  const params = useParams<{ id: string }>();
  const [activeImg, setActiveImg] = useState(0);

  // دعم id رقمي أو slug نصي
  const idNum = parseInt(params.id || "0");
  const { data: article, isLoading } = trpc.articles.getById.useQuery(idNum, { enabled: !!idNum && !isNaN(idNum) });
  const { data: articleBySlug } = trpc.articles.getBySlug.useQuery(params.id || "", { enabled: isNaN(idNum) });

  const data = article || articleBySlug;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <div className="container py-16 text-center" dir="rtl"><p className="text-muted-foreground">المقالة غير موجودة</p><Link href="/articles"><Button className="mt-4">العودة للمقالات</Button></Link></div>;

  const rich = parseRichContent(data.content || "");
  const images = rich.images || (data.imageUrl ? [{ url: data.imageUrl, key: "" }] : []);
  const tags = rich.tags || [];
  const bodyText = rich.content || (typeof data.content === "string" && !data.content.startsWith("{") ? data.content : "");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/articles"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link>
            {data.category && (
              <Badge className="bg-accent/10 text-accent border border-accent/20">
                {CATEGORY_MAP[data.category] || data.category}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">{data.title}</h1>
          {rich.subtitle && <p className="text-lg text-accent font-medium mb-4">{rich.subtitle}</p>}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{data.author}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{formatDate(data.createdAt)}</span>
            {rich.readingTime && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{rich.readingTime} دقائق قراءة</span>}
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{bodyText.split(" ").length} كلمة</span>
          </div>
        </div>
      </section>

      <article className="py-10 bg-background">
        <div className="container max-w-4xl space-y-10">

          {/* ─── معرض الصور ─── */}
          {images.length > 0 && (
            <div>
              {/* الصورة الرئيسية */}
              <div className="rounded-2xl overflow-hidden bg-muted mb-3 max-h-[500px]">
                <img  src={images[activeImg]?.url} alt={data.title}
                  className="w-full h-full object-contain max-h-[500px]" loading="lazy" decoding="async" />
              </div>
              {/* thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === activeImg ? "border-accent" : "border-border opacity-60 hover:opacity-100"}`}>
                      <img  src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── المقدمة ─── */}
          {data.excerpt && (
            <div className="bg-accent/5 border-r-4 border-accent rounded-xl p-6">
              <p className="text-base text-foreground leading-relaxed font-medium">{data.excerpt}</p>
            </div>
          )}

          {/* ─── جسم المقالة ─── */}
          {bodyText && (
            <div className="prose prose-lg max-w-none">
              {bodyText.split("\n\n").map((para, i) => (
                <p key={i} className="text-base text-foreground leading-8 mb-4">{para}</p>
              ))}
            </div>
          )}

          {/* ─── الخاتمة ─── */}
          {rich.conclusion && (
            <div className="bg-muted/40 rounded-xl p-6 border border-border">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">الخاتمة</h3>
              <p className="text-base text-foreground leading-relaxed">{rich.conclusion}</p>
            </div>
          )}

          {/* ─── المصادر ─── */}
          {rich.references && (
            <div className="border border-border rounded-xl p-6">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">المصادر والمراجع</h3>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{rich.references}</div>
            </div>
          )}

          {/* ─── الكلمات المفتاحية ─── */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
              {tags.map((t: string, i: number) => (
                <span key={i} className="flex items-center gap-1 text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full">
                  <Tag className="w-3 h-3" />{t}
                </span>
              ))}
            </div>
          )}

          {/* ─── مشاركة ─── */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-3">شارك المقالة</p>
            <ShareButtons title={data.title} url={`${window.location.origin}/articles/${data.id}`} description={data.excerpt || ""} />
          </div>

          {/* العودة */}
          <Link href="/articles">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />العودة إلى المقالات
            </Button>
          </Link>
        </div>
      </article>
    </div>
  );
}
