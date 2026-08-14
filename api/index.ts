import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { runScheduledBookCleanup, runScheduledWorkLogsCleanup } from "../server/db.js";
import { runScheduledMeetingsCleanup, autoEndEmptyLiveMeetings } from "../server/services/meetingsDb.js";
import { securityHeaders, rateLimiter } from "../server/_core/security.js";
import { registerBasirStreamRoute } from "../server/routes/basirStream.js";
import { registerMobileRoutes } from "../server/routes/mobile.js";

const app = express();
// Vercel's edge always sits in front of this function, so `req.ip` is
// meaningless without this — see server/_core/index.ts for the full
// explanation. This is the entrypoint vercel.json actually routes /api/*
// to in production, so this is the copy of the fix that matters most.
app.set("trust proxy", 1);
// Apply headers globally, but reserve rate limiting for the abuse-prone
// authentication and upload routes. Applying it to every data request makes
// normal React Query navigation vulnerable to 429 responses.
app.use(securityHeaders);
app.use("/api/auth", rateLimiter);
app.use("/api/upload", rateLimiter);
app.use(express.json({ limit: "50mb" }));
registerOAuthRoutes(app);
registerMobileRoutes(app);

const PUBLIC_CONTENT_PROCEDURES = new Set([
  "/activities.list",
  "/activities.getById",
  "/articles.list",
  "/articles.getById",
  "/articles.getBySlug",
  "/achievements.list",
  "/achievements.getById",
  "/books.list",
  "/books.getById",
  "/externalLinks.list",
  "/externalLinks.getByType",
  "/teamMembers.list",
]);
const PUBLIC_CONTENT_CDN_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

// These responses are public editorial content. Cache them at Vercel's CDN
// for 60 seconds and serve a five-minute stale copy while one request refreshes
// the origin. Requests with a cookie are deliberately excluded so user-specific
// data, permission-sensitive content, and login state are never cached.
app.use("/api/trpc", (req, res, next) => {
  if (
    req.method === "GET" &&
    !req.headers.cookie &&
    PUBLIC_CONTENT_PROCEDURES.has(req.path)
  ) {
    // Vercel consumes this targeted header at the edge. Keep the browser at
    // max-age=0 so content edits are visible on the next visit, while the
    // globally shared CDN cache shields the function and database.
    res.setHeader("Vercel-CDN-Cache-Control", PUBLIC_CONTENT_CDN_CACHE);
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    res.setHeader("Cache-Control", "private, no-store");
  }
  next();
});

// Daily scheduled cleanup for the "الكتب" page: deletes closed suggestion
// rounds / vote polls once their grace period (5 / 7 days) has passed.
// Triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET when
// that env var is set, so it can't be triggered by random internet traffic.
app.get("/api/cron/books-cleanup", async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runScheduledBookCleanup();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] Books cleanup failed", error);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

// Daily scheduled cleanup for the electronic-meetings system: deletes
// ended/cancelled meeting metadata rows after a 24h grace period, and
// (as a safety net for Vercel's once-a-day-only free-tier cron limit)
// auto-ends any "live" meeting that's been empty for 10+ minutes. Video,
// audio, and chat are never stored here in the first place — only ever in
// LiveKit (media, ephemeral) and Supabase Realtime (signaling/chat,
// ephemeral) — so there is nothing else to clean up.
app.get("/api/cron/meetings-cleanup", async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await autoEndEmptyLiveMeetings();
    const result = await runScheduledMeetingsCleanup();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] Meetings cleanup failed", error);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

// Daily scheduled cleanup for "سجلات العمل" (work logs): permanently removes
// entries the Technical Manager scheduled for deletion once their 48h grace
// period has passed (see workLogs.delete in server/routers.ts). Nothing is
// ever deleted immediately — this cron is the only thing that actually
// removes a row.
app.get("/api/cron/worklogs-cleanup", async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runScheduledWorkLogsCleanup();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] Work logs cleanup failed", error);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

// Basir's streaming chat endpoint. Deliberately registered BEFORE the tRPC
// middleware and as a plain Express route (not a tRPC procedure) because it
// needs to flush partial output to the client as it's generated — see
// server/routes/basirStream.ts for the full rationale.
registerBasirStreamRoute(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
