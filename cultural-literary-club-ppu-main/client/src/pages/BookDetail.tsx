import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShareButtons from "@/components/ShareButtons";
import {
  ArrowRight, BookOpen, Download, ExternalLink, CheckCircle2, XCircle,
  Star, User, Calendar, Hash, Layers,
} from "lucide-react";

function StarRating({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < value ? "fill-accent text-accent" : "text-muted-foreground"}`} />
      ))}
    </div>
  );
}

export default function BookDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const { data: book, isLoading, error } = trpc.books.getGoogleBook.useQuery(id, { enabled: !!id });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <p className="text-muted-foreground">تعذّر العثور على هذا الكتاب</p>
        <Link href="/books"><Button className="mt-4">العودة إلى الكتب</Button></Link>
      </div>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/books/google/${id}`;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container max-w-4xl">
          <Link href="/books">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowRight className="w-4 h-4" /> العودة إلى الكتب
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-32 h-48 sm:w-40 sm:h-60 shrink-0 mx-auto sm:mx-0 rounded-lg bg-muted overflow-hidden flex items-center justify-center shadow-md">
              {book.coverImageUrl ? (
                <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-right">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 leading-tight">{book.title}</h1>
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-muted-foreground mb-3">
                <User className="w-4 h-4" /> {book.author}
              </p>

              {book.isRead ? (
                <Badge className="mb-3 bg-green-600 hover:bg-green-600 text-white">
                  <CheckCircle2 className="w-3 h-3 ml-1" /> قرأه النادي
                </Badge>
              ) : (
                <Badge variant="outline" className="mb-3 text-muted-foreground">
                  <XCircle className="w-3 h-3 ml-1" /> لم يقرأه النادي بعد
                </Badge>
              )}

              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
                {book.pageCount && (
                  <span className="flex items-center gap-1.5"><Layers className="w-4 h-4" /> {book.pageCount} صفحة</span>
                )}
                {book.publishedDate && (
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {book.publishedDate}</span>
                )}
                {book.isbn && (
                  <span className="flex items-center gap-1.5"><Hash className="w-4 h-4" /> {book.isbn}</span>
                )}
              </div>

              {book.isRead && book.clubInfo?.clubRating && (
                <div className="mb-4">
                  <StarRating value={book.clubInfo.clubRating} />
                </div>
              )}

              {/* Download / read actions */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                {book.pdfDownloadLink ? (
                  <a href={book.pdfDownloadLink} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                      <Download className="w-4 h-4" /> تنزيل الكتاب PDF
                    </Button>
                  </a>
                ) : (
                  book.webReaderLink && (
                    <a href={book.webReaderLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="w-4 h-4" /> قراءة على Google Books
                      </Button>
                    </a>
                  )
                )}
                {book.previewLink && (
                  <a href={book.previewLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="w-4 h-4" /> صفحة الكتاب على Google Books
                    </Button>
                  </a>
                )}
              </div>
              {!book.pdfDownloadLink && (
                <p className="text-xs text-muted-foreground mt-2">
                  نسخة PDF قابلة للتنزيل غير متوفرة من Google لهذا الكتاب، يمكنك قراءته أو معاينته عبر الروابط أعلاه.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-4xl py-10 space-y-8">
        {book.description && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">نبذة عن الكتاب</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{book.description}</p>
          </div>
        )}

        {book.isRead && book.clubInfo?.summary && (
          <div className="bg-accent/5 border-r-4 border-accent rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-2">ملخص النادي</h2>
            <p className="text-foreground leading-relaxed">{book.clubInfo.summary}</p>
            {book.clubInfo.articleId && (
              <Link href={`/articles/${book.clubInfo.articleId}`} className="inline-flex items-center gap-1 text-accent mt-3">
                <ExternalLink className="w-4 h-4" /> قراءة المقالة الكاملة
              </Link>
            )}
          </div>
        )}

        <div className="border-t border-border pt-8">
          <ShareButtons title={book.title} url={shareUrl} description={book.author} />
        </div>
      </div>
    </div>
  );
}
