import { eq, and, desc, asc, lt, or, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "../db.js";
import {
  meetings,
  meetingParticipants,
  meetingBans,
  meetingOverridePermissions,
  meetingGuestJoinRequests,
  users,
  type InsertMeeting,
  type InsertMeetingGuestJoinRequest,
} from "../../drizzle/schema.js";

function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// ─── Meetings ────────────────────────────────────────────────────────────

export async function createMeeting(params: {
  createdBy: number;
  title?: string;
  scheduledStartAt?: Date | null; // null/undefined = instant meeting
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const roomName = `meeting-${Date.now()}-${randomToken(6)}`;
  const inviteToken = randomToken(24);
  const isInstant = !params.scheduledStartAt;
  const [row] = await db
    .insert(meetings)
    .values({
      roomName,
      title: params.title,
      createdBy: params.createdBy,
      status: isInstant ? "live" : "scheduled",
      scheduledStartAt: params.scheduledStartAt ?? null,
      startedAt: isInstant ? new Date() : null,
      inviteToken,
    } satisfies InsertMeeting)
    .returning();
  return row;
}

export async function getMeetingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return row ?? null;
}

export async function getMeetingByInviteToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(meetings).where(eq(meetings.inviteToken, token)).limit(1);
  return row ?? null;
}

/** Upcoming = scheduled (not yet started) or currently live, ordered soonest-first. */
export async function listUpcomingMeetings() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(meetings)
    .where(or(eq(meetings.status, "scheduled"), eq(meetings.status, "live")))
    .orderBy(asc(meetings.scheduledStartAt), desc(meetings.createdAt));
}

export async function updateMeeting(id: number, data: Partial<InsertMeeting>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(meetings).set(data).where(eq(meetings.id, id)).returning();
  return row;
}

export async function cancelMeeting(id: number) {
  return updateMeeting(id, { status: "cancelled" });
}

export async function startScheduledMeetingIfDue(id: number) {
  const db = await getDb();
  if (!db) return null;
  const meeting = await getMeetingById(id);
  if (!meeting || meeting.status !== "scheduled") return meeting;
  if (meeting.scheduledStartAt && meeting.scheduledStartAt.getTime() <= Date.now()) {
    return updateMeeting(id, { status: "live", startedAt: new Date() });
  }
  return meeting;
}

export async function endMeeting(id: number) {
  return updateMeeting(id, { status: "ended", endedAt: new Date() });
}

export async function regenerateInviteToken(id: number) {
  return updateMeeting(id, { inviteToken: randomToken(24), inviteRevoked: false });
}

export async function revokeInviteLink(id: number) {
  return updateMeeting(id, { inviteRevoked: true });
}

// ─── Participants / waiting room ────────────────────────────────────────

export async function requestToJoin(meetingId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Re-use an existing row for this (meeting, user) pair if present so a
  // user re-requesting after being kicked/rejected gets a fresh "waiting"
  // state instead of piling up duplicate rows.
  const [existing] = await db
    .select()
    .from(meetingParticipants)
    .where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId)))
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(meetingParticipants)
      .set({ status: "waiting", requestedAt: new Date(), respondedAt: null, respondedBy: null, leftAt: null })
      .where(eq(meetingParticipants.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(meetingParticipants).values({ meetingId, userId, status: "waiting" }).returning();
  return row;
}

export async function listWaitingParticipants(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ participant: meetingParticipants, user: users })
    .from(meetingParticipants)
    .innerJoin(users, eq(users.id, meetingParticipants.userId))
    .where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.status, "waiting")))
    .orderBy(asc(meetingParticipants.requestedAt));
}

export async function listAdmittedParticipants(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ participant: meetingParticipants, user: users })
    .from(meetingParticipants)
    .innerJoin(users, eq(users.id, meetingParticipants.userId))
    .where(
      and(
        eq(meetingParticipants.meetingId, meetingId),
        eq(meetingParticipants.status, "admitted"),
        isNull(meetingParticipants.leftAt)
      )
    );
}

export async function respondToJoinRequest(
  participantId: number,
  decision: "admitted" | "rejected",
  respondedBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .update(meetingParticipants)
    .set({ status: decision, respondedAt: new Date(), respondedBy })
    .where(eq(meetingParticipants.id, participantId))
    .returning();
  return row;
}

export async function markParticipantLeft(meetingId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .update(meetingParticipants)
    .set({ status: "left", leftAt: new Date() })
    .where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId)))
    .returning();
  return row;
}

export async function kickParticipant(meetingId: number, userId: number, kickedBy: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .update(meetingParticipants)
    .set({ status: "kicked", respondedAt: new Date(), respondedBy: kickedBy, leftAt: new Date() })
    .where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId)))
    .returning();
  return row;
}

export async function getParticipantStatus(meetingId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(meetingParticipants)
    .where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function countCurrentAttendees(meetingId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.meetingId, meetingId),
        eq(meetingParticipants.status, "admitted"),
        isNull(meetingParticipants.leftAt)
      )
    );
  return Number(row?.n ?? 0);
}

// ─── Bans (permanent, club-wide) ────────────────────────────────────────

