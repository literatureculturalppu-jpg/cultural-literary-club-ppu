import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Plus, Users, Trash2, Edit, Eye, Upload, Loader2 } from "lucide-react";

export default function AdminWorkTeams() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);

  const { data: teams, refetch } = trpc.workTeams.list.useQuery();
  const createTeamMutation = trpc.workTeams.create.useMutation();
  const updateTeamMutation = trpc.workTeams.update.useMutation();
  const deleteTeamMutation = trpc.workTeams.delete.useMutation();

  const [teamForm, setTeamForm] = useState({
    name: "",
    mission: "",
    imageUrl: "",
    order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin")) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-muted-foreground">تحتاج إلى صلاحيات الإدارة للوصول إلى هذه الصفحة</p>
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
          setTeamForm((p) => ({ ...p, imageUrl: data.url }));
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

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = {
        name: teamForm.name,
        order: teamForm.order,
      };
      if (teamForm.mission) data.mission = teamForm.mission;
      if (teamForm.imageUrl) data.imageUrl = teamForm.imageUrl;

      if (editingTeamId) {
        await updateTeamMutation.mutateAsync({ id: editingTeamId, ...data });
        toast.success("تم تحديث الفريق بنجاح");
      } else {
        await createTeamMutation.mutateAsync(data);
        toast.success("تم إنشاء فريق جديد بنجاح");
      }
      setTeamForm({ name: "", mission: "", imageUrl: "", order: 0 });
      setIsAddingTeam(false);
      setEditingTeamId(null);
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء العملية");
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الفريق وجميع أعضائه؟")) return;
    try {
      await deleteTeamMutation.mutateAsync(id);
      toast.success("تم حذف الفريق بنجاح");
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const handleEditTeam = (team: any) => {
    setTeamForm({
      name: team.name,
      mission: team.mission || "",
      imageUrl: team.imageUrl || "",
      order: team.order || 0,
    });
    setEditingTeamId(team.id);
    setIsAddingTeam(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            إدارة فرق العمل
          </h1>
          <p className="text-lg text-muted-foreground">
            إنشاء وإدارة فرق العمل وأعضائها
          </p>
        </div>
      </section>

      <section className="py-8 bg-background">
        <div className="container space-y-6">
          <Button
            onClick={() => {
              setIsAddingTeam(!isAddingTeam);
              if (isAddingTeam) {
                setEditingTeamId(null);
                setTeamForm({ name: "", mission: "", imageUrl: "", order: 0 });
              }
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="w-4 h-4 ml-2" />
            {isAddingTeam ? "إلغاء" : "إضافة فريق جديد"}
          </Button>

          {isAddingTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="text-right">
                  {editingTeamId ? "تعديل الفريق" : "إضافة فريق جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTeamSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="team-name" className="text-right block mb-2">
                      اسم الفريق *
                    </Label>
                    <Input
                      id="team-name"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))}
                      className="text-right"
                      dir="rtl"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="team-mission" className="text-right block mb-2">
                      مهمة الفريق
                    </Label>
                    <textarea
                      id="team-mission"
                      value={teamForm.mission}
                      onChange={(e) => setTeamForm((p) => ({ ...p, mission: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-right bg-background text-foreground"
                      dir="rtl"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-right block mb-2">
                      صورة الفريق
                    </Label>
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
                      {teamForm.imageUrl && (
                        <div className="flex items-center gap-2">
                          <img 
                            src={teamForm.imageUrl}
                            alt="معاينة"
                            className="w-12 h-12 rounded object-cover border" loading="lazy" decoding="async" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setTeamForm((p) => ({ ...p, imageUrl: "" }))}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="team-order" className="text-right block mb-2">
                      الترتيب
                    </Label>
                    <Input
                      id="team-order"
                      type="number"
                      value={teamForm.order}
                      onChange={(e) => setTeamForm((p) => ({ ...p, order: Number(e.target.value) }))}
                      className="text-right"
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={createTeamMutation.isPending || updateTeamMutation.isPending}
                    >
                      {editingTeamId ? "تحديث" : "إنشاء"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingTeam(false);
                        setEditingTeamId(null);
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Teams List */}
          <div className="grid gap-4">
            {teams && teams.length > 0 ? (
              teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {team.imageUrl && (
                          <img 
                            src={team.imageUrl}
                            alt={team.name}
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0" loading="lazy" decoding="async" />
                        )}
                        <div className="flex-1 text-right">
                          <h3 className="font-bold text-lg text-foreground">{team.name}</h3>
                          {team.mission && (
                            <p className="text-muted-foreground text-sm mt-1">{team.mission}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link href={`/admin/work-teams/${team.id}/members`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Users className="w-4 h-4" />
                            الأعضاء
                          </Button>
                        </Link>
                        <Button
                          onClick={() => handleEditTeam(team)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteTeam(team.id)}
                          variant="destructive"
                          size="sm"
                          disabled={deleteTeamMutation.isPending}
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
                  لا توجد فرق عمل حالياً
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
