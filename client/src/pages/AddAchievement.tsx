import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ─── معالجة الصورة بدقة عالية (نفس منطق صفحة إضافة المقالة) ─────────────────
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

const CATEGORIES = [
  { value: "award", label: "جائزة" },
  { value: "achievement", label: "إنجاز" },
  { value: "milestone", label: "علامة فارقة" },
];

const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

export default function AddAchievement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    year: new Date().getFullYear().toString(),
    category: "",
    awardName: "",
    awardingOrganization: "",
    details: "",
    articleId: "",
    featured: false,
  });

  const [image, setImage] = useState<{ preview: string; base64: string } | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  // Articles are attached *after* the article itself has been published —
  // so we only offer already-published articles to link to.
  const { data: articles } = trpc.articles.list.useQuery();
  const publishedArticles = (articles ?? []).filter((a: any) => a.published);

  const uploadImage = trpc.upload.image.useMutation();
  const createAchievement = trpc.achievements.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الإنجاز بنجاح!");
      setLocation("/achievements");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  // Redirect if not admin
  if (user?.role !== "admin" && user?.role !== "general_agent" && user?.role !== "tech_admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            غير مصرح لك بالوصول إلى هذه الصفحة
          </h1>
          <Link href="/">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              العودة إلى الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة صالح"); return; }
    setProcessingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const processed = await processImage(reader.result as string);
      setImage({ preview: processed, base64: processed });
      setProcessingImage(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.category || !form.year) {
      toast.error("يرجى ملء جميع الحقول المطلوبة (العنوان، الوصف، الفئة، السنة)");
      return;
    }

    let imageUrl: string | undefined;
    let imageKey: string | undefined;
    if (image) {
      toast.info("جاري رفع الصورة...");
      try {
        const result = await uploadImage.mutateAsync({
          filename: `achievement-${Date.now()}.jpg`,
          base64: image.base64,
        });
        imageUrl = result.url;
        imageKey = result.key;
      } catch {
        toast.error("فشل رفع الصورة");
        return;
      }
    }

    createAchievement.mutate({
      title: form.title,
      description: form.description,
      year: parseInt(form.year),
      category: form.category,
      awardName: form.awardName || undefined,
      awardingOrganization: form.awardingOrganization || undefined,
      details: form.details || undefined,
      articleId: form.articleId ? parseInt(form.articleId) : undefined,
      featured: form.featured,
      imageUrl,
      imageKey,
    });
  };

  const isSubmitting = createAchievement.isPending || uploadImage.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/achievements">
              <Button variant="outline" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              إضافة إنجاز جديد
            </h1>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  عنوان الإنجاز *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="أدخل عنوان الإنجاز"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الوصف *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className={inputClass}
                  placeholder="أدخل وصف الإنجاز"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    السنة *
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    الفئة *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">اختر الفئة</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    اسم الجائزة/الشهادة
                  </label>
                  <input
                    type="text"
                    value={form.awardName}
                    onChange={(e) => setForm({ ...form, awardName: e.target.value })}
                    className={inputClass}
                    placeholder="مثال: جائزة التميز الثقافي"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    الجهة المانحة
                  </label>
                  <input
                    type="text"
                    value={form.awardingOrganization}
                    onChange={(e) => setForm({ ...form, awardingOrganization: e.target.value })}
                    className={inputClass}
                    placeholder="مثال: الجامعة / وزارة الثقافة"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  تفاصيل إضافية
                </label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="أي تفاصيل إضافية عن الإنجاز (اختياري)"
                />
              </div>

              {/* ربط المقالة */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  ربط بمقالة منشورة (اختياري)
                </label>
                <select
                  value={form.articleId}
                  onChange={(e) => setForm({ ...form, articleId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">بدون ربط بمقالة</option>
                  {publishedArticles.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  انشر المقالة أولاً من صفحة "المقالات"، ثم اختر عنوانها هنا لربطها بهذا الإنجاز.
                </p>
              </div>

              {/* صورة الإنجاز */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  صورة الإنجاز/الشهادة
                </label>
                {image ? (
                  <div className="relative w-full max-w-xs">
                    <img  src={image.preview} alt="" className="w-full rounded-lg border border-border" loading="lazy" decoding="async" />
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processingImage}
                    className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    <ImageIcon className="w-8 h-8" />
                    {processingImage ? "جاري تجهيز الصورة..." : "اضغط لاختيار صورة"}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="featured"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="featured" className="text-sm text-foreground cursor-pointer">
                  إبراز هذا الإنجاز في الصفحة الرئيسية
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "جاري الحفظ..." : "حفظ الإنجاز"}
                </Button>
                <Link href="/achievements">
                  <Button variant="outline" className="flex-1" type="button">
                    إلغاء
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
