import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { FileText, Trash2, Edit2, Plus, Calendar } from "lucide-react";

export default function AdminArticles() {
  const { user } = useAuth();

  const { data: articles = [] } = trpc.articles.list.useQuery(undefined, {
    enabled: user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin",
  });

  const deleteArticle = trpc.articles.delete.useMutation();

  // Redirect if not admin
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

  const handleDelete = (id: number) => {
    if (confirm("هل تريد حذف هذا المقال؟")) {
      deleteArticle.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                إدارة المقالات
              </h1>
              <p className="text-lg text-muted-foreground">
                إدارة المحتوى والمقالات الثقافية
              </p>
            </div>
            <Link href="/admin">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                العودة
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="mb-8">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 ml-2" />
              كتابة مقال جديد
            </Button>
          </div>

          {articles.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">لا توجد مقالات حالياً</p>
            </Card>
          ) : (
            <div className="grid gap-6">
              {articles.map((article) => (
                <Card key={article.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {article.title}
                      </h3>
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {article.excerpt || article.content?.substring(0, 200)}
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(article.createdAt).toLocaleDateString("ar-SA")}
                        </div>
                        <div className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs">
                          {article.category || "عام"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(article.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
