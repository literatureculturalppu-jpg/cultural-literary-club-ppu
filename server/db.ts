import { eq, desc, and, inArray, isNotNull, ne, sql, lte, count, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import crypto from "crypto";
import { Pool } from "pg";
import { InsertUser, users, referenceNumberCounters } from "../drizzle/schema.js";
import { getRoleTransitionDenial, isAdminTierRole } from "../shared/clubRoles.js";
import {
  activities,
  articles,
  members,
  teamMembers,
  attachments,
  achievements,
  externalLinks,
  activitySubscriptions,
  teams,
  teamMembers2,
  teamJoinRequests,
  teamActionRequests,
  teamInviteLinks,
  type InsertTeamInviteLink,
  registrationRequests,
  notifications,
  notificationAttachments,
  aiSettings,
  aiPdfFiles,
  aiUsage,
  basirTasks,
  basirMemories,
  basirAutomations,
  learningSettings,
  learningCourses,
  learningVideos,
  learningRatings,
  type Activity,
  type Article,
  type Achievement,
  type Book,
  type InsertActivity,
  type InsertArticle,
  type InsertMember,
  type InsertTeamMember,
  type InsertAttachment,
  type InsertAchievement,
  type InsertExternalLink,
  type InsertActivitySubscription,
  type InsertTeam,
  type InsertTeamMember2,
  type InsertTeamJoinRequest,
  type InsertTeamActionRequest,
  type InsertRegistrationRequest,
  type InsertNotification,
  type InsertNotificationAttachment,
  type InsertAiPdfFile,
  guestActivityRegistrations,
  type InsertGuestActivityRegistration,
  registrationSettings,
  books,
  type InsertBook,
  bookSuggestionRounds,
  type InsertBookSuggestionRound,
  bookSuggestions,
  type InsertBookSuggestion,
  bookVotePolls,
  type InsertBookVotePoll,
  bookVotePollOptions,
  type InsertBookVotePollOption,
  bookVoteBallots,
  type InsertBookVoteBallot,
  emailDailyQuota,
  profileEditRequests,
  type InsertProfileEditRequest,
  workLogs,
  type InsertWorkLog,
  mobileDevices,
  mobileAuthCodes,
  membershipCards,
  financialBudgetCategories,
  financialTransactions,
  financialReceipts,
  financialAuditLogs,
  type InsertFinancialBudgetCategory,
  type InsertFinancialTransaction,
} from "../drizzle/schema.js";
import { ENV, isProtectedAdminEmail, isTechAdminEmail } from './_core/env.js';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;
let mobileInfrastructurePromise: Promise<void> | null = null;

/** Cursor-based pagination for public editorial content. The cursor contains
 * only sort keys, never user data, and is intentionally opaque to clients. */
export type PublicContentPageOptions = {
  limit?: number;
  cursor?: string;
  publishedOnly?: boolean;
};
type PublicContentCursor = { pinned: boolean; createdAt: string; id: number };
export type PublicContentPage<T> = { items: T[]; nextCursor: string | null };

function pageLimit(value?: number) {
  return Math.max(1, Math.min(value ?? 20, 100));
}

function decodePublicContentCursor(value?: string): PublicContentCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PublicContentCursor;
    if (typeof parsed.pinned !== "boolean" || !Number.isInteger(parsed.id) || Number.isNaN(new Date(parsed.createdAt).getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodePublicContentCursor(row: { isPinned: boolean; createdAt: Date; id: number }) {
  return Buffer.from(JSON.stringify({ pinned: row.isPinned, createdAt: row.createdAt.toISOString(), id: row.id })).toString("base64url");
}

// Lazily create the drizzle instance so local tooling can run without a DB.
// Uses a `pg` Pool explicitly (rather than passing a bare connection string to
// `drizzle()`) so we can control SSL — Supabase's pooled connection strings
// require SSL, but don't ship a verifiable CA chain in most environments, so
// we disable strict cert verification the same way Supabase's own docs do
// for serverless platforms like Vercel.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Applies the small, idempotent mobile-only schema extension on first use.
 * The repository includes the equivalent SQL migration as an audit artifact,
 * while this guard lets the Vercel deployment apply it automatically with the
 * already configured DATABASE_URL instead of requiring an administrator to
 * run a separate command.
 */
export async function ensureMobileInfrastructure() {
  if (mobileInfrastructurePromise) return mobileInfrastructurePromise;
  mobileInfrastructurePromise = (async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.execute(sql.raw(`ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'book'`));
    await db.execute(sql.raw(`ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'announcement'`));
    await db.execute(sql.raw(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "senderId" integer`));
    await db.execute(sql.raw(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "links" text`));
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "notificationAttachments" (
      "id" serial PRIMARY KEY,
      "notificationId" integer NOT NULL,
      "fileName" varchar(255) NOT NULL,
      "fileUrl" varchar(500) NOT NULL,
      "fileKey" varchar(255),
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`));
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "notificationAttachments_notificationId_idx" ON "notificationAttachments" ("notificationId")`));
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "mobileDevices" (
      "id" serial PRIMARY KEY,
      "userId" integer NOT NULL,
      "expoPushToken" varchar(255) NOT NULL UNIQUE,
      "platform" varchar(24) NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`));
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "mobileDevices_userId_idx" ON "mobileDevices" ("userId")`));
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "mobileAuthCodes" (
      "id" serial PRIMARY KEY,
      "codeHash" varchar(128) NOT NULL UNIQUE,
      "userId" integer NOT NULL,
      "redirectUri" varchar(500) NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`));
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "mobileAuthCodes_expiresAt_idx" ON "mobileAuthCodes" ("expiresAt")`));
  })().catch((error) => {
    mobileInfrastructurePromise = null;
    throw error;
  });
  return mobileInfrastructurePromise;
}

/**
 * Atomically issues the next member reference number for the current
 * calendar year: 2-digit year + 4-digit sequence (e.g. "260001"). The
 * sequence resets automatically every Jan 1 because it's keyed by year.
 * Uses INSERT ... ON CONFLICT ... RETURNING so concurrent sign-ups never
 * collide, even under concurrent serverless invocations.
 */
async function generateReferenceNumber(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<string> {
  const year = new Date().getFullYear();
  const [{ counter }] = await db
    .insert(referenceNumberCounters)
    .values({ year, counter: 1 })
    .onConflictDoUpdate({
      target: referenceNumberCounters.year,
      set: { counter: sql`${referenceNumberCounters.counter} + 1` },
    })
    .returning({ counter: referenceNumberCounters.counter });

  const yy = String(year % 100).padStart(2, "0");
  const seq = String(counter).padStart(4, "0");
  return `${yy}${seq}`;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const existingRow = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    const isNewUser = existingRow.length === 0;

    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    // Reference number and approval status are only ever decided once, at
    // the moment of first insert. They are intentionally left out of
    // `updateSet` below so no later call (including this same function
    // running again on every subsequent sign-in) can ever change them —
    // there is no code path anywhere that edits these two columns after
    // creation, by design.
    if (isNewUser) {
      values.referenceNumber = await generateReferenceNumber(db);
      const isProtectedFirstSignIn =
        user.openId === ENV.ownerOpenId || isProtectedAdminEmail(user.email ?? null) || isTechAdminEmail(user.email ?? null);
      values.approvalStatus = isProtectedFirstSignIn ? "approved" : "pending";
      if (isProtectedFirstSignIn) values.approvedAt = new Date();
    } else {
      // Keep the existing values so the INSERT...ON CONFLICT candidate row
      // stays valid (both columns are NOT NULL); the conflict branch below
      // discards this and updates only the fields in `updateSet`.
      values.referenceNumber = existingRow[0].referenceNumber ?? undefined;
      values.approvalStatus = existingRow[0].approvalStatus;
    }

    const textFields = [
      "name",
      "email",
      "loginMethod",
      "profileImage",
      "profileImageKey",
    ] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    // Auto-promote the configured owner / any protected admin email to `admin`
    // on first sign-in. We never demote via this codepath — the UI-facing
    // `updateUserRole` is the only entry point for role changes, and it
    // explicitly blocks demotion of protected admins.
    const shouldAutoPromote =
      user.openId === ENV.ownerOpenId || isProtectedAdminEmail(user.email ?? null);
    // Technical-manager accounts ("المدير التقني") always take priority over
    // the plain admin auto-promotion above — this role sits above all
    // administrative and leadership roles. Enforced on every sign-in (not just the first) so it
    // can never be silently overridden by a stale "role" in the upsert
    // payload.
    const shouldAutoPromoteTechAdmin = isTechAdminEmail(user.email ?? null);
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (shouldAutoPromote) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    // Even if a role was explicitly passed, enforce admin for protected admins
    // so that a stale "user" role in an incoming payload cannot override.
    if (shouldAutoPromote) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (shouldAutoPromoteTechAdmin) {
      values.role = 'tech_admin';
      updateSet.role = 'tech_admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Get user by email
export async function getUserByEmail(email: string | null) {
  if (!email) {
    return undefined;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const normalized = email.toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Update an existing user's openId (used by the legacy openId migration during Google sign-in).
export async function updateUserOpenIdById(id: number, openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set({ openId }).where(eq(users.id, id));
}

// ─── Member approval workflow ──────────────────────────────────────────────
// New sign-ups start with approvalStatus = "pending" and are blocked from
// the rest of the site (see OnboardingGuard) until an admin approves them.

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get pending users: database not available");
    return [];
  }
  return await db
    .select()
    .from(users)
    .where(and(eq(users.approvalStatus, "pending"), eq(users.onboardingCompleted, true)))
    .orderBy(users.createdAt);
}

export async function approveUser(id: number, approvedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(users)
    .set({ approvalStatus: "approved", approvedAt: new Date(), approvedBy: approvedByUserId })
    .where(eq(users.id, id));
}

export async function rejectUser(id: number, rejectedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(users)
    .set({ approvalStatus: "rejected", approvedAt: new Date(), approvedBy: rejectedByUserId })
    .where(eq(users.id, id));
}

// Get activities created by a specific user
export async function getUserActivities(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user activities: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(activities)
    .where(eq(activities.createdBy, userId))
    .orderBy(desc(activities.createdAt));

  return result;
}

// Get articles created by a specific user
export async function getUserArticles(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user articles: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(articles)
    .where(eq(articles.createdBy, userId))
    .orderBy(desc(articles.createdAt));

  return result;
}

// Get achievements created by a specific user
export async function getUserAchievements(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user achievements: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(achievements)
    .where(eq(achievements.createdBy, userId))
    .orderBy(desc(achievements.createdAt));

  return result;
}

// Activities queries
export function getActivities(): Promise<Activity[]>;
export function getActivities(options: PublicContentPageOptions): Promise<PublicContentPage<Activity>>;
export async function getActivities(options?: PublicContentPageOptions): Promise<Activity[] | PublicContentPage<Activity>> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get activities: database not available");
    return options ? { items: [], nextCursor: null } : [];
  }

  if (!options) {
    return await db.select().from(activities).orderBy(desc(activities.isPinned), desc(activities.createdAt), desc(activities.id));
  }

  const cursor = decodePublicContentCursor(options.cursor);
  const cursorFilter = cursor ? or(
    lt(activities.isPinned, cursor.pinned),
    and(
      eq(activities.isPinned, cursor.pinned),
      or(
        lt(activities.createdAt, new Date(cursor.createdAt)),
        and(eq(activities.createdAt, new Date(cursor.createdAt)), lt(activities.id, cursor.id)),
      ),
    ),
  ) : undefined;
  const rows = await db.select().from(activities).where(cursorFilter).orderBy(desc(activities.isPinned), desc(activities.createdAt), desc(activities.id)).limit(pageLimit(options.limit) + 1);
  const hasMore = rows.length > pageLimit(options.limit);
  const items = hasMore ? rows.slice(0, -1) : rows;
  return { items, nextCursor: hasMore ? encodePublicContentCursor(items[items.length - 1]) : null };
}

export async function getActivityById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get activity: database not available");
    return null;
  }

  const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createActivity(data: InsertActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use drizzle's `$returningId()` (MySQL-only) so callers can look up the
  // freshly inserted row by primary key instead of doing a full-table scan +
  // title match (which was racy when two activities shared a title). See
  // Devin Review finding BUG_0004 on PR #9.
  const [{ id }] = await db.insert(activities).values(data).returning({ id: activities.id });
  return { ...data, id } as InsertActivity & { id: number };
}

