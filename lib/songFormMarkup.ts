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
    { label: 'Vamp', name: 'Vamp · 짧은 구절 계속 반복' },
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
    if (/^(Tag|Vamp)$/i.test(base)) return '#0f766e';
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
    else if (/^(vamp|뱀프)/.test(lower)) base = 'Vamp';
    else base = text.slice(0, SONG_FORM_LABEL_MAX - suffix.length) || '?';
    return `${base}${suffix}`;
}

/** Words people type for sections in team chats (lower-cased), on top of the chip labels themselves. */
const SECTION_WORDS: Readonly<Record<string, string>> = {
    전주: 'I', 인트로: 'I', intro: 'I', in: 'I',
    '1절': 'V1', '2절': 'V2', '3절': 'V3', 절: 'V1', verse: 'V1', verse1: 'V1', verse2: 'V2', verse3: 'V3',
    프리코러스: 'PC', 프리: 'PC', pre: 'PC', prechorus: 'PC',
    후렴: 'C', 코러스: 'C', chorus: 'C', 후렴2: 'C2', chorus2: 'C2',
    브릿지: 'B', 브리지: 'B', bridge: 'B',
    인터: '간주', inter: '간주', interlude: '간주',
    태그: 'Tag', 뱀프: 'Vamp', 엔딩: 'O', 아웃트로: 'O', 후주: 'O', outro: 'O', ending: 'O', out: 'O',
};

function sectionLabelFor(token: string): string | null {
    const chip = SONG_FORM_CHIPS.find((c) => c.label.toLowerCase() === token.toLowerCase());
    if (chip) return chip.label;
    if (/^(v|c|pc|b)\d$/i.test(token)) return token.toUpperCase();
    return SECTION_WORDS[token.toLowerCase()] ?? null;
}

/**
 * Reads a song form typed or pasted as text — "I - V1 - C×2 - O", "전주 1절 후렴 x2 브릿지" — into chip
 * labels. A repeat can ride on the section (C×2, Cx2, C*2) or follow it (x2, 2번, 2회). Words it can't
 * map stay as their own chips, cut to the label limit, and are listed in `custom` so the caller can say so.
 */
export function parseSongFormText(text: string): { sections: string[]; custom: string[] } {
    const sections: string[] = [];
    const custom: string[] = [];
    const withRepeat = (label: string, times: number) => {
        const suffix = times > 1 ? `×${times}` : '';
        return `${label.slice(0, SONG_FORM_LABEL_MAX - suffix.length)}${suffix}`;
    };
    for (const raw of text.replace(/[()[\]{}]/g, ' ').split(/[\s,·•→>|/–—-]+/).filter(Boolean)) {
        const trailing = raw.match(/^(?:[×xX*](\d)|(\d)(?:회|번))$/);
        if (trailing) {
            if (sections.length) sections[sections.length - 1] = withRepeat(splitRepeat(sections[sections.length - 1]).base, Number(trailing[1] ?? trailing[2]));
            continue;
        }
        const [, name, times] = raw.match(/^(.+?)(?:[×xX*](\d))?$/) ?? [raw, raw];
        const label = sectionLabelFor(name);
        if (!label) custom.push(name);
        sections.push(withRepeat(label ?? name, times ? Number(times) : 1));
    }
    return { sections: sections.slice(0, SONG_FORM_MAX_SECTIONS), custom };
}

