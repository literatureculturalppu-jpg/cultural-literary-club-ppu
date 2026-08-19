import { describe, expect, it, vi } from "vitest";

vi.mock("./db.js", async () => {
  const actual = await vi.importActual<typeof import("./db.js")>("./db.js");
  return {
    ...actual,
    getWorkLogs: vi.fn().mockResolvedValue([]),
    logAction: vi.fn().mockResolvedValue(undefined),
  };
});

import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: AuthenticatedUser["role"]): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "security-audit-test-user",
      email: "security-test@example.com",
      name: "Security Test User",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("security audit access", () => {
  it("allows the technical manager to open the security audit list", async () => {
    const caller = appRouter.createCaller(createContext("tech_admin"));
    await expect(caller.workLogs.list({ limit: 1 })).resolves.toEqual(expect.any(Array));
  });

  it.each(["admin", "club_president", "user"] as const)("denies %s access to the security audit list", async (role) => {
    const caller = appRouter.createCaller(createContext(role));
    await expect(caller.workLogs.list({ limit: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
