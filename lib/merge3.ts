/*
 * 팀 공유 자료를 두 기기가 거의 동시에 고쳤을 때 합치는 규칙.
 * - 객체는 키마다, id 가 있는 항목 배열(곡 · 콘티 · 코멘트)은 id 마다 따로 합칩니다.
 * - 한쪽만 바꾼 부분은 바꾼 쪽을, 양쪽이 같은 곳을 다르게 바꿨으면 prefer 쪽을 씁니다.
 * - base(마지막으로 함께 본 값)가 없으면 지운 것과 새로 만든 것을 구분할 수 없으므로 양쪽에 있는 것을 모두 남깁니다.
 */

type Json = unknown;
type Entity = { id: string } & Record<string, unknown>;

const isObject = (value: Json): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isEntityArray = (value: Json): value is Entity[] => Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === 'string');

export function sameJson(a: Json, b: Json): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => sameJson(item, b[index]));
    const ak = Object.keys(a as object).filter((key) => (a as Record<string, unknown>)[key] !== undefined);
    const bk = Object.keys(b as object).filter((key) => (b as Record<string, unknown>)[key] !== undefined);
    return ak.length === bk.length && ak.every((key) => sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

export type MergePrefer = 'local' | 'remote';

export function mergeJson(base: Json, local: Json, remote: Json, prefer: MergePrefer = 'local'): Json {
    if (sameJson(local, remote)) return local;
    if (base !== undefined && sameJson(base, local)) return remote;
    if (base !== undefined && sameJson(base, remote)) return local;
    if (isObject(local) && isObject(remote)) {
        const from = isObject(base) ? base : undefined;
        const result: Record<string, unknown> = {};
        for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
            const inLocal = key in local && local[key] !== undefined;
            const inRemote = key in remote && remote[key] !== undefined;
            const inBase = Boolean(from && key in from && from[key] !== undefined);
            if (inLocal && inRemote) result[key] = mergeJson(from?.[key], local[key], remote[key], prefer);
            else if (inLocal) { if (!(inBase && sameJson(from![key], local[key]))) result[key] = local[key]; }
            else if (inRemote) { if (!(inBase && sameJson(from![key], remote[key]))) result[key] = remote[key]; }
        }
        return result;
    }
    if (isEntityArray(local) && isEntityArray(remote)) {
        const baseById = new Map(isEntityArray(base) ? base.map((item) => [item.id, item] as const) : []);
        const localById = new Map(local.map((item) => [item.id, item] as const));
        const remoteById = new Map(remote.map((item) => [item.id, item] as const));
        const ids = [...remote.map((item) => item.id), ...local.map((item) => item.id).filter((id) => !remoteById.has(id))];
        return ids.flatMap((id) => {
            const l = localById.get(id), r = remoteById.get(id), b = baseById.get(id);
            if (l && r) return [mergeJson(b, l, r, prefer)];
            const only = (l ?? r)!;
            // 한쪽에서 지웠고 다른 쪽은 손대지 않았으면 지운 쪽을 따릅니다.
            return b && sameJson(b, only) ? [] : [only];
        });
    }
    return prefer === 'local' ? local : remote;
}
