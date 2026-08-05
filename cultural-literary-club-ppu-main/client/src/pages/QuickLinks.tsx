import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Link2 } from "lucide-react";

export default function QuickLinks() {
  const { data: links, isLoading } = trpc.externalLinks.list.useQuery();

  const activeLinks = links?.filter((link) => link.isActive) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            الروابط السريعة
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            جميع الروابط والمصادر المهمة في مكان واحد
          </p>
        </div>
      </section>

      {/* Links Grid */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : activeLinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full border-r-4 border-r-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground mb-2">
                          {link.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {link.type === "social"
                            ? "وسائل تواصل"
                            : link.type === "admin"
                            ? "بيانات المسؤولين"
                            : "رابط خارجي"}
                        </p>
                        <p className="text-xs text-accent truncate">{link.url}</p>
                      </div>
                      <ExternalLink className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Link2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-lg">
                لا توجد روابط حالياً
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
