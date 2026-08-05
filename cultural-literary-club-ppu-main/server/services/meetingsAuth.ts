/**
 * Permission helpers for the electronic meetings system.
 *
 * "مؤسس النادي" (club founder) has no dedicated role in `user_role` — by
 * decision, the founder is defined as whichever "tech_admin" account was
 * created first (earliest `users.createdAt` among role = 'tech_admin').
 * This is computed on demand rather than stored, so it always tracks
 * correctly even if that account is later changed or a new tech_admin is
 * promoted earlier in a way that doesn't affect who was first.
 */
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db.js";
import { users, meetingOverridePermissions } from "../../drizzle/schema.js";

export type MeetingRole = "user" | "admin" | "supervisor" | "committee_head" | "general_agent" | "tech_admin";

/** Anyone who can moderate a meeting (admit/kick/ban, toggle blocks, lock, mute-all). */
export function isMeetingModerator(role: MeetingRole): boolean {
  return role === "admin" || role === "general_agent" || role === "tech_admin";
}

/**
 * The club founder: the earliest-created account with role = 'tech_admin'.
 * Returns null if there is no tech_admin account at all yet.
 */
export async function getClubFounderId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [founder] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "tech_admin"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  return founder?.id ?? null;
}

export async function isClubFounder(userId: number): Promise<boolean> {
  const founderId = await getClubFounderId();
  return founderId !== null && founderId === userId;
}

/** Whether this user currently holds an active, founder-granted override permission. */
export async function hasOverridePermission(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select()
    .from(meetingOverridePermissions)
    .where(eq(meetingOverridePermissions.userId, userId))
    .limit(1);
  return !!row?.active;
}

/**
 * True if this user can bypass a given meeting's mic/camera/screen-share/chat
 * blocks: moderators are exempt from blocks by default (the blocks target
 * "غير المصرح لهم" — non-moderators), and anyone (moderator or not) with an
 * active founder-granted override is exempt regardless of role.
 */
export async function canBypassMeetingRestrictions(userId: number, role: MeetingRole): Promise<boolean> {
  if (isMeetingModerator(role)) return true;
  return hasOverridePermission(userId);
}
