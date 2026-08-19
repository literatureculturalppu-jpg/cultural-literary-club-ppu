-- The security audit retains that the assistant was used, but never retains
-- member conversation text or previews. Existing historical metadata is
-- cleared so it follows the same privacy policy as new records.
UPDATE "workLogs"
SET "metadata" = NULL
WHERE "action" = 'basir.chat'
  AND "metadata" IS NOT NULL;
