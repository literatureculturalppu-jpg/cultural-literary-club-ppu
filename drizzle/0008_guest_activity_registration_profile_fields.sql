ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "universityEmail" varchar(320);
ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "universityId" varchar(50);
ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "college" varchar(255);
ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "specialization" varchar(255);
ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "academicYear" varchar(50);
ALTER TABLE "guestActivityRegistrations" ADD COLUMN IF NOT EXISTS "whatsapp" varchar(30);

UPDATE "guestActivityRegistrations"
SET
  "universityEmail" = COALESCE("universityEmail", email),
  "universityId" = COALESCE("universityId", "referenceNumber"),
  college = COALESCE(college, university)
WHERE "universityEmail" IS NULL
   OR "universityId" IS NULL
   OR college IS NULL;
