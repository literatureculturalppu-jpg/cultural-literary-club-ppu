import { useMemo, useState } from "react";
import { Link } from "wouter";
import { BookOpen, Clock3, ExternalLink, Filter, GraduationCap, PlayCircle, Search, Star, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type Audience = "students" | "teachers";

function Cover({ src, title }: { src?: string | null; title: string }) {
  if (src) return <img src={src} alt={`غلاف ${title}`} className="h-full w-full object-cover" loading="lazy" />;
  return <div className="h-full w-full bg-gradient-to-br from-primary/90 via-primary to-accent/80 flex items-center justify-center"><BookOpen className="h-12 w-12 text-primary-foreground/90" /></div>;
}

export default function LearningHub() {
  const { user, isAuthenticated, loading } = useAuth();
  const [audience, setAudience] = useState<Audience>("students");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { data: settings, isLoading: settingsLoading } = trpc.learning.getSettings.useQuery();
  const { data: courses = [], isLoading: coursesLoading, error, refetch } = trpc.learning.list.useQuery({ audience }, { enabled: !!isAuthenticated && !!settings?.enabled && user?.approvalStatus === "approved" });
  const rateCourse = trpc.learning.rate.useMutation({ onSuccess: () => { setRating(0); setComment(""); refetch(); } });

  const levels = useMemo(() => Array.from(new Set(courses.map((course) => course.level))).sort(), [courses]);
  const filteredCourses = useMemo(() => courses.filter((course) => {
    const matchesLevel = level === "all" || course.level === level;
    const normalized = search.trim().toLocaleLowerCase("ar");
    const matchesSearch = !normalized || `${course.title} ${course.courseCode}`.toLocaleLowerCase("ar").includes(normalized);
    return matchesLevel && matchesSearch;
  }), [courses, level, search]);
  const selectedCourse = courses.find((course) => course.id === selectedId) ?? null;

  if (loading || settingsLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!isAuthenticated) return <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center"><div className="space-y-4"><GraduationCap className="h-16 w-16 mx-auto text-primary" /><h1 className="text-2xl font-bold">سجّل الدخول للوصول إلى المنصة التعليمية</h1><Link href="/login"><Button>تسجيل الدخول</Button></Link></div></div>;
  if (user?.approvalStatus !== "approved") return <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center"><div className="max-w-md space-y-4"><UsersRound className="h-16 w-16 mx-auto text-muted-foreground" /><h1 className="text-2xl font-bold">المنصة حصرية لأعضاء النادي المعتمدين</h1><p className="text-muted-foreground">سيظهر المحتوى التعليمي في حسابك بعد اعتماد عضويتك.</p><Link href="/"><Button variant="outline">العودة للرئيسية</Button></Link></div></div>;
  if (!settings?.enabled) return <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center"><div className="max-w-md space-y-4"><BookOpen className="h-16 w-16 mx-auto text-muted-foreground" /><h1 className="text-2xl font-bold">المنصة التعليمية غير مفعّلة حالياً</h1><p className="text-muted-foreground">يمكن للمدير التقني تفعيلها عند جاهزية المحتوى.</p><Link href="/"><Button variant="outline">العودة للرئيسية</Button></Link></div></div>;

  return <div className="min-h-screen bg-background pb-12" dir="rtl">
    <section className="border-b bg-gradient-to-b from-primary/10 via-primary/5 to-background py-8 md:py-12">
      <div className="container max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2"><div className="flex items-center gap-3"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="h-6 w-6" /></span><h1 className="text-3xl font-bold">المنصة التعليمية</h1></div><p className="text-muted-foreground">مساقات مختارة لأعضاء النادي الثقافي الأدبي، بروابط مشاهدة خارجية آمنة.</p></div>
          <Link href="/admin/learning"><Button variant="outline" className="gap-2"><BookOpen className="h-4 w-4" />إدارة المحتوى</Button></Link>
        </div>
      </div>
    </section>

    <main className="container max-w-6xl py-7 space-y-6">
      <div className="grid gap-3 rounded-2xl border bg-card p-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم المساق أو رقمه فقط..." className="pr-9" /></div>
        <div className="flex rounded-xl bg-muted p-1"><Button onClick={() => { setAudience("students"); setSelectedId(null); }} variant={audience === "students" ? "default" : "ghost"} className="flex-1 gap-2"><GraduationCap className="h-4 w-4" />طلاب</Button><Button onClick={() => { setAudience("teachers"); setSelectedId(null); }} variant={audience === "teachers" ? "default" : "ghost"} className="flex-1 gap-2"><UsersRound className="h-4 w-4" />أساتذة</Button></div>
        <label className="flex items-center gap-2 rounded-lg border px-3 text-sm"><Filter className="h-4 w-4 text-muted-foreground" /><select value={level} onChange={(e) => setLevel(e.target.value)} className="bg-transparent outline-none"><option value="all">كل المستويات</option>{levels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>

      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>}
      {coursesLoading ? <div className="py-16 text-center text-muted-foreground">جاري تحميل المساقات...</div> : filteredCourses.length === 0 ? <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">لا توجد مساقات مطابقة ضمن هذا القسم حالياً.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filteredCourses.map((course) => <button type="button" key={course.id} onClick={() => setSelectedId(course.id)} className="overflow-hidden rounded-2xl border bg-card text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"><div className="h-40"><Cover src={course.coverImageUrl} title={course.title} /></div><div className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold leading-6">{course.title}</h2><p className="mt-1 text-sm text-muted-foreground">{course.courseCode}</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{course.level}</span></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{course.videoCount} فيديو</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />متوسط {course.averageVideoMinutes} د</span><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{course.averageRating || "—"} ({course.ratingCount})</span></div></div></button>)}</div>}
    </main>

    {selectedCourse && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 md:p-8" onMouseDown={() => setSelectedId(null)}><div className="mx-auto my-4 max-w-3xl rounded-2xl bg-background shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="relative h-52 overflow-hidden rounded-t-2xl"><Cover src={selectedCourse.coverImageUrl} title={selectedCourse.title} /><Button variant="secondary" size="sm" onClick={() => setSelectedId(null)} className="absolute left-4 top-4">إغلاق</Button></div><div className="space-y-7 p-5 md:p-7"><div><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">{selectedCourse.title}</h2><span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{selectedCourse.level}</span></div><p className="mt-1 text-muted-foreground">رقم المساق: {selectedCourse.courseCode} · {selectedCourse.audience === "students" ? "طلاب" : "أساتذة"}</p>{selectedCourse.description && <p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">{selectedCourse.description}</p>}</div><section><h3 className="mb-3 font-bold">فيديوهات المساق ({selectedCourse.videoCount})</h3><div className="space-y-3">{selectedCourse.videos.map((video, index) => <a key={video.id} href={video.videoUrl} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl border p-3 transition hover:bg-muted"><div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg"><Cover src={video.coverImageUrl} title={video.title} /></div><div className="min-w-0 flex-1"><p className="font-medium">{index + 1}. {video.title}</p>{video.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{video.description}</p>}<p className="mt-1 text-xs text-muted-foreground">المدة: {video.durationMinutes} دقيقة</p></div><ExternalLink className="mt-1 h-5 w-5 shrink-0 text-primary" /></a>)}</div></section><section className="rounded-xl bg-muted/60 p-4"><h3 className="font-bold">قيّم هذا المساق</h3><div className="mt-3 flex gap-1" dir="ltr">{[1, 2, 3, 4, 5].map((value) => <button type="button" aria-label={`تقييم ${value}`} key={value} onClick={() => setRating(value)}><Star className={`h-7 w-7 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} /></button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تعليق اختياري..." maxLength={800} className="mt-3 min-h-20 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary" /><Button disabled={!rating || rateCourse.isPending} onClick={() => rateCourse.mutate({ courseId: selectedCourse.id, rating, comment: comment || undefined })} className="mt-3">{rateCourse.isPending ? "جاري الحفظ..." : "حفظ التقييم"}</Button></section></div></div></div>}
  </div>;
}
