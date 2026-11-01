import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFLINE_OWNER_KEY, syncOfflineCacheOwner } from '../lib/offlineCache';

function setup(owner: string | null, caches = ['worship-together-v4-pages', 'worship-together-v4-static']) {
    const values = new Map<string, string>(owner === null ? [] : [[OFFLINE_OWNER_KEY, owner]]);
    const store = new Set(caches);
    return {
        values, store,
        owners: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
        storage: { keys: async () => [...store], delete: async (name: string) => store.delete(name) },
    };
}

test('같은 사람이 다시 열면 화면 보관본을 그대로 둔다', async () => {
    const s = setup('user-a');
    assert.equal(await syncOfflineCacheOwner('user-a', s.owners, s.storage), false);
    assert.ok(s.store.has('worship-together-v4-pages'));
});

test('세션이 끝나 로그인하지 않은 상태가 되면 앞사람의 보관본을 지운다', async () => {
    const s = setup('user-a');
    assert.equal(await syncOfflineCacheOwner(null, s.owners, s.storage), true);
    assert.deepEqual([...s.store], ['worship-together-v4-static']);
    assert.equal(s.values.get(OFFLINE_OWNER_KEY), 'anon');
});

test('다른 계정으로 로그인하면 지우고, 주인을 모르는 옛 보관본도 지운다', async () => {
    const switched = setup('user-a');
    assert.equal(await syncOfflineCacheOwner('user-b', switched.owners, switched.storage), true);
    assert.equal(switched.values.get(OFFLINE_OWNER_KEY), 'user-b');
    const unknown = setup(null);
    assert.equal(await syncOfflineCacheOwner('user-a', unknown.owners, unknown.storage), true);
    assert.equal(unknown.store.has('worship-together-v4-pages'), false);
});

test('저장소를 쓸 수 없어도 오류 없이 지우는 쪽으로 처리한다', async () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const s = setup(null);
    assert.equal(await syncOfflineCacheOwner('user-a', broken, s.storage), true);
    assert.equal(s.store.has('worship-together-v4-pages'), false);
});
