const CACHE = "fire-fellowship-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).pathname === "/caption-ws") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html"))),
  );
});