export async function updateActivity(id: number, data: Partial<InsertActivity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(activities).set(data).where(eq(activities.id, id));
}

export async function deleteActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(activities).where(eq(activities.id, id));
}

// Articles queries
export function getArticles(): Promise<Article[]>;
export function getArticles(options: PublicContentPageOptions): Promise<PublicContentPage<Article>>;
export async function getArticles(options?: PublicContentPageOptions): Promise<Article[] | PublicContentPage<Article>> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get articles: database not available");
    return options ? { items: [], nextCursor: null } : [];
  }

  if (!options) {
    return await db.select().from(articles).orderBy(desc(articles.isPinned), desc(articles.createdAt), desc(articles.id));
  }

  const cursor = decodePublicContentCursor(options.cursor);
  const cursorFilter = cursor ? or(
    lt(articles.isPinned, cursor.pinned),
    and(
      eq(articles.isPinned, cursor.pinned),
      or(
        lt(articles.createdAt, new Date(cursor.createdAt)),
        and(eq(articles.createdAt, new Date(cursor.createdAt)), lt(articles.id, cursor.id)),
      ),
    ),
  ) : undefined;
  const filters = [options.publishedOnly ? eq(articles.published, true) : undefined, cursorFilter].filter(Boolean);
  const rows = await db.select().from(articles).where(filters.length ? and(...filters) : undefined).orderBy(desc(articles.isPinned), desc(articles.createdAt), desc(articles.id)).limit(pageLimit(options.limit) + 1);
  const hasMore = rows.length > pageLimit(options.limit);
  const items = hasMore ? rows.slice(0, -1) : rows;
  return { items, nextCursor: hasMore ? encodePublicContentCursor(items[items.length - 1]) : null };
}

export async function getArticleById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get article: database not available");
    return null;
  }

  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get article: database not available");
    return null;
  }

  const result = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createArticle(data: InsertArticle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use `$returningId()` for parity with `createActivity` / `createAchievement`:
  // callers need the fresh primary key to dispatch notifications, and the
  // slug lookup we were doing instead is brittle (TOCTOU against replica lag,
  // and silently skips notifications if the query returns null). Returning
  // the id directly removes both failure modes.
  const [{ id }] = await db.insert(articles).values(data).returning({ id: articles.id });
  return { ...data, id } as InsertArticle & { id: number };
}

export async function updateArticle(id: number, data: Partial<InsertArticle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(articles).set(data).where(eq(articles.id, id));
}

export async function deleteArticle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(articles).where(eq(articles.id, id));
}

// Members queries
export async function getMembers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get members: database not available");
    return [];
  }

  return await db.select().from(members);
}

export async function createMember(data: InsertMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(members).values(data);
}

export type MemberRole =
  | "user"
  | "admin"
  | "supervisor"
  | "committee_head"
  | "tech_admin"
  | "club_president"
  | "vice_president"
  | "public_relations_officer"
  | "secretary"
  | "treasurer";

export async function updateMemberRole(id: number, role: MemberRole, actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(members).where(eq(members.id, id)).limit(1);
  const currentRole = existing[0]?.role;
  const actor = actorId
    ? (await db.select({ role: users.role }).from(users).where(eq(users.id, actorId)).limit(1))[0]
    : undefined;
  const hierarchyDenial = getRoleTransitionDenial(actor?.role, currentRole, role);
  if (hierarchyDenial) throw new Error(hierarchyDenial);

  return await db.update(members).set({ role }).where(eq(members.id, id));
}

/**
 * Delete a row from the `members` table (club members registry, NOT the
 * About-Us `teamMembers` page). Previously the `members.delete` router
 * mistakenly called `deleteTeamMember`, silently wiping the public staff
 * list when an admin tried to remove a member record. This function is
 * the correct target (Devin Review fix).
 */
export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(members).where(eq(members.id, id));
}

// Team Members queries
export async function getTeamMembers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team members: database not available");
    return [];
  }

  return await db.select().from(teamMembers).orderBy(teamMembers.order);
}

export async function createTeamMember(data: InsertTeamMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(teamMembers).values(data);
}

export async function updateTeamMember(id: number, data: Partial<InsertTeamMember>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(teamMembers).set(data).where(eq(teamMembers.id, id));
}

export async function deleteTeamMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(teamMembers).where(eq(teamMembers.id, id));
}



// Attachments queries
export async function createAttachment(data: InsertAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(attachments).values(data);
}

export async function getAttachmentsByEntity(entityType: "article" | "activity", entityId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get attachments: database not available");
    return [];
  }

  return await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId)
      )
    );
}

// Achievements queries
export function getAchievements(): Promise<Achievement[]>;
export function getAchievements(options: PublicContentPageOptions): Promise<PublicContentPage<Achievement>>;
export async function getAchievements(options?: PublicContentPageOptions): Promise<Achievement[] | PublicContentPage<Achievement>> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get achievements: database not available");
    return options ? { items: [], nextCursor: null } : [];
  }

  if (!options) {
    return await db.select().from(achievements).orderBy(desc(achievements.isPinned), desc(achievements.createdAt), desc(achievements.id));
  }

  const cursor = decodePublicContentCursor(options.cursor);
  const cursorFilter = cursor ? or(
    lt(achievements.isPinned, cursor.pinned),
    and(
      eq(achievements.isPinned, cursor.pinned),
      or(
        lt(achievements.createdAt, new Date(cursor.createdAt)),
        and(eq(achievements.createdAt, new Date(cursor.createdAt)), lt(achievements.id, cursor.id)),
      ),
    ),
  ) : undefined;
  const rows = await db.select().from(achievements).where(cursorFilter).orderBy(desc(achievements.isPinned), desc(achievements.createdAt), desc(achievements.id)).limit(pageLimit(options.limit) + 1);
  const hasMore = rows.length > pageLimit(options.limit);
  const items = hasMore ? rows.slice(0, -1) : rows;
  return { items, nextCursor: hasMore ? encodePublicContentCursor(items[items.length - 1]) : null };
}

export async function getAchievementById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get achievement: database not available");
    return null;
  }

  const result = await db.select().from(achievements).where(eq(achievements.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createAchievement(data: InsertAchievement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Return the freshly-inserted row so the caller can reference its primary
  // key directly (notification dispatch uses the id to build a URL).
  const [{ id }] = await db.insert(achievements).values(data).returning({ id: achievements.id });
  return { ...data, id } as InsertAchievement & { id: number };
}

export async function updateAchievement(id: number, data: Partial<InsertAchievement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(achievements).set(data).where(eq(achievements.id, id));
}

export async function deleteAchievement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(achievements).where(eq(achievements.id, id));
}

// External Links queries
export async function getExternalLinks() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get external links: database not available");
    return [];
  }

  return await db.select().from(externalLinks).orderBy(externalLinks.order);
}

export async function getExternalLinksByType(type: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get external links: database not available");
    return [];
  }

  return await db.select().from(externalLinks).where(eq(externalLinks.type, type));
}

export async function createExternalLink(data: InsertExternalLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(externalLinks).values(data);
}

export async function updateExternalLink(id: number, data: Partial<InsertExternalLink>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(externalLinks).set(data).where(eq(externalLinks.id, id));
}

export async function deleteExternalLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(externalLinks).where(eq(externalLinks.id, id));
}

// Activity Subscriptions queries
export async function getActivitySubscriptions() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get activity subscriptions: database not available");
    return [];
  }

  return await db.select().from(activitySubscriptions);
}

export async function getUserActivitySubscriptions(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user activity subscriptions: database not available");
    return [];
  }

  return await db
    .select()
    .from(activitySubscriptions)
    .where(eq(activitySubscriptions.userId, userId));
}

/**
 * Same as `getUserActivitySubscriptions`, but joined with the activity row
 * itself — used by the member's own profile page ("الأنشطة التي سجلت فيها")
 * so it can render the activity title/date/status without a second
 * round-trip per subscription.
 */
export async function getUserActivitySubscriptionsWithActivity(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user activity subscriptions: database not available");
    return [];
  }

  const rows = await db
    .select({
      subscriptionId: activitySubscriptions.id,
      status: activitySubscriptions.status,
      subscribedAt: activitySubscriptions.subscribedAt,
      activityId: activities.id,
      title: activities.title,
      startDate: activities.startDate,
      endDate: activities.endDate,
      location: activities.location,
      activityStatus: activities.status,
    })
    .from(activitySubscriptions)
    .innerJoin(activities, eq(activitySubscriptions.activityId, activities.id))
    .where(eq(activitySubscriptions.userId, userId))
    .orderBy(desc(activities.startDate));

  return rows;
}

export async function createActivitySubscription(data: InsertActivitySubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(activitySubscriptions).values(data);
}

export async function deleteActivitySubscription(activityId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(activitySubscriptions)
    .where(
      and(
        eq(activitySubscriptions.activityId, activityId),
        eq(activitySubscriptions.userId, userId)
      )
    );
}

/** حذف تسجيل عضو من نشاط محدد؛ لا يحذف حساب العضو أو ملفه الشخصي. */
export async function deleteActivitySubscriptionById(activityId: number, subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(activitySubscriptions)
    .where(
      and(
        eq(activitySubscriptions.id, subscriptionId),
        eq(activitySubscriptions.activityId, activityId)
      )
    )
    .returning({ id: activitySubscriptions.id, userId: activitySubscriptions.userId });
}

export async function isUserSubscribedToActivity(activityId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot check subscription: database not available");
    return false;
  }

  const result = await db
    .select()
    .from(activitySubscriptions)
    .where(
      and(
        eq(activitySubscriptions.activityId, activityId),
        eq(activitySubscriptions.userId, userId)
      )
    )
    .limit(1);

  return result.length > 0;
}

// User queries
export async function getUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get users: database not available");
    return [];
  }

  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  // Flag protected admins so the admin UI can lock their role dropdown and
  // skip showing destructive actions.
  const { isProtectedAdminEmail, isTechAdminEmail } = await import("./_core/env.js");
  return rows.map((u) => ({
    ...u,
    isProtectedAdmin: isProtectedAdminEmail(u.email),
    isProtectedTechAdmin: isTechAdminEmail(u.email),
  }));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return null;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Look up a user by their permanent member reference number (e.g.
 * "260001"). Used anywhere staff need to identify a member without relying
 * on the internal numeric id — adding team members, assigning a team
 * supervisor, etc.
 */
