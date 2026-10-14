/**
 * 곡 보관함에 저장된 실제 콘티를 콘티·악보 화면 모델로 바꾸고,
 * 순서 화면의 편집 값을 저장할 형태로 검증·변환합니다. (저장소 접근 없음)
 */

import type { LibrarySetlist, LibrarySong } from '@/lib/libraryPrototypeStorage';
import { validateYouTubeUrl, type SongForm, type SongFormSection } from '@/lib/songForm';
import type { SetlistDetailMetadata, SongSetlistOverride } from '@/lib/setlistDetailsStorage';
import { normalizeLinkUrl, type StoredSongLink } from '@/lib/songLinksStorage';
import {
    LINK_LABEL,
    formCodeFromLabel,
    labelFromFormCode,
    relativeTime,
    seoulDateTime,
    type ContiSetlist,
    type ContiSong,
    type SetlistStatus,
    type SongLink,
} from './model';
import type { SetlistDraft, SongDraft } from './context';

export interface LiveSources {
    songs: LibrarySong[];
    setlists: LibrarySetlist[];
    details: Record<string, SetlistDetailMetadata | null>;
    forms: Record<string, SongForm | null>;
    links: Record<string, StoredSongLink[]>;
    today: string;
    now: Date;
}

export function statusFor(date: string, today: string, songCount: number, saved: SetlistDetailMetadata['status']): SetlistStatus {
    if (songCount === 0) return 'empty';
    if (date < today) return 'done';
    return saved === 'confirmed' ? 'confirmed' : 'writing';
}

function notesFrom(override: SongSetlistOverride | undefined): string[] {
    if (!override) return [];
    if (override.notes) return override.notes;
    return override.leaderNotes ? override.leaderNotes.split(/\r?\n/).map((note) => note.trim()).filter(Boolean) : [];
}

function linksFrom(form: SongForm | null | undefined, stored: StoredSongLink[] | undefined): SongLink[] {
    const links: SongLink[] = [];
    if (form?.youtubeUrl) links.push({ kind: 'video', label: LINK_LABEL.video, url: form.youtubeUrl });
    for (const link of stored ?? []) links.push({ kind: link.kind, label: link.label ?? LINK_LABEL[link.kind], url: link.url });
    return links;
}

export function buildContiSetlists(sources: LiveSources): ContiSetlist[] {
    const songById = new Map(sources.songs.map((song) => [song.id, song]));
    return sources.setlists.map((setlist) => {
        const details = sources.details[setlist.id] ?? null;
        const { date, time } = seoulDateTime(setlist.worship_date);
        const items: ContiSong[] = [];
        setlist.song_order.forEach((songId, index) => {
            const song = songById.get(songId);
            if (!song) return;
            const override = details?.overrides[songId];
            const form = sources.forms[songId];
            items.push({
                kind: 'song',
                id: `${setlist.id}:${index}`,
                songId,
                title: song.title,
                artist: song.artist,
                originalKey: song.original_key ?? '',
                key: override?.targetKey || song.original_key || '',
                bpm: override?.customBpm ?? song.bpm ?? null,
                lead: override?.lead ?? null,
                form: (form?.sections ?? []).map((section) => formCodeFromLabel(section.label)),
                links: linksFrom(form, sources.links[songId]),
                notes: notesFrom(override),
                comments: (details?.comments ?? [])
                    .filter((comment) => comment.songId === songId)
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((comment) => ({ id: comment.id, author: comment.author, text: comment.text, ago: relativeTime(comment.createdAt, sources.now), createdAt: comment.createdAt })),
            });
        });
        return {
            id: setlist.id,
            date,
            time,
            service: setlist.title,
            theme: setlist.theme ?? '',
            owner: details?.owner ?? null,
            status: statusFor(date, sources.today, items.length, details?.status),
            items,
        };
    });
}

/** 저장할 내용. 각 값은 이 화면이 직접 다루는 저장소 하나씩에 대응합니다. */
export interface SavePlan {
    /** 곡 보관함 콘티의 곡 순서 (바뀌지 않았으면 null) */
    order: string[] | null;
    owner: string | null;
    status: 'writing' | 'confirmed';
    overrides: Record<string, SongSetlistOverride>;
    /** 송폼 저장소에 쓸 곡별 송폼 (바뀐 곡만) */
    forms: SongForm[];
    /** 곡별 링크 (바뀐 곡만) */
    links: { songId: string; links: StoredSongLink[] }[];
}

