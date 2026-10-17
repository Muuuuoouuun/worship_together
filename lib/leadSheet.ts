/**
 * Lead sheets the app engraves itself (the 체험용 sample): melody, chords and lyrics as data, so a key
 * change re-renders real notation instead of pasting new chords over an image.
 */

export const LEAD_SHEET_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export type LeadSheetKey = (typeof LEAD_SHEET_KEYS)[number];

export const isLeadSheetKey = (value: unknown): value is LeadSheetKey => LEAD_SHEET_KEYS.includes(value as LeadSheetKey);
const ENHARMONIC: Readonly<Record<string, LeadSheetKey>> = { 'C#': 'Db', 'D#': 'Eb', Gb: 'F#', 'G#': 'Ab', 'A#': 'Bb', Cb: 'B', 'E#': 'F', Fb: 'E', 'B#': 'C' };
/** A song's key as typed in the library ("G", "a#", "B♭") → a major key the sheet can be drawn in; minor keys → null. */
export function normalizeKey(raw: string | null | undefined): LeadSheetKey | null {
    const match = raw?.trim().match(/^([A-Ga-g])([#♯b♭]?)\s*(maj(or)?|M)?$/);
    if (!match) return null;
    const name = `${match[1].toUpperCase()}${match[2] === '♯' || match[2] === '#' ? '#' : match[2] ? 'b' : ''}`;
    return isLeadSheetKey(name) ? name : (ENHARMONIC[name] ?? null);
}

/** "Db" → "D♭", "F#" → "F♯" for display. */
export const keyLabel = (key: string) => (key[1] === 'b' ? `${key[0]}♭${key.slice(2)}` : key.replace('#', '♯'));

/** 'q' quarter, '8' eighth, 'h' half, 'w' whole (in quarter-note beats: 1, 0.5, 2, 4). */
export type LeadDuration = 'w' | 'h' | 'q' | '8';
export const DURATION_BEATS: Readonly<Record<LeadDuration, number>> = { w: 4, h: 2, q: 1, '8': 0.5 };

/** Scientific pitch, e.g. { letter: 'f', accidental: 1, octave: 4 } = F♯4. */
export type Pitch = { letter: 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b'; accidental: number; octave: number };
export type LeadNote = { pitch: Pitch; duration: LeadDuration; lyric?: string };
export type LeadMeasure = {
    /** Chord symbols by the beat they start on (0-based). */
    chords: Array<{ beat: number; symbol: string }>;
    notes: LeadNote[];
    /** Text above the end of the measure, e.g. "Fine". */
    endText?: string;
};
export type LeadSystem = { section: string; measures: LeadMeasure[]; note?: string };
export type LeadSheet = {
    id: string;
    key: LeadSheetKey;
    tempo: number;
    subtitle: string[];
    /** Pages of systems; each system is one staff line. */
    pages: LeadSystem[][];
};

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;
const NATURAL_PC: Readonly<Record<Pitch['letter'], number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const KEY_PC: Readonly<Record<LeadSheetKey, number>> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

const midiOf = (p: Pitch) => 12 * (p.octave + 1) + NATURAL_PC[p.letter] + p.accidental;
const letterIndex = (letter: string) => LETTERS.indexOf(letter.toLowerCase() as Pitch['letter']);

/**
 * How far to move from one key to another: semitones and letter steps together, so spelling follows the
 * new key (F♯ in C → G♯ in D, B in C → D in E♭). Moves of more than a tritone go down instead of up,
 * which keeps the melody on the staff (C → A is down a minor third, not up a sixth).
 */
export function keyInterval(from: LeadSheetKey, to: LeadSheetKey): { semitones: number; steps: number } {
    let semitones = (KEY_PC[to] - KEY_PC[from] + 12) % 12;
    let steps = (letterIndex(to[0]) - letterIndex(from[0]) + 7) % 7;
    if (semitones > 6) {
        semitones -= 12;
        steps -= 7;
    }
    return { semitones, steps };
}

export function transposePitch(pitch: Pitch, { semitones, steps }: { semitones: number; steps: number }): Pitch {
    const index = letterIndex(pitch.letter) + steps;
    const letter = LETTERS[((index % 7) + 7) % 7];
    const octave = pitch.octave + Math.floor(index / 7);
    const accidental = midiOf(pitch) + semitones - (12 * (octave + 1) + NATURAL_PC[letter]);
    return { letter, accidental, octave };
}

/** Plain spellings for chord roots: E♯ → F, C♭ → B, double accidentals → the white key. */
function simplifyRoot(letter: Pitch['letter'], accidental: number): string {
    const pc = (NATURAL_PC[letter] + accidental + 12) % 12;
    const odd = Math.abs(accidental) > 1 || (accidental === 1 && (letter === 'e' || letter === 'b')) || (accidental === -1 && (letter === 'f' || letter === 'c'));
    if (!odd) return `${letter.toUpperCase()}${accidental > 0 ? '#' : accidental < 0 ? 'b' : ''}`;
    const natural = (Object.keys(NATURAL_PC) as Pitch['letter'][]).find((l) => NATURAL_PC[l] === pc);
    if (natural) return natural.toUpperCase();
    return accidental > 0 ? `${LETTERS[(letterIndex(letter) + 6) % 7].toUpperCase()}#` : `${LETTERS[(letterIndex(letter) + 1) % 7].toUpperCase()}b`;
}

function transposeNoteName(name: string, interval: { semitones: number; steps: number }): string {
    const match = name.match(/^([A-G])([#b]?)$/);
    if (!match) return name;
    const moved = transposePitch({ letter: match[1].toLowerCase() as Pitch['letter'], accidental: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0, octave: 4 }, interval);
    return simplifyRoot(moved.letter, moved.accidental);
}

/** "G7sus4" → "A7sus4", "C/E" → "D/F#", "Bbmaj7" → "Cmaj7" (D major). Text that isn't a chord stays. */
export function transposeChord(symbol: string, interval: { semitones: number; steps: number }): string {
    const match = symbol.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
    if (!match) return symbol;
    const [, root, quality, bass] = match;
    return `${transposeNoteName(root, interval)}${quality}${bass ? `/${transposeNoteName(bass, interval)}` : ''}`;
}

/** The whole sheet in another key: melody notes, chords and the key signature. */
export function transposeLeadSheet(sheet: LeadSheet, key: LeadSheetKey): LeadSheet {
    if (key === sheet.key) return sheet;
    const interval = keyInterval(sheet.key, key);
    return {
        ...sheet,
        key,
        pages: sheet.pages.map((systems) =>
            systems.map((system) => ({
                ...system,
                measures: system.measures.map((measure) => ({
                    ...measure,
                    chords: measure.chords.map((c) => ({ ...c, symbol: transposeChord(c.symbol, interval) })),
                    notes: measure.notes.map((n) => ({ ...n, pitch: transposePitch(n.pitch, interval) })),
                })),
            }))
        ),
    };
}

/** "e5:8:주" style shorthand → a note (pitch letter, optional #/b, octave; duration; lyric syllable). */
function note(spec: string): LeadNote {
    const [pitchSpec, duration, lyric] = spec.split(':');
    const match = pitchSpec.match(/^([a-g])([#b]?)(\d)$/);
    if (!match) throw new Error(`bad note ${spec}`);
    return {
        pitch: { letter: match[1] as Pitch['letter'], accidental: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0, octave: Number(match[3]) },
        duration: duration as LeadDuration,
        ...(lyric ? { lyric } : {}),
    };
}
const bar = (chords: string, notes: string, endText?: string): LeadMeasure => ({
    chords: chords.split(' ').map((part) => {
        const [symbol, beat] = part.split('@');
        return { symbol, beat: beat ? Number(beat) : 0 };
    }),
    notes: notes.split(' ').map(note),
    ...(endText ? { endText } : {}),
});

/** The 체험용 sample, written in C. Systems sit where the old drawn sample had them, so its marks still line up. */
export const SAMPLE_LEAD_SHEET: LeadSheet = {
    id: 'sample',
    key: 'C',
    tempo: 68,
    subtitle: ['Worship Lead Sheet · 4/4 박자 · 느리고 은혜롭게', 'Worship Lead Sheet · 후렴 및 엔딩'],
    pages: [
        [
            {
                section: 'Intro',
                note: '(피아노 & 어쿠스틱 기타 아르페지오 잔잔하게 시작)',
                measures: [
                    bar('C', 'e4:8 g4:8 c5:q g4:8 e4:8 g4:q'),
                    bar('G/B', 'd4:8 g4:8 b4:q g4:8 d4:8 g4:q'),
                    bar('Am7', 'e4:8 a4:8 c5:q a4:8 e4:8 g4:q'),
                    bar('Em7', 'e4:8 g4:8 b4:q d5:h'),
                ],
            },
            {
                section: 'Verse 1',
                measures: [
                    bar('F', 'c5:q:시 a4:8:작 a4:8:됐 f4:h:네'),
                    bar('C/E', 'e4:8:우 f4:8:리 g4:q:주 g4:8:님 a4:8:의 g4:q:능'),
                    bar('Dm7', 'f4:q:력 e4:8:이 d4:8:나 f4:q:의 a4:q:삶'),
                    bar('G7sus4 G@2', 'g4:8:을 g4:8:다 a4:8:스 b4:8:리 c5:q:시 b4:q:네'),
                ],
            },
            {
                section: 'Chorus',
                measures: [
                    bar('C', 'e5:8:주 d5:8:의 c5:q:은 c5:8:혜 d5:8:로 e5:q:다'),
                    bar('Em7', 'e5:8:주 d5:8:의 b4:q:은 b4:8:혜 c5:8:로 d5:q:다'),
                    bar('F', 'c5:8:주 c5:8:님 a4:q:의 a4:8:사 c5:8:랑 c5:q:이'),
                    bar('G', 'b4:8:나 c5:8:를 d5:q:감 b4:q:싸 g4:q:네'),
                ],
            },
            {
                section: 'Verse 2',
                measures: [
                    bar('Am7', 'c5:8:넘 c5:8:치 b4:8:는 a4:8:은 a4:q:혜 e4:q:로'),
                    bar('Em7', 'e4:8:내 g4:8:영 g4:q:혼 b4:8:소 b4:8:생 g4:q:케'),
                    bar('F G7@2', 'a4:8:하 a4:8:시 c5:q:며 b4:8:나 a4:8:의 g4:8:모 f4:8:든'),
                    bar('C', 'e4:8:길 f4:8:인 g4:8:도 e4:8:하 d4:q:시 c4:q:네'),
                ],
            },
        ],
        [
            {
                section: 'Bridge',
                measures: [
                    bar('F', 'a4:8:내 a4:8:가 c5:8:누 c5:8:려 d5:q:왔 c5:q:던'),
                    bar('G/F', 'b4:8:모 b4:8:든 d5:q:것 c5:q:들 b4:q:이'),
                    bar('Em7', 'g4:8:내 g4:8:가 b4:8:지 b4:8:나 d5:q:왔 b4:q:던'),
                    bar('Am7', 'c5:8:모 c5:8:든 c5:q:시 b4:q:간 a4:q:이'),
                ],
            },
            {
                section: 'Bridge 2',
                measures: [
                    bar('Dm7', 'a4:8:내 a4:8:가 c5:8:걸 c5:8:어 f5:q:왔 e5:q:던'),
                    bar('G7', 'd5:8:모 d5:8:든 d5:q:순 c5:q:간 b4:q:이'),
                    bar('C', 'c5:8:당 c5:8:연 e5:q:한 d5:q:것 c5:8:아 c5:8:니'),
                    bar('C7', 'b4:q:라 c5:8:은 d5:8:혜 e5:q:였 c5:q:소'),
                ],
            },
            {
                section: 'Chorus (All Out)',
                measures: [
                    bar('F', 'c5:8:아 c5:8:침 f5:q:해 e5:8:가 d5:8:뜨 c5:q:고'),
                    bar('G/F', 'd5:8:저 d5:8:녁 e5:q:의 d5:q:노 b4:q:을'),
                    bar('Em7', 'b4:8:봄 c5:8:의 d5:8:꽃 d5:8:향 e5:q:기 d5:q:와'),
                    bar('Am7', 'c5:8:가 c5:8:을 c5:q:의 b4:q:열 a4:q:매'),
                ],
            },
            {
                section: 'Ending / Coda',
                measures: [
                    bar('Dm7', 'a4:8:꿈 a4:8:꾸 a4:q:지 c5:8:못 c5:8:했 d5:q:던'),
                    bar('G7', 'd5:8:가 d5:8:장 f5:q:큰 e5:q:선 d5:q:물'),
                    bar('Csus4', 'c5:8:주 c5:8:님 f5:q:의 e5:8:사 d5:8:랑 c5:q:과'),
                    bar('C', 'c5:8:은 d5:8:혜 d5:q:라 c5:h:네', 'Fine'),
                ],
            },
        ],
    ],
};

/** Built-in sheets the app can re-engrave, by id. */
export const LEAD_SHEETS: Readonly<Record<string, LeadSheet>> = { [SAMPLE_LEAD_SHEET.id]: SAMPLE_LEAD_SHEET };
