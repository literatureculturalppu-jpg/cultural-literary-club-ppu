import { lazy, Suspense, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bot, X } from "lucide-react";

const BasirPanel = lazy(() => import("@/components/BasirPanel"));

// Basir is reachable from anywhere in the member-only site EXCEPT the Teams
// area (which has its own separate, device-only chat) and the admin control
// panel (kept a focused, distraction-free workspace).
function isHiddenRoute(path: string) {
  return path.startsWith("/teams") || path.startsWith("/admin") || path === "/basir";
}

export default function BasirWidget() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const enabled = !!user && user.onboardingCompleted && user.approvalStatus === "approved";

  if (!enabled || isHiddenRoute(location)) return null;

  return (
    <>
      {/* Launcher bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        aria-label="بصير - المساعد الذكي"
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {open && (
        <Suspense fallback={null}>
          <BasirPanel
            onClose={() => setOpen(false)}
            onNavigate={(path) => setLocation(path)}
          />
        </Suspense>
      )}
    </>
  );
}
