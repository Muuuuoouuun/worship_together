import type { SheetMark } from './sheetAnnotations';
import { splitRepeat } from './songFormMarkup';

export type SongFormStop = {
    /** Band chip label, e.g. "C×2". */
    label: string;
    /** 1-based page of the section marker where this section starts; null when none is placed. */
    page: number | null;
    markId: string | null;
    /** Set when the marker belongs to a sibling section, e.g. V2 played from V1's measures. */
    sharedWith: string | null;
};

export type SongFormRoute = { bandPage: number; bandId: string; stops: SongFormStop[] };

/** "V2" → "V", "C2" → "C"; sections without a number have no siblings. */
const familyOf = (base: string) => base.replace(/\d+$/, '');

/**
 * The song form as stops a pedal can walk through: the band on the first page that has one, each
 * section resolved to the marker where it starts. When a section has several markers, the next one
 * further down the sheet wins over one already passed (a second chorus marker is used for the second
 * chorus); otherwise the walk goes back to the first. A section without its own marker borrows a
 * numbered sibling's (V2 → V1) because those usually share the printed music.
 */
export function songFormRoute(pages: ReadonlyArray<{ marks: readonly SheetMark[] }>): SongFormRoute | null {
    const bandIndex = pages.findIndex((p) => p.marks.some((m) => m.kind === 'songform' && m.sections?.length));
    if (bandIndex < 0) return null;
    const band = pages[bandIndex].marks.find((m) => m.kind === 'songform' && m.sections?.length);
    const sections = band?.sections ?? [];
    const markers = pages
        .flatMap((p, i) =>
            p.marks
                .filter((m) => m.kind === 'section' && m.text)
                .map((m) => ({ id: m.id, page: i + 1, x: m.points[0][0], y: m.points[0][1], base: splitRepeat(m.text ?? '').base }))
        )
        .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

    let cursor = -1;
    const pick = (matches: (base: string) => boolean) => {
        const found = markers.map((m, i) => ({ m, i })).filter(({ m }) => matches(m.base));
        return found.find(({ i }) => i > cursor) ?? found[0] ?? null;
    };
    const stops = sections.map((label): SongFormStop => {
        const base = splitRepeat(label).base;
        let hit = pick((b) => b === base);
        let sharedWith: string | null = null;
        if (!hit && familyOf(base) !== base) {
            hit = pick((b) => familyOf(b) === familyOf(base));
            sharedWith = hit?.m.base ?? null;
        }
        if (!hit) return { label, page: null, markId: null, sharedWith: null };
        cursor = hit.i;
        return { label, page: hit.m.page, markId: hit.m.id, sharedWith };
    });
    return { bandPage: bandIndex + 1, bandId: band?.id ?? '', stops };
}