export async function getUserByReferenceNumber(referenceNumber: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return null;
  }
  const cleaned = referenceNumber.trim();
  if (!cleaned) return null;
  const result = await db.select().from(users).where(eq(users.referenceNumber, cleaned)).limit(1);
  return result.length > 0 ? result[0] : null;
}


/**
 * Overrides a user's permanent reference number. This is intentionally the
 * only code path in the entire app that can change `referenceNumber` after
 * account creation — restricted to the Technical Manager ("tech_admin")
 * role at the router layer (see `techAdminProcedure`). No notification is
 * sent to the affected member; callers should not surface this change to
 * anyone besides the technical manager who performed it.
 */
export async function updateUserReferenceNumber(
  id: number,
  newReferenceNumber: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cleaned = newReferenceNumber.trim();
  if (!/^\d{6}$/.test(cleaned)) {
    throw new Error("صيغة الرقم المرجعي غير صحيحة، يجب أن يتكون من 6 أرقام");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referenceNumber, cleaned))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== id) {
    throw new Error("هذا الرقم المرجعي مستخدم بالفعل من قبل عضو آخر");
  }

  return await db
    .update(users)
    .set({ referenceNumber: cleaned })
    .where(eq(users.id, id));
}

export async function updateUserRole(
  id: number,
  role: MemberRole,
  actorId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Refuse to demote protected admins (i.e. the owner and anyone in
  // PROTECTED_ADMIN_EMAILS). This is enforced in the DB layer so every
  // caller — routers, scripts, future UIs — honors the invariant.
  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = existing[0];
  const actor = actorId
    ? (await db.select({ role: users.role }).from(users).where(eq(users.id, actorId)).limit(1))[0]
    : undefined;
  const hierarchyDenial = getRoleTransitionDenial(actor?.role, target?.role, role);
  if (hierarchyDenial) throw new Error(hierarchyDenial);
  if (target) {
    const isProtected =
      target.openId === ENV.ownerOpenId || isProtectedAdminEmail(target.email ?? null);
    if (isProtected && role !== "admin") {
      throw new Error(
        "لا يمكن تغيير دور المشرف الدائم لهذا الحساب"
      );
    }
    // Technical-manager ("tech_admin") accounts configured via
    // TECH_ADMIN_EMAILS can never be edited away from tech_admin through
    // this codepath — mirrors the protected-admin rule above, one tier up.
    if (isTechAdminEmail(target.email ?? null) && role !== "tech_admin") {
      throw new Error(
        "لا يمكن تغيير دور المدير التقني لهذا الحساب"
      );
    }
  }

  // "المدير التقني" (tech admin) cannot remove its own status either —
  // only another tech admin could, and in practice there is exactly one.
  if (target?.role === "tech_admin" && role !== "tech_admin" && actorId === id) {
    throw new Error("لا يمكن للمدير التقني إزالة صلاحيته الخاصة عن نفسه");
  }

  return await db.update(users).set({ role }).where(eq(users.id, id));
}

/**
 * Check whether the given user id belongs to a "protected admin" — the
 * configured owner or any email listed in `PROTECTED_ADMIN_EMAILS`. The
 * client uses this to visually lock the role picker.
 */
export async function isProtectedAdminUser(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (result.length === 0) return false;
  const u = result[0];
  return u.openId === ENV.ownerOpenId || isProtectedAdminEmail(u.email ?? null);
}

/**
 * Check whether the given user id belongs to a configured technical-manager
 * ("tech_admin" / المدير التقني) account. The client uses this to visually
 * lock the role picker the same way it does for protected admins.
 */
export async function isTechAdminUser(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (result.length === 0) return false;
  const u = result[0];
  return isTechAdminEmail(u.email ?? null) || u.role === "tech_admin";
}

// Teams queries
export async function getTeams() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get teams: database not available");
    return [];
  }

  return await db.select().from(teams);
}

/**
 * The subset of team info visible to any user before joining — name and
 * description only, no roster/supervisor/chat data. Used to give Basir
 * awareness of *visible* teams exclusively (`isVisible = true`), matching
 * what the "/teams" page already shows a non-member.
 */
export async function getVisibleTeamsPublic() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get teams: database not available");
    return [];
  }

  const rows = await db
    .select({ id: teams.id, name: teams.name, description: teams.description })
    .from(teams)
    .where(eq(teams.isVisible, true));
  return rows;
}

export async function getTeamsByHead(headId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get teams: database not available");
    return [];
  }

  return await db.select().from(teams).where(eq(teams.headId, headId));
}

export async function getTeamById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team: database not available");
    return null;
  }

  const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTeam(data: InsertTeam) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(teams).values(data);
}

export async function updateTeam(id: number, data: Partial<InsertTeam>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(teams).set(data).where(eq(teams.id, id));
}

export async function deleteTeam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(teams).where(eq(teams.id, id));
}

// Team Members (new) queries
export async function getTeamMembers2ByTeam(teamId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team members: database not available");
    return [];
  }

  return await db.select().from(teamMembers2).where(eq(teamMembers2.teamId, teamId));
}

export async function getTeamMember2ById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team member: database not available");
    return null;
  }

  const result = await db.select().from(teamMembers2).where(eq(teamMembers2.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTeamMember2(data: InsertTeamMember2) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(teamMembers2).values(data);
}

export async function deleteTeamMember2(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(teamMembers2).where(eq(teamMembers2.id, id));
}

/**
 * Every team a given user currently belongs to (for the "الفرق" section of
 * their own profile page). Joins teamMembers2 -> teams so the caller gets
 * team name/description directly instead of just ids.
 */
export async function getTeamsForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user's teams: database not available");
    return [];
  }

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      joinedAt: teamMembers2.joinedAt,
    })
    .from(teamMembers2)
    .innerJoin(teams, eq(teamMembers2.teamId, teams.id))
    .where(eq(teamMembers2.userId, userId));

  return rows;
}

const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  admin: "مسؤول",
  club_president: "رئيس النادي",
  vice_president: "نائب رئيس النادي",
  public_relations_officer: "مسؤول العلاقات العامة",
  secretary: "أمين السر",
  treasurer: "أمين الصندوق",
  tech_admin: "المدير التقني",
  supervisor: "مشرف السوشيال ميديا",
  committee_head: "مشرف فريق",
  user: "عضو النادي",
};

async function getMembershipPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const [headedTeams, memberTeams] = await Promise.all([
    db.select({ name: teams.name }).from(teams).where(eq(teams.headId, userId)),
    db
      .select({ name: teams.name })
      .from(teamMembers2)
      .innerJoin(teams, eq(teamMembers2.teamId, teams.id))
      .where(eq(teamMembers2.userId, userId)),
  ]);

  const positions = headedTeams.map((team) => `مشرف ${team.name}`);
  const headedNames = new Set(headedTeams.map((team) => team.name));
  memberTeams
    .filter((team) => !headedNames.has(team.name))
    .forEach((team) => positions.push(`عضو في ${team.name}`));

  return positions;
}

async function getOrCreateMembershipCard(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(membershipCards).where(eq(membershipCards.userId, userId)).limit(1);
  if (existing[0]) return existing[0];

  // A 256-bit opaque random token has no member data and cannot be guessed.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await db
      .insert(membershipCards)
      .values({ userId, verificationToken })
      .onConflictDoNothing();
    const created = await db.select().from(membershipCards).where(eq(membershipCards.userId, userId)).limit(1);
    if (created[0]) return created[0];
  }

  throw new Error("تعذر إصدار بطاقة العضوية، يرجى المحاولة مرة أخرى");
}

function toMembershipCardMember(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    arabicFullName: user.arabicFullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    whatsapp: user.whatsapp,
    universityId: user.universityId,
    college: user.college,
    department: user.department,
    specialization: user.specialization,
    academicYear: user.academicYear,
    dateOfBirth: user.dateOfBirth,
    culturalExperience: user.culturalExperience,
    profileImage: user.profileImage,
    referenceNumber: user.referenceNumber,
    approvalStatus: user.approvalStatus,
    approvedAt: user.approvedAt,
    role: user.role,
    roleLabel: MEMBERSHIP_ROLE_LABELS[user.role] ?? "عضو النادي",
    joinedAt: user.createdAt,
  };
}

/** The owner sees their complete card data; QR issuance waits for membership approval. */
export async function getMyMembershipCard(userId: number) {
  const user = await getUserById(userId);
  if (!user) return null;

  const positions = await getMembershipPositions(userId);
  const isEligible = user.approvalStatus === "approved" && user.onboardingCompleted;
  const card = isEligible ? await getOrCreateMembershipCard(userId) : null;

  return {
    member: toMembershipCardMember(user),
    positions: positions.length > 0 ? positions : [MEMBERSHIP_ROLE_LABELS[user.role] ?? "عضو النادي"],
    isEligible,
    card: card
      ? {
          verificationToken: card.verificationToken,
          issuedAt: card.issuedAt,
          isRevoked: card.isRevoked,
        }
      : null,
  };
}

/** QR verification returns only the data needed for an in-person admin check. */
export async function verifyMembershipCard(token: string, verifierId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ card: membershipCards, user: users })
    .from(membershipCards)
    .innerJoin(users, eq(membershipCards.userId, users.id))
    .where(eq(membershipCards.verificationToken, token))
    .limit(1);

  const record = rows[0];
  const isValid = Boolean(
    record &&
      !record.card.isRevoked &&
      record.user.approvalStatus === "approved" &&
      record.user.onboardingCompleted
  );

  if (!record || !isValid) return { valid: false as const };

  await db
    .update(membershipCards)
    .set({ lastVerifiedAt: new Date(), lastVerifiedBy: verifierId })
    .where(eq(membershipCards.id, record.card.id));

  return {
    valid: true as const,
    member: {
      id: record.user.id,
      arabicFullName: record.user.arabicFullName || record.user.name,
      profileImage: record.user.profileImage,
      referenceNumber: record.user.referenceNumber,
      universityId: record.user.universityId,
      college: record.user.college,
      department: record.user.department,
      specialization: record.user.specialization,
      academicYear: record.user.academicYear,
      role: record.user.role,
      roleLabel: MEMBERSHIP_ROLE_LABELS[record.user.role] ?? "عضو النادي",
      approvedAt: record.user.approvedAt,
    },
    positions: await getMembershipPositions(record.user.id),
    verifiedAt: new Date(),
  };
}

// Registration Requests queries
export async function getRegistrationRequests(status?: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get registration requests: database not available");
    return [];
  }

  if (status) {
    return await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.status, status as any))
      .orderBy(desc(registrationRequests.createdAt));
  }

  return await db.select().from(registrationRequests).orderBy(desc(registrationRequests.createdAt));
}

