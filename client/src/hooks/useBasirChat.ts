import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { Message } from "@/components/AIChatBox";

const STORAGE_KEY = "basir-chat-history";

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full – silently ignore
  }
}

/**
 * Shared Basir chat logic (message history persisted on-device, daily-quota
 * awareness) used by both the full `/basir` page and the site-wide floating
 * widget, so history and quota state stay in sync no matter where the user
 * chats from.
 */
export function useBasirChat(enabled: boolean) {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [quotaExceeded, setQuotaExceeded] = useState<string | null>(null);

  const { data: settings } = trpc.basir.getSettings.useQuery();
  const { data: usage, refetch: refetchUsage } = trpc.basir.getUsage.useQuery(undefined, {
    enabled,
  });

  const chatMutation = trpc.basir.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: data.response }];
        saveHistory(updated);
        return updated;
      });
      refetchUsage();
    },
    onError: (error) => {
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        setQuotaExceeded(error.message);
        refetchUsage();
        return;
      }
      setMessages((prev) => {
        const updated = [
          ...prev,
          {
            role: "assistant" as const,
            content: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
          },
        ];
        saveHistory(updated);
        return updated;
      });
    },
  });

  const sendMessage = useCallback(
    (content: string) => {
      if (usage && usage.remaining <= 0) {
        setQuotaExceeded(
          `لقد استهلكت حصتك اليومية من الأسئلة (${usage.limit} سؤال). ستتجدد حصتك غداً.`
        );
        return;
      }
      const userMsg: Message = { role: "user", content };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        saveHistory(updated);
        return updated;
      });

      const chatMessages = [...messages.filter((m) => m.role !== "system"), userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      chatMutation.mutate({ messages: chatMessages });
    },
    [messages, chatMutation, usage]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    sendMessage,
    clearHistory,
    isLoading: chatMutation.isPending,
    settings,
    usage,
    quotaExceeded,
  };
}
