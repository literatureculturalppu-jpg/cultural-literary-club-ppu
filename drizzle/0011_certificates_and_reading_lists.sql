CREATE TYPE "public"."book_reading_status" AS ENUM('want_to_read', 'reading', 'finished');

CREATE TABLE "userBookShelves" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "bookId" integer NOT NULL,
  "status" "book_reading_status" DEFAULT 'want_to_read' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "userBookShelves_user_book_unique" ON "userBookShelves" USING btree ("userId", "bookId");

CREATE TABLE "activityCertificates" (
  "id" serial PRIMARY KEY NOT NULL,
  "activityId" integer NOT NULL,
  "userId" integer NOT NULL,
  "recipientName" varchar(255) NOT NULL,
  "certificateNumber" varchar(64) NOT NULL UNIQUE,
  "verificationToken" varchar(64) NOT NULL UNIQUE,
  "issuedBy" integer NOT NULL,
  "issuedAt" timestamp DEFAULT now() NOT NULL,
  "revokedAt" timestamp
);

CREATE UNIQUE INDEX "activityCertificates_activity_user_unique" ON "activityCertificates" USING btree ("activityId", "userId");
