import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Users, Sparkles, Calendar, Award, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: achievements, isLoading: achievementsLoading } = trpc.achievements.list.useQuery();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "already_registered") {
      toast.info("لديك حساب بالفعل في النادي، تم تسجيل دخولك مباشرة.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "award": return "جائزة";
      case "achievement": return "إنجاز";
      case "milestone": return "علامة فارقة";
      default: return "عام";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-accent/10 to-background py-20 md:py-32">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
                <span className="text-accent">النادي الثقافي الأدبي</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                نادٍ ثقافي أدبي في جامعة بوليتكنك فلسطين، يفتح آفاقه للأدب والفكر والفنون بمختلف أشكالها، ويحتضن اللغة العربية كواحدة من أهم اهتماماته ومصادر إلهامه
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/activities">
                  <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                    استكشف الأنشطة
                  </Button>
                </Link>
                <Link href="/articles">
                  <Button variant="outline" className="w-full sm:w-auto">
                    اقرأ المقالات
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative h-64 md:h-96 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center">
              <BookOpen className="w-32 h-32 text-accent/30" />
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">
            رؤيتنا ورسالتنا
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8 border-l-4 border-l-accent">
              <h3 className="text-2xl font-bold mb-4 text-accent">رؤيتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                أن نكون نادياً رائداً في الحياة الثقافية والأدبية داخل الجامعة، نلهم الطلاب لاكتشاف الأدب والفكر والفنون، ونرسّخ مكانة اللغة العربية بوصفها إحدى ركائز هويتنا الثقافية.
              </p>
            </Card>
            <Card className="p-8 border-l-4 border-l-accent">
              <h3 className="text-2xl font-bold mb-4 text-accent">رسالتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                تنمية الذائقة الأدبية والثقافية لدى الطلاب من خلال أنشطة وفعاليات متنوعة في الأدب والفكر والفنون، وتوفير منصة حرة للتعبير والإبداع، مع الاعتناء باللغة العربية وآدابها كأحد اهتماماتنا الأصيلة.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">
            ما يميزنا
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Sparkles,
                title: "أنشطة متنوعة",
                description: "محاضرات وورش عمل وفعاليات ثقافية مختلفة",
              },
              {
                icon: BookOpen,
                title: "محتوى ثقافي",
                description: "مقالات وقراءات في الأدب والفكر والفنون، وجانب خاص للغة العربية",
              },
              {
                icon: Users,
                title: "مجتمع نشط",
                description: "شبكة من الطلاب المهتمين بالأدب والثقافة بمختلف اهتماماتهم",
              },
              {
                icon: Calendar,
                title: "فعاليات منتظمة",
                description: "برامج ودورات تدريبية طوال العام",
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <Icon className="w-12 h-12 text-accent mb-4" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Achievements Showcase Section */}
      <section className="py-16 md:py-24 bg-accent/5 border-t border-border">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              إنجازاتنا
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              أبرز الإنجازات والجوائز التي حققها النادي الثقافي الأدبي
            </p>
          </div>
          {achievementsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : achievements && achievements.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.slice(0, 6).map((achievement) => (
                  <Link key={achievement.id} href={`/achievements/${achievement.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                      {achievement.imageUrl && (
                        <div className="relative h-40 overflow-hidden bg-gray-100">
                          <img 
                            src={achievement.imageUrl}
                            alt={achievement.title}
                            className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          <div className="absolute top-0 right-0 p-2">
                            <Award className="w-5 h-5 text-yellow-500 drop-shadow" />
                          </div>
                        </div>
                      )}
                      <div className="p-4">
                        <Badge className="mb-2 text-xs">
                          {getCategoryLabel(achievement.category)}
                        </Badge>
                        <h3 className="text-lg font-bold text-foreground mb-1">
                          {achievement.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {achievement.description}
                        </p>
                        {achievement.awardingOrganization && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {achievement.awardingOrganization}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link href="/achievements">
                  <Button variant="outline" className="px-8">
                    عرض جميع الإنجازات
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">سيتم إضافة الإنجازات قريباً</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
