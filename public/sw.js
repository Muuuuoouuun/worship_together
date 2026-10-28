// v3: 방문한 화면과 빌드 코드 조각을 보관해, 오프라인에서도 이미 열어 본 화면(악보·무대)을 다시 열 수 있게 합니다.
//     네트워크가 되면 항상 서버 응답을 먼저 쓰고, 보관본은 실패했을 때만 씁니다.
const CACHE_VERSION = "worship-together-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const BUILD_CACHE = `${CACHE_VERSION}-build`;
/** 오프라인용으로 보관하는 방문 화면 수. 넘치면 오래된 것부터 지웁니다. */
const MAX_PAGES = 30;
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
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 해시가 붙은 빌드 조각은 내용이 바뀌지 않으므로 보관본을 먼저 씁니다.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, BUILD_CACHE));
  }
});

async function networkFirstNavigation(request, event) {
  const pageKey = pageCacheKey(request);
  try {
    const preloadResponse = await event.preloadResponse;
    const response = preloadResponse || (await fetch(request));

    if (response.ok && pageKey) {
      savePage(pageKey, response.clone());
    }

    return response;
  } catch {
    // 네트워크가 없으면: 이 화면의 마지막 보관본 → 오프라인 안내 순서로 돌려줍니다.
    const cachedPage = pageKey ? await caches.match(pageKey, { cacheName: PAGE_CACHE }) : undefined;
    return cachedPage || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

/** 로그인·초대·인증 콜백처럼 보관하면 안 되는 화면은 제외하고, 검색어는 유지합니다 (?tab= 등이 화면을 바꿈). */
function pageCacheKey(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/invite/") || url.pathname === "/login") {
    return null;
  }
  url.hash = "";
  return url.toString();
}

async function savePage(key, response) {
  try {
    const cache = await caches.open(PAGE_CACHE);
    await cache.put(key, response);
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) {
      await cache.delete(old);
    }
  } catch {
    // 저장 공간 부족 등은 조용히 넘깁니다. 다음 방문 때 다시 시도합니다.
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }

  return response;
}

function isStaticAsset(pathname) {
  return pathname === OFFLINE_URL || pathname.startsWith("/icons/");
}
