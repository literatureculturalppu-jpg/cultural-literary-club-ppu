import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Bot, Trash2 } from "lucide-react";
import { renderBasirContent } from "@/lib/renderBasirContent";
import { useBasirChat } from "@/hooks/useBasirChat";

export default function BasirChat() {
  const { isAuthenticated, loading } = useAuth();
  const { messages, sendMessage, clearHistory, isLoading, settings, usage, quotaExceeded } =
    useBasirChat(isAuthenticated);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Bot className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">
            يجب تسجيل الدخول لاستخدام بصير
          </h1>
          <Link href="/login">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              تسجيل الدخول
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (settings && !settings.enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Bot className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold text-foreground">
            المساعد الذكي بصير غير مفعّل حالياً
          </h1>
          <p className="text-muted-foreground">
            يرجى التواصل مع مسؤول النادي لتفعيل المساعد الذكي.
          </p>
          <Link href="/">
            <Button variant="outline">العودة إلى الرئيسية</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-6 md:py-8">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  بصير
                </h1>
                <p className="text-sm text-muted-foreground">
                  المساعد الذكي في نادي بصيرة الثقافي
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearHistory} className="gap-2">
                <Trash2 className="w-4 h-4" />
                مسح المحادثة
              </Button>
            )}
          </div>
          {usage && (
            <p className="text-xs text-muted-foreground mt-3">
              استخدمت {usage.used} من {usage.limit} سؤالاً اليوم
              {usage.remaining <= 5 && usage.remaining > 0 && " — تبقّى القليل من حصتك اليومية"}
            </p>
          )}
        </div>
      </section>

      {quotaExceeded && (
        <div className="container mt-4">
          <div className="max-w-4xl mx-auto bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-xl px-4 py-3 text-sm">
            {quotaExceeded}
          </div>
        </div>
      )}

      <section className="py-4 md:py-6">
        <div className="container max-w-4xl">
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            placeholder={
              usage && usage.remaining <= 0
                ? "انتهت حصتك اليومية — عد غداً"
                : "اسأل بصير عن أي موضوع علمي أو ثقافي..."
            }
            height="calc(100vh - 260px)"
            emptyStateMessage="مرحباً! أنا بصير، المساعد الذكي في نادي بصيرة الثقافي. كيف يمكنني مساعدتك؟"
            renderAssistantContent={renderBasirContent}
            suggestedPrompts={[
              "ما هو نادي بصيرة؟",
              "ما هي أنشطة النادي القادمة؟",
              "رشّح لي كتاباً من كتب النادي",
              "أخبرني عن أحدث مقالات النادي",
            ]}
          />
        </div>
      </section>
    </div>
  );
}
