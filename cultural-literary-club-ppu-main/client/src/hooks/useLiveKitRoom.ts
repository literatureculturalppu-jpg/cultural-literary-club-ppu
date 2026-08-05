import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  ConnectionState,
  LocalParticipant,
  Participant,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from "livekit-client";

export type ParticipantView = {
  identity: string;
  userId: number;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  connectionQuality: ConnectionQuality;
  videoTrack?: Track;
  audioTrack?: Track;
  screenShareTrack?: Track;
  micEnabled: boolean;
  cameraEnabled: boolean;
};

function toView(p: Participant, isLocal: boolean): ParticipantView {
  const videoPub = p.getTrackPublication(Track.Source.Camera);
  const audioPub = p.getTrackPublication(Track.Source.Microphone);
  const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
  return {
    identity: p.identity,
    userId: Number(p.identity),
    name: p.name || p.identity,
    isLocal,
    isSpeaking: p.isSpeaking,
    connectionQuality: p.connectionQuality,
    videoTrack: videoPub?.track,
    audioTrack: audioPub?.track,
    screenShareTrack: screenPub?.track,
    micEnabled: !!audioPub && !audioPub.isMuted,
    cameraEnabled: !!videoPub && !videoPub.isMuted,
  };
}

/**
 * Manages a single LiveKit room connection for the meeting UI: connect on
 * mount (given a token+url), keep a reactive list of participants (local +
 * remote) with their tracks/mute-state/connection-quality, and expose
 * mic/camera/screen-share toggles. Mic and camera both default OFF per the
 * spec, regardless of what the browser would otherwise default to.
 */
export function useLiveKitRoom(params: { url: string; token: string; enabled: boolean }) {
  const { url, token, enabled } = params;
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshParticipants = useCallback((room: Room) => {
    const list: ParticipantView[] = [toView(room.localParticipant, true)];
    room.remoteParticipants.forEach((p: RemoteParticipant) => list.push(toView(p, false)));
    setParticipants(list);
  }, []);

  useEffect(() => {
    if (!enabled || !url || !token) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const onAnyChange = () => refreshParticipants(room);
    room
      .on(RoomEvent.ParticipantConnected, onAnyChange)
      .on(RoomEvent.ParticipantDisconnected, onAnyChange)
      .on(RoomEvent.TrackSubscribed, onAnyChange)
      .on(RoomEvent.TrackUnsubscribed, onAnyChange)
      .on(RoomEvent.TrackMuted, onAnyChange)
      .on(RoomEvent.TrackUnmuted, onAnyChange)
      .on(RoomEvent.ActiveSpeakersChanged, onAnyChange)
      .on(RoomEvent.ConnectionQualityChanged, onAnyChange)
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => setConnectionState(state))
      .on(RoomEvent.Disconnected, () => setConnectionState(ConnectionState.Disconnected));

    room
      .connect(url, token)
      .then(async () => {
        if (cancelled) return;
        // Defaults: mic and camera both start OFF, matching the spec
        // exactly ("الحالة الافتراضية: مغلق/مغلقة") — never auto-enable.
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setCameraEnabled(false);
        refreshParticipants(room);
      })
      .catch((e) => setError(e?.message ?? "تعذر الاتصال بالاجتماع"));

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url, token]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
    refreshParticipants(room);
  }, [micOn, refreshParticipants]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
    refreshParticipants(room);
  }, [cameraOn, refreshParticipants]);

  const startScreenShare = useCallback(
    async (mode: "screen" | "window" | "tab") => {
      const room = roomRef.current;
      if (!room) return;
      try {
        // The browser's own share-type picker is what actually lets the
        // user choose window/full-screen/tab — `selfBrowserSurface`/the
        // OS dialog is what really decides; we just pass a hint.
        await room.localParticipant.setScreenShareEnabled(true, {
          audio: true,
        });
        setScreenShareOn(true);
        refreshParticipants(room);
      } catch {
        // User cancelled the OS share picker — not an error worth surfacing.
      }
    },
    [refreshParticipants]
  );

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    setScreenShareOn(false);
    refreshParticipants(room);
  }, [refreshParticipants]);

  const forceMuteLocal = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
    refreshParticipants(room);
  }, [refreshParticipants]);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
  }, []);

  const localParticipant: LocalParticipant | undefined = roomRef.current?.localParticipant;

  return {
    room: roomRef.current,
    connectionState,
    participants,
    micOn,
    cameraOn,
    screenShareOn,
    error,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    forceMuteLocal,
    disconnect,
    localParticipant,
  };
}
