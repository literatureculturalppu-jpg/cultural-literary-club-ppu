import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { BarChart3, CheckCircle2, ChevronRight, FileText, Landmark, Loader2, Paperclip, Plus, ReceiptText, RotateCcw, Send, ShieldCheck, WalletCards, XCircle } from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { canAccessTreasury, canApproveTreasury } from "@shared/clubRoles";

type TransactionStatus = "draft" | "pending_approval" | "approved" | "returned" | "void";
const statusLabels: Record<TransactionStatus, string> = {
  draft: "مسودة",
  pending_approval: "بانتظار الاعتماد",
  approved: "معتمدة",
  returned: "أُعيدت للتصحيح",
  void: "ملغاة",
};
const statusClasses: Record<TransactionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  returned: "bg-rose-100 text-rose-800",
  void: "bg-zinc-200 text-zinc-700",
};

const formatAmount = (cents: number) => new Intl.NumberFormat("ar-PS", { style: "currency", currency: "ILS", minimumFractionDigits: 2 }).format(cents / 100);
const today = () => new Date().toISOString().slice(0, 10);

function toCents(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

async function readPdf(file: File) {
  if (file.type !== "application/pdf") throw new Error("يسمح بإرفاق ملفات PDF فقط");
  if (file.size > 50 * 1024 * 1024) throw new Error("الحد الأقصى لحجم الإيصال 50 ميغابايت");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الإيصال"));
    reader.readAsDataURL(file);
  });
  return source.split(",", 2)[1] || "";
}

