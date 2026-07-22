import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users } from "lucide-react";

// تاريخ تأسيس النادي — يبدأ عداد العمر من هذا التاريخ
const CLUB_FOUNDING_DATE = new Date(2026, 0, 1); // 1/1/2026

function getClubAge(from: Date, to: Date = new Date()) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  if (to.getDate() < from.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    years = 0;
    months = 0;
  }
  return { years, months };
}

function ClubAgeCounter() {
  const { years, months } = getClubAge(CLUB_FOUNDING_DATE);

  const yearsLabel = years === 1 ? "سنة" : years === 2 ? "سنتان" : years >= 3 && years <= 10 ? "سنوات" : "سنة";
  const monthsLabel = months === 1 ? "شهر" : months === 2 ? "شهران" : months >= 3 && months <= 10 ? "أشهر" : "شهر";

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {years > 0 && (
          <div>
            <div className="text-5xl font-bold text-accent">{years}</div>
            <p className="text-muted-foreground text-sm mt-1">{yearsLabel}</p>
          </div>
        )}
        <div>
          <div className="text-5xl font-bold text-accent">{months}</div>
          <p className="text-muted-foreground text-sm mt-1">{monthsLabel}</p>
        </div>
      </div>
      <p className="text-muted-foreground mt-3">من العطاء والإنجاز منذ التأسيس</p>
    </div>
  );
}

export default function About() {
  const { data: teamMembers, isLoading } = trpc.teamMembers.list.useQuery();
  const { data: workTeams, isLoading: workTeamsLoading } = trpc.workTeams.list.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            عن <span className="text-accent">النادي الثقافي الأدبي</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            تعرف على تاريخ النادي وأهدافه وفريق العمل المميز
          </p>
        </div>
      </section>

      {/* History Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">
            نبذة تاريخية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground leading-relaxed">
                تأسس النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين برؤية واضحة لإثراء الحياة الثقافية والأدبية بين طلاب الجامعة، من خلال الأدب والفكر والفنون بمختلف تجلياتها. ويحتل الاعتناء باللغة العربية وآدابها مكانة خاصة ضمن اهتمامات النادي، بوصفها جزءاً أصيلاً من هويتنا الثقافية.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                منذ تأسيسه، نجح النادي في تنظيم العديد من الفعاليات والأنشطة الثقافية التي أثرت المجتمع الجامعي، وأسهمت في بناء مجتمع طلابي واعٍ ومحب للأدب والثقافة بكل روافدها.
              </p>
              <p
                dir="rtl"
                className="font-diwani text-xl md:text-2xl leading-[2.1] text-accent border-r-4 border-accent/40 pr-4 mt-2"
              >
                وَتَبْقَى اللُّغَةُ الْعَرَبِيَّةُ فِي قَلْبِ النَّادِي مَحَبَّةً لَا تَنْقَضِي، فَهِيَ لُغَةُ الضَّادِ الَّتِي حَمَلَتْ الْبَيَانَ، وَمَا زَالَتْ رَافِدًا مِنْ رَوَافِدِ ثَقَافَتِنَا وَهُوِيَّتِنَا.
              </p>
            </div>
            <div className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg p-8 flex items-center justify-center">
              <ClubAgeCounter />
            </div>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-foreground">
            أهدافنا
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                title: "إثراء الحياة الأدبية",
                description: "تنظيم أنشطة وفعاليات في الأدب والشعر والقصة والفنون",
              },
              {
                number: "02",
                title: "تطوير المهارات",
                description: "تنمية مهارات الطلاب الكتابية والنقدية والإبداعية",
              },
              {
                number: "03",
                title: "بناء مجتمع ثقافي",
                description: "خلق بيئة ثقافية نشطة تجمع الطلاب المهتمين بالأدب والفكر",
              },
              {
                number: "04",
                title: "الحفاظ على التراث",
                description: "الحفاظ على التراث الثقافي والأدبي وتقديمه بروح معاصرة",
              },
              {
                number: "05",
                title: "الاعتناء باللغة العربية",
                description: "إبراز جمال اللغة العربية وآدابها كأحد اهتمامات النادي الأصيلة",
              },
              {
                number: "06",
                title: "المشاركة المجتمعية",
                description: "المساهمة الفعالة في الأنشطة الثقافية على مستوى الجامعة",
              },
            ].map((objective, index) => (
              <Card key={index} className="p-6 border-t-4 border-t-accent hover:shadow-lg transition-shadow">
                <div className="text-3xl font-bold text-accent mb-3">
                  {objective.number}
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">
                  {objective.title}
                </h3>
                <p className="text-muted-foreground">
                  {objective.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Work Teams Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-foreground">
            فرق العمل وأعضاؤهم
          </h2>
          {workTeamsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-48 w-full mb-4 rounded-lg" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : workTeams && workTeams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workTeams.map((team) => (
                <Link key={team.id} href={`/work-teams/${team.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full group">
                    {team.imageUrl ? (
                      <div className="relative h-48 overflow-hidden bg-gray-100">
                        <img 
                          src={team.imageUrl}
                          alt={team.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                        <div className="absolute bottom-0 right-0 left-0 p-4 text-white">
                          <h3 className="text-xl font-bold drop-shadow-lg">
                            {team.name}
                          </h3>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                        <div className="text-center">
                          <Users className="w-12 h-12 text-accent mx-auto mb-2" />
                          <h3 className="text-xl font-bold text-foreground">
                            {team.name}
                          </h3>
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      {team.mission && (
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {team.mission}
                        </p>
                      )}
                      <p className="text-accent text-sm mt-2 font-medium">
                        انقر لعرض أعضاء الفريق &larr;
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-lg">
                سيتم إضافة فرق العمل قريباً
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
