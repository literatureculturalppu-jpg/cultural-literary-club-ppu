import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";

import { z } from "zod";
import {
  getActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  getArticles,
  getArticleById,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  getMembers,
  createMember,
  updateMemberRole,
  deleteMember,
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,

  getAchievements,
  getAchievementById,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getExternalLinks,
  getExternalLinksByType,
  createExternalLink,
  updateExternalLink,
  deleteExternalLink,
  getActivitySubscriptions,
  getUserActivitySubscriptions,
  createActivitySubscription,
  deleteActivitySubscription,
  isUserSubscribedToActivity,
  getUserActivities,
  getUserArticles,
  getUserAchievements,
  getUsers,
  getUserById,
  getUserByReferenceNumber,
  updateUserRole,
  getPendingUsers,
  approveUser,
  rejectUser,
  getTeams,
  getTeamsByHead,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers2ByTeam,
  getTeamMember2ById,
  createTeamMember2,
  deleteTeamMember2,
  getRegistrationRequests,
  getRegistrationRequestById,
  getRegistrationRequestByEmail,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  getTeamJoinRequests,
  getTeamJoinRequestsByTeam,
  getTeamJoinRequestsByUser,
  getTeamJoinRequestById,
  getPendingTeamJoinRequestForUser,
  createTeamJoinRequest,
  approveTeamJoinRequest,
  rejectTeamJoinRequest,
  getTeamActionRequests,
  getTeamActionRequestsByTeam,
  getTeamActionRequestById,
  createTeamActionRequest,
  approveTeamActionRequest,
  rejectTeamActionRequest,
  getAdminTierUsers,
  getTeamRosterNamesOnly,
  getTeamRosterFull,
  isTeamMemberOrAdmin,
  searchApprovedUsersByName,
  getTeamsForAdmin,
  createTeamInviteLink,
  getTeamInviteLinksByTeam,
  getTeamInviteLinkByToken,
  incrementTeamInviteLinkUsage,
  revokeTeamInviteLink,
  isInviteLinkUsable,
  updateUserOnboarding,
  upsertUser,
  isProtectedAdminUser,
  getUserNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAiSettings,
  updateAiEnabled,
  getAiPdfFiles,
  createAiPdfFile,
  deleteAiPdfFile,
  getBasirDailyLimit,
  getBasirUsageToday,
  incrementBasirUsage,
  getBasirUsageStats,
  getWorkTeams,
  getWorkTeamById,
  createWorkTeam,
  updateWorkTeam,
  deleteWorkTeam,
  getWorkTeamMembers,
  createWorkTeamMember,
  updateWorkTeamMember,
  deleteWorkTeamMember,
  createGuestActivityRegistration,
  getGuestRegistrationsByActivity,
  getActivitySubscribersWithUsers,
  getRegistrationSettings,
  updateRegistrationEnabled,
  deleteUser,
  updateUserProfile,
  approveActivitySubscription,
  rejectActivitySubscription,
  approveGuestRegistration,
  rejectGuestRegistration,
  toggleActivityPin,
  countGeneralAgentUsers,
  MIN_GENERAL_AGENTS,
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getActiveSuggestionRound,
  openSuggestionRound,
  closeSuggestionRound,
  getSuggestionsForRound,
  getMySuggestionInRound,
  createSuggestion,
  deleteSuggestion,
  getActivePoll,
  getPollById,
  createPoll,
  closePoll,
  addPollOption,
  updatePollOption,
  deletePollOption,
  getPollOptionsWithCounts,
  getMyBallots,
  castVote,
  runScheduledBookCleanup,
  getTeamsForUser,
  getUserActivitySubscriptionsWithActivity,
  getProfileEditRequests,
  getProfileEditRequestsByUser,
  getPendingProfileEditRequestForUser,
  getLatestProfileEditRequestForUser,
  getProfileEditRequestById,
  createProfileEditRequest,
  approveProfileEditRequest,
  rejectProfileEditRequest,
  PROFILE_EDITABLE_FIELDS,
  logAction,
  getWorkLogs,
} from "./db.js";
import { notifyOwner } from "./_core/notification.js";
import { notifyContentCreated, notifyActivityApproval, notifyBookCreated, notifyGuestActivityApproval, notifyTeamInApp } from "./services/notify.js";
import { chatWithBasir } from "./services/basir.js";
import { searchBooks } from "./services/googleBooks.js";
import {
  appendTeamMessage,
  getTeamMessagesSince,
  getAllTeamMessages,
  editTeamMessage,
  deleteTeamMessage,
} from "./services/teamChat.js";
import crypto from "crypto";

/**
 * Verify a buffer's magic bytes actually match the claimed image mime type.
 * Client-declared mime types (from a data URL or form field) are never
 * trustworthy on their own — this closes the gap where an attacker sends
 * `data:image/png;base64,<html/script bytes>` and has it stored/served as
 * if it were a real PNG.
 */
export function sniffImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  switch (mimeType) {
    case "image/png":
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/gif":
      return buffer.subarray(0, 6).toString("latin1") === "GIF87a" || buffer.subarray(0, 6).toString("latin1") === "GIF89a";
    case "image/webp":
      return buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
    default:
      return false;
  }
}

// Admin-only procedure. "الوكيل العام" (general agent) and "المدير التقني"
// (tech admin) both have all admin permissions as well, so they are always
// allowed anywhere `adminProcedure` is required.
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "general_agent" && ctx.user.role !== "tech_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

// Technical-manager-only procedure — role must be exactly "tech_admin".
// Backs the "سجلات العمل" (work logs) dashboard and the ability to promote
// another member to "tech_admin".
const techAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "tech_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/**
 * Records an audit-trail entry for an action taken by an elevated-role
 * member (anything above plain "user"), or for ordinary member activity
 * (Basir chats, activity registrations) which is logged regardless of role.
 * Never throws — see `logAction` in db.ts.
 */
function recordWorkLog(params: {
  scope: "elevated" | "member";
  actor: { id: number; name: string | null; role: string } | null;
  action: string;
  description: string;
  entityType?: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
}) {
  void logAction({
    scope: params.scope,
    actorId: params.actor?.id ?? null,
    actorName: params.actor?.name ?? null,
    actorRole: params.actor?.role ?? null,
    action: params.action,
    description: params.description,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
  });
}

/**
 * Guards a role-changing mutation against the general-agent hierarchy rule:
 * a plain admin may not view/edit/change the role of a general agent, nor
 * promote anyone to (or demote anyone from) "general_agent". Only a general
 * agent may do those things — and not to demote itself.
 *
 * Bootstrap exception: if there are currently zero general agents in the
 * system (brand new deployment), an admin is allowed to create the very
 * first one — after that, only an existing general agent can create more.
 *
 * "المدير التقني" (tech_admin) sits one tier above general_agent: only an
 * existing tech_admin may promote/demote anyone to/from "tech_admin", and
 * neither a plain admin nor a general agent may view/edit a tech_admin's
 * role.
 */
