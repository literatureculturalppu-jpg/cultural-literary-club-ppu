import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Calendar, MapPin, Trash2, Edit2, Plus, Tag, Link2, FileText, Clock } from "lucide-react";
import { toast } from "sonner";

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

export default function AdminActivities() {
  const { user } = useAuth();

  if (user?.role !== "admin" && user?.role !== "general_agent" && user?.role !== "tech_admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            غير مصرح لك بالوصول إلى هذه الصفحة
          </h1>
          <Link href="/">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              العودة إلى الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { data: activities = [], refetch } = trpc.activities.list.useQuery();
  const deleteActivity = trpc.activities.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف النشاط بنجاح");
      refetch();
    },
    onError: () => toast.error("حدث خطأ أثناء حذف النشاط"),
  });

  const handleDelete = (id: number) => {
    if (confirm("هل تريد حذف هذا النشاط؟")) {
      deleteActivity.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                إدارة الأنشطة
              </h1>
              <p className="text-lg text-muted-foreground">إدارة أنشطة وفعاليات النادي</p>
            </div>
            <Link href="/admin">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                العودة
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="mb-8">
            <Link href="/admin/activities/create">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 ml-2" />
                إضافة نشاط جديد
              </Button>
            </Link>
          </div>

          {activities.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">لا توجد أنشطة حالياً</p>
            </Card>
          ) : (
            <div className="grid gap-6">
              {activities.map((activity) => {
                const status = computeStatus(activity.startDate, activity.endDate);
                const contentData = parseContent(activity.content);
                const hasLinks = contentData.links && contentData.links.length > 0;
                const hasPdf = !!contentData.pdf;

                return (
                  <Card key={activity.id} className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 flex-1">
                        {activity.imageUrl && (
                          <img 
                            src={activity.imageUrl}
                            alt={activity.title}
                            className="w-20 h-20 object-cover rounded-lg shrink-0" loading="lazy" decoding="async" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-xl font-bold text-foreground">
                              {activity.title}
                            </h3>
                            {getStatusBadge(status)}
                          </div>
                          {contentData.category && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Tag className="w-3 h-3" />
                              <span>{contentData.category}</span>
                            </div>
                          )}
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                            {activity.description}
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {new Date(activity.startDate).toLocaleDateString("ar-SA", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  weekday: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {activity.endDate && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {new Date(activity.endDate).toLocaleDateString("ar-SA", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    weekday: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            )}
                            {activity.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{activity.location}</span>
                              </div>
                            )}
                            {hasLinks && (
                              <div className="flex items-center gap-1 text-accent">
                                <Link2 className="w-4 h-4" />
                                <span>{contentData.links!.length} رابط</span>
                              </div>
                            )}
                            {hasPdf && (
                              <div className="flex items-center gap-1 text-accent">
                                <FileText className="w-4 h-4" />
                                <span>ملف PDF</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/admin/activities/${activity.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(activity.id)}
                          disabled={deleteActivity.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
