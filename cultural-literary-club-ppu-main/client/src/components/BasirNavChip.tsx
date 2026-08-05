import { Link } from "wouter";
import { ArrowUpLeft, Compass } from "lucide-react";

/**
 * Fixed whitelist of internal paths Basir is allowed to suggest via the
 * `[[NAV|path|label]]` token. Anything outside this list (including any
 * external/absolute URL) is rejected and rendered as plain text instead,
 * so a hallucinated or manipulated token can never send the user off-site.
 */
const ALLOWED_NAV_PREFIXES = [
  "/profile",
  "/activities",
  "/articles",
  "/achievements",
  "/books",
  "/teams",
  "/quick-links",
  "/about",
];

export function isAllowedNavPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return ALLOWED_NAV_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`)
  );
}

/**
 * The "move me to another page" chip Basir can offer. This is the only
 * account-control capability Basir has — it never navigates on its own;
 * the user must tap this chip to actually move.
 */
export function BasirNavChip({ path, label }: { path: string; label: string }) {
  return (
    <Link
      href={path}
      className="not-prose inline-flex items-center gap-2 max-w-full my-1 mx-0.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 hover:border-accent/50 px-3 py-1.5 text-sm font-medium text-accent transition-colors align-middle"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 shrink-0">
        <Compass className="w-3 h-3" />
      </span>
      <span className="truncate">{label}</span>
      <ArrowUpLeft className="w-3 h-3 shrink-0 opacity-60" />
    </Link>
  );
}