/** The band as one line of text, the way song forms get shared in team chats. */
export function formatSongFormText(sections: readonly string[]): string {
    return sections.join(' - ');
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

/** Chip text size presets (viewBox units, page width = 1000). Stored on the mark as `fontSize`. */
export const SONG_FORM_SIZES: ReadonlyArray<{ label: string; fontSize: number }> = [
    { label: '작게', fontSize: 18 },
    { label: '보통', fontSize: 24 },
    { label: '크게', fontSize: 32 },
    { label: '최대', fontSize: 42 },
];
export const SONG_FORM_DEFAULT_FONT_SIZE = 24;
/** `opacity` below 1 renders the translucent "shade" style that lets the score show through. */
export const SONG_FORM_TINT_OPACITY = 0.35;

export function isSongFormTint(opacity: number | undefined): boolean {
    return opacity !== undefined && opacity < 1;
}

const PAGE_RIGHT = 988;
/** Keeps at least one chip's room between the anchor and the right edge. */
export const SONG_FORM_MAX_ANCHOR_X = PAGE_RIGHT - 160;

/** All band/marker dimensions scale linearly from the 24-unit "보통" size. */
export function songFormMetrics(fontSize = SONG_FORM_DEFAULT_FONT_SIZE) {
    const scale = fontSize / SONG_FORM_DEFAULT_FONT_SIZE;
    return {
        scale,
        fontSize,
        repeatFontSize: 17 * scale,
        chipHeight: 40 * scale,
        chipPadX: 13 * scale,
        arrowWidth: 26 * scale,
        rowGap: 10 * scale,
        platePad: 8 * scale,
    };
}

/** Bold sans-serif width estimate; SVG text cannot be measured without a DOM. */
function estimateTextWidth(text: string, fontSize: number): number {
    let width = 0;
    for (const char of text) {
        if (/[\u3131-\u318e\uac00-\ud7a3]/.test(char)) width += fontSize * 0.98;
        else if (/[A-Z0-9]/.test(char)) width += fontSize * 0.68;
        else if (char === ' ') width += fontSize * 0.3;
        else width += fontSize * 0.58;
    }
    return width;
}

export function songFormChipWidth(label: string, fontSize = SONG_FORM_DEFAULT_FONT_SIZE): number {
    const m = songFormMetrics(fontSize);
    const { base, repeat } = splitRepeat(label);
    const repeatWidth = repeat === null ? 0 : estimateTextWidth(`×${repeat}`, m.repeatFontSize) + 3 * m.scale;
    return Math.max(m.chipHeight, Math.round(estimateTextWidth(base, fontSize) + repeatWidth + m.chipPadX * 2));
}

export type SongFormChipBox = { label: string; x: number; y: number; width: number; height: number; color: string };
export type SongFormMarkupLayout = {
    plate: { x: number; y: number; width: number; height: number };
    chips: SongFormChipBox[];
    arrows: Array<{ x: number; y: number }>;
};

/** Lays chips left-to-right from `origin` (viewBox units), wrapping before a chip that would cross the page edge. */
export function layoutSongFormMarkup(
    sections: string[],
    origin: [number, number],
    fontSize = SONG_FORM_DEFAULT_FONT_SIZE
): SongFormMarkupLayout {
    const m = songFormMetrics(fontSize);
    const [originX, originY] = origin;
    const startX = originX + m.platePad;
    const rightLimit = PAGE_RIGHT - m.platePad;
    let x = startX;
    let y = originY + m.platePad;
    let maxRight = startX;
    const chips: SongFormChipBox[] = [];
    const arrows: SongFormMarkupLayout['arrows'] = [];

    sections.forEach((label, index) => {
        const width = songFormChipWidth(label, fontSize);
        const arrow = index > 0 ? m.arrowWidth : 0;
        if (index > 0 && x + arrow + width > rightLimit) {
            x = startX;
            y += m.chipHeight + m.rowGap;
        }
        if (arrow) {
            arrows.push({ x: x + m.arrowWidth / 2, y: y + m.chipHeight / 2 });
            x += m.arrowWidth;
        }
        chips.push({ label, x, y, width, height: m.chipHeight, color: songFormChipColor(label) });
        x += width;
        maxRight = Math.max(maxRight, x);
    });

    return {
        plate: {
            x: originX,
            y: originY,
            width: maxRight - originX + m.platePad,
            height: y + m.chipHeight + m.platePad - originY,
        },
        chips,
        arrows,
    };
}

/** Height of a single-row band; used to centre the band's first row on a tap point. */
export function songFormRowHeight(fontSize = SONG_FORM_DEFAULT_FONT_SIZE): number {
    const m = songFormMetrics(fontSize);
    return m.chipHeight + m.platePad * 2;
}

/** A section marker (kind 'section') is one chip whose top-left sits at `origin` (viewBox units). */
export function layoutSectionMarker(
    label: string,
    origin: [number, number],
    fontSize = SONG_FORM_DEFAULT_FONT_SIZE
): SongFormChipBox {
    return {
        label,
        x: origin[0],
        y: origin[1],
        width: songFormChipWidth(label, fontSize),
        height: songFormMetrics(fontSize).chipHeight,
        color: songFormChipColor(label),
    };
}
