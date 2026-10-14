import { chartForDisplay, chartKeyLine, parseChordChart, stripChords, type ChartMode, type ChartSegment, type ChartSettings, type ChordChart } from './chordChart';
import { LEAD_PAGE_HEIGHT, LEAD_PAGE_WIDTH, type EngravedPage } from './leadSheetRender';

/**
 * Draws a chord chart into page images with the canvas 2D API: chords in bold blue above the syllable
 * they sit on, lyrics below, section badges, wrapped lines, as many pages as needed. Same logical page,
 * output size, header and fonts as the engraved lead sheets. Layout is pure (it only asks a `measure`
 * function for text widths), so tests and non-browser code can run it too.
 */

export const CHART_MAX_PAGES = 20;
/** Output bitmap 1650×2200, like the engraved lead sheets. */
const OUTPUT_SCALE = 2200 / LEAD_PAGE_HEIGHT;
const LEFT = 80;
const RIGHT = 1120;
const LINE_WIDTH = RIGHT - LEFT;
/** First content line and the lowest point content may reach (the footer sits at 1560). */
const TOP = 224;
const BOTTOM = 1512;
/** Room kept between two chords on one line; lyrics are pushed apart to keep it. */
const CHORD_GAP = 14;
/** Wrapped continuation rows are indented so they read as the same line. */
const WRAP_INDENT = 28;
const INK = '#111827';
const CHORD_COLOR = '#0b4f8a';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const KOREAN = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "IBM Plex Sans KR", sans-serif';
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

type ChartStyle = {
    lyricFont: string;
    chordFont: string;
    badgeFont: string;
    /** Badge pill height and the baseline of its text inside it. */
    badgeHeight: number;
    badgeBaseline: number;
    /** Space under a badge, and above one that does not start a page. */
    badgeGap: number;
    sectionGap: number;
    blankHeight: number;
    /** Row with chords: baselines measured from the row top, and the row's height. */
    chordBaseline: number;
    chordLyricBaseline: number;
    chordRowHeight: number;
    /** Row without chords. */
    plainBaseline: number;
    plainRowHeight: number;
};

const STYLES: Readonly<Record<ChartMode, ChartStyle>> = {
    chords: {
        lyricFont: `600 24px ${KOREAN}`,
        chordFont: `700 21px ${SANS}`,
        badgeFont: `700 15px ${KOREAN}`,
        badgeHeight: 26,
        badgeBaseline: 19,
        badgeGap: 12,
        sectionGap: 22,
        blankHeight: 20,
        chordBaseline: 19,
        chordLyricBaseline: 50,
        chordRowHeight: 66,
        plainBaseline: 25,
        plainRowHeight: 42,
    },
    // Singers and the projector: no chords, bigger type.
    lyrics: {
        lyricFont: `700 38px ${KOREAN}`,
        chordFont: `700 21px ${SANS}`,
        badgeFont: `700 20px ${KOREAN}`,
        badgeHeight: 34,
        badgeBaseline: 25,
        badgeGap: 16,
        sectionGap: 32,
        blankHeight: 26,
        chordBaseline: 0,
        chordLyricBaseline: 0,
        chordRowHeight: 0,
        plainBaseline: 36,
        plainRowHeight: 62,
    },
};

export type ChartItem =
    | { type: 'badge'; text: string; x: number; y: number; width: number }
    | { type: 'chord'; text: string; x: number; y: number; width: number }
    | { type: 'lyric'; text: string; x: number; y: number };
export type ChartMeasure = (font: string, text: string) => number;

/** Width guess for code that has no canvas: Hangul and CJK count a full em, Latin about 0.58. */
export function estimateTextWidth(font: string, text: string): number {
    const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 16);
    let width = 0;
    for (const char of text) width += (/\s/.test(char) ? 0.3 : (char.codePointAt(0) ?? 0) >= 0x1100 ? 1 : 0.58) * size;
    return width;
}

