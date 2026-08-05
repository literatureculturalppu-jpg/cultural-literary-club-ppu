import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, X, Phone, Building2, GraduationCap, IdCard } from "lucide-react";
import { Link } from "wouter";

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى",
  second: "الثانية",
  third: "الثالثة",
  fourth: "الرابعة",
  postgraduate: "دراسات عليا",
};

export default function AdminRegistrationRequests() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { data: pending, isLoading, refetch } = trpc.memberApprovals.listPending.useQuery();

  const approve = trpc.memberApprovals.approve.useMutation({
    onSuccess: () => { toast.success("تم قبول العضو بنجاح"); refetch(); },
    onError: (e) => toast.error("حدث خطأ: " + e.message),
  });
  const reject = trpc.memberApprovals.reject.useMutation({
    onSuccess: () => { toast.success("تم رفض الطلب"); refetch(); },
    onError: (e) => toast.error("حدث خطأ: " + e.message),
  });

  if (user && user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center" dir="rtl">
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-muted-foreground">تحتاج إلى صلاحيات الإدارة للوصول إلى هذه الصفحة</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12" dir="rtl">
      <h1 className="text-4xl font-bold mb-2 text-right">طلبات الانضمام الجديدة</h1>
      <p className="text-muted-foreground mb-8 text-right">
        كل حساب جديد يبقى بانتظار موافقتك هنا قبل أن يتمكن من استخدام الموقع.
      </p>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
      ) : pending && pending.length > 0 ? (
        <div className="grid gap-4">
          {pending.map((member) => (
            <Card key={member.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 text-right space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{member.arabicFullName || member.name || "بدون اسم"}</h3>
                    {member.referenceNumber && (
                      <Badge variant="outline">{member.referenceNumber}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{member.email}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground pt-2">
                    {member.universityId && (
                      <div className="flex items-center gap-2">
                        <IdCard className="w-4 h-4" /> {member.universityId}
                      </div>
                    )}
                    {member.college && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> {member.college}
                        {member.department ? ` - ${member.department}` : ""}
                      </div>
                    )}
                    {member.academicYear && (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" /> السنة {YEAR_LABELS[member.academicYear] || member.academicYear}
                      </div>
                    )}
                    {member.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" /> {member.phoneNumber}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 shrink-0">
                  <Button
                    onClick={() => approve.mutate(member.id)}
                    disabled={approve.isPending || reject.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                  >
                    <Check className="w-4 h-4 ml-1" /> قبول
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm("هل أنت متأكد من رفض هذا الطلب؟")) reject.mutate(member.id);
                    }}
                    disabled={approve.isPending || reject.isPending}
                    variant="destructive"
                    className="flex-1 md:flex-none"
                  >
                    <X className="w-4 h-4 ml-1" /> رفض
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center text-muted-foreground">
            لا توجد طلبات انضمام بانتظار المراجعة حالياً
          </div>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin"><Button variant="outline">العودة للوحة التحكم</Button></Link>
      </div>
    </div>
  );
}
