import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chartForDisplay,
    chartKeyLine,
    chartKeyNote,
    CHART_SOURCE_MAX,
    guessChartKey,
    isChartSettings,
    isChord,
    parseChordChart,
    shapesKey,
    stripChords,
    transposeChart,
    type ChartSettings,
} from '../lib/chordChart';
import { HYMN_EXAMPLE } from '../lib/chordChartExample';
import { CHART_MAX_PAGES, estimateTextWidth, layoutChart, renderChordChartPages, type ChartItem } from '../lib/chordChartRender';
import { applyChordChart, mergeChartPages, updateChordChart } from '../lib/chordChartSheet';
import { rekeySheet, validateSheet, type SheetDocument, type SheetPage } from '../lib/sheetAnnotations';

const settings = (patch: Partial<ChartSettings> = {}): ChartSettings => ({
    source: '[Verse 1]\n[G]주의 [D/F#]은혜\n[Em]놀라[C]워',
    key: 'G',
    originalKey: 'G',
    capo: 0,
    mode: 'chords',
    chordsAs: 'concert',
    ...patch,
});
const chordsOf = (chart: ReturnType<typeof parseChordChart>) => chart.sections.flatMap((s) => s.lines.flat()).flatMap((seg) => (seg.chord ? [seg.chord] : []));
const chartPages = (doc: SheetDocument) => doc.pages.filter((p) => p.chartPage !== undefined);
/** Enough lines for several chart pages. */
const longSource = (lines: number) => `[Verse 1]\n${Array.from({ length: lines }, (_, i) => `[C]줄 ${i + 1} [G]노래해 [Am]주를`).join('\n')}`;
const mark = (id: string) => ({ id, kind: 'pen' as const, color: '#dc2626', points: [[100, 100]] as Array<[number, number]> });

test('inline chords split the lyric at the syllable they sit on', () => {
    const chart = parseChordChart('[Verse 1]\n[G]주의 [D/F#]은혜\n가[Em]나 [C]다\n[G] [D] [Em]');
    assert.deepEqual(chart.sections[0].lines[0], [
        { chord: 'G', lyric: '주의 ' },
        { chord: 'D/F#', lyric: '은혜' },
    ]);
    // Text before the first chord has no chord; a chord can sit mid-word.
    assert.deepEqual(chart.sections[0].lines[1], [{ lyric: '가' }, { chord: 'Em', lyric: '나 ' }, { chord: 'C', lyric: '다' }]);
    // An instrumental line is chords with no words.
    assert.deepEqual(chart.sections[0].lines[2], [
        { chord: 'G', lyric: ' ' },
        { chord: 'D', lyric: ' ' },
        { chord: 'Em', lyric: '' },
    ]);
    assert.deepEqual(parseChordChart('[B♭]주 [F♯m]님').sections[0].lines[0].map((s) => s.chord), ['Bb', 'F#m']);
});

test('directives set the title, key, capo and tempo and are not lyrics', () => {
    const chart = parseChordChart('{title: 은혜로다}\n{key: A}\n{capo: 2}\n{tempo: 68}\n{subtitle: ignored}\n[G]주님');
    assert.equal(chart.title, '은혜로다');
    assert.equal(chart.key, 'A');
    assert.equal(chart.capo, 2);
    assert.equal(chart.tempo, 68);
    assert.equal(chart.sections.length, 1);
    assert.deepEqual(chart.sections[0].lines, [[{ chord: 'G', lyric: '주님' }]]);
    // Short names and the space form work; out-of-range or unreadable values are ignored.
    const short = parseChordChart('{t: 제목}\n{k: Bb}\n{capo 3}\n{bpm: 90}');
    assert.deepEqual([short.title, short.key, short.capo, short.tempo], ['제목', 'Bb', 3, 90]);
    const bad = parseChordChart('{key: Em}\n{capo: 12}\n{capo: x}\n{tempo: 5}');
    assert.deepEqual([bad.key, bad.capo, bad.tempo], [undefined, undefined, undefined]);
});

