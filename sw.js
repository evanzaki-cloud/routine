// Minimal offline support: network-first for pages, cache-first for assets.
const CACHE = "routine-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const put = (r) => { const c = r.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); return r; };
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then(put)));
});
