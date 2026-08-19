import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Bell, Link as LinkIcon, Loader2, Paperclip, Plus, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { isAdminTierRole } from "@shared/clubRoles";

type RecipientMode = "all" | "roles" | "specific";
type AttachedFile = { name: string; url: string; key?: string };

const roles = [
  { value: "user", label: "عضو" },
  { value: "supervisor", label: "مشرف السوشيال ميديا" },
  { value: "committee_head", label: "مشرف فريق" },
  { value: "secretary", label: "أمين السر" },
  { value: "treasurer", label: "أمين الصندوق" },
  { value: "public_relations_officer", label: "مسؤول العلاقات العامة" },
  { value: "vice_president", label: "نائب رئيس النادي" },
  { value: "club_president", label: "رئيس النادي" },
  { value: "admin", label: "المسؤول" },
  { value: "tech_admin", label: "المدير التقني" },
];
const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain"];
const inputClass = "w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

export default function AdminNotificationCenter() {
  const { user, loading } = useAuth();
  const canSend = isAdminTierRole(user?.role);
  const { data: recipients = [] } = trpc.notificationCenter.listRecipients.useQuery(undefined, { enabled: canSend });
  const upload = trpc.broadcastEmail.uploadFile.useMutation();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<RecipientMode>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = trpc.notificationCenter.send.useMutation({
    onSuccess: (result) => {
      toast.success(`تم إنشاء الإشعار لـ ${result.recipientCount} مستلم، وقبلت خدمة التنبيهات إرساله إلى ${result.pushDelivered} جهاز.`);
      setTitle(""); setBody(""); setLinks([]); setFiles([]); setMode("all"); setSelectedRoles([]); setSelectedUserIds([]);
      utils.notifications.list.invalidate();
      utils.notifications.countUnread.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const recipientCount = useMemo(() => {
    if (mode === "all") return recipients.length;
    if (mode === "roles") return recipients.filter((member) => selectedRoles.includes(member.role)).length;
    return recipients.filter((member) => selectedUserIds.includes(member.id)).length;
  }, [mode, recipients, selectedRoles, selectedUserIds]);
  const shownRecipients = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return recipients.slice(0, 60);
    return recipients.filter((member) => `${member.name} ${member.referenceNumber || ""}`.toLowerCase().includes(query)).slice(0, 60);
  }, [memberSearch, recipients]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-accent" /></div>;
  if (!canSend) return <div className="min-h-screen bg-background flex items-center justify-center"><Card className="p-8 text-center max-w-md"><h1 className="text-xl font-bold mb-3">غير مصرح لك بالوصول إلى هذه الصفحة</h1><p className="text-muted-foreground mb-5">مركز الإشعارات مقصور على المسؤول والمدير التقني فقط.</p><Link href="/admin"><Button>العودة إلى لوحة التحكم</Button></Link></Card></div>;

  const addLink = () => setLinks((current) => [...current, ""]);
  const updateLink = (index: number, value: string) => setLinks((current) => current.map((link, i) => i === index ? value : link));
  const toggleRole = (role: string) => setSelectedRoles((current) => current.includes(role) ? current.filter((value) => value !== role) : [...current, role]);
  const toggleUser = (id: number) => setSelectedUserIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type) || file.size > 20 * 1024 * 1024) { toast.error("اختر ملفًا مدعومًا بحجم لا يتجاوز 20 ميجابايت"); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await upload.mutateAsync({ filename: file.name, base64 });
      setFiles((current) => [...current, { name: result.name, url: result.url, key: result.key }]);
    } catch { toast.error("فشل رفع الملف"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("يرجى كتابة العنوان والنص");
    if (mode === "roles" && selectedRoles.length === 0) return toast.error("اختر صلاحية واحدة على الأقل");
    if (mode === "specific" && selectedUserIds.length === 0) return toast.error("اختر عضوًا واحدًا على الأقل");
    send.mutate({ title: title.trim(), body: body.trim(), recipientMode: mode, roles: mode === "roles" ? selectedRoles as any : undefined, userIds: mode === "specific" ? selectedUserIds : undefined, links: links.map((link) => link.trim()).filter(Boolean), files });
  };

  return <div className="min-h-screen bg-background" dir="rtl">
    <section className="bg-gradient-to-b from-accent/10 to-background py-12"><div className="container"><div className="flex items-center gap-4 mb-3"><Link href="/admin"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link><div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center"><Bell className="w-5 h-5 text-accent" /></div><h1 className="text-3xl font-bold">مركز الإشعارات</h1></div><p className="text-muted-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4" />صلاحية الإرسال مقصورة على المسؤول والمدير التقني، وتصل نسخة إلى المرسل.</p></div></section>
    <main className="container max-w-3xl py-10"><form onSubmit={submit} className="space-y-6">
      <Card className="p-6 space-y-4"><h2 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-accent" />محتوى الإشعار</h2><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="عنوان الإشعار" /><textarea className={inputClass} value={body} onChange={(event) => setBody(event.target.value)} rows={7} maxLength={5000} placeholder="اكتب التفاصيل التي سيقرأها المستخدم داخل الموقع أو التطبيق" /></Card>
      <Card className="p-6 space-y-4"><h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-accent" />المستلمون <span className="text-sm font-normal text-muted-foreground">({recipientCount} مطابق + حسابك)</span></h2><div className="flex flex-wrap gap-3 text-sm"><label><input className="ml-1" type="radio" checked={mode === "all"} onChange={() => setMode("all")} />الجميع</label><label><input className="ml-1" type="radio" checked={mode === "roles"} onChange={() => setMode("roles")} />حسب الصلاحية</label><label><input className="ml-1" type="radio" checked={mode === "specific"} onChange={() => setMode("specific")} />أعضاء محددون</label></div>{mode === "roles" && <div className="grid grid-cols-2 gap-3">{roles.map((role) => <label key={role.value} className="flex items-center gap-2 text-sm"><Checkbox checked={selectedRoles.includes(role.value)} onCheckedChange={() => toggleRole(role.value)} />{role.label}</label>)}</div>}{mode === "specific" && <div className="space-y-3"><input className={inputClass} value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="ابحث بالاسم أو الرقم المرجعي" /><div className="max-h-60 overflow-y-auto border rounded-lg divide-y">{shownRecipients.map((member) => <label key={member.id} className="p-3 flex gap-3 items-center cursor-pointer"><Checkbox checked={selectedUserIds.includes(member.id)} onCheckedChange={() => toggleUser(member.id)} /><span>{member.name}<small className="block text-muted-foreground">{member.referenceNumber || member.role}</small></span></label>)}</div></div>}</Card>
      <Card className="p-6 space-y-4"><h2 className="font-bold flex items-center gap-2"><LinkIcon className="w-4 h-4 text-accent" />روابط وملفات اختيارية</h2>{links.map((link, index) => <div key={index} className="flex gap-2"><input className={inputClass} value={link} onChange={(event) => updateLink(index, event.target.value)} placeholder="https://example.com" type="url" /><Button type="button" variant="outline" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button></div>)}<Button type="button" variant="outline" onClick={addLink}><Plus className="w-4 h-4 ml-2" />إضافة رابط</Button><div className="border-t pt-4"><input ref={fileRef} className="hidden" type="file" onChange={handleFile} /><Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Paperclip className="w-4 h-4 ml-2" />}إرفاق ملف</Button>{files.map((file, index) => <div key={`${file.url}-${index}`} className="mt-2 flex items-center justify-between text-sm bg-muted/40 p-2 rounded"><span>{file.name}</span><button type="button" className="text-red-600" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>إزالة</button></div>)}</div></Card>
      <Button type="submit" className="w-full" disabled={send.isPending || uploading}>{send.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}إرسال الإشعار</Button>
    </form></main>
  </div>;
}
