ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "senderId" integer;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "links" text;

CREATE TABLE IF NOT EXISTS "notificationAttachments" (
  "id" serial PRIMARY KEY,
  "notificationId" integer NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "fileUrl" varchar(500) NOT NULL,
  "fileKey" varchar(255),
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notificationAttachments_notificationId_idx"
  ON "notificationAttachments" ("notificationId");
