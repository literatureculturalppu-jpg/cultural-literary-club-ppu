CREATE TABLE IF NOT EXISTS "learningSettings" (
  "id" serial PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "updatedBy" integer,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learningCourses" (
  "id" serial PRIMARY KEY NOT NULL,
  "audience" varchar(20) NOT NULL,
  "title" varchar(255) NOT NULL,
  "courseCode" varchar(80) NOT NULL,
  "level" varchar(100) NOT NULL,
  "description" text,
  "coverImageUrl" varchar(1000),
  "averageVideoMinutes" integer DEFAULT 0 NOT NULL,
  "published" boolean DEFAULT true NOT NULL,
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learning_courses_audience_level_idx" ON "learningCourses" ("audience", "level");
CREATE INDEX IF NOT EXISTS "learning_courses_published_created_idx" ON "learningCourses" ("published", "createdAt");

CREATE TABLE IF NOT EXISTS "learningVideos" (
  "id" serial PRIMARY KEY NOT NULL,
  "courseId" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "videoUrl" varchar(1000) NOT NULL,
  "coverImageUrl" varchar(1000),
  "description" text,
  "durationMinutes" integer DEFAULT 0 NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learning_videos_course_order_idx" ON "learningVideos" ("courseId", "sortOrder");

CREATE TABLE IF NOT EXISTS "learningRatings" (
  "id" serial PRIMARY KEY NOT NULL,
  "courseId" integer NOT NULL,
  "userId" integer NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" varchar(800),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "learning_ratings_course_user_unique" ON "learningRatings" ("courseId", "userId");
CREATE INDEX IF NOT EXISTS "learning_ratings_course_idx" ON "learningRatings" ("courseId");

ALTER TABLE "learningSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learningCourses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learningVideos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learningRatings" ENABLE ROW LEVEL SECURITY;
