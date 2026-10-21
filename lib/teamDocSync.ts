import { mergeJson } from './merge3';

/*
 * 팀 공유 자료 동기화 (브라우저 쪽).
 * 온라인 팀의 콘티 · 곡 보관함 · 송폼 · 곡 링크는 서버(/api/teams/[teamId]/docs)가 원본입니다.
 * 화면은 지금처럼 브라우저 저장소를 읽고 쓰고, 여기서
 *  - 저장 함수가 알려 준 문서를 서버로 올리고 (markTeamDocDirty → 0.4초 뒤 올리기)
 *  - 다른 팀원이 바꾼 문서를 받아 브라우저 저장소에 써 넣은 뒤, 다른 탭이 바꾼 것처럼 storage 소식을 냅니다.
 * 두 기기가 같은 문서를 거의 동시에 고치면 서버가 거절(409)하고, 여기서 합친 뒤 다시 올립니다.
 * 올리지 못한 문서는 기억해 두었다가(새로고침해도) 연결이 돌아오면 올립니다.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus {
    state: SyncState;
    lastSyncedAt: number | null;
    /** 올리지 못하고 기다리는 문서 수 */
    pending: number;
    error: string | null;
}

interface Persisted {
    cursor: number;
    versions: Record<string, number>;
    pending: string[];
}

interface ServerDoc {
    key: string;
    json: string;
    version: number;
    updatedByName: string;
}

/** 다른 팀원이 바꾼 자료를 받거나, 권한이 없어 되돌렸을 때 화면에 알리는 소식 */
export const SYNC_NOTICE_EVENT = 'worship:sync-notice';
export interface SyncNotice {
    teamId: string;
    kind: 'received' | 'denied' | 'error';
    message: string;
}

const ONLINE_TEAMS_KEY = 'worship:online-teams:v1';
const stateKey = (teamId: string) => `worship:team-sync:v1:${encodeURIComponent(teamId)}`;
const enc = encodeURIComponent;

// 저장 함수들이 내는 소식 이름 (lib/*Storage.ts 와 같은 값 — 서로 가져오면 순환 참조가 생겨 여기 적어 둡니다)
const LIBRARY_CHANGED_EVENT = 'worship:library-changed';
const SETLIST_DETAILS_CHANGED_EVENT = 'worship:setlist-details-changed';
const SONG_FORM_CHANGED_EVENT = 'worship:song-form-changed';
const SONG_LINKS_CHANGED_EVENT = 'worship:song-links-changed';

type DocKind = 'library' | 'setlist-details' | 'song-form' | 'song-links';

/** 서버 lib/server/teamDocs.ts 의 classifyDocKey 와 같은 규칙 */
export function teamDocKind(teamId: string, key: string): DocKind | null {
    const team = enc(teamId);
    if (key === `worship-together:library:v1:${team}`) return 'library';
    if (key === `worship-together:song-links:v1:${team}`) return 'song-links';
    if (key.startsWith(`worship:setlist-details:v1:${team}:`) && key.length > `worship:setlist-details:v1:${team}:`.length) return 'setlist-details';
    if (key.startsWith(`worship-together:song-form:v1:${team}:`) && key.length > `worship-together:song-form:v1:${team}:`.length) return 'song-form';
    return null;
}

const base = new Map<string, string>();
const queues = new Map<string, Promise<void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const statuses = new Map<string, SyncStatus>();
const statusListeners = new Set<() => void>();
let registered = new Set<string>();

