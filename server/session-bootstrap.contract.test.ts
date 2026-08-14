import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("session bootstrap contract", () => {
  it("hydrates only a bounded cached profile while auth.me revalidates the cookie", () => {
    const hook = read("client/src/_core/hooks/useAuth.ts");
    expect(hook).toContain('const AUTH_BOOTSTRAP_KEY = "club.auth.bootstrap.v1"');
    expect(hook).toContain("AUTH_BOOTSTRAP_MAX_AGE_MS");
    expect(hook).toContain("bootstrapUser ? { placeholderData: bootstrapUser");
    expect(hook).toContain("writeAuthBootstrap(meQuery.data)");
    expect(hook).toContain("writeAuthBootstrap(null)");
  });

  it("does not render the login action until an uncached session check finishes", () => {
    const navigation = read("client/src/components/Navigation.tsx");
    expect(navigation).toContain("const { user, isAuthenticated, loading, logout } = useAuth()");
    expect(navigation).toContain('aria-label="جار التحقق من الجلسة"');
  });
});