test('[Chorus] is a section while [C] and [Am7] are chords', () => {
    for (const chord of ['C', 'G', 'Am', 'Am7', 'Bb', 'F#m7', 'Cmaj7', 'Gsus4', 'Dadd9', 'D/F#', 'C/E', 'Bbmaj7', 'E7(b9)', 'Cm7b5', 'G#dim7', 'N.C.', 'B♭']) {
        assert.equal(isChord(chord), true, chord);
    }
    for (const name of ['Chorus', 'Verse 1', 'Bridge', 'Intro', 'Coda', 'Ending', 'Break', 'Fine', 'Amen', 'Dub', '후렴', '1절', '']) {
        assert.equal(isChord(name), false, name);
    }
    const chart = parseChordChart('[Intro]\n[C]\n[Chorus]\n[Am7]주님\n[Bridge]\n[후렴]\n[Em]');
    assert.deepEqual(chart.sections.map((s) => s.name), ['Intro', 'Chorus', 'Bridge', '후렴']);
    // [C] and [Am7] on their own are chord-only lines inside a section, not new sections.
    assert.deepEqual(chart.sections[0].lines, [[{ chord: 'C', lyric: '' }]]);
    assert.deepEqual(chart.sections[1].lines, [[{ chord: 'Am7', lyric: '주님' }]]);
    assert.deepEqual(chart.sections[3].lines, [[{ chord: 'Em', lyric: '' }]]);
});

test('# lines, comment directives and start-of-section directives also name sections', () => {
    const chart = parseChordChart('# 후렴\n[C]a\n{c: Bridge 2}\n[G]b\n{soc}\n[D]c\n{sov: 2절}\n[E]d\n{eoc}\n{comment: }\n#\n## Tag\n[A]e');
    assert.deepEqual(chart.sections.map((s) => s.name), ['후렴', 'Bridge 2', 'Chorus', '2절', 'Tag']);
    // A section whose name looks like a chord is spelled with # or {c:}.
    assert.deepEqual(parseChordChart('# A\n[G]x\n{c: B}\n[D]y').sections.map((s) => s.name), ['A', 'B']);
    // Lyrics before any section go in an unnamed one.
    const loose = parseChordChart('[G]처음\n[Verse]\n[D]다음');
    assert.deepEqual(loose.sections.map((s) => s.name), ['', 'Verse']);
});

test('blank lines separate stanzas once and never lead or trail a section; other brackets stay as text', () => {
    const chart = parseChordChart('\n[Verse]\n\n[G]하나\n\n\n[D]둘\n\n[Chorus]\n[C]셋\n\n');
    assert.deepEqual(chart.sections[0].lines.map((line) => line.length), [1, 0, 1]);
    assert.equal(chart.sections[1].lines.length, 1);
    // A bracket that is neither a chord nor alone on its line is part of the lyric.
    assert.deepEqual(parseChordChart('[G]주님 [박수] 찬양').sections[0].lines[0], [{ chord: 'G', lyric: '주님 [박수] 찬양' }]);
    assert.deepEqual(parseChordChart('').sections, []);
    assert.deepEqual(parseChordChart('\r\n[G]윈도우\r\n[D]줄바꿈').sections[0].lines.length, 2);
});

test('transposing moves every chord, slash basses included, and keeps the words', () => {
    const chart = parseChordChart('[Verse]\n[G]주의 [D/F#]은혜 [Em]놀라[C]워\n[G/B]끝');
    const inA = transposeChart(chart, 'G', 'A');
    assert.deepEqual(chordsOf(inA), ['A', 'E/G#', 'F#m', 'D', 'A/C#']);
    assert.equal(inA.sections[0].lines[0][1].lyric, '은혜 ');
    const inEb = transposeChart(chart, 'G', 'Eb');
    assert.deepEqual(chordsOf(inEb), ['Eb', 'Bb/D', 'Cm', 'Ab', 'Eb/G']);
    // Down a step, and back again.
    assert.deepEqual(chordsOf(transposeChart(chart, 'G', 'F')), ['F', 'C/E', 'Dm', 'Bb', 'F/A']);
    assert.deepEqual(chordsOf(transposeChart(inA, 'A', 'G')), chordsOf(chart));
    // The input is untouched, and the same key is a no-op.
    assert.deepEqual(chordsOf(chart), ['G', 'D/F#', 'Em', 'C', 'G/B']);
    assert.equal(transposeChart(chart, 'G', 'G'), chart);
});

