import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Calendar, Building2, Search, Pin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import ShareButtons from "@/components/ShareButtons";
import { useInfiniteReveal } from "@/hooks/useInfiniteReveal";
import { useState } from "react";

export default function Achievements() {
  const { data: achievements, isLoading, refetch } = trpc.achievements.list.useQuery();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const togglePin = trpc.contentPins.toggle.useMutation({
    onSuccess: (_, variables) => { toast.success(variables.isPinned ? "تم تثبيت الإنجاز" : "تم إلغاء تثبيت الإنجاز"); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "award":
        return "bg-yellow-100 text-yellow-800";
      case "achievement":
        return "bg-blue-100 text-blue-800";
      case "milestone":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "award":
        return "جائزة";
      case "achievement":
        return "إنجاز";
      case "milestone":
        return "علامة فارقة";
      default:
        return "عام";
    }
  };

  const filtered = (achievements ?? []).filter((a: any) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.awardName?.toLowerCase().includes(q) ||
      a.awardingOrganization?.toLowerCase().includes(q) ||
      getCategoryLabel(a.category).toLowerCase().includes(q) ||
      String(a.year).includes(q)
    );
  });
  const { visibleCount, sentinelRef } = useInfiniteReveal(filtered.length);

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                إنجازات النادي
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                استعرض الجوائز والإنجازات التي حققها النادي الثقافي الأدبي
              </p>
            </div>
            {(user?.role === "admin" || user?.role === "club_president" || user?.role === "vice_president" || user?.role === "public_relations_officer" || user?.role === "tech_admin") && (
              <Link href="/admin/achievements/create">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  إضافة إنجاز
                </Button>
              </Link>
            )}
          </div>
          <div className="relative max-w-md mt-8">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن إنجاز بالعنوان أو الجائزة أو الجهة المانحة..."
              className="w-full py-2.5 pr-11 pl-4 bg-background border border-border rounded-full text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </section>

      {/* Achievements Grid */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.length > 0 ? (
                filtered.slice(0, visibleCount).map((achievement) => (
                  <Card
                    key={achievement.id}
                    className={`overflow-hidden hover:shadow-lg transition-shadow flex flex-col ${achievement.isPinned ? "ring-1 ring-accent/60" : ""}`}
                  >
                    {achievement.imageUrl && (
                      <div className="relative h-48 overflow-hidden bg-gray-100">
                        <img 
                          src={achievement.imageUrl}
                          alt={achievement.title}
                          className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        <div className="absolute top-0 right-0 p-3">
                          <Award className="w-6 h-6 text-yellow-500 drop-shadow" />
                        </div>
                        {achievement.isPinned ? <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground"><Pin className="w-3 h-3 ml-1 fill-current" /> مثبت</Badge> : null}
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <h3 className="text-xl font-bold text-foreground flex-1">
                          {achievement.title}
                        </h3>
                        {!achievement.imageUrl && achievement.isPinned ? <Pin className="w-4 h-4 text-accent fill-current shrink-0" aria-label="إنجاز مثبت" /> : null}
                      </div>

                      <Badge className={`w-fit mb-3 ${getCategoryColor(achievement.category)}`}>
                        {getCategoryLabel(achievement.category)}
                      </Badge>

                      <p className="text-muted-foreground text-sm mb-4 flex-1">
                        {achievement.description}
                      </p>

                      {achievement.awardName && (
                        <div className="mb-4 p-3 bg-accent/10 rounded-lg">
                          <p className="text-sm font-semibold text-foreground mb-1">
                            {achievement.awardName}
                          </p>
                          {achievement.awardingOrganization && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {achievement.awardingOrganization}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 text-sm text-muted-foreground mb-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{achievement.year}</span>
                        </div>
                      </div>

                      {achievement.details && (
                        <p className="text-xs text-muted-foreground mb-4 p-3 bg-muted rounded">
                          {achievement.details}
                        </p>
                      )}

                      {achievement.articleId && (
                        <Link href={`/articles/${achievement.articleId}`}>
                          <Button variant="link" className="px-0 h-auto mb-4 text-accent">
                            قراءة المقالة المرتبطة ←
                          </Button>
                        </Link>
                      )}

                      <div className="space-y-3 pt-4 border-t border-border">
                        <ShareButtons
                          title={achievement.awardName || achievement.description}
                          url={`${window.location.origin}/achievements`}
                          description={achievement.details || ""}
                        />
                        {(user?.role === "admin" || user?.role === "club_president" || user?.role === "vice_president" || user?.role === "public_relations_officer" || user?.role === "tech_admin") && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="icon" title={achievement.isPinned ? "إلغاء تثبيت الإنجاز" : "تثبيت الإنجاز"} onClick={() => togglePin.mutate({ type: "achievement", id: achievement.id, isPinned: !achievement.isPinned })}>
                              <Pin className={`w-4 h-4 ${achievement.isPinned ? "fill-current text-accent" : ""}`} />
                            </Button>
                            <Link href={`/admin/achievements/${achievement.id}/edit`}>
                              <Button variant="outline" className="flex-1 text-xs">
                                تعديل
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground text-lg">
                    {query.trim() ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد إنجازات حالياً"}
                  </p>
                </div>
              )}
            </div>
          )}
          {visibleCount < filtered.length && <div ref={sentinelRef} className="h-1" />}
        </div>
      </section>

      {/* Timeline Section */}
      {achievements && achievements.length > 0 && (
        <section className="py-16 md:py-24 bg-card border-t border-border">
          <div className="container">
            <h2 className="text-3xl font-bold text-foreground mb-12 text-center">
              الإنجازات عبر السنوات
            </h2>
            <div className="space-y-6 max-w-2xl mx-auto">
              {achievements
                .sort((a, b) => b.year - a.year)
                .reduce((acc, achievement) => {
                  const year = achievement.year;
                  if (!acc[year]) {
                    acc[year] = [];
                  }
                  acc[year].push(achievement);
                  return acc;
                }, {} as Record<number, typeof achievements>)
                ? Object.entries(
                    achievements
                      .sort((a, b) => b.year - a.year)
                      .reduce((acc, achievement) => {
                        const year = achievement.year;
                        if (!acc[year]) {
                          acc[year] = [];
                        }
                        acc[year].push(achievement);
                        return acc;
                      }, {} as Record<number, typeof achievements>)
                  ).map(([year, yearAchievements]) => (
                    <div key={year} className="relative pl-8 border-l-2 border-accent">
                      <div className="absolute left-0 top-0 w-4 h-4 bg-accent rounded-full -translate-x-2.5"></div>
                      <h3 className="text-2xl font-bold text-accent mb-4">{year}</h3>
                      <div className="space-y-3">
                        {yearAchievements.map((achievement) => (
                          <div key={achievement.id} className="text-sm">
                            <p className="font-semibold text-foreground">
                              {achievement.title}
                            </p>
                            {achievement.awardName && (
                              <p className="text-muted-foreground text-xs">
                                {achievement.awardName}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
