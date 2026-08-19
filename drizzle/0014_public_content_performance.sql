CREATE INDEX IF NOT EXISTS "activities_isPinned_createdAt_idx" ON "activities" ("isPinned", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_status_createdAt_idx" ON "activities" ("status", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_published_createdAt_idx" ON "articles" ("published", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_isPinned_createdAt_idx" ON "articles" ("isPinned", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_isPinned_createdAt_idx" ON "achievements" ("isPinned", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_featured_createdAt_idx" ON "achievements" ("featured", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_isPinned_createdAt_idx" ON "books" ("isPinned", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_createdAt_idx" ON "books" ("createdAt" DESC);