test('capo shapes are the concert key lowered by the capo', () => {
    assert.equal(shapesKey('D', 2), 'C');
    assert.equal(shapesKey('E', 4), 'C');
    assert.equal(shapesKey('A', 2), 'G');
    assert.equal(shapesKey('Bb', 2), 'Ab');
    assert.equal(shapesKey('Bb', 3), 'G');
    assert.equal(shapesKey('C', 1), 'B');
    assert.equal(shapesKey('D', 1), 'Db');
    assert.equal(shapesKey('F#', 6), 'C');
    assert.equal(shapesKey('G', 0), 'G');
    assert.equal(shapesKey('Eb', 11), 'E');
    // Capo is kept within 0–11.
    assert.equal(shapesKey('D', 14), 'Eb');
    assert.equal(shapesKey('D', -3), 'D');

    // Written in G, sung in D with a capo on 2: the guitarist plays C shapes.
    const chart = parseChordChart('[G]a [D/F#]b [Em]c [C]d');
    const concert = chartForDisplay(chart, { originalKey: 'G', key: 'D', capo: 2, chordsAs: 'concert' });
    assert.deepEqual(chordsOf(concert), ['D', 'A/C#', 'Bm', 'G']);
    const shapes = chartForDisplay(chart, { originalKey: 'G', key: 'D', capo: 2, chordsAs: 'capo' });
    assert.deepEqual(chordsOf(shapes), ['C', 'G/B', 'Am', 'F']);
    // No capo: shapes are the concert chords.
    assert.deepEqual(chordsOf(chartForDisplay(chart, { originalKey: 'G', key: 'D', capo: 0, chordsAs: 'capo' })), chordsOf(concert));
});

test('the header names the key, the capo and the shapes', () => {
    assert.equal(chartKeyLine({ key: 'D', capo: 0, mode: 'chords', chordsAs: 'concert' }), 'Key D');
    assert.equal(chartKeyLine({ key: 'D', capo: 2, mode: 'chords', chordsAs: 'capo' }), 'Key D · Capo 2 (C 코드 폼)');
    assert.equal(chartKeyLine({ key: 'D', capo: 2, mode: 'chords', chordsAs: 'concert' }), 'Key D · Capo 2 (실제 코드)');
    assert.equal(chartKeyLine({ key: 'Bb', capo: 2, mode: 'chords', chordsAs: 'capo' }), 'Key B♭ · Capo 2 (A♭ 코드 폼)');
    assert.equal(chartKeyLine({ key: 'D', capo: 2, mode: 'lyrics', chordsAs: 'capo' }), 'Key D');
    assert.equal(chartKeyNote({ key: 'A', originalKey: 'G', capo: 0, mode: 'chords', chordsAs: 'concert' }), '원키 G에서 2반음 위 · Key A');
    assert.equal(chartKeyNote({ key: 'F', originalKey: 'G', capo: 0, mode: 'chords', chordsAs: 'concert' }), '원키 G에서 2반음 아래 · Key F');
    assert.equal(chartKeyNote({ key: 'G', originalKey: 'G', capo: 0, mode: 'chords', chordsAs: 'concert' }), '원키 G · Key G');
});

test('the key of a chart comes from {key:} or the first chord', () => {
    assert.equal(guessChartKey(parseChordChart('{key: A}\n[G]x')), 'A');
    assert.equal(guessChartKey(parseChordChart('[D/F#]x [G]y')), 'D');
    assert.equal(guessChartKey(parseChordChart('[N.C.]쉬고 [Bb]x')), 'Bb');
    // A minor first chord points to its relative major.
    assert.equal(guessChartKey(parseChordChart('[Am7]x')), 'C');
    assert.equal(guessChartKey(parseChordChart('[F#m]x')), 'A');
    assert.equal(guessChartKey(parseChordChart('[Bbm]x')), 'Db');
    assert.equal(guessChartKey(parseChordChart('[Cmaj7]x')), 'C');
    assert.equal(guessChartKey(parseChordChart('가사만')), null);
});

