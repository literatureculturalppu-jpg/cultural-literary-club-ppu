import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Upload, X, ImageIcon, GripVertical } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

// ─── معالجة الصورة بدقة عالية ─────────────────────────────────────────────────
async function processImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 2400;
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

interface ImageItem { preview: string; base64: string; uploading: boolean; url?: string; key?: string; }

const CATEGORIES = [
  { value: "literature", label: "أدب" },
  { value: "grammar", label: "نحو وصرف" },
  { value: "culture", label: "ثقافة" },
  { value: "poetry", label: "شعر" },
  { value: "criticism", label: "نقد أدبي" },
  { value: "history", label: "تاريخ" },
  { value: "research", label: "بحث علمي" },
  { value: "general", label: "عام" },
];

const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

export default function AddArticle() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",      // العنوان الفرعي
    excerpt: "",       // المقدمة / الملخص
    content: "",       // جسم المقالة
    conclusion: "",    // الخاتمة
    category: "",
    tags: "",          // كلمات مفتاحية مفصولة بفاصلة
    references: "",    // المصادر والمراجع
    readingTime: "",   // وقت القراءة التقريبي بالدقائق
  });

  const [images, setImages] = useState<ImageItem[]>([]);
  const [processingImage, setProcessingImage] = useState(false);

  const uploadImage = trpc.upload.image.useMutation();
  const createArticle = trpc.articles.create.useMutation({
    onSuccess: () => { toast.success("تم نشر المقالة بنجاح!"); setLocation("/admin/articles"); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center"><p className="text-muted-foreground mb-4">يرجى تسجيل الدخول</p>
        <Link href="/login"><Button>تسجيل الدخول</Button></Link></div></div>;
  }

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      toast.error("الحد الأقصى 5 صور"); return;
    }
    setProcessingImage(true);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      await new Promise<void>(res => {
        reader.onload = async () => {
          const processed = await processImage(reader.result as string);
          setImages(prev => [...prev, { preview: processed, base64: processed, uploading: false }]);
          res();
        };
        reader.readAsDataURL(file);
      });
    }
    setProcessingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => setImages(imgs => imgs.filter((_, i) => i !== idx));

  const moveImage = (from: number, to: number) => {
    const arr = [...images];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setImages(arr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) { toast.error("العنوان والمحتوى مطلوبان"); return; }
    if (images.length === 0) { toast.error("يرجى إضافة صورة غلاف واحدة على الأقل"); return; }

    // رفع جميع الصور
    toast.info("جاري رفع الصور...");
    const uploadedImages: { url: string; key: string }[] = [];
    for (const img of images) {
      try {
        const result = await uploadImage.mutateAsync({
          filename: `article-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
          base64: img.base64,
        });
        uploadedImages.push({ url: result.url, key: result.key });
      } catch { toast.error("فشل رفع إحدى الصور"); return; }
    }

    // الصورة الأولى = صورة الغلاف
    const coverImage = uploadedImages[0];

    // بناء المحتوى كـ JSON يحتوي على كل الحقول + الصور الإضافية
    const richContent = JSON.stringify({
      subtitle: form.subtitle,
      content: form.content,
      conclusion: form.conclusion,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      references: form.references,
      readingTime: form.readingTime ? parseInt(form.readingTime) : null,
      images: uploadedImages, // كل الصور بما فيها الغلاف
    });

    const slug = form.title
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, "")
      + "-" + Date.now();

    createArticle.mutate({
      title: form.title,
      slug,
      excerpt: form.excerpt,
      content: richContent,
      category: form.category || "general",
      author: user.arabicFullName || user.name || "مسؤول",
      imageUrl: coverImage.url,
      imageKey: coverImage.key,
      published: true,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin/articles"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link>
            <h1 className="text-4xl font-bold text-foreground">كتابة مقالة جديدة</h1>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">

            {/* ─── صور المقالة ─── */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">صور المقالة</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الصورة الأولى هي <strong>صورة الغلاف</strong> التي تظهر قبل فتح المقالة — حد أقصى 5 صور
                  </p>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{images.length} / 5</span>
              </div>

              {/* معرض الصور */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {images.map((img, idx) => (
                    <div key={idx} className={`relative rounded-xl overflow-hidden border-2 ${idx === 0 ? "border-accent col-span-2 sm:col-span-1" : "border-border"}`}>
                      <img  src={img.preview} alt="" className="w-full h-36 object-cover" loading="lazy" decoding="async" />
                      {idx === 0 && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full font-medium">غلاف</span>
                        </div>
                      )}
                      {/* أزرار تحريك */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {idx > 0 && (
                          <button type="button" onClick={() => moveImage(idx, idx - 1)}
                            className="bg-black/60 text-white rounded p-1 text-xs hover:bg-black/80">←</button>
                        )}
                        {idx < images.length - 1 && (
                          <button type="button" onClick={() => moveImage(idx, idx + 1)}
                            className="bg-black/60 text-white rounded p-1 text-xs hover:bg-black/80">→</button>
                        )}
                      </div>
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute top-2 left-2 bg-red-500/80 text-white rounded-full p-0.5 hover:bg-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* زر إضافة */}
                  {images.length < 5 && (
                    <div onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors">
                      {processingImage ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        : <><Upload className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">إضافة صورة</span></>}
                    </div>
                  )}
                </div>
              )}

              {images.length === 0 && (
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-accent transition-colors">
                  {processingImage ? <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                    : <><ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">انقر لإضافة صور المقالة</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP — حد أقصى 5 صور</p></>}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
            </Card>

            {/* ─── معلومات المقالة الأساسية ─── */}
            <Card className="p-6 space-y-5">
              <h2 className="text-base font-bold text-foreground border-b border-border pb-3">معلومات المقالة</h2>

              {/* العنوان */}
              <div>
                <label className="block text-sm font-medium mb-1.5">عنوان المقالة <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className={inputClass} placeholder="أدخل عنواناً جذاباً للمقالة" />
              </div>

              {/* العنوان الفرعي */}
              <div>
                <label className="block text-sm font-medium mb-1.5">العنوان الفرعي</label>
                <input type="text" value={form.subtitle} onChange={e => setForm({...form, subtitle: e.target.value})} className={inputClass} placeholder="عنوان فرعي توضيحي (اختياري)" />
              </div>

              {/* الفئة + وقت القراءة */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">تصنيف المقالة <span className="text-red-500">*</span></label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={inputClass}>
                    <option value="">اختر التصنيف</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">وقت القراءة (دقيقة)</label>
                  <input type="number" value={form.readingTime} onChange={e => setForm({...form, readingTime: e.target.value})} className={inputClass} placeholder="مثال: 5" min="1" max="120" />
                </div>
              </div>

              {/* الكلمات المفتاحية */}
              <div>
                <label className="block text-sm font-medium mb-1.5">الكلمات المفتاحية</label>
                <input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className={inputClass} placeholder="مثال: أدب، لغة عربية، شعر (مفصولة بفاصلة)" />
                <p className="text-xs text-muted-foreground mt-1">افصل بين الكلمات بفاصلة</p>
              </div>
            </Card>

            {/* ─── محتوى المقالة ─── */}
            <Card className="p-6 space-y-5">
              <h2 className="text-base font-bold text-foreground border-b border-border pb-3">محتوى المقالة</h2>

              {/* المقدمة */}
              <div>
                <label className="block text-sm font-medium mb-1.5">المقدمة / الملخص <span className="text-red-500">*</span></label>
                <textarea value={form.excerpt} onChange={e => setForm({...form, excerpt: e.target.value})} rows={3} className={inputClass}
                  placeholder="مقدمة قصيرة تظهر في بطاقة المقالة قبل فتحها (2-4 جمل)" />
                <p className="text-xs text-muted-foreground mt-1">هذا النص يظهر في معاينة المقالة قبل التوسيع</p>
              </div>

              {/* جسم المقالة */}
              <div>
                <label className="block text-sm font-medium mb-1.5">جسم المقالة <span className="text-red-500">*</span></label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={14} className={inputClass}
                  placeholder="اكتب محتوى المقالة الكامل هنا...

يمكنك استخدام فقرات متعددة وتقسيم المحتوى بوضوح." />
                <p className="text-xs text-muted-foreground mt-1 text-left" dir="ltr">{form.content.length} حرف</p>
              </div>

              {/* الخاتمة */}
              <div>
                <label className="block text-sm font-medium mb-1.5">الخاتمة</label>
                <textarea value={form.conclusion} onChange={e => setForm({...form, conclusion: e.target.value})} rows={3} className={inputClass}
                  placeholder="خاتمة المقالة أو التوصيات النهائية (اختياري)" />
              </div>
            </Card>

            {/* ─── المصادر والمراجع ─── */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-foreground border-b border-border pb-3 mb-4">المصادر والمراجع</h2>
              <textarea value={form.references} onChange={e => setForm({...form, references: e.target.value})} rows={4} className={inputClass}
                placeholder="اذكر المصادر والمراجع التي استندت إليها في كتابة المقالة (اختياري)

مثال:
- ابن منظور، لسان العرب، دار صادر، بيروت
- الجاحظ، البيان والتبيين" />
            </Card>

            {/* أزرار الإرسال */}
            <div className="flex gap-4 pb-8">
              <Button type="submit" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={createArticle.isPending || processingImage || uploadImage.isPending}>
                {createArticle.isPending || uploadImage.isPending ? "جاري النشر..." : "نشر المقالة"}
              </Button>
              <Link href="/admin/articles">
                <Button variant="outline" className="flex-1">إلغاء</Button>
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
