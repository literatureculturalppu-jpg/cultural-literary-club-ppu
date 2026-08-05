import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, UserCheck, UserX, ShieldBan, LogOut as KickIcon } from "lucide-react";
import type { ParticipantView } from "@/hooks/useLiveKitRoom";

export type WaitingEntry = { participantId: number; userId: number; name: string };

export function ModeratorPanel({
  onClose,
  waiting,
  onAdmit,
  onReject,
  participants,
  onKick,
  onBan,
  locked,
  onToggleLocked,
  micBlocked,
  cameraBlocked,
  screenShareBlocked,
  chatBlocked,
  onToggleMicBlocked,
  onToggleCameraBlocked,
  onToggleScreenShareBlocked,
  onToggleChatBlocked,
  onMuteAll,
  isFounder,
  onGrantOverride,
}: {
  onClose: () => void;
  waiting: WaitingEntry[];
  onAdmit: (participantId: number) => void;
  onReject: (participantId: number) => void;
  participants: ParticipantView[];
  onKick: (userId: number) => void;
  onBan: (userId: number) => void;
  locked: boolean;
  onToggleLocked: (v: boolean) => void;
  micBlocked: boolean;
  cameraBlocked: boolean;
  screenShareBlocked: boolean;
  chatBlocked: boolean;
  onToggleMicBlocked: (v: boolean) => void;
  onToggleCameraBlocked: (v: boolean) => void;
  onToggleScreenShareBlocked: (v: boolean) => void;
  onToggleChatBlocked: (v: boolean) => void;
  onMuteAll: () => void;
  isFounder: boolean;
  onGrantOverride: (userId: number) => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-background border-s border-border z-50 flex flex-col shadow-xl overflow-y-auto" dir="rtl">
      <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-background">
        <h3 className="font-bold text-foreground">لوحة إدارة الاجتماع</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {waiting.length > 0 && (
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-bold text-foreground mb-2">غرفة الانتظار ({waiting.length})</h4>
          <div className="space-y-2">
            {waiting.map((w) => (
              <div key={w.participantId} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground truncate">{w.name}</span>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="secondary" onClick={() => onAdmit(w.participantId)} title="قبول">
                    <UserCheck className="w-4 h-4 text-green-500" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => onReject(w.participantId)} title="رفض">
                    <UserX className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-b border-border space-y-3">
        <h4 className="text-sm font-bold text-foreground">إعدادات القيود</h4>
        <div className="flex items-center justify-between text-sm">
          <span>قفل الاجتماع</span>
          <Switch checked={locked} onCheckedChange={onToggleLocked} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>منع مشاركة الشاشة</span>
          <Switch checked={screenShareBlocked} onCheckedChange={onToggleScreenShareBlocked} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>منع المايك</span>
          <Switch checked={micBlocked} onCheckedChange={onToggleMicBlocked} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>منع الكاميرا</span>
          <Switch checked={cameraBlocked} onCheckedChange={onToggleCameraBlocked} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>منع الدردشة</span>
          <Switch checked={chatBlocked} onCheckedChange={onToggleChatBlocked} />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onMuteAll}>
          كتم الكل دفعة واحدة
        </Button>
      </div>

      <div className="p-3 space-y-2">
        <h4 className="text-sm font-bold text-foreground">المشاركون</h4>
        {participants.filter((p) => !p.isLocal).map((p) => (
          <div key={p.identity} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground truncate">{p.name}</span>
            <div className="flex gap-1 shrink-0">
              {isFounder && (
                <Button size="icon" variant="ghost" onClick={() => onGrantOverride(p.userId)} title="منح صلاحية كسر القيود">
                  <ShieldBan className="w-4 h-4 text-purple-500" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => onKick(p.userId)} title="طرد من الاجتماع">
                <KickIcon className="w-4 h-4 text-orange-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onBan(p.userId)} title="حظر دائم">
                <ShieldBan className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
