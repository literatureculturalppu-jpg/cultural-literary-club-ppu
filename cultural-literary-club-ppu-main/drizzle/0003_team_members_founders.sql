-- teamMembers: تمييز الهيئة الإدارية المؤسسة عن خلفائها لاحقاً
--
-- Same note as 0001_meetings.sql / 0002_worklogs_and_guest_meetings.sql:
-- this repo's `drizzle/` migration history is already out of sync with
-- `drizzle/schema.ts`, so this file is hand-written and scoped ONLY to
-- what's new here. Apply with
-- `psql "$DATABASE_URL" -f drizzle/0003_team_members_founders.sql`,
-- via the Supabase SQL editor, or `pnpm db:push`.

-- Adds a flag marking the original founding board members (first
-- president, first vice president, first tech admin, etc.) so that
-- whoever succeeds them later can be added as a normal (non-founder)
-- row without any special handling.
ALTER TABLE "teamMembers" ADD COLUMN IF NOT EXISTS "isFounder" boolean DEFAULT false NOT NULL;
