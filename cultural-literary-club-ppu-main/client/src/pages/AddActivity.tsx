import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Plus, Trash2, Upload, ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

// ─── رفع الصورة بأعلى دقة ممكنة عبر Canvas ───────────────────────────────────
async function processImageHighQuality(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // أقصى عرض 2400px مع الحفاظ على النسبة الأصلية
      const MAX_DIMENSION = 2400;
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      // جودة رسم عالية
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG بجودة 95% (عالية جداً)
      const result = canvas.toDataURL("image/jpeg", 0.95);
      resolve(result);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export default function AddActivity() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [pdfFile, setPdfFile] = useState<{ name: string; base64: string } | null>(null);
  const [links, setLinks] = useState<string[]>([""]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    location: "",
    category: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  const uploadImage = trpc.upload.image.useMutation();
  const uploadAttachment = trpc.attachments.upload.useMutation();

  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة النشاط بنجاح!");
      setLocation("/admin/activities");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">يرجى تسجيل الدخول أولاً</h1>
          <Link href="/"><Button className="bg-accent text-accent-foreground hover:bg-accent/90">العودة إلى الرئيسية</Button></Link>
        </div>
      </div>
    );
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("يرجى اختيار ملف صورة صحيح"); return; }

    setProcessingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const raw = reader.result as string;
        // معالجة الصورة بدقة عالية
        const processed = await processImageHighQuality(raw);

        // استخراج الأبعاد للعرض
        const img = new Image();
        img.onload = () => setImageSize({ w: img.width, h: img.height });
        img.src = processed;

        setImagePreview(processed);
        setImageBase64(processed);
        setProcessingImage(false);
      };
      reader.onerror = () => { toast.error("فشل قراءة الصورة"); setProcessingImage(false); };
      reader.readAsDataURL(file);
    } catch {
      toast.error("فشل معالجة الصورة");
      setProcessingImage(false);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("يرجى اختيار ملف PDF"); return; }
    const reader = new FileReader();
    reader.onload = () => setPdfFile({ name: file.name, base64: reader.result as string });
    reader.readAsDataURL(file);
  };

  const addLink = () => setLinks([...links, ""]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) => setLinks(links.map((l, idx) => (idx === i ? val : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.startDate || !formData.startTime) {
      toast.error("يرجى ملء جميع الحقول المطلوبة"); return;
    }

    setIsUploading(true);
    try {
      let imageUrl = "";
      let imageKey = "";
      if (imageBase64) {
        const imgResult = await uploadImage.mutateAsync({
          filename: `activity-${Date.now()}.jpg`,
          base64: imageBase64,
        });
        imageUrl = imgResult.url;
        imageKey = imgResult.key;
      }

      let pdfInfo: { url: string; key: string; name: string } | null = null;
      if (pdfFile) {
        const match = /^data:([^;]+);base64,(.*)$/.exec(pdfFile.base64);
        const encoded = match?.[2] ?? pdfFile.base64;
        const pdfResult = await uploadAttachment.mutateAsync({
          filename: pdfFile.name,
          mimeType: "application/pdf",
          base64Data: encoded,
        });
        pdfInfo = { url: pdfResult.url, key: pdfResult.key, name: pdfFile.name };
      }

      const validLinks = links.filter((l) => l.trim() !== "");
      const contentData = { category: formData.category, links: validLinks, pdf: pdfInfo };

      const startDate = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDate = formData.endDate && formData.endTime
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : undefined;

      createActivity.mutate({
        title: formData.title,
        description: formData.description,
        startDate,
        endDate,
        location: formData.location,
        content: JSON.stringify(contentData),
        imageUrl: imageUrl || undefined,
        imageKey: imageKey || undefined,
      });
    } catch {
      toast.error("حدث خطأ أثناء رفع الملفات");
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = createActivity.isPending || isUploading;

  const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin/activities">
              <Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">إضافة نشاط جديد</h1>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">

              {/* اسم النشاط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">اسم النشاط <span className="text-red-500">*</span></label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputClass} placeholder="أدخل اسم النشاط" />
              </div>

              {/* مكان النشاط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">مكان النشاط <span className="text-red-500">*</span></label>
                <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className={inputClass} placeholder="أدخل مكان النشاط" />
              </div>

              {/* فئة النشاط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">فئة النشاط <span className="text-red-500">*</span></label>
                <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputClass} placeholder="مثال: محاضرة، ورشة عمل، رحلة..." />
              </div>

              {/* وصف النشاط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">وصف النشاط <span className="text-red-500">*</span></label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={5} className={inputClass} placeholder="أدخل وصفاً تفصيلياً للنشاط" />
              </div>

              {/* وقت البدء */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">وقت بدء النشاط <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">التاريخ</label>
                    <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">الساعة</label>
                    <input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* وقت الانتهاء */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">وقت انتهاء النشاط</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">التاريخ</label>
                    <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">الساعة</label>
                    <input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* صورة النشاط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  صورة النشاط <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground mr-2">(تُرفع بدقة عالية جداً)</span>
                </label>
                <div
                  className="border-2 border-dashed border-border rounded-lg overflow-hidden cursor-pointer hover:border-accent transition-colors"
                  onClick={() => !processingImage && imageInputRef.current?.click()}
                >
                  {processingImage ? (
                    <div className="p-10 text-center">
                      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">جاري معالجة الصورة بدقة عالية...</p>
                    </div>
                  ) : imagePreview ? (
                    <div className="relative">
                      <img  src={imagePreview} alt="معاينة" className="w-full max-h-64 object-contain bg-muted/20" loading="lazy" decoding="async" />
                      {imageSize && (
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {imageSize.w} × {imageSize.h} px
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">انقر لرفع صورة النشاط</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — تُحفظ بأعلى دقة ممكنة</p>
                    </div>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {imagePreview && !processingImage && (
                  <Button type="button" variant="outline" size="sm" className="mt-2 text-red-500"
                    onClick={() => { setImagePreview(null); setImageBase64(null); setImageSize(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}>
                    إزالة الصورة
                  </Button>
                )}
              </div>

              {/* روابط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  روابط مرفقة <span className="text-muted-foreground text-xs">(اختياري)</span>
                </label>
                <div className="space-y-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="url" value={link} onChange={e => updateLink(i, e.target.value)}
                        className={`flex-1 ${inputClass}`} placeholder="https://..." dir="ltr" />
                      {links.length > 1 && (
                        <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => removeLink(i)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLink} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" />إضافة رابط
                  </Button>
                </div>
              </div>

              {/* ملف PDF */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  ملف PDF مرفق <span className="text-muted-foreground text-xs">(اختياري)</span>
                </label>
                {pdfFile ? (
                  <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/30">
                    <span className="text-sm flex-1 truncate">{pdfFile.name}</span>
                    <Button type="button" variant="outline" size="sm" className="text-red-500"
                      onClick={() => { setPdfFile(null); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent transition-colors"
                    onClick={() => pdfInputRef.current?.click()}>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">انقر لرفع ملف PDF</p>
                  </div>
                )}
                <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending || processingImage}>
                  {isPending ? "جاري الحفظ..." : "حفظ النشاط"}
                </Button>
                <Link href="/admin/activities">
                  <Button variant="outline" className="flex-1">إلغاء</Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
