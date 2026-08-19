import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const WELCOME_SEEN_KEY = "club-first-visit-welcome-seen-v1";

/**
 * Introductory screen for public first-time visitors. It is deliberately
 * independent from the member-profile onboarding flow and is remembered only
 * in this browser, so it never blocks registration or later browsing.
 */
export default function FirstVisitWelcome() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      setIsOpen(!window.localStorage.getItem(WELCOME_SEEN_KEY));
    } catch {
      // If browser storage is disabled, keep the public site immediately usable.
      setIsOpen(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(WELCOME_SEEN_KEY, "true");
    } catch {
      // The user can still enter the site even when storage is unavailable.
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-accent/35 bg-card shadow-2xl">
        <div className="bg-gradient-to-b from-black via-black to-accent/20 px-7 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-accent/45 bg-black p-2 shadow-lg">
            <img src="/club-icon-192.png" alt="شعار النادي الثقافي الأدبي" className="h-full w-full object-contain" />
          </div>
          <p className="mt-5 text-sm text-accent">جامعة بوليتكنك فلسطين</p>
          <h1 id="first-visit-title" className="mt-2 text-2xl font-bold text-white">مرحبًا بك في النادي الثقافي الأدبي</h1>
          <p className="mt-3 leading-7 text-white/80">مساحة طلابية تجمع الأدب والفكر والفنون، وتمنحك طريقًا مباشرًا إلى الأنشطة والمقالات والكتب والإنجازات.</p>
        </div>

        <div className="space-y-5 px-7 py-6">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-accent" />محتوى أدبي</span>
            <span className="h-4 w-px bg-border" />
            <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-accent" />فعاليات وثقافة</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            ابدأ التصفح
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={dismiss} className="mx-auto block text-sm text-muted-foreground underline-offset-4 hover:underline">
            تخطَّ الشاشة
          </button>
        </div>
      </section>
    </div>
  );
}
