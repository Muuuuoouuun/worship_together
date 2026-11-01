import type { LiveMember, LiveScreenModel, LiveSong, LiveToast, LiveToastKind } from './model';

/*
 * 모델에서 화면이 바로 쓰는 값(지금 곡 · 다음 섹션 · 넘김 버튼 글자 …)을 한 번에 계산합니다.
 * 계산만 하고 상태는 없습니다 — 넘김 자체는 handlers.next / prev 가 맡습니다.
 */

export interface LivePosition {
    song: LiveSong;
    songIndex: number;
    prevSong: LiveSong | null;
    nextSong: LiveSong | null;
    /** 송폼이 있는 곡인지 */
    hasForm: boolean;
    /** 송폼이 없으면 -1 */
    sectionIndex: number;
    section: string | null;
    nextSection: string | null;
    atStart: boolean;
    atEnd: boolean;
    /** 다음 넘김이 무엇인지 */
    nextKind: 'section' | 'song' | 'end';
    /** 다음 넘김 버튼의 큰 글자 ('다음 섹션' · '다음 곡' · '마지막 섹션') */
    nextTitle: string;
    /** 다음 넘김 버튼의 작은 글자 (섹션 이름 · 곡 제목 · '예배 마무리') */
    nextName: string;
    /** 박 시계를 함께 쓰는 곳이 같은 순간에 1박부터 다시 세도록 */
    beatKey: string;
}

export function derivePosition(model: LiveScreenModel): LivePosition | null {
    if (model.songs.length === 0) return null;
    const songIndex = Math.max(0, Math.min(model.songIndex, model.songs.length - 1));
    const song = model.songs[songIndex];
    const hasForm = song.sections.length > 0;
    const sectionIndex = hasForm ? Math.max(0, Math.min(model.sectionIndex, song.sections.length - 1)) : -1;
    const section = hasForm ? song.sections[sectionIndex] : null;
    const nextSection = hasForm ? song.sections[sectionIndex + 1] ?? null : null;
    const nextSong = model.songs[songIndex + 1] ?? null;
    const nextKind = nextSection ? 'section' : nextSong ? 'song' : 'end';
    return {
        song,
        songIndex,
        prevSong: model.songs[songIndex - 1] ?? null,
        nextSong,
        hasForm,
        sectionIndex,
        section,
        nextSection,
        atStart: songIndex === 0 && sectionIndex <= 0,
        atEnd: nextKind === 'end',
        nextKind,
        nextTitle: nextKind === 'section' ? '다음 섹션' : nextKind === 'song' ? '다음 곡' : hasForm ? '마지막 섹션' : '마지막 곡',
        nextName: nextSection ?? nextSong?.title ?? '예배 마무리',
        beatKey: `${songIndex}-${sectionIndex}`,
    };
}

/** 송폼에서 이름으로 섹션 찾기 — 같은 이름(Chorus)이 여러 번이면 지금 이후의 첫 번째, 없으면 처음 것 */
export function sectionIndexOf(sections: string[], name: string, from: number): number {
    const ahead = sections.findIndex((item, index) => index >= Math.max(0, from) && item === name);
    return ahead >= 0 ? ahead : sections.indexOf(name);
}

/** 'Key D' · 'Key —' */
export function keyText(key: string | null): string {
    return key?.trim() ? key.trim() : '—';
}

/** 곡 한 줄 요약 — 'Key D · 72 BPM · 4/4' (모르는 값은 빼거나 — 로) */
export function songMeta(song: LiveSong, options: { key?: boolean } = {}): string {
    const parts = [options.key === false ? null : `Key ${keyText(song.key)}`, song.bpm ? `${song.bpm} BPM` : '— BPM', song.meter];
    return parts.filter(Boolean).join(' · ');
}

/** 따라가는 사람에게 보여 줄 진행자 — '김하늘님' · '김하늘님 외 1명' */
export function controllerText(names: string[]): string | null {
    if (names.length === 0) return null;
    return names.length > 1 ? `${names[0]}님 외 ${names.length - 1}명` : `${names[0]}님`;
}

/** 접속한 사람 먼저, 그 안에서는 진행자 → 나 → 이름 순 */
export function sortMembers(members: LiveMember[]): LiveMember[] {
    return [...members].sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (a.controller !== b.controller) return a.controller ? -1 : 1;
        if (a.me !== b.me) return a.me ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
    });
}

/** 위 가운데 아일랜드에 뜨는 알림 (연주 큐) */
export const CUE_KINDS: ReadonlySet<LiveToastKind> = new Set<LiveToastKind>(['cue-all', 'cue-role', 'cue-sent']);

export function splitToasts(toasts: LiveToast[]) {
    return {
        cues: toasts.filter((toast) => CUE_KINDS.has(toast.kind)),
        notices: toasts.filter((toast) => !CUE_KINDS.has(toast.kind)),
    };
}