async function assertCanChangeUserRole(
  actorRole: string,
  targetCurrentRole: string | undefined,
  newRole: string | undefined
) {
  const actorIsTechAdmin = actorRole === "tech_admin";
  if (!actorIsTechAdmin) {
    if (targetCurrentRole === "tech_admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "لا يمكن تعديل بيانات المدير التقني أو صلاحياته",
      });
    }
    if (newRole === "tech_admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "فقط المدير التقني يمكنه ترقية شخص إلى مدير تقني",
      });
    }
  }

  const actorIsAgent = actorRole === "general_agent" || actorIsTechAdmin;
  if (!actorIsAgent) {
    if (targetCurrentRole === "general_agent") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "لا يمكن للمسؤول تعديل بيانات الوكيل العام أو صلاحياته",
      });
    }
    if (newRole === "general_agent") {
      const currentCount = await countGeneralAgentUsers();
      if (currentCount > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "فقط الوكيل العام يمكنه ترقية شخص إلى وكيل عام",
        });
      }
      // currentCount === 0: allow the bootstrap promotion.
    }
  }
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: protectedProcedure.mutation(({ ctx }) => {
      // Clear the session cookie using the exact same options that were used
      // when it was set. Without matching options (especially sameSite and
      // secure) browsers silently ignore the clear request.
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      const isElevated = ctx.user.role !== "user";
      recordWorkLog({
        scope: isElevated ? "elevated" : "member",
        actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
        action: "auth.logout",
        description: `قام ${ctx.user.name || "مستخدم"} بتسجيل الخروج`,
        entityType: "user",
        entityId: ctx.user.id,
      });
      return { success: true };
    }),
  }),

  activities: router({
    list: publicProcedure.query(async () => {
      return getActivities();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getActivityById(input);
    }),
    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().min(1).max(5000),
          startDate: z.date(),
          endDate: z.date().optional(),
          location: z.string().max(255).optional(),
          content: z.string().max(50000).optional(),
          imageUrl: z.string().url().max(500).optional(),
          imageKey: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const activity = await createActivity({
          title: input.title,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          location: input.location,
          content: input.content,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          createdBy: ctx.user.id,
        });
        // Legacy Manus owner notification — now returns false instead of
        // throwing when unconfigured, so this is a no-op in Google-only
        // deployments. Wrapped in try/catch anyway so any new failure mode
        // cannot break the mutation.
        try {
          await notifyOwner({
            title: "نشاط جديد",
            content: `تم إضافة نشاط جديد: ${input.title}`,
          });
        } catch (err) {
          console.warn("[activities.create] notifyOwner failed:", err);
        }
        // Fan out in-app + email notifications to every onboarded user using
        // the primary key returned directly by the insert. No more full-table
        // scan + title filter (which was racy when titles collide).
        //
        // Wrapped in try/catch for parity with `articles.create`: the activity
        // row is already committed at this point, and we don't want a future
        // refactor (or a sync throw from the imports) to surface as a failed
        // mutation to the client. (Devin Review finding on PR #9.)
        if (activity?.id) {
          try {
            await notifyContentCreated({
              type: "activity",
              entityId: activity.id,
              title: input.title,
              excerpt: input.description,
              relativeUrl: `/activities/${activity.id}`,
              excludeUserId: ctx.user.id,
            });
          } catch (err) {
            console.warn("[activities.create] notifyContentCreated failed:", err);
          }
        }
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity.publish",
          description: `قام ${ctx.user.name || "مستخدم"} بنشر النشاط "${input.title}"`,
          entityType: "activity",
          entityId: activity?.id,
        });
        return activity;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          location: z.string().optional(),
          content: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const result = await updateActivity(id, data);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity.update",
          description: `قام ${ctx.user.name || "مستخدم"} بتعديل النشاط "${input.title ?? id}"`,
          entityType: "activity",
          entityId: id,
        });
        return result;
      }),
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        if (
          ctx.user?.role !== "admin" &&
          ctx.user?.role !== "general_agent" &&
          ctx.user?.role !== "tech_admin" &&
          ctx.user?.role !== "supervisor"
        ) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const result = await deleteActivity(input);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity.delete",
          description: `قام ${ctx.user.name || "مستخدم"} بحذف النشاط رقم ${input}`,
          entityType: "activity",
          entityId: input,
        });
        return result;
      }),
    isSubscribed: protectedProcedure
      .input(
        z.object({
          activityId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
        return isUserSubscribedToActivity(input.activityId, ctx.user.id);
      }),
    subscribe: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const result = await createActivitySubscription({
          userId: ctx.user.id,
          activityId: input,
        });
        recordWorkLog({
          scope: "member",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity.register",
          description: `قام ${ctx.user.name || "مستخدم"} بالتسجيل في النشاط رقم ${input}`,
          entityType: "activity",
          entityId: input,
        });
        return result;
      }),
    unsubscribe: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        return deleteActivitySubscription(input, ctx.user.id);
      }),
  }),

  articles: router({
    list: publicProcedure.query(async () => {
      return getArticles();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getArticleById(input);
    }),
    getBySlug: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return getArticleBySlug(input);
      }),
    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          slug: z.string().min(1).max(255),
          content: z.string().min(1).max(100000),
          excerpt: z.string().max(1000).optional(),
          category: z.string().max(100).optional(),
          author: z.string().max(255).optional(),
          imageUrl: z.string().url().max(500).optional(),
          imageKey: z.string().max(255).optional(),
          published: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const article = await createArticle({
          title: input.title,
          slug: input.slug,
          content: input.content,
          excerpt: input.excerpt,
          category: input.category,
          author: input.author || ctx.user.name || "مسؤول",
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          published: input.published ?? true,
          createdBy: ctx.user.id,
        });
        try {
          await notifyOwner({
            title: "مقالة جديدة",
            content: `تم نشر مقالة جديدة: ${input.title}`,
          });
        } catch (err) {
          console.warn("[articles.create] notifyOwner failed:", err);
        }
        // In-app + email notifications to all onboarded users (except author).
        // `createArticle` now returns `{...data, id}` via `$returningId()`, so
        // we use `article.id` directly — no follow-up `getArticleBySlug` round
        // trip (which used to race against replica lag) and the URL uses the
        // numeric id that `ArticleDetail`'s `parseInt(id)` expects.
        //
        // Wrapped in try/catch for parity with `activities.create` and
        // `achievements.create`: `notifyContentCreated` already swallows its
        // own errors, but the article is already committed at this point and
        // we don't want a future refactor (or a sync throw from the imports)
        // to ever surface as a failed mutation to the client. (Devin Review
        // finding on PR #9.)
        try {
          await notifyContentCreated({
            type: "article",
            entityId: article.id,
            title: input.title,
            excerpt: input.excerpt ?? null,
            relativeUrl: `/articles/${article.id}`,
            excludeUserId: ctx.user.id,
          });
        } catch (err) {
          console.warn("[articles.create] notifyContentCreated failed:", err);
        }
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "article.publish",
          description: `قام ${ctx.user.name || "مستخدم"} بنشر المقال "${input.title}"`,
          entityType: "article",
          entityId: article?.id,
        });
        return article;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          slug: z.string().optional(),
          content: z.string().optional(),
          excerpt: z.string().optional(),
          category: z.string().optional(),
          author: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          published: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const existing = input.published === true ? await getArticleById(id) : null;
        const wasUnpublished = existing ? existing.published !== true : false;
        const article = await updateArticle(id, data);
        if (wasUnpublished) {
          try {
            await notifyContentCreated({
              type: "article",
              entityId: id,
              title: data.title ?? existing?.title ?? "",
              excerpt: data.excerpt ?? existing?.excerpt ?? null,
              relativeUrl: `/articles/${id}`,
              excludeUserId: ctx.user.id,
            });
          } catch (err) {
            console.warn("[articles.update] notifyContentCreated failed:", err);
          }
        }
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "article.update",
          description: `قام ${ctx.user.name || "مستخدم"} بتعديل المقال "${data.title ?? existing?.title ?? id}"`,
          entityType: "article",
          entityId: id,
        });
        return article;
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input, ctx }) => {
      const result = await deleteArticle(input);
      recordWorkLog({
        scope: "elevated",
        actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
        action: "article.delete",
        description: `قام ${ctx.user.name || "مستخدم"} بحذف المقال رقم ${input}`,
        entityType: "article",
        entityId: input,
      });
      return result;
    }),
  }),

  members: router({
    list: publicProcedure.query(async () => {
      return getMembers();
    }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          email: z.string().email().max(320),
          phone: z.string().max(20).optional(),
          university: z.string().max(255).optional(),
          major: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const member = await createMember({
          name: input.name,
          email: input.email,
          phone: input.phone,
          university: input.university,
          major: input.major,
          joinDate: new Date(),
        });
        // Parity with the other create mutations (activities / articles /
        // achievements): keep the legacy Forge owner-notification in a
        // try/catch so any future throw cannot abort a successful DB insert.
        try {
          await notifyOwner({
            title: "عضو جديد",
            content: `تم تسجيل عضو جديد: ${input.name}`,
          });
        } catch (err) {
          console.warn("[members.create] notifyOwner failed:", err);
        }
        return member;
      }),
    updateRole: adminProcedure
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["user", "admin", "supervisor", "committee_head", "general_agent", "tech_admin"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const target = await getMembers().then((all) => all.find((m) => m.id === input.id));
        await assertCanChangeUserRole(ctx.user.role, target?.role, input.role);
        return updateMemberRole(input.id, input.role);
      }),
    delete: adminProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        // Devin Review fix: was calling deleteTeamMember, which wipes About-Us
        // staff rows, not the actual club member record.
        return deleteMember(input);
      }),
  }),

  teamMembers: router({
    list: publicProcedure.query(async () => {
      return getTeamMembers();
    }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          position: z.string(),
          bio: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createTeamMember({
          name: input.name,
          position: input.position,
          bio: input.bio,
          email: input.email,
          phone: input.phone,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          order: input.order,
        });
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          position: z.string().optional(),
          bio: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateTeamMember(id, data);
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteTeamMember(input);
    }),
  }),

  achievements: router({
    list: publicProcedure.query(async () => {
      return getAchievements();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getAchievementById(input);
    }),
    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().min(1).max(5000),
          category: z.string().min(1).max(100),
          year: z.number().int().min(1900).max(2100),
          awardName: z.string().max(255).optional(),
          awardingOrganization: z.string().max(255).optional(),
          details: z.string().max(10000).optional(),
          articleId: z.number().int().positive().optional(),
          order: z.number().int().min(0).max(9999).optional(),
          featured: z.boolean().optional(),
          imageUrl: z.string().url().max(500).optional().or(z.literal("")),
          imageKey: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.articleId) {
          const article = await getArticleById(input.articleId);
          if (!article) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "المقالة المحددة غير موجودة" });
          }
        }
        const achievement = await createAchievement({
          title: input.title,
          description: input.description,
          category: input.category,
          year: input.year,
          awardName: input.awardName,
          awardingOrganization: input.awardingOrganization,
          details: input.details,
          articleId: input.articleId,
          order: input.order,
          featured: input.featured ?? false,
          imageUrl: input.imageUrl || undefined,
          imageKey: input.imageKey,
          createdBy: ctx.user.id,
        });
        try {
          await notifyOwner({
            title: "إنجاز جديد",
            content: `تم إضافة إنجاز جديد: ${input.title}`,
          });
        } catch (err) {
          console.warn("[achievements.create] notifyOwner failed:", err);
        }
        // In-app + email notifications to all onboarded users (except author).
        // Uses the primary key returned directly by `createAchievement`.
        //
        // Wrapped in try/catch for parity with `articles.create`: the row is
        // already committed here, so a notification failure must never surface
        // as a mutation error to the client. (Devin Review finding on PR #9.)
        if (achievement?.id) {
          try {
            await notifyContentCreated({
              type: "achievement",
              entityId: achievement.id,
              title: input.title,
              excerpt: input.description,
              relativeUrl: `/achievements/${achievement.id}`,
              excludeUserId: ctx.user.id,
              emailExtras: { awardName: input.awardName, awardingOrganization: input.awardingOrganization },
            });
          } catch (err) {
            console.warn("[achievements.create] notifyContentCreated failed:", err);
          }
        }
        return achievement;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          category: z.string().optional(),
          year: z.number().optional(),
          awardName: z.string().optional(),
          awardingOrganization: z.string().optional(),
          details: z.string().optional(),
          articleId: z.number().int().positive().nullable().optional(),
          order: z.number().optional(),
          featured: z.boolean().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.articleId) {
          const article = await getArticleById(data.articleId);
          if (!article) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "المقالة المحددة غير موجودة" });
          }
        }
        return updateAchievement(id, data);
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteAchievement(input);
    }),
  }),

  externalLinks: router({
    list: publicProcedure.query(async () => {
      return getExternalLinks();
    }),
    getByType: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return getExternalLinksByType(input);
      }),
    create: adminProcedure
      .input(
        z.object({
          type: z.string().min(1).max(100),
          title: z.string().min(1).max(255),
          url: z.string().url().max(500),
          icon: z.string().max(100).optional(),
          order: z.number().int().min(0).max(9999).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createExternalLink({
          type: input.type,
          title: input.title,
          url: input.url,
          icon: input.icon,
          order: input.order,
          isActive: input.isActive ?? true,
        });
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          type: z.string().optional(),
          title: z.string().optional(),
          url: z.string().optional(),
          icon: z.string().optional(),
          order: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateExternalLink(id, data);
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteExternalLink(input);
    }),
  }),

  // ── "الكتب" page ──────────────────────────────────────────────────────────
  books: router({
    list: publicProcedure.query(async () => {
      return getBooks();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getBookById(input);
    }),
    searchGoogle: publicProcedure
      .input(z.string().min(1).max(255))
      .query(async ({ input }) => {
        try {
          return await searchBooks(input);
        } catch (error) {
          console.error("[Google Books] search failed", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر البحث حالياً، حاول لاحقاً" });
        }
      }),
    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          author: z.string().min(1).max(255),
          pageCount: z.number().int().positive().optional(),
          partsCount: z.number().int().positive().optional(),
          completedAt: z.string().optional(), // ISO date
          articleId: z.number().int().positive().optional(),
          coverImageUrl: z.string().url().optional().or(z.literal("")),
          genre: z.string().max(255).optional(),
          summary: z.string().max(5000).optional(),
          clubRating: z.number().int().min(1).max(5).optional(),
          googleBooksId: z.string().max(64).optional(),
          isbn: z.string().max(32).optional(),
          order: z.number().int().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.articleId) {
          const article = await getArticleById(input.articleId);
          if (!article) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "المقالة المحددة غير موجودة" });
          }
        }
        const book = await createBook({
          ...input,
          coverImageUrl: input.coverImageUrl || undefined,
          createdBy: ctx.user.id,
        });
        try {
          await notifyBookCreated(input.title, input.author, ctx.user.id);
        } catch (err) {
          console.warn("[books.create] notifyBookCreated failed:", err);
        }
        return book;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          author: z.string().optional(),
          pageCount: z.number().int().positive().nullable().optional(),
          partsCount: z.number().int().positive().nullable().optional(),
          completedAt: z.string().nullable().optional(),
          articleId: z.number().int().positive().nullable().optional(),
          coverImageUrl: z.string().optional(),
          genre: z.string().optional(),
          summary: z.string().optional(),
          clubRating: z.number().int().min(1).max(5).nullable().optional(),
          googleBooksId: z.string().optional(),
          isbn: z.string().optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.articleId) {
          const article = await getArticleById(data.articleId);
          if (!article) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "المقالة المحددة غير موجودة" });
          }
        }
        return updateBook(id, data);
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteBook(input);
    }),
  }),

  // ── Member book suggestions ("اقتراحات الأعضاء") ───────────────────────────
  bookSuggestions: router({
    activeRound: publicProcedure.query(async () => {
      return getActiveSuggestionRound();
    }),
    listMine: protectedProcedure.query(async ({ ctx }) => {
      const round = await getActiveSuggestionRound();
      if (!round) return null;
      return getMySuggestionInRound(round.id, ctx.user.id);
    }),
    // Admin-only: see every suggestion in the currently open round.
    listAll: adminProcedure.query(async () => {
      const round = await getActiveSuggestionRound();
      if (!round) return [];
      return getSuggestionsForRound(round.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          author: z.string().max(255).optional(),
          note: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const round = await getActiveSuggestionRound();
        if (!round) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد جولة اقتراحات مفتوحة حالياً" });
        }
        const existing = await getMySuggestionInRound(round.id, ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لقد أضفت اقتراحك بالفعل لهذه الجولة" });
        }
        return createSuggestion({
          roundId: round.id,
          suggestedBy: ctx.user.id,
          title: input.title,
          author: input.author,
          note: input.note,
        });
      }),
    // Admin controls: open a new round / close the current one.
    open: adminProcedure.mutation(async () => {
      return openSuggestionRound();
    }),
    close: adminProcedure.mutation(async () => {
      const round = await getActiveSuggestionRound();
      if (!round) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد جولة مفتوحة لإغلاقها" });
      return closeSuggestionRound(round.id);
    }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteSuggestion(input);
    }),
  }),

  // ── Curated book vote ("التصويت على الكتب") ────────────────────────────────
  bookVotes: router({
    active: publicProcedure.query(async () => {
      const poll = await getActivePoll();
      if (!poll) return null;
      const options = await getPollOptionsWithCounts(poll.id);
      return { poll, options };
    }),
    myBallots: protectedProcedure.query(async ({ ctx }) => {
      const poll = await getActivePoll();
      if (!poll) return [];
      const ballots = await getMyBallots(poll.id, ctx.user.id);
      return ballots.map((b) => b.optionId);
    }),
    vote: protectedProcedure
      .input(z.object({ optionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const poll = await getActivePoll();
        if (!poll) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد تصويت مفتوح حالياً" });
        return castVote(poll.id, input.optionId, ctx.user.id, poll.mode);
      }),
    // ── Admin management ──
    create: adminProcedure
      .input(z.object({ title: z.string().max(255).optional(), mode: z.enum(["single", "multiple"]) }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getActivePoll();
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يوجد تصويت مفتوح بالفعل، أغلقه أولاً" });
        }
        return createPoll({
          title: input.title || undefined,
          mode: input.mode,
          createdBy: ctx.user.id,
        });
      }),
    addOption: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          author: z.string().max(255).optional(),
          coverImageUrl: z.string().optional(),
          sourceSuggestionId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const poll = await getActivePoll();
        if (!poll) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد تصويت مفتوح لإضافة كتاب إليه" });
        return addPollOption({ ...input, pollId: poll.id });
      }),
    updateOption: adminProcedure
      .input(z.object({ id: z.number(), title: z.string().optional(), author: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updatePollOption(id, data);
      }),
    deleteOption: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deletePollOption(input);
    }),
    close: adminProcedure.mutation(async () => {
      const poll = await getActivePoll();
      if (!poll) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد تصويت مفتوح لإغلاقه" });
      return closePoll(poll.id);
    }),
  }),

  system: systemRouter,

  userActivities: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserActivities(ctx.user.id);
    }),
  }),

  userArticles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserArticles(ctx.user.id);
    }),
  }),

  userAchievements: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserAchievements(ctx.user.id);
    }),
  }),

  // Aggregated contributions for the Profile page.
  subscriptions: router({
    getUserContributions: protectedProcedure.query(async ({ ctx }) => {
      const [activities, articles, achievements] = await Promise.all([
        getUserActivities(ctx.user.id),
        getUserArticles(ctx.user.id),
        getUserAchievements(ctx.user.id),
      ]);
      return { activities, articles, achievements };
    }),
  }),

  attachments: router({
    // Only PDF attachments are accepted here (the client only ever sends
    // application/pdf — see AddActivity.tsx / EditActivity.tsx). Security
    // fix: the previous version trusted the client-supplied `mimeType` and
    // `filename` verbatim, so a caller could upload an arbitrary file type
    // (e.g. `.html`/`.svg` with an executable payload) and, depending on
    // how the storage provider serves it, have it rendered as active
    // content (stored XSS) rather than downloaded as a PDF. It also passed
    // the raw filename straight into the storage key, so a filename such as
    // `../../etc/passwd` reached the object key unsanitized.
    upload: protectedProcedure
      .input(
        z.object({
          filename: z.string().min(1).max(255),
          mimeType: z.literal("application/pdf"),
          base64Data: z.string().max(50 * 1024 * 1024),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.base64Data, "base64");
          // Verify the payload is actually a PDF (starts with %PDF-) —
          // never trust the client-declared mimeType alone.
          if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "الملف المرفوع ليس ملف PDF صالح",
            });
          }
          const safeName = input.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-200);
          const { storagePut } = await import("./storage.js");
          const { url, key } = await storagePut(
            `attachments/${Date.now()}-${safeName}`,
            buffer,
            "application/pdf"
          );
          return { url, key };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل تحميل الملف",
          });
        }
      }),
  }),

  // Image upload used by the Add* forms (accepts a data-URL in `base64`).
  upload: router({
    // Security fix: allow-list image mime types instead of trusting
    // whatever the browser reports. Without this, a caller could upload an
    // `image/svg+xml` file (SVG can embed <script>) or any other content
    // type and have it stored/served as if it were a safe raster image —
    // a stored-XSS vector if the object is later served inline.
    image: protectedProcedure
      .input(
        z.object({
          filename: z.string().min(1).max(255),
          base64: z.string().max(50 * 1024 * 1024),
        })
      )
      .mutation(async ({ input }) => {
        const ALLOWED_IMAGE_MIME_TYPES = new Set([
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ]);
        try {
          // `base64` from a FileReader.readAsDataURL(...) comes as
          //   data:<mime>;base64,<encoded>
          const match = /^data:([^;]+);base64,(.*)$/.exec(input.base64);
          const mimeType = match?.[1]?.toLowerCase();
          if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "نوع الصورة غير مسموح به",
            });
          }
          const encoded = match?.[2] ?? input.base64;
          const buffer = Buffer.from(encoded, "base64");
          // Never trust the declared mimeType alone — verify the actual
          // file signature (magic bytes) matches a real image of that
          // family, otherwise a spoofed `data:image/png;base64,...` header
          // wrapping arbitrary bytes (e.g. HTML/SVG/script) would sail
          // through untouched.
          if (!sniffImageMagicBytes(buffer, mimeType)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "محتوى الملف لا يطابق نوع الصورة المعلن",
            });
          }
          const { storagePut } = await import("./storage.js");
          const safeName = input.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-200);
          const { url, key } = await storagePut(
            `images/${Date.now()}-${safeName}`,
            buffer,
            mimeType
          );
          return { url, key };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[upload.image] failed", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل تحميل الصورة",
          });
        }
      }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      return getUsers();
    }),
    getById: adminProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return getUserById(input);
      }),
    updateRole: adminProcedure
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["user", "admin", "supervisor", "committee_head", "general_agent", "tech_admin"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const target = await getUserById(input.id);
        await assertCanChangeUserRole(ctx.user.role, target?.role, input.role);
        await updateUserRole(input.id, input.role, ctx.user.id);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "user.role_change",
          description: `قام ${ctx.user.name || "مستخدم"} بتغيير صلاحية ${target?.name || "عضو"} من "${target?.role || "-"}" إلى "${input.role}"`,
          entityType: "user",
          entityId: input.id,
          metadata: { previousRole: target?.role, newRole: input.role },
        });
        return { success: true };
      }),
    // The teams the logged-in member currently belongs to — used on their
    // own profile page.
    getMyTeams: protectedProcedure.query(async ({ ctx }) => {
      return getTeamsForUser(ctx.user.id);
    }),
    // The activities the logged-in member has registered/subscribed for —
    // used on their own profile page.
    getMyActivitySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      return getUserActivitySubscriptionsWithActivity(ctx.user.id);
    }),
  }),

  // ── Self-service profile edit requests ────────────────────────────────────
  // A member can propose changes to their own profile, but nothing is
  // written to `users` until an admin/general-agent approves the request
  // here. Rejections keep a reason so the member knows what to fix.
  profileEditRequests: router({
    list: adminProcedure.query(async () => {
      return getProfileEditRequests();
    }),
    listPending: adminProcedure.query(async () => {
      return getProfileEditRequests("pending");
    }),
    // The logged-in member's own latest request (pending or reviewed), so
    // the profile page can show "قيد المراجعة" or a rejection reason.
    getMine: protectedProcedure.query(async ({ ctx }) => {
      return getLatestProfileEditRequestForUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          changes: z.record(z.string(), z.union([z.string(), z.null()])),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Reject unknown/forbidden field names outright rather than silently
        // dropping them — the client should never be sending them, so this
        // catches bugs instead of masking them.
        const invalidFields = Object.keys(input.changes).filter(
          (key) => !(PROFILE_EDITABLE_FIELDS as readonly string[]).includes(key)
        );
        if (invalidFields.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `لا يمكن تعديل الحقول التالية: ${invalidFields.join(", ")}`,
          });
        }
        if (Object.keys(input.changes).length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لم يتم إجراء أي تعديل" });
        }
        if (
          input.changes.academicYear &&
          !["first", "second", "third", "fourth", "postgraduate"].includes(input.changes.academicYear)
        ) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "السنة الجامعية غير صحيحة" });
        }

        const existingPending = await getPendingProfileEditRequestForUser(ctx.user.id);
        if (existingPending) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "لديك طلب تعديل قيد المراجعة بالفعل، يرجى الانتظار حتى تتم مراجعته",
          });
        }

        const created = await createProfileEditRequest({
          userId: ctx.user.id,
          changes: JSON.stringify(input.changes),
        });

        try {
          const admins = await getAdminTierUsers();
          await notifyTeamInApp(
            admins.map((a) => a.id),
            {
              entityId: created.id,
              title: `طلب تعديل بيانات من : ${ctx.user.arabicFullName || ctx.user.name || "عضو"}`,
              body: "بانتظار مراجعتك للموافقة أو الرفض",
              url: "/admin/profile-edit-requests",
              type: "team_request",
            }
          );
        } catch (error) {
          console.error("[profileEditRequests] Failed to notify admins:", error);
        }

        return { success: true };
      }),
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const request = await getProfileEditRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });

        const result = await approveProfileEditRequest(input.id, ctx.user.id);

        try {
          await notifyTeamInApp([result.userId], {
            entityId: input.id,
            title: "تمت الموافقة على طلب تعديل بياناتك",
            body: null,
            url: "/profile",
            type: "team_request",
          });
        } catch (error) {
          console.error("[profileEditRequests] Failed to notify user of approval:", error);
        }

        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "profile_edit_request.approve",
          description: `قام ${ctx.user.name || "مستخدم"} بالموافقة على طلب تعديل بيانات عضو`,
          entityType: "profileEditRequest",
          entityId: input.id,
        });

        return { success: true };
      }),
    reject: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().min(1, "يرجى كتابة سبب الرفض") }))
      .mutation(async ({ input, ctx }) => {
        const request = await getProfileEditRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });

        const result = await rejectProfileEditRequest(input.id, input.reason, ctx.user.id);

        try {
          await notifyTeamInApp([result.userId], {
            entityId: input.id,
            title: "تم رفض طلب تعديل بياناتك",
            body: input.reason,
            url: "/profile",
            type: "team_request",
          });
        } catch (error) {
          console.error("[profileEditRequests] Failed to notify user of rejection:", error);
        }

        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "profile_edit_request.reject",
          description: `قام ${ctx.user.name || "مستخدم"} برفض طلب تعديل بيانات عضو (السبب: ${input.reason})`,
          entityType: "profileEditRequest",
          entityId: input.id,
        });

        return { success: true };
      }),
  }),

  // ── New-member approval workflow ──────────────────────────────────────────
  // Every brand-new account starts as approvalStatus="pending" (see
  // db.upsertUser) and is blocked from the rest of the site by
  // OnboardingGuard until an admin approves them here.
  memberApprovals: router({
    listPending: adminProcedure.query(async () => {
      return getPendingUsers();
    }),
    approve: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        await approveUser(input, ctx.user.id);
        return { success: true };
      }),
    reject: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        await rejectUser(input, ctx.user.id);
        return { success: true };
      }),
  }),

  teams: router({
    // Exposed to any authenticated user so that the OnboardingForm can
    // populate the "preferred team" dropdown. Team rows only contain
    // name/description (no secrets) and admins still gate membership.
    list: protectedProcedure.query(async () => {
      return getTeams();
    }),
    // Powers the "الفرق" page: every visible team, plus any invisible team
    // the current user actually belongs to (or all of them, if admin-tier —
    // admins are implicit members of every team). Includes light metadata
    // so the page can render membership state without extra round-trips.
    listForCurrentUser: protectedProcedure.query(async ({ ctx }) => {
      const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
      const allTeams = await getTeams();
      const myPendingJoinRequests = await getTeamJoinRequestsByUser(ctx.user.id, "pending");
      const pendingTeamIds = new Set(myPendingJoinRequests.map((r) => r.teamId));

      const result = [];
      for (const team of allTeams) {
        const isMember = await isTeamMemberOrAdmin(team.id, ctx.user.id, ctx.user.role);
        if (!team.isVisible && !isMember && !isAdminTier) continue; // hidden from outsiders
        const roster = await getTeamRosterNamesOnly(team.id);
        result.push({
          ...team,
          isMember,
          isHead: team.headId === ctx.user.id,
          memberCount: roster.length,
          hasPendingJoinRequest: pendingTeamIds.has(team.id),
        });
      }
      return result;
    }),
    getOne: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        const team = await getTeamById(input);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const isMember = await isTeamMemberOrAdmin(input, ctx.user.id, ctx.user.role);
        if (!team.isVisible && !isMember && !isAdminTier) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return { ...team, isMember, isHead: team.headId === ctx.user.id };
      }),
    listByHead: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "committee_head") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getTeamsByHead(ctx.user.id);
    }),
    // Admin-only enriched list for the "إدارة الفرق" dashboard: supervisor
    // name + member/pending-request counts, so admins don't need extra
    // round-trips to render the management table.
    listAdmin: adminProcedure.query(async () => {
      return getTeamsForAdmin();
    }),
    // Powers the "add member" picker for both admins and a team's own
    // supervisor — searches approved accounts by name, excluding whoever is
    // already on the team, without exposing the full user directory.
    searchAddableUsers: protectedProcedure
      .input(z.object({ teamId: z.number(), query: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const roster = await getTeamRosterNamesOnly(input.teamId);
        return searchApprovedUsersByName(input.query ?? "", roster.map((m) => m.id));
      }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          // Assign the team's supervisor by their permanent reference
          // number (e.g. "260001") rather than an internal id.
          headReferenceNumber: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Devin Review fix: admins also need to create teams from the
        // RegistrationSettings page. Previously restricted to committee_head
        // only, which made the admin UI silently fail with FORBIDDEN.
        if (
          ctx.user?.role !== "committee_head" &&
          ctx.user?.role !== "admin" &&
          ctx.user?.role !== "general_agent" &&
          ctx.user?.role !== "tech_admin"
        ) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        let headId = ctx.user.id;
        if (isAdminTier && input.headReferenceNumber) {
          const targetUser = await getUserByReferenceNumber(input.headReferenceNumber);
          if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "لا يوجد عضو بهذا الرقم المرجعي" });
          headId = targetUser.id;
          if (targetUser.role !== "admin" && targetUser.role !== "general_agent" && targetUser.role !== "tech_admin") {
            await updateUserProfile(targetUser.id, { role: "committee_head" }, ctx.user.id);
          }
        }
        return createTeam({
          name: input.name,
          description: input.description,
          headId,
          isVisible: false,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // IDOR fix: a committee_head could previously update ANY team by id,
        // not just the team they lead. Admins/general_agent are exempt.
        if (ctx.user.role === "committee_head") {
          const team = await getTeamById(input.id);
          if (!team || team.headId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return updateTeam(input.id, {
          name: input.name,
          description: input.description,
        });
      }),
    delete: adminProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        return deleteTeam(input);
      }),
    // Admin-only: grants/revokes a team's supervisor the "freedom" to manage
    // their team (members, visibility, chat) without going through the
    // approval-request workflow below.
    // Admin-only: assign or change a team's supervisor. Automatically
    // upgrades the target user's role to "committee_head" (مشرف فريق) so
    // their dashboard access unlocks — unless they're already admin-tier.
    setHead: adminProcedure
      .input(z.object({ teamId: z.number(), referenceNumber: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        const targetUser = await getUserByReferenceNumber(input.referenceNumber);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "لا يوجد عضو بهذا الرقم المرجعي" });
        if (targetUser.role !== "admin" && targetUser.role !== "general_agent" && targetUser.role !== "tech_admin") {
          await updateUserProfile(targetUser.id, { role: "committee_head" }, ctx.user.id);
        }
        return updateTeam(input.teamId, { headId: targetUser.id });
      }),
    setHeadFreedom: adminProcedure
      .input(z.object({ id: z.number(), headFreedom: z.boolean() }))
      .mutation(async ({ input }) => {
        return updateTeam(input.id, { headFreedom: input.headFreedom });
      }),
    // Full member profiles — only for this team's supervisor or admin-tier.
    getMembersFull: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (ctx.user.role === "committee_head") {
          const team = await getTeamById(input);
          if (!team || team.headId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return getTeamRosterFull(input);
      }),
    // Names-only roster — any team member (or admin) can see who else is in
    // the team, but not their contact/profile details.
    getRoster: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        const isMember = await isTeamMemberOrAdmin(input, ctx.user.id, ctx.user.role);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });
        return getTeamRosterNamesOnly(input);
      }),
    // Kept for backwards compatibility with any existing callers.
    getMembers: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (ctx.user.role === "committee_head") {
          const team = await getTeamById(input);
          if (!team || team.headId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return getTeamMembers2ByTeam(input);
      }),
    // Any authenticated member can ask to join a visible team they're not
    // already part of — reuses the existing teamJoinRequests flow (see below).
    // Adding a member is done by the person's permanent reference number
    // (e.g. "260001") rather than an internal id, since that's the
    // identifier team supervisors actually have on hand for a member.
    addMember: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          referenceNumber: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        // IDOR fix: a committee_head could previously add members to ANY
        // team, not just their own.
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const targetUser = await getUserByReferenceNumber(input.referenceNumber);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "لا يوجد عضو بهذا الرقم المرجعي" });
        }
        const existingRoster = await getTeamRosterNamesOnly(input.teamId);
        if (existingRoster.some((m) => m.id === targetUser.id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "هذا العضو موجود بالفعل في الفريق" });
        }
        if (isAdminTier || team.headFreedom) {
          await createTeamMember2({ teamId: input.teamId, userId: targetUser.id });
          return { pending: false };
        }
        // No freedom granted: queue for admin approval instead of acting now.
        const request = await createTeamActionRequest({
          teamId: input.teamId,
          requestedBy: ctx.user.id,
          actionType: "add_member",
          payload: JSON.stringify({ userId: targetUser.id }),
        });
        const admins = await getAdminTierUsers();
        await notifyTeamInApp(
          admins.map((a) => a.id),
          {
            entityId: input.teamId,
            title: `طلب إضافة عضو إلى فريق "${team.name}"`,
            body: "بانتظار موافقتك",
            url: `/admin/team/${input.teamId}`,
            type: "team_request",
          }
        );
        return { pending: true, request };
      }),
    removeMember: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        // IDOR fix: a committee_head could previously remove ANY team
        // member row by id, even from a team they don't lead. Since
        // removeMember only takes the membership row id, we must resolve
        // the owning team first to check headship.
        const membership = await getTeamMember2ById(input);
        if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
        const team = await getTeamById(membership.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (isAdminTier || team.headFreedom) {
          await deleteTeamMember2(input);
          return { pending: false };
        }
        const request = await createTeamActionRequest({
          teamId: team.id,
          requestedBy: ctx.user.id,
          actionType: "remove_member",
          payload: JSON.stringify({ userId: membership.userId }),
        });
        const admins = await getAdminTierUsers();
        await notifyTeamInApp(
          admins.map((a) => a.id),
          {
            entityId: team.id,
            title: `طلب إخراج عضو من فريق "${team.name}"`,
            body: "بانتظار موافقتك",
            url: `/admin/team/${team.id}`,
            type: "team_request",
          }
        );
        return { pending: true, request };
      }),
    // Toggle whether the team shows up to non-members ("الفرق" page).
    setVisibility: protectedProcedure
      .input(z.object({ teamId: z.number(), value: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (isAdminTier || team.headFreedom) {
          await updateTeam(input.teamId, { isVisible: input.value });
          return { pending: false };
        }
        const request = await createTeamActionRequest({
          teamId: input.teamId,
          requestedBy: ctx.user.id,
          actionType: "set_visibility",
          payload: JSON.stringify({ value: input.value }),
        });
        const admins = await getAdminTierUsers();
        await notifyTeamInApp(
          admins.map((a) => a.id),
          {
            entityId: input.teamId,
            title: `طلب ${input.value ? "إظهار" : "إخفاء"} فريق "${team.name}"`,
            body: "بانتظار موافقتك",
            url: `/admin/team/${input.teamId}`,
            type: "team_request",
          }
        );
        return { pending: true, request };
      }),
    // Open/close the team chat — per the requirement, either the team's
    // supervisor or an admin may do this (chat toggling still follows the
    // same approval workflow as everything else unless freedom is granted).
    setChatOpen: protectedProcedure
      .input(z.object({ teamId: z.number(), value: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (isAdminTier || team.headFreedom) {
          await updateTeam(input.teamId, { isChatOpen: input.value });
          return { pending: false };
        }
        const request = await createTeamActionRequest({
          teamId: input.teamId,
          requestedBy: ctx.user.id,
          actionType: "set_chat_open",
          payload: JSON.stringify({ value: input.value }),
        });
        const admins = await getAdminTierUsers();
        await notifyTeamInApp(
          admins.map((a) => a.id),
          {
            entityId: input.teamId,
            title: `طلب ${input.value ? "فتح" : "إغلاق"} دردشة فريق "${team.name}"`,
            body: "بانتظار موافقتك",
            url: `/admin/team/${input.teamId}`,
            type: "team_request",
          }
        );
        return { pending: true, request };
      }),

    // ── Invite links ────────────────────────────────────────────────────
    // A shareable link for the team, generated by its supervisor or an
    // admin. Anyone who opens it (while logged in) can request to join —
    // the request still goes through the normal approval flow, the link
    // just saves them from finding the team themselves. Limited by an
    // optional expiry time and/or an optional max number of uses.
    createInviteLink: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          expiresAt: z.string().datetime().optional(),
          maxUses: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const token = crypto.randomBytes(16).toString("hex");
        return createTeamInviteLink({
          teamId: input.teamId,
          token,
          createdBy: ctx.user.id,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          maxUses: input.maxUses,
        });
      }),
    listInviteLinks: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const links = await getTeamInviteLinksByTeam(input);
        return links.map((link) => ({ ...link, isUsable: isInviteLinkUsable(link) }));
      }),
    revokeInviteLink: protectedProcedure
      .input(z.object({ teamId: z.number(), linkId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "committee_head" && ctx.user?.role !== "admin" && ctx.user?.role !== "general_agent" && ctx.user?.role !== "tech_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminTier && team.headId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await revokeTeamInviteLink(input.linkId);
        return { success: true };
      }),
    // Looks up an invite token and returns basic team info so the client
    // can show "you're invited to join <team>" before the user commits.
    previewInvite: protectedProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const link = await getTeamInviteLinkByToken(input.token);
        if (!link || !isInviteLinkUsable(link)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "رابط الدعوة غير صالح أو منتهي" });
        }
        const team = await getTeamById(link.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        return { teamId: team.id, teamName: team.name, description: team.description };
      }),
    // Redeeming an invite link never adds someone directly — it creates a
    // normal (pending) join request, exactly like requesting to join from
    // the "الفرق" page, so every invited member is still reviewed and
    // accepted the same way.
    acceptInvite: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const link = await getTeamInviteLinkByToken(input.token);
        if (!link || !isInviteLinkUsable(link)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "رابط الدعوة غير صالح أو منتهي" });
        }
        const team = await getTeamById(link.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });

        const alreadyMember = await isTeamMemberOrAdmin(link.teamId, ctx.user.id, ctx.user.role);
        if (alreadyMember) {
          throw new TRPCError({ code: "CONFLICT", message: "أنت عضو بالفعل في هذا الفريق" });
        }
        const existingRequest = await getPendingTeamJoinRequestForUser(link.teamId, ctx.user.id);
        if (existingRequest) {
          throw new TRPCError({ code: "CONFLICT", message: "طلب موجود بالفعل" });
        }

        const result = await createTeamJoinRequest({ teamId: link.teamId, userId: ctx.user.id });
        await incrementTeamInviteLinkUsage(link.id);

        const admins = await getAdminTierUsers();
        const recipientIds = new Set(admins.map((a) => a.id));
        if (team.headFreedom) recipientIds.add(team.headId);
        await notifyTeamInApp([...recipientIds], {
          entityId: link.teamId,
          title: `طلب انضمام عبر رابط دعوة لفريق "${team.name}"`,
          body: `${ctx.user.name} يرغب بالانضمام إلى الفريق`,
          url: team.headFreedom && recipientIds.has(ctx.user.id) ? `/admin/my-team` : `/admin/team/${link.teamId}`,
          type: "team_request",
        });

        return { pending: true, teamId: team.id, teamName: team.name, request: result };
      }),
  }),


  registrationRequests: router({
    list: adminProcedure.query(async () => {
      return getRegistrationRequests();
    }),
    listPending: adminProcedure.query(async () => {
      return getRegistrationRequests("pending");
    }),
    getById: adminProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return getRegistrationRequestById(input);
      }),
    // NOTE: A public `getByEmail` endpoint was considered here so the
    // `/pending-approval` page could render live status without requiring a
    // session. We removed it — an unauthenticated `{ email → status }`
    // lookup enables registration-email enumeration (an attacker can probe
    // arbitrary emails to learn who has applied). The `/pending-approval`
    // page currently renders a static info message, which is sufficient.
    // If live status is needed later, scope it to an authenticated user
    // checking their own email via `ctx.user`. See Devin Review finding on
    // PR #9.
    approve: adminProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const request = await getRegistrationRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // approveRegistrationRequest already creates the user and deletes the request
        await approveRegistrationRequest(input.id, ctx.user.id);

        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "registration_request.approve",
          description: `قام ${ctx.user.name || "مستخدم"} بالموافقة على طلب تسجيل عضوية لـ ${request.email ?? request.name ?? "عضو جديد"}`,
          entityType: "registrationRequest",
          entityId: input.id,
        });

        return { success: true };
      }),
    reject: adminProcedure
      .input(
        z.object({
          id: z.number(),
          reason: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const request = await getRegistrationRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const result = await rejectRegistrationRequest(input.id, input.reason, ctx.user.id);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "registration_request.reject",
          description: `قام ${ctx.user.name || "مستخدم"} برفض طلب تسجيل عضوية لـ ${request.email ?? request.name ?? "عضو جديد"} (السبب: ${input.reason})`,
          entityType: "registrationRequest",
          entityId: input.id,
        });
        return result;
      }),
    delete: adminProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        return deleteRegistrationRequest(input);
      }),
  }),

  teamJoinRequests: router({
    list: adminProcedure.query(async () => {
      return getTeamJoinRequests();
    }),
    listPending: adminProcedure.query(async () => {
      return getTeamJoinRequests("pending");
    }),
    getByTeam: protectedProcedure
      .input(z.object({ teamId: z.number(), status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        if (!isAdminTier) {
          const team = await getTeamById(input.teamId);
          if (!team || team.headId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        const requests = await getTeamJoinRequestsByTeam(input.teamId, input.status);
        const withNames = await Promise.all(
          requests.map(async (r) => {
            const requester = await getUserById(r.userId);
            return { ...r, userName: requester?.name ?? `مستخدم #${r.userId}` };
          })
        );
        return withNames;
      }),
    getByUser: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return getTeamJoinRequestsByUser(ctx.user.id, input.status);
      }),
    create: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });

        const alreadyMember = await isTeamMemberOrAdmin(input.teamId, ctx.user.id, ctx.user.role);
        if (alreadyMember) {
          throw new TRPCError({ code: "CONFLICT", message: "أنت عضو بالفعل في هذا الفريق" });
        }

        // Block duplicate pending requests for the same (team, user) pair.
        // The previous implementation called getTeamJoinRequestById(input.teamId)
        // which looked up by primary key id, accidentally coupling unrelated
        // requests that happened to share a numeric id.
        const existingRequest = await getPendingTeamJoinRequestForUser(
          input.teamId,
          ctx.user.id
        );
        if (existingRequest) {
          throw new TRPCError({ code: "CONFLICT", message: "طلب موجود بالفعل" });
        }

        const result = await createTeamJoinRequest({
          teamId: input.teamId,
          userId: ctx.user.id,
        });

        // Notify whoever can approve: the team's supervisor when they have
        // freedom, admins otherwise (and always admins, so nothing slips
        // through if freedom gets revoked later).
        const admins = await getAdminTierUsers();
        const recipientIds = new Set(admins.map((a) => a.id));
        if (team.headFreedom) recipientIds.add(team.headId);
        await notifyTeamInApp([...recipientIds], {
          entityId: input.teamId,
          title: `طلب انضمام جديد لفريق "${team.name}"`,
          body: `${ctx.user.name} يرغب بالانضمام إلى الفريق`,
          url: team.headFreedom && recipientIds.has(ctx.user.id) ? `/admin/my-team` : `/admin/team/${input.teamId}`,
          type: "team_request",
        });

        return result;
      }),
    approve: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const request = await getTeamJoinRequestById(input);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        if (!isAdminTier) {
          const team = await getTeamById(request.teamId);
          if (!team || team.headId !== ctx.user.id || !team.headFreedom) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }

        await approveTeamJoinRequest(input, ctx.user.id);
        await notifyTeamInApp([request.userId], {
          entityId: request.teamId,
          title: "تمت الموافقة على طلب انضمامك للفريق",
          url: `/teams/${request.teamId}`,
          type: "team_request",
        });
        recordWorkLog({
          scope: ctx.user.role === "user" ? "member" : "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "team_join_request.approve",
          description: `قام ${ctx.user.name || "مستخدم"} بالموافقة على طلب انضمام عضو للفريق`,
          entityType: "teamJoinRequest",
          entityId: input,
        });
        return { success: true };
      }),
    reject: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          reason: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const request = await getTeamJoinRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        if (!isAdminTier) {
          const team = await getTeamById(request.teamId);
          if (!team || team.headId !== ctx.user.id || !team.headFreedom) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }

        const result = await rejectTeamJoinRequest(input.id, input.reason, ctx.user.id);
        await notifyTeamInApp([request.userId], {
          entityId: request.teamId,
          title: "تم رفض طلب انضمامك للفريق",
          body: input.reason,
          url: `/teams`,
          type: "team_request",
        });
        recordWorkLog({
          scope: ctx.user.role === "user" ? "member" : "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "team_join_request.reject",
          description: `قام ${ctx.user.name || "مستخدم"} برفض طلب انضمام عضو للفريق (السبب: ${input.reason})`,
          entityType: "teamJoinRequest",
          entityId: input.id,
        });
        return result;
      }),
  }),

  // Approve/reject queue for supervisor ("مشرف فريق") management actions
  // that don't have `headFreedom` — see teamActionRequests table docs.
  teamActionRequests: router({
    list: adminProcedure.query(async () => {
      return getTeamActionRequests();
    }),
    listPending: adminProcedure.query(async () => {
      return getTeamActionRequests("pending");
    }),
    getByTeam: protectedProcedure
      .input(z.object({ teamId: z.number(), status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        if (!isAdminTier) {
          const team = await getTeamById(input.teamId);
          if (!team || team.headId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return getTeamActionRequestsByTeam(input.teamId, input.status);
      }),
    approve: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const request = await getTeamActionRequestById(input);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        await approveTeamActionRequest(input, ctx.user.id);
        const team = await getTeamById(request.teamId);
        await notifyTeamInApp([request.requestedBy], {
          entityId: request.teamId,
          title: `تمت الموافقة على طلبك بخصوص فريق "${team?.name ?? ""}"`,
          url: `/admin/my-team`,
          type: "team_request",
        });
        return { success: true };
      }),
    reject: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const request = await getTeamActionRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        await rejectTeamActionRequest(input.id, input.reason ?? "", ctx.user.id);
        const team = await getTeamById(request.teamId);
        await notifyTeamInApp([request.requestedBy], {
          entityId: request.teamId,
          title: `تم رفض طلبك بخصوص فريق "${team?.name ?? ""}"`,
          body: input.reason,
          url: `/admin/my-team`,
          type: "team_request",
        });
        return { success: true };
      }),
  }),

  // Ephemeral team chat — messages are relayed via short in-memory polling
  // and are never written to the database; each client persists its own
  // copy to localStorage. See server/services/teamChat.ts.
  teamChat: router({
    getMessages: protectedProcedure
      .input(z.object({ teamId: z.number(), afterId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const isMember = await isTeamMemberOrAdmin(input.teamId, ctx.user.id, ctx.user.role);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        const messages =
          input.afterId != null
            ? getTeamMessagesSince(input.teamId, input.afterId)
            : getAllTeamMessages(input.teamId);
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const canPostWhenClosed = isAdminTier || team.headId === ctx.user.id;
        return { messages, isChatOpen: team.isChatOpen, canPostWhenClosed };
      }),
    send: protectedProcedure
      .input(z.object({ teamId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const isMember = await isTeamMemberOrAdmin(input.teamId, ctx.user.id, ctx.user.role);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const isHeadOrAdmin = isAdminTier || team.headId === ctx.user.id;
        // Once a team is closed, only its supervisor and admins/general
        // agents may still post — everyone else is read-only.
        if (!team.isChatOpen && !isHeadOrAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "الدردشة مغلقة حالياً — يمكن لمشرف الفريق والمسؤولين فقط الكتابة" });
        }
        // Plain text only (links are just text that renders as clickable on
        // the client) — no attachments/HTML of any kind.
        const content = input.content.trim();
        if (!content) throw new TRPCError({ code: "BAD_REQUEST" });

        const message = appendTeamMessage(input.teamId, ctx.user.id, ctx.user.name, content);

        const roster = await getTeamRosterNamesOnly(input.teamId);
        const recipients = roster.map((m) => m.id).filter((id) => id !== ctx.user.id);
        await notifyTeamInApp(recipients, {
          entityId: input.teamId,
          title: `رسالة جديدة في دردشة فريق "${team.name}"`,
          body: `${ctx.user.name}: ${content.slice(0, 80)}`,
          url: `/teams/${input.teamId}`,
          type: "team_chat",
        });

        return message;
      }),
    // Edit a message's text — only the original sender, and only within 6
    // hours of sending it. After that window, no action can be performed.
    edit: protectedProcedure
      .input(z.object({ teamId: z.number(), messageId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const isMember = await isTeamMemberOrAdmin(input.teamId, ctx.user.id, ctx.user.role);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });
        const content = input.content.trim();
        if (!content) throw new TRPCError({ code: "BAD_REQUEST" });

        const result = editTeamMessage(input.teamId, input.messageId, ctx.user.id, content);
        if ("error" in result) {
          const messages: Record<string, string> = {
            NOT_FOUND: "الرسالة غير موجودة",
            NOT_OWNER: "لا يمكنك تعديل رسالة عضو آخر",
            LOCKED: "لم يعد بإمكانك تعديل هذه الرسالة بعد مرور 6 ساعات على إرسالها",
            DELETED: "لا يمكن تعديل رسالة محذوفة",
          };
          throw new TRPCError({ code: "FORBIDDEN", message: messages[result.error] });
        }
        return result.message;
      }),
    // Delete a message. The sender may delete their own message within 6
    // hours; the team's supervisor or an admin/general_agent may delete any
    // message at any time as moderation.
    delete: protectedProcedure
      .input(z.object({ teamId: z.number(), messageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isMember = await isTeamMemberOrAdmin(input.teamId, ctx.user.id, ctx.user.role);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });
        const team = await getTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND" });
        const isAdminTier = ctx.user.role === "admin" || ctx.user.role === "general_agent" || ctx.user.role === "tech_admin";
        const isModerator = isAdminTier || team.headId === ctx.user.id;

        const result = deleteTeamMessage(input.teamId, input.messageId, ctx.user.id, isModerator);
        if ("error" in result) {
          const messages: Record<string, string> = {
            NOT_FOUND: "الرسالة غير موجودة",
            NOT_OWNER: "لا يمكنك حذف رسالة عضو آخر",
            LOCKED: "لم يعد بإمكانك حذف هذه الرسالة بعد مرور 6 ساعات على إرسالها",
            DELETED: "الرسالة محذوفة بالفعل",
          };
          throw new TRPCError({ code: "FORBIDDEN", message: messages[result.error] });
        }
        return result.message;
      }),
  }),

  notifications: router({
    // Fetch the latest notifications for the signed-in user.
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ input, ctx }) => {
        return getUserNotifications(ctx.user.id, input?.limit ?? 50);
      }),
    // Cheap "unread count" used to render the bell badge.
    countUnread: protectedProcedure.query(async ({ ctx }) => {
      return countUnreadNotifications(ctx.user.id);
    }),
    // Mark a single notification as read. The db function scopes the update
    // to `(id, userId)` so a user cannot read another user's notifications.
    markRead: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        await markNotificationRead(ctx.user.id, input);
        return { success: true };
      }),
    // Mark everything as read — triggered from the bell dropdown's
    // "تحديد الكل كمقروء" action.
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  basir: router({
    getSettings: publicProcedure.query(async () => {
      return getAiSettings();
    }),
    updateSettings: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return updateAiEnabled(input.enabled);
      }),
    // Lets the client show "X/30 اليوم" and disable the composer proactively,
    // instead of only finding out after a failed send.
    getUsage: protectedProcedure.query(async ({ ctx }) => {
      const used = await getBasirUsageToday(ctx.user.id);
      const limit = getBasirDailyLimit(ctx.user.role);
      return { used, limit, remaining: Math.max(0, limit - used) };
    }),
    // Admin-only: per-member breakdown of Basir usage (today's count vs.
    // their daily quota, plus all-time total) for the "استهلاك الأعضاء" card.
    getUsageStats: adminProcedure.query(async () => {
      return getBasirUsageStats();
    }),
    chat: protectedProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(10000),
            }),
          ).max(50),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const settings = await getAiSettings();
        if (!settings.enabled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "المساعد الذكي بصير غير مفعّل حالياً",
          });
        }

        // Daily quota: 30 prompts/day for members, 60 (two shares) for
        // admin-tier accounts — the club's shared 300/day admin allotment.
        const limit = getBasirDailyLimit(ctx.user.role);
        const usedSoFar = await getBasirUsageToday(ctx.user.id);
        if (usedSoFar >= limit) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `لقد استهلكت حصتك اليومية من الأسئلة (${limit} سؤال). ستتجدد حصتك غداً.`,
          });
        }

        const response = await chatWithBasir(input.messages);
        const newCount = await incrementBasirUsage(ctx.user.id);
        const lastUserMessage = [...input.messages].reverse().find(m => m.role === "user");
        recordWorkLog({
          scope: "member",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "basir.chat",
          description: `قام ${ctx.user.name || "مستخدم"} بمحادثة المساعد الذكي بصير`,
          entityType: "user",
          entityId: ctx.user.id,
          metadata: lastUserMessage ? { lastMessagePreview: lastUserMessage.content.slice(0, 200) } : undefined,
        });
        return { response, usage: { used: newCount, limit, remaining: Math.max(0, limit - newCount) } };
      }),
    listPdfs: adminProcedure.query(async () => {
      return getAiPdfFiles();
    }),
    uploadPdf: adminProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(255),
          base64Data: z.string().max(50 * 1024 * 1024),
          fileSize: z.number().max(50 * 1024 * 1024).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const match = /^data:([^;]+);base64,(.*)$/.exec(input.base64Data);
          const mimeType = match?.[1] ?? "application/pdf";
          const encoded = match?.[2] ?? input.base64Data;
          const buffer = Buffer.from(encoded, "base64");
          const { storagePut } = await import("./storage.js");
          const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
          const { url, key } = await storagePut(
            `basir-pdfs/${Date.now()}-${safeName}`,
            buffer,
            mimeType,
          );
          return createAiPdfFile({
            fileName: input.fileName,
            fileUrl: url,
            fileKey: key,
            fileSize: input.fileSize ?? buffer.length,
            uploadedBy: ctx.user.id,
          });
        } catch (error) {
          console.error("[basir.uploadPdf] failed", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل رفع الملف",
          });
        }
      }),
    deletePdf: adminProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        return deleteAiPdfFile(input);
      }),
  }),

  onboarding: router({
    complete: protectedProcedure
      .input(
        z.object({
          arabicFullName: z.string().min(1, "الاسم الثلاثي مطلوب"),
          universityId: z.string().min(1, "الرقم الجامعي مطلوب"),
          academicYear: z.enum(["first", "second", "third", "fourth", "postgraduate"]),
          college: z.string().min(1, "الكلية مطلوبة"),
          specialization: z.string().min(1, "التخصص مطلوب"),
          department: z.string().optional(),
          email: z.string().email().optional(),
          phoneNumber: z.string().min(1, "رقم الهاتف مطلوب"),
          whatsapp: z.string().optional(),
          culturalExperience: z.string().optional(),
          skills: z.array(z.string()).optional(),
          preferredTeamId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        if (ctx.user.onboardingCompleted) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "تم إكمال التسجيل مسبقاً ولا يمكن إعادة تعبئته",
          });
        }

        if (input.preferredTeamId) {
          await createTeamJoinRequest({
            teamId: input.preferredTeamId,
            userId: ctx.user.id,
          });
        }

        await updateUserOnboarding(ctx.user.id, {
          arabicFullName: input.arabicFullName,
          academicYear: input.academicYear,
          college: input.college,
          department: input.department || input.specialization,
          phoneNumber: input.phoneNumber,
          skills: input.skills || [],
          preferredTeamId: input.preferredTeamId || null,
          onboardingCompleted: true,
        });

        // Save extra fields
        await updateUserProfile(ctx.user.id, {
          universityId: input.universityId,
          specialization: input.specialization,
          whatsapp: input.whatsapp,
          culturalExperience: input.culturalExperience,
        });

        return { success: true };
      }),
  }),

  workTeams: router({
    list: publicProcedure.query(async () => {
      return getWorkTeams();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getWorkTeamById(input);
    }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          mission: z.string().max(2000).optional(),
          imageUrl: z.string().max(500).optional(),
          imageKey: z.string().max(255).optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createWorkTeam(input);
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          mission: z.string().max(2000).optional(),
          imageUrl: z.string().max(500).optional(),
          imageKey: z.string().max(255).optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateWorkTeam(id, data);
      }),
    delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteWorkTeam(input);
    }),
    getMembers: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getWorkTeamMembers(input);
    }),
    addMember: adminProcedure
      .input(
        z.object({
          teamId: z.number(),
          name: z.string().min(1).max(255),
          position: z.string().min(1).max(255),
          bio: z.string().max(2000).optional(),
          imageUrl: z.string().max(500).optional(),
          imageKey: z.string().max(255).optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createWorkTeamMember(input);
      }),
    updateMember: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          position: z.string().min(1).max(255).optional(),
          bio: z.string().max(2000).optional(),
          imageUrl: z.string().max(500).optional(),
          imageKey: z.string().max(255).optional(),
          order: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateWorkTeamMember(id, data);
      }),
    removeMember: adminProcedure.input(z.number()).mutation(async ({ input }) => {
      return deleteWorkTeamMember(input);
    }),
  }),

  // ── Activity registrations (member + guest) ──────────────────────────────
  activityRegistrations: router({
    registerGuest: publicProcedure
      .input(
        z.object({
          activityId: z.number(),
          fullName: z.string().min(2).max(255),
          universityEmail: z.string().email().max(320),
          universityId: z.string().min(1).max(50),
          college: z.string().max(255).optional(),
          specialization: z.string().max(255).optional(),
          academicYear: z.string().max(50).optional(),
          phoneNumber: z.string().min(7).max(30),
          whatsapp: z.string().max(30).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await createGuestActivityRegistration(input);
        recordWorkLog({
          scope: "member",
          actor: null,
          action: "activity.register_guest",
          description: `قام الضيف "${input.fullName}" بالتسجيل في نشاط (غير عضو)`,
          entityType: "activity",
          entityId: input.activityId,
          metadata: { universityEmail: input.universityEmail },
        });
        return result;
      }),

    getForActivity: adminProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const [members, guests] = await Promise.all([
          getActivitySubscribersWithUsers(input),
          getGuestRegistrationsByActivity(input),
        ]);
        return { members, guests };
      }),

    approveSubscription: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const result = await approveActivitySubscription(input);
        if (result.subscription) {
          try {
            const activity = await getActivityById(result.subscription.activityId);
            if (activity) {
              await notifyActivityApproval(result.subscription.userId, activity.title, activity.id);
            }
          } catch (err) {
            console.warn("[activitySubscriptions.approveSubscription] notifyActivityApproval failed:", err);
          }
        }
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity_subscription.approve",
          description: `قام ${ctx.user.name || "مستخدم"} بقبول طلب تسجيل عضو في نشاط`,
          entityType: "activitySubscription",
          entityId: input,
        });
        return result;
      }),

    rejectSubscription: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const result = await rejectActivitySubscription(input);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity_subscription.reject",
          description: `قام ${ctx.user.name || "مستخدم"} برفض طلب تسجيل عضو في نشاط`,
          entityType: "activitySubscription",
          entityId: input,
        });
        return result;
      }),

    approveGuest: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const result = await approveGuestRegistration(input);
        if (result.registration) {
          try {
            const activity = await getActivityById(result.registration.activityId);
            if (activity) {
              await notifyGuestActivityApproval(
                result.registration.fullName,
                result.registration.universityEmail,
                activity.title,
                activity.id
              );
            }
          } catch (err) {
            console.warn("[activitySubscriptions.approveGuest] notifyGuestActivityApproval failed:", err);
          }
        }
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity_guest.approve",
          description: `قام ${ctx.user.name || "مستخدم"} بقبول طلب تسجيل ضيف في نشاط`,
          entityType: "guestActivityRegistration",
          entityId: input,
        });
        return result;
      }),

    rejectGuest: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const result = await rejectGuestRegistration(input);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "activity_guest.reject",
          description: `قام ${ctx.user.name || "مستخدم"} برفض طلب تسجيل ضيف في نشاط`,
          entityType: "guestActivityRegistration",
          entityId: input,
        });
        return result;
      }),
  }),

  // ── Registration settings ─────────────────────────────────────────────────
  registrationSettings: router({
    get: publicProcedure.query(async () => {
      return getRegistrationSettings();
    }),
    update: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return updateRegistrationEnabled(input.enabled);
      }),
  }),

  // ── Admin user management ─────────────────────────────────────────────────
  adminUsers: router({
    list: adminProcedure.query(async () => {
      return getUsers();
    }),
    delete: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const target = await getUserById(input);
        // Only another tech_admin may delete a tech_admin's account — this
        // sits above the general_agent protection below since tech_admin is
        // the highest tier.
        if (target?.role === "tech_admin" && ctx.user.role !== "tech_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا يمكن حذف حساب المدير التقني",
          });
        }
        if (input === ctx.user.id && target?.role === "tech_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا يمكن للمدير التقني حذف حسابه الخاص",
          });
        }
        // A plain admin cannot delete a general agent's account; only
        // another general agent may.
        if (target?.role === "general_agent" && ctx.user.role !== "general_agent" && ctx.user.role !== "tech_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا يمكن للمسؤول حذف حساب الوكيل العام",
          });
        }
        if (input === ctx.user.id && target?.role === "general_agent") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا يمكن للوكيل العام حذف حسابه الخاص",
          });
        }
        if (target?.role === "general_agent") {
          const currentCount = await countGeneralAgentUsers();
          if (currentCount <= MIN_GENERAL_AGENTS) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `يجب أن يبقى وكيل عام واحد على الأقل (الحد الأدنى ${MIN_GENERAL_AGENTS})`,
            });
          }
        }
        const result = await deleteUser(input);
        recordWorkLog({
          scope: "elevated",
          actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
          action: "user.delete",
          description: `قام ${ctx.user.name || "مستخدم"} بحذف حساب ${target?.name || "عضو"}`,
          entityType: "user",
          entityId: input,
        });
        return result;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        arabicFullName: z.string().optional(),
        universityId: z.string().optional(),
        college: z.string().optional(),
        specialization: z.string().optional(),
        academicYear: z.string().optional(),
        phoneNumber: z.string().optional(),
        whatsapp: z.string().optional(),
        culturalExperience: z.string().optional(),
        role: z.enum(["user", "admin", "supervisor", "committee_head", "general_agent", "tech_admin"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const target = await getUserById(id);
        await assertCanChangeUserRole(ctx.user.role, target?.role, data.role);
        const result = await updateUserProfile(id, data, ctx.user.id);
        if (data.role !== undefined && data.role !== target?.role) {
          recordWorkLog({
            scope: "elevated",
            actor: { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role },
            action: "user.role_change",
            description: `قام ${ctx.user.name || "مستخدم"} بتغيير صلاحية ${target?.name || "عضو"} من "${target?.role || "-"}" إلى "${data.role}"`,
            entityType: "user",
            entityId: id,
            metadata: { previousRole: target?.role, newRole: data.role },
          });
        }
        return result;
      }),
  }),

  // ── سجلات العمل (Work Logs) — technical-manager-only audit trail ──────────
  workLogs: router({
    list: techAdminProcedure
      .input(
        z.object({
          scope: z.enum(["elevated", "member"]).optional(),
          actorId: z.number().optional(),
          limit: z.number().min(1).max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getWorkLogs({
          scope: input?.scope,
          actorId: input?.actorId,
          limit: input?.limit,
        });
      }),
  }),

  // ── Activity pin ──────────────────────────────────────────────────────────
  activityPin: router({
    toggle: adminProcedure
      .input(z.object({ id: z.number(), isPinned: z.boolean() }))
      .mutation(async ({ input }) => toggleActivityPin(input.id, input.isPinned)),
  }),
});
export type AppRouter = typeof appRouter;
