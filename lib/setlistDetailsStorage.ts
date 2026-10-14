/**
 * 콘티별 세부 정보 (이번 주 Key·BPM·특이사항·리드, 콘티 담당·상태, 팀원 코멘트).
 * 곡 보관함의 콘티(곡 순서)와 별도로 이 브라우저에 저장됩니다.
 */

export interface SongSetlistOverride {
    songId: string;
    targetKey?: string | null;
    /** 콘티 만들기 화면의 '인도자 디렉팅 메모' (한 줄). notes 가 없을 때 특이사항으로 보여줍니다. */
    leaderNotes?: string | null;
    customBpm?: number | null;
    /** 특이사항 (줄 단위) */
    notes?: string[];
    /** 리드 싱어 이름 */
    lead?: string | null;
}

export interface SetlistComment {
    id: string;
    songId: string;
    author: string;
    text: string;
    createdAt: string;
}

export type SetlistDetailStatus = 'writing' | 'confirmed';

export interface SetlistDetailMetadata {
    setlistId: string;
    teamId: string;
    overrides: Record<string, SongSetlistOverride>;
    /** 콘티 담당자 이름 */
    owner?: string | null;
    status?: SetlistDetailStatus;
    comments?: SetlistComment[];
    updatedAt: string;
}

export type SetlistDetailPatch = Partial<Pick<SetlistDetailMetadata, 'overrides' | 'owner' | 'status' | 'comments'>>;

export const SETLIST_DETAILS_CHANGED_EVENT = 'worship:setlist-details-changed';

const LIMITS = { notes: 20, noteLength: 200, comments: 300, commentLength: 300, name: 40 } as const;

export function getSetlistDetailsKey(teamId: string, setlistId: string): string {
    return `worship:setlist-details:v1:${encodeURIComponent(teamId)}:${encodeURIComponent(setlistId)}`;
}

function text(value: unknown, max: number): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/** 저장된 값을 화면에서 믿고 쓸 수 있는 형태로 정리합니다. 형식이 맞지 않으면 null. */
export function sanitizeSetlistDetails(value: unknown, teamId: string, setlistId: string): SetlistDetailMetadata | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    if (!raw.overrides || typeof raw.overrides !== 'object') return null;

    const overrides: Record<string, SongSetlistOverride> = {};
    for (const [songId, entry] of Object.entries(raw.overrides as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') continue;
        const item = entry as Record<string, unknown>;
        const bpm = typeof item.customBpm === 'number' && Number.isInteger(item.customBpm) && item.customBpm >= 20 && item.customBpm <= 300 ? item.customBpm : null;
        const notes = Array.isArray(item.notes)
            ? item.notes.map((note) => text(note, LIMITS.noteLength)).filter((note): note is string => Boolean(note)).slice(0, LIMITS.notes)
            : undefined;
        overrides[songId] = {
            songId,
            targetKey: text(item.targetKey, 4),
            leaderNotes: text(item.leaderNotes, LIMITS.noteLength),
            customBpm: bpm,
            ...(notes ? { notes } : {}),
            lead: text(item.lead, LIMITS.name),
        };
    }

    const comments = Array.isArray(raw.comments)
        ? raw.comments
            .map((entry): SetlistComment | null => {
                if (!entry || typeof entry !== 'object') return null;
                const item = entry as Record<string, unknown>;
                const id = text(item.id, 80);
                const songId = text(item.songId, 200);
                const author = text(item.author, LIMITS.name);
                const body = text(item.text, LIMITS.commentLength);
                const createdAt = typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : null;
                return id && songId && author && body && createdAt ? { id, songId, author, text: body, createdAt } : null;
            })
            .filter((item): item is SetlistComment => item !== null)
            .slice(-LIMITS.comments)
        : [];

    return {
        setlistId,
        teamId,
        overrides,
        owner: text(raw.owner, LIMITS.name),
        status: raw.status === 'confirmed' ? 'confirmed' : raw.status === 'writing' ? 'writing' : undefined,
        comments,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    };
}