export async function getRegistrationRequestById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get registration request: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(registrationRequests)
    .where(eq(registrationRequests.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getRegistrationRequestByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get registration request: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(registrationRequests)
    .where(eq(registrationRequests.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createRegistrationRequest(data: InsertRegistrationRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(registrationRequests).values(data);
}

export async function approveRegistrationRequest(
  id: number,
  reviewedBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the registration request
  const request = await db
    .select()
    .from(registrationRequests)
    .where(eq(registrationRequests.id, id))
    .limit(1);

  if (!request || request.length === 0) {
    throw new Error("Registration request not found");
  }

  const regRequest = request[0];

  // Create user account
  const openId = `email-${regRequest.email}`;
  await upsertUser({
    openId,
    name: regRequest.name,
    email: regRequest.email,
    role: "user",
    loginMethod: "email",
  });

  // Delete the registration request after approval
  return await db
    .delete(registrationRequests)
    .where(eq(registrationRequests.id, id));
}

export async function rejectRegistrationRequest(
  id: number,
  rejectionReason: string,
  reviewedBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(registrationRequests)
    .set({
      status: "rejected",
      rejectionReason,
      reviewedBy,
    })
    .where(eq(registrationRequests.id, id));
}

export async function deleteRegistrationRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(registrationRequests).where(eq(registrationRequests.id, id));
}

// Team Join Requests queries
export async function getTeamJoinRequests(status?: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team join requests: database not available");
    return [];
  }

  if (status) {
    return await db
      .select()
      .from(teamJoinRequests)
      .where(eq(teamJoinRequests.status, status as any))
      .orderBy(desc(teamJoinRequests.requestedAt));
  }

  return await db.select().from(teamJoinRequests).orderBy(desc(teamJoinRequests.requestedAt));
}

export async function getTeamJoinRequestsByTeam(teamId: number, status?: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team join requests: database not available");
    return [];
  }

  if (status) {
    return await db
      .select()
      .from(teamJoinRequests)
      .where(
        and(
          eq(teamJoinRequests.teamId, teamId),
          eq(teamJoinRequests.status, status as any)
        )
      )
      .orderBy(desc(teamJoinRequests.requestedAt));
  }

  return await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.teamId, teamId))
    .orderBy(desc(teamJoinRequests.requestedAt));
}

export async function getTeamJoinRequestsByUser(userId: number, status?: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team join requests: database not available");
    return [];
  }

  if (status) {
    return await db
      .select()
      .from(teamJoinRequests)
      .where(
        and(
          eq(teamJoinRequests.userId, userId),
          eq(teamJoinRequests.status, status as any)
        )
      )
      .orderBy(desc(teamJoinRequests.requestedAt));
  }

  return await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.userId, userId))
    .orderBy(desc(teamJoinRequests.requestedAt));
}

export async function getTeamJoinRequestById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get team join request: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// Look up an existing pending join request for (team, user). Used by the
// `teamJoinRequests.create` mutation to prevent duplicate pending requests
// without blocking unrelated teams that happen to share a numeric id.
export async function getPendingTeamJoinRequestForUser(
  teamId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Database] Cannot get team join request: database not available"
    );
    return null;
  }

  const result = await db
    .select()
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.userId, userId),
        eq(teamJoinRequests.status, "pending")
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createTeamJoinRequest(data: InsertTeamJoinRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(teamJoinRequests).values(data);
}

export async function approveTeamJoinRequest(id: number, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the request
  const request = await getTeamJoinRequestById(id);
  if (!request) throw new Error("Team join request not found");

  // Add user to team
  await createTeamMember2({
    teamId: request.teamId,
    userId: request.userId,
  });

  // Update request status
  return await db
    .update(teamJoinRequests)
    .set({
      status: "approved",
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(eq(teamJoinRequests.id, id));
}

export async function rejectTeamJoinRequest(id: number, rejectionReason: string, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(teamJoinRequests)
    .set({
      status: "rejected",
      rejectionReason,
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(eq(teamJoinRequests.id, id));
}

// ---------------------------------------------------------------------------
// Team action requests — supervisor management actions that need admin
// approval unless the team's `headFreedom` flag lets them apply instantly.
// ---------------------------------------------------------------------------

export async function getTeamActionRequests(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db
      .select()
      .from(teamActionRequests)
      .where(eq(teamActionRequests.status, status as any))
      .orderBy(desc(teamActionRequests.createdAt));
  }
  return await db.select().from(teamActionRequests).orderBy(desc(teamActionRequests.createdAt));
}

export async function getTeamActionRequestsByTeam(teamId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db
      .select()
      .from(teamActionRequests)
      .where(and(eq(teamActionRequests.teamId, teamId), eq(teamActionRequests.status, status as any)))
      .orderBy(desc(teamActionRequests.createdAt));
  }
  return await db
    .select()
    .from(teamActionRequests)
    .where(eq(teamActionRequests.teamId, teamId))
    .orderBy(desc(teamActionRequests.createdAt));
}

export async function getTeamActionRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(teamActionRequests).where(eq(teamActionRequests.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTeamActionRequest(data: InsertTeamActionRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(teamActionRequests).values(data);
}

/**
 * Approve a pending team action request: applies the underlying effect
 * (add/remove member, flip visibility or chat) then marks the request
 * approved. Throws if the request is missing or already reviewed.
 */
export async function approveTeamActionRequest(id: number, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const request = await getTeamActionRequestById(id);
  if (!request) throw new Error("Team action request not found");
  if (request.status !== "pending") throw new Error("تم مراجعة هذا الطلب مسبقاً");

  const payload = JSON.parse(request.payload || "{}");

  switch (request.actionType) {
    case "add_member":
      await createTeamMember2({ teamId: request.teamId, userId: payload.userId });
      break;
    case "remove_member": {
      const existing = await db
        .select()
        .from(teamMembers2)
        .where(and(eq(teamMembers2.teamId, request.teamId), eq(teamMembers2.userId, payload.userId)))
        .limit(1);
      if (existing[0]) await deleteTeamMember2(existing[0].id);
      break;
    }
    case "set_visibility":
      await updateTeam(request.teamId, { isVisible: !!payload.value });
      break;
    case "set_chat_open":
      await updateTeam(request.teamId, { isChatOpen: !!payload.value });
      break;
  }

  return await db
    .update(teamActionRequests)
    .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
    .where(eq(teamActionRequests.id, id));
}

export async function rejectTeamActionRequest(id: number, rejectionReason: string, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(teamActionRequests)
    .set({ status: "rejected", rejectionReason, reviewedBy, reviewedAt: new Date() })
    .where(eq(teamActionRequests.id, id));
}

// Team invite links ("رابط دعوة") ------------------------------------------------

export async function createTeamInviteLink(data: InsertTeamInviteLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(teamInviteLinks).values(data).returning();
  return result[0];
}

export async function getTeamInviteLinksByTeam(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(teamInviteLinks)
    .where(eq(teamInviteLinks.teamId, teamId))
    .orderBy(desc(teamInviteLinks.createdAt));
}

export async function getTeamInviteLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(teamInviteLinks).where(eq(teamInviteLinks.token, token)).limit(1);
  return result[0] ?? null;
}

export async function incrementTeamInviteLinkUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(teamInviteLinks)
    .set({ usedCount: sql`${teamInviteLinks.usedCount} + 1` })
    .where(eq(teamInviteLinks.id, id));
}

export async function revokeTeamInviteLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(teamInviteLinks).set({ revoked: true }).where(eq(teamInviteLinks.id, id));
}

/**
 * Whether an invite link is still usable right now: not revoked, not past
 * its expiry timestamp (if any), and not past its max-uses count (if any).
 */
export function isInviteLinkUsable(link: { revoked: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }) {
  if (link.revoked) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return false;
  if (link.maxUses != null && link.usedCount >= link.maxUses) return false;
  return true;
}

/** All users with an administrative or leadership role — auto-members of every team. */
export async function getAdminTierUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(users)
    .where(inArray(users.role, ["admin", "tech_admin", "club_president", "vice_president", "public_relations_officer"] as any));
}

/** جميع الأدوار القادرة على عرض وقبول طلبات تسجيل الأنشطة. */
export async function getActivityApprovalUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ["admin", "tech_admin", "club_president", "vice_president", "public_relations_officer", "supervisor"] as any));
}

/**
 * Roster of a team for regular members: name + id only (no contact info,
 * academic details, etc). Admins merged in automatically since they're
 * implicit members of every team.
 */
export async function getTeamRosterNamesOnly(teamId: number) {
  const memberRows = await getTeamMembers2ByTeam(teamId);
  const admins = await getAdminTierUsers();
  const memberUserIds = memberRows.map((m) => m.userId);
  const allIds = Array.from(new Set([...memberUserIds, ...admins.map((a) => a.id)]));
  if (allIds.length === 0) return [];

  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: users.id, name: users.name, profileImage: users.profileImage, role: users.role })
    .from(users)
    .where(inArray(users.id, allIds));

  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    profileImage: u.profileImage,
    isAdmin: isAdminTierRole(u.role),
  }));
}

/**
 * Full roster of a team for the supervisor/admin: complete profile fields.
 * Admins merged in automatically since they're implicit members of every team.
 */
export async function getTeamRosterFull(teamId: number) {
  const memberRows = await getTeamMembers2ByTeam(teamId);
  const admins = await getAdminTierUsers();
  const memberUserIds = memberRows.map((m) => m.userId);
  const allIds = Array.from(new Set([...memberUserIds, ...admins.map((a) => a.id)]));
  if (allIds.length === 0) return [];

  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).where(inArray(users.id, allIds));

  return rows.map((u) => ({
    ...u,
    isAdmin: isAdminTierRole(u.role),
    membershipId: memberRows.find((m) => m.userId === u.id)?.id ?? null,
  }));
}

/** Is this user a member of the team — real membership row OR an admin (implicit membership). */
export async function isTeamMemberOrAdmin(teamId: number, userId: number, role?: string) {
  if (isAdminTierRole(role)) return true;
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: teamMembers2.id })
    .from(teamMembers2)
    .where(and(eq(teamMembers2.teamId, teamId), eq(teamMembers2.userId, userId)))
    .limit(1);
  return result.length > 0;
}

/** Small helper for the "add member" picker: approved users matching a name,
 * excluding anyone already on the team. Kept simple (in-memory filter) since
 * the club's member base is small; avoids exposing the full user directory
 * to a committee_head via a separate, more heavily-gated endpoint. */
export async function searchApprovedUsersByName(query: string, excludeIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: users.id, name: users.name, profileImage: users.profileImage })
    .from(users)
    .where(eq(users.approvalStatus, "approved"));
  const q = query.trim().toLowerCase();
  return rows
    .filter((u) => !excludeIds.includes(u.id) && (!q || (u.name ?? "").toLowerCase().includes(q)))
    .slice(0, 20);
}

/** Enriched team list for the admin "إدارة الفرق" page: head name + counts. */
export async function getTeamsForAdmin() {
  const allTeams = await getTeams();
  const result = [];
  for (const team of allTeams) {
    const head = await getUserById(team.headId);
    const roster = await getTeamRosterNamesOnly(team.id);
    const pendingJoin = await getTeamJoinRequestsByTeam(team.id, "pending");
    const pendingActions = await getTeamActionRequestsByTeam(team.id, "pending");
    result.push({
      ...team,
      headName: head?.name ?? "—",
      memberCount: roster.length,
      pendingJoinCount: pendingJoin.length,
      pendingActionCount: pendingActions.length,
    });
  }
  return result;
}

