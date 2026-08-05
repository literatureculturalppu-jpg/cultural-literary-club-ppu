import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

function timeAgo(date: string | Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(date).toLocaleDateString("ar-EG");
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: count } = trpc.notifications.countUnread.useQuery(undefined, { retry: false });
  const { data: items, refetch } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: open, retry: false }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });
  const utils = trpc.useUtils();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleItemClick = (item: { id: number; url: string | null; isRead: boolean }) => {
    if (!item.isRead) {
      markRead.mutate(item.id, {
        onSuccess: () => utils.notifications.countUnread.invalidate(),
      });
    }
    setOpen(false);
    if (item.url) navigate(item.url);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        title="الإشعارات"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="w-5 h-5" />
        {!!count && count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          dir="rtl"
          className="absolute left-0 mt-2 w-80 max-w-[90vw] bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-foreground">الإشعارات</span>
            {!!count && count > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-accent flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!items || items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد إشعارات</p>
            ) : (
              items.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-right px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors flex gap-2 items-start ${
                    !item.isRead ? "bg-accent/5" : ""
                  }`}
                >
                  {!item.isRead && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!item.isRead ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo(item.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