/** 예전 콘티 만들기 화면은 콘티 제목으로 저장했습니다. 그 기록을 찾을 때 쓰는 정보입니다. */
export interface LegacyLookup {
    title: string;
    /** 콘티가 만들어진 시각. 제목이 같은 다른 주 콘티와 구분하는 데 씁니다. */
    createdAt: string;
}

/** 제목으로 저장된 예전 기록은 콘티를 만들 때 함께 저장됐으므로, 생성 시각과 가까울 때만 그 콘티의 것으로 봅니다. */
export const LEGACY_MATCH_WINDOW_MS = 10 * 60 * 1000;

export function isLegacyMatch(savedAt: string, createdAt: string): boolean {
    const gap = Math.abs(Date.parse(savedAt) - Date.parse(createdAt));
    return Number.isFinite(gap) && gap <= LEGACY_MATCH_WINDOW_MS;
}

function readRaw(key: string): unknown {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
}

/**
 * 콘티 id 로 저장된 값을 읽습니다. 없으면 예전 방식(콘티 제목 키)으로 저장된 기록을 찾되,
 * 같은 제목의 다른 주 콘티 기록을 잘못 가져오지 않도록 생성 시각이 가까운 경우만 씁니다.
 */
export function readSetlistDetails(teamId: string, setlistId: string, legacy?: LegacyLookup): SetlistDetailMetadata | null {
    if (typeof window === 'undefined') return null;
    try {
        const byId = sanitizeSetlistDetails(readRaw(getSetlistDetailsKey(teamId, setlistId)), teamId, setlistId);
        if (byId || !legacy) return byId;
        const old = sanitizeSetlistDetails(readRaw(getSetlistDetailsKey(teamId, legacy.title)), teamId, setlistId);
        return old && isLegacyMatch(old.updatedAt, legacy.createdAt) ? old : null;
    } catch {
        return null;
    }
}

function write(meta: SetlistDetailMetadata): void {
    try {
        localStorage.setItem(getSetlistDetailsKey(meta.teamId, meta.setlistId), JSON.stringify(meta));
    } catch {
        throw new Error('콘티 정보를 저장하지 못했어요. 브라우저 저장 공간과 설정을 확인해주세요.');
    }
    window.dispatchEvent(new CustomEvent(SETLIST_DETAILS_CHANGED_EVENT, { detail: { teamId: meta.teamId, setlistId: meta.setlistId } }));
}

/** 기존 값(예전 제목 키 포함)에 바뀐 부분만 합쳐 콘티 id 로 저장합니다. */
export function updateSetlistDetails(teamId: string, setlistId: string, patch: SetlistDetailPatch, legacy?: LegacyLookup): SetlistDetailMetadata {
    const current = readSetlistDetails(teamId, setlistId, legacy);
    const next: SetlistDetailMetadata = {
        setlistId,
        teamId,
        overrides: patch.overrides ?? current?.overrides ?? {},
        owner: patch.owner !== undefined ? patch.owner : current?.owner ?? null,
        status: patch.status ?? current?.status,
        comments: (patch.comments ?? current?.comments ?? []).slice(-LIMITS.comments),
        updatedAt: new Date().toISOString(),
    };
    write(next);
    return next;
}

/** 콘티 만들기 화면에서 곡별 Key·BPM·메모를 저장합니다. 담당·상태·코멘트는 유지합니다. */
export function saveSetlistDetails(teamId: string, setlistId: string, overrides: Record<string, SongSetlistOverride>): void {
    if (typeof window === 'undefined') return;
    try {
        const current = readSetlistDetails(teamId, setlistId);
        updateSetlistDetails(teamId, setlistId, { overrides: { ...(current?.overrides ?? {}), ...overrides } });
    } catch {
        // 콘티 저장 자체는 이미 끝났으므로 세부 정보 저장 실패는 화면을 막지 않습니다.
    }
}

export const COMMON_KEYS = [
    'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
] as const;
