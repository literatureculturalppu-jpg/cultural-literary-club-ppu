import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, MapPin, Clock, ChevronDown, ChevronUp,
  Link2, FileText, Tag, UserCheck, UserPlus, Users, Pin, Search
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import ShareButtons from "@/components/ShareButtons";
import ActivityRegistrationModal from "@/components/ActivityRegistrationModal";
import { useState } from "react";
import { toast } from "sonner";
import { useInfiniteReveal } from "@/hooks/useInfiniteReveal";

interface ActivityContent {
  category?: string;
  links?: string[];
  pdf?: { url: string; key: string; name: string } | null;
}

function parseContent(c: string | null | undefined): ActivityContent {
  if (!c) return {};
  try { return JSON.parse(c) as ActivityContent; } catch { return {}; }
}

function computeStatus(startDate: Date | string, endDate?: Date | string | null) {
  const now = new Date(), start = new Date(startDate), end = endDate ? new Date(endDate) : null;
  if (now < start) return "upcoming";
  if (end && now > end) return "completed";
  if (!end && now > start) return "completed";
  return "ongoing";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "upcoming") return <Badge className="bg-blue-500/15 text-blue-600 border border-blue-200">قادم</Badge>;
  if (status === "ongoing")  return <Badge className="bg-green-500/15 text-green-600 border border-green-200">جاري</Badge>;
  return <Badge className="bg-gray-500/15 text-gray-500 border border-gray-200">منهي</Badge>;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}
function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