type Placed = { segment: ChartSegment; x: number; lyricWidth: number; chordWidth: number };

/**
 * Lays the chart out on pages. Chords sit at the left edge of the lyric segment they belong to; when two
 * chords would crowd, the later lyric moves right. A line wider than the page breaks at a space (or, for
 * a word wider than a row, anywhere). Past `CHART_MAX_PAGES` the result is flagged `overflow`.
 */
export function layoutChart(chart: ChordChart, mode: ChartMode, measureText: ChartMeasure): { pages: ChartItem[][]; overflow: boolean } {
    const style = STYLES[mode];
    const widths = new Map<string, number>();
    const measure: ChartMeasure = (font, text) => {
        const key = `${font}|${text}`;
        let width = widths.get(key);
        if (width === undefined) {
            width = measureText(font, text);
            widths.set(key, width);
        }
        return width;
    };
    const withChords = (row: ChartSegment[]) => mode === 'chords' && row.some((segment) => segment.chord);
    const rowHeight = (row: ChartSegment[]) => (withChords(row) ? style.chordRowHeight : style.plainRowHeight);

    function place(row: ChartSegment[]): { placed: Placed[]; width: number } {
        const placed: Placed[] = [];
        let x = 0;
        let width = 0;
        row.forEach((segment, index) => {
            const lyricWidth = segment.lyric ? measure(style.lyricFont, segment.lyric) : 0;
            const chordWidth = segment.chord && mode === 'chords' ? measure(style.chordFont, segment.chord) : 0;
            placed.push({ segment, x, lyricWidth, chordWidth });
            width = Math.max(width, x + lyricWidth, x + chordWidth);
            const start = x;
            x += lyricWidth;
            // The next chord must clear this one; push the lyric under it apart.
            if (chordWidth && row[index + 1]?.chord) x = Math.max(x, start + chordWidth + CHORD_GAP);
        });
        return { placed, width };
    }

    /** Places where a row may break, as (segment, character) = the first character of the tail. */
    function cutPoints(row: ChartSegment[], atSpaces: boolean) {
        const points: Array<{ seg: number; at: number }> = [];
        let previous = '';
        row.forEach((segment, seg) => {
            Array.from(segment.lyric).forEach((char, at) => {
                if (previous && (!atSpaces || (/\s/.test(previous) && !/\s/.test(char)))) points.push({ seg, at });
                previous = char;
            });
        });
        return points;
    }

    function split(row: ChartSegment[], { seg, at }: { seg: number; at: number }): [ChartSegment[], ChartSegment[]] {
        const chars = Array.from(row[seg].lyric);
        const head = row.slice(0, seg);
        if (at > 0) head.push({ ...row[seg], lyric: chars.slice(0, at).join('').trimEnd() });
        else if (head.length) head[head.length - 1] = { ...head[head.length - 1], lyric: head[head.length - 1].lyric.trimEnd() };
        const tail = row.slice(seg + 1);
        if (at > 0) {
            const lyric = chars.slice(at).join('').trimStart();
            if (lyric) tail.unshift({ lyric });
        } else {
            tail.unshift(row[seg]);
        }
        return [head, tail];
    }

    function wrap(line: ChartSegment[]): ChartSegment[][] {
        const rows: ChartSegment[][] = [];
        let rest = line;
        let available = LINE_WIDTH;
        while (rest.length) {
            if (place(rest).width <= available) {
                rows.push(rest);
                break;
            }
            // The last break that still fits: at a space first, anywhere only if no word break fits.
            let cut: { seg: number; at: number } | undefined;
            for (const points of [cutPoints(rest, true), cutPoints(rest, false)]) {
                for (const point of points) {
                    if (place(split(rest, point)[0]).width > available) break;
                    cut = point;
                }
                if (cut) break;
            }
            // Even the first piece is too wide: break after it anyway so the loop always advances.
            cut ??= cutPoints(rest, true)[0] ?? cutPoints(rest, false)[0];
            const [head, tail] = cut ? split(rest, cut) : [rest, []];
            rows.push(head);
            rest = tail;
            available = LINE_WIDTH - WRAP_INDENT;
        }
        return rows;
    }

    const pages: ChartItem[][] = [[]];
    let items = pages[0];
    let y = TOP;
    let overflow = false;
    const newPage = () => {
        if (pages.length >= CHART_MAX_PAGES) {
            overflow = true;
            return;
        }
        items = [];
        pages.push(items);
        y = TOP;
    };
    /** Starts a page when the next block would run past the bottom (never on an empty page). */
    const ensure = (height: number) => {
        if (y !== TOP && y + height > BOTTOM) newPage();
    };

    for (const section of chart.sections) {
        const lines = section.lines.map((line) => (line.length ? wrap(line) : []));
        const firstLine = lines.find((rows) => rows.length);
        if (section.name) {
            const text = section.name;
            ensure(style.sectionGap + style.badgeHeight + style.badgeGap + (firstLine ? firstLine.reduce((sum, row) => sum + rowHeight(row), 0) : 0));
            if (y !== TOP) y += style.sectionGap;
            const width = measure(style.badgeFont, text) + 20;
            items.push({ type: 'badge', text, x: LEFT, y, width });
            y += style.badgeHeight + style.badgeGap;
        }
        for (const rows of lines) {
            if (!rows.length) {
                if (y !== TOP) y += style.blankHeight;
                continue;
            }
            ensure(rows.reduce((sum, row) => sum + rowHeight(row), 0));
            rows.forEach((row, rowIndex) => {
                const chorded = withChords(row);
                const indent = rowIndex > 0 ? WRAP_INDENT : 0;
                const { placed } = place(row);
                const lyricY = y + (chorded ? style.chordLyricBaseline : style.plainBaseline);
                placed.forEach((cell, index) => {
                    const x = LEFT + indent + cell.x;
                    if (cell.segment.lyric.trim()) items.push({ type: 'lyric', text: cell.segment.lyric, x, y: lyricY });
                    if (cell.segment.chord && chorded) items.push({ type: 'chord', text: cell.segment.chord, x, y: y + style.chordBaseline, width: cell.chordWidth });
                    // A word split by a pushed-apart chord gets a hyphen in the gap (Latin lyrics).
                    const next = placed[index + 1];
                    const gap = next ? next.x - (cell.x + cell.lyricWidth) : 0;
                    const hyphen = measure(style.lyricFont, '-');
                    if (next && gap > hyphen + 2 && /[A-Za-z]$/.test(cell.segment.lyric) && /^[A-Za-z]/.test(next.segment.lyric)) {
                        items.push({ type: 'lyric', text: '-', x: x + cell.lyricWidth + (gap - hyphen) / 2, y: lyricY });
                    }
                });
                y += rowHeight(row);
            });
        }
    }
    return { pages, overflow };
}

