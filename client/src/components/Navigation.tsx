import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Menu, X, Bot, UserRound } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { trpc } from "@/lib/trpc";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const { data: aiSettings } = trpc.basir.getSettings.useQuery();
  const aiEnabled = aiSettings?.enabled ?? false;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navLinks = [
    { href: "/", label: "الرئيسية" },
    { href: "/about", label: "عن النادي" },
    { href: "/activities", label: "الأنشطة" },
    { href: "/articles", label: "المقالات" },
    { href: "/achievements", label: "الإنجازات" },
    { href: "/books", label: "الكتب" },
    ...(isAuthenticated ? [{ href: "/teams", label: "الفرق" }] : []),
  ];

  const isActive = (href: string) => {
    return location === href;
  };

  // A logged-in user who hasn't completed the mandatory profile form yet
  // must not be able to click their way to any other part of the site.
  const onboardingPending =
    isAuthenticated &&
    user &&
    (!user.onboardingCompleted || user.approvalStatus === "pending" || user.approvalStatus === "rejected");

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link href="/profile">
                <div
                  className="w-10 h-10 bg-accent rounded-full flex items-center justify-center cursor-pointer overflow-hidden"
                  title="ملفي الشخصي"
                >
                  <UserRound className="w-6 h-6 text-accent-foreground" />
                </div>
              </Link>
            ) : (
              <Link href="/">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center cursor-pointer">
                  <span className="text-accent-foreground font-bold text-lg">ب</span>
                </div>
              </Link>
            )}
            <Link href="/">
              <span className="font-bold text-lg text-foreground hidden sm:inline cursor-pointer">
                النادي الثقافي الأدبي
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {!onboardingPending && navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive(link.href) ? "default" : "ghost"}
                  className={isActive(link.href) ? "bg-accent text-accent-foreground" : ""}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {!onboardingPending && aiEnabled && (
                  <Link href="/basir">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative"
                      title="بصير - المساعد الذكي"
                    >
                      <Bot className="w-5 h-5" />
                    </Button>
                  </Link>
                )}
                {!onboardingPending && <NotificationBell />}
                {!onboardingPending && (user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin" || user?.role === "supervisor" || user?.role === "committee_head") && (
                  <Link href="/admin">
                    <Button variant="outline" className="hidden sm:inline-flex">
                      لوحة التحكم
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="hidden sm:inline-flex"
                >
                  {isLoggingOut ? "جاري الخروج..." : "تسجيل الخروج"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90 hidden sm:inline-flex">
                    دخول
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {!onboardingPending && navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive(link.href) ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    isActive(link.href) ? "bg-accent text-accent-foreground" : ""
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
            <div className="pt-2 border-t border-border space-y-2">
              {isAuthenticated ? (
                <>
                  {!onboardingPending && aiEnabled && (
                    <Link href="/basir">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => setIsOpen(false)}
                      >
                        <Bot className="w-4 h-4" />
                        بصير
                      </Button>
                    </Link>
                  )}
                  {!onboardingPending && (user?.role === "admin" || user?.role === "general_agent" || user?.role === "tech_admin") && (
                    <Link href="/admin">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setIsOpen(false)}
                      >
                        لوحة التحكم
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    disabled={isLoggingOut}
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                  >
                    {isLoggingOut ? "جاري الخروج..." : "تسجيل الخروج"}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Link href="/login" className="block" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                      تسجيل الدخول
                    </Button>
                  </Link>
                </div>
              )
            }
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
