import { BadgeCheck, CircleX, LoaderCircle, ScanLine, ShieldAlert, UserRound } from "lucide-react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى", second: "الثانية", third: "الثالثة", fourth: "الرابعة", postgraduate: "دراسات عليا",
};

const ADMIN_ROLES = new Set(["admin", "general_agent", "tech_admin"]);

export default function MembershipCardVerify() {
  const { token = "" } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const canVerify = Boolean(user && ADMIN_ROLES.has(user.role));
  const tokenIsWellFormed = /^[a-f0-9]{64}$/i.test(token);
  const verification = trpc.membershipCards.verify.useQuery(
    { token },
    { enabled: canVerify && tokenIsWellFormed, retry: false }
  );

  if (authLoading) {
    return <div className="flex justify-center py-24"><LoaderCircle className="h-7 w-7 animate-spin text-accent" /></div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
        <ShieldAlert className="mx-auto h-11 w-11 text-accent" />
        <h1 className="mt-4 text-2xl font-bold">التحقق الإداري يتطلب تسجيل الدخول</h1>
        <p className="mt-2 text-muted-foreground">سجّل دخولك بحساب إداري للتحقق من صحة بطاقة العضوية.</p>
        <Link href="/login"><Button className="mt-6">تسجيل الدخول</Button></Link>
      </div>
    );
  }

  if (!canVerify) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
        <ShieldAlert className="mx-auto h-11 w-11 text-rose-600" />
        <h1 className="mt-4 text-2xl font-bold">لا تملك صلاحية التحقق</h1>
        <p className="mt-2 text-muted-foreground">هذه الصفحة متاحة للمسؤول والوكيل العام والمدير التقني فقط.</p>
      </div>
    );
  }

  if (!tokenIsWellFormed) {
    return <InvalidCard message="رمز بطاقة العضوية غير صالح." />;
  }

  if (verification.isLoading) {
    return (
      <div className="container mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center" dir="rtl">
        <LoaderCircle className="h-9 w-9 animate-spin text-accent" />
        <p className="mt-4 text-muted-foreground">جاري التحقق من البطاقة...</p>
      </div>
    );
  }

  const result = verification.data;
  if (verification.error || !result || !result.valid) {
    return <InvalidCard message="هذه البطاقة غير صالحة أو لم تعد فعالة." />;
  }

  const { member, positions, verifiedAt } = result;
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12" dir="rtl">
      <Card className="overflow-hidden border-emerald-300 shadow-lg">
        <CardHeader className="bg-emerald-50 text-right">
          <CardTitle className="flex items-center justify-end gap-2 text-emerald-800">
            تم التحقق من بطاقة العضوية
            <BadgeCheck className="h-6 w-6" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <h1 className="text-2xl font-bold">{member.arabicFullName || "عضو النادي"}</h1>
              <p className="mt-1 text-muted-foreground">{member.roleLabel}</p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-800">عضوية معتمدة</Badge>
            </div>
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent/10">
              {member.profileImage ? <img src={member.profileImage} alt="صورة العضو" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-accent" />}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="الرقم المرجعي" value={member.referenceNumber} />
            <Detail label="الرقم الجامعي" value={member.universityId} />
            <Detail label="الكلية" value={member.college} />
            <Detail label="التخصص" value={member.specialization} />
            <Detail label="السنة الجامعية" value={member.academicYear ? YEAR_LABELS[member.academicYear] || member.academicYear : null} />
            <Detail label="المنصب" value={positions.length ? positions.join(" • ") : member.roleLabel} />
          </div>
          <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>تم التحقق في {new Date(verifiedAt).toLocaleString("ar-EG")}</span>
            <ScanLine className="h-4 w-4 text-accent" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-lg border p-3 text-right"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value || "غير محدد"}</p></div>;
}

function InvalidCard({ message }: { message: string }) {
  return (
    <div className="container mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
      <CircleX className="mx-auto h-12 w-12 text-rose-600" />
      <h1 className="mt-4 text-2xl font-bold">تعذر التحقق من البطاقة</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
}
