import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { getSupabaseClient, joinMeetingChannel, type MeetingChatMessage, type MeetingBroadcastEvent } from "@/lib/meetingsRealtime";
import { VideoTile } from "@/components/meetings/VideoTile";
import { ChatPanel } from "@/components/meetings/ChatPanel";
import { ModeratorPanel } from "@/components/meetings/ModeratorPanel";
import { MemberInfoDialog } from "@/components/meetings/MemberInfoDialog";
import { MeetingControlBar } from "@/components/meetings/MeetingControlBar";
import { GuestJoinRequestForm } from "@/components/meetings/GuestJoinRequestForm";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";

const MODERATOR_ROLES = new Set(["admin", "club_president", "vice_president", "public_relations_officer", "tech_admin"]);

export default function MeetingRoom() {
  const { token: inviteToken } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  // No redirect here: someone WITHOUT an account should see the guest
  // "طلب معلومات الانضمام" form on this page instead of being bounced to
  // /login (see the `!user` branch below), so `useAuth()` is left at its
  // default of not redirecting.
  const { user } = useAuth();
  const isModerator = !!user && MODERATOR_ROLES.has(user.role);

  const { data: config } = trpc.meetings.isConfigured.useQuery();
  const { data: meeting, error: resolveError } = trpc.meetings.resolveInvite.useQuery(
    { token: inviteToken! },
    { enabled: !!inviteToken && !!user, retry: false }
  );
  // Guest (no account) equivalent of `resolveInvite` above — minimal, safe
  // fields only (see server/routers.ts), just enough to show the meeting's
  // name on the guest info form.
  const { data: guestMeetingInfo, error: guestResolveError } = trpc.meetings.resolveInvitePublic.useQuery(
    { token: inviteToken! },
    { enabled: !!inviteToken && !user, retry: false }
  );
  const { data: isFounder } = trpc.meetings.isFounder.useQuery(undefined, { enabled: !!user });
  const { data: canBypass = false } = trpc.meetings.myBypassStatus.useQuery(undefined, { enabled: !!user });

  const requestJoin = trpc.meetings.requestJoin.useMutation();
  const getToken = trpc.meetings.getToken.useMutation();
  const admitMutation = trpc.meetings.admit.useMutation();
  const rejectMutation = trpc.meetings.reject.useMutation();
  const kickMutation = trpc.meetings.kick.useMutation();
  const banMutation = trpc.meetings.ban.useMutation();
  const leaveMutation = trpc.meetings.leave.useMutation();
  const setLockedMutation = trpc.meetings.setLocked.useMutation();
  const setMicBlockedMutation = trpc.meetings.setMicBlocked.useMutation();
  const setCameraBlockedMutation = trpc.meetings.setCameraBlocked.useMutation();
  const setScreenShareBlockedMutation = trpc.meetings.setScreenShareBlocked.useMutation();
  const setChatBlockedMutation = trpc.meetings.setChatBlocked.useMutation();
  const grantOverrideMutation = trpc.meetings.grantOverride.useMutation();

  const { data: myStatus } = trpc.meetings.myParticipantStatus.useQuery(
    { meetingId: meeting?.id ?? 0 },
    {
      enabled: !!meeting && !!user,
      refetchInterval: (q) => (q.state.data?.status === "admitted" || q.state.data?.status === "rejected" ? false : 2000),
    }
  );

  const utils = trpc.useUtils();
  const { data: waitingList } = trpc.meetings.listWaiting.useQuery(
    { meetingId: meeting?.id ?? 0 },
    { enabled: !!meeting && isModerator, refetchInterval: 3000 }
  );
  const { data: attendeeCount = 0 } = trpc.meetings.attendeeCount.useQuery(
    { meetingId: meeting?.id ?? 0 },
    { enabled: !!meeting && !!user, refetchInterval: 5000 }
  );

  const admitted = isModerator || myStatus?.status === "admitted";
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);

  useEffect(() => {
    if (!meeting || !user) return;
    // Auto-request to join once we've resolved the invite (moderators are
    // auto-admitted server-side; everyone else lands in the waiting room).
    requestJoin.mutate({ meetingId: meeting.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, !!user]);

  useEffect(() => {
    if (!meeting || !admitted || liveKitToken) return;
    getToken.mutate(
      { meetingId: meeting.id },
      { onSuccess: (res) => setLiveKitToken(res.token), onError: () => toast.error("تعذر الحصول على إذن الدخول للاجتماع") }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, admitted]);

  // The LiveKit server URL comes back with the token response (see
  // server/services/livekit.ts `getToken`) rather than from `isConfigured`,
  // since it's a public per-meeting connection detail, not a secret.
  const [liveKitUrl, setLiveKitUrl] = useState("");
  useEffect(() => {
    if (getToken.data?.url) setLiveKitUrl(getToken.data.url);
  }, [getToken.data?.url]);
  const room = useLiveKitRoom({ url: liveKitUrl, token: liveKitToken ?? "", enabled: !!liveKitToken && !!liveKitUrl });

  // ── Supabase Realtime: presence, chat, raise-hand, moderator broadcasts ──
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [raisedHands, setRaisedHands] = useState<Set<number>>(new Set());
  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [moderatorPanelOpen, setModeratorPanelOpen] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [viewingMemberId, setViewingMemberId] = useState<number | null>(null);
  const [sendEvent, setSendEvent] = useState<((e: MeetingBroadcastEvent) => void) | null>(null);

  useEffect(() => {
    if (!meeting || !user || !config?.supabaseUrl || !config?.supabaseAnonKey) return;
    const supabase = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
    const { channel, send } = joinMeetingChannel({
      supabase,
      meetingId: meeting.id,
      userId: user.id,
      userName: user.name || "عضو",
      onBroadcast: (event) => {
        if (event.type === "chat") setChatMessages((prev) => [...prev, event.message]);
        if (event.type === "raise_hand") {
          setRaisedHands((prev) => {
            const next = new Set(prev);
            if (event.raised) next.add(event.userId);
            else next.delete(event.userId);
            return next;
          });
        }
        if (event.type === "kicked" && event.userId === user.id) {
          toast.error("تم إخراجك من الاجتماع بواسطة المسؤول");
          navigate("/");
        }
        if (event.type === "mute_all" && !isModerator) {
          room.forceMuteLocal();
          toast.info("قام المسؤول بكتم صوت الجميع");
        }
      },
    });
    setSendEvent(() => send);
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, user?.id, config?.supabaseUrl, config?.supabaseAnonKey]);

  const handleLeave = useCallback(() => {
    if (meeting) leaveMutation.mutate({ meetingId: meeting.id });
    room.disconnect();
    navigate("/");
  }, [meeting, leaveMutation, room, navigate]);

  const toggleHand = useCallback(() => {
    if (!user) return;
    const next = !handRaised;
    setHandRaised(next);
    sendEvent?.({ type: "raise_hand", userId: user.id, raised: next });
  }, [handRaised, sendEvent, user]);

  const sendChat = useCallback(
    (content: string) => {
      if (!user) return;
      const message: MeetingChatMessage = {
        id: crypto.randomUUID(),
        senderId: user.id,
        senderName: user.name || "عضو",
        content,
        sentAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, message]);
      sendEvent?.({ type: "chat", message });
    },
    [sendEvent, user]
  );

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config.liveKitConfigured || !config.supabaseUrl || !config.supabaseAnonKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <Alert variant="destructive" className="max-w-lg">
          <ShieldAlert className="w-4 h-4" />
          <AlertDescription>
            نظام الاجتماعات غير مُفعّل بعد على الخادم. يجب على المدير التقني ضبط متغيرات البيئة
            LIVEKIT_URL و LIVEKIT_API_KEY و LIVEKIT_API_SECRET و SUPABASE_URL و SUPABASE_ANON_KEY.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Guest (no club account): show the "طلب معلومات الانضمام" info form
  // instead of the member waiting-room/meeting UI below. Submitting it
  // records the guest's info for the club's review — it does not admit
  // them into the live meeting.
  if (!user) {
    if (guestResolveError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
          <Alert variant="destructive" className="max-w-lg">
            <ShieldAlert className="w-4 h-4" />
            <AlertDescription>{guestResolveError.message || "رابط الدعوة غير صالح أو انتهت صلاحيته"}</AlertDescription>
          </Alert>
        </div>
      );
    }
    if (!guestMeetingInfo) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return <GuestJoinRequestForm token={inviteToken!} meetingTitle={guestMeetingInfo.title} />;
  }

  if (resolveError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <Alert variant="destructive" className="max-w-lg">
          <ShieldAlert className="w-4 h-4" />
          <AlertDescription>{resolveError.message || "رابط الدعوة غير صالح أو انتهت صلاحيته"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!admitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center" dir="rtl">
        <div>
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">أنت في غرفة الانتظار</h1>
          <p className="text-muted-foreground">
            {myStatus?.status === "rejected"
              ? "تم رفض طلب انضمامك إلى هذا الاجتماع."
              : "بانتظار موافقة المسؤول أو المدير التقني على انضمامك..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 pb-24" dir="rtl">
      <div className="p-3 flex items-center justify-between text-white/80 text-sm">
        <span>{meeting.title || "اجتماع النادي الثقافي الأدبي"}</span>
        <span className="text-xs bg-white/10 px-2 py-1 rounded">هذا الاجتماع لا يُسجَّل ولا تُحفظ محادثاته</span>
      </div>

      <div className={`p-3 grid gap-3 ${gridView ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
        {room.participants.map((p) => (
          <VideoTile
            key={p.identity}
            participant={p}
            handRaised={raisedHands.has(p.userId)}
            nameClickable={isModerator && !p.isLocal}
            onNameClick={() => setViewingMemberId(p.userId)}
            speakerView={!gridView && p.isSpeaking}
          />
        ))}
      </div>

      <MeetingControlBar
        micOn={room.micOn}
        cameraOn={room.cameraOn}
        screenShareOn={room.screenShareOn}
        micBlocked={meeting.micBlocked && !canBypass}
        cameraBlocked={meeting.cameraBlocked && !canBypass}
        chatBlocked={meeting.chatBlocked && !canBypass}
        handRaised={handRaised}
        gridView={gridView}
        attendeeCount={attendeeCount}
        onToggleMic={room.toggleMic}
        onToggleCamera={room.toggleCamera}
        onStartScreenShare={room.startScreenShare}
        onStopScreenShare={room.stopScreenShare}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleHand={toggleHand}
        onToggleView={() => setGridView((v) => !v)}
        onLeave={handleLeave}
      />

      {isModerator && (
        <Button
          className="fixed top-3 left-3 z-40"
          size="sm"
          variant="secondary"
          onClick={() => setModeratorPanelOpen((v) => !v)}
        >
          إدارة الاجتماع
        </Button>
      )}

      {chatOpen && (
        <ChatPanel messages={chatMessages} onSend={sendChat} onClose={() => setChatOpen(false)} disabled={meeting.chatBlocked && !canBypass} />
      )}

      {moderatorPanelOpen && isModerator && (
        <ModeratorPanel
          onClose={() => setModeratorPanelOpen(false)}
          waiting={(waitingList ?? []).map((w) => ({ participantId: w.participant.id, userId: w.user.id, name: w.user.name || "عضو" }))}
          onAdmit={(id) => admitMutation.mutate({ participantId: id }, { onSuccess: () => utils.meetings.listWaiting.invalidate() })}
          onReject={(id) => rejectMutation.mutate({ participantId: id }, { onSuccess: () => utils.meetings.listWaiting.invalidate() })}
          participants={room.participants}
          onKick={(uid) => kickMutation.mutate({ meetingId: meeting.id, userId: uid })}
          onBan={(uid) => {
            if (confirm("هل أنت متأكد من حظر هذا العضو بشكل دائم من كل اجتماعات النادي؟")) {
              banMutation.mutate({ userId: uid });
            }
          }}
          locked={meeting.locked}
          onToggleLocked={(v) => setLockedMutation.mutate({ id: meeting.id, locked: v })}
          micBlocked={meeting.micBlocked}
          cameraBlocked={meeting.cameraBlocked}
          screenShareBlocked={meeting.screenShareBlocked}
          chatBlocked={meeting.chatBlocked}
          onToggleMicBlocked={(v) => setMicBlockedMutation.mutate({ id: meeting.id, blocked: v })}
          onToggleCameraBlocked={(v) => setCameraBlockedMutation.mutate({ id: meeting.id, blocked: v })}
          onToggleScreenShareBlocked={(v) => setScreenShareBlockedMutation.mutate({ id: meeting.id, blocked: v })}
          onToggleChatBlocked={(v) => setChatBlockedMutation.mutate({ id: meeting.id, blocked: v })}
          onMuteAll={() => user && sendEvent?.({ type: "mute_all", by: user.id })}
          isFounder={!!isFounder}
          onGrantOverride={(uid) => grantOverrideMutation.mutate({ userId: uid }, { onSuccess: () => toast.success("تم منح صلاحية كسر القيود") })}
        />
      )}

      <MemberInfoDialog userId={viewingMemberId} onClose={() => setViewingMemberId(null)} />
    </div>
  );
}
