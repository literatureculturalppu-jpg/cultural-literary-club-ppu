-- Financial records must never be exposed through direct Supabase clients.
-- No public policies are added: the club server connects as the database owner
-- and enforces the role workflow in tRPC. FORCE is deliberately omitted so the
-- existing server connection continues to function.
ALTER TABLE "financialBudgetCategories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financialTransactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financialReceipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financialAuditLogs" ENABLE ROW LEVEL SECURITY;
