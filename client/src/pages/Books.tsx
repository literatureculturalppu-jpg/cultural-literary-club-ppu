import { useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useInfiniteReveal } from "@/hooks/useInfiniteReveal";
import {
  Search, BookOpen, CheckCircle2, XCircle, Star, Plus, Trash2, Vote,
  Lock, Unlock, ExternalLink, Download, Sparkles, ImagePlus, X, BookMarked,
  Calendar as CalendarIcon, Layers, Hash, Pin,
} from "lucide-react";

const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

const isAdminRole = (role?: string) => role === "admin" || role === "club_president" || role === "vice_president" || role === "public_relations_officer" || role === "tech_admin";

// ─── معالجة صورة غلاف الكتاب قبل الرفع ─────────────────────────────────────
async function processCoverImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = reject; img.src = dataUrl;
  });
}

function StarRating({ value, size = "sm" }: { value: number | null | undefined; size?: "sm" | "md" }) {
  if (!value) return null;
  const cls = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

// لوحة تدرجات لونية احتفالية تُستخدم عندما لا تتوفر صورة غلاف
const COVER_GRADIENTS = [
  "from-rose-500 via-fuchsia-500 to-indigo-500",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-indigo-500 via-violet-500 to-purple-500",
  "from-sky-500 via-blue-500 to-indigo-500",
  "from-pink-500 via-rose-500 to-orange-400",
];
function gradientFor(seed: number) {
  return COVER_GRADIENTS[Math.abs(seed) % COVER_GRADIENTS.length];
}

// ─── نافذة تفاصيل الكتاب المختوم — تُفتح بالضغط على بطاقة الكتاب ────────────
function BookDetailModal({
  book, isAdmin, onClose, onEdit, onDelete,
}: {
  book: any;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row">
          {/* الغلاف */}
          <div className="sm:w-56 shrink-0 relative aspect-[2/3] sm:aspect-auto sm:h-auto overflow-hidden bg-muted">
            {book.coverImageUrl ? (
              <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradientFor(book.id)} flex flex-col items-center justify-center p-6 text-center`}>
                <Sparkles className="w-6 h-6 text-white/70 mb-2" />
                <BookOpen className="w-10 h-10 text-white/90 mb-2" />
                <p className="text-white font-bold text-base leading-snug line-clamp-5 drop-shadow">{book.title}</p>
              </div>
            )}
            <div className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> مختوم
            </div>
          </div>

          {/* التفاصيل */}
          <div className="p-6 flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground leading-snug mb-1">{book.title}</h2>
            <p className="text-sm text-muted-foreground mb-3">{book.author}</p>

            {book.clubRating && (
              <div className="mb-4">
                <StarRating value={book.clubRating} size="md" />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {book.genre && (
                <Badge variant="outline" className="text-accent border-accent/40">{book.genre}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-4">
              {book.pageCount && (
                <span className="flex items-center gap-1.5"><Layers className="w-4 h-4" /> {book.pageCount} صفحة</span>
              )}
              {book.partsCount && book.partsCount > 1 && (
                <span className="flex items-center gap-1.5"><BookMarked className="w-4 h-4" /> {book.partsCount} أجزاء</span>
              )}
              {book.completedAt && (
                <span className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> {new Date(book.completedAt).toLocaleDateString("ar-EG")}</span>
              )}
              {book.isbn && (
                <span className="flex items-center gap-1.5"><Hash className="w-4 h-4" /> {book.isbn}</span>
              )}
            </div>

            {book.summary && (
              <div className="bg-accent/5 border-r-4 border-accent rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-foreground mb-1">ملخص/ملاحظات النقاش</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{book.summary}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {book.articleId && (
                <Link href={`/articles/${book.articleId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-accent border-accent/40">
                    <ExternalLink className="w-3.5 h-3.5" /> قراءة المقالة المرتبطة
                  </Button>
                </Link>
              )}
              {book.googleBooksId && (
                <Link href={`/books/google/${book.googleBooksId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> عرض على Google Books
                  </Button>
                </Link>
              )}
            </div>

            {isAdmin && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button size="sm" variant="outline" onClick={onEdit}>تعديل</Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>حذف</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Section 3: Google Books search ────────────────
function BookSearchSection({ initialQuery }: { initialQuery?: string }) {
  const [term, setTerm] = useState(initialQuery ?? "");
  const [submitted, setSubmitted] = useState(initialQuery ?? "");
  const { data: results, isLoading } = trpc.books.searchGoogle.useQuery(submitted, {
    enabled: submitted.length > 1,
  });

  return (
    <section className="mb-16">
      <form
        onSubmit={(e) => { e.preventDefault(); setSubmitted(term.trim()); }}
        className="relative max-w-xl mx-auto mb-8"
      >
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث عن كتابك المفضل"
          className="w-full py-3 pr-12 pl-4 bg-background border border-border rounded-full text-foreground placeholder:text-muted-foreground/50 placeholder:font-light focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </form>

      {isLoading && <p className="text-center text-muted-foreground">جاري البحث...</p>}

      {submitted && !isLoading && results && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {results.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground">لم يتم العثور على نتائج</p>
          )}
          {results.map((r) => (
            <Card key={r.googleBooksId} className="p-4 flex gap-4 hover:border-accent/50 transition-colors">
              <Link href={`/books/google/${r.googleBooksId}`} className="w-16 h-24 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                {r.coverImageUrl ? (
                  <img  src={r.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/books/google/${r.googleBooksId}`}>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-2 hover:text-accent cursor-pointer">{r.title}</h4>
                </Link>
                <p className="text-xs text-muted-foreground mb-2">{r.author}</p>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {r.isRead ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white">
                      <CheckCircle2 className="w-3 h-3 ml-1" /> تمت قراءته
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="w-3 h-3 ml-1" /> لم تتم قراءته
                    </Badge>
                  )}
                  {r.pdfDownloadLink && (
                    <Badge variant="outline" className="text-accent border-accent/40">
                      <Download className="w-3 h-3 ml-1" /> PDF متاح
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>الصفحات: {r.isRead ? (r.clubInfo?.pageCount ?? r.pageCount ?? "-") : "-"}</p>
                  <p>الأجزاء: {r.isRead ? (r.clubInfo?.partsCount ?? "-") : "-"}</p>
                  <p>تاريخ الإتمام: {r.isRead ? (r.clubInfo?.completedAt ? new Date(r.clubInfo.completedAt).toLocaleDateString("ar-EG") : "-") : "-"}</p>
                  {r.isRead && r.clubInfo?.articleId && (
                    <Link href={`/articles/${r.clubInfo.articleId}`} className="inline-flex items-center gap-1 text-accent">
                      <ExternalLink className="w-3 h-3" /> قراءة المقالة
                    </Link>
                  )}
                </div>

                <Link href={`/books/google/${r.googleBooksId}`} className="inline-flex items-center gap-1 text-xs text-accent mt-2 font-medium">
                  {r.pdfDownloadLink ? <><Download className="w-3 h-3" /> فتح وتنزيل الكتاب</> : <><ExternalLink className="w-3 h-3" /> عرض تفاصيل الكتاب</>}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── Section 1: الكتب المختومة ─────────────────────
function SealedBooksSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: books, refetch } = trpc.books.list.useQuery();
  const { data: articles } = trpc.articles.list.useQuery();
  const publishedArticles = (articles ?? []).filter((a: any) => a.published);
  const { visibleCount, sentinelRef } = useInfiniteReveal(books?.length ?? 0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "", author: "", pageCount: "", partsCount: "1",
    completedAt: "", articleId: "", genre: "", summary: "", clubRating: "",
    coverImageUrl: "", googleBooksId: "",
  });
  const [gbTerm, setGbTerm] = useState("");
  const [gbSubmitted, setGbSubmitted] = useState("");
  const { data: gbResults } = trpc.books.searchGoogle.useQuery(gbSubmitted, { enabled: gbSubmitted.length > 1 });

  // صورة الغلاف المرفوعة يدوياً (اختيارية) — تُعالَج وتُرفَع فقط عند الحفظ
  const [coverFile, setCoverFile] = useState<{ preview: string; base64: string } | null>(null);
  const [processingCover, setProcessingCover] = useState(false);
  const uploadImage = trpc.upload.image.useMutation();

  const resetForm = () => {
    setForm({ title: "", author: "", pageCount: "", partsCount: "1", completedAt: "", articleId: "", genre: "", summary: "", clubRating: "", coverImageUrl: "", googleBooksId: "" });
    setGbTerm(""); setGbSubmitted("");
    setCoverFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const createBook = trpc.books.create.useMutation({
    onSuccess: () => { toast.success("تمت إضافة الكتاب"); refetch(); resetForm(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const updateBook = trpc.books.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الكتاب"); refetch(); resetForm(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const deleteBook = trpc.books.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الكتاب"); refetch(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const togglePin = trpc.contentPins.toggle.useMutation({
    onSuccess: (_, variables) => { toast.success(variables.isPinned ? "تم تثبيت الكتاب" : "تم إلغاء تثبيت الكتاب"); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const startEdit = (b: any) => {
    setEditing(b);
    setForm({
      title: b.title || "", author: b.author || "",
      pageCount: b.pageCount ? String(b.pageCount) : "",
      partsCount: b.partsCount ? String(b.partsCount) : "1",
      completedAt: b.completedAt ? String(b.completedAt).slice(0, 10) : "",
      articleId: b.articleId ? String(b.articleId) : "",
      genre: b.genre || "", summary: b.summary || "",
      clubRating: b.clubRating ? String(b.clubRating) : "",
      coverImageUrl: b.coverImageUrl || "", googleBooksId: b.googleBooksId || "",
    });
    setCoverFile(null);
    setShowForm(true);
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة"); return; }
    setProcessingCover(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const processed = await processCoverImage(reader.result as string);
        setCoverFile({ preview: processed, base64: processed });
      } finally {
        setProcessingCover(false);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.author) { toast.error("عنوان الكتاب والمؤلف مطلوبان"); return; }

    // الصورة المرفوعة يدوياً لها الأولوية على أي رابط تم جلبه من Google Books
    let coverImageUrl = form.coverImageUrl || undefined;
    if (coverFile) {
      try {
        const result = await uploadImage.mutateAsync({
          filename: `book-cover-${Date.now()}.jpg`,
          base64: coverFile.base64,
        });
        coverImageUrl = result.url;
      } catch {
        toast.error("فشل رفع صورة الغلاف"); return;
      }
    }

    const payload = {
      title: form.title,
      author: form.author,
      pageCount: form.pageCount ? parseInt(form.pageCount) : undefined,
      partsCount: form.partsCount ? parseInt(form.partsCount) : undefined,
      completedAt: form.completedAt || undefined,
      articleId: form.articleId ? parseInt(form.articleId) : undefined,
      genre: form.genre || undefined,
      summary: form.summary || undefined,
      clubRating: form.clubRating ? parseInt(form.clubRating) : undefined,
      coverImageUrl,
      googleBooksId: form.googleBooksId || undefined,
    };
    if (editing) updateBook.mutate({ id: editing.id, ...payload });
    else createBook.mutate(payload);
  };

  return (
    <section className="mb-20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookMarked className="w-7 h-7 text-accent" />
          <h2 className="text-3xl font-bold text-foreground">الكتب المختومة</h2>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 ml-1" /> إضافة كتاب
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">مكتبة النادي من الكتب التي أُنجزت قراءتها ونوقشت سوياً</p>

      {isAdmin && showForm && (
        <Card className="p-6 mb-8">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                (اختياري) ابحث في Google Books لملء البيانات تلقائياً وربط الكتاب بدقة بنتائج البحث في الصفحة
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  placeholder="ابحث عن اسم الكتاب في Google Books..."
                  value={gbTerm}
                  onChange={(e) => setGbTerm(e.target.value)}
                  className={inputClass}
                />
                <Button type="button" variant="outline" onClick={() => setGbSubmitted(gbTerm.trim())}>بحث</Button>
              </div>
              {gbResults && gbResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-56 overflow-y-auto">
                  {gbResults.map((r) => (
                    <button
                      type="button"
                      key={r.googleBooksId}
                      onClick={() => { setForm({
                        ...form,
                        title: r.title, author: r.author,
                        pageCount: r.pageCount ? String(r.pageCount) : form.pageCount,
                        coverImageUrl: r.coverImageUrl || "",
                        googleBooksId: r.googleBooksId,
                      }); setCoverFile(null); }}
                      className="flex items-center gap-2 p-2 border border-border rounded-lg hover:border-accent text-right"
                    >
                      {r.coverImageUrl && <img  src={r.coverImageUrl} alt="" className="w-8 h-12 object-cover rounded" loading="lazy" decoding="async" />}
                      <span className="text-xs text-foreground line-clamp-2">{r.title} — {r.author}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* صورة غلاف الكتاب (اختياري) — تُجلب تلقائياً من Google Books عند اختيار نتيجة، ويمكن للمستخدم تغييرها */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-foreground">صورة الغلاف (اختياري)</p>
                {form.googleBooksId && !coverFile && form.coverImageUrl && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" /> من Google Books
                  </span>
                )}
              </div>
              <div className="flex items-start gap-4">
                <label
                  htmlFor="book-cover-file"
                  className="group/cover relative w-20 h-28 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center cursor-pointer"
                  title="اضغط لتغيير الصورة"
                >
                  {coverFile?.preview || form.coverImageUrl ? (
                    <img src={coverFile?.preview || form.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-muted-foreground/50" />
                  )}
                  {/* تراكب "تغيير" يظهر عند المرور بالماوس فوق الصورة */}
                  <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/50 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover/cover:opacity-100 transition-opacity text-white text-[10px] font-medium flex flex-col items-center gap-1">
                      <ImagePlus className="w-4 h-4" /> تغيير
                    </span>
                  </div>
                  {(coverFile || form.coverImageUrl) && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCoverFile(null); setForm({ ...form, coverImageUrl: "" }); }}
                      className="absolute top-1 left-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80 z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </label>
                <div className="flex-1 space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" id="book-cover-file" />
                  <label htmlFor="book-cover-file" className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-accent hover:text-accent text-muted-foreground w-fit">
                    <ImagePlus className="w-3.5 h-3.5" />
                    {processingCover ? "جاري المعالجة..." : (coverFile || form.coverImageUrl) ? "تغيير الصورة من جهازك" : "رفع صورة من جهازك"}
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    {form.googleBooksId ? "تم جلب الصورة تلقائياً من Google Books، ويمكنك استبدالها برفع صورة أخرى أو بلصق رابط:" : "أو الصق رابط صورة مباشرة:"}
                  </p>
                  <input
                    placeholder="https://..."
                    value={form.coverImageUrl}
                    onChange={(e) => { setForm({ ...form, coverImageUrl: e.target.value }); setCoverFile(null); }}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="عنوان الكتاب *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
              <input placeholder="اسم المؤلف *" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input type="number" placeholder="عدد الصفحات" value={form.pageCount} onChange={(e) => setForm({ ...form, pageCount: e.target.value })} className={inputClass} />
              <input type="number" placeholder="عدد الأجزاء" value={form.partsCount} onChange={(e) => setForm({ ...form, partsCount: e.target.value })} className={inputClass} />
              <input type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} className={inputClass} />
              <select value={form.clubRating} onChange={(e) => setForm({ ...form, clubRating: e.target.value })} className={inputClass}>
                <option value="">تقييم النادي</option>
                {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{n} / 5</option>))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="التصنيف (رواية، فكر...)" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className={inputClass} />
              <select value={form.articleId} onChange={(e) => setForm({ ...form, articleId: e.target.value })} className={inputClass}>
                <option value="">بدون ربط بمقالة</option>
                {publishedArticles.map((a: any) => (<option key={a.id} value={a.id}>{a.title}</option>))}
              </select>
            </div>
            <textarea placeholder="ملخص/ملاحظات النقاش (اختياري)" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} className={inputClass} />
            <div className="flex gap-3">
              <Button type="submit" disabled={createBook.isPending || updateBook.isPending || uploadImage.isPending || processingCover} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {createBook.isPending || updateBook.isPending || uploadImage.isPending ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {!books || books.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">لم تتم إضافة أي كتاب بعد</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6">
          {books.slice(0, visibleCount).map((b: any) => (
            <Card
              key={b.id}
              onClick={() => setSelectedBook(b)}
              className="group overflow-hidden flex flex-col border-border/60 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              {/* غلاف الكتاب */}
              <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                {b.coverImageUrl ? (
                  <img
                    src={b.coverImageUrl}
                    alt={b.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy" decoding="async"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradientFor(b.id)} flex flex-col items-center justify-center p-4 text-center relative`}>
                    <Sparkles className="w-5 h-5 text-white/70 absolute top-3 right-3" />
                    <BookOpen className="w-8 h-8 text-white/90 mb-2" />
                    <p className="text-white font-bold text-sm leading-snug line-clamp-4 drop-shadow">{b.title}</p>
                  </div>
                )}
                {/* شارة "مختوم" احتفالية */}
                <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> مختوم
                </div>
                {b.isPinned ? <div className="absolute top-9 right-2 bg-background/95 border border-accent/40 text-accent text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1"><Pin className="w-3 h-3 fill-current" /> مثبت</div> : null}
                {b.clubRating && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                    <StarRating value={b.clubRating} />
                  </div>
                )}
                {isAdmin && (
                  <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(b); }} className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded">تعديل</button>
                    <button onClick={(e) => { e.stopPropagation(); togglePin.mutate({ type: "book", id: b.id, isPinned: !b.isPinned }); }} className="bg-accent/90 hover:bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded flex items-center gap-1"><Pin className={`w-3 h-3 ${b.isPinned ? "fill-current" : ""}`} /> {b.isPinned ? "إلغاء التثبيت" : "تثبيت"}</button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm("حذف هذا الكتاب؟")) deleteBook.mutate(b.id); }} className="bg-destructive/80 hover:bg-destructive text-white text-[10px] px-2 py-1 rounded">حذف</button>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">{b.author}</p>

                {b.genre && (
                  <Badge variant="outline" className="w-fit text-[10px] mb-2 text-accent border-accent/40">{b.genre}</Badge>
                )}

                <div className="text-[11px] text-muted-foreground space-y-0.5 mt-auto pt-2">
                  {b.pageCount && <p>📖 {b.pageCount} صفحة{b.partsCount && b.partsCount > 1 ? ` · ${b.partsCount} أجزاء` : ""}</p>}
                  {b.completedAt && <p>🗓️ {new Date(b.completedAt).toLocaleDateString("ar-EG")}</p>}
                </div>

                {b.summary && <p className="text-xs text-foreground/80 mt-2 line-clamp-3">{b.summary}</p>}

                {b.articleId && (
                  <Link href={`/articles/${b.articleId}`} onClick={(e) => e.stopPropagation()}>
                    <Button variant="link" className="px-0 h-auto mt-2 text-accent text-xs">قراءة المقالة المرتبطة ←</Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {books && visibleCount < books.length && <div ref={sentinelRef} className="h-1" />}

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          isAdmin={isAdmin}
          onClose={() => setSelectedBook(null)}
          onEdit={() => { setSelectedBook(null); startEdit(selectedBook); }}
          onDelete={() => {
            if (confirm("حذف هذا الكتاب؟")) {
              deleteBook.mutate(selectedBook.id);
              setSelectedBook(null);
            }
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────── Section 2a: اقتراحات الأعضاء ───────────────────
function SuggestionsSection({ isAdmin }: { isAdmin: boolean }) {
  const { isAuthenticated } = useAuth();
  const { data: round, refetch: refetchRound } = trpc.bookSuggestions.activeRound.useQuery();
  const { data: mine, refetch: refetchMine } = trpc.bookSuggestions.listMine.useQuery(undefined, { enabled: isAuthenticated });
  const { data: all, refetch: refetchAll } = trpc.bookSuggestions.listAll.useQuery(undefined, { enabled: isAdmin });
  const { data: activePoll } = trpc.bookVotes.active.useQuery();

  const [form, setForm] = useState({ title: "", author: "", note: "" });

  const create = trpc.bookSuggestions.create.useMutation({
    onSuccess: () => { toast.success("تم إرسال اقتراحك بنجاح"); refetchMine(); refetchAll(); setForm({ title: "", author: "", note: "" }); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const openRound = trpc.bookSuggestions.open.useMutation({
    onSuccess: () => { toast.success("تم فتح جولة اقتراحات جديدة"); refetchRound(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const closeRound = trpc.bookSuggestions.close.useMutation({
    onSuccess: () => { toast.success("تم إغلاق الجولة، ستُحذف الاقتراحات تلقائياً بعد 5 أيام"); refetchRound(); refetchAll(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const deleteSuggestion = trpc.bookSuggestions.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); refetchAll(); },
  });
  const addToPoll = trpc.bookVotes.addOption.useMutation({
    onSuccess: () => toast.success("تمت إضافته إلى التصويت الحالي"),
    onError: (e) => toast.error("خطأ: " + e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error("يرجى كتابة عنوان الكتاب المقترح"); return; }
    create.mutate(form);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-foreground">اقتراحات الأعضاء</h3>
        {isAdmin && (
          round?.status === "open" ? (
            <Button size="sm" variant="destructive" onClick={() => closeRound.mutate()} disabled={closeRound.isPending}>
              <Lock className="w-4 h-4 ml-1" /> إغلاق جولة الاقتراحات
            </Button>
          ) : (
            <Button size="sm" onClick={() => openRound.mutate()} disabled={openRound.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Unlock className="w-4 h-4 ml-1" /> فتح جولة اقتراحات جديدة
            </Button>
          )
        )}
      </div>

      {!round || round.status !== "open" ? (
        <p className="text-muted-foreground text-sm mb-6">لا توجد جولة اقتراحات مفتوحة حالياً.</p>
      ) : !isAuthenticated ? (
        <p className="text-muted-foreground text-sm mb-6">سجّل الدخول لتتمكن من اقتراح كتاب.</p>
      ) : mine ? (
        <Card className="p-4 mb-6 bg-accent/5">
          <p className="text-sm text-foreground">
            اقتراحك المُرسَل: <span className="font-semibold">{mine.title}</span>
            {mine.author ? ` — ${mine.author}` : ""}
          </p>
        </Card>
      ) : (
        <Card className="p-5 mb-6">
          <form onSubmit={submit} className="space-y-3">
            <input placeholder="عنوان الكتاب المقترح *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
            <input placeholder="اسم المؤلف (اختياري)" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={inputClass} />
            <textarea placeholder="لماذا تقترح هذا الكتاب؟ (اختياري)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={inputClass} />
            <Button type="submit" disabled={create.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">إرسال الاقتراح</Button>
          </form>
        </Card>
      )}

      {isAdmin && all && all.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-2">كل الاقتراحات ({all.length}) — للإدارة فقط</p>
          {all.map((s: any) => (
            <Card key={s.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm">{s.title}{s.author ? ` — ${s.author}` : ""}</p>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {activePoll?.poll && (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => addToPoll.mutate({ title: s.title, author: s.author, sourceSuggestionId: s.id })}
                  >
                    <Vote className="w-3.5 h-3.5 ml-1" /> إضافة للتصويت
                  </Button>
                )}
                <button onClick={() => { if (confirm("حذف هذا الاقتراح؟")) deleteSuggestion.mutate(s.id); }} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Section 2b: التصويت على الكتاب ────────────────
function VotePollSection({ isAdmin }: { isAdmin: boolean }) {
  const { isAuthenticated } = useAuth();
  const { data: activeData, refetch } = trpc.bookVotes.active.useQuery();
  const { data: myBallots, refetch: refetchBallots } = trpc.bookVotes.myBallots.useQuery(undefined, { enabled: isAuthenticated });
  const [newPollMode, setNewPollMode] = useState<"single" | "multiple">("single");
  const [externalTitle, setExternalTitle] = useState("");
  const [externalAuthor, setExternalAuthor] = useState("");

  const createPoll = trpc.bookVotes.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء تصويت جديد"); refetch(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const closePoll = trpc.bookVotes.close.useMutation({
    onSuccess: () => { toast.success("تم إغلاق التصويت، سيُحذف تلقائياً بعد أسبوع"); refetch(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const addOption = trpc.bookVotes.addOption.useMutation({
    onSuccess: () => { toast.success("تمت الإضافة"); refetch(); setExternalTitle(""); setExternalAuthor(""); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const deleteOption = trpc.bookVotes.deleteOption.useMutation({
    onSuccess: () => refetch(),
  });
  const vote = trpc.bookVotes.vote.useMutation({
    onSuccess: () => { refetch(); refetchBallots(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });

  const poll = activeData?.poll;
  const options = activeData?.options ?? [];
  const totalVotes = options.reduce((s: number, o: any) => s + o.voteCount, 0);
  const myVotes = new Set(myBallots ?? []);

  return (
    <div className="mt-12">
      <h3 className="text-xl font-bold text-foreground mb-4">التصويت على الكتاب القادم</h3>

      {!poll ? (
        <div>
          <p className="text-muted-foreground text-sm mb-4">لا يوجد تصويت مفتوح حالياً.</p>
          {isAdmin && (
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <select value={newPollMode} onChange={(e) => setNewPollMode(e.target.value as any)} className={inputClass + " sm:w-56"}>
                  <option value="single">تصويت فردي (كتاب واحد فقط)</option>
                  <option value="multiple">تصويت متعدد (أكثر من كتاب)</option>
                </select>
                <Button onClick={() => createPoll.mutate({ mode: newPollMode })} disabled={createPoll.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  إنشاء تصويت جديد
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline">{poll.mode === "single" ? "تصويت فردي" : "تصويت متعدد"}</Badge>
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => closePoll.mutate()} disabled={closePoll.isPending}>
                إغلاق التصويت
              </Button>
            )}
          </div>

          {isAdmin && (
            <Card className="p-4 mb-4">
              <p className="text-sm font-medium mb-2">إضافة كتاب خارجي للتصويت</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="عنوان الكتاب" value={externalTitle} onChange={(e) => setExternalTitle(e.target.value)} className={inputClass} />
                <input placeholder="المؤلف (اختياري)" value={externalAuthor} onChange={(e) => setExternalAuthor(e.target.value)} className={inputClass} />
                <Button
                  onClick={() => { if (!externalTitle) { toast.error("أدخل عنوان الكتاب"); return; } addOption.mutate({ title: externalTitle, author: externalAuthor || undefined }); }}
                  disabled={addOption.isPending}
                >
                  إضافة
                </Button>
              </div>
            </Card>
          )}

          {options.length === 0 ? (
            <p className="text-muted-foreground text-sm">لم تُضَف أي كتب لهذا التصويت بعد.</p>
          ) : (
            <div className="space-y-3">
              {options.map((o: any) => {
                const pct = totalVotes > 0 ? Math.round((o.voteCount / totalVotes) * 100) : 0;
                const selected = myVotes.has(o.id);
                return (
                  <Card key={o.id} className={`p-4 ${selected ? "ring-2 ring-accent" : ""}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{o.title}{o.author ? ` — ${o.author}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isAuthenticated && (
                          <Button
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            className={selected ? "bg-accent text-accent-foreground" : ""}
                            onClick={() => vote.mutate({ optionId: o.id })}
                            disabled={vote.isPending}
                          >
                            {selected ? "تم التصويت ✓" : "صوّت"}
                          </Button>
                        )}
                        {isAdmin && (
                          <button onClick={() => { if (confirm("حذف هذا الخيار؟")) deleteOption.mutate(o.id); }} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-accent h-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{o.voteCount} صوت ({pct}%)</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────── Main page ──────────────────────────────
export default function Books() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  // Lets Basir send members here with a book search pre-filled, e.g. via
  // "[[NAV|/books?q=...|ابحث عن الكتاب]]".
  const search = useSearch();
  const initialQuery = new URLSearchParams(search).get("q") ?? undefined;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container text-center">
          <BookOpen className="w-10 h-10 text-accent mx-auto mb-3" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">الكتب</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            كل ما قرأه نادي بصيرة، وما نصوّت عليه لقراءته لاحقاً
          </p>
        </div>
      </section>

      <div className="container py-12 md:py-16">
        <BookSearchSection initialQuery={initialQuery} />
        <SealedBooksSection isAdmin={isAdmin} />

        <section>
          <h2 className="text-3xl font-bold text-foreground mb-6">التصويت</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <SuggestionsSection isAdmin={isAdmin} />
            <VotePollSection isAdmin={isAdmin} />
          </div>
        </section>
      </div>
    </div>
  );
}
