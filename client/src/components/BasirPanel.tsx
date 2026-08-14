import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { useBasirChat } from "@/hooks/useBasirChat";
import { renderBasirContent } from "@/lib/renderBasirContent";
import { Sparkles, Trash2 } from "lucide-react";

type BasirPanelProps = {
  onClose: () => void;
  onNavigate: (path: string) => void;
};

/**
 * Loaded only after the member opens the floating assistant. Keeping the
 * markdown renderer, chat state, attachment code, and streaming client here
 * prevents this nonessential feature from delaying the public homepage.
 */
export default function BasirPanel({ onClose, onNavigate }: BasirPanelProps) {
  const { messages, sendMessage, stopGenerating, clearHistory, isLoading, settings, usage, quotaExceeded } =
    useBasirChat(true, (path) => {
      onClose();
      onNavigate(path);
    });

  if (settings && !settings.enabled) return null;

  return (
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
            {usage && <p className="text-[11px] text-muted-foreground leading-tight">{usage.used}/{usage.limit} اليوم</p>}
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory} aria-label="مسح المحادثة">
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
        onStop={stopGenerating}
        placeholder={usage && usage.remaining <= 0 ? "انتهت حصتك اليومية" : "اسأل بصير..."}
        height="420px"
        className="border-0 rounded-none shadow-none"
        emptyStateMessage="مرحباً! كيف يمكنني مساعدتك؟"
        renderAssistantContent={renderBasirContent}
        allowAttachments
      />
    </div>
  );
}
