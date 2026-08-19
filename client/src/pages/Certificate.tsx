import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Award, CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useParams } from "wouter";

export default function Certificate() {
  const { token = "" } = useParams<{ token: string }>();
  const { data, isLoading } = trpc.activityCertificates.verify.useQuery(token, {
    enabled: /^[a-f0-9]{64}$/i.test(token),
    retry: false,
  });

  if (isLoading) return <div className="container py-24 text-center text-muted-foreground" dir="rtl">جارِ التحقق من الشهادة...</div>;
  if (!data?.valid) return <InvalidCertificate />;

  const { certificate, activity } = data;
  const verificationUrl = `${window.location.origin}/certificates/${token}`;
  return (
    <div className="min-h-screen bg-muted/30 py-8 md:py-14" dir="rtl">
      <div className="container max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <div className="flex items-center gap-2 text-green-700"><ShieldCheck className="w-5 h-5" /><span className="font-semibold">شهادة موثقة وصالحة</span></div>
          <Button className="bg-accent text-accent-foreground gap-2" onClick={() => window.print()}><Download className="w-4 h-4" />حفظ كملف PDF / طباعة</Button>
        </div>
        <article id="activity-certificate" className="relative overflow-hidden rounded-sm bg-[#fffdf8] shadow-2xl print:shadow-none" style={{ minHeight: "680px" }}>
          <div className="absolute inset-4 border-2 border-[#c89b3c] pointer-events-none" />
          <div className="absolute inset-7 border border-[#2b2112]/20 pointer-events-none" />
          <div className="relative z-10 min-h-[680px] px-8 py-10 md:px-20 md:py-14 flex flex-col items-center text-center">
            <img src="/club-icon-192.png" alt="شعار النادي" className="w-20 h-20 object-contain mb-4" />
            <p className="text-sm tracking-[0.22em] text-[#7c5c1b] font-semibold">جامعة بوليتكنك فلسطين</p>
            <h1 className="text-3xl md:text-5xl font-bold text-[#2b2112] mt-3">شهادة مشاركة</h1>
            <div className="w-24 h-1 bg-[#c89b3c] rounded-full my-7" />
            <p className="text-base md:text-lg text-[#5b4a2a]">يشهد النادي الثقافي الأدبي بأن</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#34240e] mt-5 mb-5 leading-tight">{certificate.recipientName}</h2>
            <p className="max-w-2xl text-base md:text-xl leading-relaxed text-[#5b4a2a]">قد شارك في نشاط</p>
            <h3 className="max-w-3xl text-xl md:text-3xl font-bold text-[#7c5c1b] mt-3 leading-relaxed">«{activity.title}»</h3>
            <p className="text-sm md:text-base text-[#5b4a2a] mt-5">بتاريخ {new Date(activity.startDate).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</p>
            <div className="mt-auto pt-10 flex w-full flex-col sm:flex-row items-center justify-between gap-5 text-right">
              <div className="text-sm text-[#5b4a2a] order-2 sm:order-1">
                <p className="font-bold text-[#34240e]">النادي الثقافي الأدبي</p>
                <p className="mt-1">رقم الشهادة: <span dir="ltr" className="font-mono text-xs">{certificate.certificateNumber}</span></p>
                <p className="mt-1">تاريخ الإصدار: {new Date(certificate.issuedAt).toLocaleDateString("ar-SA")}</p>
              </div>
              <div className="flex items-center gap-3 order-1 sm:order-2 text-right">
                <QRCodeSVG value={verificationUrl} size={92} level="M" includeMargin={false} fgColor="#2b2112" bgColor="#fffdf8" />
                <p className="text-xs max-w-28 text-[#5b4a2a] leading-relaxed">امسح الرمز للتحقق من صحة الشهادة</p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function InvalidCertificate() {
  return <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4" dir="rtl">
    <Card className="max-w-md w-full p-8 text-center">
      <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-foreground">تعذر التحقق من الشهادة</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">قد يكون رابط التحقق غير صحيح، أو أن الشهادة أُلغيت من قبل إدارة النادي.</p>
      <Button variant="outline" className="mt-6" onClick={() => history.back()}>عودة</Button>
    </Card>
  </div>;
}
