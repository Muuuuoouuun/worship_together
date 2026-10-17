import { clampCapo, isChartSettings, type ChartSettings } from './chordChart';
import { renderChordChartPages } from './chordChartRender';
import type { EngravedPage } from './leadSheetRender';
import type { SheetDocument, SheetPage } from './sheetAnnotations';

/** What `validateSheet` allows for one song. */
const MAX_SHEET_PAGES = 20;

type RenderChart = (chart: ChartSettings, title: string) => Promise<EngravedPage[]>;

/**
 * Swaps freshly drawn chart pages into a sheet. Chart pages are the ones with a `chartPage` index, and the
 * rule is by that index, so a re-render never disturbs the rest of the sheet:
 * - chart page i gets image i and keeps its marks (the same marks array, so undo history survives);
 * - chart pages past the new page count are removed, with their marks, and only those;
 * - when the chart grew, the new pages (no marks yet) go in right after the last chart page, or at the
 *   end of the sheet for a first chart;
 * - uploaded pages, sample pages and chart pages the user turned or deleted stay exactly as they are.
 * `keepMarks: false` is for a lyrics-only view whose layout differs, where old marks would sit in the wrong place.
 */
export function mergeChartPages(pages: SheetPage[], rendered: EngravedPage[], keepMarks = true): SheetPage[] {
    const merged: SheetPage[] = [];
    let highest = -1;
    for (const page of pages) {
        if (page.chartPage === undefined) {
            merged.push(page);
            continue;
        }
        highest = Math.max(highest, page.chartPage);
        const next = rendered[page.chartPage];
        if (next) merged.push({ ...page, image: next.image, width: next.width, height: next.height, ...(keepMarks ? {} : { marks: [] }) });
    }
    let at = merged.length;
    for (let index = merged.length - 1; index >= 0; index--) {
        if (merged[index].chartPage !== undefined) {
            at = index + 1;
            break;
        }
    }
    const added = rendered.slice(highest + 1).map((image, offset): SheetPage => ({ ...image, marks: [], chartPage: highest + 1 + offset }));
    merged.splice(at, 0, ...added);
    return merged;
}

const sameChart = (a: ChartSettings, b: ChartSettings) =>
    a.source === b.source && a.key === b.key && a.originalKey === b.originalKey && a.capo === b.capo && a.mode === b.mode && a.chordsAs === b.chordsAs;

async function withChart(doc: SheetDocument, chart: ChartSettings, render: RenderChart): Promise<SheetDocument> {
    const pages = mergeChartPages(doc.pages, await render(chart, doc.title));
    if (pages.length > MAX_SHEET_PAGES) throw new Error(`한 곡에는 최대 ${MAX_SHEET_PAGES}페이지까지 둘 수 있습니다. 다른 페이지를 먼저 지워주세요.`);
    return { ...doc, chart, pages, updatedAt: new Date().toISOString() };
}

/** Changes a chart sheet's key, capo, mode, chords-as or text and redraws only its chart pages. */
export async function updateChordChart(doc: SheetDocument, patch: Partial<ChartSettings>, render: RenderChart = renderChordChartPages): Promise<SheetDocument> {
    if (!doc.chart) return doc;
    const chart: ChartSettings = { ...doc.chart, ...patch };
    chart.capo = clampCapo(chart.capo);
    return sameChart(chart, doc.chart) ? doc : withChart(doc, chart, render);
}

/** Creates the chart pages in a sheet (a new one when `doc` is null), or replaces the sheet's existing chart pages. */
export async function applyChordChart(doc: SheetDocument | null, chart: ChartSettings, title: string, render: RenderChart = renderChordChartPages): Promise<SheetDocument> {
    if (!isChartSettings(chart)) throw new Error('코드 악보 정보가 올바르지 않습니다.');
    return withChart(doc ?? { version: 1, title: title.slice(0, 200), pages: [], updatedAt: new Date().toISOString() }, chart, render);
}