export async function banUserFromMeetings(userId: number, bannedBy: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select().from(meetingBans).where(eq(meetingBans.userId, userId)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(meetingBans).values({ userId, bannedBy, reason }).returning();
  return row;
}

export async function unbanUserFromMeetings(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(meetingBans).where(eq(meetingBans.userId, userId));
}

export async function isUserBannedFromMeetings(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select().from(meetingBans).where(eq(meetingBans.userId, userId)).limit(1);
  return !!row;
}

export async function listMeetingBans() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ ban: meetingBans, user: users })
    .from(meetingBans)
    .innerJoin(users, eq(users.id, meetingBans.userId))
    .orderBy(desc(meetingBans.createdAt));
}

// ─── Founder-granted override permissions ───────────────────────────────

export async function grantOverridePermission(userId: number, grantedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db
    .select()
    .from(meetingOverridePermissions)
    .where(eq(meetingOverridePermissions.userId, userId))
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(meetingOverridePermissions)
      .set({ active: true, grantedBy })
      .where(eq(meetingOverridePermissions.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(meetingOverridePermissions)
    .values({ userId, grantedBy, active: true })
    .returning();
  return row;
}

export async function revokeOverridePermission(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(meetingOverridePermissions)
    .set({ active: false })
    .where(eq(meetingOverridePermissions.userId, userId));
}

export async function listOverridePermissions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ grant: meetingOverridePermissions, user: users })
    .from(meetingOverridePermissions)
    .innerJoin(users, eq(users.id, meetingOverridePermissions.userId))
    .where(eq(meetingOverridePermissions.active, true));
}

// ─── Cleanup (called by the daily cron job, see api/index.ts) ───────────

/**
 * Deletes metadata rows for meetings that have been `ended`/`cancelled` for
 * more than 24h, and their participant rows. Never touches media/chat —
 * neither is stored here in the first place (LiveKit + Supabase Realtime
 * only, both ephemeral).
 */
export async function runScheduledMeetingsCleanup() {
  const db = await getDb();
  if (!db) return { deletedMeetings: 0 };
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(
        or(eq(meetings.status, "ended"), eq(meetings.status, "cancelled")),
        or(lt(meetings.endedAt, cutoff), and(isNull(meetings.endedAt), lt(meetings.createdAt, cutoff)))
      )
    );
  for (const { id } of stale) {
    await db.delete(meetingParticipants).where(eq(meetingParticipants.meetingId, id));
    await db.delete(meetings).where(eq(meetings.id, id));
  }
  return { deletedMeetings: stale.length };
}

/**
 * Safety-net auto-end: any `live` meeting with zero current attendees for
 * more than 10 minutes is marked `ended`. Called opportunistically (e.g.
 * whenever the upcoming-meetings list is fetched) since Vercel's free-tier
 * cron can only run once a day — this can't rely on cron alone.
 */
export async function autoEndEmptyLiveMeetings() {
  const db = await getDb();
  if (!db) return;
  const live = await db.select().from(meetings).where(eq(meetings.status, "live"));
  const emptyCutoffMs = 10 * 60 * 1000;
  for (const meeting of live) {
    const attendees = await countCurrentAttendees(meeting.id);
    if (attendees > 0) continue;
    // Never had anyone join yet — give it the same grace window from creation.
    const since = meeting.startedAt ?? meeting.createdAt;
    if (Date.now() - since.getTime() > emptyCutoffMs) {
      await endMeeting(meeting.id);
    }
  }
}

// ─── Guest ("بدون حساب") join info requests ──────────────────────────────
//
// When someone without a club account tries to join a meeting, they fill
// out the same info form as a guest activity registration. We snapshot the
// meeting's title/date at submission time (rather than joining against
// `meetings` on read) because meeting rows are purged by the cleanup cron
// shortly after the meeting ends — the dashboard list must stay readable
// and indexable by meeting name/date long after that.

export async function createMeetingGuestJoinRequest(
  params: Omit<InsertMeetingGuestJoinRequest, "id" | "requestedAt" | "meetingTitle" | "meetingDate">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const meeting = await getMeetingById(params.meetingId);
  const [row] = await db
    .insert(meetingGuestJoinRequests)
    .values({
      ...params,
      meetingTitle: meeting?.title ?? null,
      meetingDate: meeting?.scheduledStartAt ?? meeting?.startedAt ?? meeting?.createdAt ?? null,
    })
    .returning();
  return row;
}

/** Full list, newest first. The dashboard groups/sorts these client-side by meeting name + date. */
export async function listMeetingGuestJoinRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(meetingGuestJoinRequests)
    .orderBy(desc(meetingGuestJoinRequests.meetingDate), desc(meetingGuestJoinRequests.requestedAt));
}

export async function updateMeetingGuestJoinRequest(
  id: number,
  data: Partial<
    Pick<
      InsertMeetingGuestJoinRequest,
      | "fullName"
      | "universityEmail"
      | "universityId"
      | "college"
      | "specialization"
      | "academicYear"
      | "phoneNumber"
      | "whatsapp"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .update(meetingGuestJoinRequests)
    .set(data)
    .where(eq(meetingGuestJoinRequests.id, id))
    .returning();
  return row ?? null;
}

export async function deleteMeetingGuestJoinRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(meetingGuestJoinRequests).where(eq(meetingGuestJoinRequests.id, id));
  return { success: true };
}
