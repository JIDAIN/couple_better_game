const CACHE_NAME = "couple-better-life-shell-r8-4-v1";
const CORE_ROUTES = [
  "/",
  "/food",
  "/calendar",
  "/nest",
  "/nest/weight",
  "/nest/mailbox",
  "/nest/medicine",
  "/nest/game-machine",
  "/me",
  "/me/data",
];
const LIFE_ROOTS = ["/food", "/calendar", "/nest", "/me", "/ai"];
const NETWORK_TIMEOUT_MS = 2500;

function isLifePath(pathname) {
  return pathname === "/" || LIFE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function shouldIgnore(url) {
  return url.pathname.startsWith("/api/")
    || url.pathname === "/mcp"
    || url.pathname.startsWith("/oauth/")
    || url.pathname.startsWith("/.well-known/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/")
    || /\.(?:css|js|woff2?|png|jpe?g|webp|svg|ico)$/i.test(url.pathname);
}

async function safeCachePut(request, response) {
  if (!response || !response.ok || response.type === "opaqueredirect") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache storage is best-effort only.
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  void safeCachePut(request, response);
  return response;
}

async function networkFirst(request) {
  const cachedPromise = caches.match(request);
  let timer;
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("network timeout")), NETWORK_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
    void safeCachePut(request, response);
    return response;
  } catch (error) {
    clearTimeout(timer);
    const cached = await cachedPromise;
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ROUTES.map(async (path) => {
      const request = new Request(path, { credentials: "same-origin", cache: "reload" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("couple-better-life-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldIgnore(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" || isLifePath(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});
