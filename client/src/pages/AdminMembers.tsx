import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Users, Trash2, Edit2, Mail, Phone, GraduationCap, Hash, X, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const roleLabels: Record<string, string> = {
  user: "عضو", admin: "مسؤول", general_agent: "وكيل عام", tech_admin: "المدير التقني", supervisor: "مشرف", committee_head: "مشرف فريق"
};
const yearLabels: Record<string, string> = {
  first: "الأولى", second: "الثانية", third: "الثالثة", fourth: "الرابعة", postgraduate: "دراسات عليا"
};

function EditModal({ member, viewerRole, viewerId, onClose, onSave }: { member: any; viewerRole: string; viewerId: number; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    arabicFullName: member.arabicFullName || "",
    universityId: member.universityId || "",
    college: member.college || "",
    specialization: member.specialization || "",
    academicYear: member.academicYear || "",
    phoneNumber: member.phoneNumber || "",
    whatsapp: member.whatsapp || "",
    culturalExperience: member.culturalExperience || "",
    role: member.role || "user",
  });
  const isViewerTechAdmin = viewerRole === "tech_admin";
  const isViewerAgent = viewerRole === "general_agent" || isViewerTechAdmin;
  // Only a tech admin may assign the "tech_admin" role (the highest tier),
  // and only a general agent or tech admin may assign "general_agent". A
  // general agent may not remove its own agent status, and a tech admin
  // may not remove its own tech-admin status either.
  const availableRoles = Object.entries(roleLabels).filter(([value]) => {
    if (value === "tech_admin") return isViewerTechAdmin;
    if (value === "general_agent") return isViewerAgent;
    return true;
  });
  const lockRoleField =
    (member.role === "tech_admin" && (!isViewerTechAdmin || member.id === viewerId)) ||
    (member.role === "general_agent" && isViewerAgent && !isViewerTechAdmin && member.id === viewerId);
  const update = trpc.adminUsers.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث بيانات العضو"); onSave(); onClose(); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });
  const inputClass = "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent";
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">تعديل بيانات: {member.name}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">الاسم الثلاثي</label>
              <input type="text" value={form.arabicFullName} onChange={e => setForm({...form, arabicFullName: e.target.value})} className={inputClass} /></div>
            <div><label className="block text-xs font-medium mb-1">الرقم الجامعي</label>
              <input type="text" value={form.universityId} onChange={e => setForm({...form, universityId: e.target.value})} className={inputClass} dir="ltr" /></div>
            <div><label className="block text-xs font-medium mb-1">الكلية</label>
              <input type="text" value={form.college} onChange={e => setForm({...form, college: e.target.value})} className={inputClass} /></div>
            <div><label className="block text-xs font-medium mb-1">التخصص</label>
              <input type="text" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})} className={inputClass} /></div>
            <div><label className="block text-xs font-medium mb-1">السنة</label>
              <select value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})} className={inputClass}>
                <option value="">-</option>
                {Object.entries(yearLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium mb-1">الصلاحية</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={inputClass} disabled={lockRoleField}>
                {availableRoles.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {lockRoleField && (
                <p className="text-xs text-muted-foreground mt-1">لا يمكن للوكيل العام إزالة صلاحيته عن نفسه</p>
              )}</div>
            <div><label className="block text-xs font-medium mb-1">رقم الهاتف</label>
              <input type="tel" value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value})} className={inputClass} dir="ltr" /></div>
            <div><label className="block text-xs font-medium mb-1">رقم الواتساب</label>
              <input type="tel" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} className={inputClass} dir="ltr" /></div>
          </div>
          <div><label className="block text-xs font-medium mb-1">الخبرات الثقافية</label>
            <textarea value={form.culturalExperience} onChange={e => setForm({...form, culturalExperience: e.target.value})} rows={3} className={inputClass} /></div>
          <Button className="w-full bg-accent text-accent-foreground" onClick={() => update.mutate({ id: member.id, ...form })} disabled={update.isPending}>
            <Save className="w-4 h-4 ml-2" />{update.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMembers() {
  const { user } = useAuth();
  const isAdminTier = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin";
  const [editingMember, setEditingMember] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: members = [], refetch } = trpc.adminUsers.list.useQuery(undefined, { enabled: isAdminTier });
  const deleteUser = trpc.adminUsers.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف العضو"); refetch(); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });

  if (!isAdminTier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">غير مصرح لك</h1>
          <Link href="/"><Button className="bg-accent text-accent-foreground">الرئيسية</Button></Link>
        </div>
      </div>
    );
  }

  const filtered = members.filter((m: any) =>
    !search || (m.arabicFullName || m.name || m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const total = members.length;
  const admins = members.filter((m: any) => m.role === "admin" || m.role === "general_agent" || m.role === "tech_admin" || m.role === "supervisor").length;
  const completed = members.filter((m: any) => m.onboardingCompleted).length;
  const byYear: Record<string, number> = {};
  members.forEach((m: any) => { if (m.academicYear) byYear[m.academicYear] = (byYear[m.academicYear] || 0) + 1; });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {editingMember && <EditModal member={editingMember} viewerRole={user?.role || "user"} viewerId={user?.id} onClose={() => setEditingMember(null)} onSave={refetch} />}

      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">إدارة الأعضاء</h1>
              <p className="text-muted-foreground">إدارة أعضاء النادي الثقافي الأدبي</p>
            </div>
            <Link href="/admin"><Button className="bg-accent text-accent-foreground">العودة</Button></Link>
          </div>
        </div>
      </section>

      <section className="py-8 bg-background">
        <div className="container space-y-8">
          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="إجمالي الأعضاء" value={total} color="bg-blue-50 border-blue-200" />
            <StatCard label="أكملوا التسجيل" value={completed} color="bg-green-50 border-green-200" />
            <StatCard label="مسؤولون ومشرفون" value={admins} color="bg-purple-50 border-purple-200" />
            <StatCard label="لم يكملوا التسجيل" value={total - completed} color="bg-orange-50 border-orange-200" />
          </div>

          {/* توزيع السنوات */}
          {Object.keys(byYear).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">توزيع السنوات الدراسية</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byYear).map(([yr, count]) => (
                  <Badge key={yr} className="bg-accent/10 text-accent border border-accent/20 px-3 py-1">
                    {yearLabels[yr] || yr}: {count}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* بحث */}
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="ابحث بالاسم أو البريد..." />

          {/* جدول الأعضاء */}
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا يوجد أعضاء</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["#","الرقم المرجعي","الاسم","الرقم الجامعي","الكلية","التخصص","السنة","الهاتف","الواتساب","الصلاحية","الحالة","إجراءات"].map(h => (
                      <th key={h} className="px-3 py-3 text-right font-semibold text-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((m: any, i: number) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 text-muted-foreground">{i+1}</td>
                      <td className="px-3 py-3 text-muted-foreground font-mono" dir="ltr">{m.referenceNumber || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{m.arabicFullName || m.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground" dir="ltr">{m.universityId || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{m.college || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{m.specialization || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{yearLabels[m.academicYear] || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground" dir="ltr">{m.phoneNumber || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground" dir="ltr">{m.whatsapp || "—"}</td>
                      <td className="px-3 py-3">
                        <Badge className={m.role === "tech_admin" ? "bg-rose-100 text-rose-700" : m.role === "general_agent" ? "bg-amber-100 text-amber-700" : m.role === "admin" ? "bg-purple-100 text-purple-700" : m.role === "supervisor" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                          {roleLabels[m.role] || m.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={m.onboardingCompleted ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                          {m.onboardingCompleted ? "مكتمل" : "ناقص"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {m.role === "tech_admin" && user?.role !== "tech_admin" ? (
                          <span className="text-xs text-muted-foreground">لا يمكن لغير المدير التقني تعديل المدير التقني</span>
                        ) : m.role === "general_agent" && user?.role !== "general_agent" && user?.role !== "tech_admin" ? (
                          <span className="text-xs text-muted-foreground">لا يمكن للمسؤول تعديل الوكيل العام</span>
                        ) : (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setEditingMember(m)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500"
                              onClick={() => { if (confirm("هل تريد حذف هذا العضو؟")) deleteUser.mutate(m.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className={`p-4 border ${color}`}>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </Card>
  );
}
