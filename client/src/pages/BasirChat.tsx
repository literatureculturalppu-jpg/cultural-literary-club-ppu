import { AIChatBox } from "@/components/AIChatBox";
import { BasirAgentConsole } from "@/components/BasirAgentConsole";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { renderBasirContent } from "@/lib/renderBasirContent";
import { useBasirChat } from "@/hooks/useBasirChat";
import { Link, useLocation } from "wouter";
import { Bot, BrainCircuit, ClipboardList, MessageSquare, Settings, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type BasirView = "agent" | "chat";

export default function BasirChat() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<BasirView>("agent");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { messages, sendMessage, stopGenerating, clearHistory, isLoading, settings, usage, quotaExceeded } = useBasirChat(isAuthenticated, (path) => setLocation(path));
  const utils = trpc.useUtils();
  const chatPrefs = trpc.basir.chatHistory.getPrefs.useQuery(undefined, { enabled: isAuthenticated });
  const setChatHistory = trpc.basir.chatHistory.setEnabled.useMutation({
    onSuccess: () => { void utils.basir.chatHistory.getPrefs.invalidate(); toast.success("تم تحديث إعداد سجل المحادثة"); },
    onError: (error) => toast.error(error.message || "تعذر تحديث الإعداد"),
  });

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">جاري التحميل...</div></div>;

  if (!isAuthenticated) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="space-y-4 text-center"><Bot className="mx-auto h-16 w-16 text-muted-foreground" /><h1 className="text-2xl font-bold text-foreground">يجب تسجيل الدخول لاستخدام بصير</h1><Link href="/login"><Button className="bg-accent text-accent-foreground hover:bg-accent/90">تسجيل الدخول</Button></Link></div></div>;

  if (settings && !settings.enabled) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="space-y-4 text-center"><Bot className="mx-auto h-16 w-16 text-muted-foreground opacity-50" /><h1 className="text-2xl font-bold text-foreground">المساعد الذكي بصير غير مفعّل حالياً</h1><p className="text-muted-foreground">يرجى التواصل مع مسؤول النادي لتفعيل المساعد الذكي.</p><Link href="/"><Button variant="outline">العودة إلى الرئيسية</Button></Link></div></div>;

  const openChatWithPrompt = (prompt: string) => { setView("chat"); setTimeout(() => void sendMessage(prompt), 0); };

  return <div className="min-h-screen bg-background" dir="rtl">
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex min-h-20 items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm"><Bot className="h-6 w-6" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold text-foreground">بصير</h1><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">جاهز للمساعدة</span></div><p className="truncate text-xs text-muted-foreground">مساحة وكيلك للخطط والمتابعة والمحادثة</p></div></div>
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSettingsOpen(true)} aria-label="إعدادات بصير"><Settings className="h-5 w-5" /></Button></div>
      </div>
    </header>

    <main className="container py-5 md:py-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-l from-accent/15 via-background to-primary/10 p-5 md:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-accent"><Sparkles className="h-4 w-4" /><span className="text-sm font-semibold">مساعد يفهم الخطوة التالية</span></div><h2 className="text-2xl font-bold tracking-tight md:text-3xl">خطّط، نظّم، ثم تحرّك بموافقتك.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">يحتفظ بصير بمهامك وذكرياتك التي فعّلتها فقط، ويعرض أي إعدادات أو خيارات ثانوية من زر الترس.</p></div><div className="rounded-2xl border bg-background/70 px-4 py-3 text-sm shadow-sm"><span className="block text-xs text-muted-foreground">الآن</span><strong>{view === "agent" ? "مساحة الوكيل" : "محادثة بصير"}</strong></div></div></section>

        <nav className="grid grid-cols-2 rounded-2xl border bg-muted/60 p-1.5" aria-label="وضع بصير"><Button variant={view === "agent" ? "default" : "ghost"} className="gap-2 rounded-xl" onClick={() => setView("agent")}><ClipboardList className="h-4 w-4" />مساحة الوكيل</Button><Button variant={view === "chat" ? "default" : "ghost"} className="gap-2 rounded-xl" onClick={() => setView("chat")}><MessageSquare className="h-4 w-4" />المحادثة</Button></nav>

        {quotaExceeded && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{quotaExceeded}</div>}

        {view === "agent" ? <BasirAgentConsole onUsePrompt={openChatWithPrompt} /> : <section className="rounded-3xl border bg-card p-2 shadow-sm"><AIChatBox messages={messages} onSendMessage={sendMessage} isLoading={isLoading} onStop={stopGenerating} placeholder={usage && usage.remaining <= 0 ? "انتهت حصتك اليومية — عد غداً" : "اكتب ما تريد إنجازه، وسيقترح بصير خطة واضحة..."} height="calc(100vh - 360px)" emptyStateMessage="مرحباً، أنا بصير. ابدأ بالنتيجة التي تريد الوصول إليها وسأساعدك في ترتيبها." renderAssistantContent={renderBasirContent} allowAttachments suggestedPrompts={["حلّل طلبي كوكيل: ضع خطة ثم اطلب موافقتي قبل أي إجراء خارجي", "ما هي أنشطة النادي القادمة؟", "رشّح لي كتاباً من كتب النادي", "أخبرني عن أحدث مقالات النادي"]} /></section>}
      </div>
    </main>

    {settingsOpen && <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="إعدادات بصير"><button className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" aria-label="إغلاق الإعدادات" onClick={() => setSettingsOpen(false)} /><aside className="absolute inset-x-3 bottom-3 mx-auto max-w-lg rounded-3xl border bg-card p-5 shadow-2xl sm:bottom-auto sm:left-6 sm:right-auto sm:top-24 sm:w-[25rem]"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Settings className="h-4 w-4" /></div><div><h2 className="font-bold">إعدادات بصير</h2><p className="text-xs text-muted-foreground">خيارات المحادثة والخصوصية</p></div></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSettingsOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></Button></div>
      <div className="space-y-3"><div className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">حفظ سجل المحادثة على الخادم</p><p className="mt-1 text-xs leading-5 text-muted-foreground">مغلق افتراضياً. فعّله لمتابعة محادثتك من الأجهزة الأخرى، وإيقافه يحذف السجل المحفوظ.</p></div><Button size="sm" variant={chatPrefs.data?.chatHistoryEnabled ? "default" : "outline"} disabled={chatPrefs.isLoading || setChatHistory.isPending} onClick={() => setChatHistory.mutate({ enabled: !chatPrefs.data?.chatHistoryEnabled })}>{chatPrefs.data?.chatHistoryEnabled ? "مفعّل" : "مغلق"}</Button></div></div>
        <div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">الحصة اليومية</p><p className="mt-1 text-xs text-muted-foreground">{usage ? `استخدمت ${usage.used} من ${usage.limit} سؤالاً اليوم.` : "جارٍ تحميل الاستخدام…"}</p></div><BrainCircuit className="h-5 w-5 text-accent" /></div></div>
        <div className="rounded-2xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-emerald-600" />الخصوصية والخدمات</div><p className="mt-2 text-xs leading-5 text-muted-foreground">الذاكرة والمهام تدار من مساحة الوكيل. لا توجد خدمات خارجية مربوطة أو إجراءات تلقائية خارج الموقع.</p></div>
        {messages.length > 0 && <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => { clearHistory(); setSettingsOpen(false); toast.success("تم مسح المحادثة من هذا الجهاز"); }}><Trash2 className="h-4 w-4" />مسح المحادثة من هذا الجهاز</Button>}</div>
    </aside></div>}
  </div>;
}
