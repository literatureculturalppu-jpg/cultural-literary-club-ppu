import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowRight, UserPlus, Lock, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

export default function RegistrationSettings() {
  const { user } = useAuth();
  const { data: settings, refetch } = trpc.registrationSettings.get.useQuery();
  const updateSettings = trpc.registrationSettings.update.useMutation({
    onSuccess: (data) => {
      toast.success(data.registrationEnabled ? "تم تفعيل التسجيل" : "تم تعطيل التسجيل");
      refetch();
    },
    onError: () => toast.error("حدث خطأ أثناء تحديث الإعدادات"),
  });

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin")) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <p className="text-muted-foreground mb-4">غير مصرح لك بالوصول</p>
        <Link href="/"><Button>الرئيسية</Button></Link>
      </div>
    );
  }

  const isEnabled = settings?.registrationEnabled ?? true;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm"><ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">إعدادات التسجيل</h1>
              <p className="text-muted-foreground mt-1">التحكم في إمكانية إنشاء حسابات جديدة</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container max-w-xl">
          <Card className="p-8">
            {/* Status indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {isEnabled
                  ? <UserPlus className="w-8 h-8 text-green-500" />
                  : <Lock className="w-8 h-8 text-red-500" />
                }
                <div>
                  <h2 className="text-lg font-bold text-foreground">تسجيل الأعضاء</h2>
                  <p className="text-sm text-muted-foreground">السماح للمستخدمين بإنشاء حسابات جديدة</p>
                </div>
              </div>
              <Badge className={isEnabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                {isEnabled ? "مفعّل" : "معطّل"}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              {isEnabled
                ? "التسجيل مفتوح حالياً. يستطيع أي شخص إنشاء حساب جديد عبر صفحة تسجيل الدخول."
                : "التسجيل مغلق حالياً. لن يتمكن المستخدمون الجدد من إنشاء حسابات. المستخدمون الحاليون يستطيعون تسجيل الدخول بشكل طبيعي."
              }
            </p>

            <Button
              className={`w-full flex items-center justify-center gap-2 ${
                isEnabled
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              onClick={() => updateSettings.mutate({ enabled: !isEnabled })}
              disabled={updateSettings.isPending}
            >
              {isEnabled
                ? <><ToggleLeft className="w-5 h-5" />تعطيل التسجيل</>
                : <><ToggleRight className="w-5 h-5" />تفعيل التسجيل</>
              }
            </Button>
          </Card>
        </div>
      </section>
    </div>
  );
}
