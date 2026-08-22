import { useCallback, useEffect, useRef, useState } from "react";
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

type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; usage: { used: number; limit: number; remaining: number } }
  | { type: "error"; message: string };

/**
 * Reads a `fetch` response body as newline-delimited SSE frames
 * ("data: {...}\n\n") and invokes `onEvent` for each parsed one. Handles
 * frames arriving split across chunk boundaries.
 */
async function consumeSseStream(response: Response, onEvent: (evt: StreamEvent) => void) {
  if (!response.body) throw new Error("no response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr) as StreamEvent);
      } catch {
        // ignore malformed frame
      }
    }
  }
}

/**
 * Shared Basir chat logic (message history persisted on-device, daily-quota
 * awareness, live token streaming) used by both the full `/basir` page and
 * the site-wide floating widget, so history and quota state stay in sync no
 * matter where the user chats from.
 */
export function useBasirChat(enabled: boolean, onNavigate?: (path: string) => void) {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seededFromServer = useRef(false);

  const { data: settings } = trpc.basir.getSettings.useQuery();
  const { data: usage, refetch: refetchUsage } = trpc.basir.getUsage.useQuery(undefined, {
    enabled,
  });
  const { data: serverHistory } = trpc.basir.chatHistory.list.useQuery(undefined, { enabled });
  const appendServerHistory = trpc.basir.chatHistory.append.useMutation();

  useEffect(() => {
    if (!serverHistory?.length || messages.length > 0 || seededFromServer.current) return;
    seededFromServer.current = true;
    const seeded: Message[] = serverHistory.map((message) => ({ role: message.role, content: message.content }));
    setMessages(seeded);
    saveHistory(seeded);
  }, [messages.length, serverHistory]);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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

      const chatMessages = [...messages.filter((m) => m.role !== "system"), userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Push the user message immediately, plus an empty assistant
      // placeholder that fills in live as tokens stream in — this is what
      // gives Basir the same progressive "typing" feel as other AI chat
      // tools instead of the reply appearing all at once.
      setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let streamedText = "";

      const finalize = (text: string) => {
        const { cleaned, path } = extractGoto(text);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: cleaned };
          saveHistory(updated);
          return updated;
        });
        // The server verifies the opt-in preference and discards this request
        // when history is disabled, so calling it here cannot enable storage.
        appendServerHistory.mutate([
          { role: "user", content: userMsg.content },
          { role: "assistant", content: cleaned },
        ]);
        if (path && onNavigate) {
          setTimeout(() => onNavigate(path), 700);
        }
      };

      try {
        const response = await fetch("/api/basir/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            messages: chatMessages,
            attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: null }));
          if (response.status === 429) {
            setQuotaExceeded(body.error ?? "لقد استهلكت حصتك اليومية من الأسئلة.");
            setMessages((prev) => prev.slice(0, -1)); // drop the empty placeholder
            refetchUsage();
            return;
          }
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }

        await consumeSseStream(response, (evt) => {
          if (evt.type === "chunk") {
            streamedText += evt.text;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: streamedText };
              return updated;
            });
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
          // "done" carries usage stats but the actual text is already fully
          // streamed in via "chunk" events by that point.
        });

        finalize(streamedText || "عذراً، لم أتمكن من توليد إجابة. يرجى المحاولة مرة أخرى.");
        refetchUsage();
      } catch (error) {
        if (controller.signal.aborted) {
          // User hit "stop" — keep whatever text streamed in so far, if any.
          if (streamedText.trim()) {
            finalize(streamedText);
          } else {
            setMessages((prev) => prev.slice(0, -1));
          }
        } else {
          console.error("[Basir] stream failed", error);
          finalize("عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.");
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, usage, onNavigate, refetchUsage, appendServerHistory]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    sendMessage,
    stopGenerating,
    clearHistory,
    isLoading,
    settings,
    usage,
    quotaExceeded,
  };
}
