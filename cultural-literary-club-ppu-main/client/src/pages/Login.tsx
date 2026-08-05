import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { LogIn, UserPlus, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const { data: regSettings } = trpc.registrationSettings.get.useQuery();
  const registrationEnabled = regSettings?.registrationEnabled ?? true;

  // Show a friendly message if we were redirected back here after a failed attempt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (!error) return;

    if (error === "no_account") {
      setTab("register");
      toast.error("لا يوجد حساب مرتبط بهذا البريد. الرجاء إنشاء حساب جديد أولاً.");
    } else if (error === "registration_disabled") {
      setTab("register");
      toast.error("التسجيل في النادي مغلق حالياً من قبل الإدارة.");
    }

    // Clean the error out of the URL so it doesn't reappear on refresh.
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">النادي الثقافي الأدبي</h1>
          <p className="text-muted-foreground text-sm">منصة النادي الثقافي الأدبي</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border bg-muted/30 p-1 mb-6">
          <button onClick={() => setTab("login")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <LogIn className="w-4 h-4" />تسجيل الدخول
          </button>
          <button onClick={() => setTab("register")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <UserPlus className="w-4 h-4" />التسجيل
          </button>
        </div>

        {tab === "login" ? (
          <Card className="p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">أهلاً بك مجدداً</h2>
              <p className="text-muted-foreground text-sm">سجّل دخولك للوصول إلى جميع مميزات النادي</p>
            </div>
            <a href={getLoginUrl()} className="block">
              <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <GoogleIcon />تسجيل الدخول بـ Google
              </Button>
            </a>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                {registrationEnabled ? <UserPlus className="w-7 h-7 text-accent" /> : <Lock className="w-7 h-7 text-muted-foreground" />}
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                {registrationEnabled ? "إنشاء حساب جديد" : "التسجيل مغلق"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {registrationEnabled
                  ? "أنشئ حسابك للانضمام إلى النادي الثقافي الأدبي"
                  : "التسجيل في النادي مغلق حالياً. تواصل مع إدارة النادي للمزيد."}
              </p>
            </div>
            {registrationEnabled ? (
              <>
                <a href={getLoginUrl("register")} className="block">
                  <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    <GoogleIcon />إنشاء حساب بـ Google
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  بالتسجيل توافق على شروط وأحكام النادي الثقافي الأدبي
                </p>
              </>
            ) : (
              <div className="bg-muted/50 rounded-lg p-4 text-center text-sm text-muted-foreground border border-border">
                🔒 التسجيل متوقف مؤقتاً من قبل الإدارة
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