test('stripChords leaves one lyric string per line and drops instrumentals', () => {
    const chart = parseChordChart('[Intro]\n[G] [D]\n[Verse]\n[G]주의 [D]은혜\n\n주[Em]님 [C]사랑\n[G] [C]');
    const lyrics = stripChords(chart);
    assert.deepEqual(lyrics.sections.map((s) => s.name), ['Intro', 'Verse']);
    assert.deepEqual(lyrics.sections[0].lines, []);
    assert.deepEqual(lyrics.sections[1].lines, [[{ lyric: '주의 은혜' }], [], [{ lyric: '주님 사랑' }]]);
});

test('the hymn example reads as a two-section G chart', () => {
    const chart = parseChordChart(HYMN_EXAMPLE);
    assert.deepEqual([chart.title, chart.key, chart.capo, chart.tempo], ['나 같은 죄인 살리신', 'G', 0, 72]);
    assert.deepEqual(chart.sections.map((s) => s.name), ['Verse 1', 'English (Verse 1)']);
    assert.ok(chart.sections.every((s) => s.lines.length === 4));
    assert.equal(guessChartKey(chart), 'G');
    assert.ok(HYMN_EXAMPLE.length < CHART_SOURCE_MAX);
});

test('chords never overlap: crowded lyrics are pushed apart', () => {
    const { pages, overflow } = layoutChart(parseChordChart('[Verse]\n[G]a[Dsus4]b[Em7]c[Cmaj7#11/E]d\n[G]주의 [D]은혜 [Em]놀라워'), 'chords', estimateTextWidth);
    assert.equal(overflow, false);
    const chords = pages[0].filter((item): item is Extract<ChartItem, { type: 'chord' }> => item.type === 'chord');
    const rows = new Map<number, typeof chords>();
    for (const chord of chords) rows.set(chord.y, [...(rows.get(chord.y) ?? []), chord]);
    assert.equal(rows.size, 2);
    for (const row of rows.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x >= sorted[i - 1].x + sorted[i - 1].width + 8, `${sorted[i - 1].text} / ${sorted[i].text}`);
    }
    // Each chord sits exactly over the start of its lyric; the pushed-apart lyrics follow.
    const lyric = (text: string) => pages[0].find((item) => item.type === 'lyric' && item.text === text);
    const chord = (text: string) => chords.find((item) => item.text === text);
    assert.equal(chord('G')?.x, lyric('a')?.x);
    assert.equal(chord('Dsus4')?.x, lyric('b')?.x);
    assert.equal(chord('Cmaj7#11/E')?.x, lyric('d')?.x);
    assert.ok((lyric('b')?.x ?? 0) > (lyric('a')?.x ?? 0) + 8);
    const second = rows.get(Math.max(...rows.keys()))!;
    assert.equal(second.find((c) => c.text === 'D')?.x, lyric('은혜 ')?.x);
    // A word split by pushed-apart chords gets a hyphen in the gap.
    assert.ok(layoutChart(parseChordChart('[Cmaj7#11]A[Dsus4add9]b'), 'chords', estimateTextWidth).pages[0].some((item) => item.type === 'lyric' && item.text === '-'));
});

