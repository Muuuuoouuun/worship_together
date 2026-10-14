import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DURATION_BEATS,
    keyInterval,
    keyLabel,
    LEAD_SHEET_KEYS,
    normalizeKey,
    SAMPLE_LEAD_SHEET,
    transposeChord,
    transposeLeadSheet,
    transposePitch,
    type Pitch,
} from '../lib/leadSheet';

const p = (letter: Pitch['letter'], accidental: number, octave: number): Pitch => ({ letter, accidental, octave });

test('every sample measure fills 4/4 and every lyric sits on a note', () => {
    for (const system of SAMPLE_LEAD_SHEET.pages.flat()) {
        for (const [index, measure] of system.measures.entries()) {
            const beats = measure.notes.reduce((sum, n) => sum + DURATION_BEATS[n.duration], 0);
            assert.equal(beats, 4, `${system.section} m${index + 1}`);
            for (const chord of measure.chords) assert.ok(chord.beat >= 0 && chord.beat < 4);
        }
    }
    assert.equal(SAMPLE_LEAD_SHEET.pages.flat().length, 8);
});

test('key intervals move by the right letters and stay within a tritone', () => {
    assert.deepEqual(keyInterval('C', 'D'), { semitones: 2, steps: 1 });
    assert.deepEqual(keyInterval('C', 'Eb'), { semitones: 3, steps: 2 });
    assert.deepEqual(keyInterval('C', 'A'), { semitones: -3, steps: -2 });
    assert.deepEqual(keyInterval('C', 'G'), { semitones: -5, steps: -3 });
    assert.deepEqual(keyInterval('C', 'F#'), { semitones: 6, steps: 3 });
    assert.deepEqual(keyInterval('D', 'C'), { semitones: -2, steps: -1 });
    for (const key of LEAD_SHEET_KEYS) assert.ok(Math.abs(keyInterval('C', key).semitones) <= 6, key);
});

test('notes are spelled for the new key', () => {
    const toD = keyInterval('C', 'D');
    assert.deepEqual(transposePitch(p('f', 0, 4), toD), p('g', 0, 4));
    assert.deepEqual(transposePitch(p('b', 0, 4), toD), p('c', 1, 5));
    assert.deepEqual(transposePitch(p('e', 0, 5), keyInterval('C', 'Eb')), p('g', 0, 5));
    assert.deepEqual(transposePitch(p('b', 0, 4), keyInterval('C', 'Eb')), p('d', 0, 5));
    assert.deepEqual(transposePitch(p('e', 0, 4), keyInterval('C', 'A')), p('c', 1, 4));
    // F♯ major really has E♯ in its scale.
    assert.deepEqual(transposePitch(p('b', 0, 4), keyInterval('C', 'F#')), p('e', 1, 5));
});

test('chord symbols keep their quality and slash bass', () => {
    const toD = keyInterval('C', 'D');
    assert.equal(transposeChord('G/B', toD), 'A/C#');
    assert.equal(transposeChord('G7sus4', toD), 'A7sus4');
    assert.equal(transposeChord('F#m7', toD), 'G#m7');
    assert.equal(transposeChord('Bbmaj7', toD), 'Cmaj7');
    assert.equal(transposeChord('Dadd9', keyInterval('D', 'E')), 'Eadd9');
    assert.equal(transposeChord('C/E', keyInterval('C', 'Eb')), 'Eb/G');
    // Chord roots use plain spellings even where the scale has E♯ or C♭.
    assert.equal(transposeChord('B', keyInterval('C', 'F#')), 'F');
    assert.equal(transposeChord('N.C.', toD), 'N.C.');
});

test('transposeLeadSheet changes notes and chords but not rhythm or lyrics', () => {
    const inD = transposeLeadSheet(SAMPLE_LEAD_SHEET, 'D');
    assert.equal(inD.key, 'D');
    const [c, d] = [SAMPLE_LEAD_SHEET.pages[0][1].measures[0], inD.pages[0][1].measures[0]];
    assert.equal(d.chords[0].symbol, 'G');
    assert.deepEqual(d.notes.map((n) => [n.duration, n.lyric]), c.notes.map((n) => [n.duration, n.lyric]));
    assert.deepEqual(d.notes[0].pitch, p('d', 0, 5));
    assert.equal(transposeLeadSheet(SAMPLE_LEAD_SHEET, 'C'), SAMPLE_LEAD_SHEET);
    assert.equal(keyLabel('Bb'), 'B♭');
    assert.equal(keyLabel('F#'), 'F♯');
});

test('normalizeKey reads library keys as major keys the sheet can be drawn in', () => {
    assert.equal(normalizeKey('G'), 'G');
    assert.equal(normalizeKey(' a# '), 'Bb');
    assert.equal(normalizeKey('B♭'), 'Bb');
    assert.equal(normalizeKey('Gb'), 'F#');
    assert.equal(normalizeKey('Dmaj'), 'D');
    assert.equal(normalizeKey('Em'), null);
    assert.equal(normalizeKey(''), null);
    assert.equal(normalizeKey(null), null);
});
