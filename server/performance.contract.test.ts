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

  it("caches only explicitly public content at the CDN", () => {
    const config = JSON.parse(read("vercel.json"));
    const cacheHeaders = config.headers.flatMap((rule: { headers: Array<{ key: string; value: string }> }) => rule.headers);
    expect(cacheHeaders).toContainEqual({ key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=86400" });
    expect(cacheHeaders).toContainEqual({ key: "Cache-Control", value: "public, max-age=31536000, immutable" });
    expect(read("server/routes/mobile.ts")).toContain("app.use(`${BASE}/auth`");
  });

  it("defers the assistant panel and avoids aggressive query refetches", () => {
    const app = read("client/src/App.tsx");
    const widget = read("client/src/components/BasirWidget.tsx");
    const main = read("client/src/main.tsx");
    expect(app).toContain('const BasirWidget = lazy(() => import("./components/BasirWidget"))');
    expect(widget).toContain('const BasirPanel = lazy(() => import("@/components/BasirPanel"))');
    expect(main).toContain("staleTime: 60_000");
    expect(main).toContain("staleTime: 5 * 60_000");
    expect(main).toContain("refetchOnWindowFocus: false");
  });

  it("uses true cursor pages instead of slicing an unbounded mobile list", () => {
    const mobile = read("server/routes/mobile.ts");
    const db = read("server/db.ts");
    expect(mobile).toContain("const page = await listPage(kind, requestedLimit, cursor)");
    expect(mobile).toContain("nextCursor: page.nextCursor");
    expect(db).toContain("decodePublicContentCursor");
    expect(db).toContain("limit(pageLimit(options.limit) + 1)");
  });

  it("stores only anonymous public query data and serves public pages offline", () => {
    const cache = read("client/src/lib/publicContentCache.ts");
    const serviceWorker = read("client/public/sw.js");
    expect(cache).toContain("PUBLIC_QUERY_ROOTS");
    expect(cache).toContain("shouldDehydrateQuery");
    expect(serviceWorker).toContain("const PUBLIC_PATHS");
    expect(serviceWorker).toContain("url.pathname.startsWith(\"/api/\")");
  });
});
