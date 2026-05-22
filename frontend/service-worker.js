// Service Worker (production-only behavior; dev should unregister it)
const CACHE_NAME = "ecom-cache-v3";
const APP_SHELL = ["/", "/index.html"];

const isLikelyDevRequest = (url) => {
  if (!url) return false;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  return (
    url.pathname.startsWith("/@vite") ||
    url.pathname.startsWith("/@react-refresh") ||
    url.pathname.startsWith("/src/")
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Never attempt to precache Vite dev URLs.
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);
      } catch {
        // Ignore install cache failures (app can still run online).
      } finally {
        self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((name) => name.startsWith("ecom-cache-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      } finally {
        self.clients.claim();
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isLikelyDevRequest(url)) return;

  // Navigation requests: network-first with app shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("/index.html", response.clone()).catch(() => undefined);
          return response;
        } catch {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first.
  const destination = request.destination || "";
  if (!["script", "style", "image", "font"].includes(destination)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })(),
  );
});
