import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { UserCheck, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const inputClass = "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

type ActivityRegistrationModalProps = {
  activity: { id: number; title: string };
  onClose: () => void;
  onRegistered?: () => void;
};

/**
 * نموذج تسجيل الضيف في النشاط. يُستخدم من قائمة الأنشطة ومن صفحة التفاصيل
 * نفسها حتى لا يصبح التسجيل متاحًا في مسار واحد فقط.
 */
export default function ActivityRegistrationModal({
  activity,
  onClose,
  onRegistered,
}: ActivityRegistrationModalProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"choose" | "guest">("choose");
  const [form, setForm] = useState({
    fullName: "",
    universityEmail: "",
    universityId: "",
    college: "",
    specialization: "",
    academicYear: "",
    phoneNumber: "",
    whatsapp: "",
  });

  const guestRegister = trpc.activityRegistrations.registerGuest.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب تسجيلك وسيظهر لدى إدارة النشاط للمراجعة.");
      onRegistered?.();
      onClose();
    },
    onError: (error) => toast.error(`تعذر إرسال طلب التسجيل: ${error.message}`),
  });

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const universityEmail = form.universityEmail.trim().toLowerCase();
    const universityId = form.universityId.trim();
    const phoneNumber = form.phoneNumber.trim();

    if (!fullName || !universityEmail || !universityId || !phoneNumber) {
      toast.error("يرجى ملء الحقول المطلوبة.");
      return;
    }
    if (phoneNumber.length < 7) {
      toast.error("يرجى إدخال رقم هاتف صالح.");
      return;
    }

    guestRegister.mutate({
      activityId: activity.id,
      fullName,
      universityEmail,
      universityId,
      phoneNumber,
      college: form.college.trim() || undefined,
      specialization: form.specialization.trim() || undefined,
      academicYear: form.academicYear || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true" aria-label={`التسجيل في ${activity.title}`}>
      <div className="my-4 w-full max-w-md rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-lg font-bold text-foreground">التسجيل في: {activity.title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق نموذج التسجيل">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          {mode === "choose" ? (
            <div className="space-y-3">
              <p className="mb-4 text-sm text-muted-foreground">اختر طريقة التسجيل:</p>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setLocation("/login"); onClose(); }}>
                <UserCheck className="ml-2 h-4 w-4" />المتابعة كعضو
                <span className="mr-1 text-xs opacity-75">(يتطلب تسجيل الدخول)</span>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMode("guest")}>
                <UserPlus className="ml-2 h-4 w-4" />المتابعة كضيف
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <button type="button" onClick={() => setMode("choose")} className="mb-1 flex items-center gap-1 text-sm text-accent hover:underline">← رجوع</button>
              <div><label className="mb-1 block text-xs font-medium">الاسم الكامل <span className="text-red-500">*</span></label><input required type="text" value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} className={inputClass} placeholder="الاسم الرباعي" /></div>
              <div><label className="mb-1 block text-xs font-medium">البريد الجامعي <span className="text-red-500">*</span></label><input required type="email" value={form.universityEmail} onChange={(event) => setField("universityEmail", event.target.value)} className={inputClass} placeholder="example@university.edu" dir="ltr" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium">الرقم الجامعي <span className="text-red-500">*</span></label><input required type="text" value={form.universityId} onChange={(event) => setField("universityId", event.target.value)} className={inputClass} placeholder="220XXXXX" dir="ltr" /></div><div><label className="mb-1 block text-xs font-medium">الكلية</label><input type="text" value={form.college} onChange={(event) => setField("college", event.target.value)} className={inputClass} placeholder="كلية الآداب" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium">التخصص</label><input type="text" value={form.specialization} onChange={(event) => setField("specialization", event.target.value)} className={inputClass} placeholder="التخصص" /></div><div><label className="mb-1 block text-xs font-medium">سنة الدراسة</label><select value={form.academicYear} onChange={(event) => setField("academicYear", event.target.value)} className={inputClass}><option value="">اختر</option><option value="first">الأولى</option><option value="second">الثانية</option><option value="third">الثالثة</option><option value="fourth">الرابعة</option><option value="postgraduate">دراسات عليا</option></select></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium">رقم الهاتف <span className="text-red-500">*</span></label><input required type="tel" value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} className={inputClass} placeholder="+970XXXXXXXX" dir="ltr" /></div><div><label className="mb-1 block text-xs font-medium">رقم الواتساب</label><input type="tel" value={form.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} className={inputClass} placeholder="+970XXXXXXXX" dir="ltr" /></div></div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={guestRegister.isPending}>{guestRegister.isPending ? "جاري الإرسال..." : "إرسال طلب التسجيل"}</Button>
              <p className="text-center text-xs text-muted-foreground">سيظهر الطلب مباشرة في صفحة قبول المسجلين الخاصة بهذا النشاط.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
