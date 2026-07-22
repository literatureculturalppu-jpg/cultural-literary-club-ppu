import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { serveStatic, setupVite } from "./vite.js";
import { sdk } from "./sdk.js";
import { sniffImageMagicBytes } from "../routers.js";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Local file uploads directory
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // File upload endpoint (accepts base64 data).
  //
  // Security fix: this route previously had NO authentication check at all
  // (any anonymous caller on the internet could hit it), no size limit
  // beyond the global 50mb JSON body limit, and no content-type allow-list
  // — so an attacker could upload arbitrary files (including HTML/SVG with
  // embedded scripts) that get served back from /uploads as if they were
  // trusted static assets. It is now: (1) gated behind the same session
  // auth as the rest of the app, (2) restricted to a small set of image
  // mime types, and (3) capped to 10MB of decoded image data.
  const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  app.post("/api/upload", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
      return;
    }

    try {
      const { base64, filename } = req.body ?? {};
      if (typeof base64 !== "string" || typeof filename !== "string" || !filename) {
        res.status(400).json({ error: "base64 and filename are required" });
        return;
      }
      const match = /^data:([^;]+);base64,(.*)$/.exec(base64);
      const mimeType = match?.[1]?.toLowerCase();
      if (!mimeType || !ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
        res.status(400).json({ error: "نوع الملف غير مسموح به" });
        return;
      }
      const encoded = match?.[2] ?? "";
      const buffer = Buffer.from(encoded, "base64");
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
        res.status(400).json({ error: "حجم الملف غير صالح" });
        return;
      }
      if (!sniffImageMagicBytes(buffer, mimeType)) {
        res.status(400).json({ error: "محتوى الملف لا يطابق نوع الصورة المعلن" });
        return;
      }
      // Force the saved extension to match the verified content type
      // rather than trusting the client-supplied filename's extension —
      // otherwise a validated PNG payload could still be saved as
      // `evil.html` and served with a browser-sniffable HTML extension.
      const EXT_BY_MIME: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
      };
      const safeStem = filename.replace(/\.[^./\\]+$/, "").replace(/[^A-Za-z0-9._-]/g, "_").slice(-200) || "upload";
      const savedName = `${Date.now()}-${safeStem}.${EXT_BY_MIME[mimeType]}`;
      const filePath = path.join(uploadsDir, savedName);
      fs.writeFileSync(filePath, buffer);
      const url = `/uploads/${savedName}`;
      res.json({ url });
    } catch (error) {
      console.error("[upload] failed", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
