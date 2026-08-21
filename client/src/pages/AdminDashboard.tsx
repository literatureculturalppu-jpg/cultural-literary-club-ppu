import { type ComponentType } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertCircle, Bell, Bot, Calendar, FileClock, FileEdit, FileText, GraduationCap, Landmark, Mail, Plus, ShieldCheck, Trophy, UserCog, Users, UsersRound, Video, WalletCards } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccessTreasury, isAdminTierRole, ROLE_LABELS } from "@shared/clubRoles";

type ActionItem = { href: string; label: string; description: string; icon: ComponentType<{ className?: string }>; tone?: string; badge?: number };

function WorkspaceCard({ href, label, description, icon: Icon, tone = "text-primary", badge }: ActionItem) {
  return <Link href={href} className="block h-full"><Card className="group h-full border-border/80 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><CardContent className="flex h-full gap-3 p-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-semibold">{label}</span>{typeof badge === "number" && badge > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></CardContent></Card></Link>;
}

function WorkspaceSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card/50 p-4 md:p-5"><div className="mb-4"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div></section>;
}

function MetricCard({ label, value, icon: Icon, tone = "text-primary" }: { label: string; value: number; icon: ComponentType<{ className?: string }>; tone?: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div></CardContent></Card>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdminTier = isAdminTierRole(user?.role);
  const isSupervisor = user?.role === "supervisor";
  const isCommitteeHead = user?.role === "committee_head";
  const canManageContent = isAdminTier || isSupervisor;

  const { data: activities = [] } = trpc.activities.list.useQuery(undefined, { enabled: canManageContent });
  const { data: articles = [] } = trpc.articles.list.useQuery(undefined, { enabled: canManageContent });
  const { data: members = [] } = trpc.members.list.useQuery(undefined, { enabled: isAdminTier });
  const { data: pendingRequests = [] } = trpc.memberApprovals.listPending.useQuery(undefined, { enabled: isAdminTier });
  const { data: adminTeams = [] } = trpc.teams.listAdmin.useQuery(undefined, { enabled: isAdminTier });
  const { data: pendingProfileEdits = [] } = trpc.profileEditRequests.listPending.useQuery(undefined, { enabled: isAdminTier });
  const { data: learningSettings, refetch: refetchLearningSettings } = trpc.learning.getSettings.useQuery(undefined, { enabled: isAdminTier });
  const updateLearningSettings = trpc.learning.updateSettings.useMutation({ onSuccess: () => refetchLearningSettings() });
  const teamsPendingCount = adminTeams.reduce((sum, team) => sum + team.pendingJoinCount + team.pendingActionCount, 0);

  if (!user || (!isAdminTier && !isSupervisor && !isCommitteeHead)) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><h1 className="mb-4 text-2xl font-bold">غير مصرح لك بالوصول إلى هذه الصفحة</h1><Link href="/"><Button>العودة إلى الرئيسية</Button></Link></div></div>;

  const roleLabel = ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role;

  if (isCommitteeHead) return <TeamLeadDashboard name={user.name || "مشرف الفريق"} />;
  if (isSupervisor) return <ContentSupervisorDashboard name={user.name || "مشرف السوشيال ميديا"} activities={activities.length} articles={articles.length} />;

  const contentActions: ActionItem[] = [
    { href: "/admin/activities", label: "إدارة الأنشطة", description: "إنشاء الأنشطة وتعديلها ومراجعة التسجيلات.", icon: Calendar, tone: "text-sky-700" },
    { href: "/admin/articles", label: "إدارة المقالات", description: "نشر المقالات وتحريرها وتنظيم محتواها.", icon: FileText, tone: "text-violet-700" },
    { href: "/admin/add-achievement", label: "إضافة إنجاز", description: "نشر إنجاز جديد في صفحة النادي.", icon: Trophy, tone: "text-amber-700" },
    { href: "/admin/learning", label: "المنصة التعليمية", description: "إدارة المساقات والفيديوهات وأغلفتها.", icon: GraduationCap, tone: "text-sky-700" },
  ];
  const membershipActions: ActionItem[] = [
    { href: "/admin/members", label: "الأعضاء", description: "عرض بيانات الأعضاء وإدارة الأدوار.", icon: Users, tone: "text-emerald-700" },
    { href: "/admin/registration-requests", label: "طلبات العضوية", description: "مراجعة طلبات الانضمام الجديدة.", icon: Mail, tone: "text-rose-700", badge: pendingRequests.length },
    { href: "/admin/profile-edit-requests", label: "تعديلات البيانات", description: "مراجعة طلبات تحديث الملف الشخصي.", icon: FileEdit, tone: "text-pink-700", badge: pendingProfileEdits.length },
    { href: "/admin/team-members", label: "الهيئة الإدارية", description: "إدارة الفريق الإداري والمناصب.", icon: UsersRound, tone: "text-orange-700" },
    { href: "/admin/teams", label: "الفرق", description: "متابعة الفرق وطلبات الانضمام والإجراءات.", icon: UsersRound, tone: "text-teal-700", badge: teamsPendingCount },
  ];
  const serviceActions: ActionItem[] = [
    { href: "/admin/notifications", label: "مركز الإشعارات", description: "إرسال الإشعارات ومراجعة محتواها.", icon: Bell, tone: "text-indigo-700" },
    { href: "/admin/broadcast-email", label: "البريد الجماعي", description: "إرسال رسائل البريد للمستلمين المخولين.", icon: Mail, tone: "text-blue-700" },
    { href: "/admin/external-links", label: "الروابط الخارجية", description: "إدارة الروابط الظاهرة في الموقع.", icon: Plus, tone: "text-slate-700" },
    { href: "/admin/registration-settings", label: "إعدادات التسجيل", description: "ضبط استقبال طلبات العضوية.", icon: UserCog, tone: "text-slate-700" },
    { href: "/admin/meetings-settings", label: "الاجتماعات الإلكترونية", description: "إدارة الغرف وإعدادات الاجتماعات.", icon: Video, tone: "text-red-700" },
  ];

  return <main className="min-h-screen bg-background pb-12" dir="rtl"><section className="border-b bg-gradient-to-b from-accent/10 to-background py-8 md:py-12"><div className="container"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-sm font-semibold text-primary">مساحة العمل الإدارية</p><h1 className="text-3xl font-bold md:text-4xl">لوحة {roleLabel}</h1><p className="mt-2 max-w-2xl text-muted-foreground">أهلاً بك {user.name || roleLabel}. رتّبت الأدوات في مساحات عمل لتصل إلى الإجراء المطلوب بسرعة.</p></div>{canAccessTreasury(user.role) && <Link href="/treasury"><Button variant="outline" className="gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"><WalletCards className="h-4 w-4" />لوحة العمليات المالية</Button></Link>}</div></div></section><div className="container space-y-6 py-7"><section><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">نظرة سريعة</h2><span className="text-xs text-muted-foreground">اضغط أي بطاقة للانتقال إلى إدارتها</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><MetricCard label="الأنشطة" value={activities.length} icon={Calendar} tone="text-sky-700" /><MetricCard label="المقالات" value={articles.length} icon={FileText} tone="text-violet-700" /><MetricCard label="الأعضاء" value={members.length} icon={Users} tone="text-emerald-700" /><MetricCard label="طلبات العضوية" value={pendingRequests.length} icon={Mail} tone="text-rose-700" /><MetricCard label="طلبات الفرق" value={teamsPendingCount} icon={UsersRound} tone="text-teal-700" /><MetricCard label="تعديلات البيانات" value={pendingProfileEdits.length} icon={FileEdit} tone="text-pink-700" /></div></section><WorkspaceSection title="المحتوى والبرامج" description="كل ما يتعلق بالنشر العام، الأنشطة، الإنجازات، والمنصة التعليمية.">{contentActions.map((item) => <WorkspaceCard key={item.href} {...item} />)}</WorkspaceSection><WorkspaceSection title="الأعضاء والفرق" description="طلبات العضوية، حسابات الأعضاء، الهيئة الإدارية، والفرق.">{membershipActions.map((item) => <WorkspaceCard key={item.href} {...item} />)}</WorkspaceSection><WorkspaceSection title="التواصل والخدمات" description="التنبيهات والبريد والروابط وإعدادات الخدمات العامة.">{serviceActions.map((item) => <WorkspaceCard key={item.href} {...item} />)}</WorkspaceSection>{canAccessTreasury(user.role) && <WorkspaceSection title="المالية" description="تنتقل إلى مساحة مالية مستقلة للحفاظ على وضوح العمليات والتقارير."><WorkspaceCard href="/treasury" label="لوحة أمين الصندوق" description="الميزانية والعمليات والإيصالات وسجل المالية." icon={Landmark} tone="text-emerald-700" /></WorkspaceSection>}{user.role === "tech_admin" && <WorkspaceSection title="إدارة تقنية حصرية" description="أدوات المدير التقني التي لا تظهر لباقي الأدوار الإدارية."><WorkspaceCard href="/admin/work-logs" label="سجل الأمن" description="مراجعة أحداث الحماية والتدقيق." icon={ShieldCheck} tone="text-rose-700" /><WorkspaceCard href="/admin/basir-settings" label="إعدادات بصير" description="ضبط حالة خدمات بصير والمحتوى المعرفي." icon={Bot} tone="text-violet-700" /><Card className="border-dashed"><CardContent className="flex h-full flex-col justify-between gap-3 p-4"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sky-700"><GraduationCap className="h-5 w-5" /></span><div><p className="font-semibold">حالة المنصة التعليمية</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{learningSettings?.enabled ? "المنصة متاحة حالياً للأعضاء المعتمدين." : "المنصة متوقفة حالياً عن الأعضاء."}</p></div></div><Button variant={learningSettings?.enabled ? "default" : "outline"} disabled={updateLearningSettings.isPending} onClick={() => updateLearningSettings.mutate({ enabled: !learningSettings?.enabled })}>{updateLearningSettings.isPending ? "جاري الحفظ..." : learningSettings?.enabled ? "تعطيل المنصة" : "تفعيل المنصة"}</Button></CardContent></Card></WorkspaceSection>}</div></main>;
}

function ContentSupervisorDashboard({ name, activities, articles }: { name: string; activities: number; articles: number }) {
  const contentActions: ActionItem[] = [
    { href: "/admin/activities", label: "إدارة الأنشطة", description: "إنشاء الأنشطة وتعديلها ومتابعة محتواها.", icon: Calendar, tone: "text-sky-700" },
    { href: "/admin/articles", label: "إدارة المقالات", description: "نشر المقالات وتحريرها.", icon: FileText, tone: "text-violet-700" },
    { href: "/admin/add-achievement", label: "إضافة إنجاز", description: "نشر إنجاز جديد للنادي.", icon: Trophy, tone: "text-amber-700" },
  ];
  return <main className="min-h-screen bg-background pb-12" dir="rtl"><section className="border-b bg-gradient-to-b from-accent/10 to-background py-8 md:py-12"><div className="container"><p className="mb-2 text-sm font-semibold text-primary">مساحة نشر المحتوى</p><h1 className="text-3xl font-bold md:text-4xl">لوحة مشرف السوشيال ميديا</h1><p className="mt-2 text-muted-foreground">أهلاً بك {name}. هنا أدوات النشر التي تحتاجها فقط.</p></div></section><div className="container space-y-6 py-7"><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="الأنشطة" value={activities} icon={Calendar} tone="text-sky-700" /><MetricCard label="المقالات" value={articles} icon={FileText} tone="text-violet-700" /></div><WorkspaceSection title="إدارة المحتوى" description="أنشئ وانشر المحتوى دون ظهور أدوات العضويات أو المالية غير اللازمة لدورك.">{contentActions.map((item) => <WorkspaceCard key={item.href} {...item} />)}</WorkspaceSection></div></main>;
}

function TeamLeadDashboard({ name }: { name: string }) {
  return <main className="min-h-screen bg-background pb-12" dir="rtl"><section className="border-b bg-gradient-to-b from-accent/10 to-background py-8 md:py-12"><div className="container"><p className="mb-2 text-sm font-semibold text-primary">مساحة الفريق</p><h1 className="text-3xl font-bold md:text-4xl">لوحة مشرف الفريق</h1><p className="mt-2 text-muted-foreground">أهلاً بك {name}. تركز هذه اللوحة على الفريق فقط.</p></div></section><div className="container space-y-6 py-7"><Alert><AlertCircle className="h-4 w-4" /><AlertDescription>إجراءات إضافة الأعضاء أو إخراجهم أو تغيير ظهور الفريق تمر عبر الطلبات والموافقات حسب سياسة الفريق.</AlertDescription></Alert><WorkspaceSection title="إدارة الفريق" description="الوصول إلى فريقك وطلباتك، مع تصفح بقية فرق النادي."><WorkspaceCard href="/admin/my-team" label="إدارة فريقي" description="الأعضاء، الظهور، الدردشة، وحالة الطلبات." icon={UsersRound} tone="text-teal-700" /><WorkspaceCard href="/teams" label="تصفح الفرق" description="استعرض فرق النادي وادخل إلى مساحة فريقك." icon={Users} tone="text-sky-700" /></WorkspaceSection></div></main>;
}
