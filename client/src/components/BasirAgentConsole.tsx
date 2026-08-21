import { useMemo, useState } from "react";
import { BrainCircuit, CalendarClock, CheckCircle2, ChevronLeft, Clock3, Database, LockKeyhole, Plus, ShieldCheck, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Task = { id: string; title: string; status: "draft" | "awaiting_approval" | "completed"; createdAt: string; requiresApproval: boolean };
type Memory = { id: string; text: string; enabled: boolean };
type Automation = { id: string; title: string; cadence: "daily" | "weekly"; enabled: boolean };

const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; } };

export function BasirAgentConsole({ onUsePrompt }: { onUsePrompt: (prompt: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>(() => read("basir-agent-tasks", []));
  const [memories, setMemories] = useState<Memory[]>(() => read("basir-agent-memories", []));
  const [automations, setAutomations] = useState<Automation[]>(() => read("basir-agent-automations", []));
  const [taskTitle, setTaskTitle] = useState("");
  const [memoryText, setMemoryText] = useState("");

  const persist = <T,>(key: string, value: T, update: (value: T) => void) => { localStorage.setItem(key, JSON.stringify(value)); update(value); };
  const addTask = () => {
    const title = taskTitle.trim(); if (!title) return;
    persist("basir-agent-tasks", [{ id: crypto.randomUUID(), title, status: "draft", createdAt: new Date().toISOString(), requiresApproval: true }, ...tasks], setTasks); setTaskTitle("");
  };
  const addMemory = () => {
    const text = memoryText.trim(); if (!text) return;
    persist("basir-agent-memories", [{ id: crypto.randomUUID(), text, enabled: true }, ...memories], setMemories); setMemoryText("");
  };
  const addAutomation = (cadence: Automation["cadence"]) => persist("basir-agent-automations", [{ id: crypto.randomUUID(), title: cadence === "daily" ? "مراجعة مهامي اليومية" : "ملخص أسبوعي للمهام", cadence, enabled: false }, ...automations], setAutomations);
  const activeMemories = useMemo(() => memories.filter((memory) => memory.enabled).length, [memories]);

  return <div className="space-y-5" dir="rtl">
    <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/15 via-background to-primary/10 p-5 md:p-7">
      <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-accent"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">وضع الوكيل الآمن</span></div><h2 className="text-2xl font-bold">خطّط، راجع، ثم نفّذ بموافقتك</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">بصير لا يرسل أو ينشر أو يحذف أو يربط أي خدمة من دون تأكيد واضح منك. المهام والذاكرة أدناه محفوظة على هذا الجهاز فقط.</p></div>
        <Button className="gap-2" onClick={() => onUsePrompt("حلّل طلبي كوكيل: أنشئ خطة قصيرة من خطوات، وحدد ما يحتاج موافقتي قبل التنفيذ، ولا تدّع تنفيذ أي إجراء خارجي.")}><WandSparkles className="h-4 w-4" />اطلب خطة من بصير</Button>
      </div>
    </section>
    <div className="grid gap-3 sm:grid-cols-3">
      {[{ icon: CheckCircle2, label: "مهام مسجلة", value: tasks.length }, { icon: BrainCircuit, label: "ذكريات مفعلة", value: activeMemories }, { icon: CalendarClock, label: "أتمتات", value: automations.filter((a) => a.enabled).length }].map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl border bg-card p-4"><Icon className="mb-3 h-5 w-5 text-accent" /><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5"><div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-accent"/><h3 className="font-bold">لوحة المهام</h3></div><div className="flex gap-2"><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="مثال: جهّز ملخصًا للمقالات الجديدة"/><Button size="icon" onClick={addTask}><Plus className="h-4 w-4"/></Button></div><div className="mt-4 space-y-2">{tasks.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">أضف مهمة، ثم اطلب من بصير أن يضع لها خطة.</p> : tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><Clock3 className="h-4 w-4 text-accent"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">مسودة — تحتاج تأكيدًا قبل التنفيذ</p></div><Button variant="ghost" size="icon" onClick={() => persist("basir-agent-tasks", tasks.filter((item) => item.id !== task.id), setTasks)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>
      <section className="rounded-2xl border bg-card p-5"><div className="mb-2 flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-accent"/><h3 className="font-bold">ذاكرتي مع بصير</h3></div><p className="mb-4 text-xs leading-5 text-muted-foreground">اكتب التفضيلات التي تريد أن يراعيها بصير. يمكنك تعطيلها أو حذفها في أي وقت، ولا تُرسل إلى خادم النادي.</p><div className="flex gap-2"><Input value={memoryText} onChange={(e) => setMemoryText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMemory()} placeholder="مثال: أفضل الملخصات القصيرة بالعربية"/><Button size="icon" onClick={addMemory}><Plus className="h-4 w-4"/></Button></div><div className="mt-4 space-y-2">{memories.map((memory) => <div key={memory.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-3"><button className={`h-2.5 w-2.5 rounded-full ${memory.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} onClick={() => persist("basir-agent-memories", memories.map((item) => item.id === memory.id ? { ...item, enabled: !item.enabled } : item), setMemories)} aria-label="تفعيل الذاكرة"/><p className="min-w-0 flex-1 text-sm">{memory.text}</p><Button variant="ghost" size="icon" onClick={() => persist("basir-agent-memories", memories.filter((item) => item.id !== memory.id), setMemories)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>
      <section className="rounded-2xl border bg-card p-5"><div className="mb-2 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-accent"/><h3 className="font-bold">أتمتة آمنة</h3></div><p className="mb-4 text-xs leading-5 text-muted-foreground">أنشئ قالبًا للمهمة المتكررة. التفعيل الفعلي يظهر فقط بعد ربط الخدمة المطلوبة ومراجعة الإذن.</p><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => addAutomation("daily")}>إضافة يومية</Button><Button variant="outline" className="flex-1" onClick={() => addAutomation("weekly")}>إضافة أسبوعية</Button></div><div className="mt-4 space-y-2">{automations.map((automation) => <div key={automation.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><CalendarClock className="h-4 w-4 text-accent"/><div className="flex-1"><p className="text-sm font-medium">{automation.title}</p><p className="text-xs text-muted-foreground">{automation.cadence === "daily" ? "يوميًا" : "أسبوعيًا"} — بانتظار الربط والموافقة</p></div><Button variant="ghost" size="icon" onClick={() => persist("basir-agent-automations", automations.filter((item) => item.id !== automation.id), setAutomations)}><Trash2 className="h-4 w-4"/></Button></div>)}</div></section>
      <section className="rounded-2xl border bg-card p-5"><div className="mb-2 flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-accent"/><h3 className="font-bold">الخدمات والمتصفح</h3></div><p className="mb-4 text-xs leading-5 text-muted-foreground">لا تحفظ بصير أي كلمة مرور هنا. تفعيل المتصفح أو البريد أو التقويم يتطلب ربطًا رسميًا وموافقة منفصلة لكل خدمة.</p><div className="space-y-2">{["البحث الموثق على الويب", "البريد والتقويم", "التخزين السحابي"].map((item) => <div key={item} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">{item}</span><span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">غير مربوط</span></div>)}</div><div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><ShieldCheck className="h-4 w-4 shrink-0"/>أي إجراء خارجي حساس سيطلب موافقتك النهائية قبل تنفيذه.</div></section>
    </div>
    <button onClick={() => onUsePrompt("أريد بحثًا موثقًا. اذكر لي ما المصادر أو الخدمات التي تحتاج ربطها أولًا، ثم اقترح خطة لا تجمع بيانات خاصة ولا تنفذ أي إجراء دون موافقتي.")} className="flex w-full items-center justify-between rounded-2xl border border-dashed p-4 text-right hover:bg-muted/50"><span><strong className="block">اطلب بحثًا موثقًا</strong><span className="text-sm text-muted-foreground">سيحدد بصير المصادر المطلوبة ويعرض الخطة قبل أي اتصال خارجي.</span></span><ChevronLeft className="h-5 w-5 text-accent"/></button>
  </div>;
}
