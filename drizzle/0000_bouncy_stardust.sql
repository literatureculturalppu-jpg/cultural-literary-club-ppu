CREATE TYPE "public"."academic_year" AS ENUM('first', 'second', 'third', 'fourth', 'postgraduate');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('upcoming', 'ongoing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attachment_entity_type" AS ENUM('article', 'activity');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('article', 'activity', 'achievement');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'supervisor', 'committee_head', 'general_agent');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"awardName" varchar(255),
	"awardingOrganization" varchar(255),
	"details" text,
	"order" integer DEFAULT 0,
	"featured" boolean DEFAULT false NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"content" text,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp,
	"location" varchar(255),
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"status" "activity_status" DEFAULT 'upcoming' NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activitySubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"activityId" integer NOT NULL,
	"userId" integer NOT NULL,
	"subscribedAt" timestamp DEFAULT now() NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiPdfFiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" varchar(500) NOT NULL,
	"fileKey" varchar(255) NOT NULL,
	"fileSize" integer,
	"uploadedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"author" varchar(255) NOT NULL,
	"category" varchar(100),
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"published" boolean DEFAULT false NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entityType" "attachment_entity_type" NOT NULL,
	"entityId" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" varchar(500) NOT NULL,
	"fileKey" varchar(255) NOT NULL,
	"fileSize" integer,
	"mimeType" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "externalLinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" varchar(500) NOT NULL,
	"icon" varchar(100),
	"order" integer DEFAULT 0,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guestActivityRegistrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"activityId" integer NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"universityEmail" varchar(320) NOT NULL,
	"universityId" varchar(50) NOT NULL,
	"college" varchar(255),
	"specialization" varchar(255),
	"academicYear" varchar(50),
	"phoneNumber" varchar(30) NOT NULL,
	"whatsapp" varchar(30),
	"registeredAt" timestamp DEFAULT now() NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(20),
	"university" varchar(255),
	"major" varchar(255),
	"joinDate" timestamp DEFAULT now() NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"entityId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"url" varchar(500) NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrationRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"rejectionReason" text,
	"reviewedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"approvedAt" timestamp,
	CONSTRAINT "registrationRequests_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "registrationSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"registrationEnabled" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamJoinRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"teamId" integer NOT NULL,
	"userId" integer NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"reviewedAt" timestamp,
	"reviewedBy" integer,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"bio" text,
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"email" varchar(320),
	"phone" varchar(20),
	"order" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamMembers2" (
	"id" serial PRIMARY KEY NOT NULL,
	"teamId" integer NOT NULL,
	"userId" integer NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"headId" integer NOT NULL,
	"isVisible" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"dateOfBirth" date,
	"profileImage" varchar(500),
	"profileImageKey" varchar(255),
	"arabicFullName" varchar(255),
	"academicYear" "academic_year",
	"college" varchar(255),
	"department" varchar(255),
	"phoneNumber" varchar(20),
	"skills" text,
	"preferredTeamId" integer,
	"onboardingCompleted" boolean DEFAULT false NOT NULL,
	"universityId" varchar(50),
	"whatsapp" varchar(30),
	"specialization" varchar(255),
	"culturalExperience" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "workTeamMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"teamId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"bio" text,
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"order" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workTeams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"mission" text,
	"imageUrl" varchar(500),
	"imageKey" varchar(255),
	"order" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
