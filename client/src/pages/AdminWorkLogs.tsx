import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ShieldAlert, Users, RefreshCw, Trash2, Undo2, Clock, MessageSquare, Bot, User as UserIcon, Paperclip } from "lucide-react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل الدخول",
  "auth.logout": "تسجيل الخروج",
  "activity.publish": "نشر نشاط",
  "activity.update": "تعديل نشاط",
  "activity.delete": "حذف نشاط",
  "activity.register": "التسجيل في نشاط",
  "activity.register_guest": "تسجيل ضيف في نشاط",
  "article.publish": "نشر مقال",
  "article.update": "تعديل مقال",
  "article.delete": "حذف مقال",
  "user.role_change": "تغيير صلاحية عضو",
  "user.delete": "حذف حساب عضو",
  "basir.chat": "محادثة مع بصير",
  "basir.image_generate": "توليد صورة عبر بصير",
  "registration_request.approve": "قبول طلب تسجيل عضوية",
  "registration_request.reject": "رفض طلب تسجيل عضوية",
  "profile_edit_request.approve": "قبول طلب تعديل بيانات",
  "profile_edit_request.reject": "رفض طلب تعديل بيانات",
  "team_join_request.approve": "قبول طلب انضمام لفريق",
  "team_join_request.reject": "رفض طلب انضمام لفريق",
  "activity_subscription.approve": "قبول تسجيل عضو في نشاط",
  "activity_subscription.reject": "رفض تسجيل عضو في نشاط",
  "activity_guest.approve": "قبول تسجيل ضيف في نشاط",
  "activity_guest.reject": "رفض تسجيل ضيف في نشاط",
  "work_log.schedule_delete": "جدولة حذف سجل عمل",
  "work_log.cancel_delete": "إلغاء جدولة حذف سجل عمل",
  "meeting.guest_join_request": "طلب معلومات ضيف للانضمام لاجتماع",
  "meeting.guest_join_request_update": "تعديل طلب معلومات ضيف اجتماع",
  "meeting.guest_join_request_delete": "حذف طلب معلومات ضيف اجتماع",
};

