import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Video, Calendar, Copy, Ban, ShieldCheck, X, UserPlus, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const MODERATOR_ROLES = new Set(["admin", "general_agent", "tech_admin"]);

type GuestJoinRequest = {
  id: number;
  meetingId: number;
  meetingTitle: string | null;
  meetingDate: string | Date | null;
  fullName: string;
  universityEmail: string;
  universityId: string;
  college: string | null;
  specialization: string | null;
  academicYear: string | null;
  phoneNumber: string;
  whatsapp: string | null;
  requestedAt: string | Date;
};

// "فهرستها حسب اسم الاجتماع وتاريخه" — group guest join requests by
// meeting title + date so the dashboard reads as one section per meeting
// rather than a single flat list.
function groupGuestRequestsByMeeting(requests: GuestJoinRequest[]) {
  const groups = new Map<string, { title: string; date: string | Date | null; items: GuestJoinRequest[] }>();
  for (const r of requests) {
    const key = `${r.meetingTitle ?? "بدون عنوان"}__${r.meetingDate ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, { title: r.meetingTitle || "اجتماع بدون عنوان", date: r.meetingDate, items: [] });
    }
    groups.get(key)!.items.push(r);
  }
  return Array.from(groups.values());
}

export default function MeetingsSettings() {
  const { user } = useAuth();
  const isModerator = !!user && MODERATOR_ROLES.has(user.role);
  const utils = trpc.useUtils();

  const { data: isFounder } = trpc.meetings.isFounder.useQuery(undefined, { enabled: !!user });
  const { data: meetings, refetch: refetchMeetings } = trpc.meetings.listUpcoming.useQuery(undefined, {
    enabled: isModerator,
    refetchInterval: 10000,
  });
  const { data: bans, refetch: refetchBans } = trpc.meetings.listBans.useQuery(undefined, { enabled: isModerator });
  const { data: overrides, refetch: refetchOverrides } = trpc.meetings.listOverrides.useQuery(undefined, {
    enabled: !!isFounder,
  });
  const { data: guestRequests, refetch: refetchGuestRequests } = trpc.meetings.listGuestJoinRequests.useQuery(
    undefined,
    { enabled: isModerator }
  );

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [banUserId, setBanUserId] = useState("");
  const [overrideUserId, setOverrideUserId] = useState("");
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [guestEditForm, setGuestEditForm] = useState<Partial<GuestJoinRequest>>({});

  const createInstant = trpc.meetings.createInstant.useMutation({
    onSuccess: (m) => {
      toast.success("تم إنشاء الاجتماع الفوري");
      copyInviteLink(m.inviteToken);
      refetchMeetings();
    },
    onError: (e) => toast.error(e.message || "تعذر إنشاء الاجتماع"),
  });
  const createScheduled = trpc.meetings.createScheduled.useMutation({
    onSuccess: () => {
      toast.success("تمت جدولة الاجتماع");
      setTitle("");
      setScheduledAt("");
      refetchMeetings();
    },
    onError: (e) => toast.error(e.message || "تعذر جدولة الاجتماع"),
  });
  const cancelMeeting = trpc.meetings.cancel.useMutation({ onSuccess: () => refetchMeetings() });
  const endMeeting = trpc.meetings.end.useMutation({ onSuccess: () => refetchMeetings() });
  const revokeInvite = trpc.meetings.revokeInvite.useMutation({ onSuccess: () => refetchMeetings() });
  const regenerateInvite = trpc.meetings.regenerateInvite.useMutation({
    onSuccess: (m) => {
      copyInviteLink(m.inviteToken);
      refetchMeetings();
    },
  });
  const unban = trpc.meetings.unban.useMutation({ onSuccess: () => refetchBans() });
  const banByIdMutation = trpc.meetings.ban.useMutation({
    onSuccess: () => {
      toast.success("تم الحظر");
      setBanUserId("");
      refetchBans();
    },
    onError: (e) => toast.error(e.message || "تعذر الحظر"),
  });
  const revokeOverride = trpc.meetings.revokeOverride.useMutation({ onSuccess: () => refetchOverrides() });
  const grantOverrideById = trpc.meetings.grantOverride.useMutation({
    onSuccess: () => {
      toast.success("تم منح صلاحية كسر القيود");
      setOverrideUserId("");
      refetchOverrides();
    },
    onError: (e) => toast.error(e.message || "تعذر المنح"),
  });
  const updateGuestRequest = trpc.meetings.updateGuestJoinRequest.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      setEditingGuestId(null);
      refetchGuestRequests();
    },
    onError: (e) => toast.error(e.message || "تعذر الحفظ"),
  });
  const deleteGuestRequest = trpc.meetings.deleteGuestJoinRequest.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب");
      refetchGuestRequests();
    },
    onError: (e) => toast.error(e.message || "تعذر الحذف"),
  });

  function copyInviteLink(inviteToken: string) {
    const url = `${window.location.origin}/meeting/${inviteToken}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("تم نسخ رابط الدعوة"),
      () => toast.info(url)
    );
  }

  if (!isModerator) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <p className="text-muted-foreground mb-4">غير مصرح لك بالوصول</p>
        <Link href="/"><Button>الرئيسية</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Video className="w-7 h-7" /> نظام الاجتماعات الإلكتروني
              </h1>
              <p className="text-muted-foreground mt-1">إنشاء الاجتماعات وإدارة الدعوات والقيود</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 bg-background">
        <div className="container max-w-3xl space-y-8">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">إنشاء اجتماع</h2>
            <div className="space-y-3">
              <Input placeholder="عنوان الاجتماع (اختياري)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => createInstant.mutate({ title: title || undefined })} disabled={createInstant.isPending} className="flex-1">
                  بدء اجتماع فوري الآن
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!scheduledAt) {
                      toast.error("اختر موعد البدء أولاً");
                      return;
                    }
                    createScheduled.mutate({ title: title || undefined, scheduledStartAt: new Date(scheduledAt).toISOString() });
                  }}
                  disabled={createScheduled.isPending}
                >
                  <Calendar className="w-4 h-4 me-2" /> جدولة اجتماع
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">الاجتماعات القادمة والجارية</h2>
            {(!meetings || meetings.length === 0) && <p className="text-sm text-muted-foreground">لا توجد اجتماعات حالياً</p>}
            <div className="space-y-3">
              {meetings?.map((m) => (
                <div key={m.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-foreground">{m.title || `اجتماع #${m.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.status === "live" ? "جارٍ الآن" : m.scheduledStartAt ? new Date(m.scheduledStartAt).toLocaleString("ar") : ""}
                      </p>
                    </div>
                    <Badge className={m.status === "live" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                      {m.status === "live" ? "مباشر" : "مجدوَل"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {m.status === "live" && (
                      <Link href={`/meeting/${m.inviteToken}`}>
                        <Button size="sm">دخول الاجتماع</Button>
                      </Link>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copyInviteLink(m.inviteToken)} disabled={m.inviteRevoked}>
                      <Copy className="w-3.5 h-3.5 me-1" /> نسخ رابط الدعوة
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => regenerateInvite.mutate({ id: m.id })}>
                      تجديد الرابط
                    </Button>
                    {!m.inviteRevoked && (
                      <Button size="sm" variant="outline" onClick={() => revokeInvite.mutate({ id: m.id })}>
                        إلغاء الرابط
                      </Button>
                    )}
                    {m.status === "live" ? (
                      <Button size="sm" variant="destructive" onClick={() => endMeeting.mutate({ id: m.id })}>
                        إنهاء الاجتماع
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => cancelMeeting.mutate({ id: m.id })}>
                        إلغاء الاجتماع
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> طلبات معلومات الانضمام كضيف
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              معلومات من انضم أو حاول الانضمام إلى اجتماع بدون حساب في النادي، مفهرسة حسب اسم الاجتماع وتاريخه.
            </p>
            {(!guestRequests || guestRequests.length === 0) ? (
              <p className="text-sm text-muted-foreground">لا توجد طلبات حالياً</p>
            ) : (
              <div className="space-y-5">
                {groupGuestRequestsByMeeting(guestRequests as GuestJoinRequest[]).map((group, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-sm text-foreground">{group.title}</p>
                      {group.date && (
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {new Date(group.date).toLocaleString("ar")}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((r) =>
                        editingGuestId === r.id ? (
                          <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="الاسم الكامل" value={guestEditForm.fullName ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, fullName: e.target.value })} />
                              <Input placeholder="البريد الجامعي" dir="ltr" value={guestEditForm.universityEmail ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, universityEmail: e.target.value })} />
                              <Input placeholder="الرقم الجامعي" dir="ltr" value={guestEditForm.universityId ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, universityId: e.target.value })} />
                              <Input placeholder="الكلية" value={guestEditForm.college ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, college: e.target.value })} />
                              <Input placeholder="التخصص" value={guestEditForm.specialization ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, specialization: e.target.value })} />
                              <Input placeholder="رقم الهاتف" dir="ltr" value={guestEditForm.phoneNumber ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, phoneNumber: e.target.value })} />
                              <Input placeholder="رقم الواتساب" dir="ltr" value={guestEditForm.whatsapp ?? ""}
                                onChange={(e) => setGuestEditForm({ ...guestEditForm, whatsapp: e.target.value })} />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateGuestRequest.mutate({
                                id: r.id,
                                fullName: guestEditForm.fullName ?? undefined,
                                universityEmail: guestEditForm.universityEmail ?? undefined,
                                universityId: guestEditForm.universityId ?? undefined,
                                college: guestEditForm.college ?? undefined,
                                specialization: guestEditForm.specialization ?? undefined,
                                academicYear: guestEditForm.academicYear ?? undefined,
                                phoneNumber: guestEditForm.phoneNumber ?? undefined,
                                whatsapp: guestEditForm.whatsapp ?? undefined,
                              })} disabled={updateGuestRequest.isPending}>
                                <Save className="w-3.5 h-3.5 me-1" /> حفظ
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingGuestId(null)}>إلغاء</Button>
                            </div>
                          </div>
                        ) : (
                          <div key={r.id} className="flex items-start justify-between gap-3 border border-border rounded-lg p-3 text-sm">
                            <div>
                              <p className="font-medium text-foreground">{r.fullName}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">{r.universityEmail} · {r.phoneNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.universityId}{r.college ? ` · ${r.college}` : ""}{r.specialization ? ` · ${r.specialization}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => { setEditingGuestId(r.id); setGuestEditForm(r); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (confirm("هل تريد حذف هذا الطلب؟")) deleteGuestRequest.mutate({ id: r.id });
                              }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5" /> الأعضاء المحظورون من الاجتماعات
            </h2>
            <div className="flex gap-2 mb-4">
              <Input placeholder="معرّف العضو (User ID)" value={banUserId} onChange={(e) => setBanUserId(e.target.value)} />
              <Button
                variant="destructive"
                onClick={() => {
                  const id = Number(banUserId);
                  if (!id) return toast.error("أدخل معرّف عضو صالح");
                  banByIdMutation.mutate({ userId: id });
                }}
              >
                حظر
              </Button>
            </div>
            {(!bans || bans.length === 0) ? (
              <p className="text-sm text-muted-foreground">لا يوجد أعضاء محظورون</p>
            ) : (
              <div className="space-y-2">
                {bans.map((b) => (
                  <div key={b.ban.id} className="flex items-center justify-between text-sm border border-border rounded-lg p-2">
                    <span>{b.user.name} — {b.ban.reason || "بدون سبب"}</span>
                    <Button size="sm" variant="outline" onClick={() => unban.mutate({ userId: b.user.id })}>
                      <X className="w-3.5 h-3.5 me-1" /> رفع الحظر
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isFounder && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> صلاحيات كسر القيود (خاص بمؤسس النادي)
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                هذه الصلاحية تسمح لعضو معيّن (عادة مشرف أو مدير تقني) بتجاوز قيود المايك/الكاميرا/مشاركة
                الشاشة/الدردشة داخل أي اجتماع، ولا تُمنح تلقائياً — فقط أنت كمؤسس تستطيع منحها أو سحبها.
              </p>
              <div className="flex gap-2 mb-4">
                <Input placeholder="معرّف العضو (User ID)" value={overrideUserId} onChange={(e) => setOverrideUserId(e.target.value)} />
                <Button
                  onClick={() => {
                    const id = Number(overrideUserId);
                    if (!id) return toast.error("أدخل معرّف عضو صالح");
                    grantOverrideById.mutate({ userId: id });
                  }}
                >
                  منح الصلاحية
                </Button>
              </div>
              {(!overrides || overrides.length === 0) ? (
                <p className="text-sm text-muted-foreground">لا يوجد أعضاء لديهم هذه الصلاحية حالياً</p>
              ) : (
                <div className="space-y-2">
                  {overrides.map((o) => (
                    <div key={o.grant.id} className="flex items-center justify-between text-sm border border-border rounded-lg p-2">
                      <span>{o.user.name}</span>
                      <Button size="sm" variant="outline" onClick={() => revokeOverride.mutate({ userId: o.user.id })}>
                        سحب الصلاحية
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
