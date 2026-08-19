import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, CalendarDays, Landmark, LockKeyhole, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى",
  second: "الثانية",
  third: "الثالثة",
  fourth: "الرابعة",
  postgraduate: "دراسات عليا",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "مراجعة بيانات العضوية"],
  general_agent: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "مراجعة بيانات العضوية"],
  tech_admin: ["إدارة تقنية متقدمة", "إدارة المحتوى والأعضاء", "الاطلاع على سجلات العمل"],
  supervisor: ["مراجعة طلبات الأنشطة", "إدارة المهام المكلّف بها"],
  committee_head: ["إدارة الفريق المكلّف به", "تنسيق أعضاء الفريق"],
  user: ["الوصول إلى محتوى النادي", "التسجيل في الأنشطة والفرق"],
};

const STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: "عضوية معتمدة", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  pending: { label: "العضوية قيد المراجعة", className: "bg-amber-100 text-amber-800 border-amber-200" },
  rejected: { label: "العضوية غير معتمدة", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

function Value({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{value || "غير محدد"}</p>
    </div>
  );
}

/** The logged-in user's complete digital membership card. */
export default function MembershipCardPanel() {
  const { data, isLoading, error } = trpc.membershipCards.mine.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-10 text-muted-foreground" dir="rtl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          جاري تجهيز بطاقة العضوية...
        </CardContent>
      </Card>
    );
  }

  if (!data || error) return null;

  const { member, positions, card, isEligible } = data;
  const status = STATUS[member.approvalStatus] ?? STATUS.pending;
  const qrUrl = card ? `${window.location.origin}/membership/verify/${card.verificationToken}` : null;
  const canVerify = Boolean(qrUrl && isEligible && !card?.isRevoked);
  const permissions = ROLE_PERMISSIONS[member.role] ?? ROLE_PERMISSIONS.user;

  return (
    <Card className="overflow-hidden border-accent/40" dir="rtl">
      <CardHeader className="border-b border-accent/20 bg-gradient-to-l from-amber-50 via-background to-amber-50/50">
        <CardTitle className="flex items-center justify-end gap-2 text-right">
          بطاقة العضوية الرقمية
          <BadgeCheck className="h-5 w-5 text-accent" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <section className="overflow-hidden rounded-2xl border border-amber-400/70 bg-black text-white shadow-xl">
          <div className="relative min-h-[330px] bg-[radial-gradient(circle_at_20%_0%,rgba(217,161,59,0.26),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(217,161,59,0.16),transparent_38%)] p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-amber-300 via-amber-500 to-amber-300" />
            <div className="flex items-start justify-between gap-4" dir="ltr">
              <img src="/club-icon-192.png" alt="شعار النادي" className="h-14 w-14 rounded-xl border border-amber-300/60 bg-black object-contain p-1" />
              <div className="text-right" dir="rtl">
                <p className="text-xs text-amber-200">جامعة بوليتكنك فلسطين</p>
                <h2 className="mt-1 text-xl font-bold">النادي الثقافي الأدبي</h2>
                <p className="mt-1 text-sm text-white/75">بطاقة عضوية رقمية</p>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between gap-4" dir="ltr">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/80 bg-white/10" dir="rtl">
                {member.profileImage ? (
                  <img src={member.profileImage} alt="صورة العضو" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-8 w-8 text-amber-100" />
                )}
              </div>
              <div className="min-w-0 text-right" dir="rtl">
                <h3 className="truncate text-xl font-bold">{member.arabicFullName || member.name || "عضو النادي"}</h3>
                <p className="mt-1 text-sm text-amber-200">{member.roleLabel}</p>
                <p className="mt-1 font-mono text-xs tracking-[0.2em] text-white/70" dir="ltr">
                  {member.referenceNumber ? `ID ${member.referenceNumber}` : "ID PENDING"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-5" dir="ltr">
              <div className="text-right" dir="rtl">
                <Badge className={`border ${status.className}`}>{status.label}</Badge>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {positions.slice(0, 2).map((position) => (
                    <span key={position} className="rounded-full border border-amber-200/35 bg-white/10 px-3 py-1 text-xs text-amber-100">
                      {position}
                    </span>
                  ))}
                </div>
              </div>
              {canVerify ? (
                <div className="rounded-xl bg-white p-2 shadow-lg" aria-label="رمز QR للتحقق الإداري">
                  <QRCodeSVG value={qrUrl!} size={112} level="M" includeMargin={false} fgColor="#111111" bgColor="#ffffff" />
                </div>
              ) : (
                <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-xl border border-white/20 bg-white/10 p-3 text-center text-xs text-white/75" dir="rtl">
                  <LockKeyhole className="mb-2 h-5 w-5 text-amber-200" />
                  يصدر رمز التحقق بعد اعتماد العضوية
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-end gap-2 text-right">
            <h3 className="font-bold">بيانات العضوية</h3>
            <Landmark className="h-4 w-4 text-accent" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Value label="الاسم الرباعي" value={member.arabicFullName || member.name} />
            <Value label="الرقم المرجعي" value={member.referenceNumber} />
            <Value label="البريد الإلكتروني" value={member.email} />
            <Value label="رقم الهاتف" value={member.phoneNumber} />
            <Value label="رقم الواتساب" value={member.whatsapp} />
            <Value label="الرقم الجامعي" value={member.universityId} />
            <Value label="الكلية" value={member.college} />
            <Value label="الدائرة" value={member.department} />
            <Value label="التخصص" value={member.specialization} />
            <Value label="السنة الجامعية" value={member.academicYear ? YEAR_LABELS[member.academicYear] || member.academicYear : null} />
            <Value label="تاريخ الميلاد" value={member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString("ar-EG") : null} />
            <Value label="تاريخ الانضمام" value={new Date(member.joinedAt).toLocaleDateString("ar-EG")} />
          </div>
          {member.culturalExperience && <Value label="الخبرات الثقافية" value={member.culturalExperience} />}
        </section>

        <section className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <h3 className="font-bold">الدور والمنصب والصلاحيات</h3>
            <ShieldCheck className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Value label="الدور النظامي" value={member.roleLabel} />
            <Value label="المنصب في النادي" value={positions.join(" • ")} />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {permissions.map((permission) => (
              <Badge key={permission} variant="secondary" className="bg-white text-foreground">
                {permission}
              </Badge>
            ))}
          </div>
        </section>

        <div className="flex items-start justify-end gap-2 rounded-xl bg-muted/60 p-3 text-right text-sm text-muted-foreground">
          <p>رمز QR لا يحتوي معلوماتك الشخصية، ويُتحقق منه داخل صفحة إدارية محمية فقط.</p>
          <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        </div>
        {member.approvedAt && (
          <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>تم اعتماد العضوية في {new Date(member.approvedAt).toLocaleDateString("ar-EG")}</span>
            <CalendarDays className="h-3.5 w-3.5" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