test('long lines wrap at spaces inside the page margins', () => {
    const words = Array.from({ length: 30 }, (_, i) => `단어${i}`).join(' ');
    const { pages } = layoutChart(parseChordChart(`[C]${words}`), 'chords', estimateTextWidth);
    const lyrics = pages[0].filter((item) => item.type === 'lyric');
    assert.ok(new Set(lyrics.map((item) => item.y)).size > 1, 'wrapped onto more rows');
    for (const item of lyrics) {
        assert.ok(item.x >= 80 && item.x + estimateTextWidth('600 24px x', item.text) <= 1120 + 0.001, item.text);
        assert.ok(!/^\s|\s$/.test(item.text) || item.text === words, 'rows do not start or end with a space');
    }
    assert.equal(lyrics.map((item) => item.text).join(' ').replace(/\s+/g, ' '), words);
    // Only the first row carries the chord.
    assert.equal(pages[0].filter((item) => item.type === 'chord').length, 1);
    // A word wider than the page still breaks.
    const long = layoutChart(parseChordChart('가'.repeat(80)), 'chords', estimateTextWidth).pages[0].filter((item) => item.type === 'lyric');
    assert.ok(long.length > 1);
});

test('lyrics-only layout has no chords', () => {
    const chart = stripChords(parseChordChart('[Verse]\n[G]주의 [D]은혜\n[Em]놀라워'));
    const { pages } = layoutChart(chart, 'lyrics', estimateTextWidth);
    const items = pages.flat();
    assert.equal(items.some((item) => item.type === 'chord'), false);
    assert.deepEqual(items.filter((item) => item.type === 'lyric').map((item) => item.text), ['주의 은혜', '놀라워']);
    assert.equal(items.filter((item) => item.type === 'badge').length, 1);
});

test('long charts paginate with section badges kept above their lines, capped at 20 pages', () => {
    const chart = parseChordChart(Array.from({ length: 6 }, (_, s) => `[Verse ${s + 1}]\n${Array.from({ length: 14 }, (_, i) => `[G]줄 ${i} [D]노래`).join('\n')}`).join('\n'));
    const { pages, overflow } = layoutChart(chart, 'chords', estimateTextWidth);
    assert.equal(overflow, false);
    assert.ok(pages.length >= 3 && pages.length <= CHART_MAX_PAGES, `${pages.length} pages`);
    for (const items of pages) {
        assert.ok(items.length > 0);
        assert.ok(Math.max(...items.map((item) => item.y)) <= 1512);
        // A badge always has a line right below it on the same page.
        items.forEach((item, index) => assert.ok(item.type !== 'badge' || items.slice(index + 1).some((next) => next.type === 'lyric' || next.type === 'chord')));
    }
    assert.equal(pages.flat().filter((item) => item.type === 'badge').length, 6);
    const huge = layoutChart(parseChordChart(longSource(1500)), 'chords', estimateTextWidth);
    assert.equal(huge.overflow, true);
    assert.equal(huge.pages.length, CHART_MAX_PAGES);
    // Bigger type takes more pages for the same words.
    const lyricsPages = layoutChart(stripChords(chart), 'lyrics', estimateTextWidth).pages.length;
    assert.ok(lyricsPages >= 1 && lyricsPages <= CHART_MAX_PAGES);
});

test('rendering outside a browser returns page-sized placeholders and rejects charts over 20 pages', async () => {
    const pages = await renderChordChartPages(settings({ source: longSource(60) }), '제목');
    assert.ok(pages.length > 1);
    assert.ok(pages.every((page) => page.width === 1650 && page.height === 2200 && page.image.startsWith('data:image/png;base64,')));
    await assert.rejects(renderChordChartPages(settings({ source: longSource(2000) }), '제목'), /20페이지/);
});

test('validateSheet checks the chart field and chartPage', async () => {
    const doc = await applyChordChart(null, settings(), '은혜로다');
    assert.deepEqual(doc.pages.map((p) => p.chartPage), [0]);
    assert.equal(validateSheet(doc).chart?.originalKey, 'G');
    // Documents without a chart still validate.
    const { chart: _chart, ...plain } = doc;
    void _chart;
    assert.equal(validateSheet({ ...plain, pages: [{ ...doc.pages[0], chartPage: undefined }] }).chart, undefined);

    assert.equal(isChartSettings(settings()), true);
    assert.equal(isChartSettings(settings({ source: 'x'.repeat(CHART_SOURCE_MAX) })), true);
    assert.throws(() => validateSheet({ ...doc, chart: settings({ source: 'x'.repeat(CHART_SOURCE_MAX + 1) }) }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: { ...settings(), key: 'H' } }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: { ...settings(), originalKey: 'Em' } }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: settings({ capo: 12 }) }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: settings({ capo: 1.5 }) }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: { ...settings(), mode: 'big' } }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: { ...settings(), chordsAs: 'shapes' } }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, chart: 'G' }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, pages: [{ ...doc.pages[0], chartPage: -1 }] }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, pages: [{ ...doc.pages[0], chartPage: 20 }] }), /코드 악보/);
    assert.throws(() => validateSheet({ ...doc, pages: [{ ...doc.pages[0], chartPage: 0.5 }] }), /코드 악보/);
    assert.throws(() => validateSheet({ ...plain, pages: [{ ...doc.pages[0], chartPage: 0 }] }), /코드 악보/);
});

