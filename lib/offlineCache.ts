/**
 * 서비스 워커(public/sw.js)는 오프라인에서 다시 열 수 있게 방문한 화면 HTML 을 `<버전>-pages` 캐시에 보관합니다.
 * 이 화면에는 로그인한 사람의 팀 · 일정이 들어 있으므로, 로그아웃할 때 지워 같은 기기의 다음 사람이
 * 오프라인에서 앞사람의 화면을 보지 않게 합니다. 아이콘 · 빌드 조각 캐시는 개인 정보가 없어 남깁니다.
 */
export const PAGE_CACHE_SUFFIX = '-pages';

export function isPageCacheName(name: string): boolean {
    return name.startsWith('worship-together-') && name.endsWith(PAGE_CACHE_SUFFIX);
}

export async function clearOfflinePageCache(storage: Pick<CacheStorage, 'keys' | 'delete'> | undefined = globalThis.caches): Promise<number> {
    if (!storage) return 0;
    try {
        const names = (await storage.keys()).filter(isPageCacheName);
        await Promise.all(names.map((name) => storage.delete(name)));
        return names.length;
    } catch {
        // 저장소를 쓸 수 없는 환경(비공개 창 등)에서는 지울 것도 없습니다.
        return 0;
    }
}

/** 화면 보관본을 마지막으로 만든 사람 (localStorage). 로그인하지 않은 상태는 'anon'. */
export const OFFLINE_OWNER_KEY = 'worship-together:offline-owner';
const ANONYMOUS = 'anon';

type OwnerStore = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * 로그아웃 버튼을 거치지 않고 사람이 바뀐 경우(세션 만료 · 쿠키 삭제 · 다른 계정으로 로그인)에도
 * 앞사람의 화면 보관본이 오프라인에서 보이지 않게, 지금 사람과 마지막 보관 주인이 다르면 보관본을 지웁니다.
 * 주인을 모르면(처음 · 이 기능 이전 보관본) 안전하게 지웁니다. 지웠으면 true.
 */
export async function syncOfflineCacheOwner(
    currentUserId: string | null,
    owners: OwnerStore | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
    storage: Pick<CacheStorage, 'keys' | 'delete'> | undefined = globalThis.caches,
): Promise<boolean> {
    const current = currentUserId || ANONYMOUS;
    let previous: string | null = null;
    try { previous = owners?.getItem(OFFLINE_OWNER_KEY) ?? null; } catch { /* 저장소를 못 쓰면 모르는 주인으로 */ }
    const changed = previous !== current;
    if (changed) await clearOfflinePageCache(storage);
    try { owners?.setItem(OFFLINE_OWNER_KEY, current); } catch { /* 다음 방문 때 다시 확인 */ }
    return changed;
}
