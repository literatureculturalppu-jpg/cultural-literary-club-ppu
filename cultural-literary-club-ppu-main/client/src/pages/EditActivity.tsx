import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Plus, Trash2, Upload, ImageIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

async function processImageHighQuality(dataUrl: string): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject; img.src = dataUrl;
  });
}

export default function EditActivity() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const activityId = parseInt(params.id || "0");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<{ name: string; base64: string } | null>(null);
  const [links, setLinks] = useState<string[]>([""]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [formData, setFormData] = useState({ title:"", location:"", category:"", description:"", startDate:"", startTime:"", endDate:"", endTime:"" });

  const { data: activity } = trpc.activities.getById.useQuery(activityId);
  const uploadImage = trpc.upload.image.useMutation();
  const uploadAttachment = trpc.attachments.upload.useMutation();

  useEffect(() => {
    if (!activity) return;
    const content = (() => { try { return JSON.parse(activity.content || "{}"); } catch { return {}; } })();
    const start = new Date(activity.startDate);
    const end = activity.endDate ? new Date(activity.endDate) : null;
    setFormData({
      title: activity.title,
      location: activity.location || "",
      category: content.category || "",
      description: activity.description,
      startDate: start.toISOString().split("T")[0],
      startTime: start.toTimeString().slice(0,5),
      endDate: end ? end.toISOString().split("T")[0] : "",
      endTime: end ? end.toTimeString().slice(0,5) : "",
    });
    if (activity.imageUrl) setImagePreview(activity.imageUrl);
    if (content.links) setLinks(content.links.length > 0 ? content.links : [""]);
    if (content.pdf) setPdfFile({ name: content.pdf.name, base64: "" });
  }, [activity]);

  const updateActivity = trpc.activities.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث النشاط!"); setLocation("/activities"); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });

  if (!user) return <div className="container py-16 text-center">يرجى تسجيل الدخول</div>;

  const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setProcessingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const processed = await processImageHighQuality(reader.result as string);
      setImagePreview(processed); setImageBase64(processed); setProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    const reader = new FileReader();
    reader.onload = () => setPdfFile({ name: file.name, base64: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = activity?.imageUrl || "";
      let imageKey = activity?.imageKey || "";
      if (imageBase64 && imageBase64.startsWith("data:")) {
        const r = await uploadImage.mutateAsync({ filename: `activity-${Date.now()}.jpg`, base64: imageBase64 });
        imageUrl = r.url; imageKey = r.key;
      }
      let pdfInfo = (() => { try { return JSON.parse(activity?.content || "{}").pdf || null; } catch { return null; } })();
      if (pdfFile?.base64) {
        const match = /^data:([^;]+);base64,(.*)$/.exec(pdfFile.base64);
        const r = await uploadAttachment.mutateAsync({ filename: pdfFile.name, mimeType: "application/pdf", base64Data: match?.[2] ?? pdfFile.base64 });
        pdfInfo = { url: r.url, key: r.key, name: pdfFile.name };
      }
      const validLinks = links.filter(l => l.trim());
      const content = JSON.stringify({ category: formData.category, links: validLinks, pdf: pdfInfo });
      updateActivity.mutate({
        id: activityId, title: formData.title, description: formData.description,
        location: formData.location, content,
        startDate: new Date(`${formData.startDate}T${formData.startTime}`),
        endDate: formData.endDate && formData.endTime ? new Date(`${formData.endDate}T${formData.endTime}`) : undefined,
        imageUrl: imageUrl || undefined, imageKey: imageKey || undefined,
      });
    } catch { toast.error("حدث خطأ أثناء رفع الملفات"); }
    finally { setIsUploading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/activities"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link>
            <h1 className="text-4xl font-bold text-foreground">تعديل النشاط</h1>
          </div>
        </div>
      </section>
      <section className="py-16 bg-background">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
              <div><label className="block text-sm font-medium mb-2">اسم النشاط <span className="text-red-500">*</span></label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} /></div>
              <div><label className="block text-sm font-medium mb-2">مكان النشاط</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className={inputClass} /></div>
              <div><label className="block text-sm font-medium mb-2">فئة النشاط</label>
                <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={inputClass} /></div>
              <div><label className="block text-sm font-medium mb-2">وصف النشاط <span className="text-red-500">*</span></label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={5} className={inputClass} /></div>
              <div><label className="block text-sm font-medium mb-2">وقت البدء</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className={inputClass} />
                  <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className={inputClass} />
                </div></div>
              <div><label className="block text-sm font-medium mb-2">وقت الانتهاء</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className={inputClass} />
                  <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className={inputClass} />
                </div></div>
              {/* صورة */}
              <div><label className="block text-sm font-medium mb-2">صورة النشاط</label>
                <div className="border-2 border-dashed border-border rounded-lg overflow-hidden cursor-pointer hover:border-accent transition-colors"
                  onClick={() => !processingImage && imageInputRef.current?.click()}>
                  {processingImage ? <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
                    : imagePreview ? <img  src={imagePreview} alt="معاينة" className="w-full max-h-56 object-contain bg-muted/20" loading="lazy" decoding="async" />
                    : <div className="p-6 text-center"><Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" /><p className="text-sm text-muted-foreground">انقر لتغيير الصورة</p></div>}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></div>
              {/* روابط */}
              <div><label className="block text-sm font-medium mb-2">روابط مرفقة</label>
                <div className="space-y-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="url" value={link} onChange={e => setLinks(links.map((l,idx) => idx===i ? e.target.value : l))} className={`flex-1 ${inputClass}`} placeholder="https://..." dir="ltr" />
                      {links.length > 1 && <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => setLinks(links.filter((_,idx) => idx!==i))}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setLinks([...links,""])} className="flex items-center gap-1"><Plus className="w-4 h-4" />إضافة رابط</Button>
                </div></div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" disabled={updateActivity.isPending || isUploading}>
                  {updateActivity.isPending || isUploading ? "جاري الحفظ..." : "حفظ التعديلات"}
                </Button>
                <Link href="/activities"><Button variant="outline" className="flex-1">إلغاء</Button></Link>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
