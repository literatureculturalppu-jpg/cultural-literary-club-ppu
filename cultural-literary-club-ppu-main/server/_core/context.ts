import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { sdk } from "./sdk.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * Set to `true` by `recordWorkLog` (server/routers.ts) once a procedure
   * has already written its own rich, human-readable work log entry for
   * the current request. The generic auto-logging middleware in trpc.ts
   * checks this flag so every mutation still ends up tracked in "سجلات
   * العمل" WITHOUT double-logging mutations that already log explicitly.
   */
  workLogRecorded?: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
