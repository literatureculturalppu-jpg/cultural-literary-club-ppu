import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { ArrowRight, Users, User } from "lucide-react";

export default function WorkTeamDetail() {
  const params = useParams<{ id: string }>();
  const teamId = Number(params.id);

  const { data: team, isLoading: teamLoading } = trpc.workTeams.getById.useQuery(teamId);
  const { data: members, isLoading: membersLoading } = trpc.workTeams.getMembers.useQuery(teamId);

  if (teamLoading) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
          <div className="container">
            <Skeleton className="h-10 w-64 mb-4" />
            <Skeleton className="h-6 w-96" />
          </div>
        </section>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">الفريق غير موجود</h1>
          <Link href="/about">
            <Button variant="outline">العودة لصفحة عن النادي</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <Link href="/about">
            <Button variant="ghost" className="mb-4 gap-2">
              <ArrowRight className="w-4 h-4" />
              العودة لصفحة عن النادي
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-6">
            {team.imageUrl && (
              <img 
                src={team.imageUrl}
                alt={team.name}
                className="w-full md:w-64 h-48 object-cover rounded-xl shadow-md" loading="lazy" decoding="async" />
            )}
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {team.name}
              </h1>
              {team.mission && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {team.mission}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Members */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <Users className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-bold text-foreground">أعضاء الفريق</h2>
          </div>

          {membersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((member) => (
                <Card key={member.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      {member.imageUrl ? (
                        <img 
                          src={member.imageUrl}
                          alt={member.name}
                          className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-accent/20" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-8 h-8 text-accent" />
                        </div>
                      )}
                      <div className="flex-1 text-right">
                        <h3 className="font-bold text-lg text-foreground">{member.name}</h3>
                        <p className="text-accent text-sm font-medium">{member.position}</p>
                      </div>
                    </div>
                    {member.bio && (
                      <p className="text-muted-foreground text-sm leading-relaxed text-right">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-lg">
                لم يتم إضافة أعضاء لهذا الفريق بعد
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
