-- Mobile application integration. This migration is deliberately additive so
-- it can be run against the existing production database without changing
-- website behavior. Apply via the Supabase SQL editor or the project migration
-- workflow before enabling the new mobile endpoints in production.

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'book';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'announcement';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mobileDevices" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "expoPushToken" varchar(255) NOT NULL UNIQUE,
  "platform" varchar(24) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mobileDevices_userId_idx" ON "mobileDevices" ("userId");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mobileAuthCodes" (
  "id" serial PRIMARY KEY NOT NULL,
  "codeHash" varchar(128) NOT NULL UNIQUE,
  "userId" integer NOT NULL,
  "redirectUri" varchar(500) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mobileAuthCodes_expiresAt_idx" ON "mobileAuthCodes" ("expiresAt");