export type PlanResult = { ok: true; plan: SavePlan } | { ok: false; error: string };

function sameCodes(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((code, index) => code === b[index]);
}

/** 위치와 코드가 같은 섹션은 기존 값(시작 시간 포함)을 살리고, 나머지는 새로 만듭니다. */
export function rebuildSections(existing: SongFormSection[], codes: string[], createId: () => string): SongFormSection[] {
    return codes.map((code, index) => {
        const previous = existing[index];
        if (previous && formCodeFromLabel(previous.label) === code) return previous;
        return { id: createId(), label: labelFromFormCode(code), startSeconds: null };
    });
}

function storedLinks(draft: SongDraft): StoredSongLink[] {
    const links: StoredSongLink[] = [];
    const sheet = normalizeLinkUrl(draft.sheet);
    const mr = normalizeLinkUrl(draft.mr);
    if (sheet) links.push({ kind: 'sheet', url: sheet });
    if (mr) links.push({ kind: 'mr', url: mr });
    return links;
}

function sameLinks(a: StoredSongLink[], b: StoredSongLink[]): boolean {
    return a.length === b.length && a.every((link, index) => link.kind === b[index].kind && link.url === b[index].url);
}

/**
 * 편집 값을 검증하고 저장 계획을 만듭니다.
 * 잘못된 값이 하나라도 있으면 아무것도 저장하지 않도록 오류를 돌려줍니다.
 */
export function planSave(input: {
    setlist: LibrarySetlist;
    songs: LibrarySong[];
    draft: SetlistDraft;
    canReorder: boolean;
    forms: Record<string, SongForm | null>;
    links: Record<string, StoredSongLink[]>;
    now: string;
    createId: () => string;
}): PlanResult {
    const { setlist, draft } = input;
    const songById = new Map(input.songs.map((song) => [song.id, song]));
    const overrides: Record<string, SongSetlistOverride> = {};
    const forms: SongForm[] = [];
    const links: SavePlan['links'] = [];

    for (const [songId, value] of Object.entries(draft.songs)) {
        const song = songById.get(songId);
        if (!song) continue;
        const name = `'${song.title}'`;

        const bpm = value.bpm.trim() ? Number(value.bpm) : null;
        if (bpm !== null && (!Number.isInteger(bpm) || bpm < 20 || bpm > 300)) {
            return { ok: false, error: `${name} BPM은 20~300 사이 숫자로 입력해주세요.` };
        }
        const video = value.video.trim() ? validateYouTubeUrl(value.video) : null;
        if (value.video.trim() && !video) return { ok: false, error: `${name} 원곡 영상은 YouTube 링크만 넣을 수 있어요.` };
        if (value.sheet.trim() && !normalizeLinkUrl(value.sheet)) return { ok: false, error: `${name} 악보 링크가 올바른 주소가 아니에요.` };
        if (value.mr.trim() && !normalizeLinkUrl(value.mr)) return { ok: false, error: `${name} MR 링크가 올바른 주소가 아니에요.` };

        overrides[songId] = {
            songId,
            targetKey: value.key && value.key !== song.original_key ? value.key : null,
            customBpm: bpm !== null && bpm !== song.bpm ? bpm : null,
            notes: value.notes.split(/\r?\n/).map((note) => note.trim()).filter(Boolean).slice(0, 20),
            lead: value.lead.trim() || null,
            leaderNotes: null,
        };

        const existing = input.forms[songId] ?? null;
        const existingCodes = (existing?.sections ?? []).map((section) => formCodeFromLabel(section.label));
        const formChanged = !sameCodes(existingCodes, value.form) || (existing?.youtubeUrl ?? null) !== video;
        if (formChanged && (existing || value.form.length || video)) {
            forms.push({
                version: 1,
                songId,
                youtubeUrl: video,
                source: existing && sameCodes(existingCodes, value.form) ? existing.source : 'manual',
                sections: rebuildSections(existing?.sections ?? [], value.form.slice(0, 100), input.createId),
                updatedAt: input.now,
            });
        }

        const nextLinks = storedLinks(value);
        if (!sameLinks(input.links[songId] ?? [], nextLinks)) links.push({ songId, links: nextLinks });
    }

    const orderChanged = input.canReorder && !sameCodes(setlist.song_order, draft.order);
    return {
        ok: true,
        plan: {
            order: orderChanged ? draft.order : null,
            owner: draft.owner.trim().slice(0, 40) || null,
            status: draft.status,
            overrides,
            forms,
            links,
        },
    };
}
