import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ChevronLeft, ChevronRight, Download, MapPin, Clock } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";

const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

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
  const end = activity.endDate ? new Date(activity.endDate) : new Date(new Date(activity.startDate).getTime() + 90 * 60 * 1000);
  const icsDocument = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//النادي الثقافي الأدبي//تقويم الفعاليات//AR",
    "BEGIN:VEVENT",
    `UID:activity-${activity.id}@cultural-literary-club-ppu`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(activity.startDate)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(activity.title)}`,
    `DESCRIPTION:${escapeIcs(activity.description || "فعالية للنادي الثقافي الأدبي")}`,
    `LOCATION:${escapeIcs(activity.location || "")}`,
    `URL:${window.location.origin}/activities/${activity.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([icsDocument], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${activity.title.slice(0, 48)}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function CalendarGrid({ activities, month, onPrevious, onNext, onSelect }: {
  activities: any[];
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (activity: any) => void;
}) {
  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, any[]>();
    activities.forEach((activity) => {
      const key = dayKey(activity.startDate);
      byDay.set(key, [...(byDay.get(key) ?? []), activity]);
    });
    return byDay;
  }, [activities]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = (new Date(year, monthIndex, 1).getDay() + 1) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - firstDay + 1);

  return (
    <Card className="overflow-hidden border-border/70" dir="rtl">
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border bg-accent/5">
        <Button variant="outline" size="icon" aria-label="الشهر التالي" onClick={onNext}><ChevronRight className="w-4 h-4" /></Button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{month.toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}</h2>
          <p className="text-xs text-muted-foreground mt-1">اختر فعالية لعرض تفاصيلها أو إضافتها إلى تقويمك</p>
        </div>
        <Button variant="outline" size="icon" aria-label="الشهر السابق" onClick={onPrevious}><ChevronLeft className="w-4 h-4" /></Button>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/25">
        {WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[11px] font-bold text-muted-foreground">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const isCurrent = day >= 1 && day <= daysInMonth;
          const key = isCurrent ? dayKey(new Date(year, monthIndex, day, 12)) : "empty-" + index;
          const events = isCurrent ? (eventsByDay.get(key) ?? []) : [];
          return (
            <div key={key} className={`min-h-24 md:min-h-32 border-l border-b border-border/60 p-1.5 md:p-2 ${isCurrent ? "bg-background" : "bg-muted/15"}`}>
              {isCurrent && <span className="block text-xs font-semibold text-foreground/70 mb-1">{day}</span>}
              <div className="space-y-1">
                {events.slice(0, 2).map((activity) => (
                  <button key={activity.id} onClick={() => onSelect(activity)} className="block w-full text-right rounded-md bg-accent/10 hover:bg-accent/20 px-1.5 py-1 text-[10px] leading-tight text-accent transition-colors line-clamp-2">
                    {new Date(activity.startDate).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} · {activity.title}
                  </button>
                ))}
                {events.length > 2 && <span className="block text-[10px] text-muted-foreground px-1">+{events.length - 2} فعاليات</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Calendar() {
  const { data: activities = [], isLoading } = trpc.activities.calendar.useQuery();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<any | null>(null);
  const monthEvents = activities.filter((activity: any) => {
    const date = new Date(activity.startDate);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container text-center">
          <CalendarDays className="w-10 h-10 text-accent mx-auto mb-3" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">تقويم الفعاليات</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">تابع مواعيد أنشطة النادي، وافتح تفاصيل أي فعالية أو أضفها مباشرة إلى تقويم جهازك.</p>
        </div>
      </section>
      <section className="container py-10 md:py-14">
        {isLoading ? <Skeleton className="h-[620px] rounded-xl" /> : (
          <>
            <CalendarGrid activities={activities} month={month} onPrevious={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} onSelect={setSelected} />
            <div className="mt-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">فعاليات {month.toLocaleDateString("ar-SA", { month: "long" })}</h2>
              {monthEvents.length ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{monthEvents.map((activity: any) => <EventSummary key={activity.id} activity={activity} onSelect={setSelected} />)}</div> : <p className="text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">لا توجد فعاليات مسجلة في هذا الشهر.</p>}
            </div>
          </>
        )}
      </section>
      {selected && <EventDialog activity={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function EventSummary({ activity, onSelect }: { activity: any; onSelect: (activity: any) => void }) {
  return <Card className="p-5 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-foreground leading-snug">{activity.title}</h3><span className="text-xs text-accent shrink-0">{new Date(activity.startDate).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}</span></div>
    <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
    <Button variant="outline" size="sm" className="w-full" onClick={() => onSelect(activity)}>عرض الفعالية</Button>
  </Card>;
}

function EventDialog({ activity, onClose }: { activity: any; onClose: () => void }) {
  const start = new Date(activity.startDate);
  return <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center" onClick={onClose} dir="rtl">
    <Card className="w-full max-w-lg p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <h2 className="text-xl font-bold text-foreground mb-3">{activity.title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground mb-5">{activity.description}</p>
      <div className="space-y-3 text-sm mb-6">
        <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-accent" />{start.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {start.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
        {activity.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent" />{activity.location}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link href={`/activities/${activity.id}`}><Button className="w-full bg-accent text-accent-foreground">التفاصيل والتسجيل</Button></Link>
        <Button variant="outline" className="w-full gap-1" onClick={() => downloadCalendarEvent(activity)}><Download className="w-4 h-4" />إضافة للتقويم</Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>إغلاق</Button>
      </div>
    </Card>
  </div>;
}
