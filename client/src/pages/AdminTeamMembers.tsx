import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Trash2, Edit, ArrowRight, Upload, Loader2, Shield } from "lucide-react";
import { Link } from "wouter";

// إدارة "الهيئة الإدارية" — الأعضاء الإداريون الظاهرون في صفحة عن النادي
// (رئيس النادي، نائب الرئيس، المدير التقني، ...) بمعلوماتهم وصورهم.
export default function AdminTeamMembers() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: members, refetch } = trpc.teamMembers.list.useQuery();
  const createMutation = trpc.teamMembers.create.useMutation();
  const updateMutation = trpc.teamMembers.update.useMutation();
  const deleteMutation = trpc.teamMembers.delete.useMutation();
  const uploadImage = trpc.upload.image.useMutation();

  const [form, setForm] = useState({
    name: "",
    position: "",
    bio: "",
    email: "",
    phone: "",
    imageUrl: "",
    order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminTier = user?.role === "admin" || user?.role === "club_president" || user?.role === "vice_president" || user?.role === "public_relations_officer" || user?.role === "general_agent" || user?.role === "tech_admin";
  if (!user || !isAdminTier) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-muted-foreground">تحتاج إلى صلاحيات الإدارة</p>
      </div>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة فقط");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const result = await uploadImage.mutateAsync({
            filename: file.name,
            base64,
          });
          setForm((p) => ({ ...p, imageUrl: result.url }));
          toast.success("تم تحميل الصورة بنجاح");
        } catch (error: any) {
          toast.error("فشل تحميل الصورة");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error("فشل قراءة الملف");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("فشل تحميل الصورة");
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setForm({ name: "", position: "", bio: "", email: "", phone: "", imageUrl: "", order: 0 });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.position) {
      toast.error("يرجى إدخال الاسم والمنصب على الأقل");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success("تم تحديث بيانات العضو");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("تمت إضافة العضو بنجاح");
      }
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error("حدث خطأ: " + (error?.message || "غير معروف"));
    }
  };

  const handleEdit = (member: any) => {
    setForm({
      name: member.name || "",
      position: member.position || "",
      bio: member.bio || "",
      email: member.email || "",
      phone: member.phone || "",
      imageUrl: member.imageUrl || "",
      order: member.order || 0,
    });
    setEditingId(member.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: number, isFounder: boolean) => {
    if (isFounder && !confirm("هذا العضو من الهيئة المؤسِّسة للنادي. هل تريد حذفه فعلاً؟")) return;
    if (!isFounder && !confirm("هل أنت متأكد من حذف هذا العضو؟")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم حذف العضو بنجاح");
      refetch();
    } catch (error: any) {
      toast.error("حدث خطأ أثناء الحذف: " + (error?.message || ""));
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <Link href="/admin">
            <Button variant="ghost" className="mb-4 gap-2">
              <ArrowRight className="w-4 h-4" />
              العودة للوحة التحكم
            </Button>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">الهيئة الإدارية</h1>
          <p className="text-lg text-muted-foreground">
            إدارة الأعضاء الإداريين الظاهرين في صفحة "عن النادي" (الاسم، المنصب، نبذة، وصورة)
          </p>
        </div>
      </section>

      <section className="py-8 bg-background">
        <div className="container space-y-6">
          <Button
            onClick={() => (isAdding ? resetForm() : setIsAdding(true))}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="w-4 h-4 ml-2" />
            {isAdding ? "إلغاء" : "إضافة عضو إداري جديد"}
          </Button>

          {isAdding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-right">{editingId ? "تعديل بيانات العضو" : "إضافة عضو إداري جديد"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-right block mb-2">الاسم *</Label>
                      <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="text-right" dir="rtl" required />
                    </div>
                    <div>
                      <Label className="text-right block mb-2">المنصب *</Label>
                      <Input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} className="text-right" dir="rtl" placeholder="مثال: رئيس النادي، نائب الرئيس" required />
                    </div>
                    <div>
                      <Label className="text-right block mb-2">البريد الإلكتروني</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="text-right" dir="ltr" />
                    </div>
                    <div>
                      <Label className="text-right block mb-2">رقم الهاتف</Label>
                      <Input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="text-right" dir="ltr" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-right block mb-2">نبذة بسيطة</Label>
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-right bg-background text-foreground"
                      dir="rtl"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-right block mb-2">صورة العضو</Label>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploading ? "جاري التحميل..." : "اختر صورة"}
                        </Button>
                        {form.imageUrl && (
                          <div className="flex items-center gap-2">
                            <img src={form.imageUrl} alt="معاينة" className="w-12 h-12 rounded-full object-cover border" loading="lazy" decoding="async" />
                            <Button type="button" variant="ghost" size="sm" onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))} className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-right block mb-2">ترتيب الظهور</Label>
                      <Input type="number" value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))} className="text-right" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingId ? "تحديث" : "إضافة"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {members && members.length > 0 ? (
              members.map((member: any) => (
                <Card key={member.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {member.imageUrl ? (
                          <img src={member.imageUrl} alt={member.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-6 h-6 text-accent" />
                          </div>
                        )}
                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg text-foreground">{member.name}</h3>
                            {member.isFounder && (
                              <Badge className="bg-accent/10 text-accent border border-accent/20">من الهيئة المؤسِّسة</Badge>
                            )}
                          </div>
                          <p className="text-accent text-sm">{member.position}</p>
                          {member.bio && <p className="text-muted-foreground text-sm mt-1">{member.bio}</p>}
                          {(member.email || member.phone) && (
                            <p className="text-muted-foreground text-xs mt-1" dir="ltr">
                              {[member.email, member.phone].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button onClick={() => handleEdit(member)} variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
                        <Button onClick={() => handleDelete(member.id, member.isFounder)} variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">لا يوجد أعضاء في الهيئة الإدارية حالياً</CardContent></Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
