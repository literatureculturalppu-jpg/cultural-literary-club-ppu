import { dehydrate, hydrate, type DehydratedState, type QueryClient, type QueryKey } from "@tanstack/react-query";

const STORAGE_KEY = "club.public-content-cache.v1";
export const PUBLIC_QUERY_ROOTS = ["activities", "articles", "achievements", "books", "externalLinks", "teamMembers"] as const;

function isPublicContentQuery(queryKey: QueryKey) {
  const serialized = JSON.stringify(queryKey);
  return PUBLIC_QUERY_ROOTS.some((root) => serialized.includes(`"${root}"`));
}

/** Hydrates only anonymous editorial data. Authentication, profiles, activity
 * registrations, notifications, and every other private query are excluded. */
export function restorePublicContentCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    hydrate(queryClient, JSON.parse(raw) as DehydratedState);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function persistPublicContentCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => undefined;
  let timer: number | undefined;
  const save = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        const snapshot = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => query.state.status === "success" && isPublicContentQuery(query.queryKey),
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Cache storage is an optional performance layer; quota issues must
        // never block the public site or cause a user-visible failure.
      }
    }, 300);
  };
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && isPublicContentQuery(event.query.queryKey)) save();
  });
}

export function registerPublicServiceWorker() {
  if (typeof window === "undefined" || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, { once: true });
}
