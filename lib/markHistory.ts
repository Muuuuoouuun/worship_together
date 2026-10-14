import type { SheetDocument, SheetMark } from './sheetAnnotations';

/**
 * Undo history for the marks on each page. Every edit that changes one page's marks (draw, erase, move,
 * clear, song form chips) is one step, so 되돌리기 brings back an erased or cleared mark too.
 * Steps hold the page's marks arrays before and after, which the edit created anyway, so history is cheap.
 */
export type MarkHistoryStep = { before: SheetMark[]; after: SheetMark[]; at: number; coalesce: boolean };
export type PageHistory = { undo: MarkHistoryStep[]; redo: MarkHistoryStep[] };
/** Keyed by page index. */
export type SheetHistory = Readonly<Record<number, PageHistory>>;

export const EMPTY_HISTORY: SheetHistory = {};
export const HISTORY_LIMIT = 100;
/** Arrow-key nudges this close together undo as one move. */
const COALESCE_MS = 1000;

const EMPTY_PAGE: PageHistory = { undo: [], redo: [] };

/**
 * Records `prev → next`. Edits outside a single page's marks (pages added, removed or rotated, another
 * document loaded) clear the history, since old steps would no longer fit the pages. A page image swapped
 * with its marks untouched (a key change) keeps it.
 */
export function recordSheetChange(
    history: SheetHistory,
    prev: SheetDocument | null,
    next: SheetDocument,
    now: number,
    coalesce = false
): SheetHistory {
    if (prev === next) return history;
    if (!prev || prev.pages.length !== next.pages.length) return EMPTY_HISTORY;
    let changed = -1;
    for (const [index, page] of next.pages.entries()) {
        const before = prev.pages[index];
        if (before.marks === page.marks) continue;
        if (changed !== -1 || before.image !== page.image || before.width !== page.width || before.height !== page.height) return EMPTY_HISTORY;
        changed = index;
    }
    if (changed === -1) return history;

    const before = prev.pages[changed].marks;
    const after = next.pages[changed].marks;
    const page = history[changed] ?? EMPTY_PAGE;
    const last = page.undo.at(-1);
    if (coalesce && last?.coalesce && last.after === before && now - last.at < COALESCE_MS) {
        return { ...history, [changed]: { undo: [...page.undo.slice(0, -1), { ...last, after, at: now }], redo: [] } };
    }
    const undo = [...page.undo, { before, after, at: now, coalesce }].slice(-HISTORY_LIMIT);
    return { ...history, [changed]: { undo, redo: [] } };
}

export const canUndo = (history: SheetHistory, pageIndex: number) => Boolean(history[pageIndex]?.undo.length);
export const canRedo = (history: SheetHistory, pageIndex: number) => Boolean(history[pageIndex]?.redo.length);

function withPageMarks(doc: SheetDocument, pageIndex: number, marks: SheetMark[]): SheetDocument {
    return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((page, index) => (index === pageIndex ? { ...page, marks } : page)),
    };
}

/** Steps the page back; null when there is nothing to undo or the page has moved on from the last step. */
export function undoPage(history: SheetHistory, doc: SheetDocument, pageIndex: number): { history: SheetHistory; doc: SheetDocument } | null {
    const page = history[pageIndex];
    const step = page?.undo.at(-1);
    if (!step || doc.pages[pageIndex]?.marks !== step.after) return null;
    return {
        doc: withPageMarks(doc, pageIndex, step.before),
        history: { ...history, [pageIndex]: { undo: page.undo.slice(0, -1), redo: [...page.redo, step] } },
    };
}

export function redoPage(history: SheetHistory, doc: SheetDocument, pageIndex: number): { history: SheetHistory; doc: SheetDocument } | null {
    const page = history[pageIndex];
    const step = page?.redo.at(-1);
    if (!step || doc.pages[pageIndex]?.marks !== step.before) return null;
    return {
        doc: withPageMarks(doc, pageIndex, step.after),
        history: { ...history, [pageIndex]: { undo: [...page.undo, { ...step, coalesce: false }], redo: page.redo.slice(0, -1) } },
    };
}
