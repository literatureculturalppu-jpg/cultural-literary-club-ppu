import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export function MemberInfoDialog({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const { data: member, isLoading } = trpc.users.getById.useQuery(userId as number, { enabled: userId !== null });

  return (
    <Dialog open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>بيانات العضو</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : member ? (
          <div className="space-y-1.5 text-sm">
            <p><span className="font-bold">الاسم: </span>{member.name}</p>
            <p><span className="font-bold">البريد الإلكتروني: </span>{member.email}</p>
            <p><span className="font-bold">الرقم المرجعي: </span>{member.referenceNumber}</p>
            <p><span className="font-bold">الكلية: </span>{member.college}</p>
            <p><span className="font-bold">التخصص: </span>{member.specialization}</p>
            <p><span className="font-bold">السنة الدراسية: </span>{member.academicYear}</p>
            <p><span className="font-bold">رقم الجوال: </span>{member.phoneNumber}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">تعذر تحميل بيانات العضو</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
