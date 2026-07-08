const CACHE_NAME = "thai25-day1-v21";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=21",
  "./app.js?v=21",
  "./manifest.webmanifest",
  "./assets/generated/pwa/w1d1.json",
  "./assets/generated/pwa/w1d2.json",
  "./assets/generated/pwa/w1d3.json",
  "./assets/generated/pwa/w1d4.json",
  "./assets/generated/pwa/w1d5.json",
  "./assets/generated/pwa/w2d6.json",
  "./assets/generated/pwa/w2d7.json",
  "./assets/generated/pwa/w2d8.json",
  "./assets/generated/pwa/w2d9.json",
  "./assets/generated/pwa/w2d10.json",
  "./assets/generated/pwa/w3d11.json",
  "./assets/generated/pwa/w3d12.json",
  "./assets/generated/pwa/w3d13.json",
  "./assets/generated/pwa/w3d14.json",
  "./assets/generated/pwa/w3d15.json",
  "./assets/generated/pwa/w4d16.json",
  "./assets/generated/pwa/w4d17.json",
  "./assets/generated/pwa/w4d18.json",
  "./assets/generated/pwa/w4d19.json",
  "./assets/generated/pwa/w4d20.json",
  "./assets/generated/pwa/w5d21.json",
  "./assets/generated/pwa/w5d22.json",
  "./assets/generated/pwa/w5d23.json",
  "./assets/generated/pwa/w5d24.json",
  "./assets/generated/pwa/w5d25.json",
  "./assets/generated/pwa/review_2026_07_04.json",
  "./assets/generated/pwa/review_2026_07_05.json",
  "./assets/generated/pwa/review_2026_07_11.json",
  "./assets/generated/pwa/review_2026_07_12.json",
  "./assets/generated/pwa/review_2026_07_18.json",
  "./assets/generated/pwa/review_2026_07_19.json",
  "./assets/generated/pwa/review_2026_07_25.json",
  "./assets/generated/pwa/review_2026_07_26.json",
  "./assets/generated/pwa/review_2026_08_01.json",
  "./assets/generated/pwa/preview_d_minus_2.json",
  "./assets/generated/pwa/preview_d_minus_1.json",
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
