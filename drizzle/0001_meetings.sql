-- نظام الاجتماعات الإلكتروني (electronic meetings system)
--
-- NOTE ON THIS FILE: this migration is hand-written and scoped ONLY to the
-- new meetings feature. It does NOT go through `drizzle-kit generate`,
-- because this repo's `drizzle/` migration history is already out of sync
-- with `drizzle/schema.ts` — 17 tables that exist in schema.ts (books,
-- workLogs, teamActionRequests, teamInviteLinks, profileEditRequests, the
-- aiUsage/aiPdfFiles group, etc.) are not present in 0000_bouncy_stardust.sql,
-- which means they were pushed to the live database directly via
-- `drizzle-kit push` at some point rather than via a committed migration
-- file. Running `drizzle-kit generate` naively right now produces a diff
-- against that stale 0000 baseline and tries to CREATE TABLE everything
-- that's already live — which would fail (or worse, silently no-op) against
-- the real database. That pre-existing drift is unrelated to this feature
-- and is left untouched here; this file only adds what's new.
--
-- Apply with `psql "$DATABASE_URL" -f drizzle/0001_meetings.sql`, via the
-- Supabase SQL editor, or by reconciling it into your normal
-- generate/migrate flow once the drift above is fixed.

CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'live', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_participant_status" AS ENUM('waiting', 'admitted', 'rejected', 'kicked', 'left');--> statement-breakpoint

CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"roomName" varchar(64) NOT NULL,
	"title" varchar(255),
	"createdBy" integer NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"scheduledStartAt" timestamp,
	"startedAt" timestamp,
	"endedAt" timestamp,
	"inviteToken" varchar(64) NOT NULL,
	"inviteRevoked" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"screenShareBlocked" boolean DEFAULT true NOT NULL,
	"micBlocked" boolean DEFAULT false NOT NULL,
	"cameraBlocked" boolean DEFAULT false NOT NULL,
	"chatBlocked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_roomName_unique" UNIQUE("roomName"),
	CONSTRAINT "meetings_inviteToken_unique" UNIQUE("inviteToken")
);
--> statement-breakpoint

CREATE TABLE "meetingParticipants" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"userId" integer NOT NULL,
	"status" "meeting_participant_status" DEFAULT 'waiting' NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"respondedAt" timestamp,
	"respondedBy" integer,
	"leftAt" timestamp
);
--> statement-breakpoint

CREATE TABLE "meetingBans" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bannedBy" integer NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetingBans_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint

CREATE TABLE "meetingOverridePermissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"grantedBy" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetingOverridePermissions_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint

CREATE INDEX "meetingParticipants_meetingId_idx" ON "meetingParticipants" ("meetingId");
--> statement-breakpoint
CREATE INDEX "meetingParticipants_userId_idx" ON "meetingParticipants" ("userId");
--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" ("status");
