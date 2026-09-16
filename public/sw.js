/* Yuzu service worker.
 * Caches the shell so the app opens instantly and survives a dropped signal.
 * Anything live — auth, her message, his gifts — always goes to the network.  */
const CACHE = "yuzu-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  const url = new URL(request.url);
  // never cache the API, Supabase, or anything cross-origin
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // network first, fall back to cache when the signal drops
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/")))
  );
});


/* ---------------------------------------------------------------------------
 * PUSH — the only way to buzz a phone whose app is closed.
 *
 * A page that is hidden cannot vibrate; the browser forbids it. But a service
 * worker woken by a push CAN show a notification, and a notification carries
 * its own vibration pattern. So her cramp reaches him through the OS rather
 * than through the page.
 *
 * Android honours the custom pattern. iOS (16.4+, home-screen installs only)
 * shows the notification and buzzes with the system default — no custom
 * rhythm, but it still arrives.
 * ------------------------------------------------------------------------- */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* keep defaults */ }

  const title = payload.title || "She needs you";
  const options = {
    body: payload.body || "Open Yuzu.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "yuzu-cramp",     // replaces, so buzzes don't stack up
    renotify: true,                       // ...but still buzz for each new one
    requireInteraction: true,             // stays until he deals with it
    vibrate: payload.vibrate || [300, 120, 300, 120, 300],
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // focus the tab if it is already open, otherwise open one
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.url.includes(target) && "focus" in tab) return tab.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