export async function updateUserOnboarding(
  userId: number,
  data: {
    arabicFullName?: string;
    academicYear?: string;
    college?: string;
    department?: string;
    phoneNumber?: string;
    skills?: string[];
    preferredTeamId?: number | null;
    onboardingCompleted?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = {};
  if (data.arabicFullName !== undefined) updateData.arabicFullName = data.arabicFullName;
  if (data.academicYear !== undefined) updateData.academicYear = data.academicYear;
  if (data.college !== undefined) updateData.college = data.college;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
  if (data.skills !== undefined) updateData.skills = JSON.stringify(data.skills);
  if (data.preferredTeamId !== undefined) updateData.preferredTeamId = data.preferredTeamId;
  if (data.onboardingCompleted !== undefined) updateData.onboardingCompleted = data.onboardingCompleted;

  return await db.update(users).set(updateData).where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Notifications (article / activity / achievement creation events)
// ---------------------------------------------------------------------------

/**
 * Return every user that should be notified when new content is published:
 * users who finished onboarding and have a non-null email. The creator of
 * the content is excluded so they don't receive a notification for their
 * own post.
 */
export async function getContentNotificationRecipients(
  excludeUserId?: number
): Promise<Array<{ id: number; email: string | null; name: string | null }>> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(
      excludeUserId !== undefined
        ? and(eq(users.onboardingCompleted, true), ne(users.id, excludeUserId))
        : eq(users.onboardingCompleted, true)
    );

  return rows;
}

export type NotificationAttachmentInput = {
  name: string;
  url: string;
  key?: string | null;
};

export type NotificationPayload = Omit<InsertNotification, "id" | "userId" | "createdAt" | "isRead" | "links"> & {
  links?: string[];
  attachments?: NotificationAttachmentInput[];
};

/** Creates one recipient-scoped in-app row per user. Rich attachment rows are
 * duplicated per recipient, allowing the details lookup to enforce ownership. */
export async function createNotificationsForUsers(
  userIds: number[],
  payload: NotificationPayload
): Promise<Array<{ id: number; userId: number }>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return [];
  await ensureMobileInfrastructure();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows: InsertNotification[] = uniqueUserIds.map((userId) => ({
    userId,
    senderId: payload.senderId ?? null,
    type: payload.type,
    entityId: payload.entityId,
    title: payload.title,
    body: payload.body ?? null,
    url: payload.url,
    links: payload.links?.length ? JSON.stringify(payload.links) : null,
  }));

  const created = await db.insert(notifications).values(rows).returning({ id: notifications.id, userId: notifications.userId });
  if (payload.attachments?.length) {
    const attachmentRows: InsertNotificationAttachment[] = created.flatMap((notification) =>
      payload.attachments!.map((attachment) => ({
        notificationId: notification.id,
        fileName: attachment.name,
        fileUrl: attachment.url,
        fileKey: attachment.key ?? null,
      }))
    );
    await db.insert(notificationAttachments).values(attachmentRows);
  }
  return created;
}

export async function getUserNotifications(
  userId: number,
  limit = 50
) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUserNotificationDetail(userId: number, id: number) {
  await ensureMobileInfrastructure();
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .limit(1);
  const notification = rows[0];
  if (!notification) return null;

  const [attachments, senderRows] = await Promise.all([
    db.select().from(notificationAttachments).where(eq(notificationAttachments.notificationId, id)).orderBy(notificationAttachments.id),
    notification.senderId
      ? db.select({ id: users.id, name: users.name, arabicFullName: users.arabicFullName, role: users.role }).from(users).where(eq(users.id, notification.senderId)).limit(1)
      : Promise.resolve([]),
  ]);

  let links: string[] = [];
  try {
    const parsed = JSON.parse(notification.links ?? "[]");
    links = Array.isArray(parsed) ? parsed.filter((link): link is string => typeof link === "string") : [];
  } catch {
    links = [];
  }
  const sender = senderRows[0] ?? null;
  return {
    ...notification,
    links,
    attachments,
    sender: sender ? { id: sender.id, name: sender.arabicFullName || sender.name || "إدارة النادي", role: sender.role } : null,
  };
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

export async function markNotificationRead(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

// ---------------------------------------------------------------------------
// Mobile application sessions and Expo device registration
// ---------------------------------------------------------------------------

export async function createMobileAuthCode(input: { codeHash: string; userId: number; redirectUri: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(mobileAuthCodes).values(input);
}

/** Consumes the hand-off record irrespective of expiry so an opaque code can
 * never be replayed. */
export async function consumeMobileAuthCode(codeHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(mobileAuthCodes).where(eq(mobileAuthCodes.codeHash, codeHash)).limit(1);
  const record = rows[0] ?? null;
  if (record) await db.delete(mobileAuthCodes).where(eq(mobileAuthCodes.id, record.id));
  if (!record || record.expiresAt.getTime() <= Date.now()) return null;
  return record;
}

export async function upsertMobileDevice(input: { userId: number; expoPushToken: string; platform: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(mobileDevices).where(eq(mobileDevices.expoPushToken, input.expoPushToken)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== input.userId || existing[0].platform !== input.platform) {
      await db.update(mobileDevices).set({ userId: input.userId, platform: input.platform }).where(eq(mobileDevices.id, existing[0].id));
    }
    return existing[0].id;
  }
  const [created] = await db.insert(mobileDevices).values(input).returning({ id: mobileDevices.id });
  return created.id;
}

export async function getMobileDevicesForUsers(userIds: number[]) {
  if (userIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mobileDevices).where(inArray(mobileDevices.userId, userIds));
}

export async function deleteMobileDeviceByToken(expoPushToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mobileDevices).where(eq(mobileDevices.expoPushToken, expoPushToken));
}

export async function getMobileNotificationRecipients(target: "all" | "members" = "all") {
  const db = await getDb();
  if (!db) return [];
  const recipients = await db.select({ id: users.id, approvalStatus: users.approvalStatus }).from(users).where(eq(users.onboardingCompleted, true));
  return target === "members" ? recipients.filter((user) => user.approvalStatus === "approved") : recipients;
}

// ── AI (Basir) Settings ─────────────────────────────────────────────

export async function getAiSettings() {
  const db = await getDb();
  if (!db) return { id: 1, enabled: false, updatedAt: new Date() };
  const rows = await db.select().from(aiSettings).limit(1);
  if (rows.length === 0) {
    await db.insert(aiSettings).values({ enabled: false });
    return { id: 1, enabled: false, updatedAt: new Date() };
  }
  return rows[0];
}

export async function updateAiEnabled(enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(aiSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(aiSettings).values({ enabled });
  } else {
    await db.update(aiSettings).set({ enabled }).where(eq(aiSettings.id, existing[0].id));
  }
  return { enabled };
}

// ── Basir Agent Mode ──────────────────────────────────────────────────
// Every operation below is scoped to one authenticated user. Limits prevent
// unbounded personal storage and automated notification volume.
const MAX_BASIR_TASKS_PER_USER = 100;
const MAX_BASIR_MEMORIES_PER_USER = 40;
const MAX_BASIR_AUTOMATIONS_PER_USER = 10;

export async function listBasirTasks(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select().from(basirTasks).where(eq(basirTasks.userId, userId)).orderBy(desc(basirTasks.createdAt));
}

export async function createBasirTask(userId: number, title: string, requiresApproval: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const existing = await db.select({ n: count() }).from(basirTasks).where(eq(basirTasks.userId, userId));
  if ((existing[0]?.n ?? 0) >= MAX_BASIR_TASKS_PER_USER) throw new Error("تم بلوغ الحد الأقصى لعدد المهام");
  const [row] = await db.insert(basirTasks).values({ userId, title: title.slice(0, 500), requiresApproval }).returning();
  return row;
}

export async function updateBasirTaskStatus(userId: number, id: number, status: (typeof basirTasks.$inferSelect)["status"]) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [row] = await db.update(basirTasks).set({ status }).where(and(eq(basirTasks.id, id), eq(basirTasks.userId, userId))).returning();
  if (!row) throw new Error("المهمة غير موجودة");
  return row;
}

export async function deleteBasirTask(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.delete(basirTasks).where(and(eq(basirTasks.id, id), eq(basirTasks.userId, userId)));
}

export async function listBasirMemories(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select().from(basirMemories).where(eq(basirMemories.userId, userId)).orderBy(desc(basirMemories.createdAt));
}

export async function listEnabledBasirMemoryTexts(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const rows = await db.select({ text: basirMemories.text }).from(basirMemories).where(and(eq(basirMemories.userId, userId), eq(basirMemories.enabled, true))).orderBy(desc(basirMemories.createdAt)).limit(MAX_BASIR_MEMORIES_PER_USER);
  return rows.map((row) => row.text);
}

export async function createBasirMemory(userId: number, text: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const existing = await db.select({ n: count() }).from(basirMemories).where(eq(basirMemories.userId, userId));
  if ((existing[0]?.n ?? 0) >= MAX_BASIR_MEMORIES_PER_USER) throw new Error("تم بلوغ الحد الأقصى لعناصر الذاكرة");
  const [row] = await db.insert(basirMemories).values({ userId, text: text.slice(0, 500) }).returning();
  return row;
}

export async function setBasirMemoryEnabled(userId: number, id: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [row] = await db.update(basirMemories).set({ enabled }).where(and(eq(basirMemories.id, id), eq(basirMemories.userId, userId))).returning();
  if (!row) throw new Error("العنصر غير موجود");
  return row;
}

export async function deleteBasirMemory(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.delete(basirMemories).where(and(eq(basirMemories.id, id), eq(basirMemories.userId, userId)));
}

export async function listBasirAutomations(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select().from(basirAutomations).where(eq(basirAutomations.userId, userId)).orderBy(desc(basirAutomations.createdAt));
}

function nextBasirAutomationRun(cadence: "daily" | "weekly", from: Date = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + (cadence === "weekly" ? 7 : 1));
  return next;
}

export async function createBasirAutomation(userId: number, title: string, cadence: "daily" | "weekly") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const existing = await db.select({ n: count() }).from(basirAutomations).where(eq(basirAutomations.userId, userId));
  if ((existing[0]?.n ?? 0) >= MAX_BASIR_AUTOMATIONS_PER_USER) throw new Error("تم بلوغ الحد الأقصى للتذكيرات المؤتمتة");
  const [row] = await db.insert(basirAutomations).values({ userId, title: title.slice(0, 255), cadence, nextRunAt: nextBasirAutomationRun(cadence) }).returning();
  return row;
}

export async function deleteBasirAutomation(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.delete(basirAutomations).where(and(eq(basirAutomations.id, id), eq(basirAutomations.userId, userId)));
}

export async function getDueBasirAutomations(now: Date = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select().from(basirAutomations).where(and(eq(basirAutomations.enabled, true), lte(basirAutomations.nextRunAt, now)));
}

export async function markBasirAutomationRun(id: number, cadence: "daily" | "weekly", ranAt: Date = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(basirAutomations).set({ lastRunAt: ranAt, nextRunAt: nextBasirAutomationRun(cadence, ranAt) }).where(eq(basirAutomations.id, id));
}

// ── Member Learning Hub ──────────────────────────────────────────────

export async function getLearningSettings() {
  const db = await getDb();
  if (!db) return { id: 1, enabled: false, updatedBy: null, updatedAt: new Date() };
  const rows = await db.select().from(learningSettings).limit(1);
  if (rows.length === 0) {
    await db.insert(learningSettings).values({ enabled: false });
    return { id: 1, enabled: false, updatedBy: null, updatedAt: new Date() };
  }
  return rows[0];
}

export async function updateLearningEnabled(enabled: boolean, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(learningSettings).limit(1);
  if (existing.length === 0) await db.insert(learningSettings).values({ enabled, updatedBy });
  else await db.update(learningSettings).set({ enabled, updatedBy }).where(eq(learningSettings.id, existing[0].id));
  return { enabled };
}

