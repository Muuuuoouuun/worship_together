import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearOfflinePageCache, isPageCacheName } from '../lib/offlineCache';

function fakeStorage(names: string[]) {
    const store = new Set(names);
    return {
        store,
        keys: async () => [...store],
        delete: async (name: string) => store.delete(name),
    };
}

test('로그아웃 때는 화면 보관본만 지우고 아이콘 · 빌드 조각 캐시는 남긴다', async () => {
    const storage = fakeStorage(['worship-together-v4-pages', 'worship-together-v4-static', 'worship-together-v4-build', 'other-app-pages']);
    assert.equal(await clearOfflinePageCache(storage), 1);
    assert.deepEqual([...storage.store].sort(), ['other-app-pages', 'worship-together-v4-build', 'worship-together-v4-static']);
});

test('이전 버전의 화면 보관본도 지운다', async () => {
    const storage = fakeStorage(['worship-together-v3-pages', 'worship-together-v4-pages']);
    assert.equal(await clearOfflinePageCache(storage), 2);
    assert.equal(storage.store.size, 0);
});

test('저장소가 없거나 실패해도 로그아웃을 막지 않는다', async () => {
    assert.equal(await clearOfflinePageCache(undefined), 0);
    assert.equal(await clearOfflinePageCache({ keys: async () => { throw new Error('blocked'); }, delete: async () => false }), 0);
    assert.equal(isPageCacheName('worship-together-v4-static'), false);
});
