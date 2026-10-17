/**
 * 무대(예배 화면)에서 곡마다 쓸 값을 정합니다. (저장소 접근 없음)
 * 콘티에 정한 이번 주 Key·BPM 이 있으면 그것을, 없으면 곡 보관함의 원곡 값을 씁니다.
 */

import { directionNotesOf, validCustomBpm, type SetlistDetailMetadata, type SongSetlistOverride } from '@/lib/setlistDetailsStorage';

export interface StageSongInput {
    id: string;
    original_key: string | null;
    bpm: number | null;
}

export interface StageSongPlan {
    songId: string;
    /** 곡 보관함의 원곡 Key */
    originalKey: string | null;
    /** 이번 주에 연주하는 Key (콘티의 이번 주 Key → 원곡 Key) */
    key: string | null;
    /** 이번 주 Key 가 원곡 Key 와 다른지 */
    keyChanged: boolean;
    /** 이번 주 BPM (콘티의 BPM → 곡 보관함 기본 BPM) */
    bpm: number | null;
    /** 인도자 디렉팅 메모(특이사항) */
    directionNotes: string[];
    /** 이 곡에서 다음 곡으로 넘어갈 때의 메모 */
    transitionNote: string | null;
}

function cleanKey(value: string | null | undefined): string | null {
    const key = value?.trim();
    return key ? key : null;
}

/** 이번 주 Key(없으면 원곡 Key)와 원곡 Key, 둘이 다른지를 돌려줍니다. */
export function resolveKey(originalKey: string | null | undefined, targetKey: string | null | undefined): Pick<StageSongPlan, 'key' | 'originalKey' | 'keyChanged'> {
    const original = cleanKey(originalKey);
    const key = cleanKey(targetKey) ?? original;
    return { key, originalKey: original, keyChanged: key !== null && original !== null && key !== original };
}

export function resolveSongPlan(song: StageSongInput, override?: SongSetlistOverride | null): StageSongPlan {
    return {
        songId: song.id,
        ...resolveKey(song.original_key, override?.targetKey),
        bpm: validCustomBpm(override?.customBpm) ?? song.bpm,
        directionNotes: directionNotesOf(override),
        transitionNote: override?.transitionNote?.trim() || null,
    };
}

/** 곡 id → 무대용 값. 같은 곡이 콘티에 두 번 들어가도 한 번만 계산합니다. */
export function resolveSetlistPlans(songs: StageSongInput[], details: SetlistDetailMetadata | null): Record<string, StageSongPlan> {
    const plans: Record<string, StageSongPlan> = {};
    for (const song of songs) {
        if (!plans[song.id]) plans[song.id] = resolveSongPlan(song, details?.overrides[song.id]);
    }
    return plans;
}

type KeyParts = Pick<StageSongPlan, 'key' | 'originalKey' | 'keyChanged'>;

/** 무대에 보여줄 Key. 원곡과 다르면 원곡도 함께: 'D (원키 C)'. Key 를 모르면 빈 문자열. */
export function formatKey(plan: KeyParts | null | undefined): string {
    if (!plan?.key) return '';
    return plan.keyChanged && plan.originalKey ? `${plan.key} (원키 ${plan.originalKey})` : plan.key;
}

/** 'Key D (원키 C)' 처럼 'Key' 를 붙인 표기. Key 를 모르면 빈 문자열. */
export function formatKeyLabel(plan: KeyParts | null | undefined): string {
    const key = formatKey(plan);
    return key ? `Key ${key}` : '';
}

/**
 * 곡 목록의 BPM 을 이번 주 BPM 으로 바꿉니다. 바뀐 곡이 없으면 같은 배열을 돌려줍니다.
 * 라이브 화면의 템포 기본값(곡을 넘길 때 맞추는 BPM)이 이 값을 따르게 하려는 용도입니다.
 */
export function applyBpmOverrides<T extends { id: string; bpm: number | null }>(songs: T[], details: SetlistDetailMetadata | null): T[] {
    if (!details) return songs;
    let changed = false;
    const next = songs.map((song) => {
        const bpm = validCustomBpm(details.overrides[song.id]?.customBpm);
        if (bpm === null || bpm === song.bpm) return song;
        changed = true;
        return { ...song, bpm };
    });
    return changed ? next : songs;
}

/**
 * 라이브 화면 상태에 들어 있는 BPM 을 이번 주 BPM 에 맞춥니다.
 * 상태의 BPM 이 곡의 기본 BPM 그대로(또는 비어 있음)일 때만 바꾸고, 인도자가 직접 정한 값은 건드리지 않습니다.
 */
export function resolveStateBpm(
    stateBpm: number | null,
    songId: string | null,
    original: Array<{ id: string; bpm: number | null }>,
    effective: Array<{ id: string; bpm: number | null }>,
): number | null {
    if (!songId) return stateBpm;
    const before = original.find((song) => song.id === songId)?.bpm ?? null;
    const after = effective.find((song) => song.id === songId)?.bpm ?? null;
    if (stateBpm !== null && stateBpm !== before) return stateBpm;
    return after ?? stateBpm;
}

/**
 * 무대 화면 컴포넌트는 곡의 `original_key` 를 '지금 연주하는 Key' 로 보여줍니다.
 * 이번 주 Key 가 있는 곡은 그 필드에 이번 주 Key 를 담은 복사본으로 바꿔 줍니다. (표시 전용)
 */
export function withStageKeys<T extends StageSongInput>(songs: T[], plans: Record<string, StageSongPlan>): T[] {
    return songs.map((song) => {
        const plan = plans[song.id];
        return plan && plan.key !== song.original_key ? { ...song, original_key: plan.key } : song;
    });
}