export async function getLearningCourses(audience?: "students" | "teachers", includeUnpublished = false) {
  const db = await getDb();
  if (!db) return [];
  const courses = includeUnpublished
    ? audience
      ? await db.select().from(learningCourses).where(eq(learningCourses.audience, audience)).orderBy(desc(learningCourses.createdAt))
      : await db.select().from(learningCourses).orderBy(desc(learningCourses.createdAt))
    : audience
      ? await db.select().from(learningCourses).where(and(eq(learningCourses.audience, audience), eq(learningCourses.published, true))).orderBy(desc(learningCourses.createdAt))
      : await db.select().from(learningCourses).where(eq(learningCourses.published, true)).orderBy(desc(learningCourses.createdAt));
  const courseIds = courses.map((course) => course.id);
  if (courseIds.length === 0) return [];
  const [videos, ratings] = await Promise.all([
    db.select().from(learningVideos).where(inArray(learningVideos.courseId, courseIds)).orderBy(learningVideos.sortOrder),
    db.select().from(learningRatings).where(inArray(learningRatings.courseId, courseIds)),
  ]);
  return courses.map((course) => {
    const courseVideos = videos.filter((video) => video.courseId === course.id);
    const courseRatings = ratings.filter((rating) => rating.courseId === course.id);
    return { ...course, videoCount: courseVideos.length, videos: courseVideos, ratingCount: courseRatings.length, averageRating: courseRatings.length ? Math.round((courseRatings.reduce((sum, rating) => sum + rating.rating, 0) / courseRatings.length) * 10) / 10 : 0 };
  });
}

export async function getLearningCourseById(id: number) {
  const courses = await getLearningCourses();
  return courses.find((course) => course.id === id) ?? null;
}

export async function createLearningCourse(data: { audience: "students" | "teachers"; title: string; courseCode: string; level: string; description?: string | null; coverImageUrl?: string | null; averageVideoMinutes: number; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [course] = await db.insert(learningCourses).values(data).returning();
  return course;
}

export async function updateLearningCourse(id: number, data: Partial<{ audience: "students" | "teachers"; title: string; courseCode: string; level: string; description: string | null; coverImageUrl: string | null; averageVideoMinutes: number; published: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [course] = await db.update(learningCourses).set(data).where(eq(learningCourses.id, id)).returning();
  return course ?? null;
}

export async function deleteLearningCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(learningVideos).where(eq(learningVideos.courseId, id));
  await db.delete(learningRatings).where(eq(learningRatings.courseId, id));
  await db.delete(learningCourses).where(eq(learningCourses.id, id));
}

export async function createLearningVideo(data: { courseId: number; title: string; videoUrl: string; coverImageUrl?: string | null; description?: string | null; durationMinutes: number; sortOrder: number; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [video] = await db.insert(learningVideos).values(data).returning();
  return video;
}

export async function deleteLearningVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(learningVideos).where(eq(learningVideos.id, id));
}

export async function rateLearningCourse(courseId: number, userId: number, rating: number, comment?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(learningRatings).where(and(eq(learningRatings.courseId, courseId), eq(learningRatings.userId, userId))).limit(1);
  if (existing.length) await db.update(learningRatings).set({ rating, comment: comment ?? null }).where(eq(learningRatings.id, existing[0].id));
  else await db.insert(learningRatings).values({ courseId, userId, rating, comment: comment ?? null });
}

// ── AI PDF Files ────────────────────────────────────────────────────

export async function getAiPdfFiles() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiPdfFiles).orderBy(desc(aiPdfFiles.createdAt));
}

export async function createAiPdfFile(data: InsertAiPdfFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ id }] = await db.insert(aiPdfFiles).values(data).returning({ id: aiPdfFiles.id });
  return { ...data, id } as InsertAiPdfFile & { id: number };
}

export async function deleteAiPdfFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(aiPdfFiles).where(eq(aiPdfFiles.id, id));
}

// ── Basir daily usage quota ─────────────────────────────────────────

const BASIR_MEMBER_DAILY_LIMIT = 30;
const BASIR_ADMIN_DAILY_LIMIT = 60; // "حصتان" — double the base member quota

export function getBasirDailyLimit(role?: string) {
  return isAdminTierRole(role) ? BASIR_ADMIN_DAILY_LIMIT : BASIR_MEMBER_DAILY_LIMIT;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function getBasirUsageToday(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const today = todayDateString();
  const rows = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.usageDate, today)))
    .limit(1);
  return rows[0]?.count ?? 0;
}

/**
 * Atomically-enough increments today's usage counter for a user and
 * returns the new count. Throws if the user has already hit their daily
 * limit (checked by the caller before invoking this) — this function just
 * persists the increment.
 */
export async function incrementBasirUsage(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const today = todayDateString();

  const existing = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.usageDate, today)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(aiUsage).values({ userId, usageDate: today, count: 1 });
    return 1;
  }

  const newCount = existing[0].count + 1;
  await db.update(aiUsage).set({ count: newCount }).where(eq(aiUsage.id, existing[0].id));
  return newCount;
}

/**
 * Per-member breakdown of Basir usage for the admin dashboard: today's
 * count (against that member's daily quota) plus an all-time total, for
 * every user who has sent at least one prompt to Basir. Members who have
 * never used Basir are omitted (there would be nothing meaningful to show).
 */
export async function getBasirUsageStats() {
  const db = await getDb();
  if (!db) return [];
  const today = todayDateString();

  const totals = await db
    .select({
      userId: aiUsage.userId,
      total: sql<number>`sum(${aiUsage.count})`.mapWith(Number),
      todayCount: sql<number>`sum(case when ${aiUsage.usageDate} = ${today} then ${aiUsage.count} else 0 end)`.mapWith(Number),
      lastUsedAt: sql<string>`max(${aiUsage.updatedAt})`,
    })
    .from(aiUsage)
    .groupBy(aiUsage.userId);

  if (totals.length === 0) return [];

  const userIds = totals.map((t) => t.userId);
  const userRows = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  return totals
    .map((t) => {
      const u = userById.get(t.userId);
      const limit = getBasirDailyLimit(u?.role);
      return {
        userId: t.userId,
        name: u?.name ?? "مستخدم محذوف",
        email: u?.email ?? null,
        role: u?.role ?? "user",
        referenceNumber: u?.referenceNumber ?? null,
        todayUsed: t.todayCount,
        dailyLimit: limit,
        totalUsed: t.total,
        lastUsedAt: t.lastUsedAt,
      };
    })
    .sort((a, b) => b.todayUsed - a.todayUsed || b.totalUsed - a.totalUsed);
}

// ─── Guest Activity Registrations ────────────────────────────────────────────

export async function createGuestActivityRegistration(data: InsertGuestActivityRegistration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ id }] = await db.insert(guestActivityRegistrations).values(data).returning({ id: guestActivityRegistrations.id });
  return { ...data, id };
}

export async function getGuestRegistrationsByActivity(activityId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(guestActivityRegistrations)
    .where(eq(guestActivityRegistrations.activityId, activityId))
    .orderBy(desc(guestActivityRegistrations.registeredAt));
}

/** حذف تسجيل ضيف من نشاط محدد؛ لا يؤثر في أي عضوية أو حساب آخر. */
export async function deleteGuestActivityRegistrationById(activityId: number, registrationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(guestActivityRegistrations)
    .where(
      and(
        eq(guestActivityRegistrations.id, registrationId),
        eq(guestActivityRegistrations.activityId, activityId)
      )
    )
    .returning({ id: guestActivityRegistrations.id, fullName: guestActivityRegistrations.fullName });
}

export async function getActivitySubscribersWithUsers(activityId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: activitySubscriptions.id,
      subscribedAt: activitySubscriptions.subscribedAt,
      status: activitySubscriptions.status,
      userId: users.id,
      name: users.name,
      email: users.email,
      arabicFullName: users.arabicFullName,
      phoneNumber: users.phoneNumber,
      college: users.college,
    })
    .from(activitySubscriptions)
    .innerJoin(users, eq(activitySubscriptions.userId, users.id))
    .where(eq(activitySubscriptions.activityId, activityId))
    .orderBy(desc(activitySubscriptions.subscribedAt));
}

// ─── Registration Settings ────────────────────────────────────────────────────

export async function getRegistrationSettings() {
  const db = await getDb();
  if (!db) return { id: 1, registrationEnabled: true, updatedAt: new Date() };
  const rows = await db.select().from(registrationSettings).limit(1);
  if (rows.length === 0) {
    await db.insert(registrationSettings).values({ registrationEnabled: true });
    return { id: 1, registrationEnabled: true, updatedAt: new Date() };
  }
  return rows[0];
}

export async function updateRegistrationEnabled(enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(registrationSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(registrationSettings).values({ registrationEnabled: enabled });
  } else {
    await db.update(registrationSettings).set({ registrationEnabled: enabled }).where(eq(registrationSettings.id, existing[0].id));
  }
  return { registrationEnabled: enabled };
}


// ─── User management (admin) ──────────────────────────────────────────────────

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Same invariant as updateUserRole: the owner account and anyone in
  // PROTECTED_ADMIN_EMAILS can never be removed, not just "demoted". This
  // was previously only enforced against role changes — deletion had no
  // guard at all, so an administrator could permanently delete the
  // protected owner's account and sidestep the role protection entirely.
  // Enforced here at the DB layer so every caller (routers, scripts,
  // future UIs) honors the invariant, not just the current router check.
  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = existing[0];
  if (target) {
    const isProtected =
      target.openId === ENV.ownerOpenId || isProtectedAdminEmail(target.email ?? null);
    if (isProtected) {
      throw new Error("لا يمكن حذف حساب المشرف الدائم لهذا الحساب");
    }
  }

  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}

export async function updateUserProfile(id: number, data: {
  arabicFullName?: string;
  universityId?: string;
  college?: string;
  specialization?: string;
  academicYear?: string;
  phoneNumber?: string;
  whatsapp?: string;
  culturalExperience?: string;
  role?: MemberRole;
}, actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.role !== undefined) {
    // Route role changes through the same validation as `updateUserRole`
    // (protected-admin guard + general-agent min/max + self-demotion block)
    // so this endpoint can't be used as a back door around those rules.
    await updateUserRole(id, data.role, actorId);
    const { role, ...rest } = data;
    if (Object.keys(rest).length > 0) {
      await db.update(users).set(rest as any).where(eq(users.id, id));
    }
    return { success: true };
  }

  await db.update(users).set(data as any).where(eq(users.id, id));
  return { success: true };
}

// ─── Activity subscription approval ──────────────────────────────────────────

export async function approveActivitySubscription(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db.update(activitySubscriptions)
    .set({ status: "approved" } as any)
    .where(eq(activitySubscriptions.id, subscriptionId))
    .returning({ id: activitySubscriptions.id, userId: activitySubscriptions.userId, activityId: activitySubscriptions.activityId });
  return { success: true, subscription: updated ?? null };
}

export async function rejectActivitySubscription(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(activitySubscriptions)
    .set({ status: "rejected" } as any)
    .where(eq(activitySubscriptions.id, subscriptionId));
  return { success: true };
}

export async function approveGuestRegistration(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(guestActivityRegistrations)
    .set({ status: "approved" } as any)
    .where(eq(guestActivityRegistrations.id, id))
    .returning();
  return { success: true, registration: row };
}

export async function rejectGuestRegistration(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(guestActivityRegistrations)
    .set({ status: "rejected" } as any)
    .where(eq(guestActivityRegistrations.id, id));
  return { success: true };
}

// ─── Activity pin ─────────────────────────────────────────────────────────────

export async function toggleActivityPin(id: number, isPinned: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(activities).set({ isPinned } as any).where(eq(activities.id, id));
  return { success: true };
}

export async function toggleArticlePin(id: number, isPinned: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(articles).set({ isPinned } as any).where(eq(articles.id, id));
  return { success: true };
}

