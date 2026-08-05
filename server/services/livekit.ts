/**
 * LiveKit media-server integration.
 *
 * Works identically whether `LIVEKIT_URL` points at LiveKit Cloud (the
 * easiest option — a managed service with a free tier, zero server ops)
 * or at a self-hosted instance (e.g. on Oracle Cloud's free tier), since
 * both speak the same LiveKit server API. Nothing else in this file
 * changes between the two; only the env vars differ.
 *
 * The token embeds a short expiry (`ttl`) and per-room, per-permission
 * grants, and is generated server-side using the LiveKit API secret,
 * which must never be exposed to the client. This is the "JWT قصير
 * الصلاحية" referenced in the spec.
 */
import { AccessToken } from "livekit-server-sdk";
import { ENV } from "../_core/env.js";

export function isLiveKitConfigured(): boolean {
  return !!(ENV.livekitUrl && ENV.livekitApiKey && ENV.livekitApiSecret);
}

export type LiveKitGrants = {
  roomName: string;
  identity: string; // must be unique per participant in the room — we use the app user id
  name: string; // display name shown in the UI
  canPublish: boolean; // mic/camera/screen-share allowed
  canPublishData: boolean; // realtime data channel (used for raise-hand signaling, etc.)
  canSubscribe: boolean; // can see/hear others (always true once admitted)
  ttlSeconds?: number;
};

/**
 * Mints a short-lived LiveKit access token for one participant joining one
 * room. Callers MUST have already verified the user is authenticated,
 * admitted past the waiting room, not banned, and not blocked by a
 * meeting-level restriction (mic/camera grants are still enforced
 * server-side here based on that decision — this is not just a UI toggle).
 */
export async function createLiveKitToken(grants: LiveKitGrants): Promise<string> {
  if (!isLiveKitConfigured()) {
    throw new Error(
      "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET."
    );
  }
  const at = new AccessToken(ENV.livekitApiKey, ENV.livekitApiSecret, {
    identity: grants.identity,
    name: grants.name,
    ttl: grants.ttlSeconds ?? 60 * 60 * 4, // 4h ceiling; meetings have no fixed end time but this bounds a single token's life
  });
  at.addGrant({
    room: grants.roomName,
    roomJoin: true,
    canPublish: grants.canPublish,
    canPublishData: grants.canPublishData,
    canSubscribe: grants.canSubscribe,
    canUpdateOwnMetadata: true,
  });
  return at.toJwt();
}

/** The public LiveKit server URL the browser client connects to (wss://...). */
export function getLiveKitUrl(): string {
  return ENV.livekitUrl;
}
