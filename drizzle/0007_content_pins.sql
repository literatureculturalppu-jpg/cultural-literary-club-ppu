ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "isPinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "isPinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "isPinned" boolean DEFAULT false NOT NULL;
