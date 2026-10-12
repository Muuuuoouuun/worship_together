/**
 * Song form "markup band": a row of section chips (I → V1 → C …) burned into a
 * sheet page's annotation layer. Stored as a SheetMark of kind 'songform' whose
 * points[0] is the band's top-left anchor (0..1000 normalized like other marks).
 * Layout math is in viewBox units (page width = 1000).
 */

export const SONG_FORM_MAX_SECTIONS = 32;
export const SONG_FORM_LABEL_MAX = 12;

export const SONG_FORM_CHIPS: ReadonlyArray<{ label: string; name: string }> = [
    { label: 'I', name: 'Intro · 전주' },
    { label: 'V1', name: 'Verse 1 · 1절' },
    { label: 'V2', name: 'Verse 2 · 2절' },
    { label: 'V3', name: 'Verse 3 · 3절' },
    { label: 'PC', name: 'Pre-Chorus · 프리코러스' },
    { label: 'C', name: 'Chorus · 후렴' },
    { label: 'B', name: 'Bridge · 브릿지' },
    { label: '간주', name: 'Interlude · 간주' },
    { label: 'Tag', name: 'Tag · 끝 구절 반복' },
    { label: 'O', name: 'Outro · 엔딩' },
];

export const SONG_FORM_PRESETS: ReadonlyArray<{ name: string; sections: string[] }> = [
    { name: '기본', sections: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'] },
    { name: '프리코러스', sections: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'B', 'C×2', 'O'] },
    { name: '짧은 곡', sections: ['I', 'V1', 'C×2', 'B', 'C', 'O'] },
];

const REPEAT_SUFFIX = /×(\d+)$/;

export function splitRepeat(label: string): { base: string; repeat: number | null } {
    const match = label.match(REPEAT_SUFFIX);
    return match
        ? { base: label.slice(0, -match[0].length).trim(), repeat: Number(match[1]) }
        : { base: label, repeat: null };
}

/** Sets the ×n suffix; applying the same count again (or n <= 1) removes it. */
export function toggleRepeat(label: string, times: number): string {
    const { base, repeat } = splitRepeat(label);
    return times <= 1 || repeat === times ? base : `${base}×${times}`;
}

export function songFormChipColor(label: string): string {
    const { base } = splitRepeat(label);
    if (/^PC\d*$/i.test(base)) return '#9333ea';
    if (/^V\d*$/i.test(base)) return '#2563eb';
    if (/^C\d*$/i.test(base)) return '#dc2626';
    if (/^B\d*$/i.test(base)) return '#15803d';
    if (/^(I|O|E)$/i.test(base)) return '#475569';
    if (/간주|^Int/i.test(base)) return '#b45309';
    return '#0f172a';
}

/** Maps a saved song-form label ("2. Verse 1", "후렴 x2") to its chip label ("V1", "C×2"). */
export function abbreviateSectionLabel(raw: string): string {
    let text = raw.replace(/^\d+[.)]\s*/, '').trim();
    let suffix = '';
    const repeat = text.match(/(?:\s+[x×]|×)\s*(\d)$/i);
    if (repeat) {
        suffix = Number(repeat[1]) > 1 ? `×${repeat[1]}` : '';
        text = text.slice(0, -repeat[0].length).trim();
    }
    const lower = text.toLowerCase();
    const number = text.match(/(\d+)/)?.[1] ?? '';
    let base: string;
    if (/^(intro|인트로|전주)/.test(lower)) base = 'I';
    else if (/^(pre[-\s]?chorus|프리\s*코러스)/.test(lower)) base = 'PC';
    else if (/^(verse|벌스)/.test(lower) || /^\d+\s*절/.test(lower)) base = `V${number}`;
    else if (/^(chorus|코러스|후렴)/.test(lower)) base = 'C';
    else if (/^(bridge|브릿지|브리지)/.test(lower)) base = 'B';
    else if (/^(interlude|instrumental|간주)/.test(lower)) base = '간주';
    else if (/^(outro|ending|아웃트로|엔딩|후주)/.test(lower)) base = 'O';
    else if (/^tag/.test(lower)) base = 'Tag';
    else base = text.slice(0, SONG_FORM_LABEL_MAX - suffix.length) || '?';
    return `${base}${suffix}`;
}

