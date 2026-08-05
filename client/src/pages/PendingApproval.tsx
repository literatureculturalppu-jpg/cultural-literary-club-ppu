import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, XCircle } from "lucide-react";

export default function PendingApproval({ status }: { status?: "pending" | "rejected" }) {
  const { logout, user } = useAuth();
  const isRejected = status === "rejected";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {isRejected ? (
          <XCircle className="w-14 h-14 text-destructive mx-auto" />
        ) : (
          <Clock className="w-14 h-14 text-accent mx-auto" />
        )}

        <h1 className="text-2xl font-bold text-foreground">
          {isRejected ? "لم تتم الموافقة على طلبك" : "طلبك قيد المراجعة"}
        </h1>

        <p className="text-muted-foreground">
          {isRejected
            ? "قامت إدارة النادي بعدم الموافقة على طلب انضمامك في الوقت الحالي. لأي استفسار يرجى التواصل مع إدارة النادي."
            : "شكراً لتسجيلك في نادي بصيرة. طلبك الآن قيد مراجعة الإدارة، وستتمكن من استخدام الموقع بمجرد الموافقة عليه."}
        </p>

        {user?.arabicFullName && (
          <p className="text-sm text-muted-foreground">
            الاسم المسجّل: <span className="font-medium text-foreground">{user.arabicFullName}</span>
          </p>
        )}

        <Button variant="outline" className="w-full" onClick={() => logout()}>
          تسجيل الخروج
        </Button>
      </Card>
    </div>
  );
}
