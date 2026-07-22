export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Legacy Manus OAuth server URL. Only used when the Manus-based user-info
  // sync path inside sdk.ts is reached, which should not happen in the
  // Google-only flow. Kept for compatibility so the sdk module compiles.
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  // Legacy Manus Forge storage proxy (used only if S3 vars are unset).
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // S3-compatible storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, …).
  // When `s3Bucket` + `s3AccessKeyId` + `s3SecretAccessKey` are set, the
  // storage layer writes to S3 instead of the Forge proxy.
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  // Optional. If set, uploaded objects are returned as `<s3PublicUrl>/<key>`
  // instead of presigned URLs. Use this when the bucket is public or fronted
  // by a CDN.
  s3PublicUrl: process.env.S3_PUBLIC_URL ?? "",
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // Optional override for the redirect URI registered in the Google Cloud console.
  // When unset we derive the URI from the incoming request so it works in any environment.
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  // Comma-separated list of emails that are auto-promoted to admin on first
  // sign-in and that can never be demoted from admin via the UI. Defaults to
  // the club owner's university email.
  protectedAdminEmails: (process.env.PROTECTED_ADMIN_EMAILS ?? "251041@ppu.edu.ps")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Comma-separated list of emails that are auto-promoted to the "tech_admin"
  // (المدير التقني) role on first sign-in. This role sits above both `admin`
  // and `general_agent`: it has every admin/general-agent permission, plus
  // it is the ONLY role that can promote another member to `tech_admin`,
  // and the only one whose own role/account cannot be edited by an admin or
  // general agent. Defaults to the club's technical-manager account.
  techAdminEmails: (process.env.TECH_ADMIN_EMAILS ?? "257812@ppu.edu.ps")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Base URL used when composing absolute links inside emails/notifications.
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  // Outbound email (SMTP) for content + activity-acceptance notifications.
  //  - Defaults target Brevo (https://www.brevo.com), which has a genuinely
  //    permanent free tier (300 emails/day, no expiration, no credit card) —
  //    unlike SendGrid, whose free tier is now only a 60-day trial.
  //  - `smtpUser` = the email address you signed up to Brevo with.
  //  - `smtpPassword` = the SMTP key generated in Brevo → SMTP & API settings
  //    (falls back to `SENDGRID_API_KEY` for anyone who already configured
  //    that variable, so nothing breaks if you keep using SendGrid instead).
  //  - `smtpFrom` must be a verified sender (single sender or domain) with
  //    whichever provider you use.
  // When `smtpPassword` or `smtpFrom` is empty, email sending is skipped
  // silently (logged, never thrown) so the rest of the app keeps working.
  smtpFrom: process.env.SMTP_FROM ?? "",
  smtpHost: process.env.SMTP_HOST ?? "smtp-relay.brevo.com",
  smtpPort: Number(process.env.SMTP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? process.env.SENDGRID_API_KEY ?? "",
  // Gemini API key for the Basir AI assistant.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
};

/** Lowercased helper so we can compare against an arbitrary user email. */
export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ENV.protectedAdminEmails.includes(email.toLowerCase());
}

/** Lowercased helper for the technical-manager ("tech_admin") auto-promotion list. */
export function isTechAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ENV.techAdminEmails.includes(email.toLowerCase());
}
