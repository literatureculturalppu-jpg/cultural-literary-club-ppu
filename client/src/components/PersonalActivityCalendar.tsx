import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";

const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "بانتظار الموافقة", className: "bg-amber-100 text-amber-800" },
  approved: { label: "مقبول", className: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", className: "bg-red-100 text-red-800" },
};

function dayKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toIcsDate(value: Date | string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function downloadCalendarEvent(activity: any) {
  const start = new Date(activity.startDate);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const calendarDocument = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//النادي الثقافي الأدبي//تقويمي الشخصي//AR",
    "BEGIN:VEVENT",
    `UID:activity-${activity.id}@cultural-literary-club-ppu`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(activity.title)}`,
    `LOCATION:${escapeIcs(activity.location || "")}`,
    `URL:${window.location.origin}/activities/${activity.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([calendarDocument], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${activity.title.slice(0, 48)}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function PersonalActivityCalendar({ registrations, isLoading }: { registrations: any[]; isLoading: boolean }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const events = useMemo(() => registrations
    .filter((registration) => registration.startDate)
    .map((registration) => ({
      id: registration.activityId,
      subscriptionId: registration.subscriptionId,
      title: registration.title,
      startDate: registration.startDate,
      location: registration.location,
      status: registration.status,
    })), [registrations]);
  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, any[]>();
    events.forEach((event) => {
      const key = dayKey(event.startDate);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    });
    return byDay;
  }, [events]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = (new Date(year, monthIndex, 1).getDay() + 1) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - firstDay + 1);
  const monthEvents = events.filter((event) => {
    const date = new Date(event.startDate);
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right flex items-center gap-2 justify-end">
          تقويمي الشخصي
          <CalendarDays className="w-5 h-5 text-accent" />
        </CardTitle>
        <p className="text-sm text-muted-foreground text-right">تظهر هنا الأنشطة التي سجلت فيها فقط.</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-right">جاري تحميل تقويمك...</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-right border border-dashed border-border rounded-lg p-5">لا توجد أنشطة مسجلة في تقويمك الشخصي بعد.</p>
        ) : (
          <div className="space-y-6" dir="rtl">
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-border bg-accent/5">
                <Button variant="outline" size="icon" aria-label="الشهر التالي" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
                <h3 className="text-base font-bold text-foreground">{month.toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}</h3>
                <Button variant="outline" size="icon" aria-label="الشهر السابق" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-7 border-b border-border bg-muted/25">
                {WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[10px] font-bold text-muted-foreground">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, index) => {
                  const isCurrent = day >= 1 && day <= daysInMonth;
                  const key = isCurrent ? dayKey(new Date(year, monthIndex, day, 12)) : `empty-${index}`;
                  const dayEvents = isCurrent ? (eventsByDay.get(key) ?? []) : [];
                  return <div key={key} className={`min-h-20 md:min-h-24 border-l border-b border-border/60 p-1 ${isCurrent ? "bg-background" : "bg-muted/15"}`}>
                    {isCurrent && <span className="block text-[11px] font-semibold text-foreground/70 mb-1">{day}</span>}
                    {dayEvents.slice(0, 2).map((event) => <Link key={event.subscriptionId} href={`/activities/${event.id}`}><span className="block rounded bg-accent/10 hover:bg-accent/20 px-1 py-1 text-right text-[9px] leading-tight text-accent transition-colors line-clamp-2">{event.title}</span></Link>)}
                    {dayEvents.length > 2 && <span className="block text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2}</span>}
                  </div>;
                })}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-right mb-3">أنشطتي في {month.toLocaleDateString("ar-SA", { month: "long" })}</h3>
              {monthEvents.length === 0 ? <p className="text-sm text-muted-foreground text-right">لا توجد أنشطة مسجلة لك في هذا الشهر.</p> : <div className="grid gap-3">{monthEvents.map((event) => {
                const status = STATUS_LABELS[event.status] || STATUS_LABELS.pending;
                return <div key={event.subscriptionId} className="rounded-lg border border-border p-3 text-right">
                  <div className="flex flex-wrap items-center justify-between gap-2"><Badge className={status.className}>{status.label}</Badge><p className="font-semibold">{event.title}</p></div>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(event.startDate).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</p>
                  {event.location && <p className="mt-1 flex items-center justify-end gap-1 text-sm text-muted-foreground"><span>{event.location}</span><MapPin className="w-3.5 h-3.5 text-accent" /></p>}
                  <div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => downloadCalendarEvent(event)}><Download className="w-3.5 h-3.5 ml-1" />إضافة للجهاز</Button><Link href={`/activities/${event.id}`}><Button size="sm">فتح النشاط</Button></Link></div>
                </div>;
              })}</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
