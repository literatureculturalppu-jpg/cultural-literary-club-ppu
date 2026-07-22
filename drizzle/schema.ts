import { boolean, date, integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Shared enums (Postgres requires named enum types, unlike MySQL's inline enum columns).
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "supervisor", "committee_head", "general_agent", "tech_admin"]);
export const academicYearEnum = pgEnum("academic_year", ["first", "second", "third", "fourth", "postgraduate"]);
export const activityStatusEnum = pgEnum("activity_status", ["upcoming", "ongoing", "completed"]);
export const memberStatusEnum = pgEnum("member_status", ["active", "inactive"]);
export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", ["article", "activity"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const notificationTypeEnum = pgEnum("notification_type", ["article", "activity", "achievement", "team_chat", "team_request"]);
export const bookVoteModeEnum = pgEnum("book_vote_mode", ["single", "multiple"]);
export const bookVoteStatusEnum = pgEnum("book_vote_status", ["open", "closed"]);
export const teamActionTypeEnum = pgEnum("team_action_type", [
  "add_member",
  "remove_member",
  "set_visibility",
  "set_chat_open",
]);
// "elevated" entries are actions taken by anyone above the plain "user" role
// (admin/supervisor/committee_head/general_agent/tech_admin) — content
// publishing, approvals, role changes, logins, etc. "member" entries are the
// ordinary activity of any signed-in member (regular or elevated alike),
// such as chatting with Basir or registering for an activity.
export const workLogScopeEnum = pgEnum("work_log_scope", ["elevated", "member"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  dateOfBirth: date("dateOfBirth"), // User's date of birth
  profileImage: varchar("profileImage", { length: 500 }), // S3 URL for profile image
  profileImageKey: varchar("profileImageKey", { length: 255 }), // S3 key for tracking

  /**
   * Permanent, system-generated member reference number. Format: YYNNNN
   * (2-digit join year + 4-digit sequence within that year, e.g. "260001").
   * Assigned once at account creation and never editable afterwards by
   * anyone, including admins — there is intentionally no update path for
   * this column anywhere in the API.
   */
  referenceNumber: varchar("referenceNumber", { length: 6 }).unique(),
  /** Membership approval status for newly-registered accounts. */
  approvalStatus: approvalStatusEnum("approvalStatus").default("pending").notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: integer("approvedBy"), // Reference to users.id (the admin who approved)

  // Onboarding fields (required during registration)
  arabicFullName: varchar("arabicFullName", { length: 255 }), // الاسم الرباعي بالعربية
  academicYear: academicYearEnum("academicYear"), // السنة الجامعية
  college: varchar("college", { length: 255 }), // الكلية
  department: varchar("department", { length: 255 }), // الدائرة
  phoneNumber: varchar("phoneNumber", { length: 20 }), // رقم الهاتف مع المقدمة الدولية
  skills: text("skills"), // المهارات (JSON array)
  preferredTeamId: integer("preferredTeamId"), // الفريق المطلوب (Reference to teams.id)
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(), // هل تم إكمال التسجيل
  universityId: varchar("universityId", { length: 50 }), // الرقم الجامعي
  whatsapp: varchar("whatsapp", { length: 30 }), // رقم الواتساب مع المقدمة
  specialization: varchar("specialization", { length: 255 }), // التخصص
  culturalExperience: text("culturalExperience"), // الخبرات الثقافية

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Backing counter for member reference numbers, one row per join year.
 * Incremented atomically (INSERT ... ON CONFLICT DO UPDATE ... RETURNING)
 * so concurrent sign-ups can never receive the same sequence number.
 */
export const referenceNumberCounters = pgTable("referenceNumberCounters", {
  year: integer("year").primaryKey(), // full year, e.g. 2026
  counter: integer("counter").default(0).notNull(),
});

/**
 * Activities/Events table for storing club activities and events
 */
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  content: text("content"), // Rich text content
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  location: varchar("location", { length: 255 }),
  imageUrl: varchar("imageUrl", { length: 500 }), // S3 URL for activity image
  imageKey: varchar("imageKey", { length: 255 }), // S3 key for tracking
  status: activityStatusEnum("status").default("upcoming").notNull(),
  isPinned: boolean("isPinned").default(false).notNull(),
  createdBy: integer("createdBy").notNull(), // Reference to users.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

/**
 * Articles/Blog posts table for storing cultural and linguistic content
 */
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(), // URL-friendly identifier
  excerpt: text("excerpt"), // Short summary
  content: text("content").notNull(), // Rich text content
  author: varchar("author", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }), // e.g., "grammar", "literature", "culture"
  imageUrl: varchar("imageUrl", { length: 500 }), // S3 URL for article cover image
  imageKey: varchar("imageKey", { length: 255 }), // S3 key for tracking
  published: boolean("published").default(false).notNull(),
  createdBy: integer("createdBy").notNull(), // Reference to users.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

/**
 * Club members/subscribers table
 */
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  university: varchar("university", { length: 255 }), // e.g., "Palestine Polytechnic University"
  major: varchar("major", { length: 255 }), // Student major/field
  joinDate: timestamp("joinDate").defaultNow().notNull(),
  status: memberStatusEnum("status").default("active").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

/**
 * Team members/Staff table for the "About Us" page
 */
export const teamMembers = pgTable("teamMembers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  position: varchar("position", { length: 255 }).notNull(), // e.g., "President", "Vice President"
  bio: text("bio"), // Short biography
  imageUrl: varchar("imageUrl", { length: 500 }), // S3 URL for profile image
  imageKey: varchar("imageKey", { length: 255 }), // S3 key for tracking
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  order: integer("order").default(0), // For sorting display order
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * File attachments for articles and activities
 */
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  entityType: attachmentEntityTypeEnum("entityType").notNull(), // Type of entity this is attached to
  entityId: integer("entityId").notNull(), // ID of the article or activity
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(), // S3 URL
  fileKey: varchar("fileKey", { length: 255 }).notNull(), // S3 key for tracking
  fileSize: integer("fileSize"), // File size in bytes
  mimeType: varchar("mimeType", { length: 100 }), // e.g., "application/pdf"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

/**
 * Achievements and Awards table for storing club achievements
 */
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "award", "achievement", "milestone"
  year: integer("year").notNull(), // Year of achievement
  imageUrl: varchar("imageUrl", { length: 500 }), // S3 URL for achievement image/certificate
  imageKey: varchar("imageKey", { length: 255 }), // S3 key for tracking
  awardName: varchar("awardName", { length: 255 }), // Name of the award
  awardingOrganization: varchar("awardingOrganization", { length: 255 }), // Organization that gave the award
  details: text("details"), // Additional details about the achievement
  articleId: integer("articleId"), // Optional link to a related article (articles.id)
  order: integer("order").default(0), // For sorting display order
  featured: boolean("featured").default(false).notNull(), // Whether to feature on homepage
  createdBy: integer("createdBy").notNull(), // Reference to users.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

/**
 * External links table for storing social media and external links
 */
export const externalLinks = pgTable("externalLinks", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., "social", "admin", "external"
  title: varchar("title", { length: 255 }).notNull(), // e.g., "Facebook", "Twitter", "Website"
  url: varchar("url", { length: 500 }).notNull(), // The actual link
  icon: varchar("icon", { length: 100 }), // Icon name or class
  order: integer("order").default(0), // For sorting display order
  isActive: boolean("isActive").default(true).notNull(), // Whether to display this link
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ExternalLink = typeof externalLinks.$inferSelect;
export type InsertExternalLink = typeof externalLinks.$inferInsert;

/**
 * Activity subscriptions table for tracking user subscriptions to activities
 */
export const activitySubscriptions = pgTable("activitySubscriptions", {
  id: serial("id").primaryKey(),
  activityId: integer("activityId").notNull(),
  userId: integer("userId").notNull(),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
});

export type ActivitySubscription = typeof activitySubscriptions.$inferSelect;
export type InsertActivitySubscription = typeof activitySubscriptions.$inferInsert;

/**
 * Teams/Committees table for managing club teams and committees
 */
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "فريق المناظرات"
  description: text("description"), // Team description
  headId: integer("headId").notNull(), // Reference to users.id (مشرف الفريق / committee_head)
  isVisible: boolean("isVisible").default(false).notNull(), // Only visible to admins + team members when false
  isChatOpen: boolean("isChatOpen").default(true).notNull(), // Whether team chat currently accepts new messages
  headFreedom: boolean("headFreedom").default(false).notNull(), // If true, this team's supervisor can act without admin approval
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/**
 * Team members table for managing members of each team
 */
export const teamMembers2 = pgTable("teamMembers2", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull(), // Reference to teams.id
  userId: integer("userId").notNull(), // Reference to users.id
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type TeamMember2 = typeof teamMembers2.$inferSelect;
export type InsertTeamMember2 = typeof teamMembers2.$inferInsert;

/**
 * Team join requests table for managing team membership requests
 */
export const teamJoinRequests = pgTable("teamJoinRequests", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull(), // Reference to teams.id
  userId: integer("userId").notNull(), // Reference to users.id
  status: approvalStatusEnum("status").default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: integer("reviewedBy"), // Reference to users.id (admin/supervisor who reviewed)
  rejectionReason: text("rejectionReason"), // Reason for rejection if rejected
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type TeamJoinRequest = typeof teamJoinRequests.$inferSelect;
export type InsertTeamJoinRequest = typeof teamJoinRequests.$inferInsert;

/**
 * Team action requests: when a team supervisor (committee_head) without the
 * `headFreedom` flag tries to manage their team (add/remove a member, toggle
 * visibility, open/close chat), the action is queued here for an admin to
 * approve or reject instead of being applied immediately. If the team has
 * `headFreedom = true`, the supervisor's actions apply instantly and never
 * create a row here.
 */
export const teamActionRequests = pgTable("teamActionRequests", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull(), // Reference to teams.id
  requestedBy: integer("requestedBy").notNull(), // Reference to users.id (the committee_head)
  actionType: teamActionTypeEnum("actionType").notNull(),
  payload: text("payload").notNull(), // JSON string, shape depends on actionType
  status: approvalStatusEnum("status").default("pending").notNull(),
  reviewedBy: integer("reviewedBy"), // Reference to users.id (admin who reviewed)
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type TeamActionRequest = typeof teamActionRequests.$inferSelect;
export type InsertTeamActionRequest = typeof teamActionRequests.$inferInsert;

/**
 * Team invite links ("رابط دعوة"). A team supervisor/admin can generate a
 * shareable link that lets whoever opens it request to join the team
 * without needing to find it on the "الفرق" page first. Every use of the
 * link still results in a normal `teamJoinRequests` row — i.e. accepting an
 * invite never bypasses approval, it only skips having to locate the team.
 * A link can be limited by an expiry timestamp, a max number of uses, or
 * both; once either limit is hit (or it's manually revoked) it stops
 * working.
 */
export const teamInviteLinks = pgTable("teamInviteLinks", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull(), // Reference to teams.id
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdBy: integer("createdBy").notNull(), // Reference to users.id
  expiresAt: timestamp("expiresAt"), // null = no time limit
  maxUses: integer("maxUses"), // null = unlimited uses
  usedCount: integer("usedCount").default(0).notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeamInviteLink = typeof teamInviteLinks.$inferSelect;
export type InsertTeamInviteLink = typeof teamInviteLinks.$inferInsert;

/**
 * Registration requests table for managing non-university email registrations
 */
export const registrationRequests = pgTable("registrationRequests", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(), // Email requesting registration
  name: varchar("name", { length: 255 }).notNull(), // User's full name
  status: approvalStatusEnum("status").default("pending").notNull(),
  reason: text("reason"), // Reason for requesting access (optional)
  rejectionReason: text("rejectionReason"), // Reason for rejection if rejected
  reviewedBy: integer("reviewedBy"), // Reference to admin/supervisor who reviewed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  approvedAt: timestamp("approvedAt"), // When the request was approved
});

export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type InsertRegistrationRequest = typeof registrationRequests.$inferInsert;

/**
 * Profile edit requests: a member can propose changes to their own profile
 * fields, but the change never applies immediately — it sits here as
 * "pending" until an admin/general-agent reviews it. Approving copies
 * `changes` onto the `users` row; rejecting just records `rejectionReason`
 * so the member can see why and try again. Mirrors the same
 * request/approve/reject shape used by `teamJoinRequests` and
 * `registrationRequests` above.
 */
export const profileEditRequests = pgTable("profileEditRequests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Reference to users.id (the member requesting the edit)
  changes: text("changes").notNull(), // JSON string: partial map of profile field -> proposed new value
  status: approvalStatusEnum("status").default("pending").notNull(),
  reviewedBy: integer("reviewedBy"), // Reference to users.id (admin who reviewed)
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"), // Reason for rejection if rejected
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ProfileEditRequest = typeof profileEditRequests.$inferSelect;
export type InsertProfileEditRequest = typeof profileEditRequests.$inferInsert;

/**
 * Notifications table for in-app notifications (article/activity/achievement
 * creation events, activity subscription/registration approvals, etc). One
 * row per (user, event) so we can track read/unread state per user.
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Reference to users.id (recipient)
  type: notificationTypeEnum("type").notNull(),
  entityId: integer("entityId").notNull(), // Reference to the related content row
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"), // Optional preview / excerpt
  url: varchar("url", { length: 500 }).notNull(), // Relative link to the content
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * AI (Basir) settings – single-row configuration table.
 * Controls whether the AI assistant is enabled/disabled globally.
 */
export const aiSettings = pgTable("aiSettings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = typeof aiSettings.$inferInsert;

/**
 * PDF feed files uploaded by admins for the Basir AI assistant.
 * The AI prioritises answers from these documents before falling
 * back to general knowledge.
 */
export const aiPdfFiles = pgTable("aiPdfFiles", {
  id: serial("id").primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  fileSize: integer("fileSize"),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiPdfFile = typeof aiPdfFiles.$inferSelect;
export type InsertAiPdfFile = typeof aiPdfFiles.$inferInsert;

/**
 * Daily prompt-usage counter for the Basir assistant, one row per
 * (user, day). Members and admins get a base daily quota; admins get
 * double (two shares) since the club's overall 300-prompt/day allotment is
 * reserved for admin accounts. Enforced in the `basir.chat` mutation.
 */
export const aiUsage = pgTable("aiUsage", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  usageDate: varchar("usageDate", { length: 10 }).notNull(), // "YYYY-MM-DD"
  count: integer("count").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type AiUsage = typeof aiUsage.$inferSelect;
export type InsertAiUsage = typeof aiUsage.$inferInsert;

/**
 * Guest activity registrations – for users outside the club who register
 * for an activity without a club account.
 */
export const guestActivityRegistrations = pgTable("guestActivityRegistrations", {
  id: serial("id").primaryKey(),
  activityId: integer("activityId").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  universityEmail: varchar("universityEmail", { length: 320 }).notNull(),
  universityId: varchar("universityId", { length: 50 }).notNull(),
  college: varchar("college", { length: 255 }),
  specialization: varchar("specialization", { length: 255 }),
  academicYear: varchar("academicYear", { length: 50 }),
  phoneNumber: varchar("phoneNumber", { length: 30 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
});

export type GuestActivityRegistration = typeof guestActivityRegistrations.$inferSelect;
export type InsertGuestActivityRegistration = typeof guestActivityRegistrations.$inferInsert;

/**
 * Registration settings – single-row config table.
 * Controls whether new users can create accounts (public registration toggle).
 */
export const registrationSettings = pgTable("registrationSettings", {
  id: serial("id").primaryKey(),
  registrationEnabled: boolean("registrationEnabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type RegistrationSetting = typeof registrationSettings.$inferSelect;
export type InsertRegistrationSetting = typeof registrationSettings.$inferInsert;

/**
 * Work Teams displayed on the About page.
 * Each team has a name, image, and mission statement.
 */
export const workTeams = pgTable("workTeams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  mission: text("mission"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  imageKey: varchar("imageKey", { length: 255 }),
  order: integer("order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type WorkTeam = typeof workTeams.$inferSelect;
export type InsertWorkTeam = typeof workTeams.$inferInsert;

/**
 * Members of work teams. Each member has a name, position, image, and bio.
 */
export const workTeamMembers = pgTable("workTeamMembers", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  position: varchar("position", { length: 255 }).notNull(),
  bio: text("bio"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  imageKey: varchar("imageKey", { length: 255 }),
  order: integer("order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type WorkTeamMember = typeof workTeamMembers.$inferSelect;
export type InsertWorkTeamMember = typeof workTeamMembers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// "الكتب" (Books) page
// ─────────────────────────────────────────────────────────────────────────

/**
 * Books the club has actually read & discussed ("الكتب المختومة").
 * `googleBooksId` is stored so the public search box (which queries the
 * Google Books API live) can reliably detect "already read by the club"
 * even though the search results themselves come straight from Google.
 */
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 255 }).notNull(),
  pageCount: integer("pageCount"),
  partsCount: integer("partsCount").default(1),
  completedAt: date("completedAt"), // when the club finished reading/discussing it
  articleId: integer("articleId"), // optional link to articles.id
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  genre: varchar("genre", { length: 255 }), // e.g. رواية / فكر / تاريخ
  summary: text("summary"), // short club summary or discussion notes
  clubRating: integer("clubRating"), // 1-5, optional
  googleBooksId: varchar("googleBooksId", { length: 64 }), // for matching in search results
  isbn: varchar("isbn", { length: 32 }),
  createdBy: integer("createdBy"),
  order: integer("order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

/**
 * A single global "round" of member book suggestions ("اقتراحات الأعضاء").
 * Admins open/close the round; while open, each member may submit exactly
 * one suggestion (enforced by the unique constraint below via app logic).
 * Closing a round schedules automatic deletion of all its suggestions
 * 5 days later to keep the database lean.
 */
export const bookSuggestionRounds = pgTable("bookSuggestionRounds", {
  id: serial("id").primaryKey(),
  status: bookVoteStatusEnum("status").default("open").notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  scheduledDeleteAt: timestamp("scheduledDeleteAt"),
});

export type BookSuggestionRound = typeof bookSuggestionRounds.$inferSelect;
export type InsertBookSuggestionRound = typeof bookSuggestionRounds.$inferInsert;

export const bookSuggestions = pgTable("bookSuggestions", {
  id: serial("id").primaryKey(),
  roundId: integer("roundId").notNull(),
  suggestedBy: integer("suggestedBy").notNull(), // users.id
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 255 }),
  note: text("note"), // why they suggest it, optional
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookSuggestion = typeof bookSuggestions.$inferSelect;
export type InsertBookSuggestion = typeof bookSuggestions.$inferInsert;

/**
 * The curated admin-run vote ("التصويت على الكتب"). Options can be sourced
 * from member suggestions or added as brand-new/external books. Closing a
 * poll schedules deletion of the whole poll (options + ballots) 7 days later.
 */
export const bookVotePolls = pgTable("bookVotePolls", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull().default("تصويت اختيار الكتاب القادم"),
  mode: bookVoteModeEnum("mode").default("single").notNull(),
  status: bookVoteStatusEnum("status").default("open").notNull(),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  scheduledDeleteAt: timestamp("scheduledDeleteAt"),
});

export type BookVotePoll = typeof bookVotePolls.$inferSelect;
export type InsertBookVotePoll = typeof bookVotePolls.$inferInsert;

export const bookVotePollOptions = pgTable("bookVotePollOptions", {
  id: serial("id").primaryKey(),
  pollId: integer("pollId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 255 }),
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  sourceSuggestionId: integer("sourceSuggestionId"), // informational only, not a hard FK
  order: integer("order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookVotePollOption = typeof bookVotePollOptions.$inferSelect;
export type InsertBookVotePollOption = typeof bookVotePollOptions.$inferInsert;

export const bookVoteBallots = pgTable("bookVoteBallots", {
  id: serial("id").primaryKey(),
  pollId: integer("pollId").notNull(),
  optionId: integer("optionId").notNull(),
  userId: integer("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookVoteBallot = typeof bookVoteBallots.$inferSelect;
export type InsertBookVoteBallot = typeof bookVoteBallots.$inferInsert;

/**
 * One row per calendar day, tracking how many emails have been sent so far.
 * Backs the priority-aware sending quota in server/services/email.ts, which
 * keeps us safely under Brevo's 300/day free-tier cap while making sure
 * higher-priority email types (activity acceptance/publish) are never
 * starved by lower-priority ones (achievements, articles, books) sent
 * earlier in the day.
 */
export const emailDailyQuota = pgTable("emailDailyQuota", {
  date: varchar("date", { length: 10 }).primaryKey(), // 'YYYY-MM-DD'
  count: integer("count").default(0).notNull(),
});

export type EmailDailyQuota = typeof emailDailyQuota.$inferSelect;

/**
 * "سجلات العمل" (Work Logs) — an audit trail visible only from the
 * Technical Manager ("المدير التقني") dashboard.
 *
 * - scope = "elevated": actions performed by anyone with more than the
 *   plain "user" role (publishing/editing/deleting activities, articles,
 *   achievements, etc; approving or rejecting requests; promoting or
 *   demoting another member's role; signing in/out).
 * - scope = "member": ordinary activity from ANY signed-in user (not just
 *   regular members) — e.g. chatting with the Basir assistant, or
 *   registering/subscribing to an activity.
 *
 * `actorRole` is captured at the time of the action (rather than relying on
 * a join against the current `users.role`) so the log stays historically
 * accurate even if the actor's role changes or their account is later
 * removed.
 */
export const workLogs = pgTable("workLogs", {
  id: serial("id").primaryKey(),
  scope: workLogScopeEnum("scope").notNull(),
  actorId: integer("actorId"), // Reference to users.id; null for anonymous/guest actions
  actorName: varchar("actorName", { length: 255 }), // Snapshot of the actor's display name at the time
  actorRole: varchar("actorRole", { length: 50 }), // Snapshot of the actor's role at the time
  action: varchar("action", { length: 100 }).notNull(), // e.g. "activity.publish", "auth.login"
  description: text("description").notNull(), // Human-readable Arabic summary shown in the logs table
  entityType: varchar("entityType", { length: 50 }), // e.g. "activity", "article", "user"
  entityId: integer("entityId"), // ID of the affected row, if any
  metadata: text("metadata"), // Optional JSON string with extra structured detail
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkLog = typeof workLogs.$inferSelect;
export type InsertWorkLog = typeof workLogs.$inferInsert;
