CREATE TABLE IF NOT EXISTS "membershipCards" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL UNIQUE,
  "verificationToken" varchar(64) NOT NULL UNIQUE,
  "issuedAt" timestamp DEFAULT now() NOT NULL,
  "lastVerifiedAt" timestamp,
  "lastVerifiedBy" integer,
  "isRevoked" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "membershipCards_verificationToken_idx"
  ON "membershipCards" ("verificationToken");
CREATE INDEX IF NOT EXISTS "membershipCards_userId_idx"
  ON "membershipCards" ("userId");
