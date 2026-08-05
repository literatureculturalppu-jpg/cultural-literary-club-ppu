import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, UserCheck, UserPlus, Users, Phone, Mail, Hash, Check, X } from "lucide-react";
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
  const { data: registrations, isLoading, refetch } = trpc.activityRegistrations.getForActivity.useQuery(activityId);

  const approveSubscription = trpc.activityRegistrations.approveSubscription.useMutation({ onSuccess: () => { toast.success("تمت الموافقة"); refetch(); }, onError: e => toast.error(e.message) });
  const rejectSubscription = trpc.activityRegistrations.rejectSubscription.useMutation({ onSuccess: () => { toast.success("تم الرفض"); refetch(); }, onError: e => toast.error(e.message) });
  const approveGuest = trpc.activityRegistrations.approveGuest.useMutation({ onSuccess: () => { toast.success("تمت الموافقة"); refetch(); }, onError: e => toast.error(e.message) });
  const rejectGuest = trpc.activityRegistrations.rejectGuest.useMutation({ onSuccess: () => { toast.success("تم الرفض"); refetch(); }, onError: e => toast.error(e.message) });

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin" && user.role !== "supervisor")) {
    return <div className="container py-16 text-center" dir="rtl"><p className="text-muted-foreground">غير مصرح لك</p></div>;
  }

  const memberCount = registrations?.members?.length ?? 0;
  const guestCount = registrations?.guests?.length ?? 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/activities"><Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button></Link>
            <div>
              <h1 className="text-3xl font-bold">المسجلون في النشاط</h1>
              {activity && <p className="text-muted-foreground mt-1">{activity.title}</p>}
            </div>
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
          {isLoading ? <p className="text-center text-muted-foreground">جاري التحميل...</p> : (
            <>
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
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white h-7 px-2" onClick={() => approveSubscription.mutate(m.id)} disabled={m.status === "approved"}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white h-7 px-2" onClick={() => rejectSubscription.mutate(m.id)} disabled={m.status === "rejected"}><X className="w-3 h-3" /></Button>
                              </div>
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
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white h-7 px-2" onClick={() => approveGuest.mutate(g.id)} disabled={g.status === "approved"}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white h-7 px-2" onClick={() => rejectGuest.mutate(g.id)} disabled={g.status === "rejected"}><X className="w-3 h-3" /></Button>
                              </div>
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
