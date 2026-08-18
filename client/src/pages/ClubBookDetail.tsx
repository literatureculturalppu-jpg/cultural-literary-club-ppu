import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShareButtons from "@/components/ShareButtons";
import { ArrowRight, BookMarked, BookOpen, Calendar, CheckCircle2, FileText, Pin, Star, User } from "lucide-react";

function Rating({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-0.5" aria-label={`تقييم النادي ${value} من 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`w-4 h-4 ${index < value ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function ClubBookDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: book, isLoading } = trpc.books.getById.useQuery(id, { enabled: Number.isInteger(id) && id > 0 });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>;
  }

  if (!book) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <p className="text-muted-foreground">تعذّر العثور على هذا الكتاب.</p>
        <Link href="/books"><Button className="mt-4">العودة إلى الكتب</Button></Link>
      </div>
    );
  }

  const shareUrl = typeof window === "undefined" ? `/books/club/${book.id}` : window.location.href;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container max-w-4xl">
          <Link href="/books"><Button variant="outline" size="sm" className="mb-6"><ArrowRight className="w-4 h-4" /> العودة إلى الكتب</Button></Link>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-32 h-48 sm:w-40 sm:h-60 shrink-0 mx-auto sm:mx-0 rounded-xl bg-muted overflow-hidden flex items-center justify-center shadow-md">
              {book.coverImageUrl ? <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" /> : <BookOpen className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-right">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                <Badge className="bg-accent text-accent-foreground"><CheckCircle2 className="w-3.5 h-3.5 ml-1" /> كتاب مختوم</Badge>
                {book.isPinned ? <Badge variant="outline" className="border-accent text-accent"><Pin className="w-3.5 h-3.5 ml-1 fill-current" /> مثبت</Badge> : null}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 leading-tight">{book.title}</h1>
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-muted-foreground mb-4"><User className="w-4 h-4" /> {book.author}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
                {book.pageCount ? <span className="flex items-center gap-1"><BookMarked className="w-4 h-4" /> {book.pageCount} صفحة</span> : null}
                {book.completedAt ? <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(book.completedAt).toLocaleDateString("ar-SA")}</span> : null}
                {book.genre ? <span>{book.genre}</span> : null}
              </div>
              <Rating value={book.clubRating} />
            </div>
          </div>
        </div>
      </section>

      <main className="container max-w-4xl py-10 space-y-7">
        {book.summary ? <section className="rounded-xl bg-card border border-border p-6"><h2 className="font-bold text-xl mb-3">ملخص النادي</h2><p className="leading-relaxed text-muted-foreground whitespace-pre-line">{book.summary}</p></section> : null}
        {book.articleId ? <Link href={`/articles/${book.articleId}`}><Button variant="outline"><FileText className="w-4 h-4 ml-2" /> قراءة المقالة المرتبطة</Button></Link> : null}
        <div className="border-t border-border pt-6"><ShareButtons title={book.title} url={shareUrl} description={book.author} /></div>
      </main>
    </div>
  );
}
