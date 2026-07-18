const CACHE_NAME = "school2pay-v1";
const OFFLINE_URL = "/offline";

// App shell — cache these on install
const PRECACHE_URLS = [
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests for same-origin navigation
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip Supabase, Stripe, and API calls — always go network
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("stripe") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // For navigation requests: network first, fall back to offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // For static assets: cache first, then network
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
      )
    );
  }
});
