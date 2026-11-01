import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { clearOfflinePageCache, isPageCacheName } from '../lib/offlineCache';

/*
 * 캐시 이름은 서비스 워커(public/sw.js)에서 읽어 옵니다. sw.js 의 CACHE_VERSION · 이름 끝(-pages 등)을 바꿨는데
 * lib/offlineCache.ts 가 따라오지 않으면 로그아웃 때 화면 보관본이 남으므로, 이 테스트가 실패해야 합니다.
 */
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const version = sw.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
/** sw.js 의 `const PAGE_CACHE = \`${CACHE_VERSION}-pages\`;` 같은 줄에서 이름을 만듭니다. */
const swCaches = new Map([...sw.matchAll(/const (\w+_CACHE) = `\$\{CACHE_VERSION\}(-[\w-]+)`;/g)].map(([, constant, suffix]) => [constant, `${version}${suffix}`]));
const cacheName = (constant: string) => {
    const name = swCaches.get(constant);
    assert.ok(version && name, `public/sw.js 에서 ${constant} 를 찾지 못했습니다`);
    return name;
};
const PAGES = cacheName('PAGE_CACHE');
const STATIC = cacheName('STATIC_CACHE');
const BUILD = cacheName('BUILD_CACHE');
/** 이전 배포의 화면 보관본 (버전 숫자 하나 낮춤) */
const PREVIOUS_PAGES = PAGES.replace(/v(\d+)(?=-)/, (_, n: string) => `v${Math.max(0, Number(n) - 1)}`);

test('sw.js 의 캐시 이름을 읽어 왔고, 화면 보관본 이름만 화면 보관본으로 본다', () => {
    assert.match(PAGES, /^worship-together-v\d+-pages$/);
    assert.notEqual(PREVIOUS_PAGES, PAGES);
    assert.equal(isPageCacheName(PAGES), true);
    assert.equal(isPageCacheName(STATIC), false);
    assert.equal(isPageCacheName(BUILD), false);
});

function fakeStorage(names: string[]) {
    const store = new Set(names);
    return {
        store,
        keys: async () => [...store],
        delete: async (name: string) => store.delete(name),
    };
}

test('로그아웃 때는 화면 보관본만 지우고 아이콘 · 빌드 조각 캐시는 남긴다', async () => {
    const storage = fakeStorage([PAGES, STATIC, BUILD, 'other-app-pages']);
    assert.equal(await clearOfflinePageCache(storage), 1);
    assert.deepEqual([...storage.store].sort(), ['other-app-pages', BUILD, STATIC].sort());
});

test('이전 버전의 화면 보관본도 지운다', async () => {
    const storage = fakeStorage([PREVIOUS_PAGES, PAGES]);
    assert.equal(await clearOfflinePageCache(storage), 2);
    assert.equal(storage.store.size, 0);
});

test('저장소가 없거나 실패해도 로그아웃을 막지 않는다', async () => {
    assert.equal(await clearOfflinePageCache(undefined), 0);
    assert.equal(await clearOfflinePageCache({ keys: async () => { throw new Error('blocked'); }, delete: async () => false }), 0);
    assert.equal(isPageCacheName(STATIC), false);
});
