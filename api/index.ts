import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { runScheduledBookCleanup } from "../server/db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));
registerOAuthRoutes(app);

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

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
