import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send } from "lucide-react";
import type { MeetingChatMessage } from "@/lib/meetingsRealtime";

export function ChatPanel({
  messages,
  onSend,
  onClose,
  disabled,
}: {
  messages: MeetingChatMessage[];
  onSend: (content: string) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="fixed inset-y-0 left-0 w-full sm:w-80 bg-background border-e border-border z-50 flex flex-col shadow-xl" dir="rtl">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-bold text-foreground">دردشة الاجتماع</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 border-b border-border">
        هذه المحادثة لحظية ولا يتم حفظها بعد انتهاء الاجتماع.
      </p>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">لا توجد رسائل بعد</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-bold text-foreground">{m.senderName}: </span>
            <span className="text-foreground/90 break-words">{m.content}</span>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={disabled ? "الدردشة ممنوعة حالياً" : "اكتب رسالة..."}
          disabled={disabled}
        />
        <Button size="icon" onClick={send} disabled={disabled || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