test('mergeChartPages swaps images by chart page index and touches nothing else', () => {
    const img = (n: number) => ({ image: `img${n}`, width: 10 + n, height: 20 + n });
    const page = (id: string, extra: Partial<SheetPage> = {}): SheetPage => ({ image: `old-${id}`, width: 1, height: 2, marks: [mark(id)], ...extra });
    const upload = page('upload');
    const c0 = page('c0', { chartPage: 0 });
    const c1 = page('c1', { chartPage: 1 });
    const after = page('after');

    // Same count: images change, marks (same array) stay, other pages are the same objects.
    const same = mergeChartPages([upload, c0, c1, after], [img(0), img(1)]);
    assert.equal(same.length, 4);
    assert.equal(same[0], upload);
    assert.equal(same[3], after);
    assert.deepEqual([same[1].image, same[1].width, same[1].height, same[1].chartPage], ['img0', 10, 20, 0]);
    assert.equal(same[1].marks, c0.marks);
    assert.equal(same[2].marks, c1.marks);

    // Growing: new pages (empty marks) go right after the last chart page, before the page that follows it.
    const grown = mergeChartPages([upload, c0, c1, after], [img(0), img(1), img(2), img(3)]);
    assert.deepEqual(grown.map((p) => p.chartPage), [undefined, 0, 1, 2, 3, undefined]);
    assert.deepEqual(grown[3].marks, []);
    assert.equal(grown[5], after);

    // Shrinking: only the chart pages past the new count go, with their marks.
    const shrunk = mergeChartPages([upload, c0, c1, after], [img(0)]);
    assert.deepEqual(shrunk.map((p) => p.chartPage), [undefined, 0, undefined]);
    assert.equal(shrunk[1].marks, c0.marks);
    assert.deepEqual(shrunk.map((p) => p.image), ['old-upload', 'img0', 'old-after']);

    // The first chart goes at the end of the sheet.
    assert.deepEqual(mergeChartPages([upload], [img(0), img(1)]).map((p) => p.chartPage), [undefined, 0, 1]);

    // A chart page the user turned or deleted (no index) is left alone; nothing is re-added in the gap.
    const gap = mergeChartPages([c0, upload, page('c2', { chartPage: 2 })], [img(0), img(1), img(2)]);
    assert.deepEqual(gap.map((p) => p.chartPage), [0, undefined, 2]);
    assert.deepEqual(mergeChartPages([c0, page('c2', { chartPage: 2 })], [img(0), img(1), img(2), img(3)]).map((p) => p.chartPage), [0, 2, 3]);

    // The lyrics-only view drops marks since its layout differs.
    const view = mergeChartPages([upload, c0, c1], [img(0)], false);
    assert.deepEqual(view.map((p) => p.marks.length), [1, 0]);
});