export function isValidSongFormSections(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= SONG_FORM_MAX_SECTIONS &&
        value.every((label) => typeof label === 'string' && label.trim().length > 0 && label.length <= SONG_FORM_LABEL_MAX)
    );
}

export const SONG_FORM_DEFAULT_ANCHOR: [number, number] = [16, 3];

const FONT_SIZE = 24;
const REPEAT_FONT_SIZE = 17;
const CHIP_HEIGHT = 40;
const CHIP_PAD_X = 13;
const ARROW_WIDTH = 26;
const ROW_GAP = 10;
const PLATE_PAD = 8;
const PAGE_RIGHT = 988;
/** Keeps at least one chip's room between the anchor and the right edge. */
export const SONG_FORM_MAX_ANCHOR_X = PAGE_RIGHT - 160;

export const SONG_FORM_CHIP_FONT_SIZE = FONT_SIZE;
export const SONG_FORM_REPEAT_FONT_SIZE = REPEAT_FONT_SIZE;

/** Bold sans-serif width estimate; SVG text cannot be measured without a DOM. */
function estimateTextWidth(text: string, fontSize: number): number {
    let width = 0;
    for (const char of text) {
        if (/[ㄱ-ㆎ가-힣]/.test(char)) width += fontSize * 0.98;
        else if (/[A-Z0-9]/.test(char)) width += fontSize * 0.68;
        else if (char === ' ') width += fontSize * 0.3;
        else width += fontSize * 0.58;
    }
    return width;
}

export function songFormChipWidth(label: string): number {
    const { base, repeat } = splitRepeat(label);
    const repeatWidth = repeat === null ? 0 : estimateTextWidth(`×${repeat}`, REPEAT_FONT_SIZE) + 3;
    return Math.max(CHIP_HEIGHT, Math.round(estimateTextWidth(base, FONT_SIZE) + repeatWidth + CHIP_PAD_X * 2));
}

export type SongFormChipBox = { label: string; x: number; y: number; width: number; height: number; color: string };
export type SongFormMarkupLayout = {
    plate: { x: number; y: number; width: number; height: number };
    chips: SongFormChipBox[];
    arrows: Array<{ x: number; y: number }>;
};

/** Lays chips left-to-right from `origin` (viewBox units), wrapping before a chip that would cross the page edge. */
export function layoutSongFormMarkup(sections: string[], origin: [number, number]): SongFormMarkupLayout {
    const [originX, originY] = origin;
    const startX = originX + PLATE_PAD;
    const rightLimit = PAGE_RIGHT - PLATE_PAD;
    let x = startX;
    let y = originY + PLATE_PAD;
    let maxRight = startX;
    const chips: SongFormChipBox[] = [];
    const arrows: SongFormMarkupLayout['arrows'] = [];

    sections.forEach((label, index) => {
        const width = songFormChipWidth(label);
        const arrow = index > 0 ? ARROW_WIDTH : 0;
        if (index > 0 && x + arrow + width > rightLimit) {
            x = startX;
            y += CHIP_HEIGHT + ROW_GAP;
        }
        if (arrow) {
            arrows.push({ x: x + ARROW_WIDTH / 2, y: y + CHIP_HEIGHT / 2 });
            x += ARROW_WIDTH;
        }
        chips.push({ label, x, y, width, height: CHIP_HEIGHT, color: songFormChipColor(label) });
        x += width;
        maxRight = Math.max(maxRight, x);
    });

    return {
        plate: {
            x: originX,
            y: originY,
            width: maxRight - originX + PLATE_PAD,
            height: y + CHIP_HEIGHT + PLATE_PAD - originY,
        },
        chips,
        arrows,
    };
}

/** Height of a single-row band; used to centre the band's first row on a tap point. */
export const SONG_FORM_ROW_HEIGHT = CHIP_HEIGHT + PLATE_PAD * 2;
