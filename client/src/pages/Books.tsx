import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, BookOpen, CheckCircle2, XCircle, Star, Plus, Trash2, Vote,
  Lock, Unlock, ExternalLink,
} from "lucide-react";

const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

const isAdminRole = (role?: string) => role === "admin" || role === "general_agent" || role === "tech_admin";

function StarRating({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < value ? "fill-accent text-accent" : "text-muted-foreground"}`} />
      ))}
    </div>
  );
}

// ─────────────────────────── Section 3: Google Books search ────────────────
function BookSearchSection() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
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
            <Card key={r.googleBooksId} className="p-4 flex gap-4">
              <div className="w-16 h-24 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                {r.coverImageUrl ? (
                  <img  src={r.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground line-clamp-2">{r.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{r.author}</p>

                {r.isRead ? (
                  <Badge className="mb-2 bg-green-600 hover:bg-green-600 text-white">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> تمت قراءته
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mb-2 text-muted-foreground">
                    <XCircle className="w-3 h-3 ml-1" /> لم تتم قراءته
                  </Badge>
                )}

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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    title: "", author: "", pageCount: "", partsCount: "1",
    completedAt: "", articleId: "", genre: "", summary: "", clubRating: "",
    coverImageUrl: "", googleBooksId: "",
  });
  const [gbTerm, setGbTerm] = useState("");
  const [gbSubmitted, setGbSubmitted] = useState("");
  const { data: gbResults } = trpc.books.searchGoogle.useQuery(gbSubmitted, { enabled: gbSubmitted.length > 1 });

  const resetForm = () => {
    setForm({ title: "", author: "", pageCount: "", partsCount: "1", completedAt: "", articleId: "", genre: "", summary: "", clubRating: "", coverImageUrl: "", googleBooksId: "" });
    setGbTerm(""); setGbSubmitted("");
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
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.author) { toast.error("عنوان الكتاب والمؤلف مطلوبان"); return; }
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
      coverImageUrl: form.coverImageUrl || undefined,
      googleBooksId: form.googleBooksId || undefined,
    };
    if (editing) updateBook.mutate({ id: editing.id, ...payload });
    else createBook.mutate(payload);
  };

  return (
    <section className="mb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-foreground">الكتب المختومة</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 ml-1" /> إضافة كتاب
          </Button>
        )}
      </div>

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
                      onClick={() => setForm({
                        ...form,
                        title: r.title, author: r.author,
                        pageCount: r.pageCount ? String(r.pageCount) : form.pageCount,
                        coverImageUrl: r.coverImageUrl || "",
                        googleBooksId: r.googleBooksId,
                      })}
                      className="flex items-center gap-2 p-2 border border-border rounded-lg hover:border-accent text-right"
                    >
                      {r.coverImageUrl && <img  src={r.coverImageUrl} alt="" className="w-8 h-12 object-cover rounded" loading="lazy" decoding="async" />}
                      <span className="text-xs text-foreground line-clamp-2">{r.title} — {r.author}</span>
                    </button>
                  ))}
                </div>
              )}
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
              <Button type="submit" disabled={createBook.isPending || updateBook.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {editing ? "حفظ التعديلات" : "إضافة"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {!books || books.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">لم تتم إضافة أي كتاب بعد</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((b: any) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-foreground">{b.title}</h3>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(b)} className="text-muted-foreground hover:text-accent text-xs">تعديل</button>
                    <button onClick={() => { if (confirm("حذف هذا الكتاب؟")) deleteBook.mutate(b.id); }} className="text-destructive text-xs mr-2">حذف</button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{b.author}</p>
              <StarRating value={b.clubRating} />
              <div className="text-xs text-muted-foreground mt-3 space-y-1">
                {b.genre && <p>التصنيف: {b.genre}</p>}
                {b.pageCount && <p>الصفحات: {b.pageCount}</p>}
                {b.partsCount && b.partsCount > 1 && <p>الأجزاء: {b.partsCount}</p>}
                {b.completedAt && <p>تاريخ الإتمام: {new Date(b.completedAt).toLocaleDateString("ar-EG")}</p>}
              </div>
              {b.summary && <p className="text-sm text-foreground/80 mt-3">{b.summary}</p>}
              {b.articleId && (
                <Link href={`/articles/${b.articleId}`}>
                  <Button variant="link" className="px-0 h-auto mt-2 text-accent">قراءة المقالة المرتبطة ←</Button>
                </Link>
              )}
            </Card>
          ))}
        </div>
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
        <BookSearchSection />
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
