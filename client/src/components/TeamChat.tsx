import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, Send, Unlock, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = {
  id: number;
  teamId: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
};

const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours — matches the server-side limit

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

function renderWithLinks(content: string) {
  const parts = content.split(URL_PATTERN);
  return parts.map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-accent break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function storageKey(teamId: number) {
  return `basira-team-chat-${teamId}`;
}

function loadFromDevice(teamId: number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(teamId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToDevice(teamId: number, messages: ChatMessage[]) {
  try {
    // Keep the on-device history from growing without bound.
    const trimmed = messages.slice(-1000);
    localStorage.setItem(storageKey(teamId), JSON.stringify(trimmed));
  } catch {
    // Ignore quota errors — chat still works, just won't persist further back.
  }
}

/** Still within the 6-hour edit/delete window for the sender themselves. */
function withinEditWindow(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;
}

export default function TeamChat({
  teamId,
  currentUserId,
  canManageChat,
}: {
  teamId: number;
  currentUserId: number;
  canManageChat: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadFromDevice(teamId));
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(
    messages.length > 0 ? messages[messages.length - 1].id : 0
  );

  const utils = trpc.useUtils();

  const { data } = trpc.teamChat.getMessages.useQuery(
    { teamId, afterId: lastIdRef.current || undefined },
    { refetchInterval: 4000, refetchOnWindowFocus: true }
  );

  const isChatOpen = data?.isChatOpen ?? true;
  // Once the team is closed, only its supervisor and admins/general agents
  // may keep posting — everyone else becomes read-only.
  const canPost = isChatOpen || canManageChat;

  const mergeIncoming = (incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const merged = [...prev, ...incoming];
      const deduped = Array.from(new Map(merged.map((m) => [m.id, m])).values()).sort(
        (a, b) => a.id - b.id
      );
      saveToDevice(teamId, deduped);
      lastIdRef.current = deduped[deduped.length - 1]?.id ?? lastIdRef.current;
      return deduped;
    });
  };

  useEffect(() => {
    if (!data?.messages || data.messages.length === 0) return;
    mergeIncoming(data.messages as ChatMessage[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, teamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = trpc.teamChat.send.useMutation({
    onSuccess: (message) => {
      mergeIncoming([message as ChatMessage]);
      setDraft("");
    },
    onError: (error) => {
      toast.error(error.message || "تعذر إرسال الرسالة");
    },
  });

  const editMessage = trpc.teamChat.edit.useMutation({
    onSuccess: (message) => {
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === message.id ? (message as ChatMessage) : m));
        saveToDevice(teamId, updated);
        return updated;
      });
      setEditingId(null);
      setEditDraft("");
      toast.success("تم تعديل الرسالة");
    },
    onError: (error) => toast.error(error.message || "تعذر تعديل الرسالة"),
  });

  const deleteMessage = trpc.teamChat.delete.useMutation({
    onSuccess: (message) => {
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === message.id ? (message as ChatMessage) : m));
        saveToDevice(teamId, updated);
        return updated;
      });
      toast.success("تم حذف الرسالة");
    },
    onError: (error) => toast.error(error.message || "تعذر حذف الرسالة"),
  });

  const toggleChat = trpc.teams.setChatOpen.useMutation({
    onSuccess: (res) => {
      toast.success(res.pending ? "تم إرسال طلب تغيير حالة الدردشة للمسؤول" : "تم تحديث حالة الدردشة");
      utils.teamChat.getMessages.invalidate({ teamId });
    },
    onError: (error) => toast.error(error.message || "تعذر تنفيذ الإجراء"),
  });

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    send.mutate({ teamId, content });
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = (messageId: number) => {
    const content = editDraft.trim();
    if (!content) return;
    editMessage.mutate({ teamId, messageId, content });
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="flex flex-col h-[520px] rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {isChatOpen ? (
            <Unlock className="w-4 h-4 text-emerald-600" />
          ) : (
            <Lock className="w-4 h-4 text-red-500" />
          )}
          دردشة الفريق — {isChatOpen ? "مفتوحة" : "مغلقة"}
        </div>
        {canManageChat && (
          <Button
            size="sm"
            variant="outline"
            disabled={toggleChat.isPending}
            onClick={() => toggleChat.mutate({ teamId, value: !isChatOpen })}
          >
            {isChatOpen ? "إغلاق الدردشة" : "فتح الدردشة"}
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          {grouped.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              لا توجد رسائل بعد — كن أول من يكتب!
            </p>
          )}
          {grouped.map((m) => {
            const isMine = m.senderId === currentUserId;
            const canAct = !m.deleted && (isMine ? withinEditWindow(m.createdAt) : false);
            const canDelete = !m.deleted && (canAct || canManageChat);
            const isEditingThis = editingId === m.id;

            return (
              <div key={m.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[75%] group">
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      isMine
                        ? "bg-accent text-accent-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {!isMine && (
                      <p className="text-[11px] font-semibold mb-1 opacity-70">{m.senderName}</p>
                    )}

                    {m.deleted ? (
                      <p className="italic opacity-60 text-xs">تم حذف هذه الرسالة</p>
                    ) : isEditingThis ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="min-h-[44px] text-foreground bg-background"
                          maxLength={2000}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-7 w-7"
                            disabled={editMessage.isPending || !editDraft.trim()}
                            onClick={() => saveEdit(m.id)}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{renderWithLinks(m.content)}</p>
                    )}

                    {!m.deleted && !isEditingThis && (
                      <p className="text-[10px] opacity-60 mt-1 text-left">
                        {new Date(m.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                        {m.editedAt && " · تم التعديل"}
                      </p>
                    )}
                  </div>

                  {!m.deleted && !isEditingThis && (canAct || canDelete) && (
                    <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? "justify-start" : "justify-end"}`}>
                      {canAct && (
                        <button
                          className="text-[11px] text-muted-foreground hover:text-accent flex items-center gap-1"
                          onClick={() => startEdit(m)}
                        >
                          <Pencil className="w-3 h-3" /> تعديل
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="text-[11px] text-muted-foreground hover:text-red-500 flex items-center gap-1"
                          disabled={deleteMessage.isPending}
                          onClick={() => deleteMessage.mutate({ teamId, messageId: m.id })}
                        >
                          <Trash2 className="w-3 h-3" /> حذف
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-background">
        {canPost ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="اكتب رسالة أو رابط..."
              className="min-h-[44px] max-h-32 resize-none"
              maxLength={2000}
            />
            <Button
              onClick={handleSend}
              disabled={send.isPending || !draft.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-2">
            الدردشة مغلقة حالياً — يمكن لمشرف الفريق والمسؤولين فقط الكتابة
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          المحادثة تُحفظ على جهازك فقط ولا تُخزَّن على خوادمنا — يمكن تعديل أو حذف رسالتك خلال 6 ساعات من إرسالها
        </p>
      </div>
    </div>
  );
}
