import type { CookieOptions, Request } from "express";
import { ENV } from "./env.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  // `secure` MUST be true whenever `sameSite: "none"` is used, or browsers
  // silently drop the cookie entirely (no error, session just never
  // persists). Relying only on the x-forwarded-proto header is fragile
  // across serverless platforms (Vercel/Netlify), so we combine three
  // independent signals — any one of them being true is enough, since a
  // real deployment is always served over HTTPS.
  const secure =
    isSecureRequest(req) ||
    ENV.isProduction ||
    ENV.appBaseUrl.startsWith("https://");

  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure,
  };
}
