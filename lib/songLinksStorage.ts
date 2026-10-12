/**
 * 곡별 자료 링크 (악보·MR 등). 원곡 영상은 송폼 저장소의 youtubeUrl 을 그대로 씁니다.
 * 같은 곡을 다른 주에 다시 써도 링크가 따라가도록 곡 기준으로 이 브라우저에 저장합니다.
 */

export type StoredLinkKind = 'sheet' | 'mr' | 'other';

export interface StoredSongLink {
    kind: StoredLinkKind;
    url: string;
    label?: string;
}

export const SONG_LINKS_CHANGED_EVENT = 'worship:song-links-changed';

const KINDS: StoredLinkKind[] = ['sheet', 'mr', 'other'];

export function songLinksStorageKey(teamId: string): string {
    return `worship-together:song-links:v1:${encodeURIComponent(teamId)}`;
}

/** http(s) 주소만 허용합니다. 앞뒤 공백은 지우고, 주소가 아니면 null. */
export function normalizeLinkUrl(input: string): string | null {
    const value = input.trim();
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

export function sanitizeSongLinks(value: unknown): Record<string, StoredSongLink[]> {
    if (!value || typeof value !== 'object') return {};
    const result: Record<string, StoredSongLink[]> = {};
    for (const [songId, list] of Object.entries(value as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        const links = list
            .map((entry): StoredSongLink | null => {
                if (!entry || typeof entry !== 'object') return null;
                const item = entry as Record<string, unknown>;
                const kind = KINDS.find((candidate) => candidate === item.kind);
                const url = typeof item.url === 'string' ? normalizeLinkUrl(item.url) : null;
                if (!kind || !url) return null;
                const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim().slice(0, 30) : undefined;
                return { kind, url, ...(label ? { label } : {}) };
            })
            .filter((item): item is StoredSongLink => item !== null)
            .slice(0, 10);
        if (links.length) result[songId] = links;
    }
    return result;
}

export function readSongLinks(teamId: string): Record<string, StoredSongLink[]> {
    if (typeof window === 'undefined') return {};
    try {
        return sanitizeSongLinks(JSON.parse(localStorage.getItem(songLinksStorageKey(teamId)) ?? 'null'));
    } catch {
        return {};
    }
}

/** 한 곡의 링크 목록을 통째로 바꿉니다. 빈 목록이면 지웁니다. */
export function saveSongLinks(teamId: string, songId: string, links: StoredSongLink[]): void {
    const all = readSongLinks(teamId);
    const clean = sanitizeSongLinks({ [songId]: links })[songId] ?? [];
    if (clean.length) all[songId] = clean;
    else delete all[songId];
    try {
        localStorage.setItem(songLinksStorageKey(teamId), JSON.stringify(all));
    } catch {
        throw new Error('링크를 저장하지 못했어요. 브라우저 저장 공간과 설정을 확인해주세요.');
    }
    window.dispatchEvent(new CustomEvent(SONG_LINKS_CHANGED_EVENT, { detail: { teamId, songId } }));
}
