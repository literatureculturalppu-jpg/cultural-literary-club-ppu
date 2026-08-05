import { useEffect, useRef } from "react";
import { Track } from "livekit-client";
import type { ParticipantView } from "@/hooks/useLiveKitRoom";
import { MicOff, SignalHigh, SignalMedium, SignalLow, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";

function ConnectionQualityIcon({ quality }: { quality: string }) {
  if (quality === "excellent" || quality === "good") return <SignalHigh className="w-4 h-4 text-green-400" />;
  if (quality === "poor") return <SignalLow className="w-4 h-4 text-red-400" />;
  return <SignalMedium className="w-4 h-4 text-yellow-400" />;
}

export function VideoTile({
  participant,
  handRaised,
  onNameClick,
  nameClickable,
  speakerView,
}: {
  participant: ParticipantView;
  handRaised?: boolean;
  onNameClick?: () => void;
  nameClickable?: boolean;
  speakerView?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const track = participant.screenShareTrack || participant.videoTrack;

  useEffect(() => {
    if (track && videoRef.current) {
      track.attach(videoRef.current);
    }
    return () => {
      if (track) track.detach();
    };
  }, [track]);

  useEffect(() => {
    if (participant.audioTrack && audioRef.current && !participant.isLocal) {
      participant.audioTrack.attach(audioRef.current);
    }
    return () => {
      participant.audioTrack?.detach();
    };
  }, [participant.audioTrack, participant.isLocal]);

  return (
    <div
      className={`relative bg-black/90 rounded-xl overflow-hidden aspect-video flex items-center justify-center ${
        participant.isSpeaking ? "ring-2 ring-accent" : "ring-1 ring-border/40"
      } ${speakerView ? "col-span-full row-span-2" : ""}`}
    >
      {/* خلفية شفافة تحمل اسم النادي — Watermark */}
      <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-white/10 text-2xl md:text-4xl font-bold text-center px-4">
        النادي الثقافي الأدبي
      </span>

      {track ? (
        <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center text-lg font-bold text-white z-10">
          {participant.name.charAt(0)}
        </div>
      )}
      <audio ref={audioRef} autoPlay />

      <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between z-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!nameClickable}
          onClick={onNameClick}
          className={`h-auto py-1 px-2 text-xs md:text-sm text-white bg-black/50 hover:bg-black/70 rounded-md ${
            nameClickable ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {participant.name}
          {participant.isLocal && " (أنت)"}
        </Button>
        <div className="flex items-center gap-1">
          {handRaised && (
            <span className="bg-yellow-500/90 rounded-full p-1">
              <Hand className="w-3.5 h-3.5 text-black" />
            </span>
          )}
          {!participant.micEnabled && (
            <span className="bg-black/50 rounded-full p-1">
              <MicOff className="w-3.5 h-3.5 text-red-400" />
            </span>
          )}
          <span className="bg-black/50 rounded-full p-1">
            <ConnectionQualityIcon quality={participant.connectionQuality} />
          </span>
        </div>
      </div>
    </div>
  );
}
