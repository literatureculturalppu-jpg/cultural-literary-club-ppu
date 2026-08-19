import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineContentNotice() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (isOnline) return null;
  return (
    <div className="fixed bottom-4 right-4 left-4 z-[70] mx-auto max-w-xl rounded-xl border border-amber-400/45 bg-background/95 px-4 py-3 shadow-xl backdrop-blur" dir="rtl" role="status">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        <WifiOff className="h-4 w-4 shrink-0 text-accent" />
        <span>لا يوجد اتصال بالإنترنت. تُعرض آخر نسخة عامة محفوظة على هذا الجهاز.</span>
      </div>
    </div>
  );
}
