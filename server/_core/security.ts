import type { Request, Response, NextFunction } from "express";
import { logAction } from "../db.js";

/**
 * Security headers middleware.
 * Sets standard security headers on every response.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // Enable browser XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Only send origin as referrer
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Restrict permissions
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  next();
}

/**
 * Simple in-memory rate limiter for auth endpoints.
 * Limits each IP to a fixed number of requests per window.
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 120; // max requests per window

const hitCounts = new Map<string, { count: number; resetAt: number; securityEventLogged: boolean }>();

// Periodically clean expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(hitCounts.entries())) {
    if (now > entry.resetAt) hitCounts.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  let entry = hitCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS, securityEventLogged: false };
    hitCounts.set(ip, entry);
  }

  entry.count++;

  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - entry.count)));

  if (entry.count > RATE_LIMIT_MAX) {
    // Keep a single anonymous security event per rate-limit window. The IP is
    // deliberately retained only in process memory for throttling and is never
    // persisted in the audit trail or used as a browser fingerprint.
    if (!entry.securityEventLogged) {
      entry.securityEventLogged = true;
      void logAction({
        scope: "member",
        actorId: null,
        actorName: null,
        actorRole: null,
        action: "security.rate_limit",
        description: "تم حظر طلبات متكررة بواسطة حد الحماية",
        entityType: "security",
        metadata: { path: req.path, limit: RATE_LIMIT_MAX, windowMinutes: RATE_LIMIT_WINDOW_MS / 60_000 },
      });
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "طلبات تسجيل الدخول كثيرة. انتظر قليلًا ثم حاول مجددًا.",
      code: "rate_limited",
      retryAfterSeconds,
    });
    return;
  }

  next();
}
