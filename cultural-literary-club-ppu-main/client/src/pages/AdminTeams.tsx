import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Users, Crown, Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminTeams() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headReferenceNumber, setHeadReferenceNumber] = useState("");

  const isAdminTier = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin";

  const { data: teams, isLoading } = trpc.teams.listAdmin.useQuery(undefined, {
    enabled: isAdminTier,
  });

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الفريق");
      setCreateOpen(false);
      setName("");
      setDescription("");
      setHeadReferenceNumber("");
      utils.teams.listAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر إنشاء الفريق"),
  });

  const deleteTeam = trpc.teams.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفريق");
      utils.teams.listAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر حذف الفريق"),
  });

  const setHeadFreedom = trpc.teams.setHeadFreedom.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      utils.teams.listAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const setHead = trpc.teams.setHead.useMutation({
    onSuccess: () => {
      toast.success("تم تعيين مشرف الفريق");
      setHeadDialogTeamId(null);
      setHeadDialogRef("");
      utils.teams.listAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر تعيين المشرف"),
  });
  const [headDialogTeamId, setHeadDialogTeamId] = useState<number | null>(null);
  const [headDialogRef, setHeadDialogRef] = useState("");

  if (!user) return null;

  if (!isAdminTier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-lg text-muted-foreground">غير مصرح لك بالوصول إلى هذه الصفحة</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">إدارة الفرق</h1>
            <p className="text-muted-foreground">إنشاء الفرق، تعيين المشرفين، ومتابعة الطلبات المعلّقة</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                <Plus className="w-4 h-4" />
                فريق جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء فريق جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">اسم الفريق</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: فريق المناظرات" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الوصف</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">مشرف الفريق (اختياري)</label>
                  <Input
                    value={headReferenceNumber}
                    onChange={(e) => setHeadReferenceNumber(e.target.value)}
                    placeholder="الرقم المرجعي، مثال: 260001"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    إن لم تحدد رقماً مرجعياً، ستكون أنت مشرف الفريق افتراضياً
                  </p>
                </div>
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={!name.trim() || createTeam.isPending}
                  onClick={() =>
                    createTeam.mutate({
                      name: name.trim(),
                      description: description.trim() || undefined,
                      headReferenceNumber: headReferenceNumber.trim() || undefined,
                    })
                  }
                >
                  إنشاء الفريق
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="py-10">
        <div className="container space-y-4">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : !teams || teams.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">لا توجد فرق بعد</Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id} className="p-5 flex flex-wrap items-center gap-4 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-foreground">{team.name}</h3>
                    <Badge variant="outline" className="gap-1">
                      <Crown className="w-3 h-3" />
                      {team.headName}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="w-3 h-3" />
                      {team.memberCount}
                    </Badge>
                    {!team.isVisible && <Badge variant="outline">غير مرئي</Badge>}
                    {team.headFreedom && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                        حرية كاملة
                      </Badge>
                    )}
                    {(team.pendingJoinCount > 0 || team.pendingActionCount > 0) && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                        {team.pendingJoinCount + team.pendingActionCount} طلب بانتظار المراجعة
                      </Badge>
                    )}
                  </div>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{team.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHeadFreedom.mutate({ id: team.id, headFreedom: !team.headFreedom })}
                  >
                    {team.headFreedom ? "سحب الحرية" : "منح الحرية"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setHeadDialogTeamId(team.id);
                      setHeadDialogRef("");
                    }}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    تعيين مشرف
                  </Button>
                  <Link href={`/teams/${team.id}`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Settings2 className="w-3.5 h-3.5" />
                      إدارة
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف فريق "${team.name}"؟`)) {
                        deleteTeam.mutate(team.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <Dialog open={headDialogTeamId != null} onOpenChange={(open) => !open && setHeadDialogTeamId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين مشرف الفريق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">الرقم المرجعي للعضو</label>
              <Input
                value={headDialogRef}
                onChange={(e) => setHeadDialogRef(e.target.value)}
                placeholder="مثال: 260001"
                maxLength={6}
              />
            </div>
            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!headDialogRef.trim() || setHead.isPending}
              onClick={() => {
                if (headDialogTeamId != null) {
                  setHead.mutate({ teamId: headDialogTeamId, referenceNumber: headDialogRef.trim() });
                }
              }}
            >
              تعيين
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
