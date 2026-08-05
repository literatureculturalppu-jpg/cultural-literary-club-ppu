import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Settings2 } from "lucide-react";

export default function MyTeam() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { data: teams, isLoading } = trpc.teams.listByHead.useQuery(undefined, {
    enabled: user?.role === "committee_head",
  });

  if (!user) return null;

  if (user.role !== "committee_head") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-lg text-muted-foreground">غير مصرح لك بالوصول إلى هذه الصفحة</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-10 md:py-14">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">فريقي</h1>
          <p className="text-muted-foreground">
            إدارة أعضاء فريقك، ظهوره، دردشته، ومتابعة حالة طلباتك
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="container space-y-4">
          {isLoading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : !teams || teams.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              لم يُسنَد إليك أي فريق بعد. تواصل مع المسؤول.
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id} className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-foreground">{team.name}</h3>
                    <Badge className="bg-accent/15 text-accent border border-accent/30 gap-1">
                      <Crown className="w-3 h-3" />
                      مشرف الفريق
                    </Badge>
                    {!team.isVisible && <Badge variant="outline">غير مرئي للخارج</Badge>}
                    {team.headFreedom ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                        لديك حرية التصرف الكاملة
                      </Badge>
                    ) : (
                      <Badge variant="outline">إجراءاتك تحتاج موافقة المسؤول</Badge>
                    )}
                  </div>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                  )}
                </div>
                <Link href={`/teams/${team.id}`}>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                    <Settings2 className="w-4 h-4" />
                    إدارة الفريق
                  </Button>
                </Link>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
