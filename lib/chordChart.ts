import { isLeadSheetKey, keyInterval, keyLabel, LEAD_SHEET_KEYS, normalizeKey, transposeChord, type LeadSheetKey } from './leadSheet';

/**
 * Chord charts (코드 악보): chords over lyrics, written as ChordPro-style text, so a key change or capo is
 * a text transform. The music logic (key intervals, chord spelling) lives in `leadSheet.ts`.
 *
 * Syntax, one item per line:
 *   [G]주의 [D/F#]은혜     chords go in [brackets] right before the syllable they sit on (mid-word is fine)
 *   [Verse 1]              a line that is only a bracket whose text is NOT a chord starts a section
 *   {c: Chorus}            a comment directive also starts a section ({comment: …} works too)
 *   # 후렴                 so does a line starting with #
 *   {title: 은혜로다}      {key: G}  {capo: 2}  {tempo: 72}   (also {t:} {k:} {bpm:})
 *   {soc} {sov} {sob}      Chorus / Verse / Bridge sections (optionally {soc: 후렴}); other directives are ignored
 *   (blank line)           a gap between stanzas
 * `[Chorus]` is a section while `[C]` and `[Am7]` are chords; a section named like a chord ("A") needs
 * `{c: A}` or `# A`. A bracket that is neither alone on its line nor a chord stays in the lyric as text.
 * Chords are written in the key of the text (`originalKey`); `{key:}` and `{capo:}` only preset the controls.
 */

export type ChartSegment = { chord?: string; lyric: string };
/** One line of lyrics split at its chords. An empty array is a blank line. */
export type ChartLine = ChartSegment[];
export type ChartSection = { name: string; lines: ChartLine[] };
export type ChordChart = { title?: string; key?: LeadSheetKey; capo?: number; tempo?: number; sections: ChartSection[] };

/** 'chords' = chords over lyrics; 'lyrics' = bigger lyrics without chords (singers, projector). */
export type ChartMode = 'chords' | 'lyrics';
/** 'concert' = chords in the sounding key; 'capo' = the shapes to play with the capo on. */
export type ChartChordsAs = 'concert' | 'capo';
/** What a sheet remembers about its chord chart: the text plus how to show it. */
export type ChartSettings = {
    source: string;
    /** Concert key the chart is shown in. */
    key: LeadSheetKey;
    /** Key the chords in `source` are written in. */
    originalKey: LeadSheetKey;
    capo: number;
    mode: ChartMode;
    chordsAs: ChartChordsAs;
};

export const CHART_SOURCE_MAX = 20000;
export const CHART_MAX_CAPO = 11;

export const clampCapo = (capo: number) => (Number.isFinite(capo) ? Math.min(CHART_MAX_CAPO, Math.max(0, Math.round(capo))) : 0);

export function isChartSettings(value: unknown): value is ChartSettings {
    if (!value || typeof value !== 'object') return false;
    const chart = value as Partial<ChartSettings>;
    return (
        typeof chart.source === 'string' &&
        chart.source.length <= CHART_SOURCE_MAX &&
        isLeadSheetKey(chart.key) &&
        isLeadSheetKey(chart.originalKey) &&
        Number.isInteger(chart.capo) &&
        (chart.capo as number) >= 0 &&
        (chart.capo as number) <= CHART_MAX_CAPO &&
        (chart.mode === 'chords' || chart.mode === 'lyrics') &&
        (chart.chordsAs === 'concert' || chart.chordsAs === 'capo')
    );
}

