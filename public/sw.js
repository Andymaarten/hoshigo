// hoshigo service worker: notifications, and a small cache so the app opens fast.
//
// Static files (/_next/static, icons, hero images, fonts) are cache first: their names change
// with every deploy, so a cached copy is never wrong. Pages are network first; only when the
// network is slow (over NAV_TIMEOUT) or offline is the last copy of that page shown, and the
// page then refreshes itself as soon as fresh data arrives (AppChrome asks "was I stale?").
// Never cached: API routes, admin, login, auth, onboarding, settings and adding.
// Bump VERSION to drop every cache on the next visit.

const VERSION = "v1";
const STATIC = `hoshigo-static-${VERSION}`;
const PAGES = `hoshigo-pages-${VERSION}`;
const NAV_TIMEOUT = 1200;
const NEVER = /^\/(api|admin|auth|login|onboarding|settings|add|reset-password|unsubscribe|invite)(\/|$)/;
const staleClients = new Set();

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hoshigo-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  /^\/(icons|hero|splash|email)\//.test(url.pathname) ||
  /\.(woff2|webp|png|svg)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // logging out or in: forget every cached page, so the next person sees nothing of the last
  if ((url.pathname === "/login" || url.searchParams.has("out")) && req.mode === "navigate") {
    event.waitUntil(caches.delete(PAGES));
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate" && !NEVER.test(url.pathname)) {
    event.respondWith(navigate(event, req));
  }
});

async function navigate(event, req) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then((res) => {
    // only plain successful pages; a redirect is stored under the page it went to
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(req, res.clone());
    return res;
  });
  const cached = await cache.match(req);
  if (!cached) return network;
  const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), NAV_TIMEOUT));
  const first = await Promise.race([network.catch(() => "offline"), slow]);
  if (first !== "slow" && first !== "offline") return first;
  if (event.resultingClientId) staleClients.add(event.resultingClientId);
  event.waitUntil(network.catch(() => {}));
  return cached;
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "stale?" && event.ports[0]) {
    const id = event.source && event.source.id;
    event.ports[0].postMessage(staleClients.has(id));
    staleClients.delete(id);
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "hoshigo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/maskable-192.png",
      tag: "hoshigo-daily",
      data: { url: data.url || "/friends" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/friends", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