/** Page frame and header in the lead sheets' style; the title shrinks from 44px until it fits between the margins. */
function drawFrame(
    ctx: CanvasRenderingContext2D,
    { heading, subtitle, keyLine, tempo, pageIndex, pageCount }: { heading: string; subtitle: { top: string; footer: string }; keyLine: string; tempo?: number; pageIndex: number; pageCount: number }
) {
    ctx.save();
    ctx.fillStyle = '#fcfbfa';
    ctx.fillRect(0, 0, LEAD_PAGE_WIDTH, LEAD_PAGE_HEIGHT);
    ctx.strokeStyle = '#e2dfd8';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, LEAD_PAGE_WIDTH - 60, LEAD_PAGE_HEIGHT - 60);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let size = 44;
    ctx.font = `800 ${size}px ${KOREAN}`;
    while (size > 24 && ctx.measureText(heading).width > LINE_WIDTH) {
        size -= 2;
        ctx.font = `800 ${size}px ${KOREAN}`;
    }
    ctx.fillText(heading, LEAD_PAGE_WIDTH / 2, 96);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 20px ${KOREAN}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText(subtitle.top, LEAD_PAGE_WIDTH / 2, 128);
    ctx.restore();

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${KOREAN}`;
    ctx.fillStyle = '#b45309';
    ctx.fillText(keyLine, LEFT, 164);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `700 20px ${SANS}`;
    ctx.fillText(`${tempo ? `BPM ${tempo}  |  ` : ''}Page ${pageIndex + 1} of ${pageCount}`, RIGHT, 164);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LEFT, 177);
    ctx.lineTo(RIGHT, 177);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LEFT, 183);
    ctx.lineTo(RIGHT, 183);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 15px ${SANS}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Worship Together ${subtitle.footer} · ${pageIndex + 1}/${pageCount} 페이지`, LEAD_PAGE_WIDTH / 2, 1560);
    ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: ChartItem, style: ChartStyle) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (item.type === 'badge') {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, style.badgeHeight, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = style.badgeFont;
        ctx.fillText(item.text, item.x + 10, item.y + style.badgeBaseline);
    } else {
        ctx.fillStyle = item.type === 'chord' ? CHORD_COLOR : INK;
        ctx.font = item.type === 'chord' ? style.chordFont : style.lyricFont;
        ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
}

