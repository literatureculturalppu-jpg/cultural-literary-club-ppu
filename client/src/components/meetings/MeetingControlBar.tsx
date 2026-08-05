import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, MessageSquare, Hand, PhoneOff, LayoutGrid, Users2 } from "lucide-react";

export function MeetingControlBar({
  micOn,
  cameraOn,
  screenShareOn,
  micBlocked,
  cameraBlocked,
  chatBlocked,
  handRaised,
  gridView,
  attendeeCount,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onToggleChat,
  onToggleHand,
  onToggleView,
  onLeave,
}: {
  micOn: boolean;
  cameraOn: boolean;
  screenShareOn: boolean;
  micBlocked: boolean;
  cameraBlocked: boolean;
  chatBlocked: boolean;
  handRaised: boolean;
  gridView: boolean;
  attendeeCount: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: (mode: "screen" | "window" | "tab") => void;
  onStopScreenShare: () => void;
  onToggleChat: () => void;
  onToggleHand: () => void;
  onToggleView: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 bg-black/80 backdrop-blur border-t border-white/10 py-3 px-2 flex items-center justify-center gap-2 flex-wrap"
      dir="rtl"
    >
      <div className="flex items-center gap-1 text-white/80 text-xs me-2">
        <Users2 className="w-4 h-4" />
        {attendeeCount}
      </div>

      <Button
        type="button"
        variant={micOn ? "secondary" : "destructive"}
        size="icon"
        disabled={micBlocked}
        title={micBlocked ? "المايك ممنوع في هذا الاجتماع" : micOn ? "كتم المايك" : "تشغيل المايك"}
        onClick={onToggleMic}
      >
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </Button>

      <Button
        type="button"
        variant={cameraOn ? "secondary" : "destructive"}
        size="icon"
        disabled={cameraBlocked}
        title={cameraBlocked ? "الكاميرا ممنوعة في هذا الاجتماع" : cameraOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
        onClick={onToggleCamera}
      >
        {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </Button>

      {screenShareOn ? (
        <Button type="button" variant="secondary" size="icon" onClick={onStopScreenShare} title="إيقاف مشاركة الشاشة">
          <ScreenShareOff className="w-5 h-5" />
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="icon" title="مشاركة الشاشة">
              <ScreenShare className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onStartScreenShare("window")}>مشاركة نافذة تطبيق واحد</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStartScreenShare("screen")}>مشاركة الشاشة بالكامل</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStartScreenShare("tab")}>مشاركة تبويب المتصفح</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        type="button"
        variant={handRaised ? "default" : "secondary"}
        size="icon"
        onClick={onToggleHand}
        title="رفع اليد"
      >
        <Hand className="w-5 h-5" />
      </Button>

      <Button type="button" variant="secondary" size="icon" disabled={chatBlocked} onClick={onToggleChat} title="الدردشة">
        <MessageSquare className="w-5 h-5" />
      </Button>

      <Button type="button" variant="secondary" size="icon" onClick={onToggleView} title="تبديل طريقة العرض">
        <LayoutGrid className="w-5 h-5" />
      </Button>

      <Button type="button" variant="destructive" size="icon" onClick={onLeave} title="مغادرة الاجتماع">
        <PhoneOff className="w-5 h-5" />
      </Button>
    </div>
  );
}
