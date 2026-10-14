import type { SheetMark } from './sheetAnnotations';

/**
 * Who a mark is for. A mark with no part is for everyone (모두). Parts only filter what is shown;
 * stored marks are never changed to hide or show them.
 */
export const SHEET_PARTS = ['vocal', 'keys', 'guitar', 'bass', 'drums'] as const;
export type SheetPart = (typeof SHEET_PARTS)[number];

export const PART_ALL_LABEL = '모두';
export const PART_LABELS: Readonly<Record<SheetPart, string>> = {
    vocal: '보컬',
    keys: '건반',
    guitar: '기타',
    bass: '베이스',
    drums: '드럼',
};
/** The small tag shown on a part's marks in the workspace: one syllable and a hue that stays readable on white. */
export const PART_BADGES: Readonly<Record<SheetPart, { short: string; color: string }>> = {
    vocal: { short: '보', color: '#e11d48' },
    keys: { short: '건', color: '#7c3aed' },
    guitar: { short: '기', color: '#d97706' },
    bass: { short: '베', color: '#0f766e' },
    drums: { short: '드', color: '#2563eb' },
};

export const isSheetPart = (value: unknown): value is SheetPart => typeof value === 'string' && (SHEET_PARTS as readonly string[]).includes(value);

/** Song form marks (the band and its section markers) belong to the whole team and ignore `part`. */
export const ignoresPart = (mark: Pick<SheetMark, 'kind'>) => mark.kind === 'songform' || mark.kind === 'section';

/** The part a mark is shown for; undefined means everyone (also for song form marks, and for unknown values). */
export function markPart(mark: Pick<SheetMark, 'kind' | 'part'>): SheetPart | undefined {
    return ignoresPart(mark) || !isSheetPart(mark.part) ? undefined : mark.part;
}

/** Whether a mark shows when only `visible` parts are wanted (null = every part). Marks for everyone always show. */
export function isMarkVisible(mark: Pick<SheetMark, 'kind' | 'part'>, visible: ReadonlySet<SheetPart> | null): boolean {
    const part = markPart(mark);
    return !visible || part === undefined || visible.has(part);
}

/** marks → filtered marks, per marks array and visible set. Both are treated as immutable. */
const filtered = new WeakMap<readonly SheetMark[], WeakMap<ReadonlySet<SheetPart>, readonly SheetMark[]>>();

/**
 * The marks to show for the wanted parts: null shows everything; otherwise marks for everyone plus the
 * marks of the parts in `visible`. Returns the same array when nothing is hidden, and the same result for
 * the same inputs, so memoized consumers (the ink layer) don't redraw for a filter that changed nothing.
 */
export function marksForParts(marks: readonly SheetMark[], visible: ReadonlySet<SheetPart> | null): readonly SheetMark[] {
    if (!visible) return marks;
    const cached = filtered.get(marks)?.get(visible);
    if (cached) return cached;
    const shown = marks.filter((mark) => isMarkVisible(mark, visible));
    const result = shown.length === marks.length ? marks : shown;
    const bySet = filtered.get(marks) ?? new WeakMap<ReadonlySet<SheetPart>, readonly SheetMark[]>();
    bySet.set(visible, result);
    filtered.set(marks, bySet);
    return result;
}

/** A new mark made for `part` (null = everyone). Song form marks are left as they are. */
export function withMarkPart<T extends Pick<SheetMark, 'kind' | 'part'>>(mark: T, part: SheetPart | null): T {
    return part && !ignoresPart(mark) ? { ...mark, part } : mark;
}

/** Personal marks that the team copy doesn't already hold (same id = the same mark, e.g. right after publishing). */
export function marksNotIn(personal: readonly SheetMark[], team: readonly SheetMark[]): readonly SheetMark[] {
    const taken = new Set(team.map((mark) => mark.id));
    return personal.filter((mark) => !taken.has(mark.id));
}

/** A stored "내 파트" choice; anything unrecognised means everyone. */
export const parsePart = (raw: string | null | undefined): SheetPart | null => (isSheetPart(raw) ? raw : null);

/** A stored 보기 choice ('all' or 'vocal,keys'); null shows every part. Unknown names are dropped. */
export function parsePartSelection(raw: string | null | undefined): ReadonlySet<SheetPart> | null {
    const picked = new Set((raw ?? '').split(',').filter(isSheetPart));
    return picked.size === 0 || picked.size === SHEET_PARTS.length ? null : picked;
}

export const serializePartSelection = (selection: ReadonlySet<SheetPart> | null): string =>
    selection ? SHEET_PARTS.filter((part) => selection.has(part)).join(',') || 'all' : 'all';

/** Taps a part in the 보기 filter: adds or drops it. Dropping the last part, or adding the last missing one, shows all. */
export function togglePartInSelection(selection: ReadonlySet<SheetPart> | null, part: SheetPart): ReadonlySet<SheetPart> | null {
    const next = new Set(selection ?? []);
    if (next.has(part)) next.delete(part);
    else next.add(part);
    return next.size === 0 || next.size === SHEET_PARTS.length ? null : next;
}
