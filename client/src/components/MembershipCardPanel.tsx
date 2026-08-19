import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, CalendarDays, ImageDown, Landmark, LoaderCircle, LockKeyhole, Move, QrCode, RotateCcw, Save, ShieldCheck, Upload, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى",
  second: "الثانية",
  third: "الثالثة",
  fourth: "الرابعة",
  postgraduate: "دراسات عليا",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "مراجعة بيانات العضوية"],
  club_president: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "تعيين المسؤولين واتخاذ الإجراءات الإدارية بحقهم"],
  vice_president: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "إدارة الصلاحيات التنفيذية باستثناء رئيس النادي ونائبه"],
  public_relations_officer: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "إدارة الصلاحيات التنفيذية باستثناء رئيس النادي ونائبه"],
  secretary: ["لا توجد صلاحيات تنفيذية حاليًا"],
  treasurer: ["لا توجد صلاحيات تنفيذية حاليًا"],
  general_agent: ["إدارة المحتوى والأعضاء", "إدارة الفرق وطلبات التسجيل", "مراجعة بيانات العضوية"],
  tech_admin: ["إدارة تقنية متقدمة", "إدارة المحتوى والأعضاء", "الاطلاع على سجلات العمل"],
  supervisor: ["إدارة مهام السوشيال ميديا", "مراجعة طلبات الأنشطة والمهام المكلّف بها"],
  committee_head: ["إدارة الفريق المكلّف به", "تنسيق أعضاء الفريق"],
  user: ["الوصول إلى محتوى النادي", "التسجيل في الأنشطة والفرق"],
};

const STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: "عضوية معتمدة", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  pending: { label: "العضوية قيد المراجعة", className: "bg-amber-100 text-amber-800 border-amber-200" },
  rejected: { label: "العضوية غير معتمدة", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

type ExportFormat = "png" | "pdf";

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",", 2)[1];
      if (!base64) return reject(new Error("تعذر تجهيز ملف البطاقة."));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("تعذر تجهيز ملف البطاقة."));
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function downloadGeneratedCard(blob: Blob, filename: string, mimeType: string) {
  const nativeBridge = window.ReactNativeWebView;
  if (nativeBridge) {
    const base64 = await blobToBase64(blob);
    nativeBridge.postMessage(JSON.stringify({
      type: "club-card-download",
      filename,
      mimeType,
      base64,
    }));
    return "native" as const;
  }
  triggerBrowserDownload(blob, filename);
  return "browser" as const;
}

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
  const exportCardRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const [photoScale, setPhotoScale] = useState(1);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    return () => {
      if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    };
  }, [localPhotoUrl]);

  const resetLocalPhoto = () => {
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    setLocalPhotoUrl(null);
    setPhotoOffset({ x: 0, y: 0 });
    setPhotoScale(1);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleLocalPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file || !file.type.startsWith("image/")) return;
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    setLocalPhotoUrl(URL.createObjectURL(file));
    setPhotoOffset({ x: 0, y: 0 });
    setPhotoScale(1);
  };

  const handlePhotoPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingPhoto || !localPhotoUrl) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextX = Math.max(-45, Math.min(45, ((event.clientX - rect.left) / rect.width - 0.5) * 100));
    const nextY = Math.max(-45, Math.min(45, ((event.clientY - rect.top) / rect.height - 0.5) * 100));
    setPhotoOffset({ x: nextX, y: nextY });
  };

  const chooseExportFormat = (format: ExportFormat) => {
    setExportFormat(format);
    window.setTimeout(() => imageInputRef.current?.click(), 0);
  };

  const downloadCard = async () => {
    if (!exportCardRef.current || !exportFormat) return;
    setIsExporting(true);
    let isolationFrame: HTMLIFrameElement | null = null;
    try {
      isolationFrame = document.createElement("iframe");
      isolationFrame.setAttribute("aria-hidden", "true");
      Object.assign(isolationFrame.style, { position: "fixed", left: "-10000px", top: "0", width: "1224px", height: "1207px", border: "0", pointerEvents: "none" });
      document.body.appendChild(isolationFrame);

      const exportDocument = isolationFrame.contentDocument;
      if (!exportDocument) throw new Error("تعذر تهيئة مساحة تصدير البطاقة.");
      exportDocument.open();
      exportDocument.write(
        '<!doctype html><html dir="rtl"><head><meta charset="utf-8" />' +
        '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" />' +
        '<style>html,body{margin:0;padding:0;background:#FFFFFF;color:#111111;font-family:"Tajawal",Arial,sans-serif;direction:rtl}*{box-sizing:border-box}</style>' +
        '</head><body></body></html>'
      );
      exportDocument.close();

      const isolatedCard = exportCardRef.current.cloneNode(true) as HTMLDivElement;
      isolatedCard.removeAttribute("id");
      isolatedCard.style.position = "static";
      isolatedCard.style.left = "auto";
      isolatedCard.style.top = "auto";
      isolatedCard.querySelectorAll("img").forEach((image) => {
        const source = image.getAttribute("src");
        if (source) image.src = new URL(source, window.location.origin).href;
      });
      const nameNode = isolatedCard.querySelector<HTMLElement>('[data-export-role="member-name"]');
      exportDocument.body.appendChild(isolatedCard);

      const frameWindow = isolationFrame?.contentWindow;
      // Wait for the Tajawal font to actually finish loading inside the
      // isolated iframe document before we let html2canvas measure/paint
      // text — otherwise it falls back to a system font mid-capture and
      // text can end up mismeasured (or not painted at all).
      const frameFonts = (frameWindow?.document as (Document & { fonts?: FontFaceSet }) | undefined)?.fonts;
      if (frameFonts?.ready) {
        try {
          await Promise.race([
            frameFonts.ready,
            new Promise((resolve) => window.setTimeout(resolve, 1500)),
          ]);
        } catch {
          // Ignore font-loading failures; we still proceed with the capture.
        }
      }

      // html2canvas cannot reliably wrap right-to-left Arabic text across
      // multiple lines — the connected-letter shaping breaks and glyphs
      // end up overlapping/garbled. So instead of ever letting the name
      // wrap, we measure it (with the *real* loaded font) and truncate it
      // character-by-character until it is guaranteed to fit on one line,
      // then keep it forced to a single line.
      if (nameNode) {
        const fullName = (nameNode.textContent ?? "").trim();
        const maxWidth = nameNode.parentElement?.getBoundingClientRect().width || 590;
        const computedStyle = frameWindow?.getComputedStyle(nameNode) ?? window.getComputedStyle(nameNode);
        const measureCanvas = document.createElement("canvas");
        const measureContext = measureCanvas.getContext("2d");
        nameNode.style.whiteSpace = "nowrap";
        nameNode.style.overflow = "hidden";
        nameNode.style.textOverflow = "clip";
        if (measureContext) {
          measureContext.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
          let fitted = fullName;
          if (measureContext.measureText(fitted).width > maxWidth) {
            let low = 0;
            let high = fullName.length;
            while (low < high) {
              const mid = Math.ceil((low + high) / 2);
              const candidate = `${fullName.slice(0, mid)}…`;
              if (measureContext.measureText(candidate).width <= maxWidth) low = mid;
              else high = mid - 1;
            }
            fitted = low > 0 ? `${fullName.slice(0, low)}…` : "…";
          }
          nameNode.textContent = fitted;
        }
      }

      await new Promise<void>((resolve) => {
        if (frameWindow) frameWindow.requestAnimationFrame(() => resolve());
        else window.requestAnimationFrame(() => resolve());
      });
      await Promise.all(Array.from(isolatedCard.querySelectorAll("img")).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      })));

      const canvas = await html2canvas(isolatedCard, {
        backgroundColor: "#FFFFFF",
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      });
      const fileBaseName = `membership-card-${new Date().toISOString().slice(0, 10)}`;
      let blob: Blob;
      let filename: string;
      let mimeType: string;
      if (exportFormat === "png") {
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((value) => value ? resolve(value) : reject(new Error("تعذر إنشاء صورة البطاقة.")), "image/png", 0.95);
        });
        filename = `${fileBaseName}.png`;
        mimeType = "image/png";
      } else {
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
        blob = pdf.output("blob");
        filename = `${fileBaseName}.pdf`;
        mimeType = "application/pdf";
      }
      const destination = await downloadGeneratedCard(blob, filename, mimeType);
      setSaveDialogOpen(false);
      toast.success(destination === "native" ? "جارٍ حفظ البطاقة على جهازك." : "بدأ تنزيل البطاقة.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تنزيل البطاقة. حاول مرة أخرى.");
    } finally {
      isolationFrame?.remove();
      setIsExporting(false);
    }
  };

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
    <>
    <Card className="overflow-hidden border-accent/40" dir="rtl">
      <CardHeader className="border-b border-accent/20 bg-gradient-to-l from-amber-50 via-background to-amber-50/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" className="gap-2" onClick={() => setSaveDialogOpen(true)}>
            <Save className="h-4 w-4" />
            حفظ البطاقة
          </Button>
          <CardTitle className="flex items-center justify-end gap-2 text-right">
            بطاقة العضوية الرقمية
            <BadgeCheck className="h-5 w-5 text-accent" />
          </CardTitle>
        </div>
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
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/80 bg-white/10 ${localPhotoUrl ? "cursor-move touch-none" : ""}`}
                dir="rtl"
                onPointerDown={localPhotoUrl ? (event) => { event.currentTarget.setPointerCapture(event.pointerId); setIsDraggingPhoto(true); } : undefined}
                onPointerMove={handlePhotoPointerMove}
                onPointerUp={localPhotoUrl ? () => setIsDraggingPhoto(false) : undefined}
                onPointerCancel={localPhotoUrl ? () => setIsDraggingPhoto(false) : undefined}
                title={localPhotoUrl ? "اسحب الصورة لضبط موضعها" : undefined}
              >
                {localPhotoUrl ? (
                  <img src={localPhotoUrl} alt="الصورة المحلية المختارة" className="h-full w-full object-cover" style={{ transform: `translate(${photoOffset.x}%, ${photoOffset.y}%) scale(${photoScale})` }} />
                ) : member.profileImage ? (
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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center justify-end gap-2">
              تخصيص وحفظ بطاقة العضوية
              <ImageDown className="h-5 w-5 text-accent" />
            </DialogTitle>
            <DialogDescription className="text-right leading-6">
              اختر نوع التنزيل، ثم اختر صورة من جهازك لتظهر مؤقتًا في البطاقة. لا تُرفع الصورة ولا تُحفظ في قاعدة البيانات.
            </DialogDescription>
          </DialogHeader>

          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalPhotoChange} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button type="button" variant={exportFormat === "png" ? "default" : "outline"} className="h-auto min-h-20 flex-col gap-1" onClick={() => chooseExportFormat("png")}>
              <ImageDown className="h-5 w-5" />
              <span>حفظ كصورة PNG</span>
              <span className="text-xs font-normal opacity-80">يفتح معرض الصور لاختيار صورتك</span>
            </Button>
            <Button type="button" variant={exportFormat === "pdf" ? "default" : "outline"} className="h-auto min-h-20 flex-col gap-1" onClick={() => chooseExportFormat("pdf")}>
              <Save className="h-5 w-5" />
              <span>حفظ كملف PDF</span>
              <span className="text-xs font-normal opacity-80">يفتح معرض الصور لاختيار صورتك</span>
            </Button>
          </div>

          <section className="space-y-4 rounded-xl border bg-muted/30 p-4 text-right">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">الصورة المحلية</p>
                <p className="text-xs text-muted-foreground">يمكنك سحب الصورة داخل دائرة البطاقة لتغيير موضعها.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="ml-2 h-4 w-4" />
                  اختيار صورة
                </Button>
                {localPhotoUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetLocalPhoto}>
                    <RotateCcw className="ml-2 h-4 w-4" />
                    استعادة
                  </Button>
                )}
              </div>
            </div>

            {localPhotoUrl ? (
              <>
                <div className="flex items-center justify-center">
                  <div
                    className="flex h-28 w-28 cursor-move touch-none items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-accent bg-background"
                    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setIsDraggingPhoto(true); }}
                    onPointerMove={handlePhotoPointerMove}
                    onPointerUp={() => setIsDraggingPhoto(false)}
                    onPointerCancel={() => setIsDraggingPhoto(false)}
                  >
                    <img src={localPhotoUrl} alt="معاينة الصورة المختارة" className="h-full w-full object-cover" style={{ transform: `translate(${photoOffset.x}%, ${photoOffset.y}%) scale(${photoScale})` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{Math.round(photoScale * 100)}%</span>
                    <span className="flex items-center gap-1"><Move className="h-3.5 w-3.5" /> التكبير والموضع</span>
                  </div>
                  <Slider value={[photoScale]} min={1} max={3} step={0.05} onValueChange={([value]) => setPhotoScale(value)} />
                  <p className="text-xs text-muted-foreground">اسحب الصورة داخل الدائرة، ثم استخدم الشريط للتحكم في حجمها.</p>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-dashed bg-background p-3 text-sm text-muted-foreground">اختر صورة محلية لتضمينها في ملف البطاقة الذي ستنزّله.</p>
            )}
          </section>

          <DialogFooter className="sm:flex-row-reverse sm:justify-start">
            <Button type="button" disabled={!exportFormat || isExporting} onClick={downloadCard}>
              {isExporting ? <LoaderCircle className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
              {isExporting ? "جاري التجهيز..." : exportFormat === "pdf" ? "موافق وتنزيل PDF" : "موافق وتنزيل الصورة"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSaveDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

    <div
      ref={exportCardRef}
      id="membership-card-export-surface"
      aria-hidden="true"
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: 1224,
        height: 1207,
        boxSizing: "border-box",
        padding: "50px 108px 33px",
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
        fontFamily: "Tajawal, Arial, sans-serif",
      }}
    >
      <div style={{ position: "relative", boxSizing: "border-box", width: 1008, height: 1124, overflow: "hidden", borderRadius: 48, border: "2px solid #FBBF24", backgroundColor: "#000000", color: "#FFFFFF", backgroundImage: "radial-gradient(circle at 20% 0%, rgba(217,161,59,0.26), transparent 36%), radial-gradient(circle at 100% 100%, rgba(217,161,59,0.16), transparent 38%)" }}>
        <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 14, backgroundImage: "linear-gradient(to left, #FCD34D, #F59E0B, #FCD34D)" }} />
        <img src="/club-icon-192.png" alt="" style={{ position: "absolute", top: 66, left: 66, width: 178, height: 178, boxSizing: "border-box", borderRadius: 34, border: "2px solid rgba(252,211,77,0.6)", backgroundColor: "#000000", objectFit: "contain", padding: 12 }} />
        <div style={{ position: "absolute", top: 72, right: 70, textAlign: "right" }} dir="rtl">
          <div style={{ color: "#FDE68A", fontSize: 28 }}>جامعة بوليتكنك فلسطين</div>
          <div style={{ marginTop: 22, color: "#FFFFFF", fontSize: 52, lineHeight: 1.2, fontWeight: 700 }}>النادي الثقافي الأدبي</div>
          <div style={{ marginTop: 22, color: "rgba(255,255,255,0.75)", fontSize: 32 }}>بطاقة عضوية رقمية</div>
        </div>

        <div style={{ position: "absolute", top: 408, left: 66, width: 202, height: 202, overflow: "hidden", borderRadius: "50%", border: "4px solid rgba(252,211,77,0.8)", backgroundColor: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {localPhotoUrl || member.profileImage ? (
            <img src={localPhotoUrl || member.profileImage || undefined} crossOrigin="anonymous" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${photoOffset.x}%, ${photoOffset.y}%) scale(${photoScale})` }} />
          ) : (
            <span style={{ color: "#FDE68A", fontSize: 86, fontWeight: 700 }}>{(member.arabicFullName || member.name || "ع").trim().charAt(0)}</span>
          )}
        </div>
        <div style={{ position: "absolute", top: 408, right: 70, width: 590, textAlign: "right" }} dir="rtl">
          <div data-export-role="member-name" style={{ overflow: "hidden", color: "#FFFFFF", fontSize: 50, lineHeight: 1.22, fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{member.arabicFullName || member.name || "عضو النادي"}</div>
          <div style={{ marginTop: 22, color: "#FDE68A", fontSize: 30 }}>{member.roleLabel}</div>
          <div style={{ marginTop: 14, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", fontSize: 24, letterSpacing: "0.22em" }} dir="ltr">{member.referenceNumber ? `ID ${member.referenceNumber}` : "ID PENDING"}</div>
        </div>

        <div style={{ position: "absolute", left: 150, top: 796, textAlign: "right" }} dir="rtl">
          <div style={{ display: "inline-block", border: `2px solid ${member.approvalStatus === "approved" ? "#A7F3D0" : member.approvalStatus === "rejected" ? "#FECDD3" : "#FDE68A"}`, borderRadius: 999, padding: "16px 30px", backgroundColor: member.approvalStatus === "approved" ? "#D1FAE5" : member.approvalStatus === "rejected" ? "#FFE4E6" : "#FEF3C7", color: member.approvalStatus === "approved" ? "#065F46" : member.approvalStatus === "rejected" ? "#9F1239" : "#92400E", fontSize: 26, fontWeight: 700 }}>{status.label}</div>
        </div>
        {positions.length > 0 ? (
          <div style={{ position: "absolute", left: 66, bottom: 64, width: 438, minHeight: 126, boxSizing: "border-box", border: "2px solid rgba(253,230,138,0.35)", borderRadius: 999, padding: "22px 30px", backgroundColor: "rgba(255,255,255,0.1)", color: "#FEF3C7", fontSize: 30, lineHeight: 1.2, textAlign: "center" }} dir="rtl">{positions.slice(0, 2).join(" • ")}</div>
        ) : null}
        {canVerify ? (
          <div style={{ position: "absolute", right: 66, bottom: 64, borderRadius: 34, backgroundColor: "#FFFFFF", padding: 24 }}><QRCodeSVG value={qrUrl!} size={260} level="M" includeMargin={false} fgColor="#111111" bgColor="#FFFFFF" /></div>
        ) : (
          <div style={{ position: "absolute", right: 66, bottom: 64, width: 338, height: 350, boxSizing: "border-box", borderRadius: 34, border: "2px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32, color: "rgba(255,255,255,0.75)", fontSize: 28, lineHeight: 1.55, textAlign: "center" }} dir="rtl"><LockKeyhole size={58} color="#FDE68A" />يصدر رمز التحقق بعد اعتماد العضوية</div>
        )}
      </div>
    </div>
    </>
  );
}
