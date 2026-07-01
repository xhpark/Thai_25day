const CACHE_NAME = "thai25-voice-pilot-v5";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=5",
  "./config.js?v=5",
  "./app.js?v=5",
  "./manifest.webmanifest",
  "../assets/generated/pwa-icon.svg",
  "../assets/generated/pwa/w1d1.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
