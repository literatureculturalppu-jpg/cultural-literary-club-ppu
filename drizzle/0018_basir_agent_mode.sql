-- Persistent per-user Basir agent data. The server enforces ownership and
-- RLS prevents any direct client access across user boundaries.

CREATE TYPE "public"."basir_task_status" AS ENUM('draft', 'awaiting_approval', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "public"."basir_automation_cadence" AS ENUM('daily', 'weekly');

CREATE TABLE "basirTasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "title" varchar(500) NOT NULL,
  "status" "basir_task_status" DEFAULT 'draft' NOT NULL,
  "requiresApproval" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "basir_tasks_user_idx" ON "basirTasks" USING btree ("userId", "createdAt");

CREATE TABLE "basirMemories" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "text" varchar(500) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "basir_memories_user_idx" ON "basirMemories" USING btree ("userId");

CREATE TABLE "basirAutomations" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "cadence" "basir_automation_cadence" DEFAULT 'daily' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "lastRunAt" timestamp,
  "nextRunAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "basir_automations_due_idx" ON "basirAutomations" USING btree ("enabled", "nextRunAt");

ALTER TABLE "basirTasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "basirMemories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "basirAutomations" ENABLE ROW LEVEL SECURITY;