/** Roots A–G with #/b, qualities (m, maj7, sus4, add9, dim, aug, +, °, ø, extensions, (…) alterations), slash bass; N.C. too. */
const CHORD = /^(?:N\.?C\.?|[A-G][#b]?(?:maj|min|dim|aug|sus|add|alt|omit|[mM+°ø]|-|\d+|[#b]\d+|\([^()]*\))*(?:\/[A-G][#b]?)?)$/;

/** "Am7", "D/F#", "Bbmaj7" → true; "Chorus", "Verse 1", "후렴" → false. */
export const isChord = (token: string) => CHORD.test(token.trim().replace(/♯/g, '#').replace(/♭/g, 'b'));

const normalizeChord = (token: string) => token.trim().replace(/♯/g, '#').replace(/♭/g, 'b');

/** "[G]주의 [D/F#]은혜" → segments; brackets that are not chords stay in the lyric. */
function parseLine(line: string): ChartLine {
    const segments: ChartSegment[] = [];
    let current: ChartSegment = { lyric: '' };
    for (const [index, part] of line.split(/(\[[^[\]]*\])/).entries()) {
        if (index % 2 === 1 && isChord(part.slice(1, -1))) {
            if (current.chord !== undefined || current.lyric) segments.push(current);
            current = { chord: normalizeChord(part.slice(1, -1)), lyric: '' };
        } else {
            current.lyric += part;
        }
    }
    if (current.chord !== undefined || current.lyric) segments.push(current);
    return segments;
}

const DIRECTIVE = /^\{\s*([A-Za-z_]+)\s*:?\s*(.*?)\s*\}$/;
/** Directives that start a section, with the name used when they carry no text. */
const SECTION_DIRECTIVES = new Map<string, string>([
    ['c', ''],
    ['comment', ''],
    ['ci', ''],
    ['comment_italic', ''],
    ['cb', ''],
    ['comment_box', ''],
    ['soc', 'Chorus'],
    ['start_of_chorus', 'Chorus'],
    ['sov', 'Verse'],
    ['start_of_verse', 'Verse'],
    ['sob', 'Bridge'],
    ['start_of_bridge', 'Bridge'],
]);
const SECTION_NAME_MAX = 40;

export function parseChordChart(source: string): ChordChart {
    const chart: ChordChart = { sections: [] };
    let section: ChartSection | null = null;
    const startSection = (name: string): ChartSection => {
        const next: ChartSection = { name: name.trim().slice(0, SECTION_NAME_MAX), lines: [] };
        chart.sections.push(next);
        return next;
    };
    for (const raw of source.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) {
            // One blank line between stanzas; none at the start or end of a section.
            const lines = section?.lines;
            if (lines?.length && lines[lines.length - 1].length) lines.push([]);
            continue;
        }
        const directive = line.match(DIRECTIVE);
        if (directive) {
            const name = directive[1].toLowerCase();
            const value = directive[2];
            if (name === 'title' || name === 't') {
                if (value) chart.title = value.slice(0, 100);
            } else if (name === 'key' || name === 'k') {
                const key = normalizeKey(value);
                if (key) chart.key = key;
            } else if (name === 'capo') {
                const capo = Number(value);
                if (value && Number.isInteger(capo) && capo >= 0 && capo <= CHART_MAX_CAPO) chart.capo = capo;
            } else if (name === 'tempo' || name === 'bpm') {
                const tempo = Number(value);
                if (value && Number.isInteger(tempo) && tempo >= 20 && tempo <= 400) chart.tempo = tempo;
            } else if (SECTION_DIRECTIVES.has(name)) {
                const label = value || SECTION_DIRECTIVES.get(name);
                if (label) section = startSection(label);
            }
            continue;
        }
        const heading = line.match(/^#+\s*(.*)$/);
        if (heading) {
            if (heading[1]) section = startSection(heading[1]);
            continue;
        }
        const bracket = line.match(/^\[([^[\]]+)\]$/);
        if (bracket && !isChord(bracket[1])) {
            section = startSection(bracket[1]);
            continue;
        }
        section ??= startSection('');
        section.lines.push(parseLine(line));
    }
    for (const { lines } of chart.sections) while (lines.length && !lines[lines.length - 1].length) lines.pop();
    return chart;
}

/**
 * The key a chart is probably written in: `{key:}`, else the first chord (a minor first chord points to its
 * relative major, Am → C). Null when there are no chords.
 */
export function guessChartKey(chart: ChordChart): LeadSheetKey | null {
    if (chart.key) return chart.key;
    const first = chart.sections.flatMap((section) => section.lines.flat()).find((segment) => segment.chord && /^[A-G]/.test(segment.chord))?.chord;
    const root = first?.match(/^[A-G][#b]?/)?.[0];
    if (!first || !root) return null;
    const minor = /^[A-G][#b]?m(?!aj)/.test(first);
    return normalizeKey(minor ? transposeChord(root, { semitones: 3, steps: 2 }) : root);
}

/** Every chord moved from the key it is written in to another key; spelling follows the new key. */
export function transposeChart(chart: ChordChart, from: LeadSheetKey, to: LeadSheetKey): ChordChart {
    if (from === to) return chart;
    const interval = keyInterval(from, to);
    return {
        ...chart,
        sections: chart.sections.map((section) => ({
            ...section,
            lines: section.lines.map((line) => line.map((segment) => (segment.chord ? { ...segment, chord: transposeChord(segment.chord, interval) } : segment))),
        })),
    };
}

/**
 * The key whose chord shapes you play with the capo on: the concert key lowered by `capo` semitones
 * (D, capo 2 → C). LEAD_SHEET_KEYS is in pitch order and spells black keys Db Eb F# Ab Bb.
 */
export function shapesKey(key: LeadSheetKey, capo: number): LeadSheetKey {
    return LEAD_SHEET_KEYS[(LEAD_SHEET_KEYS.indexOf(key) - clampCapo(capo) + 12) % 12];
}

/** The chart with its chords as they should be printed: in the chosen key, or as capo shapes for guitarists. */
export function chartForDisplay(chart: ChordChart, settings: Pick<ChartSettings, 'originalKey' | 'key' | 'capo' | 'chordsAs'>): ChordChart {
    return transposeChart(chart, settings.originalKey, settings.chordsAs === 'capo' ? shapesKey(settings.key, settings.capo) : settings.key);
}

/** Lyrics only: each line becomes one string. Chord-only lines (instrumentals) drop out. */
export function stripChords(chart: ChordChart): ChordChart {
    return {
        ...chart,
        sections: chart.sections.map((section) => {
            const lines: ChartLine[] = [];
            for (const line of section.lines) {
                const lyric = line.map((segment) => segment.lyric).join('').replace(/\s+/g, ' ').trim();
                if (lyric) lines.push([{ lyric }]);
                else if (!line.length && lines.length && lines[lines.length - 1].length) lines.push([]);
            }
            while (lines.length && !lines[lines.length - 1].length) lines.pop();
            return { ...section, lines };
        }),
    };
}

/** Header line: "Key D", "Key D · Capo 2 (C 코드 폼)" for capo shapes, "Key D · Capo 2 (실제 코드)" for concert chords. */
export function chartKeyLine(settings: Pick<ChartSettings, 'key' | 'capo' | 'mode' | 'chordsAs'>): string {
    const base = `Key ${keyLabel(settings.key)}`;
    if (settings.mode === 'lyrics' || settings.capo <= 0) return base;
    return settings.chordsAs === 'capo'
        ? `${base} · Capo ${settings.capo} (${keyLabel(shapesKey(settings.key, settings.capo))} 코드 폼)`
        : `${base} · Capo ${settings.capo} (실제 코드)`;
}

/** Key-row note: how far the chart sits from the key its chords are written in, and how the chords are shown. */
export function chartKeyNote(settings: Pick<ChartSettings, 'key' | 'originalKey' | 'capo' | 'mode' | 'chordsAs'>): string {
    const { semitones } = keyInterval(settings.originalKey, settings.key);
    const moved = semitones === 0 ? '' : semitones > 0 ? `에서 ${semitones}반음 위` : `에서 ${-semitones}반음 아래`;
    return `원키 ${keyLabel(settings.originalKey)}${moved} · ${chartKeyLine(settings)}`;
}
