import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, FileText, Users, MessageSquare, Plus, Trophy, AlertCircle, Mail, Bot, UsersRound, UserCog, FileEdit, FileClock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect } from "react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isAdminTier = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin";

  const { data: activities = [] } = trpc.activities.list.useQuery(undefined, {
    enabled: isAdminTier || user?.role === "supervisor",
  });
  const { data: articles = [] } = trpc.articles.list.useQuery(undefined, {
    enabled: isAdminTier || user?.role === "supervisor",
  });
  const { data: members = [] } = trpc.members.list.useQuery(undefined, {
    enabled: isAdminTier,
  });
  const { data: pendingRequests = [] } = trpc.memberApprovals.listPending.useQuery(undefined, {
    enabled: isAdminTier,
  });
  const { data: adminTeams = [] } = trpc.teams.listAdmin.useQuery(undefined, {
    enabled: isAdminTier,
  });
  const { data: pendingProfileEdits = [] } = trpc.profileEditRequests.listPending.useQuery(undefined, {
    enabled: isAdminTier,
  });
  const teamsPendingCount = adminTeams.reduce(
    (sum, t) => sum + t.pendingJoinCount + t.pendingActionCount,
    0
  );

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin" && user.role !== "supervisor" && user.role !== "committee_head")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">غير مصرح لك بالوصول إلى هذه الصفحة</h1>
          <Link href="/">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              العودة إلى الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "المسؤول",
      general_agent: "الوكيل العام",
      tech_admin: "المدير التقني",
      supervisor: "المشرف",
      committee_head: "مشرف فريق",
    };
    return labels[role] || role;
  };

  const renderAdminDashboard = () => (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            {user?.role === "tech_admin" ? "لوحة تحكم المدير التقني" : user?.role === "general_agent" ? "لوحة تحكم الوكيل العام" : "لوحة تحكم المسؤول"}
          </h1>
          <p className="text-lg text-muted-foreground">
            أهلاً بك {user?.name || (user?.role === "tech_admin" ? "المدير التقني" : user?.role === "general_agent" ? "الوكيل العام" : "المسؤول")} - لديك جميع الصلاحيات الكاملة
            {user?.role === "general_agent" && " بالإضافة إلى إدارة حسابات المسؤولين والوكلاء"}
            {user?.role === "tech_admin" && " بالإضافة إلى إدارة حسابات المسؤولين والوكلاء، وترقية الأعضاء إلى مديرين تقنيين، والاطلاع على سجلات العمل"}
          </p>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/admin/activities">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <Calendar className="w-8 h-8 text-blue-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">الأنشطة</p>
                <p className="text-3xl font-bold text-foreground">{activities?.length || 0}</p>
              </Card>
            </Link>

            <Link href="/admin/articles">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <FileText className="w-8 h-8 text-purple-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">المقالات</p>
                <p className="text-3xl font-bold text-foreground">{articles?.length || 0}</p>
              </Card>
            </Link>

            <Link href="/admin/members">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <Users className="w-8 h-8 text-green-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">الأعضاء</p>
                <p className="text-3xl font-bold text-foreground">{members?.length || 0}</p>
              </Card>
            </Link>

            <Link href="/admin/work-teams">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <UsersRound className="w-8 h-8 text-orange-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">فرق العمل</p>
                <p className="text-3xl font-bold text-foreground">-</p>
              </Card>
            </Link>

            <Link href="/admin/registration-requests">
              <Card className={`p-6 hover:shadow-lg transition-shadow cursor-pointer h-full ${
                pendingRequests.length > 0 ? "ring-2 ring-red-500" : ""
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <Mail className="w-8 h-8 text-red-500 mb-4" />
                    <p className="text-muted-foreground text-sm mb-2">طلبات انضمام الأعضاء الجدد</p>
                    <p className="text-3xl font-bold text-foreground">{pendingRequests.length}</p>
                  </div>
                  {pendingRequests.length > 0 && (
                    <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {pendingRequests.length}
                    </div>
                  )}
                </div>
              </Card>
            </Link>

            <Link href="/admin/teams">
              <Card className={`p-6 hover:shadow-lg transition-shadow cursor-pointer h-full ${
                teamsPendingCount > 0 ? "ring-2 ring-amber-500" : ""
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <UsersRound className="w-8 h-8 text-teal-500 mb-4" />
                    <p className="text-muted-foreground text-sm mb-2">الفرق</p>
                    <p className="text-3xl font-bold text-foreground">{adminTeams.length}</p>
                  </div>
                  {teamsPendingCount > 0 && (
                    <div className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {teamsPendingCount}
                    </div>
                  )}
                </div>
              </Card>
            </Link>

            <Link href="/admin/profile-edit-requests">
              <Card className={`p-6 hover:shadow-lg transition-shadow cursor-pointer h-full ${
                pendingProfileEdits.length > 0 ? "ring-2 ring-red-500" : ""
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <FileEdit className="w-8 h-8 text-pink-500 mb-4" />
                    <p className="text-muted-foreground text-sm mb-2">طلبات تعديل البيانات</p>
                    <p className="text-3xl font-bold text-foreground">{pendingProfileEdits.length}</p>
                  </div>
                  {pendingProfileEdits.length > 0 && (
                    <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {pendingProfileEdits.length}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-lg p-8 border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">الإجراءات السريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Link href="/admin/add-activity">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة نشاط
                </Button>
              </Link>
              <Link href="/admin/add-article">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  مقالة جديدة
                </Button>
              </Link>
              <Link href="/admin/add-achievement">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4" />
                  إنجاز جديد
                </Button>
              </Link>
              <Link href="/admin/add-member">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  عضو جديد
                </Button>
              </Link>
              <Link href="/admin/external-links">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  روابط
                </Button>
              </Link>
              <Link href="/admin/registration-requests">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  طلبات التسجيل
                </Button>
              </Link>
              <Link href="/admin/profile-edit-requests">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <FileEdit className="w-4 h-4" />
                  طلبات تعديل البيانات
                </Button>
              </Link>
              <Link href="/admin/basir-settings">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <Bot className="w-4 h-4" />
                  إعدادات بصير
                </Button>
              </Link>
              <Link href="/admin/work-teams">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <UsersRound className="w-4 h-4" />
                  فرق العمل
                </Button>
              </Link>
              <Link href="/admin/teams">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <UsersRound className="w-4 h-4" />
                  إدارة الفرق
                </Button>
              </Link>
              <Link href="/admin/registration-settings">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <UserCog className="w-4 h-4" />
                  إعدادات التسجيل
                </Button>
              </Link>
              {user?.role === "tech_admin" && (
                <Link href="/admin/work-logs">
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
                    <FileClock className="w-4 h-4" />
                    سجلات العمل
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderSupervisorDashboard = () => (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            لوحة تحكم المشرف
          </h1>
          <p className="text-lg text-muted-foreground">
            أهلاً بك {user?.name || "المشرف"} - يمكنك نشر وتعديل المحتوى
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/admin/activities">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <Calendar className="w-8 h-8 text-blue-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">الأنشطة</p>
                <p className="text-3xl font-bold text-foreground">{activities?.length || 0}</p>
              </Card>
            </Link>

            <Link href="/admin/articles">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <FileText className="w-8 h-8 text-purple-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">المقالات</p>
                <p className="text-3xl font-bold text-foreground">{articles?.length || 0}</p>
              </Card>
            </Link>

            <Link href="/admin/add-achievement">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <Trophy className="w-8 h-8 text-yellow-500 mb-4" />
                <p className="text-muted-foreground text-sm mb-2">الإنجازات</p>
                <p className="text-3xl font-bold text-foreground">-</p>
              </Card>
            </Link>
          </div>

          <div className="bg-card rounded-lg p-8 border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">الإجراءات السريعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/admin/add-activity">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة نشاط
                </Button>
              </Link>
              <Link href="/admin/add-article">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  مقالة جديدة
                </Button>
              </Link>
              <Link href="/admin/add-achievement">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4" />
                  إنجاز جديد
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderCommitteeHeadDashboard = () => (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            لوحة تحكم مشرف الفريق
          </h1>
          <p className="text-lg text-muted-foreground">
            أهلاً بك {user?.name || "مشرف الفريق"} - يمكنك إدارة فريقك
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container space-y-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              أي إجراء تقوم به على فريقك (إضافة/إخراج أعضاء، الإظهار أو الإخفاء، فتح أو إغلاق الدردشة) يحتاج موافقة المسؤول أولاً، إلا إذا مَنَحك المسؤول صلاحية التصرف الحر في فريقك.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>إدارة فريقي</CardTitle>
                <CardDescription>الأعضاء، الظهور، والدردشة، وحالة طلباتك</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/my-team">
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    الذهاب إلى إدارة الفريق
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>الفرق</CardTitle>
                <CardDescription>تصفح جميع الفرق وادخل إلى دردشة فريقك</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/teams">
                  <Button variant="outline" className="w-full">
                    الذهاب إلى صفحة الفرق
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );

  switch (user.role) {
    case "admin":
    case "general_agent":
    case "tech_admin":
      return renderAdminDashboard();
    case "supervisor":
      return renderSupervisorDashboard();
    case "committee_head":
      return renderCommitteeHeadDashboard();
    default:
      return null;
  }
}
