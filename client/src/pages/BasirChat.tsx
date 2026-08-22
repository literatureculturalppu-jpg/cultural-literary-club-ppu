import { AIChatBox } from "@/components/AIChatBox";
import { BasirAgentConsole } from "@/components/BasirAgentConsole";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { renderBasirContent } from "@/lib/renderBasirContent";
import { useBasirChat } from "@/hooks/useBasirChat";
import { Link, useLocation } from "wouter";
import { Bot, BrainCircuit, CalendarClock, ChevronDown, FileSearch, ListTodo, PenLine, Settings, ShieldCheck, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const CAPABILITIES = [
  { icon: ListTodo, title: "خطّط مهمة", description: "قسّم الهدف إلى خطوات وموافقات", prompt: "حلّل هذه المهمة كوكيل عام: حدّد الهدف، اكتب خطوات قصيرة قابلة للتنفيذ، ووضّح ما يمكن إنجازه داخل الموقع وما يحتاج موافقتي أو ربط خدمة: " },
  { icon: PenLine, title: "اكتب أو حسّن", description: "مسودة، رسالة، محتوى أو صياغة", prompt: "ساعدني في كتابة أو تحسين هذا النص. اسألني أولاً عن الهدف والجمهور والنبرة إن لم تكن واضحة: " },
  { icon: FileSearch, title: "حلّل أو لخّص", description: "مرفق، نص، فكرة أو قرار", prompt: "حلّل هذا المحتوى وقدم ملخصاً عملياً ونقاطاً قابلة للتنفيذ: " },
  { icon: CalendarClock, title: "نظّم المتابعة", description: "مهمة، تفضيل أو تذكير آمن", prompt: "ساعدني على تنظيم متابعة هذه المهمة. اقترح مهمة أو تذكيراً داخلياً مناسباً، ولا تنفذ أي إجراء خارجي: " },
];

export default function BasirChat() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const chatAnchorRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, stopGenerating, clearHistory, isLoading, settings, usage, quotaExceeded } = useBasirChat(isAuthenticated, (path) => setLocation(path));
  const utils = trpc.useUtils();
  const chatPrefs = trpc.basir.chatHistory.getPrefs.useQuery(undefined, { enabled: isAuthenticated });
  const setChatHistory = trpc.basir.chatHistory.setEnabled.useMutation({
    onSuccess: () => { void utils.basir.chatHistory.getPrefs.invalidate(); toast.success("تم تحديث إعداد سجل المحادثة"); },
    onError: (error) => toast.error(error.message || "تعذر تحديث الإعداد"),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">جاري التحميل...</div></div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="space-y-4 text-center"><Bot className="mx-auto h-16 w-16 text-muted-foreground" /><h1 className="text-2xl font-bold text-foreground">يجب تسجيل الدخول لاستخدام بصير</h1><Link href="/login"><Button className="bg-accent text-accent-foreground hover:bg-accent/90">تسجيل الدخول</Button></Link></div></div>;
  if (settings && !settings.enabled) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="space-y-4 text-center"><Bot className="mx-auto h-16 w-16 text-muted-foreground opacity-50" /><h1 className="text-2xl font-bold text-foreground">المساعد الذكي بصير غير مفعّل حالياً</h1><p className="text-muted-foreground">يرجى التواصل مع مسؤول النادي لتفعيل المساعد الذكي.</p><Link href="/"><Button variant="outline">العودة إلى الرئيسية</Button></Link></div></div>;

  const useCapability = (prompt: string) => {
    chatAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => void sendMessage(prompt), 180);
  };

  return <div className="min-h-screen bg-background" dir="rtl">
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex min-h-20 items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm"><Bot className="h-6 w-6" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold text-foreground">بصير</h1><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">وكيلك العام</span></div><p className="truncate text-xs text-muted-foreground">محادثة واحدة للتخطيط والكتابة والتحليل والمتابعة</p></div></div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSettingsOpen(true)} aria-label="إعدادات بصير"><Settings className="h-5 w-5" /></Button>
      </div>
    </header>

    <main className="container py-5 md:py-7"><div className="mx-auto max-w-5xl space-y-5">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-l from-accent/15 via-background to-primary/10 p-5 md:p-7"><div className="flex flex-col gap-5"><div className="max-w-3xl"><div className="mb-2 flex items-center gap-2 text-accent"><Sparkles className="h-4 w-4" /><span className="text-sm font-semibold">يفهم الطلب ويقترح الخطوة التالية</span></div><h2 className="text-2xl font-bold tracking-tight md:text-3xl">كيف يمكنني مساعدتك اليوم؟</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">بصير مساعد عام: يحلل، يكتب، يلخص، ينظم، ويتابع. ما يمكن تنفيذه داخل الموقع يُدار بأمان، وأي إجراء خارجي أو حساس يحتاج موافقتك الصريحة.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CAPABILITIES.map(({ icon: Icon, title, description, prompt }) => <button key={title} onClick={() => useCapability(prompt)} className="rounded-2xl border bg-background/70 p-3 text-right transition hover:border-accent hover:bg-accent/5"><Icon className="mb-2 h-4 w-4 text-accent" /><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></button>)}</div></div></section>

      {quotaExceeded && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{quotaExceeded}</div>}

      <section ref={chatAnchorRef} className="rounded-3xl border bg-card p-2 shadow-sm"><AIChatBox messages={messages} onSendMessage={sendMessage} isLoading={isLoading} onStop={stopGenerating} placeholder={usage && usage.remaining <= 0 ? "انتهت حصتك اليومية — عد غداً" : "اكتب هدفك أو سؤالك، وسأقترح طريقة عملية للمساعدة..."} height="min(62vh, 680px)" emptyStateMessage="مرحباً، أنا بصير. اكتب ما تريد إنجازه، وسأحلله وأقترح أفضل خطوة تالية." renderAssistantContent={renderBasirContent} allowAttachments suggestedPrompts={["حلّل مهمتي ورتبها في خطة عملية", "اكتب لي مسودة احترافية لهذا الغرض", "لخّص هذا الملف أو النص واذكر الخطوات التالية", "ساعدني على تنظيم دراستي أو مشروعي", "اشرح لي هذا المفهوم التقني ببساطة", "ما هي أنشطة النادي القادمة؟"]} /></section>

      <section className="overflow-hidden rounded-2xl border bg-card"><button onClick={() => setWorkspaceOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-muted/40"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><WandSparkles className="h-4 w-4" /></div><div><p className="text-sm font-semibold">إدارة العمل داخل المحادثة</p><p className="text-xs text-muted-foreground">مهامي، ذاكرتي وتذكيراتي — من دون الانتقال إلى وضع آخر</p></div></div><ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${workspaceOpen ? "rotate-180" : ""}`} /></button>{workspaceOpen && <div className="border-t p-4 md:p-5"><BasirAgentConsole onUsePrompt={useCapability} /></div>}</section>
    </div></main>

    {settingsOpen && <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="إعدادات بصير"><button className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" aria-label="إغلاق الإعدادات" onClick={() => setSettingsOpen(false)} /><aside className="absolute inset-x-3 bottom-3 mx-auto max-w-lg rounded-3xl border bg-card p-5 shadow-2xl sm:bottom-auto sm:left-6 sm:right-auto sm:top-24 sm:w-[25rem]"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Settings className="h-4 w-4" /></div><div><h2 className="font-bold">إعدادات بصير</h2><p className="text-xs text-muted-foreground">الخصوصية وسجل المحادثة</p></div></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSettingsOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></Button></div>
      <div className="space-y-3"><div className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">حفظ سجل المحادثة على الخادم</p><p className="mt-1 text-xs leading-5 text-muted-foreground">مغلق افتراضياً. فعّله لمتابعة محادثتك من الأجهزة الأخرى، وإيقافه يحذف السجل المحفوظ.</p></div><Button size="sm" variant={chatPrefs.data?.chatHistoryEnabled ? "default" : "outline"} disabled={chatPrefs.isLoading || setChatHistory.isPending} onClick={() => setChatHistory.mutate({ enabled: !chatPrefs.data?.chatHistoryEnabled })}>{chatPrefs.data?.chatHistoryEnabled ? "مفعّل" : "مغلق"}</Button></div></div><div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">الحصة اليومية</p><p className="mt-1 text-xs text-muted-foreground">{usage ? `استخدمت ${usage.used} من ${usage.limit} سؤالاً اليوم.` : "جارٍ تحميل الاستخدام…"}</p></div><BrainCircuit className="h-5 w-5 text-accent" /></div></div><div className="rounded-2xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-emerald-600" />الخصوصية والتنفيذ</div><p className="mt-2 text-xs leading-5 text-muted-foreground">ينظم بصير مهامك وذكرياتك وتذكيراتك داخل حسابك. لا يطلب كلمات مرور ولا ينفذ إرسالاً أو نشراً أو تعديلاً خارجياً دون موافقتك وربط الخدمة.</p></div>{messages.length > 0 && <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => { clearHistory(); setSettingsOpen(false); toast.success("تم مسح المحادثة من هذا الجهاز"); }}><Trash2 className="h-4 w-4" />مسح المحادثة من هذا الجهاز</Button>}</div>
    </aside></div>}
  </div>;
}
