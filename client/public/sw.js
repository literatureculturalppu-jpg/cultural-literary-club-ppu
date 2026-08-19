const CACHE_NAME = "club-public-v1";
const PUBLIC_PATHS = ["/", "/about", "/activities", "/articles", "/achievements", "/books", "/teams", "/quick-links", "/privacy-policy", "/terms-of-use"];

const isPublicRoute = (pathname) => PUBLIC_PATHS.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
const offlineResponse = () => new Response(
  "<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>دون اتصال</title><body style=\"margin:0;font-family:system-ui;background:#fffaf0;color:#2a2118;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center\"><main><h1>لا توجد نسخة محفوظة بعد</h1><p>اتصل بالإنترنت وافتح الصفحة مرة واحدة لحفظ نسخة عامة منها للعرض لاحقًا دون اتصال.</p></main></body></html>",
  { headers: { "Content-Type": "text/html; charset=utf-8" } },
);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isPublicNavigation = request.mode === "navigate" && isPublicRoute(url.pathname);
  const isSameOriginAsset = url.pathname.startsWith("/assets/") || request.destination === "image" || request.destination === "font" || request.destination === "style" || request.destination === "script";

  if (isPublicNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match("/")) || offlineResponse();
      }
    })());
    return;
  }

  if (isSameOriginAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(fetch(request).then((response) => {
          if (response.ok) return cache.put(request, response.clone());
          return undefined;
        }).catch(() => undefined));
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })());
  }
});