export async function toggleAchievementPin(id: number, isPinned: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(achievements).set({ isPinned } as any).where(eq(achievements.id, id));
  return { success: true };
}

export async function toggleBookPin(id: number, isPinned: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(books).set({ isPinned } as any).where(eq(books.id, id));
  return { success: true };
}

// ─── Books: "الكتب المختومة" (books the club has read) ─────────────────────

export function getBooks(): Promise<Book[]>;
export function getBooks(options: PublicContentPageOptions): Promise<PublicContentPage<Book>>;
export async function getBooks(options?: PublicContentPageOptions): Promise<Book[] | PublicContentPage<Book>> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get books: database not available");
    return options ? { items: [], nextCursor: null } : [];
  }
  // Keep the existing curated ordering for older callers, while the new page
  // endpoint uses a stable indexed keyset order for incremental loading.
  if (!options) return await db.select().from(books).orderBy(desc(books.isPinned), books.order, desc(books.completedAt));

  const cursor = decodePublicContentCursor(options.cursor);
  const cursorFilter = cursor ? or(
    lt(books.isPinned, cursor.pinned),
    and(
      eq(books.isPinned, cursor.pinned),
      or(
        lt(books.createdAt, new Date(cursor.createdAt)),
        and(eq(books.createdAt, new Date(cursor.createdAt)), lt(books.id, cursor.id)),
      ),
    ),
  ) : undefined;
  const rows = await db.select().from(books).where(cursorFilter).orderBy(desc(books.isPinned), desc(books.createdAt), desc(books.id)).limit(pageLimit(options.limit) + 1);
  const hasMore = rows.length > pageLimit(options.limit);
  const items = hasMore ? rows.slice(0, -1) : rows;
  return { items, nextCursor: hasMore ? encodePublicContentCursor(items[items.length - 1]) : null };
}

export async function getBookById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createBook(data: InsertBook) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(books).values(data).returning();
  return row;
}

export async function updateBook(id: number, data: Partial<InsertBook>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(books).set(data).where(eq(books.id, id));
}

export async function deleteBook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(books).where(eq(books.id, id));
}

// ─── Book suggestions ("اقتراحات الأعضاء") ──────────────────────────────────

export async function getActiveSuggestionRound() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookSuggestionRounds)
    .where(eq(bookSuggestionRounds.status, "open"))
    .orderBy(desc(bookSuggestionRounds.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function openSuggestionRound() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only one round may be open at a time.
  const existing = await getActiveSuggestionRound();
  if (existing) return existing;
  const [row] = await db.insert(bookSuggestionRounds).values({ status: "open" }).returning();
  return row;
}

export async function closeSuggestionRound(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const scheduledDeleteAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  await db
    .update(bookSuggestionRounds)
    .set({ status: "closed", closedAt: new Date(), scheduledDeleteAt })
    .where(eq(bookSuggestionRounds.id, id));
  return { success: true, scheduledDeleteAt };
}

export async function getSuggestionsForRound(roundId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(bookSuggestions)
    .where(eq(bookSuggestions.roundId, roundId))
    .orderBy(desc(bookSuggestions.createdAt));
}

export async function getMySuggestionInRound(roundId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookSuggestions)
    .where(and(eq(bookSuggestions.roundId, roundId), eq(bookSuggestions.suggestedBy, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSuggestion(data: InsertBookSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(bookSuggestions).values(data).returning();
  return row;
}

export async function deleteSuggestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(bookSuggestions).where(eq(bookSuggestions.id, id));
}

// ─── Curated book vote polls ("التصويت على الكتب") ──────────────────────────

export async function getActivePoll() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookVotePolls)
    .where(eq(bookVotePolls.status, "open"))
    .orderBy(desc(bookVotePolls.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPollById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(bookVotePolls).where(eq(bookVotePolls.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPoll(data: InsertBookVotePoll) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(bookVotePolls).values(data).returning();
  return row;
}

export async function closePoll(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const scheduledDeleteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db
    .update(bookVotePolls)
    .set({ status: "closed", closedAt: new Date(), scheduledDeleteAt })
    .where(eq(bookVotePolls.id, id));
  return { success: true, scheduledDeleteAt };
}

export async function addPollOption(data: InsertBookVotePollOption) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(bookVotePollOptions).values(data).returning();
  return row;
}

export async function updatePollOption(id: number, data: Partial<InsertBookVotePollOption>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(bookVotePollOptions).set(data).where(eq(bookVotePollOptions.id, id));
}

export async function deletePollOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(bookVotePollOptions).where(eq(bookVotePollOptions.id, id));
}

export async function getPollOptionsWithCounts(pollId: number) {
  const db = await getDb();
  if (!db) return [];
  const options = await db
    .select()
    .from(bookVotePollOptions)
    .where(eq(bookVotePollOptions.pollId, pollId))
    .orderBy(bookVotePollOptions.order, bookVotePollOptions.id);

  const counts = await db
    .select({ optionId: bookVoteBallots.optionId, voteCount: count(bookVoteBallots.id) })
    .from(bookVoteBallots)
    .where(eq(bookVoteBallots.pollId, pollId))
    .groupBy(bookVoteBallots.optionId);

  const countMap = new Map(counts.map((c) => [c.optionId, Number(c.voteCount)]));
  return options.map((o) => ({ ...o, voteCount: countMap.get(o.id) ?? 0 }));
}

export async function getMyBallots(pollId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(bookVoteBallots)
    .where(and(eq(bookVoteBallots.pollId, pollId), eq(bookVoteBallots.userId, userId)));
}

export async function castVote(pollId: number, optionId: number, userId: number, mode: "single" | "multiple") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (mode === "single") {
    // Replace any existing vote by this user in this poll.
    await db.delete(bookVoteBallots).where(and(eq(bookVoteBallots.pollId, pollId), eq(bookVoteBallots.userId, userId)));
    await db.insert(bookVoteBallots).values({ pollId, optionId, userId });
    return { success: true };
  }

  // Multiple mode: toggle this specific option for this user.
  const existing = await db
    .select()
    .from(bookVoteBallots)
    .where(and(eq(bookVoteBallots.pollId, pollId), eq(bookVoteBallots.optionId, optionId), eq(bookVoteBallots.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(bookVoteBallots).where(eq(bookVoteBallots.id, existing[0].id));
    return { success: true, removed: true };
  }
  await db.insert(bookVoteBallots).values({ pollId, optionId, userId });
  return { success: true, removed: false };
}

// ─── Scheduled cleanup (called by the daily cron job) ───────────────────────

// ─── Daily email quota (used to prioritize email types under Brevo's cap) ──

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export async function getTodayEmailCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(emailDailyQuota).where(eq(emailDailyQuota.date, todayDateKey())).limit(1);
  return rows[0]?.count ?? 0;
}

/** Atomically records that `n` more emails were just sent today, returning
 * the new running total for the day. */
export async function incrementEmailCount(n = 1): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const dateKey = todayDateKey();
  const [row] = await db
    .insert(emailDailyQuota)
    .values({ date: dateKey, count: n })
    .onConflictDoUpdate({
      target: emailDailyQuota.date,
      set: { count: sql`${emailDailyQuota.count} + ${n}` },
    })
    .returning();
  return row.count;
}

export async function runScheduledBookCleanup() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  const expiredRounds = await db
    .select({ id: bookSuggestionRounds.id })
    .from(bookSuggestionRounds)
    .where(and(eq(bookSuggestionRounds.status, "closed"), lte(bookSuggestionRounds.scheduledDeleteAt, now)));
  for (const r of expiredRounds) {
    await db.delete(bookSuggestions).where(eq(bookSuggestions.roundId, r.id));
    await db.delete(bookSuggestionRounds).where(eq(bookSuggestionRounds.id, r.id));
  }

  const expiredPolls = await db
    .select({ id: bookVotePolls.id })
    .from(bookVotePolls)
    .where(and(eq(bookVotePolls.status, "closed"), lte(bookVotePolls.scheduledDeleteAt, now)));
  for (const p of expiredPolls) {
    await db.delete(bookVoteBallots).where(eq(bookVoteBallots.pollId, p.id));
    await db.delete(bookVotePollOptions).where(eq(bookVotePollOptions.pollId, p.id));
    await db.delete(bookVotePolls).where(eq(bookVotePolls.id, p.id));
  }

  return { deletedRounds: expiredRounds.length, deletedPolls: expiredPolls.length };
}

// ─── Profile edit requests (self-service edits pending admin approval) ──────

/**
 * Whitelist of user columns a member is allowed to propose changes to via
 * `profileEditRequests`. Keeps `role`, `referenceNumber`, `approvalStatus`
 * and other admin/system-owned columns completely out of reach even if a
 * caller tried to slip them into the `changes` payload.
 */
export const PROFILE_EDITABLE_FIELDS = [
  "name",
  "arabicFullName",
  "email",
  "dateOfBirth",
  "phoneNumber",
  "whatsapp",
  "college",
  "department",
  "specialization",
  "academicYear",
  "universityId",
  "culturalExperience",
] as const;

export type ProfileEditableField = (typeof PROFILE_EDITABLE_FIELDS)[number];

export async function getProfileEditRequests(status?: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile edit requests: database not available");
    return [];
  }

  const base = db
    .select({
      id: profileEditRequests.id,
      userId: profileEditRequests.userId,
      changes: profileEditRequests.changes,
      status: profileEditRequests.status,
      reviewedBy: profileEditRequests.reviewedBy,
      reviewedAt: profileEditRequests.reviewedAt,
      rejectionReason: profileEditRequests.rejectionReason,
      createdAt: profileEditRequests.createdAt,
      applicantName: users.name,
      applicantArabicFullName: users.arabicFullName,
      applicantEmail: users.email,
      applicantReferenceNumber: users.referenceNumber,
    })
    .from(profileEditRequests)
    .innerJoin(users, eq(profileEditRequests.userId, users.id));

  if (status) {
    return await base.where(eq(profileEditRequests.status, status as any)).orderBy(desc(profileEditRequests.createdAt));
  }

  return await base.orderBy(desc(profileEditRequests.createdAt));
}

export async function getProfileEditRequestsByUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile edit requests: database not available");
    return [];
  }

  return await db
    .select()
    .from(profileEditRequests)
    .where(eq(profileEditRequests.userId, userId))
    .orderBy(desc(profileEditRequests.createdAt));
}

/** The single pending request for a user, if any — a member can only have
 * one outstanding edit request at a time so the UI has one clear state to
 * show ("قيد المراجعة") instead of stacking several. */
export async function getPendingProfileEditRequestForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile edit request: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(profileEditRequests)
    .where(and(eq(profileEditRequests.userId, userId), eq(profileEditRequests.status, "pending")))
    .orderBy(desc(profileEditRequests.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/** Most recent request for a user regardless of status — used so a member
 * can still see a rejection reason after the fact, not just while pending. */
export async function getLatestProfileEditRequestForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile edit request: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(profileEditRequests)
    .where(eq(profileEditRequests.userId, userId))
    .orderBy(desc(profileEditRequests.createdAt))
    .limit(1);

  return result[0] ?? null;
}

export async function getProfileEditRequestById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile edit request: database not available");
    return null;
  }

  const result = await db.select().from(profileEditRequests).where(eq(profileEditRequests.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createProfileEditRequest(data: InsertProfileEditRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db.insert(profileEditRequests).values(data).returning();
  return row;
}

/** Approve a pending request: copies the whitelisted `changes` onto the
 * user's row, then marks the request approved. */
export async function approveProfileEditRequest(id: number, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const request = await getProfileEditRequestById(id);
  if (!request) throw new Error("Profile edit request not found");
  if (request.status !== "pending") throw new Error("Profile edit request already reviewed");

  let changes: Record<string, unknown>;
  try {
    changes = JSON.parse(request.changes);
  } catch {
    changes = {};
  }

  const safeChanges: Record<string, unknown> = {};
  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      safeChanges[field] = changes[field];
    }
  }

  if (Object.keys(safeChanges).length > 0) {
    await db.update(users).set(safeChanges as any).where(eq(users.id, request.userId));
  }

  await db
    .update(profileEditRequests)
    .set({ status: "approved", reviewedBy, reviewedAt: new Date() })
    .where(eq(profileEditRequests.id, id));

  return { success: true, userId: request.userId };
}

export async function rejectProfileEditRequest(id: number, rejectionReason: string, reviewedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const request = await getProfileEditRequestById(id);
  if (!request) throw new Error("Profile edit request not found");
  if (request.status !== "pending") throw new Error("Profile edit request already reviewed");

  await db
    .update(profileEditRequests)
    .set({ status: "rejected", rejectionReason, reviewedBy, reviewedAt: new Date() })
    .where(eq(profileEditRequests.id, id));

  return { success: true, userId: request.userId };
}

// ─────────────────────────────────────────────────────────────────────────
// "سجلات العمل" (Work Logs) — audit trail visible only from the Technical
// Manager ("المدير التقني") dashboard. See the `workLogs` table comment in
// drizzle/schema.ts for the elevated/member scope distinction.
// ─────────────────────────────────────────────────────────────────────────

export interface LogActionParams {
  scope: "elevated" | "member";
  actorId?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  description: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records one row in `workLogs`. Never throws — logging is best-effort and
 * must never break the mutation that triggered it (same philosophy as
 * `sendEmail`/`notifyOwner` elsewhere in this codebase).
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(workLogs).values({
      scope: params.scope,
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      actorRole: params.actorRole ?? null,
      action: params.action,
      description: params.description,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error("[WorkLogs] Failed to record log entry:", error);
  }
}

export interface GetWorkLogsFilters {
  scope?: "elevated" | "member";
  actorId?: number;
  /** Filter to a single action, e.g. "basir.chat" — used for the dedicated
   * "سجل بصير" view in the Technical Manager dashboard. */
  action?: string;
  limit?: number;
}

/** Paginated (by simple limit) list of work logs, most recent first. Reads
 * are restricted to the technical manager at the router layer — this
 * function itself performs no permission checks. */
export async function getWorkLogs(filters: GetWorkLogsFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.scope) conditions.push(eq(workLogs.scope, filters.scope));
  if (filters.actorId) conditions.push(eq(workLogs.actorId, filters.actorId));
  if (filters.action) conditions.push(eq(workLogs.action, filters.action));

  const limit = Math.min(filters.limit ?? 200, 1000);

  const query = db.select().from(workLogs).orderBy(desc(workLogs.createdAt)).limit(limit);
  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }
  return await query;
}

/**
 * "حذف" a work log entry — but not really. Per policy, only the Technical
 * Manager may request deletion (enforced at the router layer via
 * `techAdminProcedure`), and even then the row is only *scheduled* for
 * deletion 48h from now, not removed immediately. The actual removal
 * happens later via `runScheduledWorkLogsCleanup`.
 */
export async function scheduleWorkLogDeletion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const scheduledDeleteAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [row] = await db
    .update(workLogs)
    .set({ scheduledDeleteAt })
    .where(eq(workLogs.id, id))
    .returning();
  return row ?? null;
}

/** Batch version of scheduleWorkLogDeletion — schedules many rows for deletion in one query. */
export async function scheduleWorkLogDeletionMany(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return [];
  const scheduledDeleteAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return await db
    .update(workLogs)
    .set({ scheduledDeleteAt })
    .where(inArray(workLogs.id, ids))
    .returning();
}

/** Cancels a pending scheduled deletion (undo), before the 48h grace period elapses. */
export async function cancelWorkLogDeletion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .update(workLogs)
    .set({ scheduledDeleteAt: null })
    .where(eq(workLogs.id, id))
    .returning();
  return row ?? null;
}

/** Batch version of cancelWorkLogDeletion — undoes scheduled deletion for many rows in one query. */
export async function cancelWorkLogDeletionMany(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return [];
  return await db
    .update(workLogs)
    .set({ scheduledDeleteAt: null })
    .where(inArray(workLogs.id, ids))
    .returning();
}

/**
 * Daily cron cleanup (see /api/cron/worklogs-cleanup): permanently removes
 * work log rows whose 48h scheduled-deletion grace period has passed.
 */
export async function runScheduledWorkLogsCleanup() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const expired = await db
    .select({ id: workLogs.id })
    .from(workLogs)
    .where(and(isNotNull(workLogs.scheduledDeleteAt), lte(workLogs.scheduledDeleteAt, now)));
  for (const row of expired) {
    await db.delete(workLogs).where(eq(workLogs.id, row.id));
  }
  return { deletedCount: expired.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Treasury — a separate, append-audited workspace. Values use integer cents
// to retain exact totals and avoid floating-point rounding in reports.
// ─────────────────────────────────────────────────────────────────────────

export type FinancialTransactionStatus = "draft" | "pending_approval" | "approved" | "returned" | "void";
export type FinancialTransactionType = "income" | "expense";

export async function listFinancialBudgetCategories(fiscalYear: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialBudgetCategories)
    .where(eq(financialBudgetCategories.fiscalYear, fiscalYear))
    .orderBy(financialBudgetCategories.title);
}

export async function createFinancialBudgetCategory(input: Omit<InsertFinancialBudgetCategory, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(financialBudgetCategories).values(input).returning();
  return row;
}

export async function updateFinancialBudgetCategory(id: number, input: Pick<InsertFinancialBudgetCategory, "title" | "allocatedAmountCents" | "notes" | "currency">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(financialBudgetCategories).set(input).where(eq(financialBudgetCategories.id, id)).returning();
  return row ?? null;
}

export async function createFinancialTransaction(input: Omit<InsertFinancialTransaction, "id" | "status" | "submittedAt" | "reviewedBy" | "reviewedAt" | "reviewNote" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(financialTransactions).values({ ...input, status: "draft" }).returning();
  return row;
}

export async function updateFinancialTransactionDraft(
  id: number,
  actorId: number,
  input: Pick<InsertFinancialTransaction, "categoryId" | "type" | "title" | "description" | "amountCents" | "currency" | "transactionDate">,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(financialTransactions).set(input)
    .where(and(eq(financialTransactions.id, id), eq(financialTransactions.createdBy, actorId), inArray(financialTransactions.status, ["draft", "returned"])))
    .returning();
  return row ?? null;
}

export async function submitFinancialTransaction(id: number, actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(financialTransactions).set({
    status: "pending_approval",
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  }).where(and(eq(financialTransactions.id, id), eq(financialTransactions.createdBy, actorId), inArray(financialTransactions.status, ["draft", "returned"]))).returning();
  return row ?? null;
}

export async function reviewFinancialTransaction(id: number, reviewerId: number, decision: "approved" | "returned" | "void", reviewNote: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.update(financialTransactions).set({
    status: decision,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewNote,
  }).where(and(eq(financialTransactions.id, id), eq(financialTransactions.status, "pending_approval"))).returning();
  return row ?? null;
}

export async function addFinancialReceipt(input: { transactionId: number; fileUrl: string; fileKey: string; fileName: string; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(financialReceipts).values(input).returning();
  return row;
}

export async function getFinancialTransactionOwner(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ id: financialTransactions.id, createdBy: financialTransactions.createdBy, status: financialTransactions.status })
    .from(financialTransactions).where(eq(financialTransactions.id, id)).limit(1);
  return row ?? null;
}

export async function writeFinancialAuditLog(input: { transactionId?: number | null; actorId: number; action: string; summary: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(financialAuditLogs).values({
    transactionId: input.transactionId ?? null,
    actorId: input.actorId,
    action: input.action,
    summary: input.summary,
  });
}

export async function listFinancialAuditLogs(transactionId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    id: financialAuditLogs.id,
    transactionId: financialAuditLogs.transactionId,
    action: financialAuditLogs.action,
    summary: financialAuditLogs.summary,
    createdAt: financialAuditLogs.createdAt,
    actorName: users.name,
  }).from(financialAuditLogs).leftJoin(users, eq(financialAuditLogs.actorId, users.id)).orderBy(desc(financialAuditLogs.createdAt)).limit(200);
  return transactionId ? query.where(eq(financialAuditLogs.transactionId, transactionId)) : query;
}

export async function listFinancialTransactions(filters: { fiscalYear?: number; status?: FinancialTransactionStatus } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(financialTransactions.status, filters.status));
  if (filters.fiscalYear) conditions.push(sql`EXTRACT(YEAR FROM ${financialTransactions.transactionDate}) = ${filters.fiscalYear}`);
  const query = db.select({
    id: financialTransactions.id,
    categoryId: financialTransactions.categoryId,
    categoryTitle: financialBudgetCategories.title,
    type: financialTransactions.type,
    status: financialTransactions.status,
    title: financialTransactions.title,
    description: financialTransactions.description,
    amountCents: financialTransactions.amountCents,
    currency: financialTransactions.currency,
    transactionDate: financialTransactions.transactionDate,
    createdBy: financialTransactions.createdBy,
    submittedAt: financialTransactions.submittedAt,
    reviewedBy: financialTransactions.reviewedBy,
    reviewedAt: financialTransactions.reviewedAt,
    reviewNote: financialTransactions.reviewNote,
    createdAt: financialTransactions.createdAt,
    creatorName: users.name,
  }).from(financialTransactions)
    .leftJoin(financialBudgetCategories, eq(financialTransactions.categoryId, financialBudgetCategories.id))
    .leftJoin(users, eq(financialTransactions.createdBy, users.id))
    .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id)).limit(300);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  if (!rows.length) return [];
  const receipts = await db.select().from(financialReceipts).where(inArray(financialReceipts.transactionId, rows.map((row) => row.id)));
  return rows.map((row) => ({ ...row, receipts: receipts.filter((receipt) => receipt.transactionId === row.id) }));
}

export async function getTreasurySummary(fiscalYear: number, includeTransactions = true) {
  const [categories, transactions] = await Promise.all([
    listFinancialBudgetCategories(fiscalYear),
    listFinancialTransactions({ fiscalYear }),
  ]);
  const approved = transactions.filter((transaction) => transaction.status === "approved");
  const incomeCents = approved.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const expenseCents = approved.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const allocatedCents = categories.reduce((sum, category) => sum + category.allocatedAmountCents, 0);
  const approvedExpenseByCategory = approved
    .filter((transaction) => transaction.type === "expense" && transaction.categoryId)
    .reduce<Record<number, number>>((totals, transaction) => {
      const categoryId = transaction.categoryId as number;
      totals[categoryId] = (totals[categoryId] ?? 0) + transaction.amountCents;
      return totals;
    }, {});
  return {
    categories,
    transactions: includeTransactions ? transactions : [],
    approvedExpenseByCategory,
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    allocatedCents,
    pendingCount: transactions.filter((transaction) => transaction.status === "pending_approval").length,
  };
}