// ─── Activity Card ────────────────────────────────────────────────────────────
function ActivityCard({
  activity,
  isSubscribed,
  onSubscriptionChanged,
}: {
  activity: any;
  isSubscribed: boolean;
  onSubscriptionChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();

  const status   = computeStatus(activity.startDate, activity.endDate);
  const content  = parseContent(activity.content);
  const hasLinks = !!(content.links && content.links.length > 0);
  const hasPdf   = !!content.pdf;
  const isAdmin  = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";

  const memberSubscribe = trpc.activities.subscribe.useMutation({
    onSuccess: () => { toast.success("تم إرسال طلب تسجيلك! سيتم مراجعته من قبل الإدارة."); onSubscriptionChanged(); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });
  const unsubscribe = trpc.activities.unsubscribe.useMutation({
    onSuccess: () => { toast.success("تم إلغاء تسجيلك."); onSubscriptionChanged(); },
    onError: e => toast.error("حدث خطأ: " + e.message),
  });
  const pinToggle = trpc.activityPin.toggle.useMutation({
    onSuccess: () => toast.success(activity.isPinned ? "تم إلغاء التثبيت" : "تم تثبيت النشاط"),
  });

  const handleRegister = () => {
    if (user) memberSubscribe.mutate(activity.id);
    else setShowModal(true);
  };

  return (
    <>
      {showModal && (
        <ActivityRegistrationModal
          activity={{ id: activity.id, title: activity.title }}
          onRegistered={onSubscriptionChanged}
          onClose={() => { setShowModal(false); onSubscriptionChanged(); }}
        />
      )}

      <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col ${activity.isPinned ? "ring-2 ring-accent" : ""}`}>
        {/* صورة */}
        {activity.imageUrl && (
          <div className="relative overflow-hidden bg-muted">
            <img src={activity.imageUrl} alt={activity.title}
              className="w-full object-cover" style={{ maxHeight: "260px", objectFit: "cover" }}
              loading="lazy" decoding="async" />
            <div className="absolute top-3 right-3 flex gap-2">
              <StatusBadge status={status} />
              {activity.isPinned && (
                <Badge className="bg-accent/90 text-white"><Pin className="w-3 h-3 ml-1" />مثبّت</Badge>
              )}
            </div>
            {content.category && (
              <div className="absolute bottom-3 right-3">
                <span className="flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                  <Tag className="w-3 h-3" />{content.category}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-bold text-foreground leading-snug flex-1">{activity.title}</h3>
            {!activity.imageUrl && <StatusBadge status={status} />}
          </div>
          {content.category && !activity.imageUrl && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Tag className="w-3 h-3" /><span>{content.category}</span>
            </div>
          )}

          {/* قبل التوسيع */}
          {!expanded && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">{activity.description}</p>
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-accent" />
                  <span>{formatDate(activity.startDate)} — {formatTime(activity.startDate)}</span>
                </div>
                {activity.location && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-accent" /><span>{activity.location}</span>
                  </div>
                )}
              </div>
              {(hasLinks || hasPdf) && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/50">
                  {hasLinks && <span className="flex items-center gap-1 text-xs font-medium text-accent"><Link2 className="w-3 h-3" />روابط مرفقة</span>}
                  {hasPdf && <span className="flex items-center gap-1 text-xs font-medium text-accent"><FileText className="w-3 h-3" />ملف مرفق</span>}
                </div>
              )}
            </>
          )}

          {/* بعد التوسيع */}
          {expanded && (
            <div className="mb-4 space-y-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">وصف النشاط</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{activity.description}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">التفاصيل</h4>
                <div className="grid gap-2">
                  <InfoRow icon={<Calendar className="w-4 h-4 text-accent" />} label="وقت البدء" value={`${formatDate(activity.startDate)} — ${formatTime(activity.startDate)}`} />
                  {activity.endDate && <InfoRow icon={<Clock className="w-4 h-4 text-accent" />} label="وقت الانتهاء" value={`${formatDate(activity.endDate)} — ${formatTime(activity.endDate)}`} />}
                  {activity.location && <InfoRow icon={<MapPin className="w-4 h-4 text-accent" />} label="المكان" value={activity.location} />}
                  {content.category && <InfoRow icon={<Tag className="w-4 h-4 text-accent" />} label="الفئة" value={content.category} />}
                </div>
              </div>
              {hasLinks && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />الروابط المرفقة</h4>
                  <ul className="space-y-2">
                    {content.links!.map((link, i) => (
                      <li key={i}><a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline break-all" dir="ltr"><Link2 className="w-3 h-3 shrink-0" />{link}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              {hasPdf && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1"><FileText className="w-3.5 h-3.5" />الملفات المرفقة</h4>
                  <a href={content.pdf!.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors">
                    <FileText className="w-4 h-4" />{content.pdf!.name}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* أزرار */}
          <div className="mt-auto space-y-2 pt-3 border-t border-border">
            <ShareButtons title={activity.title} url={`${window.location.origin}/activities/${activity.id}`} description={activity.description} />
            {isSubscribed ? (
              <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => unsubscribe.mutate(activity.id)} disabled={unsubscribe.isPending}>
                <UserCheck className="w-4 h-4 ml-2" />{unsubscribe.isPending ? "جاري الإلغاء..." : "إلغاء التسجيل"}
              </Button>
            ) : (
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleRegister} disabled={memberSubscribe.isPending}>
                <UserPlus className="w-4 h-4 ml-2" />{memberSubscribe.isPending ? "جاري الإرسال..." : "التسجيل في النشاط"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 flex items-center justify-center gap-1" onClick={() => setExpanded(!expanded)}>
                {expanded ? <><ChevronUp className="w-4 h-4" />إخفاء التفاصيل</> : <><ChevronDown className="w-4 h-4" />اقرأ النشاط</>}
              </Button>
              {isAdmin && (
                <>
                  <Link href={`/admin/activities/${activity.id}/registrations`}>
                    <Button variant="outline" title="المسجلون"><Users className="w-4 h-4" /></Button>
                  </Link>
                  <Button variant="outline" title={activity.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                    onClick={() => pinToggle.mutate({ id: activity.id, isPinned: !activity.isPinned })}>
                    <Pin className={`w-4 h-4 ${activity.isPinned ? "text-accent" : ""}`} />
                  </Button>
                  <Link href={`/admin/activities/${activity.id}/edit`}>
                    <Button variant="outline">تعديل</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">{icon}</div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium text-foreground">{value}</p></div>
    </div>
  );
}

export default function Activities() {
  const { data: activities, isLoading } = trpc.activities.list.useQuery();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: subscribedActivityIds = [] } = trpc.activities.mySubscriptionActivityIds.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 15_000,
  });
  const isAdmin = user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor";
  const [query, setQuery] = useState("");
  const subscribedIds = new Set(subscribedActivityIds);
  const refreshSubscriptions = () => {
    void utils.activities.mySubscriptionActivityIds.invalidate();
  };

  const filtered = (activities ?? []).filter((a: any) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const content = parseContent(a.content);
    return (
      a.title?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q) ||
      content.category?.toLowerCase().includes(q)
    );
  });

  const pinned = filtered.filter((a: any) => a.isPinned) ?? [];
  const rest = filtered.filter((a: any) => !a.isPinned) ?? [];
  const { visibleCount, sentinelRef } = useInfiniteReveal(rest.length);

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">الأنشطة والفعاليات</h1>
              <p className="text-lg text-muted-foreground max-w-2xl">اكتشف أنشطة النادي الثقافي الأدبي المتنوعة</p>
            </div>
            {isAdmin && (
              <Link href="/admin/activities/create">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">إضافة نشاط</Button>
              </Link>
            )}
          </div>
          <div className="relative max-w-md mt-8">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن نشاط بالعنوان أو الوصف أو المكان..."
              className="w-full py-2.5 pr-11 pl-4 bg-background border border-border rounded-full text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-52 w-full" />
                  <div className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /></div>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Pin className="w-5 h-5 text-accent" />الأنشطة المثبّتة
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pinned.map((a: any) => <ActivityCard key={a.id} activity={a} isSubscribed={subscribedIds.has(a.id)} onSubscriptionChanged={refreshSubscriptions} />)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.length > 0
                  ? rest.slice(0, visibleCount).map((a: any) => <ActivityCard key={a.id} activity={a} isSubscribed={subscribedIds.has(a.id)} onSubscriptionChanged={refreshSubscriptions} />)
                  : pinned.length === 0 && (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground text-lg">
                          {query.trim() ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد أنشطة حالياً"}
                        </p>
                      </div>
                    )
                }
              </div>
              {/* Sentinel: reveals the next batch of cards (and their images) only once scrolled into view */}
              {visibleCount < rest.length && <div ref={sentinelRef} className="h-1" />}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
