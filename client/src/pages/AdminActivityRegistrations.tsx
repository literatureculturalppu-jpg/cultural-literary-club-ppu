import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bell, Loader2, Mail, Send, UserCheck, UserPlus, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700">مقبول</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700">مرفوض</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700">قيد المراجعة</Badge>;
}

export default function AdminActivityRegistrations() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const activityId = parseInt(params.id || "0");

  const { data: activity } = trpc.activities.getById.useQuery(activityId);
  const { data: registrations, isLoading, isFetching, error: registrationsError, refetch } = trpc.activityRegistrations.getForActivity.useQuery(activityId, {
    // بيانات القبول خاصة، لذلك لا تُخزّن في كاش عام. يعيد الاستعلام الجلب
    // بانتظام ليظهر الطلب الجديد حتى عندما تبقى صفحة الإدارة مفتوحة.
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 8_000,
  });

  const approveSubscription = trpc.activityRegistrations.approveSubscription.useMutation({ onSuccess: () => { toast.success("تمت الموافقة"); refetch(); }, onError: e => toast.error(e.message) });
  const rejectSubscription = trpc.activityRegistrations.rejectSubscription.useMutation({ onSuccess: () => { toast.success("تم الرفض"); refetch(); }, onError: e => toast.error(e.message) });
  const approveGuest = trpc.activityRegistrations.approveGuest.useMutation({ onSuccess: () => { toast.success("تمت الموافقة"); refetch(); }, onError: e => toast.error(e.message) });
  const rejectGuest = trpc.activityRegistrations.rejectGuest.useMutation({ onSuccess: () => { toast.success("تم الرفض"); refetch(); }, onError: e => toast.error(e.message) });
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const canBroadcast = user?.role === "admin" || user?.role === "tech_admin";
  const broadcastToRegistrants = trpc.activityRegistrations.broadcastToRegistrants.useMutation({
    onSuccess: (result) => {
      const deliverySummary = [
        sendPush && `إشعار التطبيق لـ ${result.notificationCount} عضو (${result.pushDelivered} جهاز)`,
        sendEmail && `بريد إلكتروني: ${result.emailSent} مُرسل`,
      ].filter(Boolean).join(" — ");
      toast.success(`تم الإرسال إلى مسجلي النشاط. ${deliverySummary}`);
      setBroadcastTitle("");
      setBroadcastBody("");
    },
    onError: (error) => toast.error(error.message),
  });

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin" && user.role !== "supervisor")) {
    return <div className="container py-16 text-center" dir="rtl"><p className="text-muted-foreground">غير مصرح لك</p></div>;
  }

  const memberCount = registrations?.members?.length ?? 0;
  const guestCount = registrations?.guests?.length ?? 0;
  const submitBroadcast = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      toast.error("يرجى كتابة عنوان ونص الرسالة");
      return;
    }
    if (!sendPush && !sendEmail) {
      toast.error("اختر إرسال إشعار للتطبيق أو بريد إلكتروني واحدًا على الأقل");
      return;
    }
    broadcastToRegistrants.mutate({
      activityId,
      title: broadcastTitle.trim(),
      body: broadcastBody.trim(),
      sendPush,
      sendEmail,
    });
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/activities"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link>
            <div>
              <h1 className="text-3xl font-bold">طلبات قبول المسجلين في النشاط</h1>
              {activity && <p className="text-muted-foreground mt-1">{activity.title}</p>}
            </div>
            <Button variant="outline" size="sm" className="mr-auto" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "جاري التحديث..." : "تحديث الطلبات"}
            </Button>
          </div>
          <div className="flex gap-4 mt-4 flex-wrap">
            <StatPill icon={<Users className="w-4 h-4 text-accent" />} label={`الإجمالي: ${memberCount + guestCount}`} />
            <StatPill icon={<UserCheck className="w-4 h-4 text-green-500" />} label={`أعضاء: ${memberCount}`} />
            <StatPill icon={<UserPlus className="w-4 h-4 text-blue-500" />} label={`ضيوف: ${guestCount}`} />
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container space-y-10">
          {isLoading ? <p className="text-center text-muted-foreground">جاري التحميل...</p> : registrationsError ? (
            <Card className="p-8 text-center border-destructive/30">
              <p className="font-semibold text-destructive">تعذر تحميل طلبات التسجيل</p>
              <p className="text-sm text-muted-foreground mt-2">{registrationsError.message}</p>
              <Button variant="outline" className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? "جاري التحديث..." : "إعادة المحاولة"}
              </Button>
            </Card>
          ) : (
            <>
              {canBroadcast && (
                <Card className="p-5 md:p-6 border-accent/30 bg-accent/[0.03]">
                  <form onSubmit={submitBroadcast} className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-accent/15 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg">إرسال رسالة إلى جميع المسجلين</h2>
                        <p className="text-sm text-muted-foreground mt-1">يشمل الأعضاء والضيوف المسجلين في هذا النشاط فقط. يصل الإشعار للأعضاء عبر التطبيق، ويصل البريد للأعضاء والضيوف المسجلين ببريد إلكتروني.</p>
                      </div>
                    </div>
                    <input
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      value={broadcastTitle}
                      onChange={(event) => setBroadcastTitle(event.target.value)}
                      maxLength={255}
                      placeholder="عنوان الإشعار والبريد"
                    />
                    <textarea
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                      value={broadcastBody}
                      onChange={(event) => setBroadcastBody(event.target.value)}
                      rows={5}
                      maxLength={1000}
                      placeholder="اكتب الرسالة التي تريد إرسالها لجميع المسجلين"
                    />
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={sendPush} onChange={(event) => setSendPush(event.target.checked)} />
                        <Bell className="w-4 h-4 text-accent" /> إرسال إشعار للتطبيق للأعضاء
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
                        <Mail className="w-4 h-4 text-accent" /> إرسال بريد إلكتروني للجميع
                      </label>
                    </div>
                    <Button type="submit" className="w-full sm:w-auto" disabled={broadcastToRegistrants.isPending || (!sendPush && !sendEmail)}>
                      {broadcastToRegistrants.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
                      {broadcastToRegistrants.isPending ? "جارِ الإرسال..." : "إرسال للجميع"}
                    </Button>
                  </form>
                </Card>
              )}

              {/* أعضاء */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-500" />الأعضاء المسجلون
                  <Badge className="bg-green-100 text-green-700">{memberCount}</Badge>
                </h2>
                {memberCount === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">لا يوجد أعضاء</p></Card> : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>{["#","الاسم","البريد","الهاتف","الكلية","تاريخ التسجيل","الحالة","إجراءات"].map(h => (
                          <th key={h} className="px-4 py-3 text-right font-semibold whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {registrations?.members?.map((m: any, i: number) => (
                          <tr key={m.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-muted-foreground">{i+1}</td>
                            <td className="px-4 py-3 font-medium">{m.arabicFullName || m.name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground" dir="ltr">{m.email || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground" dir="ltr">{m.phoneNumber || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{m.college || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(m.subscribedAt).toLocaleDateString("ar-SA")}</td>
                            <td className="px-4 py-3"><StatusBadge status={m.status || "pending"} /></td>
                            <td className="px-4 py-3">
                              {(m.status || "pending") === "pending" ? (
                                <div className="flex gap-2 whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                    onClick={() => approveSubscription.mutate(m.id)}
                                    disabled={approveSubscription.isPending || rejectSubscription.isPending}
                                  >
                                    {approveSubscription.isPending ? "جارِ القبول..." : "قبول"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 px-3"
                                    onClick={() => rejectSubscription.mutate(m.id)}
                                    disabled={approveSubscription.isPending || rejectSubscription.isPending}
                                  >
                                    {rejectSubscription.isPending ? "جارِ الرفض..." : "رفض"}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">تم اتخاذ الإجراء</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ضيوف */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-500" />الضيوف المسجلون
                  <Badge className="bg-blue-100 text-blue-700">{guestCount}</Badge>
                </h2>
                {guestCount === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">لا يوجد ضيوف</p></Card> : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>{["#","الاسم","البريد","الرقم الجامعي","الكلية","التخصص","السنة","الهاتف","الواتساب","الحالة","إجراءات"].map(h => (
                          <th key={h} className="px-3 py-3 text-right font-semibold whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {registrations?.guests?.map((g: any, i: number) => (
                          <tr key={g.id} className="hover:bg-muted/30">
                            <td className="px-3 py-3 text-muted-foreground">{i+1}</td>
                            <td className="px-3 py-3 font-medium">{g.fullName}</td>
                            <td className="px-3 py-3 text-muted-foreground" dir="ltr">{g.universityEmail}</td>
                            <td className="px-3 py-3 text-muted-foreground" dir="ltr">{g.universityId}</td>
                            <td className="px-3 py-3 text-muted-foreground">{g.college || "—"}</td>
                            <td className="px-3 py-3 text-muted-foreground">{g.specialization || "—"}</td>
                            <td className="px-3 py-3 text-muted-foreground">{g.academicYear || "—"}</td>
                            <td className="px-3 py-3 text-muted-foreground" dir="ltr">{g.phoneNumber}</td>
                            <td className="px-3 py-3 text-muted-foreground" dir="ltr">{g.whatsapp || "—"}</td>
                            <td className="px-3 py-3"><StatusBadge status={g.status || "pending"} /></td>
                            <td className="px-3 py-3">
                              {(g.status || "pending") === "pending" ? (
                                <div className="flex gap-2 whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                    onClick={() => approveGuest.mutate(g.id)}
                                    disabled={approveGuest.isPending || rejectGuest.isPending}
                                  >
                                    {approveGuest.isPending ? "جارِ القبول..." : "قبول"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 px-3"
                                    onClick={() => rejectGuest.mutate(g.id)}
                                    disabled={approveGuest.isPending || rejectGuest.isPending}
                                  >
                                    {rejectGuest.isPending ? "جارِ الرفض..." : "رفض"}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">تم اتخاذ الإجراء</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-background border border-border rounded-lg px-4 py-2 flex items-center gap-2">
      {icon}<span className="text-sm font-medium">{label}</span>
    </div>
  );
}
