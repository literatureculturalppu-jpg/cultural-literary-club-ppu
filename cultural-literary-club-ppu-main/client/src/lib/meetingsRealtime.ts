/**
 * Supabase Realtime helper for the electronic-meetings system.
 *
 * Used ONLY for:
 *  - Presence (who's currently in the waiting room / room, for the live
 *    attendee counter and the moderator's admit/kick lists to update
 *    instantly instead of only on tRPC poll).
 *  - Broadcast (raise-hand, mute-all signal, "you were kicked" push,
 *    ephemeral chat messages).
 *
 * Nothing here ever touches the database — messages are relayed live
 * between connected clients and are gone once nobody is subscribed to the
 * channel. Actual audio/video never goes through Supabase at all; that's
 * LiveKit's job (see useLiveKitRoom.ts).
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!client) {
    client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

export type MeetingChatMessage = {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  sentAt: string;
};

export type MeetingBroadcastEvent =
  | { type: "chat"; message: MeetingChatMessage }
  | { type: "raise_hand"; userId: number; raised: boolean }
  | { type: "mute_all"; by: number }
  | { type: "kicked"; userId: number }
  | { type: "meeting_locked"; locked: boolean }
  | { type: "restriction_changed"; kind: "mic" | "camera" | "chat" | "screenShare"; blocked: boolean };

/**
 * Joins the per-meeting Realtime channel. Presence tracks `{ userId, name }`
 * for everyone currently subscribed; broadcast carries the ephemeral events
 * above. Returns the channel plus a typed `send` helper; caller is
 * responsible for calling `channel.unsubscribe()` on unmount/leave.
 */
export function joinMeetingChannel(params: {
  supabase: SupabaseClient;
  meetingId: number;
  userId: number;
  userName: string;
  onPresenceSync?: (presentUserIds: number[]) => void;
  onBroadcast?: (event: MeetingBroadcastEvent) => void;
}): { channel: RealtimeChannel; send: (event: MeetingBroadcastEvent) => void } {
  const { supabase, meetingId, userId, userName, onPresenceSync, onBroadcast } = params;
  const channel = supabase.channel(`meeting:${meetingId}`, {
    config: { presence: { key: String(userId) }, broadcast: { self: false } },
  });

  channel.on("presence", { event: "sync" }, () => {
    if (!onPresenceSync) return;
    const state = channel.presenceState<{ userId: number }>();
    const ids = Object.values(state)
      .flat()
      .map((p) => p.userId);
    onPresenceSync(ids);
  });

  channel.on("broadcast", { event: "meeting_event" }, ({ payload }) => {
    onBroadcast?.(payload as MeetingBroadcastEvent);
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ userId, name: userName });
    }
  });

  const send = (event: MeetingBroadcastEvent) => {
    channel.send({ type: "broadcast", event: "meeting_event", payload: event });
  };

  return { channel, send };
}
