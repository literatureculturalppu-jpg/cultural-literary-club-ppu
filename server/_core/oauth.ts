import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import * as db from "../db.js";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";
import { ENV } from "./env.js";
import crypto from "crypto";
import { isAllowedRedirectUri, mobileCodeHash } from "../routes/mobile.js";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getCookieValue(req: Request, key: string): string | undefined {
  const raw = req.cookies?.[key] || req.headers.cookie?.split("; ").find(c => c.startsWith(`${key}=`))?.split("=").slice(1).join("=");
  if (typeof raw !== "string") return undefined;
  try { return decodeURIComponent(raw); } catch { return undefined; }
}

function getGoogleRedirectUri(req: Request): string {
  if (ENV.googleRedirectUri) return ENV.googleRedirectUri;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}/api/auth/google/callback`;
}

type MobileOAuthState = { redirectUri: string; state?: string; expiresAt: number };

function createMobileOAuthState(value: MobileOAuthState) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = crypto.createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
  return payload + "." + signature;
}

function getMobileOAuthState(value: string | undefined): MobileOAuthState | null {
  const parts = value?.split(".") || [];
  const payload = parts[0];
  const signature = parts[1];
  if (!payload || !signature || parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MobileOAuthState;
    return isAllowedRedirectUri(decoded.redirectUri) && Number.isFinite(decoded.expiresAt) && decoded.expiresAt > Date.now() ? decoded : null;
  } catch {
    return null;
  }
}

function redirectMobileOAuthError(req: Request, res: Response, error: "no_account" | "registration_disabled", signedState: MobileOAuthState | null = null) {
  const mobileRedirect = getCookieValue(req, "mobile_oauth_redirect");
  const mobileState = getCookieValue(req, "mobile_oauth_state");
  const redirectUri = isAllowedRedirectUri(mobileRedirect) ? mobileRedirect : signedState?.redirectUri;
  const returnState = typeof mobileState === "string" ? mobileState : signedState?.state;
  if (!isAllowedRedirectUri(redirectUri)) return false;
  res.clearCookie("mobile_oauth_redirect");
  res.clearCookie("mobile_oauth_state");
  const destination = new URL(redirectUri);
  destination.searchParams.set("error", error);
  if (typeof returnState === "string") destination.searchParams.set("state", returnState);
  res.redirect(302, destination.toString());
  return true;
}

export function registerOAuthRoutes(app: Express) {
  // Google OAuth: redirect to Google consent screen
  app.get("/api/auth/google", async (req: Request, res: Response) => {
    // "login" = only allow existing accounts to sign in.
    // "register" = only allow creating brand-new accounts (blocked if registration is disabled).
    const rawIntent = getQueryParam(req, "intent");
    const intent = rawIntent === "register" ? "register" : "login";
    const mobileRedirect = getCookieValue(req, "mobile_oauth_redirect");
    const mobileState = getCookieValue(req, "mobile_oauth_state");
    const mobilePayload = isAllowedRedirectUri(mobileRedirect)
      ? { redirectUri: mobileRedirect, state: mobileState, expiresAt: Date.now() + 10 * 60 * 1000 }
      : null;

    // If someone is trying to create a new account while registration is
    // disabled by the club admin, stop them before they even reach Google.
    if (intent === "register") {
      const settings = await db.getRegistrationSettings();
      if (!settings.registrationEnabled) {
        if (redirectMobileOAuthError(req, res, "registration_disabled", mobilePayload)) return;
        res.redirect(302, "/login?error=registration_disabled");
        return;
      }
    }

    const redirectUri = getGoogleRedirectUri(req);
    const state = mobilePayload ? createMobileOAuthState(mobilePayload) : crypto.randomBytes(32).toString("hex");
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie("oauth_state", state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    res.cookie("oauth_intent", intent, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    res.redirect(302, url.toString());
  });

  // Google OAuth callback: exchange code for tokens
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    // CSRF protection: verify cookie state for web and signed state for Android.
    const cookieState = req.cookies?.oauth_state ||
      (req.headers.cookie?.split("; ").find(c => c.startsWith("oauth_state="))?.split("=")[1]);
    const signedMobileState = getMobileOAuthState(state);
    if (!state || (!signedMobileState && (!cookieState || state !== cookieState))) {
      res.status(403).json({ error: "Invalid OAuth state" });
      return;
    }
    res.clearCookie("oauth_state");

    const cookieIntent = req.cookies?.oauth_intent ||
      (req.headers.cookie?.split("; ").find(c => c.startsWith("oauth_intent="))?.split("=")[1]);
    const intent: "login" | "register" = cookieIntent === "register" ? "register" : "login";
    res.clearCookie("oauth_intent");

    try {
      const redirectUri = getGoogleRedirectUri(req);

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", errText);
        res.status(500).json({ error: "Token exchange failed" });
        return;
      }

      const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

      // Get user info from Google
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        console.error("[Google OAuth] User info fetch failed");
        res.status(500).json({ error: "Failed to get user info" });
        return;
      }

      const googleUser = await userInfoRes.json() as {
        id: string; email?: string; name?: string; picture?: string;
      };

      const openId = `google-${googleUser.id}`;

      // Check if a pre-created user exists with this email (e.g. admin accounts)
      if (googleUser.email) {
        const existingByEmail = await db.getUserByEmail(googleUser.email);
        if (existingByEmail && existingByEmail.openId !== openId) {
          await db.updateUserOpenIdById(existingByEmail.id, openId);
        }
      }

      // Does this Google account already have a club account?
      const existingUser =
        (await db.getUserByOpenId(openId)) ||
        (googleUser.email ? await db.getUserByEmail(googleUser.email) : null);

      if (intent === "login" && !existingUser) {
        // "تسجيل الدخول" must never silently create a new account.
        if (redirectMobileOAuthError(req, res, "no_account", signedMobileState)) return;
        res.redirect(302, "/login?error=no_account");
        return;
      }

      if (intent === "register" && !existingUser) {
        // Re-check registration is still enabled (in case it was disabled
        // mid-flow, or the entry check was bypassed by calling the callback directly).
        const settings = await db.getRegistrationSettings();
        if (!settings.registrationEnabled) {
          if (redirectMobileOAuthError(req, res, "registration_disabled", signedMobileState)) return;
          res.redirect(302, "/login?error=registration_disabled");
          return;
        }
      }

      await db.upsertUser({
        openId,
        name: googleUser.name || null,
        email: googleUser.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const mobileRedirect = getCookieValue(req, "mobile_oauth_redirect");
      const mobileState = getCookieValue(req, "mobile_oauth_state");
      const mobilePayload = signedMobileState || (isAllowedRedirectUri(mobileRedirect)
        ? { redirectUri: mobileRedirect, state: mobileState, expiresAt: Date.now() }
        : null);
      if (mobilePayload) {
        const user = await db.getUserByOpenId(openId);
        if (!user) { res.status(500).json({ error: "Mobile user record missing" }); return; }
        const handoff = crypto.randomBytes(32).toString("hex");
        await db.createMobileAuthCode({ codeHash: mobileCodeHash(handoff), userId: user.id, redirectUri: mobilePayload.redirectUri, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
        res.clearCookie("mobile_oauth_redirect");
        res.clearCookie("mobile_oauth_state");
        const destination = new URL(mobilePayload.redirectUri);
        destination.searchParams.set("code", handoff);
        if (typeof mobilePayload.state === "string") destination.searchParams.set("state", mobilePayload.state);
        res.redirect(302, destination.toString());
        return;
      }

      const destination = intent === "register" && existingUser ? "/?notice=already_registered" : "/";
      res.redirect(302, destination);
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });

  // Legacy Manus OAuth callback (kept for compatibility)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
