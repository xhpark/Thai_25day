const CACHE_NAME = "thai25-day1-v14";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=14",
  "./app.js?v=14",
  "./manifest.webmanifest",
  "./assets/generated/pwa/w1d1.json",
  "./assets/generated/pwa/w1d2.json",
  "./assets/generated/pwa/w1d3.json",
  "./assets/generated/pwa/w1d4.json",
  "./assets/generated/pwa/w1d5.json",
  "./assets/generated/pwa/aid1_numbers.json",
  "./assets/generated/pwa-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
      .catch(() => caches.match(event.request))
  );
});
