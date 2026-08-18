import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";
import { logAction } from "../db.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Auto-logging safety net for "سجلات العمل" (work logs): guarantees that
 * EVERY mutation performed by a signed-in member — regardless of role —
 * ends up in the audit trail, even if the specific procedure never calls
 * `recordWorkLog` itself. Procedures that already record a richer, more
 * specific entry (via `recordWorkLog` in server/routers.ts, which sets
 * `ctx.workLogRecorded = true`) are skipped here to avoid double-logging;
 * everything else still gets a generic entry keyed by the tRPC path.
 *
 * Only fires for mutations (queries aren't "actions"), and only after the
 * mutation actually succeeded.
 */
const autoWorkLog = t.middleware(async opts => {
  const { ctx, next, path, type } = opts;
  const result = await next();

  if (type === "mutation" && result.ok && ctx.user && !ctx.workLogRecorded) {
    const isElevated = ctx.user.role !== "user";
    void logAction({
      scope: isElevated ? "elevated" : "member",
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      actorRole: ctx.user.role,
      action: path,
      description: `قام ${ctx.user.name || "مستخدم"} بتنفيذ العملية "${path}"`,
    });
  }

  return result;
});

export const protectedProcedure = t.procedure.use(requireUser).use(autoWorkLog);

// Admin-only procedure — requires an authenticated user AND role "admin",
// "general_agent", or "tech_admin". (Previously this only checked
// `ctx.user` was truthy, i.e. identical to `protectedProcedure`, so any
// signed-in user — regardless of role — could call procedures gated by
// this export, such as `system.notifyOwner`. Fixed to actually enforce the
// role check.) Built on top of `protectedProcedure` so it inherits
// `autoWorkLog` automatically.
export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // TS can't narrow `ctx.user` as non-null across separate `.use()` calls
    // even though `requireUser` already guarantees it at runtime — guard
    // again here so the type and the runtime behavior agree.
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== "admin" && ctx.user.role !== "general_agent" && ctx.user.role !== "tech_admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx });
  }),
);

// يقتصر هذا الاستثناء على قبول طلبات الأنشطة فقط. يحتاج المشرف إلى مراجعة
// المسجلين في النشاط، لكنه لا يكتسب بذلك صلاحيات إدارة المحتوى العامة.
export const activityApproverProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!["admin", "general_agent", "tech_admin", "supervisor"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx });
  }),
);

// Technical-manager-only procedure — requires role "tech_admin" exactly.
// Used for the "سجلات العمل" (work logs) audit trail, which is intentionally
// invisible to plain admins and general agents. Built on top of
// `protectedProcedure` so it inherits `autoWorkLog` automatically.
export const techAdminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== "tech_admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx });
  }),
);
