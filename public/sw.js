/* Yuzu service worker.
 *
 * Hard lesson: this used to cache the HTML too. Every deploy renames the JS
 * chunks, so a cached page would ask for chunks that no longer exist and render
 * nothing at all, a white screen on the home-screen app, with a perfectly
 * healthy server. Never cache navigations.
 *
 * What is cached: the icons and the manifest, which never change names.
 * Everything else, pages, JS, the API, Supabase, always goes to the network.
 */
const CACHE = "yuzu-v3";
const SAFE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SAFE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  // Pages: never served from cache. A stale page is worse than no page.
  if (request.mode === "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // Supabase, fonts, Gemini
  if (url.pathname.startsWith("/_next/")) return;       // hashed build output
  if (url.pathname.startsWith("/api/")) return;         // always live

  // Only the handful of files whose names never change.
  if (!SAFE.includes(url.pathname)) return;

  e.respondWith(
    caches.match(request).then((hit) =>
      hit ?? fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
    )
  );
});

/* ---------------------------------------------------------------------------
 * PUSH, the only way to buzz a phone whose app is closed.
 * ------------------------------------------------------------------------- */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* keep defaults */ }

  const title = payload.title || "She needs you";
  const options = {
    body: payload.body || "Open Yuzu.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "yuzu-cramp",
    renotify: true,
    requireInteraction: true,
    vibrate: payload.vibrate || [300, 120, 300, 120, 300],
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.url.includes(target) && "focus" in tab) return tab.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