test('changing key, capo, mode or chords-as redraws the chart pages and keeps every page\'s marks', async () => {
    const upload: SheetPage = { image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', width: 1200, height: 1600, marks: [mark('upload-mark')] };
    const base = await applyChordChart({ version: 1, title: '은혜로다', pages: [upload], updatedAt: '2025-01-01T00:00:00.000Z' }, settings({ source: longSource(40) }), '은혜로다');
    const count = chartPages(base).length;
    assert.ok(count >= 2, `${count} chart pages`);
    assert.deepEqual(base.pages.map((p) => p.chartPage), [undefined, ...Array.from({ length: count }, (_, i) => i)]);
    assert.equal(base.pages[0], upload);

    // Marks on chart pages 0 and the last one.
    const marked: SheetDocument = {
        ...base,
        pages: base.pages.map((p, i) => (i === 1 || i === count ? { ...p, marks: [mark(`m${i}`)] } : p)),
    };
    const validated = validateSheet(marked);
    assert.equal(validated.pages.length, count + 1);

    // Key change through rekeySheet: marks, page count and the uploaded page are unchanged.
    const inD = await rekeySheet(marked, 'D');
    assert.equal(inD.chart?.key, 'D');
    assert.equal(inD.chart?.originalKey, 'G');
    assert.equal(inD.pages.length, marked.pages.length);
    assert.equal(inD.pages[0], marked.pages[0]);
    inD.pages.forEach((p, i) => assert.equal(p.marks, marked.pages[i].marks));
    assert.equal(await rekeySheet(inD, 'D'), inD);
    assert.equal(await rekeySheet(await applyChordChart(null, settings(), 't').then((d) => ({ ...d, chart: undefined })), 'A').then((d) => d.chart), undefined);

    // Capo and chords-as: same pages, new settings.
    const capo = await updateChordChart(inD, { capo: 2, chordsAs: 'capo' });
    assert.deepEqual([capo.chart?.capo, capo.chart?.chordsAs, capo.chart?.key], [2, 'capo', 'D']);
    assert.equal(capo.pages.length, inD.pages.length);
    assert.equal(await updateChordChart(capo, { capo: 2 }), capo);
    assert.equal((await updateChordChart(capo, { capo: 40 })).chart?.capo, 11);

    // A shorter text removes only the chart pages past the new count (with their marks); the rest stay.
    const shorter = await applyChordChart(capo, { ...capo.chart!, source: longSource(5) }, '은혜로다');
    assert.equal(chartPages(shorter).length, 1);
    assert.equal(shorter.pages[0], upload);
    assert.equal(shorter.pages[1].marks, marked.pages[1].marks);
    assert.equal(shorter.pages.length, 2);

    // A longer text appends chart pages with no marks.
    const longer = await applyChordChart(shorter, { ...capo.chart!, source: longSource(80) }, '은혜로다');
    assert.ok(chartPages(longer).length > count);
    assert.equal(longer.pages[1].marks, marked.pages[1].marks);
    assert.deepEqual(longer.pages.at(-1)?.marks, []);
    assert.equal(validateSheet(longer).pages.length, longer.pages.length);
});

test('chart redraws ask for the right settings and respect the 20-page sheet limit', async () => {
    const seen: Array<{ mode: string; key: string; title: string }> = [];
    const render = async (chart: ChartSettings, title: string) => {
        seen.push({ mode: chart.mode, key: chart.key, title });
        return Array.from({ length: chart.mode === 'lyrics' ? 3 : 2 }, (_, i) => ({ image: `img${i}`, width: 1650, height: 2200 }));
    };
    const doc = await applyChordChart(null, settings(), '곡', render);
    assert.deepEqual(doc.pages.map((p) => p.chartPage), [0, 1]);
    const lyrics = await updateChordChart(doc, { mode: 'lyrics' }, render);
    assert.deepEqual(lyrics.pages.map((p) => p.chartPage), [0, 1, 2]);
    assert.deepEqual(seen.at(-1), { mode: 'lyrics', key: 'G', title: '곡' });
    assert.equal((await updateChordChart(lyrics, { mode: 'chords' }, render)).pages.length, 2);

    const filler: SheetPage[] = Array.from({ length: 19 }, () => ({ image: 'x', width: 1, height: 1, marks: [] }));
    await assert.rejects(applyChordChart({ ...doc, chart: undefined, pages: filler }, settings(), '곡', render), /20페이지/);
    await assert.rejects(applyChordChart(null, { ...settings(), key: 'H' as never }, '곡', render), /코드 악보/);
});
