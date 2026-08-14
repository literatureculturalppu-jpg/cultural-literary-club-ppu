import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Mail,
  Send,
  Plus,
  Trash2,
  Link as LinkIcon,
  Paperclip,
  Users,
  ShieldCheck,
  Loader2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type RecipientMode = "all" | "roles" | "specific";
type RecipientRole = "user" | "admin" | "supervisor" | "committee_head" | "general_agent" | "tech_admin";

const roleOptions: { value: RecipientRole; label: string }[] = [
  { value: "user", label: "عضو" },
  { value: "supervisor", label: "مشرف" },
  { value: "committee_head", label: "مشرف فريق" },
  { value: "general_agent", label: "الوكيل العام" },
  { value: "admin", label: "المسؤول" },
  { value: "tech_admin", label: "المدير التقني" },
];

const roleLabels: Record<string, string> = Object.fromEntries(roleOptions.map((r) => [r.value, r.label]));

const inputClass =
  "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

export default function AdminBroadcastEmail() {
  const { user } = useAuth();

  const canSend = user?.role === "admin" || user?.role === "tech_admin";

  const { data: recipients = [], isLoading: loadingRecipients } = trpc.broadcastEmail.listRecipients.useQuery(
    undefined,
    { enabled: canSend }
  );

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all");
  const [selectedRoles, setSelectedRoles] = useState<RecipientRole[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const [links, setLinks] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = trpc.broadcastEmail.uploadFile.useMutation();
  const sendBroadcast = trpc.broadcastEmail.send.useMutation({
    onSuccess: (result) => {
      toast.success(`تم إرسال الرسالة إلى ${result.recipientCount} مستلم بنجاح`);
      setSubject("");
      setMessage("");
      setLinks([]);
      setAttachedFiles([]);
      setSelectedRoles([]);
      setSelectedUserIds([]);
      setRecipientMode("all");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const eligibleRecipients = useMemo(() => recipients.filter((r) => !!r.email), [recipients]);

  const recipientCount = useMemo(() => {
    if (recipientMode === "all") return eligibleRecipients.length;
    if (recipientMode === "roles") {
      if (selectedRoles.length === 0) return 0;
      return eligibleRecipients.filter((r) => selectedRoles.includes(r.role)).length;
    }
    return selectedUserIds.length;
  }, [recipientMode, eligibleRecipients, selectedRoles, selectedUserIds]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return eligibleRecipients.slice(0, 40);
    return eligibleRecipients
      .filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.referenceNumber?.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [eligibleRecipients, memberSearch]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">يرجى تسجيل الدخول أولاً</h1>
          <Link href="/">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">العودة إلى الرئيسية</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!canSend) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">غير مصرح لك بالوصول إلى هذه الصفحة</h1>
          <p className="text-muted-foreground mb-6">صلاحية إرسال البريد الجماعي مقصورة على المسؤول والمدير التقني فقط</p>
          <Link href="/admin">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">العودة إلى لوحة التحكم</Button>
          </Link>
        </div>
      </div>
    );
  }

  const toggleRole = (role: RecipientRole) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  };

  const addLink = () => setLinks([...links, ""]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) => setLinks(links.map((l, idx) => (idx === i ? val : l)));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("نوع الملف غير مدعوم");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("الحد الأقصى لحجم الملف هو 20 ميجابايت");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadingFile(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadFile.mutateAsync({ filename: file.name, base64 });
      setAttachedFiles((prev) => [...prev, { name: result.name, url: result.url }]);
    } catch {
      toast.error("فشل رفع الملف");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachedFile = (i: number) => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("يرجى كتابة عنوان الرسالة ونصها");
      return;
    }
    if (recipientMode === "roles" && selectedRoles.length === 0) {
      toast.error("يرجى تحديد صلاحية واحدة على الأقل");
      return;
    }
    if (recipientMode === "specific" && selectedUserIds.length === 0) {
      toast.error("يرجى اختيار عضو واحد على الأقل");
      return;
    }
    if (recipientCount < 1) {
      toast.error("يجب أن يكون هناك مستلم واحد على الأقل");
      return;
    }

    const validLinks = links.map((l) => l.trim()).filter(Boolean);

    sendBroadcast.mutate({
      subject: subject.trim(),
      message: message.trim(),
      recipientMode,
      roles: recipientMode === "roles" ? selectedRoles : undefined,
      userIds: recipientMode === "specific" ? selectedUserIds : undefined,
      links: validLinks.length > 0 ? validLinks : undefined,
      files: attachedFiles.length > 0 ? attachedFiles : undefined,
    });
  };

  const isPending = sendBroadcast.isPending;

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">بريد جماعي</h1>
            </div>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 mr-1">
            <ShieldCheck className="w-4 h-4" />
            هذه الصفحة مقصورة على المسؤول والمدير التقني
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background">
        <div className="container max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
            {/* ── محتوى الرسالة ── */}
            <Card className="p-6 md:p-8 space-y-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-accent" /> محتوى الرسالة
              </h2>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  عنوان الرسالة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClass}
                  placeholder="مثال: إعلان هام بخصوص فعاليات النادي"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نص الرسالة <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className={inputClass}
                  placeholder="اكتب رسالتك هنا... يمكنك الفصل بين الفقرات بسطر فارغ"
                />
              </div>
            </Card>

            {/* ── روابط وملفات (اختياري) ── */}
            <Card className="p-6 md:p-8 space-y-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-accent" /> إضافات اختيارية
              </h2>

              {/* روابط */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> روابط مرفقة{" "}
                  <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
                </label>
                <div className="space-y-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(i, e.target.value)}
                        className={`flex-1 ${inputClass}`}
                        placeholder="https://..."
                        dir="ltr"
                      />
                      <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => removeLink(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLink} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> إضافة رابط
                  </Button>
                </div>
              </div>

              {/* ملفات */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> ملفات مرفقة{" "}
                  <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
                </label>
                <div className="space-y-2">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/30">
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <Button type="button" variant="outline" size="sm" className="text-red-500" onClick={() => removeAttachedFile(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent transition-colors"
                    onClick={() => !uploadingFile && fileInputRef.current?.click()}
                  >
                    {uploadingFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> جاري رفع الملف...
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">انقر لإرفاق ملف (صورة، PDF، Word، Excel، PowerPoint، ZIP، نص)</p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_FILE_TYPES.join(",")}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </Card>

            {/* ── المستلمون ── */}
            <Card className="p-6 md:p-8 space-y-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" /> المستلمون
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setRecipientMode("all")}
                  className={`p-4 rounded-lg border text-right transition-colors ${
                    recipientMode === "all" ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  }`}
                >
                  <p className="font-medium text-foreground">الجميع</p>
                  <p className="text-xs text-muted-foreground mt-1">كل الأعضاء المقبولين ولديهم بريد إلكتروني</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("roles")}
                  className={`p-4 rounded-lg border text-right transition-colors ${
                    recipientMode === "roles" ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  }`}
                >
                  <p className="font-medium text-foreground">حسب الصلاحية</p>
                  <p className="text-xs text-muted-foreground mt-1">اختر صلاحية أو أكثر</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("specific")}
                  className={`p-4 rounded-lg border text-right transition-colors ${
                    recipientMode === "specific" ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  }`}
                >
                  <p className="font-medium text-foreground">أفراد محددون</p>
                  <p className="text-xs text-muted-foreground mt-1">اختر أعضاء بعينهم</p>
                </button>
              </div>

              {recipientMode === "roles" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {roleOptions.map((r) => {
                    const active = selectedRoles.includes(r.value);
                    return (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => toggleRole(r.value)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "border-border text-foreground hover:border-accent/50"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {recipientMode === "specific" && (
                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className={inputClass}
                    placeholder="ابحث بالاسم أو البريد أو الرقم المرجعي..."
                  />
                  {selectedUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedUserIds.map((id) => {
                        const member = eligibleRecipients.find((r) => r.id === id);
                        if (!member) return null;
                        return (
                          <Badge key={id} className="bg-accent/15 text-accent-foreground/80 flex items-center gap-1 pr-1">
                            {member.name}
                            <button type="button" onClick={() => toggleUser(id)} className="hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {loadingRecipients ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">جاري تحميل الأعضاء...</p>
                    ) : filteredMembers.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">لا يوجد نتائج</p>
                    ) : (
                      filteredMembers.map((m) => {
                        const checked = selectedUserIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer"
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleUser(m.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                              <p className="text-xs text-muted-foreground truncate" dir="ltr">
                                {m.email}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {roleLabels[m.role] || m.role}
                            </Badge>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-accent" />
                <span className="text-foreground font-medium">{recipientCount}</span>
                <span className="text-muted-foreground">
                  مستلم سيصلهم هذا البريد
                  {recipientCount < 1 && <span className="text-red-500"> — يجب اختيار مستلم واحد على الأقل</span>}
                </span>
              </div>
            </Card>

            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2"
                disabled={isPending || uploadingFile || recipientCount < 1}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> إرسال الرسالة
                  </>
                )}
              </Button>
              <Link href="/admin">
                <Button variant="outline" className="flex-1">
                  إلغاء
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
