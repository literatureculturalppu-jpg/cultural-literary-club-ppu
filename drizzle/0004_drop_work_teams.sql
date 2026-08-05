-- إزالة ميزة "فرق العمل" المستقلة عن صفحة "عن النادي" بعد دمجها في
-- الهيئة الإدارية (جدول teamMembers الموجود أصلاً).
--
-- Same note as previous hand-written migrations: this repo's `drizzle/`
-- migration history is already out of sync with `drizzle/schema.ts`, so
-- this file is hand-written and scoped ONLY to what's changed here. Apply
-- with `psql "$DATABASE_URL" -f drizzle/0004_drop_work_teams.sql`, via the
-- Supabase SQL editor, or `pnpm db:push`.
--
-- IMPORTANT: if there is existing data in "workTeamMembers" that you still
-- want to keep, migrate it into "teamMembers" BEFORE running this file,
-- e.g.:
--   INSERT INTO "teamMembers" (name, position, bio, "imageUrl", "imageKey", "order")
--   SELECT name, position, bio, "imageUrl", "imageKey", "order" FROM "workTeamMembers";

DROP TABLE IF EXISTS "workTeamMembers";
--> statement-breakpoint
DROP TABLE IF EXISTS "workTeams";
