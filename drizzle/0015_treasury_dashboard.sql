CREATE TYPE "public"."financial_transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "public"."financial_transaction_status" AS ENUM('draft', 'pending_approval', 'approved', 'returned', 'void');

CREATE TABLE "financialBudgetCategories" (
  "id" serial PRIMARY KEY NOT NULL,
  "fiscalYear" integer NOT NULL,
  "title" varchar(140) NOT NULL,
  "allocatedAmountCents" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'ILS' NOT NULL,
  "notes" text,
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "financial_budget_year_title_idx" ON "financialBudgetCategories" USING btree ("fiscalYear", "title");
CREATE INDEX "financial_budget_year_idx" ON "financialBudgetCategories" USING btree ("fiscalYear");

CREATE TABLE "financialTransactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "categoryId" integer,
  "type" "financial_transaction_type" NOT NULL,
  "status" "financial_transaction_status" DEFAULT 'draft' NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "amountCents" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'ILS' NOT NULL,
  "transactionDate" date NOT NULL,
  "createdBy" integer NOT NULL,
  "submittedAt" timestamp,
  "reviewedBy" integer,
  "reviewedAt" timestamp,
  "reviewNote" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "financial_transactions_status_date_idx" ON "financialTransactions" USING btree ("status", "transactionDate");
CREATE INDEX "financial_transactions_category_date_idx" ON "financialTransactions" USING btree ("categoryId", "transactionDate");
CREATE INDEX "financial_transactions_creator_date_idx" ON "financialTransactions" USING btree ("createdBy", "createdAt");

CREATE TABLE "financialReceipts" (
  "id" serial PRIMARY KEY NOT NULL,
  "transactionId" integer NOT NULL,
  "fileUrl" varchar(1000) NOT NULL,
  "fileKey" varchar(255) NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "financial_receipts_transaction_idx" ON "financialReceipts" USING btree ("transactionId");

CREATE TABLE "financialAuditLogs" (
  "id" serial PRIMARY KEY NOT NULL,
  "transactionId" integer,
  "actorId" integer NOT NULL,
  "action" varchar(80) NOT NULL,
  "summary" varchar(500) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "financial_audit_transaction_date_idx" ON "financialAuditLogs" USING btree ("transactionId", "createdAt");
