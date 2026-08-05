export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (intent: "login" | "register" = "login") => {
  // Use direct Google OAuth flow
  return `${window.location.origin}/api/auth/google?intent=${intent}`;
};
