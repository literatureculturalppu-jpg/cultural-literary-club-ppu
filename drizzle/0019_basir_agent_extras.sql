-- Basir second batch: activity-linked tasks, private reminders, opt-in
-- history and administrator-only PDF summaries.
ALTER TABLE "basirTasks" ADD COLUMN "linkedActivityId" integer;

CREATE TABLE "basirReminders" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "activityId" integer,
  "title" varchar(255) NOT NULL,
  "remindAt" timestamp NOT NULL,
  "delivered" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "basir_reminders_due_idx" ON "basirReminders" USING btree ("delivered", "remindAt");
ALTER TABLE "basirReminders" ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."basir_chat_role" AS ENUM('user', 'assistant');
CREATE TABLE "basirChatMessages" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "role" "basir_chat_role" NOT NULL,
  "content" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "basir_chat_messages_user_idx" ON "basirChatMessages" USING btree ("userId", "createdAt");
ALTER TABLE "basirChatMessages" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "basirUserPrefs" (
  "userId" integer PRIMARY KEY NOT NULL,
  "chatHistoryEnabled" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "basirUserPrefs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "aiPdfFiles" ADD COLUMN "summary" text;
