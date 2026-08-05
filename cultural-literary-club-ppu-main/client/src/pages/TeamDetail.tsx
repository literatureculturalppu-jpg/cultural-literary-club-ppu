import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  MessageCircle,
  Settings,
  Crown,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Lock,
  Unlock,
  Clock,
  ArrowRight,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import TeamChat from "@/components/TeamChat";

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const teamId = Number(params.id);
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();

  const { data: team, isLoading, error } = trpc.teams.getOne.useQuery(teamId, {
    enabled: !!user && !Number.isNaN(teamId),
    retry: false,
  });

  const requestJoin = trpc.teamJoinRequests.create.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب الانضمام، بانتظار الموافقة");
      utils.teams.getOne.invalidate(teamId);
    },
    onError: (e) => toast.error(e.message || "تعذر إرسال الطلب"),
  });

  if (!user || isLoading) {
    return (
      <div className="container py-16" dir="rtl">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <Card className="p-12 max-w-lg mx-auto">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">هذا الفريق غير متاح</h2>
          <p className="text-muted-foreground mb-6">
            قد يكون هذا الفريق غير مرئي، أو لا يمكنك الوصول إليه حالياً.
          </p>
          <Link href="/teams">
            <Button variant="outline">العودة إلى الفرق</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isAdminTier = user.role === "admin" || user.role === "general_agent" || user.role === "tech_admin";
  const canManage = team.isHead || isAdminTier;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container">
          <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent mb-4">
            <ArrowRight className="w-4 h-4" />
            الفرق
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{team.name}</h1>
            {team.isHead && (
              <Badge className="bg-accent/15 text-accent border border-accent/30 gap-1">
                <Crown className="w-3 h-3" />
                مشرف الفريق
              </Badge>
            )}
            {isAdminTier && (
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="w-3 h-3" />
                عضو تلقائي بصلاحية المسؤول
              </Badge>
            )}
          </div>
          {team.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{team.description}</p>
          )}
        </div>
      </section>

      <section className="py-10">
        <div className="container">
          {!team.isMember ? (
            <Card className="p-10 text-center max-w-lg mx-auto">
              <Users className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">لست عضواً في هذا الفريق بعد</h3>
              <p className="text-muted-foreground mb-6">
                يمكنك تقديم طلب انضمام وسيتم إعلامك عند الموافقة عليه.
              </p>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={requestJoin.isPending}
                onClick={() => requestJoin.mutate({ teamId })}
              >
                طلب الانضمام
              </Button>
            </Card>
          ) : (
            <Tabs defaultValue="chat" dir="rtl">
              <TabsList>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  الدردشة
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-2">
                  <Users className="w-4 h-4" />
                  الأعضاء
                </TabsTrigger>
                {canManage && (
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="w-4 h-4" />
                    الإعدادات
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="chat" className="mt-6">
                <TeamChat teamId={teamId} currentUserId={user.id} canManageChat={canManage} />
              </TabsContent>

              <TabsContent value="members" className="mt-6">
                <RosterTab teamId={teamId} canManage={canManage} />
              </TabsContent>

              {canManage && (
                <TabsContent value="settings" className="mt-6">
                  <SettingsTab team={team} teamId={teamId} isAdminTier={isAdminTier} />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </section>
    </div>
  );
}

function RosterTab({ teamId, canManage }: { teamId: number; canManage: boolean }) {
  const namesQuery = trpc.teams.getRoster.useQuery(teamId, { enabled: !canManage });
  const fullQuery = trpc.teams.getMembersFull.useQuery(teamId, { enabled: canManage });

  const roster = canManage ? fullQuery.data : namesQuery.data;
  const isLoading = canManage ? fullQuery.isLoading : namesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {roster?.map((m: any) => (
        <Card key={m.id} className="p-4 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={m.profileImage ?? undefined} />
            <AvatarFallback>{m.name?.charAt(0) ?? "؟"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{m.name}</p>
            {canManage && m.email && (
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            )}
            {canManage && (m.phoneNumber || m.college) && (
              <p className="text-xs text-muted-foreground truncate">
                {[m.college, m.phoneNumber].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {m.isAdmin && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              مسؤول
            </Badge>
          )}
        </Card>
      ))}
    </div>
  );
}

function SettingsTab({ team, teamId, isAdminTier }: { team: any; teamId: number; isAdminTier: boolean }) {
  const utils = trpc.useUtils();
  const [refNumber, setRefNumber] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState("");

  const membersFull = trpc.teams.getMembersFull.useQuery(teamId);
  const myRequests = trpc.teamActionRequests.getByTeam.useQuery({ teamId });
  const pendingJoinRequests = trpc.teamJoinRequests.getByTeam.useQuery({ teamId, status: "pending" });
  const inviteLinks = trpc.teams.listInviteLinks.useQuery(teamId);

  const invalidateAll = () => {
    utils.teams.getOne.invalidate(teamId);
    utils.teams.getMembersFull.invalidate(teamId);
    utils.teams.getRoster.invalidate(teamId);
    utils.teamActionRequests.getByTeam.invalidate({ teamId });
    utils.teamJoinRequests.getByTeam.invalidate({ teamId });
    utils.teams.listInviteLinks.invalidate(teamId);
  };

  const addMember = trpc.teams.addMember.useMutation({
    onSuccess: (res) => {
      toast.success(res.pending ? "أُرسل طلب الإضافة إلى المسؤول للموافقة" : "تمت إضافة العضو");
      setRefNumber("");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const removeMember = trpc.teams.removeMember.useMutation({
    onSuccess: (res) => {
      toast.success(res.pending ? "أُرسل طلب الإخراج إلى المسؤول للموافقة" : "تم إخراج العضو");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const setVisibility = trpc.teams.setVisibility.useMutation({
    onSuccess: (res) => {
      toast.success(res.pending ? "أُرسل طلب تغيير الظهور إلى المسؤول" : "تم تحديث حالة الظهور");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const setHeadFreedom = trpc.teams.setHeadFreedom.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث صلاحية مشرف الفريق");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const approveJoin = trpc.teamJoinRequests.approve.useMutation({
    onSuccess: () => {
      toast.success("تمت الموافقة");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });
  const rejectJoin = trpc.teamJoinRequests.reject.useMutation({
    onSuccess: () => {
      toast.success("تم الرفض");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إتمام الإجراء"),
  });

  const createInviteLink = trpc.teams.createInviteLink.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء رابط الدعوة");
      setInviteMaxUses("");
      setInviteExpiresInHours("");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إنشاء رابط الدعوة"),
  });
  const revokeInviteLink = trpc.teams.revokeInviteLink.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء رابط الدعوة");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message || "تعذر إلغاء الرابط"),
  });

  const actionLabels: Record<string, string> = {
    add_member: "إضافة عضو",
    remove_member: "إخراج عضو",
    set_visibility: "تغيير الظهور",
    set_chat_open: "تغيير حالة الدردشة",
  };
  const statusLabels: Record<string, string> = {
    pending: "بانتظار المسؤول",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
  };

  return (
    <div className="space-y-8">
      {!team.headFreedom && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <Clock className="w-4 h-4 shrink-0" />
          إجراءات مشرف الفريق (إضافة/إخراج أعضاء، الظهور، الدردشة) تحتاج موافقة المسؤول ما لم يُمنح صلاحية التصرف الحر.
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-foreground">إعدادات الظهور</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">إظهار الفريق لغير الأعضاء</p>
            <p className="text-xs text-muted-foreground">عند التفعيل، يظهر الفريق في صفحة "الفرق" للجميع</p>
          </div>
          <Switch
            checked={team.isVisible}
            onCheckedChange={(value) => setVisibility.mutate({ teamId, value })}
            disabled={setVisibility.isPending}
          />
        </div>
        {isAdminTier && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="text-sm font-medium">حرية التصرف لمشرف الفريق</p>
              <p className="text-xs text-muted-foreground">
                عند التفعيل، تُطبَّق إجراءات مشرف الفريق فوراً دون الحاجة لموافقتك
              </p>
            </div>
            <Switch
              checked={team.headFreedom}
              onCheckedChange={(value) => setHeadFreedom.mutate({ id: teamId, headFreedom: value })}
              disabled={setHeadFreedom.isPending}
            />
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          إضافة عضو بالرقم المرجعي
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="مثال: 260001"
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            maxLength={6}
          />
          <Button
            disabled={!refNumber.trim() || addMember.isPending}
            onClick={() => addMember.mutate({ teamId, referenceNumber: refNumber.trim() })}
          >
            إضافة
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          أدخل الرقم المرجعي الدائم للعضو (يظهر في الملف الشخصي الخاص به)
        </p>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          روابط دعوة الفريق
        </h3>
        <p className="text-xs text-muted-foreground">
          من يفتح الرابط يمكنه إرسال طلب انضمام مباشرة — الطلب يبقى بحاجة لموافقتك أو موافقة المسؤول كالمعتاد.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            type="number"
            min={1}
            placeholder="عدد الدعوات (اختياري)"
            value={inviteMaxUses}
            onChange={(e) => setInviteMaxUses(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            placeholder="صلاحية بالساعات (اختياري)"
            value={inviteExpiresInHours}
            onChange={(e) => setInviteExpiresInHours(e.target.value)}
          />
          <Button
            disabled={createInviteLink.isPending}
            onClick={() =>
              createInviteLink.mutate({
                teamId,
                maxUses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
                expiresAt: inviteExpiresInHours
                  ? new Date(Date.now() + Number(inviteExpiresInHours) * 3600 * 1000).toISOString()
                  : undefined,
              })
            }
          >
            إنشاء رابط
          </Button>
        </div>
        <div className="space-y-2">
          {inviteLinks.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد روابط دعوة بعد</p>
          )}
          {inviteLinks.data?.map((link) => {
            const url = `${window.location.origin}/teams/invite/${link.token}`;
            return (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{url}</p>
                  <p className="text-[11px] text-muted-foreground">
                    استُخدم {link.usedCount}
                    {link.maxUses != null ? ` / ${link.maxUses}` : ""}
                    {link.expiresAt ? ` · ينتهي ${new Date(link.expiresAt).toLocaleString("ar")}` : ""}
                    {" · "}
                    {link.revoked ? "أُلغي" : link.isUsable ? "فعّال" : "منتهي"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast.success("تم نسخ الرابط");
                    }}
                  >
                    نسخ
                  </Button>
                  {!link.revoked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      disabled={revokeInviteLink.isPending}
                      onClick={() => revokeInviteLink.mutate({ teamId, linkId: link.id })}
                    >
                      إلغاء
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h3 className="font-bold text-foreground">أعضاء الفريق</h3>
        {membersFull.isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : (
          <div className="space-y-2">
            {membersFull.data?.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div>
                  <span className="text-sm font-medium">{m.name}</span>
                  {m.isAdmin && <Badge variant="outline" className="text-[10px] mr-2">مسؤول</Badge>}
                </div>
                {!m.isAdmin && m.membershipId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 gap-1"
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate(m.membershipId)}
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    إخراج
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {pendingJoinRequests.data && pendingJoinRequests.data.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="font-bold text-foreground">طلبات انضمام معلّقة</h3>
          <div className="space-y-2">
            {pendingJoinRequests.data.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-sm">{r.userName}</span>
                {isAdminTier || team.headFreedom ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approveJoin.isPending}
                      onClick={() => approveJoin.mutate(r.id)}
                    >
                      قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      disabled={rejectJoin.isPending}
                      onClick={() => rejectJoin.mutate({ id: r.id, reason: "غير مناسب حالياً" })}
                    >
                      رفض
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    بانتظار المسؤول
                  </Badge>
                )}
              </div>
            ))}
          </div>
          {!team.headFreedom && !isAdminTier && (
            <p className="text-xs text-muted-foreground">
              بما أنك لا تملك صلاحية التصرف الحر، الموافقة النهائية بيد المسؤول.
            </p>
          )}
        </Card>
      )}

      {myRequests.data && myRequests.data.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="font-bold text-foreground">سجل طلباتي</h3>
          <div className="space-y-2">
            {myRequests.data.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                <span>{actionLabels[r.actionType] ?? r.actionType}</span>
                <Badge
                  variant="outline"
                  className={
                    r.status === "approved"
                      ? "text-emerald-600 border-emerald-300"
                      : r.status === "rejected"
                      ? "text-red-500 border-red-300"
                      : "text-amber-600 border-amber-300"
                  }
                >
                  {statusLabels[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
