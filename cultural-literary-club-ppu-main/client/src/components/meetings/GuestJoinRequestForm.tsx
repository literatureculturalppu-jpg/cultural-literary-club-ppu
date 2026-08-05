import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const inputClass =
  "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm";

/**
 * "نموذج طلب المعلومات عند الانضمام إلى اجتماع إلكتروني دون حساب" — shown
 * to anyone who opens a meeting invite link without a club account. Same
 * required fields as the guest activity registration form
 * (`activityRegistrations.registerGuest`), for the same reason: both are
 * the club collecting minimal identifying info from an outside visitor.
 *
 * This does not admit the guest into the live meeting — it only records
 * their info for the club's review, the same review-first pattern already
 * used for guest activity registrations. The submitted info is saved to a
 * dedicated list in the meetings dashboard, indexed by meeting name/date.
 */
export function GuestJoinRequestForm({
  token,
  meetingTitle,
}: {
  token: string;
  meetingTitle: string | null | undefined;
}) {
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
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.meetings.submitGuestJoinRequest.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error("حدث خطأ: " + e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.universityEmail || !form.universityId || !form.phoneNumber) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }
    submit.mutate({ token, ...form });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center" dir="rtl">
        <div className="max-w-md">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك</h1>
          <p className="text-muted-foreground">
            تم إرسال معلوماتك بنجاح. سيتم مراجعة طلب انضمامك من قبل إدارة النادي.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            الانضمام كضيف
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meetingTitle ? `الاجتماع: ${meetingTitle}` : "اجتماع النادي الثقافي الأدبي"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            أنت تنضم بدون حساب في النادي. يرجى تعبئة بياناتك التالية لطلب الانضمام.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={inputClass}
              placeholder="الاسم الرباعي"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              البريد الجامعي <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.universityEmail}
              onChange={(e) => setForm({ ...form, universityEmail: e.target.value })}
              className={inputClass}
              placeholder="example@university.edu"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                الرقم الجامعي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.universityId}
                onChange={(e) => setForm({ ...form, universityId: e.target.value })}
                className={inputClass}
                placeholder="220XXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الكلية</label>
              <input
                type="text"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                className={inputClass}
                placeholder="كلية الآداب"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">التخصص</label>
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                className={inputClass}
                placeholder="التخصص"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">سنة الدراسة</label>
              <select
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                className={inputClass}
              >
                <option value="">اختر</option>
                <option value="first">الأولى</option>
                <option value="second">الثانية</option>
                <option value="third">الثالثة</option>
                <option value="fourth">الرابعة</option>
                <option value="postgraduate">دراسات عليا</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                رقم الهاتف <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className={inputClass}
                placeholder="+970XXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">رقم الواتساب</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className={inputClass}
                placeholder="+970XXXXXXXX"
                dir="ltr"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={submit.isPending}
          >
            {submit.isPending ? "جاري الإرسال..." : "إرسال طلب الانضمام"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">سيتم مراجعة طلبك من قبل الإدارة</p>
        </form>
      </div>
    </div>
  );
}
