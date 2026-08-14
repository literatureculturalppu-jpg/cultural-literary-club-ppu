import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("production performance contracts", () => {
  it("pins serverless work near the Tokyo Supabase project", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.regions).toEqual(["hnd1"]);
  });

  it("scopes the rate limiter away from public data APIs", () => {
    const entry = read("api/index.ts");
    expect(entry).toContain('app.use("/api/auth", rateLimiter)');
    expect(entry).toContain('app.use("/api/upload", rateLimiter)');
    expect(entry).not.toContain("app.use(rateLimiter)");
  });

  it("sets short shared caching only for explicitly public content", () => {
    const entry = read("api/index.ts");
    const mobileRoutes = read("server/routes/mobile.ts");
    expect(entry).toContain("Vercel-CDN-Cache-Control");
    expect(entry).toContain("s-maxage=60, stale-while-revalidate=300");
    expect(entry).toContain("!req.headers.cookie");
    expect(mobileRoutes).toContain("cachePublicContent");
    expect(mobileRoutes).toContain("app.use(`${BASE}/auth`");
  });

  it("defers the assistant panel and avoids aggressive query refetches", () => {
    const app = read("client/src/App.tsx");
    const widget = read("client/src/components/BasirWidget.tsx");
    const main = read("client/src/main.tsx");
    expect(app).toContain('const BasirWidget = lazy(() => import("./components/BasirWidget"))');
    expect(widget).toContain('const BasirPanel = lazy(() => import("@/components/BasirPanel"))');
    expect(main).toContain("staleTime: 60_000");
    expect(main).toContain("refetchOnWindowFocus: false");
  });
});
