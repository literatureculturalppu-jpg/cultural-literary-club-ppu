import { useMemo, useState } from "react";
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Task = { id: string; title: string; status: "draft" | "awaiting_approval" | "completed"; createdAt: string; requiresApproval: boolean };
type Memory = { id: string; text: string; enabled: boolean };
type Automation = { id: string; title: string; cadence: "daily" | "weekly"; enabled: boolean };
type Panel = "overview" | "tasks" | "memory" | "automation" | "services";

const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
};

const panelItems: Array<{ id: Panel; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "البداية", icon: LayoutDashboard },
  { id: "tasks", label: "مهامي", icon: CheckCircle2 },
  { id: "memory", label: "الذاكرة", icon: BrainCircuit },
  { id: "automation", label: "الأتمتة", icon: CalendarClock },
  { id: "services", label: "الخدمات", icon: LockKeyhole },
];

export function BasirAgentConsole({ onUsePrompt }: { onUsePrompt: (prompt: string) => void }) {
  const [panel, setPanel] = useState<Panel>("overview");
  const [tasks, setTasks] = useState<Task[]>(() => read("basir-agent-tasks", []));
  const [memories, setMemories] = useState<Memory[]>(() => read("basir-agent-memories", []));
  const [automations, setAutomations] = useState<Automation[]>(() => read("basir-agent-automations", []));
  const [taskTitle, setTaskTitle] = useState("");
  const [memoryText, setMemoryText] = useState("");

  const persist = <T,>(key: string, value: T, update: (value: T) => void) => {
    localStorage.setItem(key, JSON.stringify(value));
    update(value);
  };
  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    persist("basir-agent-tasks", [{ id: crypto.randomUUID(), title, status: "draft", createdAt: new Date().toISOString(), requiresApproval: true }, ...tasks], setTasks);
    setTaskTitle("");
  };
  const addMemory = () => {
    const text = memoryText.trim();
    if (!text) return;
    persist("basir-agent-memories", [{ id: crypto.randomUUID(), text, enabled: true }, ...memories], setMemories);
    setMemoryText("");
  };
  const addAutomation = (cadence: Automation["cadence"]) => {
    const title = cadence === "daily" ? "مراجعة مهامي اليومية" : "ملخص أسبوعي للمهام";
    persist("basir-agent-automations", [{ id: crypto.randomUUID(), title, cadence, enabled: false }, ...automations], setAutomations);
  };
  const activeMemories = useMemo(() => memories.filter((memory) => memory.enabled).length, [memories]);
  const pendingTasks = tasks.filter((task) => task.status !== "completed");

  const heading = (icon: React.ReactNode, title: string, description: string) => (
    <div className="mb-5 flex gap-3 border-b pb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</div>
      <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/15 via-background to-primary/10 p-5 md:p-7">
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-accent"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">وكيل بصير الآمن</span></div>
            <h2 className="text-2xl font-bold">من طلبك إلى خطة واضحة</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">ابدأ بكتابة المطلوب، يضع بصير الخطوات، ثم يطلب موافقتك قبل أي إجراء خارجي أو حساس.</p>
          </div>
          <Button className="gap-2" onClick={() => onUsePrompt("حلّل طلبي كوكيل: أنشئ خطة قصيرة من خطوات، وحدد ما يحتاج موافقتي قبل التنفيذ، ولا تدّع تنفيذ أي إجراء خارجي.")}><WandSparkles className="h-4 w-4" />ابدأ خطة جديدة</Button>
        </div>
      </section>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="أقسام وكيل بصير">
        {panelItems.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={panel === id ? "default" : "outline"} className="shrink-0 gap-2 rounded-xl" onClick={() => setPanel(id)}>
            <Icon className="h-4 w-4" />{label}
          </Button>
        ))}
      </nav>

      {panel === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-2xl border bg-card p-5">
            {heading(<WandSparkles className="h-5 w-5" />, "ماذا تريد أن يفعل بصير؟", "أفضل بداية هي تعريف النتيجة المطلوبة؛ سيقترح بصير طريقة العمل والموافقات اللازمة.")}
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => onUsePrompt("رتّب لي هذه المهمة كوكيل بخطوات صغيرة قابلة للمراجعة: ")} className="rounded-2xl border p-4 text-right transition hover:border-accent hover:bg-accent/5"><CheckCircle2 className="mb-3 h-5 w-5 text-accent"/><strong className="block">تخطيط مهمة</strong><span className="mt-1 block text-xs text-muted-foreground">قسّم الطلب إلى خطوات وموافقات</span></button>
              <button onClick={() => onUsePrompt("أريد بحثًا موثقًا. اذكر لي ما المصادر أو الخدمات التي تحتاج ربطها أولًا، ثم اقترح خطة لا تجمع بيانات خاصة ولا تنفذ أي إجراء دون موافقتي.")} className="rounded-2xl border p-4 text-right transition hover:border-accent hover:bg-accent/5"><SearchCheck className="mb-3 h-5 w-5 text-accent"/><strong className="block">بحث موثق</strong><span className="mt-1 block text-xs text-muted-foreground">راجع المصادر قبل البدء</span></button>
            </div>
            <div className="mt-5 rounded-xl bg-muted/60 p-4"><p className="text-sm font-semibold">الخطوة التالية</p><p className="mt-1 text-sm text-muted-foreground">{pendingTasks.length ? `لديك ${pendingTasks.length} مهام محفوظة. افتح «مهامي» لمراجعتها.` : "أضف مهمة قصيرة أو ابدأ خطة جديدة من المحادثة."}</p></div>
          </section>
          <aside className="rounded-2xl border bg-card p-5">
            {heading(<ShieldCheck className="h-5 w-5" />, "ملخص الخصوصية", "أنت المتحكم في ما يحفظه بصير وما يُنفذ.")}
            <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">مهام محفوظة</span><strong>{tasks.length}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">ذكريات مفعلة</span><strong>{activeMemories}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">خدمات مربوطة</span><strong>0</strong></div></div>
            <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">لا تُحفظ كلمات المرور هنا، ولا ينفذ بصير إرسالًا أو نشرًا أو حذفًا من دون تأكيدك.</p>
          </aside>
        </div>
      )}

      {panel === "tasks" && <section className="rounded-2xl border bg-card p-5">{heading(<CheckCircle2 className="h-5 w-5" />, "مهامي", "أضف النتيجة التي تريدها، ثم استخدم المحادثة ليضع بصير خطة قبل التنفيذ.")}<div className="flex gap-2"><Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="مثال: جهّز ملخصًا للمقالات الجديدة"/><Button size="icon" onClick={addTask} aria-label="إضافة مهمة"><Plus className="h-4 w-4"/></Button></div><div className="mt-4 space-y-2">{tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مهام بعد. ابدأ بأول نتيجة تريد الوصول إليها.</p> : tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><Clock3 className="h-4 w-4 text-accent"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">مسودة — تحتاج خطة وموافقتك</p></div><Button variant="ghost" size="icon" aria-label="حذف المهمة" onClick={() => persist("basir-agent-tasks", tasks.filter((item) => item.id !== task.id), setTasks)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>}

      {panel === "memory" && <section className="rounded-2xl border bg-card p-5">{heading(<BrainCircuit className="h-5 w-5" />, "ذاكرتي مع بصير", "هذه تفضيلاتك المحلية فقط. يمكنك إيقاف أي عنصر أو حذفه في أي وقت.")}<div className="flex gap-2"><Input value={memoryText} onChange={(event) => setMemoryText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addMemory()} placeholder="مثال: أفضل الملخصات القصيرة بالعربية"/><Button size="icon" onClick={addMemory} aria-label="إضافة تفضيل"><Plus className="h-4 w-4"/></Button></div><div className="mt-4 space-y-2">{memories.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تفضيلات محفوظة.</p> : memories.map((memory) => <div key={memory.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-3"><button className={`h-2.5 w-2.5 rounded-full ${memory.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} onClick={() => persist("basir-agent-memories", memories.map((item) => item.id === memory.id ? { ...item, enabled: !item.enabled } : item), setMemories)} aria-label="تفعيل أو إيقاف الذاكرة"/><p className="min-w-0 flex-1 text-sm">{memory.text}</p><Button variant="ghost" size="icon" aria-label="حذف الذاكرة" onClick={() => persist("basir-agent-memories", memories.filter((item) => item.id !== memory.id), setMemories)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>}

      {panel === "automation" && <section className="rounded-2xl border bg-card p-5">{heading(<CalendarClock className="h-5 w-5" />, "الأتمتة", "جهّز مهمة متكررة الآن. التفعيل لا يحدث إلا بعد ربط الخدمة المعنية وموافقتك.")}<div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" className="flex-1" onClick={() => addAutomation("daily")}>إنشاء مراجعة يومية</Button><Button variant="outline" className="flex-1" onClick={() => addAutomation("weekly")}>إنشاء ملخص أسبوعي</Button></div><div className="mt-4 space-y-2">{automations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أتمتة مهيأة بعد.</p> : automations.map((automation) => <div key={automation.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><CalendarClock className="h-4 w-4 text-accent"/><div className="flex-1"><p className="text-sm font-medium">{automation.title}</p><p className="text-xs text-muted-foreground">{automation.cadence === "daily" ? "يوميًا" : "أسبوعيًا"} — بانتظار الربط والموافقة</p></div><Button variant="ghost" size="icon" aria-label="حذف الأتمتة" onClick={() => persist("basir-agent-automations", automations.filter((item) => item.id !== automation.id), setAutomations)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>}

      {panel === "services" && <section className="rounded-2xl border bg-card p-5">{heading(<LockKeyhole className="h-5 w-5" />, "الخدمات والمتصفح", "سيظهر كل اتصال هنا، مع النطاق الذي وافقت عليه وإمكانية إلغائه في أي وقت.")}<div className="space-y-2">{["البحث الموثق على الويب", "البريد والتقويم", "التخزين السحابي"].map((item) => <div key={item} className="flex items-center justify-between rounded-xl border p-4"><span className="text-sm font-medium">{item}</span><span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">غير مربوط</span></div>)}</div><div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><ShieldCheck className="h-4 w-4 shrink-0"/>لا تحفظ بصير كلمة مرورك، ويطلب كل إجراء خارجي حساس موافقتك النهائية.</div><button onClick={() => onUsePrompt("أريد ربط خدمة بشكل آمن. وضّح الصلاحية المطلوبة والخطوات والموافقة التي ستطلبها قبل تنفيذ أي إجراء.")} className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed p-3 text-right text-sm hover:bg-muted/50"><span>اسأل بصير عن ربط خدمة</span><ChevronLeft className="h-4 w-4 text-accent"/></button></section>}
    </div>
  );
}
