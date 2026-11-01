// v4: W 로고 아이콘 · 오프라인 화면을 새로 배포하고(예전 캐시를 지움), 방문한 화면과 빌드 코드 조각을 보관해
//     오프라인에서도 이미 열어 본 화면(악보 · 무대)을 다시 열 수 있게 합니다.
//     네트워크가 되면 항상 서버 응답을 먼저 쓰고, 보관본은 실패했을 때만 씁니다.
const CACHE_VERSION = "worship-together-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const BUILD_CACHE = `${CACHE_VERSION}-build`;
/** 오프라인용으로 보관하는 방문 화면 수. 넘치면 오래된 것부터 지웁니다. */
const MAX_PAGES = 30;
/** 보관하는 빌드 코드 조각 수. 배포마다 해시가 바뀌어 쌓이므로 넘치면 오래된 것부터 지웁니다. */
const MAX_BUILD_ENTRIES = 300;
/** 화면을 보관하기 전에 오류 · 이동 표시를 찾아보는 앞부분 크기 */
const PAGE_SCAN_BYTES = 512 * 1024;
/**
 * 불러오는 중 화면(app/loading.tsx) 때문에 화면은 먼저 200 으로 흘러나가고, 그 뒤의 redirect() · notFound() · 오류도
 * 200 으로 끝납니다. 그런 화면이 좋은 보관본을 덮어쓰지 않도록, HTML 안의 다음 표시가 있으면 보관하지 않습니다.
 * (Next 16 개발 · 배포 서버에서 직접 확인한 표시만 씁니다)
 * - NEXT_REDIRECT: redirect() (예: 로그아웃 상태의 /live/… → /login)
 * - NEXT_HTTP_ERROR_FALLBACK: notFound() (예: 없는 /session/…, "NEXT_HTTP_ERROR_FALLBACK;404")
 * - $RX( : 서버 화면 그리기가 오류로 끝나 브라우저에서 다시 그리라는 React 지시 (위 두 경우와 일반 오류 모두)
 * - E{\"digest\" : 서버 컴포넌트 오류 줄 (위 세 경우 모두)
 */
const ERROR_PAGE_MARKERS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "$RX(", 'E{\\"digest\\"'];
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
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
    event.respondWith(cacheFirst(request, STATIC_CACHE, event));
    return;
  }

  // 해시가 붙은 빌드 조각은 내용이 바뀌지 않으므로 보관본을 먼저 씁니다.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, BUILD_CACHE, event, MAX_BUILD_ENTRIES));
  }
});

async function networkFirstNavigation(request, event) {
  const pageKey = pageCacheKey(request);
  try {
    const preloadResponse = await event.preloadResponse;
    const response = preloadResponse || (await fetch(request));

    if (response.ok && pageKey && isHtml(response)) {
      // 응답을 돌려준 뒤에도 보관이 끝날 때까지 서비스 워커가 멈추지 않게 합니다.
      event.waitUntil(savePage(pageKey, response.clone()));
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

function isHtml(response) {
  return /^text\/html\b/i.test(response.headers.get("Content-Type") || "");
}

async function savePage(key, response) {
  try {
    // 오류 · 이동 화면이면 예전 보관본을 그대로 둡니다.
    if (await looksLikeErrorPage(response.clone())) return;
    await putAndTrim(PAGE_CACHE, key, response, MAX_PAGES);
  } catch {
    // 저장 공간 부족 · 도중에 끊긴 응답 등은 조용히 넘깁니다. 다음 방문 때 다시 시도합니다.
  }
}

/** 응답 앞부분(PAGE_SCAN_BYTES)에 ERROR_PAGE_MARKERS 가 있는지. 다 읽지 않은 나머지는 버립니다. */
async function looksLikeErrorPage(response) {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (bytes < PAGE_SCAN_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return ERROR_PAGE_MARKERS.some((marker) => text.includes(marker));
}

/** 넣고, 넘치면 먼저 넣은 것부터 지웁니다 (cache.keys() 는 넣은 순서). */
async function putAndTrim(cacheName, key, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
  if (!maxEntries) return;
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
    await cache.delete(old);
  }
}

async function cacheFirst(request, cacheName, event, maxEntries) {
  const cached = await caches.match(request, { cacheName });

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    event.waitUntil(putAndTrim(cacheName, request, response.clone(), maxEntries).catch(() => {}));
  }

  return response;
}

function isStaticAsset(pathname) {
  return pathname === OFFLINE_URL || pathname.startsWith("/icons/");
}

// 앱을 닫아도 오는 알림(푸시). 서버는 앱이 열린 기기에는 보내지 않으므로 받으면 항상 띄웁니다.
// 앱이 띄운 기기 알림과 같은 tag 를 써서 같은 알림이 두 번 쌓이지 않습니다.
function notificationUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch { /* 잘못된 주소는 홈으로 */ }
  return new URL('/dashboard', self.location.origin).href;
}

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
      data: { url: notificationUrl(typeof data.url === "string" ? data.url : "/dashboard") },
    }),
  );
});

// 기기 알림(예배 시작 · 받은 큐 · 팀 알림 · 푸시)을 누르면 열려 있는 앱 화면으로 가거나 새로 엽니다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = notificationUrl((event.notification.data && event.notification.data.url) || "/dashboard");
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
