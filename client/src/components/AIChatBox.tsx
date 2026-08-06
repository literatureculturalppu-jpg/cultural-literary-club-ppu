import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, User, Sparkles, Paperclip, X, FileText, FileImage, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/** Three bouncing dots shown inside the assistant bubble before the first
 * streamed token arrives — replaces the old detached spinner bubble so the
 * "thinking" state and the "typing" state live in the exact same spot. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="بصير يكتب">
      <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.3s]" />
      <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.15s]" />
      <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce" />
    </span>
  );
}

/**
 * A file attached to a message, kept purely for on-device display. Only
 * images persist a thumbnail (small, resized) across reloads; PDFs/text
 * files just show a filename chip.
 */
export type MessageAttachment = {
  kind: "image" | "pdf" | "text";
  fileName: string;
  thumbnail?: string;
};

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message. `files`, if provided, are the raw
   * File objects the user attached (images/PDF/text) — the caller decides
   * how to read/send them.
   */
  onSendMessage: (content: string, files?: File[]) => void;

  /**
   * When true, shows a paperclip button letting the user attach images,
   * PDFs, or text files to their message.
   */
  allowAttachments?: boolean;

  /** Accept attribute for the hidden file input. */
  attachmentsAccept?: string;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /** Called when the user hits the stop button while a response streams in. */
  onStop?: () => void;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /**
   * Optional custom renderer for assistant message content. When provided,
   * it's used instead of the default Streamdown markdown rendering — lets
   * callers (e.g. Basir) turn special inline tokens into rich elements like
   * clickable reference chips.
   */
  renderAssistantContent?: (content: string, isStreaming?: boolean) => React.ReactNode;
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  onStop,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  renderAssistantContent,
  allowAttachments = false,
  attachmentsAccept = "image/*,application/pdf,.txt,.md,.csv,.json,.log,.xml,.yml,.yaml,.js,.ts,.jsx,.tsx,.py,.html,.css",
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if ((!trimmedInput && pendingFiles.length === 0) || isLoading) return;

    onSendMessage(trimmedInput, pendingFiles.length > 0 ? pendingFiles : undefined);
    setInput("");
    setPendingFiles([]);

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files].slice(0, 4));
    }
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const isStreamingPlaceholder =
                  isLastMessage && isLoading && message.role === "assistant";
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      (shouldApplyMinHeight || isStreamingPlaceholder) && minHeightForLastMessage > 0
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((att, i) =>
                            att.kind === "image" && att.thumbnail ? (
                              <img
                                key={i}
                                src={att.thumbnail}
                                alt={att.fileName}
                                className="w-20 h-20 object-cover rounded-md border border-border/50"
                              />
                            ) : (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-md bg-background/40 border border-border/50 px-2 py-1 text-xs"
                              >
                                {att.kind === "pdf" ? (
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <FileImage className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="truncate max-w-[140px]">{att.fileName}</span>
                              </span>
                            )
                          )}
                        </div>
                      )}
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {message.content ? (
                            renderAssistantContent ? (
                              renderAssistantContent(message.content, isStreamingPlaceholder)
                            ) : (
                              <Streamdown>{message.content}</Streamdown>
                            )
                          ) : isStreamingPlaceholder ? (
                            <TypingDots />
                          ) : null}
                        </div>
                      ) : (
                        message.content && (
                          <p className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </p>
                        )
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 p-4 border-t bg-background/50"
      >
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-border px-2 py-1 text-xs"
              >
                {file.type.startsWith("image/") ? (
                  <FileImage className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate max-w-[160px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  className="shrink-0 opacity-60 hover:opacity-100"
                  aria-label="إزالة المرفق"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={attachmentsAccept}
                onChange={handleFilesSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-[38px] w-[38px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || pendingFiles.length >= 4}
                aria-label="إرفاق ملف"
              >
                <Paperclip className="size-4" />
              </Button>
            </>
          )}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 max-h-32 resize-none min-h-9"
            rows={1}
          />
          <Button
            type={isLoading ? "button" : "submit"}
            size="icon"
            onClick={isLoading ? onStop : undefined}
            disabled={!isLoading && !input.trim() && pendingFiles.length === 0}
            variant={isLoading ? "outline" : "default"}
            className="shrink-0 h-[38px] w-[38px]"
            aria-label={isLoading ? "إيقاف التوليد" : "إرسال"}
          >
            {isLoading ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
