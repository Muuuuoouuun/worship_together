// v2: 새 디자인의 오프라인 화면을 배포하고, 예전 v1 캐시(배포마다 쌓이던 코드 조각)를 지웁니다.
const CACHE_VERSION = "worship-together-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
              .map((cacheName) => caches.delete(cacheName)),
          ),
        ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request, event));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstNavigation(request, event) {
  try {
    const preloadResponse = await event.preloadResponse;

    if (preloadResponse) {
      return preloadResponse;
    }

    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

// /_next/static 코드 조각은 브라우저 HTTP 캐시(immutable)가 이미 맡으므로 여기서 따로 쌓지 않습니다.
function isStaticAsset(pathname) {
  return pathname === OFFLINE_URL || pathname.startsWith("/icons/");
}

// 앱을 닫아도 오는 알림(푸시). 서버는 앱이 열린 기기에는 보내지 않으므로 받으면 항상 띄웁니다.
// 앱이 띄운 기기 알림과 같은 tag 를 써서 같은 알림이 두 번 쌓이지 않습니다.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Worship Together";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/dashboard" },
    }),
  );
});

// 기기 알림(예배 시작 · 받은 큐 · 팀 알림 · 푸시)을 누르면 열려 있는 앱 화면으로 가거나 새로 엽니다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(url) : focused));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