export default function TreasuryDashboard() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<"overview" | "transactions" | "budget" | "audit">("overview");
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | "all">("all");
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptTargetId, setReceiptTargetId] = useState<number | null>(null);

  const canDraft = canAccessTreasury(user?.role);
  const canReview = canApproveTreasury(user?.role);
  const queryInput = { fiscalYear: year };
  const summaryQuery = trpc.treasury.summary.useQuery(queryInput, { enabled: Boolean(user && canAccessTreasury(user.role)) });
  const transactionsQuery = trpc.treasury.transactions.useQuery({ ...queryInput, ...(transactionStatus === "all" ? {} : { status: transactionStatus }) }, { enabled: Boolean(user && canAccessTreasury(user.role)) });
  const auditQuery = trpc.treasury.audit.useQuery(undefined, { enabled: Boolean(user && canAccessTreasury(user.role) && tab === "audit") });
  const utils = trpc.useUtils();

  const refresh = async () => {
    await Promise.all([
      utils.treasury.summary.invalidate(queryInput),
      utils.treasury.transactions.invalidate(),
      utils.treasury.audit.invalidate(),
    ]);
  };

  const createBudget = trpc.treasury.createBudget.useMutation({ onSuccess: async () => { toast.success("تمت إضافة بند الميزانية"); setShowBudgetForm(false); await refresh(); }, onError: (error) => toast.error(error.message) });
  const createTransaction = trpc.treasury.createTransaction.useMutation({ onSuccess: async () => { toast.success("حُفظت العملية كمسودة"); setShowTransactionForm(false); await refresh(); }, onError: (error) => toast.error(error.message) });
  const submitTransaction = trpc.treasury.submit.useMutation({ onSuccess: async () => { toast.success("أُرسلت العملية للاعتماد"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const reviewTransaction = trpc.treasury.review.useMutation({ onSuccess: async () => { toast.success("تم تحديث حالة العملية"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const uploadPdf = trpc.attachments.upload.useMutation();
  const addReceipt = trpc.treasury.addReceipt.useMutation({ onSuccess: async () => { toast.success("تم إرفاق الإيصال"); await refresh(); }, onError: (error) => toast.error(error.message) });

  const categoryUsage = useMemo(() => {
    const usage = new Map<number, number>();
    for (const [categoryId, amountCents] of Object.entries(summaryQuery.data?.approvedExpenseByCategory ?? {})) usage.set(Number(categoryId), amountCents);
    return usage;
  }, [summaryQuery.data?.transactions]);

  if (!user || !canAccessTreasury(user.role)) {
    return <div className="container py-20 text-center" dir="rtl"><h1 className="mb-3 text-2xl font-bold">غير مصرح لك بالوصول</h1><p className="mb-6 text-muted-foreground">لوحة أمين الصندوق مخصصة للأدوار المخولة فقط.</p><Link href="/"><Button>العودة للرئيسية</Button></Link></div>;
  }

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data ?? [];

  const handleReceipt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const transactionId = receiptTargetId;
    event.target.value = "";
    if (!file || !transactionId) return;
    try {
      const base64Data = await readPdf(file);
      const uploaded = await uploadPdf.mutateAsync({ filename: file.name, mimeType: "application/pdf", base64Data });
      await addReceipt.mutateAsync({ transactionId, fileUrl: uploaded.url, fileKey: uploaded.key, fileName: file.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرفاق الإيصال");
    } finally {
      setReceiptTargetId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background" dir="rtl">
      <section className="border-b bg-gradient-to-b from-emerald-950/10 via-accent/5 to-background py-10">
        <div className="container">
          <Link href="/admin" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" />لوحة التحكم</Link>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><div className="mb-2 flex items-center gap-2 text-emerald-700"><Landmark className="h-6 w-6" /><span className="font-semibold">العمليات المالية</span></div><h1 className="text-3xl font-bold md:text-4xl">لوحة أمين الصندوق</h1><p className="mt-2 max-w-2xl text-muted-foreground">إدارة المسودات والإيصالات والتقارير المالية، مع اعتماد مستقل للعمليات المرسلة.</p></div>
            <div className="flex items-center gap-2"><Label htmlFor="financial-year" className="whitespace-nowrap">السنة المالية</Label><select id="financial-year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value={currentYear - 1}>{currentYear - 1}</option><option value={currentYear}>{currentYear}</option><option value={currentYear + 1}>{currentYear + 1}</option></select></div>
          </div>
        </div>
      </section>

      <section className="container py-8">
        <div className="mb-6 flex flex-wrap gap-2 border-b pb-4">{[
          ["overview", "الملخص", BarChart3], ["transactions", "العمليات", ReceiptText], ["budget", "الميزانية", WalletCards], ["audit", "سجل المالية", ShieldCheck],
        ].map(([key, label, Icon]) => <Button key={String(key)} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key as typeof tab)} className="gap-2"><Icon className="h-4 w-4" />{String(label)}</Button>)}</div>

        {tab === "overview" && <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard icon={WalletCards} label="إجمالي الإيرادات المعتمدة" value={formatAmount(summary?.incomeCents ?? 0)} className="text-emerald-700" />
            <SummaryCard icon={ReceiptText} label="المصروفات المعتمدة" value={formatAmount(summary?.expenseCents ?? 0)} className="text-rose-700" />
            <SummaryCard icon={Landmark} label="الرصيد المتاح" value={formatAmount(summary?.balanceCents ?? 0)} className="text-sky-700" />
            <SummaryCard icon={FileText} label="عمليات تنتظر الاعتماد" value={String(summary?.pendingCount ?? 0)} className="text-amber-700" />
          </div>
          <Card><CardHeader><CardTitle>متابعة بنود الميزانية</CardTitle><CardDescription>تُحتسب المصروفات من العمليات المعتمدة فقط.</CardDescription></CardHeader><CardContent className="space-y-4">{summaryQuery.isLoading ? <Loading /> : (summary?.categories.length ?? 0) === 0 ? <Empty text="لم تُضف بنود ميزانية لهذه السنة بعد." /> : summary?.categories.map((category) => { const used = categoryUsage.get(category.id) ?? 0; const percentage = category.allocatedAmountCents ? Math.min(100, Math.round((used / category.allocatedAmountCents) * 100)) : 0; return <div key={category.id}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-medium">{category.title}</span><span className="text-muted-foreground">{formatAmount(used)} من {formatAmount(category.allocatedAmountCents)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${percentage > 100 ? "bg-rose-500" : percentage > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${percentage}%` }} /></div></div>; })}</CardContent></Card>
        </div>}

        {tab === "transactions" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{(["all", "draft", "pending_approval", "approved", "returned", "void"] as const).map((status) => <Button key={status} size="sm" variant={transactionStatus === status ? "default" : "outline"} onClick={() => setTransactionStatus(status)}>{status === "all" ? "الكل" : statusLabels[status]}</Button>)}</div>{canDraft && <Button onClick={() => setShowTransactionForm(true)} className="gap-2"><Plus className="h-4 w-4" />عملية مالية جديدة</Button>}</div>
          <TransactionTable transactions={transactions} currentUserId={user.id} canDraft={canDraft} canReview={canReview} onSubmit={(id) => submitTransaction.mutate({ id })} onReview={(id, decision) => reviewTransaction.mutate({ id, decision })} onAddReceipt={(id) => { setReceiptTargetId(id); receiptInputRef.current?.click(); }} loading={submitTransaction.isPending || reviewTransaction.isPending || addReceipt.isPending || uploadPdf.isPending} />
          <input ref={receiptInputRef} className="hidden" type="file" accept="application/pdf" onChange={handleReceipt} />
        </div>}

        {tab === "budget" && <div className="space-y-5"><div className="flex justify-end">{canDraft && <Button onClick={() => setShowBudgetForm(true)} className="gap-2"><Plus className="h-4 w-4" />بند ميزانية</Button>}</div><Card><CardHeader><CardTitle>بنود ميزانية {year}</CardTitle><CardDescription>لا يمكن حذف البنود؛ يحافظ ذلك على سلامة التقارير وسجل المالية.</CardDescription></CardHeader><CardContent>{summaryQuery.isLoading ? <Loading /> : (summary?.categories.length ?? 0) === 0 ? <Empty text="لا توجد بنود ميزانية بعد." /> : <div className="divide-y">{summary?.categories.map((category) => <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between" key={category.id}><div><p className="font-semibold">{category.title}</p>{category.notes && <p className="mt-1 text-sm text-muted-foreground">{category.notes}</p>}</div><div className="text-left"><p className="font-semibold">{formatAmount(category.allocatedAmountCents)}</p><p className="text-sm text-muted-foreground">مصروف معتمد: {formatAmount(categoryUsage.get(category.id) ?? 0)}</p></div></div>)}</div>}</CardContent></Card></div>}

        {tab === "audit" && <Card><CardHeader><CardTitle>سجل المالية</CardTitle><CardDescription>يوثق إنشاء العمليات وإرسالها واعتمادها وإرفاق الإيصالات. لا يحل محل سجل الأمن التقني.</CardDescription></CardHeader><CardContent>{auditQuery.isLoading ? <Loading /> : (auditQuery.data?.length ?? 0) === 0 ? <Empty text="لا توجد أحداث مالية مسجلة بعد." /> : <div className="divide-y">{auditQuery.data?.map((entry) => <div key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{entry.summary}</p><p className="text-sm text-muted-foreground">{entry.actorName || "مستخدم مخول"} · {entry.action}</p></div><time className="text-sm text-muted-foreground">{new Date(entry.createdAt).toLocaleString("ar-PS")}</time></div>)}</div>}</CardContent></Card>}
      </section>

      {showBudgetForm && <BudgetForm onClose={() => setShowBudgetForm(false)} onSubmit={(form) => createBudget.mutate(form)} pending={createBudget.isPending} year={year} />}
      {showTransactionForm && <TransactionForm categories={summary?.categories ?? []} onClose={() => setShowTransactionForm(false)} onSubmit={(form) => createTransaction.mutate(form)} pending={createTransaction.isPending} />}
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, className }: { icon: typeof WalletCards; label: string; value: string; className: string }) { return <Card><CardContent className="flex items-start gap-3 p-5"><Icon className={`mt-1 h-5 w-5 ${className}`} /><div><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-bold ${className}`}>{value}</p></div></CardContent></Card>; }
function Loading() { return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-muted-foreground">{text}</p>; }

function BudgetForm({ year, onClose, onSubmit, pending }: { year: number; onClose: () => void; onSubmit: (data: { fiscalYear: number; title: string; allocatedAmountCents: number; currency: "ILS"; notes: string | null }) => void; pending: boolean }) {
  const [title, setTitle] = useState(""); const [amount, setAmount] = useState(""); const [notes, setNotes] = useState("");
  const submit = (event: React.FormEvent) => { event.preventDefault(); const cents = toCents(amount); if (!cents && cents !== 0) return toast.error("أدخل مبلغًا صحيحًا"); onSubmit({ fiscalYear: year, title, allocatedAmountCents: cents, currency: "ILS", notes: notes || null }); };
  return <Modal title="إضافة بند ميزانية" onClose={onClose}><form className="space-y-4" onSubmit={submit}><Field label="اسم البند"><Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: فعاليات وورش" /></Field><Field label="المبلغ المخصص (شيكل)"><Input required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="ملاحظات"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><div className="flex gap-2"><Button type="submit" disabled={pending}>{pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ البند</Button><Button type="button" variant="outline" onClick={onClose}>إلغاء</Button></div></form></Modal>;
}

function TransactionForm({ categories, onClose, onSubmit, pending }: { categories: Array<{ id: number; title: string }>; onClose: () => void; onSubmit: (data: { categoryId: number | null; type: "income" | "expense"; title: string; description: string | null; amountCents: number; currency: "ILS"; transactionDate: string }) => void; pending: boolean }) {
  const [type, setType] = useState<"income" | "expense">("expense"); const [categoryId, setCategoryId] = useState(""); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(today());
  const submit = (event: React.FormEvent) => { event.preventDefault(); const cents = toCents(amount); if (!cents) return toast.error("أدخل مبلغًا صحيحًا أكبر من صفر"); onSubmit({ categoryId: categoryId ? Number(categoryId) : null, type, title, description: description || null, amountCents: cents, currency: "ILS", transactionDate: date }); };
  return <Modal title="عملية مالية جديدة" onClose={onClose}><form className="space-y-4" onSubmit={submit}><Field label="نوع العملية"><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={type} onChange={(event) => setType(event.target.value as "income" | "expense")}><option value="expense">مصروف</option><option value="income">إيراد</option></select></Field><Field label="بند الميزانية (اختياري)"><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">بدون بند</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.title}</option>)}</select></Field><Field label="عنوان العملية"><Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: طباعة مواد تعريفية" /></Field><Field label="المبلغ (شيكل)"><Input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="تاريخ العملية"><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="الوصف"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="تفاصيل أو مبرر العملية" /></Field><div className="flex gap-2"><Button type="submit" disabled={pending}>{pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ كمسودة</Button><Button type="button" variant="outline" onClick={onClose}>إلغاء</Button></div></form></Modal>;
}

function TransactionTable({ transactions, currentUserId, canDraft, canReview, onSubmit, onReview, onAddReceipt, loading }: { transactions: Array<any>; currentUserId: number; canDraft: boolean; canReview: boolean; onSubmit: (id: number) => void; onReview: (id: number, decision: "approved" | "returned" | "void") => void; onAddReceipt: (id: number) => void; loading: boolean }) { return <Card><CardContent className="p-0">{transactions.length === 0 ? <Empty text="لا توجد عمليات مطابقة للفلتر." /> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-right text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="p-4 font-medium">العملية</th><th className="p-4 font-medium">التاريخ</th><th className="p-4 font-medium">المبلغ</th><th className="p-4 font-medium">الحالة</th><th className="p-4 font-medium">الإيصالات</th><th className="p-4 font-medium">إجراء</th></tr></thead><tbody>{transactions.map((transaction) => { const ownDraft = transaction.createdBy === currentUserId && ["draft", "returned"].includes(transaction.status); const ownPending = transaction.createdBy === currentUserId && transaction.status === "pending_approval"; return <tr key={transaction.id} className="border-t align-top"><td className="p-4"><p className="font-semibold">{transaction.title}</p><p className="mt-1 text-xs text-muted-foreground">{transaction.type === "income" ? "إيراد" : "مصروف"}{transaction.categoryTitle ? ` · ${transaction.categoryTitle}` : ""}</p>{transaction.reviewNote && <p className="mt-2 max-w-xs text-xs text-rose-700">ملاحظة الاعتماد: {transaction.reviewNote}</p>}</td><td className="p-4 text-muted-foreground">{transaction.transactionDate}</td><td className={`p-4 font-semibold ${transaction.type === "income" ? "text-emerald-700" : "text-rose-700"}`}>{formatAmount(transaction.amountCents)}</td><td className="p-4"><Badge className={statusClasses[transaction.status as TransactionStatus]}>{statusLabels[transaction.status as TransactionStatus]}</Badge></td><td className="p-4"><div className="flex flex-wrap gap-1">{transaction.receipts.map((receipt: any) => <a key={receipt.id} href={receipt.fileUrl} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs hover:bg-muted">{receipt.fileName}</a>)}{ownDraft && <Button size="sm" variant="outline" onClick={() => onAddReceipt(transaction.id)} disabled={loading} className="gap-1"><Paperclip className="h-3 w-3" />PDF</Button>}</div></td><td className="p-4"><div className="flex flex-wrap gap-1">{ownDraft && <Button size="sm" onClick={() => onSubmit(transaction.id)} disabled={loading} className="gap-1"><Send className="h-3 w-3" />إرسال</Button>}{ownPending && <span className="text-xs text-muted-foreground">بانتظار المراجعة</span>}{canReview && transaction.status === "pending_approval" && transaction.createdBy !== currentUserId && <><Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => onReview(transaction.id, "approved")} disabled={loading}><CheckCircle2 className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="border-amber-300 text-amber-700" onClick={() => onReview(transaction.id, "returned")} disabled={loading}><RotateCcw className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="border-rose-300 text-rose-700" onClick={() => onReview(transaction.id, "void")} disabled={loading}><XCircle className="h-3 w-3" /></Button></>}</div></td></tr>; })}</tbody></table></div>}</CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto"><CardHeader className="flex-row items-center justify-between"><CardTitle>{title}</CardTitle><Button type="button" size="icon" variant="ghost" onClick={onClose}><XCircle className="h-5 w-5" /></Button></CardHeader><CardContent>{children}</CardContent></Card></div>; }
