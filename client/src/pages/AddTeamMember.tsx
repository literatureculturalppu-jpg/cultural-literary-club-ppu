import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AddTeamMember() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    email: "",
    bio: "",
  });

  const createTeamMember = trpc.teamMembers.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة عضو الفريق بنجاح!");
      setLocation("/about");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.position) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    createTeamMember.mutate({
      name: formData.name,
      position: formData.position,
      email: formData.email,
      bio: formData.bio,
      imageUrl: "",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/about">
              <Button variant="outline" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              إضافة عضو فريق عمل جديد
            </h1>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="أدخل الاسم الكامل"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المنصب *
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="مثال: رئيس النادي، نائب الرئيس"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="أدخل البريد الإلكتروني"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نبذة عن العضو
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="أدخل نبذة عن العضو"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={createTeamMember.isPending}
                >
                  {createTeamMember.isPending ? "جاري الحفظ..." : "حفظ عضو الفريق"}
                </Button>
                <Link href="/about">
                  <Button variant="outline" className="flex-1">
                    إلغاء
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
