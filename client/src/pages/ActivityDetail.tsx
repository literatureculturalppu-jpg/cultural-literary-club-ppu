import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Link2, FileText, Tag, ArrowRight, UserCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import ActivityRegistrationModal from "@/components/ActivityRegistrationModal";

interface ActivityContent {
  category?: string;
  links?: string[];
  pdf?: { url: string; key: string; name: string } | null;
}

function parseContent(content: string | null | undefined): ActivityContent {
  if (!content) return {};
  try {
    return JSON.parse(content) as ActivityContent;
  } catch {
    return {};
  }
}

function computeStatus(startDate: Date | string, endDate?: Date | string | null): "upcoming" | "ongoing" | "completed" {
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (now < start) return "upcoming";
  if (end && now > end) return "completed";
  if (!end && now > start) return "completed";
  return "ongoing";
}

function getStatusBadge(status: "upcoming" | "ongoing" | "completed") {
  switch (status) {
    case "upcoming":
      return <Badge className="bg-blue-500 text-white">قادم</Badge>;
    case "ongoing":
      return <Badge className="bg-green-500 text-white">جاري</Badge>;
    case "completed":
      return <Badge className="bg-gray-500 text-white">منهي</Badge>;
  }
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityDetail() {
  const params = useParams<{ id: string }>();
  const activityId = Number.parseInt(params.id || "", 10);
  const { data: activity, isLoading } = trpc.activities.getById.useQuery(activityId);
  const { user } = useAuth();
  const [showRegistration, setShowRegistration] = useState(false);
  const { data: isSubscribed, refetch: refetchSubscription } = trpc.activities.isSubscribed.useQuery(
    { activityId },
    { enabled: Boolean(user) && Number.isInteger(activityId) },
  );
  const memberSubscribe = trpc.activities.subscribe.useMutation({
    onSuccess: () => { toast.success("تم إرسال طلب تسجيلك وسيظهر لدى إدارة النشاط للمراجعة."); void refetchSubscription(); },
    onError: (error) => toast.error(`تعذر إرسال طلب التسجيل: ${error.message}`),
  });
  const unsubscribe = trpc.activities.unsubscribe.useMutation({
    onSuccess: () => { toast.success("تم إلغاء طلب التسجيل."); void refetchSubscription(); },
    onError: (error) => toast.error(`تعذر إلغاء التسجيل: ${error.message}`),
  });

  if (isLoading) return <div className="container py-16 text-center">جاري التحميل...</div>;
  if (!activity) return <div className="container py-16 text-center">النشاط غير موجود</div>;

  const status = computeStatus(activity.startDate, activity.endDate);
  const contentData = parseContent(activity.content);
  const hasLinks = contentData.links && contentData.links.length > 0;
  const hasPdf = !!contentData.pdf;
  const canManageRegistrations = user?.role === "admin" || user?.role === "club_president" || user?.role === "vice_president" || user?.role === "public_relations_officer" || user?.role === "tech_admin" || user?.role === "supervisor";
  const registrationClosed = status === "completed";

  const handleRegistration = () => {
    if (registrationClosed) {
      toast.error("انتهت فترة التسجيل لهذا النشاط.");
      return;
    }
    if (user) {
      memberSubscribe.mutate(activityId);
      return;
    }
    setShowRegistration(true);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/activities">
              <Button variant="outline" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">{activity.title}</h1>
              {getStatusBadge(status)}
            </div>
          </div>
          {contentData.category && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Tag className="w-4 h-4" />
              <span>{contentData.category}</span>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container max-w-3xl space-y-8">
          {/* Image */}
          {activity.imageUrl && (
            <div className="rounded-xl overflow-hidden bg-muted max-h-[500px] flex items-center justify-center">
              <img 
                src={activity.imageUrl}
                alt={activity.title}
                className="w-full h-full object-contain max-h-[500px]" loading="lazy" decoding="async" />
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
              <div>
                <div className="text-muted-foreground text-xs mb-0.5">وقت البدء</div>
                <div className="text-foreground">{formatDateTime(activity.startDate)}</div>
              </div>
            </div>
            {activity.endDate && (
              <div className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                <div>
                  <div className="text-muted-foreground text-xs mb-0.5">وقت الانتهاء</div>
                  <div className="text-foreground">{formatDateTime(activity.endDate)}</div>
                </div>
              </div>
            )}
            {activity.location && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                <div>
                  <div className="text-muted-foreground text-xs mb-0.5">المكان</div>
                  <div className="text-foreground">{activity.location}</div>
                </div>
              </div>
            )}
          </div>

          <section className="rounded-xl border border-border bg-muted/20 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">التسجيل في النشاط</h2>
                <p className="mt-1 text-sm text-muted-foreground">أرسل طلبك ليظهر مباشرة لدى إدارة النشاط للمراجعة والقبول.</p>
              </div>
              <Users className="h-6 w-6 shrink-0 text-accent" />
            </div>
            {registrationClosed ? (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">انتهت فترة التسجيل لهذا النشاط.</p>
            ) : isSubscribed ? (
              <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => unsubscribe.mutate(activityId)} disabled={unsubscribe.isPending}>
                <UserCheck className="ml-2 h-4 w-4" />{unsubscribe.isPending ? "جاري الإلغاء..." : "إلغاء طلب التسجيل"}
              </Button>
            ) : (
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleRegistration} disabled={memberSubscribe.isPending}>
                <UserPlus className="ml-2 h-4 w-4" />{memberSubscribe.isPending ? "جاري الإرسال..." : "التسجيل في النشاط"}
              </Button>
            )}
            {canManageRegistrations && (
              <Link href={`/admin/activities/${activityId}/registrations`}>
                <Button variant="outline" className="mt-3 w-full"><Users className="ml-2 h-4 w-4" />عرض طلبات قبول المسجلين</Button>
              </Link>
            )}
          </section>

          {/* Description */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">وصف النشاط</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {activity.description}
            </p>
          </div>

          {/* Links */}
          {hasLinks && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                الروابط المرفقة
              </h2>
              <ul className="space-y-2">
                {contentData.links!.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline break-all text-sm"
                      dir="ltr"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PDF */}
          {hasPdf && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                الملفات المرفقة
              </h2>
              <a
                href={contentData.pdf!.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
              >
                <FileText className="w-5 h-5 text-red-500" />
                {contentData.pdf!.name}
              </a>
            </div>
          )}
        </div>
      </section>
      {showRegistration && (
        <ActivityRegistrationModal
          activity={{ id: activityId, title: activity.title }}
          onRegistered={() => void refetchSubscription()}
          onClose={() => setShowRegistration(false)}
        />
      )}
    </div>
  );
}