function storage(): Storage | null {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

function readJson<T>(key: string, fallback: T): T {
    try { return (JSON.parse(storage()?.getItem(key) ?? 'null') as T) ?? fallback; } catch { return fallback; }
}

function knownOnlineTeams(): Set<string> {
    if (registered.size) return registered;
    const stored = readJson<unknown>(ONLINE_TEAMS_KEY, []);
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
}

function load(teamId: string): Persisted {
    const value = readJson<Partial<Persisted>>(stateKey(teamId), {});
    return {
        cursor: typeof value.cursor === 'number' ? value.cursor : 0,
        versions: value.versions && typeof value.versions === 'object' ? value.versions : {},
        pending: Array.isArray(value.pending) ? value.pending.filter((key) => typeof key === 'string') : [],
    };
}

function save(teamId: string, value: Persisted) {
    try { storage()?.setItem(stateKey(teamId), JSON.stringify(value)); } catch { /* 저장 공간 부족은 다음 동기화 때 다시 */ }
}

function setStatus(teamId: string, patch: Partial<SyncStatus>) {
    const current = statuses.get(teamId) ?? { state: 'idle', lastSyncedAt: null, pending: 0, error: null };
    statuses.set(teamId, { ...current, ...patch });
    statusListeners.forEach((listener) => listener());
}

export function getSyncStatus(teamId: string): SyncStatus {
    return statuses.get(teamId) ?? { state: 'idle', lastSyncedAt: null, pending: load(teamId).pending.length, error: null };
}

export function subscribeSyncStatus(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
}

export function isOnlineTeam(teamId: string): boolean {
    return knownOnlineTeams().has(teamId);
}

function notify(detail: SyncNotice) {
    window.dispatchEvent(new CustomEvent<SyncNotice>(SYNC_NOTICE_EVENT, { detail }));
}

/** 다른 탭이 바꾼 것처럼 알려서, 저장소를 보는 화면들이 다시 읽게 합니다. */
function announce(teamId: string, key: string, value: string | null) {
    try { window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage })); } catch { /* 오래된 브라우저 */ }
    const kind = teamDocKind(teamId, key);
    const rest = (prefix: string) => decodeURIComponent(key.slice(prefix.length));
    if (kind === 'library') window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
    if (kind === 'song-links') window.dispatchEvent(new CustomEvent(SONG_LINKS_CHANGED_EVENT, { detail: { teamId } }));
    if (kind === 'setlist-details') window.dispatchEvent(new CustomEvent(SETLIST_DETAILS_CHANGED_EVENT, { detail: { teamId, setlistId: rest(`worship:setlist-details:v1:${enc(teamId)}:`) } }));
    if (kind === 'song-form') window.dispatchEvent(new CustomEvent(SONG_FORM_CHANGED_EVENT, { detail: { teamId, songId: rest(`worship-together:song-form:v1:${enc(teamId)}:`) } }));
}

function parse(json: string | null | undefined): unknown {
    if (json === null || json === undefined) return undefined;
    try { return JSON.parse(json); } catch { return undefined; }
}

function writeLocal(teamId: string, key: string, json: string) {
    if (storage()?.getItem(key) === json) return;
    try { storage()?.setItem(key, json); } catch { return; }
    announce(teamId, key, json);
}

/** 한 팀의 동기화 작업은 차례대로 (받기와 올리기가 엇갈리지 않게) */
function serial(teamId: string, task: () => Promise<void>): Promise<void> {
    const next = (queues.get(teamId) ?? Promise.resolve()).then(task, task);
    queues.set(teamId, next.catch(() => {}));
    return next;
}

/* ───── 받기 ───── */

async function pull(teamId: string) {
    const state = load(teamId);
    const firstSync = state.cursor === 0 && Object.keys(state.versions).length === 0;
    const response = await fetch(`/api/teams/${enc(teamId)}/docs?since=${state.cursor}`, { cache: 'no-store' });
    if (response.status === 401 || response.status === 403) throw new Error('auth');
    if (!response.ok) throw new Error('pull');
    const body = await response.json() as { docs: ServerDoc[]; cursor: number };
    const changedBy = new Set<string>();
    for (const doc of body.docs) {
        if (!teamDocKind(teamId, doc.key)) continue;
        const local = storage()?.getItem(doc.key) ?? null;
        const neverSynced = state.versions[doc.key] === undefined;
        const dirty = state.pending.includes(doc.key) || (neverSynced && local !== null);
        if (dirty && local !== null && local !== doc.json) {
            // 이 기기에서 아직 못 올린 변경이 있으면 합쳐서 다시 올립니다.
            const merged = JSON.stringify(mergeJson(parse(base.get(doc.key)), parse(local), parse(doc.json), neverSynced ? 'remote' : 'local'));
            writeLocal(teamId, doc.key, merged);
            if (!state.pending.includes(doc.key)) state.pending.push(doc.key);
        } else {
            writeLocal(teamId, doc.key, doc.json);
            state.pending = state.pending.filter((key) => key !== doc.key);
            if (local !== doc.json && !neverSynced) changedBy.add(doc.updatedByName);
        }
        base.set(doc.key, doc.json);
        state.versions[doc.key] = doc.version;
    }
    state.cursor = Math.max(state.cursor, body.cursor);
    if (firstSync) {
        // 처음 동기화하는 기기: 이 기기에만 있던 이 팀 자료를 서버로 올립니다 (예전에 이 브라우저에 만든 콘티).
        const store = storage();
        for (let index = 0; store && index < store.length; index += 1) {
            const key = store.key(index);
            if (key && teamDocKind(teamId, key) && state.versions[key] === undefined && !state.pending.includes(key)) state.pending.push(key);
        }
    }
    save(teamId, state);
    if (changedBy.size) notify({ teamId, kind: 'received', message: `${[...changedBy].join(', ')}님이 콘티를 바꿨어요` });
}

/* ───── 올리기 ───── */

