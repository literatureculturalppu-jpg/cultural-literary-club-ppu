-- سجلات العمل: الحذف المُجدول (48 ساعة) + طلبات معلومات الانضمام لاجتماع كضيف
--
-- Same note as 0001_meetings.sql: this repo's `drizzle/` migration history
-- is already out of sync with `drizzle/schema.ts` (schema changes are
-- normally applied via `pnpm db:push` / `npx drizzle-kit push`), so this
-- file is hand-written and scoped ONLY to what's new here. Apply with
-- `psql "$DATABASE_URL" -f drizzle/0002_worklogs_and_guest_meetings.sql`,
-- via the Supabase SQL editor, or `pnpm db:push`.

-- 1) Work logs are never deleted immediately by the Technical Manager —
--    deletion is scheduled 48h in the future instead (nullable = not
--    scheduled for deletion). See runScheduledWorkLogsCleanup in server/db.ts
--    and /api/cron/worklogs-cleanup.
ALTER TABLE "workLogs" ADD COLUMN IF NOT EXISTS "scheduledDeleteAt" timestamp;
--> statement-breakpoint

-- 2) Guest (no-account) meeting join info requests — same required fields
--    as guestActivityRegistrations. meetingTitle/meetingDate are snapshotted
--    at submission time since meeting rows are purged by the meetings
--    cleanup cron shortly after the meeting ends.
CREATE TABLE IF NOT EXISTS "meetingGuestJoinRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"meetingTitle" varchar(255),
	"meetingDate" timestamp,
	"fullName" varchar(255) NOT NULL,
	"universityEmail" varchar(320) NOT NULL,
	"universityId" varchar(50) NOT NULL,
	"college" varchar(255),
	"specialization" varchar(255),
	"academicYear" varchar(50),
	"phoneNumber" varchar(30) NOT NULL,
	"whatsapp" varchar(30),
	"requestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "meetingGuestJoinRequests_meetingId_idx" ON "meetingGuestJoinRequests" ("meetingId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetingGuestJoinRequests_meetingDate_idx" ON "meetingGuestJoinRequests" ("meetingDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workLogs_scheduledDeleteAt_idx" ON "workLogs" ("scheduledDeleteAt");