/**
 * Every page of the chart as a PNG data URL at 1650×2200. Throws when the chart needs more than 20 pages.
 * Outside a browser (tests, SSR) the pages are 1px placeholders laid out with estimated text widths.
 */
export async function renderChordChartPages(settings: ChartSettings, title: string): Promise<EngravedPage[]> {
    const chart = parseChordChart(settings.source);
    const shown = settings.mode === 'lyrics' ? stripChords(chart) : chartForDisplay(chart, settings);
    const style = STYLES[settings.mode];
    const width = Math.round(LEAD_PAGE_WIDTH * OUTPUT_SCALE);
    const height = Math.round(LEAD_PAGE_HEIGHT * OUTPUT_SCALE);
    const tooLong = () => new Error(`코드 악보가 ${CHART_MAX_PAGES}페이지를 넘습니다. 글을 줄이거나 곡을 나눠주세요.`);

    if (typeof document === 'undefined') {
        const { pages, overflow } = layoutChart(shown, settings.mode, estimateTextWidth);
        if (overflow) throw tooLong();
        return pages.map(() => ({ image: PLACEHOLDER_IMAGE, width, height }));
    }

    await Promise.all([style.lyricFont, style.chordFont, style.badgeFont, `800 44px ${KOREAN}`, `700 22px ${KOREAN}`].map((font) => document.fonts.load(font)));
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) throw new Error('이 브라우저에서는 악보를 그릴 수 없습니다.');
    const { pages, overflow } = layoutChart(shown, settings.mode, (font, text) => {
        probe.save();
        probe.font = font;
        const measured = probe.measureText(text).width;
        probe.restore();
        return measured;
    });
    if (overflow) throw tooLong();

    const heading = chart.title || title || '코드 악보';
    const images: EngravedPage[] = [];
    for (const [pageIndex, items] of pages.entries()) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('이 브라우저에서는 악보를 그릴 수 없습니다.');
        ctx.setTransform(OUTPUT_SCALE, 0, 0, OUTPUT_SCALE, 0, 0);
        drawFrame(ctx, {
            heading,
            subtitle: settings.mode === 'lyrics' ? { top: 'Worship Lyrics · 가사', footer: 'Lyrics' } : { top: 'Worship Chord Chart · 코드 악보', footer: 'Chord Chart' },
            keyLine: chartKeyLine(settings),
            tempo: chart.tempo,
            pageIndex,
            pageCount: pages.length,
        });
        for (const item of items) drawItem(ctx, item, style);
        images.push({ image: canvas.toDataURL('image/png'), width, height });
        canvas.width = canvas.height = 0;
    }
    return images;
}
