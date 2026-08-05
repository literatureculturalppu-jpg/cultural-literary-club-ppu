import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { Message, MessageAttachment } from "@/components/AIChatBox";
import { isAllowedNavPath } from "@/components/BasirNavChip";
import { prepareBasirFiles } from "@/lib/basirFiles";
import { toast } from "sonner";

const STORAGE_KEY = "basir-chat-history";

// Matches the "[[GOTO|path]]" token Basir emits when the user explicitly
// asked to be moved somewhere. Unlike "[[NAV|path|label]]" (a suggestion
// chip the user must tap), GOTO is executed immediately: stripped out of
// the visible message and turned into a real navigation.
const GOTO_REGEX = /\[\[GOTO\|([^\]]+)\]\]/;

function extractGoto(content: string): { cleaned: string; path: string | null } {
  const match = GOTO_REGEX.exec(content);
  if (!match) return { cleaned: content, path: null };
  const path = match[1].trim();
  const cleaned = content.replace(match[0], "").trim();
  if (!isAllowedNavPath(path)) return { cleaned: content, path: null };
  return { cleaned, path };
}

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
export function useBasirChat(enabled: boolean, onNavigate?: (path: string) => void) {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [quotaExceeded, setQuotaExceeded] = useState<string | null>(null);

  const { data: settings } = trpc.basir.getSettings.useQuery();
  const { data: usage, refetch: refetchUsage } = trpc.basir.getUsage.useQuery(undefined, {
    enabled,
  });

  const chatMutation = trpc.basir.chat.useMutation({
    onSuccess: (data) => {
      const { cleaned, path } = extractGoto(data.response);
      setMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: cleaned }];
        saveHistory(updated);
        return updated;
      });
      refetchUsage();
      if (path && onNavigate) {
        // Small delay so the confirmation sentence is visible for a beat
        // before the page (and, on the floating widget, the panel itself)
        // changes out from under the user.
        setTimeout(() => onNavigate(path), 700);
      }
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
    async (content: string, files?: File[]) => {
      if (usage && usage.remaining <= 0) {
        setQuotaExceeded(
          `لقد استهلكت حصتك اليومية من الأسئلة (${usage.limit} سؤال). ستتجدد حصتك غداً.`
        );
        return;
      }

      // Everything below stays on-device: images/PDFs are sent inline for
      // this one request only (never uploaded/stored anywhere), and text
      // files are read and folded straight into the message text.
      let finalContent = content;
      const displayAttachments: MessageAttachment[] = [];
      const apiAttachments: { mimeType: string; data: string }[] = [];

      if (files && files.length > 0) {
        const prepared = await prepareBasirFiles(files);
        for (const p of prepared) {
          if (p.type === "text") {
            finalContent += `\n\n[محتوى الملف المرفق: ${p.fileName}]\n\`\`\`\n${p.text}\n\`\`\``;
          } else if (p.type === "inline") {
            apiAttachments.push({ mimeType: p.attachment.mimeType, data: p.attachment.data });
            displayAttachments.push({
              kind: p.attachment.kind,
              fileName: p.attachment.fileName,
              thumbnail: p.attachment.thumbnail,
            });
          } else {
            toast.error(`${p.fileName}: ${p.reason}`);
          }
        }
      }

      if (!finalContent.trim() && displayAttachments.length === 0) return;
      // Gemini requires non-empty text alongside inline parts in some cases;
      // give a minimal default prompt if the user only attached files.
      if (!finalContent.trim()) {
        finalContent = "حلّل هذا المرفق من فضلك.";
      }

      const userMsg: Message = {
        role: "user",
        content: finalContent,
        attachments: displayAttachments.length > 0 ? displayAttachments : undefined,
      };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        saveHistory(updated);
        return updated;
      });

      const chatMessages = [...messages.filter((m) => m.role !== "system"), userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      chatMutation.mutate({
        messages: chatMessages,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      });
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
