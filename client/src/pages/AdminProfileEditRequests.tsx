import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Link } from "wouter";

const FIELD_LABELS: Record<string, string> = {
  name: "الاسم",
  arabicFullName: "الاسم الرباعي",
  email: "البريد الإلكتروني",
  dateOfBirth: "تاريخ الميلاد",
  phoneNumber: "رقم الهاتف",
  whatsapp: "رقم الواتساب",
  college: "الكلية",
  department: "الدائرة",
  specialization: "التخصص",
  academicYear: "السنة الجامعية",
  universityId: "الرقم الجامعي",
  culturalExperience: "الخبرات الثقافية",
};

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى",
  second: "الثانية",
  third: "الثالثة",
  fourth: "الرابعة",
  postgraduate: "دراسات عليا",
};

function formatValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "(فارغ)";
  if (field === "academicYear" && typeof value === "string") {
    return YEAR_LABELS[value] || value;
  }
  if (field === "dateOfBirth" && typeof value === "string") {
    try {
      return new Date(value).toLocaleDateString("ar-EG");
    } catch {
      return value;
    }
  }
  return String(value);
}

export default function AdminProfileEditRequests() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { data: pending, isLoading, refetch } = trpc.profileEditRequests.listPending.useQuery();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const approve = trpc.profileEditRequests.approve.useMutation({
    onSuccess: () => {
      toast.success("تمت الموافقة على طلب التعديل");
      refetch();
    },
    onError: (e) => toast.error("حدث خطأ: " + e.message),
  });

  const reject = trpc.profileEditRequests.reject.useMutation({
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      setRejectingId(null);
      setRejectionReason("");
      refetch();
    },
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
      <h1 className="text-4xl font-bold mb-2 text-right">طلبات تعديل بيانات الأعضاء</h1>
      <p className="text-muted-foreground mb-8 text-right">
        كل تعديل يقترحه عضو على بياناته الشخصية يبقى معلقاً هنا حتى تتم مراجعته والموافقة عليه أو رفضه.
      </p>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
      ) : pending && pending.length > 0 ? (
        <div className="grid gap-4">
          {pending.map((request) => {
            let changes: Record<string, unknown> = {};
            try {
              changes = JSON.parse(request.changes);
            } catch {
              changes = {};
            }

            return (
              <Card key={request.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 text-right space-y-3">
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <h3 className="font-bold text-lg">
                        {request.applicantArabicFullName || request.applicantName || "بدون اسم"}
                      </h3>
                      {request.applicantReferenceNumber && (
                        <Badge variant="outline">{request.applicantReferenceNumber}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{request.applicantEmail}</p>

                    <div className="space-y-2 pt-2">
                      {Object.entries(changes).map(([field, value]) => (
                        <div key={field} className="text-sm border-b border-border pb-2 last:border-0">
                          <span className="font-semibold">{FIELD_LABELS[field] || field}</span>
                          <span className="text-muted-foreground"> ← </span>
                          <span>{formatValue(field, value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 shrink-0">
                    <Button
                      onClick={() => approve.mutate({ id: request.id })}
                      disabled={approve.isPending || reject.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                    >
                      <Check className="w-4 h-4 ml-1" /> قبول
                    </Button>
                    <Button
                      onClick={() => {
                        setRejectingId(request.id);
                        setRejectionReason("");
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
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center text-muted-foreground">
            لا توجد طلبات تعديل بيانات بانتظار المراجعة حالياً
          </div>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin"><Button variant="outline">العودة للوحة التحكم</Button></Link>
      </div>

      <Dialog open={rejectingId !== null} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">سبب رفض الطلب</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="اكتب سبب رفض طلب التعديل ليتمكن العضو من الاطلاع عليه"
            className="text-right"
            dir="rtl"
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || reject.isPending}
              onClick={() => {
                if (rejectingId !== null) {
                  reject.mutate({ id: rejectingId, reason: rejectionReason.trim() });
                }
              }}
            >
              {reject.isPending ? "جاري الإرسال..." : "تأكيد الرفض"}
            </Button>
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
