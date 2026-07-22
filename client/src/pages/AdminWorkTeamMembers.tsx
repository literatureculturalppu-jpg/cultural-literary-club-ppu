import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams } from "wouter";
import { Plus, Trash2, Edit, ArrowRight, Upload, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminWorkTeamMembers() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const params = useParams<{ teamId: string }>();
  const teamId = Number(params.teamId);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: team } = trpc.workTeams.getById.useQuery(teamId);
  const { data: members, refetch } = trpc.workTeams.getMembers.useQuery(teamId);
  const addMemberMutation = trpc.workTeams.addMember.useMutation();
  const updateMemberMutation = trpc.workTeams.updateMember.useMutation();
  const removeMemberMutation = trpc.workTeams.removeMember.useMutation();

  const [form, setForm] = useState({
    name: "",
    position: "",
    bio: "",
    imageUrl: "",
    order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin")) {
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
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, filename: file.name }),
        });
        const data = await response.json();
        if (data.url) {
          setForm((p) => ({ ...p, imageUrl: data.url }));
          toast.success("تم تحميل الصورة بنجاح");
        } else {
          toast.error("فشل تحميل الصورة");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("فشل تحميل الصورة");
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const data: any = { id: editingId };
        if (form.name) data.name = form.name;
        if (form.position) data.position = form.position;
        if (form.bio) data.bio = form.bio;
        if (form.imageUrl) data.imageUrl = form.imageUrl;
        data.order = form.order;
        await updateMemberMutation.mutateAsync(data);
        toast.success("تم تحديث العضو بنجاح");
      } else {
        const data: any = {
          teamId,
          name: form.name,
          position: form.position,
          order: form.order,
        };
        if (form.bio) data.bio = form.bio;
        if (form.imageUrl) data.imageUrl = form.imageUrl;
        await addMemberMutation.mutateAsync(data);
        toast.success("تم إضافة العضو بنجاح");
      }
      setForm({ name: "", position: "", bio: "", imageUrl: "", order: 0 });
      setIsAdding(false);
      setEditingId(null);
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء العملية");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا العضو؟")) return;
    try {
      await removeMemberMutation.mutateAsync(id);
      toast.success("تم حذف العضو بنجاح");
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const handleEdit = (member: any) => {
    setForm({
      name: member.name,
      position: member.position,
      bio: member.bio || "",
      imageUrl: member.imageUrl || "",
      order: member.order || 0,
    });
    setEditingId(member.id);
    setIsAdding(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <Link href="/admin/work-teams">
            <Button variant="ghost" className="mb-4 gap-2">
              <ArrowRight className="w-4 h-4" />
              العودة لقائمة الفرق
            </Button>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            أعضاء فريق: {team?.name || "..."}
          </h1>
          {team?.mission && (
            <p className="text-lg text-muted-foreground">{team.mission}</p>
          )}
        </div>
      </section>

      <section className="py-8 bg-background">
        <div className="container space-y-6">
          <Button
            onClick={() => {
              setIsAdding(!isAdding);
              if (isAdding) {
                setEditingId(null);
                setForm({ name: "", position: "", bio: "", imageUrl: "", order: 0 });
              }
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="w-4 h-4 ml-2" />
            {isAdding ? "إلغاء" : "إضافة عضو جديد"}
          </Button>

          {isAdding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-right">
                  {editingId ? "تعديل العضو" : "إضافة عضو جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-right block mb-2">الاسم *</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="text-right"
                        dir="rtl"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-right block mb-2">المنصب / المهمة *</Label>
                      <Input
                        value={form.position}
                        onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                        className="text-right"
                        dir="rtl"
                        required
                      />
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
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="gap-2"
                        >
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          {uploading ? "جاري التحميل..." : "اختر صورة"}
                        </Button>
                        {form.imageUrl && (
                          <div className="flex items-center gap-2">
                            <img 
                              src={form.imageUrl}
                              alt="معاينة"
                              className="w-12 h-12 rounded-full object-cover border" loading="lazy" decoding="async" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-right block mb-2">الترتيب</Label>
                      <Input
                        type="number"
                        value={form.order}
                        onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))}
                        className="text-right"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={addMemberMutation.isPending || updateMemberMutation.isPending}
                    >
                      {editingId ? "تحديث" : "إضافة"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsAdding(false); setEditingId(null); }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Members List */}
          <div className="grid gap-4">
            {members && members.length > 0 ? (
              members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {member.imageUrl && (
                          <img 
                            src={member.imageUrl}
                            alt={member.name}
                            className="w-16 h-16 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
                        )}
                        <div className="flex-1 text-right">
                          <h3 className="font-bold text-lg text-foreground">{member.name}</h3>
                          <p className="text-accent text-sm">{member.position}</p>
                          {member.bio && (
                            <p className="text-muted-foreground text-sm mt-1">{member.bio}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleEdit(member)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(member.id)}
                          variant="destructive"
                          size="sm"
                          disabled={removeMemberMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  لا يوجد أعضاء في هذا الفريق حالياً
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