async function pushOne(teamId: string, key: string): Promise<'done' | 'retry' | 'offline'> {
    const state = load(teamId);
    const json = storage()?.getItem(key) ?? null;
    if (json === null || (base.get(key) === json && state.versions[key] !== undefined)) return 'done';
    let response: Response;
    try {
        response = await fetch(`/api/teams/${enc(teamId)}/docs`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, json, baseVersion: state.versions[key] ?? 0 }),
        });
    } catch {
        return 'offline';
    }
    if (response.status === 401 || response.status >= 500) return 'offline';
    const body = await response.json().catch(() => ({})) as { version?: number; conflict?: ServerDoc | null; error?: string };
    const fresh = load(teamId);
    if (response.ok && typeof body.version === 'number') {
        base.set(key, json);
        fresh.versions[key] = body.version;
        save(teamId, fresh);
        return 'done';
    }
    if (response.status === 409 && body.conflict) {
        const merged = JSON.stringify(mergeJson(parse(base.get(key)), parse(json), parse(body.conflict.json), 'local'));
        base.set(key, body.conflict.json);
        fresh.versions[key] = body.conflict.version;
        save(teamId, fresh);
        writeLocal(teamId, key, merged);
        return 'retry';
    }
    // 권한이 없거나 받을 수 없는 자료: 서버 사본으로 되돌리고 알립니다.
    if (body.conflict) {
        writeLocal(teamId, key, body.conflict.json);
        base.set(key, body.conflict.json);
        fresh.versions[key] = body.conflict.version;
        save(teamId, fresh);
    }
    notify({ teamId, kind: response.status === 403 ? 'denied' : 'error', message: body.error ?? '팀 자료를 저장하지 못했어요.' });
    return 'done';
}

async function push(teamId: string) {
    let offline = false;
    for (let round = 0; round < 3; round += 1) {
        const state = load(teamId);
        if (!state.pending.length) break;
        const done: string[] = [];
        let again = false;
        for (const key of state.pending) {
            const result = await pushOne(teamId, key);
            if (result === 'done') done.push(key);
            else if (result === 'retry') again = true;
            else { offline = true; break; }
        }
        const fresh = load(teamId);
        fresh.pending = fresh.pending.filter((key) => !done.includes(key));
        save(teamId, fresh);
        if (offline || !again) break;
    }
    if (offline) throw new Error('offline');
}

/* ───── 바깥에서 부르는 것 ───── */

/** 이 기기에서 동기화할 온라인 팀 (로그인한 사람의 팀) */
export function registerOnlineTeams(teamIds: string[]) {
    registered = new Set(teamIds);
    try { storage()?.setItem(ONLINE_TEAMS_KEY, JSON.stringify(teamIds)); } catch { /* 무시 */ }
}

/** 받고 올리기. 끝나면 상태가 idle(또는 offline)로 바뀝니다. */
export function syncTeam(teamId: string): Promise<void> {
    if (!isOnlineTeam(teamId)) return Promise.resolve();
    return serial(teamId, async () => {
        setStatus(teamId, { state: 'syncing' });
        try {
            await pull(teamId);
            await push(teamId);
            setStatus(teamId, { state: 'idle', lastSyncedAt: Date.now(), pending: load(teamId).pending.length, error: null });
        } catch (error) {
            const offline = error instanceof Error && (error.message === 'offline' || error.name === 'TypeError');
            setStatus(teamId, { state: offline ? 'offline' : 'error', pending: load(teamId).pending.length, error: offline ? null : '팀 자료를 맞추지 못했어요.' });
        }
    });
}

/**
 * 저장 함수(콘티 · 곡 보관함 · 송폼 · 링크)가 브라우저 저장소에 쓴 직후 부릅니다.
 * 온라인 팀의 자료면 잠시 뒤 서버로 올립니다. 그 밖의 팀(이 브라우저 팀 · 예시)은 아무것도 하지 않습니다.
 */
export function markTeamDocDirty(teamId: string, key: string) {
    if (typeof window === 'undefined' || !isOnlineTeam(teamId) || !teamDocKind(teamId, key)) return;
    const state = load(teamId);
    if (!state.pending.includes(key)) {
        state.pending.push(key);
        save(teamId, state);
    }
    setStatus(teamId, { pending: state.pending.length });
    const timer = timers.get(teamId);
    if (timer) clearTimeout(timer);
    timers.set(teamId, setTimeout(() => {
        timers.delete(teamId);
        void serial(teamId, async () => {
            setStatus(teamId, { state: 'syncing' });
            try {
                await push(teamId);
                setStatus(teamId, { state: 'idle', lastSyncedAt: Date.now(), pending: load(teamId).pending.length, error: null });
            } catch {
                setStatus(teamId, { state: 'offline', pending: load(teamId).pending.length });
            }
        });
    }, 400));
}
