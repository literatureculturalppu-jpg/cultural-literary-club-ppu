import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";

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

export const protectedProcedure = t.procedure.use(requireUser);

// Admin-only procedure — requires an authenticated user AND role "admin",
// "general_agent", or "tech_admin". (Previously this only checked
// `ctx.user` was truthy, i.e. identical to `protectedProcedure`, so any
// signed-in user — regardless of role — could call procedures gated by
// this export, such as `system.notifyOwner`. Fixed to actually enforce the
// role check.)
export const adminProcedure = t.procedure.use(requireUser).use(
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

// Technical-manager-only procedure — requires role "tech_admin" exactly.
// Used for the "سجلات العمل" (work logs) audit trail, which is intentionally
// invisible to plain admins and general agents.
export const techAdminProcedure = t.procedure.use(requireUser).use(
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
