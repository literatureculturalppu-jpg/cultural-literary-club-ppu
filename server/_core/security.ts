import type { Request, Response, NextFunction } from "express";

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
const RATE_LIMIT_MAX = 60; // max requests per window

const hitCounts = new Map<string, { count: number; resetAt: number }>();

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
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    hitCounts.set(ip, entry);
  }

  entry.count++;

  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - entry.count)));

  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  next();
}
