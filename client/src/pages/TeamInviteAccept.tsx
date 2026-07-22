import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function TeamInviteAccept() {
  const params = useParams<{ token: string }>();
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();

  const preview = trpc.teams.previewInvite.useQuery(
    { token: params.token },
    { enabled: !!user, retry: false }
  );

  const acceptInvite = trpc.teams.acceptInvite.useMutation({
    onSuccess: (res) => {
      toast.success("تم إرسال طلب الانضمام، بانتظار الموافقة");
      setLocation(`/teams/${res.teamId}`);
    },
    onError: (e) => toast.error(e.message || "تعذر قبول الدعوة"),
  });

  if (!user || preview.isLoading) {
    return (
      <div className="container py-16" dir="rtl">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (preview.error || !preview.data) {
    return (
      <div className="container py-16 text-center" dir="rtl">
        <Card className="p-12 max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-2">رابط الدعوة غير صالح</h2>
          <p className="text-muted-foreground mb-6">
            قد يكون الرابط منتهي الصلاحية أو تم إلغاؤه أو استُخدم أقصى عدد مسموح من المرات.
          </p>
          <Link href="/teams">
            <Button variant="outline">العودة إلى الفرق</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-16 text-center" dir="rtl">
      <Card className="p-12 max-w-lg mx-auto">
        <Users className="w-10 h-10 text-accent mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">دعوة للانضمام إلى فريق "{preview.data.teamName}"</h2>
        {preview.data.description && (
          <p className="text-muted-foreground mb-6">{preview.data.description}</p>
        )}
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={acceptInvite.isPending}
          onClick={() => acceptInvite.mutate({ token: params.token })}
        >
          إرسال طلب الانضمام
        </Button>
        <Link href="/teams" className="block mt-4 text-sm text-muted-foreground hover:text-accent">
          <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
          العودة إلى الفرق
        </Link>
      </Card>
    </div>
  );
}
