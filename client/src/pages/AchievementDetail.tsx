import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Building2, Calendar, ArrowRight } from "lucide-react";

const getCategoryLabel = (category: string) => {
  switch (category) {
    case "award": return "جائزة";
    case "achievement": return "إنجاز";
    case "milestone": return "علامة فارقة";
    default: return "عام";
  }
};

export default function AchievementDetail() {
  const params = useParams<{ id: string }>();
  const { data: achievement, isLoading } = trpc.achievements.getById.useQuery(parseInt(params.id || "0"));

  if (isLoading) return <div className="container py-16 text-center text-muted-foreground">جاري التحميل...</div>;
  if (!achievement) return <div className="container py-16 text-center">الإنجاز غير موجود</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <Link href="/achievements">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowRight className="w-4 h-4 ml-2" /> العودة إلى الإنجازات
            </Button>
          </Link>
          <Badge className="mb-4 w-fit">{getCategoryLabel(achievement.category)}</Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">{achievement.title}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{achievement.year}</span>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container max-w-3xl space-y-8">
          {achievement.imageUrl && (
            <div className="rounded-xl overflow-hidden bg-muted max-h-[500px] flex items-center justify-center">
              <img 
                src={achievement.imageUrl}
                alt={achievement.title}
                className="w-full h-full object-contain max-h-[500px]" loading="lazy" decoding="async" />
            </div>
          )}

          <p className="text-lg text-foreground leading-relaxed">{achievement.description}</p>

          {achievement.awardName && (
            <div className="p-4 bg-accent/10 rounded-lg">
              <p className="font-semibold text-foreground flex items-center gap-2 mb-1">
                <Award className="w-4 h-4" /> {achievement.awardName}
              </p>
              {achievement.awardingOrganization && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> {achievement.awardingOrganization}
                </p>
              )}
            </div>
          )}

          {achievement.details && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{achievement.details}</p>
            </div>
          )}

          {achievement.articleId && (
            <Link href={`/articles/${achievement.articleId}`}>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                قراءة المقالة المرتبطة بهذا الإنجاز
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
