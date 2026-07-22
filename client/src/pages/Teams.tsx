import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Lock, Crown, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Teams() {
  const { user, isLoading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();

  const { data: teams, isLoading } = trpc.teams.listForCurrentUser.useQuery(undefined, {
    enabled: !!user,
  });

  const requestJoin = trpc.teamJoinRequests.create.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب الانضمام، بانتظار الموافقة");
      utils.teams.listForCurrentUser.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "تعذر إرسال الطلب");
    },
  });

  if (authLoading || !user) {
    return (
      <div className="container py-16" dir="rtl">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            الفرق
          </h1>
          <p className="text-lg text-muted-foreground">
            فرق العمل الداخلية للنادي — انضم إلى فريقك، تعرّف على زملائك، وتواصل معهم في مساحة خاصة
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : !teams || teams.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              لا توجد فرق متاحة حالياً
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="p-6 flex flex-col gap-4 border border-border hover:border-accent/40 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold text-foreground">{team.name}</h3>
                    {team.isHead && (
                      <Badge className="bg-accent/15 text-accent border border-accent/30 gap-1 shrink-0">
                        <Crown className="w-3 h-3" />
                        مشرف الفريق
                      </Badge>
                    )}
                  </div>

                  {team.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {team.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {team.memberCount} عضو
                    </span>
                    {!team.isVisible && (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        غير مرئي للخارج
                      </span>
                    )}
                    {team.isMember && (
                      <span className="flex items-center gap-1 text-accent">
                        <MessageCircle className="w-3.5 h-3.5" />
                        الدردشة {team.isChatOpen ? "مفتوحة" : "مغلقة"}
                      </span>
                    )}
                  </div>

                  {team.isMember ? (
                    <Link href={`/teams/${team.id}`}>
                      <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        الدخول إلى الفريق
                      </Button>
                    </Link>
                  ) : team.hasPendingJoinRequest ? (
                    <Button disabled variant="outline" className="w-full gap-2">
                      <Clock className="w-4 h-4" />
                      طلبك قيد المراجعة
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={requestJoin.isPending}
                      onClick={() => requestJoin.mutate({ teamId: team.id })}
                    >
                      طلب الانضمام
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
