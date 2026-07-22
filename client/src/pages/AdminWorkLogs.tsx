import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ShieldAlert, Users, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل الدخول",
  "auth.logout": "تسجيل الخروج",
  "activity.publish": "نشر نشاط",
  "activity.update": "تعديل نشاط",
  "activity.delete": "حذف نشاط",
  "activity.register": "التسجيل في نشاط",
  "activity.register_guest": "تسجيل ضيف في نشاط",
  "article.publish": "نشر مقال",
  "article.update": "تعديل مقال",
  "article.delete": "حذف مقال",
  "user.role_change": "تغيير صلاحية عضو",
  "user.delete": "حذف حساب عضو",
  "basir.chat": "محادثة مع بصير",
  "registration_request.approve": "قبول طلب تسجيل عضوية",
  "registration_request.reject": "رفض طلب تسجيل عضوية",
  "profile_edit_request.approve": "قبول طلب تعديل بيانات",
  "profile_edit_request.reject": "رفض طلب تعديل بيانات",
  "team_join_request.approve": "قبول طلب انضمام لفريق",
  "team_join_request.reject": "رفض طلب انضمام لفريق",
  "activity_subscription.approve": "قبول تسجيل عضو في نشاط",
  "activity_subscription.reject": "رفض تسجيل عضو في نشاط",
  "activity_guest.approve": "قبول تسجيل ضيف في نشاط",
  "activity_guest.reject": "رفض تسجيل ضيف في نشاط",
};

function formatDateTime(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogRow({ log }: { log: any }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-foreground">{log.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {log.actorName && (
            <span className="text-xs text-muted-foreground">{log.actorName}</span>
          )}
          {log.actorRole && (
            <Badge variant="outline" className="text-xs">
              {log.actorRole === "tech_admin"
                ? "المدير التقني"
                : log.actorRole === "general_agent"
                ? "وكيل عام"
                : log.actorRole === "admin"
                ? "مسؤول"
                : log.actorRole === "supervisor"
                ? "مشرف"
                : log.actorRole === "committee_head"
                ? "مشرف فريق"
                : "عضو"}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {ACTION_LABELS[log.action] || log.action}
          </Badge>
        </div>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
        {formatDateTime(log.createdAt)}
      </span>
    </div>
  );
}

export default function AdminWorkLogs() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [scope, setScope] = useState<"all" | "elevated" | "member">("all");

  const { data: logs, isLoading, refetch, isFetching } = trpc.workLogs.list.useQuery(
    { scope: scope === "all" ? undefined : scope, limit: 300 },
    { enabled: user?.role === "tech_admin" }
  );

  if (user && user.role !== "tech_admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center" dir="rtl">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-muted-foreground">
          هذه الصفحة متاحة فقط للمدير التقني.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-4xl font-bold text-right">سجلات العمل</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>
      <p className="text-muted-foreground mb-6 text-right">
        سجل تدقيق شامل: من نشر أو عدّل أو حذف نشاطًا/مقالاً، من قام بترقية أو تعديل صلاحيات عضو،
        تسجيلات الدخول والخروج، وكذلك النشاط العادي للأعضاء (محادثات بصير، والتسجيل في الأنشطة).
      </p>

      <div className="flex gap-2 mb-6">
        <Button
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          الكل
        </Button>
        <Button
          size="sm"
          variant={scope === "elevated" ? "default" : "outline"}
          onClick={() => setScope("elevated")}
        >
          أصحاب الصلاحيات
        </Button>
        <Button
          size="sm"
          variant={scope === "member" ? "default" : "outline"}
          onClick={() => setScope("member")}
        >
          نشاط الأعضاء
        </Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
        ) : logs && logs.length > 0 ? (
          <div>
            {logs.map((log: any) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3" />
            لا توجد سجلات حتى الآن
          </div>
        )}
      </Card>
    </div>
  );
}
