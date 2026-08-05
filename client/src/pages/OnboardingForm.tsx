import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { UserCheck } from "lucide-react";

const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

export function OnboardingForm() {
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    arabicFullName: "",
    universityId: "",
    college: "",
    specialization: "",
    academicYear: "first" as "first"|"second"|"third"|"fourth"|"postgraduate",
    phoneNumber: "",
    whatsapp: "",
    email: user?.email || "",
    culturalExperience: "",
  });

  const complete = trpc.onboarding.complete.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ بياناتك بنجاح!");
      await refetch?.();
      setLocation("/");
    },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.arabicFullName || !form.universityId || !form.college || !form.specialization || !form.phoneNumber) {
      toast.error("يرجى ملء جميع الحقول المطلوبة"); return;
    }
    complete.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">أهلاً بك في النادي الثقافي الأدبي</h1>
          <p className="text-muted-foreground">يرجى تعبئة بياناتك قبل المتابعة</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* الاسم الثلاثي */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">الاسم الثلاثي <span className="text-red-500">*</span></label>
                <input type="text" value={form.arabicFullName} onChange={e => set("arabicFullName", e.target.value)} className={inputClass} placeholder="الاسم الأول والثاني والثالث" />
              </div>

              {/* الرقم الجامعي */}
              <div>
                <label className="block text-sm font-medium mb-1">الرقم الجامعي <span className="text-red-500">*</span></label>
                <input type="text" value={form.universityId} onChange={e => set("universityId", e.target.value)} className={inputClass} placeholder="220XXXXX" dir="ltr" />
              </div>

              {/* الكلية */}
              <div>
                <label className="block text-sm font-medium mb-1">الكلية <span className="text-red-500">*</span></label>
                <input type="text" value={form.college} onChange={e => set("college", e.target.value)} className={inputClass} placeholder="مثال: كلية الآداب" />
              </div>

              {/* التخصص */}
              <div>
                <label className="block text-sm font-medium mb-1">التخصص <span className="text-red-500">*</span></label>
                <input type="text" value={form.specialization} onChange={e => set("specialization", e.target.value)} className={inputClass} placeholder="مثال: اللغة العربية" />
              </div>

              {/* سنة الدراسة */}
              <div>
                <label className="block text-sm font-medium mb-1">سنة الدراسة <span className="text-red-500">*</span></label>
                <select value={form.academicYear} onChange={e => set("academicYear", e.target.value)} className={inputClass}>
                  <option value="first">الأولى</option>
                  <option value="second">الثانية</option>
                  <option value="third">الثالثة</option>
                  <option value="fourth">الرابعة</option>
                  <option value="postgraduate">دراسات عليا</option>
                </select>
              </div>

              {/* الإيميل */}
              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputClass} placeholder="example@university.edu" dir="ltr" />
              </div>

              {/* رقم الهاتف */}
              <div>
                <label className="block text-sm font-medium mb-1">رقم الهاتف مع المقدمة <span className="text-red-500">*</span></label>
                <input type="tel" value={form.phoneNumber} onChange={e => set("phoneNumber", e.target.value)} className={inputClass} placeholder="+970XXXXXXXX" dir="ltr" />
              </div>

              {/* رقم الواتساب */}
              <div>
                <label className="block text-sm font-medium mb-1">رقم الواتساب مع المقدمة</label>
                <input type="tel" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} className={inputClass} placeholder="+970XXXXXXXX" dir="ltr" />
              </div>
            </div>

            {/* الخبرات الثقافية */}
            <div>
              <label className="block text-sm font-medium mb-1">الخبرات الثقافية والأدبية</label>
              <textarea value={form.culturalExperience} onChange={e => set("culturalExperience", e.target.value)} rows={4} className={inputClass} placeholder="اذكر أي خبرات ثقافية أو أدبية أو مشاركات سابقة في أنشطة مشابهة..." />
            </div>

            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={complete.isPending}>
              {complete.isPending ? "جاري الحفظ..." : "حفظ البيانات والمتابعة"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