function formatDateTime(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BasirConversationDialog({ log }: { log: any }) {
  const [open, setOpen] = useState(false);
  let conversation: { role: string; content: string }[] | null = null;
  try {
    const meta = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
    if (Array.isArray(meta?.conversation)) conversation = meta.conversation;
  } catch {
    conversation = null;
  }

  if (!conversation || conversation.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <MessageSquare className="w-3.5 h-3.5" /> عرض المحادثة
      </Button>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>محادثة {log.actorName || "عضو"} مع بصير</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {conversation.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                  m.role === "user" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent"
                }`}
              >
                {m.role === "user" ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap max-w-[85%] ${
                  m.role === "user" ? "bg-primary/10" : "bg-muted"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t border-border flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" />
          المرفقات (إن وُجدت) غير مخزَّنة هنا؛ هذا نص المحادثة فقط.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function LogRow({
  log,
  onDelete,
  onCancelDelete,
  selected,
  onToggleSelect,
}: {
  log: any;
  onDelete: (id: number) => void;
  onCancelDelete: (id: number) => void;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const scheduled = !!log.scheduledDeleteAt;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(log.id)}
          className="mt-1 shrink-0"
          aria-label="تحديد هذا السجل"
        />
        <div className="flex-1">
        <p className="text-sm text-foreground">{log.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {log.actorName && (
            <span className="text-xs text-muted-foreground">{log.actorName}</span>
          )}
          {log.actorRole && (
            <Badge variant="outline" className="text-xs">
              {log.actorRole === "tech_admin"
                ? "المدير التقني"
                : log.actorRole === "admin"
                ? "مسؤول"
                : log.actorRole === "club_president"
                ? "رئيس النادي"
                : log.actorRole === "vice_president"
                ? "نائب رئيس النادي"
                : log.actorRole === "public_relations_officer"
                ? "مسؤول العلاقات العامة"
                : log.actorRole === "secretary"
                ? "أمين السر"
                : log.actorRole === "treasurer"
                ? "أمين الصندوق"
                : log.actorRole === "supervisor"
                ? "مشرف السوشيال ميديا"
                : log.actorRole === "committee_head"
                ? "مشرف فريق"
                : "عضو"}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {ACTION_LABELS[log.action] || log.action}
          </Badge>
          {scheduled && (
            <Badge variant="destructive" className="text-xs gap-1">
              <Clock className="w-3 h-3" />
              مجدوَل للحذف: {formatDateTime(log.scheduledDeleteAt)}
            </Badge>
          )}
          {log.action === "basir.chat" && <BasirConversationDialog log={log} />}
        </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
          {formatDateTime(log.createdAt)}
        </span>
        {scheduled ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onCancelDelete(log.id)}>
            <Undo2 className="w-3.5 h-3.5" /> إلغاء الحذف
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => onDelete(log.id)}>
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminWorkLogs() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [scope, setScope] = useState<"all" | "elevated" | "member" | "basir">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: logs, isLoading, refetch, isFetching } = trpc.workLogs.list.useQuery(
    {
      scope: scope === "all" || scope === "basir" ? undefined : scope,
      action: scope === "basir" ? "basir.chat" : undefined,
      limit: 300,
    },
    { enabled: user?.role === "tech_admin" }
  );

  const deleteLog = trpc.workLogs.delete.useMutation({
    onSuccess: () => {
      toast.success("سيتم حذف السجل نهائياً خلال ٤٨ ساعة");
      refetch();
    },
    onError: (e) => toast.error(e.message || "تعذر الحذف"),
  });
  const cancelDeleteLog = trpc.workLogs.cancelDelete.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء جدولة الحذف");
      refetch();
    },
    onError: (e) => toast.error(e.message || "تعذر الإلغاء"),
  });
  const deleteManyLogs = trpc.workLogs.deleteMany.useMutation({
    onSuccess: (rows) => {
      toast.success(`سيتم حذف ${rows.length} سجل نهائياً خلال ٤٨ ساعة`);
      setSelectedIds([]);
      refetch();
    },
    onError: (e) => toast.error(e.message || "تعذر الحذف"),
  });
  const cancelDeleteManyLogs = trpc.workLogs.cancelDeleteMany.useMutation({
    onSuccess: (rows) => {
      toast.success(`تم إلغاء جدولة حذف ${rows.length} سجل`);
      setSelectedIds([]);
      refetch();
    },
    onError: (e) => toast.error(e.message || "تعذر الإلغاء"),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allVisibleIds = (logs ?? []).map((l: any) => l.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: number) => selectedIds.includes(id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : allVisibleIds);
  };

  if (user && user.role !== "tech_admin") {
    return (
      <div className="container mx-auto px-4 py-12 text-center" dir="rtl">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-muted-foreground">
          هذه الصفحة متاحة فقط للمدير التقني.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-4xl font-bold text-right">سجلات العمل</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>
      <p className="text-muted-foreground mb-6 text-right">
        سجل تدقيق شامل: من نشر أو عدّل أو حذف نشاطًا/مقالاً، من قام بترقية أو تعديل صلاحيات عضو،
        تسجيلات الدخول والخروج، وكذلك النشاط العادي للأعضاء (محادثات بصير، والتسجيل في الأنشطة).
      </p>

      <div className="flex gap-2 mb-6">
        <Button
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => {
            setScope("all");
            setSelectedIds([]);
          }}
        >
          الكل
        </Button>
        <Button
          size="sm"
          variant={scope === "elevated" ? "default" : "outline"}
          onClick={() => {
            setScope("elevated");
            setSelectedIds([]);
          }}
        >
          أصحاب الصلاحيات
        </Button>
        <Button
          size="sm"
          variant={scope === "member" ? "default" : "outline"}
          onClick={() => {
            setScope("member");
            setSelectedIds([]);
          }}
        >
          نشاط الأعضاء
        </Button>
        <Button
          size="sm"
          variant={scope === "basir" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => {
            setScope("basir");
            setSelectedIds([]);
          }}
        >
          <Bot className="w-3.5 h-3.5" />
          سجل بصير
        </Button>
      </div>

      {logs && logs.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4 bg-muted/40 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="تحديد الكل" />
            <span className="text-sm text-muted-foreground">
              {selectedIds.length > 0 ? `تم تحديد ${selectedIds.length} سجل` : "تحديد الكل"}
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={cancelDeleteManyLogs.isPending}
                onClick={() => cancelDeleteManyLogs.mutate({ ids: selectedIds })}
              >
                <Undo2 className="w-3.5 h-3.5" /> إلغاء الحذف المجدوَل ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                disabled={deleteManyLogs.isPending}
                onClick={() => {
                  if (confirm(`سيتم جدولة حذف ${selectedIds.length} سجل نهائياً بعد ٤٨ ساعة. هل تريد المتابعة؟`)) {
                    deleteManyLogs.mutate({ ids: selectedIds });
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف المحدد ({selectedIds.length})
              </Button>
            </div>
          )}
        </div>
      )}

      <Card className="p-6">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
        ) : logs && logs.length > 0 ? (
          <div>
            {logs.map((log: any) => (
              <LogRow
                key={log.id}
                log={log}
                selected={selectedIds.includes(log.id)}
                onToggleSelect={toggleSelect}
                onDelete={(id) => {
                  if (confirm("سيتم جدولة حذف هذا السجل نهائياً بعد ٤٨ ساعة. هل تريد المتابعة؟")) {
                    deleteLog.mutate({ id });
                  }
                }}
                onCancelDelete={(id) => cancelDeleteLog.mutate({ id })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3" />
            لا توجد سجلات حتى الآن
          </div>
        )}
      </Card>
    </div>
  );
}
