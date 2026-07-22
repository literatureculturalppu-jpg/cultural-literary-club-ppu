import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Bot, X, Trash2, Sparkles } from "lucide-react";
import { renderBasirContent } from "@/lib/renderBasirContent";
import { useBasirChat } from "@/hooks/useBasirChat";

// Basir is reachable from anywhere in the member-only site EXCEPT the Teams
// area (which has its own separate, device-only chat) and the admin control
// panel (kept a focused, distraction-free workspace).
function isHiddenRoute(path: string) {
  return path.startsWith("/teams") || path.startsWith("/admin") || path === "/basir";
}

export default function BasirWidget() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();
  const enabled = !!user && user.onboardingCompleted && user.approvalStatus === "approved";

  const { messages, sendMessage, clearHistory, isLoading, settings, usage, quotaExceeded } =
    useBasirChat(enabled && open);

  if (!enabled || isHiddenRoute(location)) return null;
  if (settings && !settings.enabled) return null;

  return (
    <>
      {/* Launcher bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        aria-label="بصير - المساعد الذكي"
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 left-5 z-50 w-[92vw] max-w-sm rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-accent/15 to-transparent border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">بصير</p>
                {usage && (
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {usage.used}/{usage.limit} اليوم
                  </p>
                )}
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {quotaExceeded && (
            <div className="px-3 pt-2">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-lg px-3 py-2 text-xs">
                {quotaExceeded}
              </div>
            </div>
          )}

          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            placeholder={usage && usage.remaining <= 0 ? "انتهت حصتك اليومية" : "اسأل بصير..."}
            height="420px"
            className="border-0 rounded-none shadow-none"
            emptyStateMessage="مرحباً! كيف يمكنني مساعدتك؟"
            renderAssistantContent={renderBasirContent}
          />
        </div>
      )}
    </>
  );
}
