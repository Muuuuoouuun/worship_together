/** Ordered occurrences: repeated choruses have separate ids, never deduplicate labels. */
export interface SongFormSection {
    id: string;
    label: string;
    startSeconds: number | null;
}

export interface SongForm {
    version: 1;
    songId: string;
    youtubeUrl: string | null;
    source: 'manual' | 'chapters';
    sections: SongFormSection[];
    updatedAt: string;
}

export function validateYouTubeUrl(input: string): string | null {
    try {
        const url = new URL(input.trim());
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        const host = url.hostname.toLowerCase();
        let id: string | null = null;
        if (host === 'youtu.be' && /^\/[^/]+\/?$/.test(url.pathname)) id = url.pathname.split('/')[1];
        if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
            if (url.pathname === '/watch') id = url.searchParams.get('v');
            else id = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/)?.[1] ?? null;
        }
        return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
    } catch { return null; }
}

export function parseTimestamp(value: string): number | null {
    if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) return null;
    const parts = value.split(':').map(Number);
    if (parts[parts.length - 1] > 59 || (parts.length === 3 && parts[1] > 59)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
}

export function formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Parses supplied text only. No request, audio inference, or fabricated song structure. */
export function parseChapterText(text: string): { sections: SongFormSection[]; errors: string[] } {
    const sections: SongFormSection[] = [];
    const errors: string[] = [];
    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line) return;
        let match: string[] | null = line.match(/^(?:[-*•]\s*)?\[?(\d{1,3}:\d{2}(?::\d{2})?)\]?\s+(.+)$/);
        if (!match) {
            const trailing = line.match(/^(.+?)\s+\[?(\d{1,3}:\d{2}(?::\d{2})?)\]?$/);
            if (trailing) match = [trailing[0], trailing[2], trailing[1]];
        }
        if (!match) { errors.push(`${index + 1}행: 0:00 Intro 형식으로 입력해주세요.`); return; }
        const seconds = parseTimestamp(match[1]);
        const label = match[2].replace(/^[-–—|:]\s*/, '').trim();
        if (seconds === null || !label || label.length > 80) { errors.push(`${index + 1}행: 시간과 섹션 이름을 확인해주세요.`); return; }
        if (sections.length && seconds <= (sections[sections.length - 1].startSeconds ?? -1)) {
            errors.push(`${index + 1}행: 시간은 앞 섹션보다 뒤여야 합니다.`); return;
        }
        sections.push({ id: `chapter-${index}-${seconds}`, label, startSeconds: seconds });
    });
    if (!sections.length && !errors.length) errors.push('영상 설명의 타임스탬프·챕터 텍스트를 붙여넣어주세요.');
    if (sections.length > 100) errors.push('섹션은 최대 100개까지 입력할 수 있습니다.');
    return { sections, errors };
}

export function isSongForm(value: unknown): value is SongForm {
    if (!value || typeof value !== 'object') return false;
    const form = value as SongForm;
    return form.version === 1 && typeof form.songId === 'string' && typeof form.updatedAt === 'string'
        && (form.source === 'manual' || form.source === 'chapters')
        && (form.youtubeUrl === null || (typeof form.youtubeUrl === 'string' && validateYouTubeUrl(form.youtubeUrl) !== null))
        && Array.isArray(form.sections) && form.sections.length <= 100
        && form.sections.every(s => s && typeof s.id === 'string' && typeof s.label === 'string' && !!s.label.trim() && s.label.length <= 80
            && (s.startSeconds === null || (Number.isInteger(s.startSeconds) && s.startSeconds >= 0)))
        && new Set(form.sections.map(s => s.id)).size === form.sections.length;
}
