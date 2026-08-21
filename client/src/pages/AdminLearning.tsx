import { FormEvent, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { BookOpen, Clock3, ExternalLink, GraduationCap, Hash, ImagePlus, Plus, Trash2, UsersRound, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Audience = "students" | "teachers";
type ImageFile = { preview: string; base64: string; filename: string };

const emptyCourse = { audience: "students" as Audience, title: "", courseCode: "", level: "", description: "", averageVideoMinutes: "0" };
const emptyVideo = { title: "", videoUrl: "", description: "", durationMinutes: "0", sortOrder: "0" };

async function prepareCover(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1200;
      let { width, height } = image;
      if (width > maxSize || height > maxSize) {
        if (width >= height) { height = Math.round((height / width) * maxSize); width = maxSize; }
        else { width = Math.round((width / height) * maxSize); height = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("تعذر معالجة الصورة"));
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function CourseThumb({ src, title }: { src?: string | null; title: string }) {
  return <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-accent"><>{src ? <img src={src} alt={`غلاف ${title}`} className="h-full w-full object-cover" /> : <BookOpen className="m-auto h-full w-8 text-primary-foreground/90" />}</></div>;
}

export default function AdminLearning() {
  const { user, isAuthenticated, loading } = useAuth();
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [courseCover, setCourseCover] = useState<ImageFile | null>(null);
  const [videoCourseId, setVideoCourseId] = useState<number | null>(null);
  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [videoCover, setVideoCover] = useState<ImageFile | null>(null);
  const utils = trpc.useUtils();
  const { data: courses = [], isLoading } = trpc.learning.listManage.useQuery(undefined, { enabled: !!isAuthenticated });
  const refresh = () => utils.learning.listManage.invalidate();
  const uploadImage = trpc.upload.image.useMutation();
  const createCourse = trpc.learning.create.useMutation({ onSuccess: () => { setCourseForm(emptyCourse); setCourseCover(null); refresh(); toast.success("تمت إضافة المساق"); }, onError: (error) => toast.error(error.message) });
  const deleteCourse = trpc.learning.delete.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف المساق"); }, onError: (error) => toast.error(error.message) });
  const addVideo = trpc.learning.addVideo.useMutation({ onSuccess: () => { setVideoForm(emptyVideo); setVideoCover(null); refresh(); toast.success("تمت إضافة الفيديو"); }, onError: (error) => toast.error(error.message) });
  const deleteVideo = trpc.learning.deleteVideo.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف الفيديو"); }, onError: (error) => toast.error(error.message) });
  const elevated = ["admin", "club_president", "vice_president", "tech_admin", "public_relations_officer"].includes(user?.role || "");
  const students = courses.filter((course) => course.audience === "students");
  const teachers = courses.filter((course) => course.audience === "teachers");

  const pickImage = async (event: ChangeEvent<HTMLInputElement>, setImage: (file: ImageFile | null) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة فقط"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("الحد الأقصى لحجم الصورة هو 8 ميغابايت"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try { const base64 = await prepareCover(reader.result as string); setImage({ preview: base64, base64, filename: file.name }); }
      catch { toast.error("تعذر معالجة الصورة المختارة"); }
    };
    reader.readAsDataURL(file);
  };

  const uploadCover = async (image: ImageFile | null, prefix: string) => {
    if (!image) return undefined;
    const result = await uploadImage.mutateAsync({ filename: `${prefix}-${Date.now()}.jpg`, base64: image.base64 });
    return result.url;
  };

  const submitCourse = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const coverImageUrl = await uploadCover(courseCover, "learning-course-cover");
      createCourse.mutate({ ...courseForm, description: courseForm.description || undefined, coverImageUrl, averageVideoMinutes: Number(courseForm.averageVideoMinutes) || 0 });
    } catch { toast.error("فشل رفع غلاف المساق"); }
  };
  const submitVideo = async (event: FormEvent) => {
    event.preventDefault();
    if (!videoCourseId) return;
    try {
      const coverImageUrl = await uploadCover(videoCover, "learning-video-cover");
      addVideo.mutate({ courseId: videoCourseId, title: videoForm.title, videoUrl: videoForm.videoUrl, coverImageUrl, description: videoForm.description || undefined, durationMinutes: Number(videoForm.durationMinutes) || 0, sortOrder: Number(videoForm.sortOrder) || 0 });
    } catch { toast.error("فشل رفع غلاف الفيديو"); }
  };

  if (loading || isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!isAuthenticated || !elevated) return <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center"><div className="space-y-4"><BookOpen className="h-14 w-14 mx-auto text-muted-foreground" /><h1 className="text-2xl font-bold">لا تملك صلاحية إدارة المحتوى التعليمي</h1><Link href="/"><Button variant="outline">العودة للرئيسية</Button></Link></div></div>;

  const renderCourse = (course: typeof courses[number], index: number, audience: Audience) => {
    const accent = audience === "students" ? "border-sky-500" : "border-violet-500";
    return <article key={course.id} className={`overflow-hidden rounded-2xl border border-r-4 ${accent} bg-card shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="flex min-w-0 items-start gap-3"><CourseThumb src={course.coverImageUrl} title={course.title} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{index + 1}</span><h3 className="truncate text-lg font-bold">{course.title}</h3></div><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary"><Hash className="h-3 w-3" />{course.courseCode}</span><span className="rounded-full bg-muted px-2.5 py-1">{course.level}</span><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Video className="h-3 w-3" />{course.videoCount} فيديو</span><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock3 className="h-3 w-3" />{course.averageVideoMinutes} د</span></div></div></div><Button variant="destructive" size="sm" disabled={deleteCourse.isPending} onClick={() => { if (confirm(`حذف مساق ${course.title} مع كل فيديوهاته؟`)) deleteCourse.mutate(course.id); }} className="gap-2"><Trash2 className="h-4 w-4" />حذف</Button></div>
      <div className="border-t bg-muted/30 px-5 py-4"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">فيديوهات هذا المساق</h4><Button variant="outline" size="sm" className="gap-2" onClick={() => setVideoCourseId(videoCourseId === course.id ? null : course.id)}><Video className="h-4 w-4" />{videoCourseId === course.id ? "إلغاء الإضافة" : "إضافة فيديو"}</Button></div>{course.videos.length === 0 ? <p className="rounded-lg border border-dashed bg-background p-3 text-sm text-muted-foreground">لا توجد فيديوهات لهذا المساق بعد.</p> : <div className="space-y-2">{course.videos.map((video, videoIndex) => <div key={video.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2"><a href={video.videoUrl} target="_blank" rel="noreferrer" className="min-w-0 flex items-center gap-2 hover:text-primary"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{videoIndex + 1}</span><ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">{video.title}</span><span className="shrink-0 text-xs text-muted-foreground">{video.durationMinutes} د</span></a><Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف هذا الفيديو؟")) deleteVideo.mutate(video.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}
      {videoCourseId === course.id && <form onSubmit={submitVideo} className="mt-4 grid gap-3 rounded-xl border border-primary/20 bg-background p-4 md:grid-cols-2"><div className="md:col-span-2"><p className="mb-2 text-sm font-semibold">إضافة فيديو إلى: {course.title}</p></div><Input required placeholder="عنوان الفيديو" value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} /><Input required type="url" placeholder="رابط الفيديو الخارجي (YouTube، Vimeo...)" value={videoForm.videoUrl} onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })} /><Input type="number" min="0" placeholder="المدة بالدقائق" value={videoForm.durationMinutes} onChange={(e) => setVideoForm({ ...videoForm, durationMinutes: e.target.value })} /><Input type="number" min="0" placeholder="ترتيب العرض" value={videoForm.sortOrder} onChange={(e) => setVideoForm({ ...videoForm, sortOrder: e.target.value })} /><label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm hover:bg-muted"><ImagePlus className="h-4 w-4" />{videoCover ? "تغيير غلاف الفيديو" : "رفع غلاف الفيديو"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => pickImage(event, setVideoCover)} /></label>{videoCover && <div className="flex items-center gap-2 rounded-md border p-1"><img src={videoCover.preview} alt="معاينة غلاف الفيديو" className="h-9 w-12 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-xs">{videoCover.filename}</span><Button type="button" variant="ghost" size="icon" onClick={() => setVideoCover(null)}><X className="h-4 w-4" /></Button></div>}<textarea placeholder="وصف مختصر (اختياري)" value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} className="min-h-16 rounded-md border bg-background p-2 text-sm md:col-span-2" /><Button type="submit" disabled={addVideo.isPending || uploadImage.isPending} className="w-fit">{addVideo.isPending || uploadImage.isPending ? "جاري الحفظ..." : "حفظ الفيديو"}</Button></form>}</div>
    </article>;
  };

  return <div className="min-h-screen bg-background pb-12" dir="rtl"><section className="border-b bg-primary/5 py-8"><div className="container max-w-6xl flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">إدارة المنصة التعليمية</h1><p className="mt-1 text-muted-foreground">أضف المساقات وارفع أغلفتها، ثم أضف روابط الفيديوهات وأغلفتها.</p></div><Link href="/learning"><Button variant="outline">عرض المنصة</Button></Link></div></section><main className="container max-w-6xl space-y-8 py-7"><form onSubmit={submitCourse} className="rounded-2xl border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Plus className="h-5 w-5 text-primary" />إضافة مساق جديد</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Input required placeholder="اسم المساق" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /><Input required placeholder="رقم المساق" value={courseForm.courseCode} onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })} /><Input required placeholder="المستوى، مثل: مبتدئ" value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} /><Input type="number" min="0" placeholder="متوسط مدة الفيديو بالدقائق" value={courseForm.averageVideoMinutes} onChange={(e) => setCourseForm({ ...courseForm, averageVideoMinutes: e.target.value })} /><select value={courseForm.audience} onChange={(e) => setCourseForm({ ...courseForm, audience: e.target.value as Audience })} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="students">مساق للطلاب</option><option value="teachers">مساق للأساتذة</option></select><label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm hover:bg-muted"><ImagePlus className="h-4 w-4" />{courseCover ? "تغيير غلاف المساق" : "رفع غلاف المساق"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => pickImage(event, setCourseCover)} /></label>{courseCover && <div className="flex items-center gap-2 rounded-md border p-1 md:col-span-2"><img src={courseCover.preview} alt="معاينة غلاف المساق" className="h-12 w-16 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{courseCover.filename}</span><Button type="button" variant="ghost" size="icon" onClick={() => setCourseCover(null)}><X className="h-4 w-4" /></Button></div>}<textarea placeholder="وصف المساق (اختياري)" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} className="min-h-24 rounded-md border bg-background p-3 text-sm md:col-span-2" /></div><Button type="submit" disabled={createCourse.isPending || uploadImage.isPending} className="mt-4">{createCourse.isPending || uploadImage.isPending ? "جاري الحفظ..." : "إضافة المساق"}</Button></form><section className="space-y-7"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">المساقات بحسب الفئة</h2><span className="rounded-full bg-muted px-3 py-1 text-sm">{courses.length} مساق</span></div>{courses.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">لا توجد مساقات بعد.</div> : <><div className="space-y-4"><div className="flex items-center gap-2 text-lg font-bold text-sky-700"><GraduationCap className="h-5 w-5" />مساقات الطلاب <span className="text-sm text-muted-foreground">({students.length})</span></div>{students.length ? students.map((course, index) => renderCourse(course, index, "students")) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد مساقات للطلاب.</p>}</div><div className="space-y-4"><div className="flex items-center gap-2 text-lg font-bold text-violet-700"><UsersRound className="h-5 w-5" />مساقات الأساتذة <span className="text-sm text-muted-foreground">({teachers.length})</span></div>{teachers.length ? teachers.map((course, index) => renderCourse(course, index, "teachers")) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد مساقات للأساتذة.</p>}</div></>}</section></main></div>;
}
