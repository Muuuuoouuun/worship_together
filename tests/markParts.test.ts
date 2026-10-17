import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isMarkVisible,
    markPart,
    marksForParts,
    marksNotIn,
    parsePart,
    parsePartSelection,
    PART_LABELS,
    serializePartSelection,
    SHEET_PARTS,
    togglePartInSelection,
    withMarkPart,
    type SheetPart,
} from '../lib/markParts';
import { canUndo, EMPTY_HISTORY, recordSheetChange, undoPage } from '../lib/markHistory';
import { validateSheet, type SheetDocument, type SheetMark } from '../lib/sheetAnnotations';
import { drawSheetMarks } from '../lib/sheetRender';

const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const stamp = (id: string, part?: SheetPart | string): SheetMark =>
    ({ id, kind: 'stamp', color: '#2563eb', text: id, points: [[100, 100]], ...(part === undefined ? {} : { part }) }) as SheetMark;
const songform = (part?: SheetPart): SheetMark => ({
    id: 'band',
    kind: 'songform',
    color: '#0f172a',
    points: [[20, 20]],
    sections: ['I', 'V1', 'C'],
    ...(part ? { part } : {}),
});
const section = (part?: SheetPart): SheetMark => ({ id: 'chorus', kind: 'section', color: '#dc2626', text: 'C', points: [[40, 300]], ...(part ? { part } : {}) });
const sheetWith = (...marks: unknown[]) => ({
    version: 1,
    title: '은혜로다',
    updatedAt: '2026-10-14T00:00:00.000Z',
    pages: [{ image: IMAGE, width: 1000, height: 1414, marks }],
});
const ids = (marks: readonly SheetMark[]) => marks.map((m) => m.id);

test('the part list has the five band parts with Korean labels', () => {
    assert.deepEqual([...SHEET_PARTS], ['vocal', 'keys', 'guitar', 'bass', 'drums']);
    assert.deepEqual(SHEET_PARTS.map((part) => PART_LABELS[part]), ['보컬', '건반', '기타', '베이스', '드럼']);
});

test('marksForParts: null shows every mark, and the very same array', () => {
    const marks = [stamp('a'), stamp('b', 'drums'), stamp('c', 'vocal')];
    assert.equal(marksForParts(marks, null), marks);
});

test('marksForParts keeps marks without a part and the chosen parts only', () => {
    const marks = [stamp('all'), stamp('drum-in', 'drums'), stamp('harmony', 'vocal'), stamp('voicing', 'keys')];
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>(['drums']))), ['all', 'drum-in']);
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>(['vocal', 'keys']))), ['all', 'harmony', 'voicing']);
    // Nothing picked: only what is for everyone.
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>())), ['all']);
});

test('marksForParts leaves the stored marks alone and reuses its result', () => {
    const marks = Object.freeze([stamp('all'), stamp('drum-in', 'drums'), stamp('harmony', 'vocal')]) as readonly SheetMark[];
    const drums = new Set<SheetPart>(['drums']);
    const shown = marksForParts(marks, drums);
    assert.deepEqual(ids(shown), ['all', 'drum-in']);
    assert.deepEqual(ids(marks), ['all', 'drum-in', 'harmony']);
    assert.equal(marksForParts(marks, drums), shown);
    // Nothing hidden: the original array comes back, so a memoized layer sees no change.
    assert.equal(marksForParts(marks, new Set<SheetPart>(SHEET_PARTS)), marks);
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>(['vocal']))), ['all', 'harmony']);
});

test('song form marks stay for everyone and ignore part', () => {
    const marks = [songform('drums'), section('vocal'), stamp('harmony', 'vocal'), stamp('drum-in', 'drums')];
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>(['keys']))), ['band', 'chorus']);
    assert.deepEqual(ids(marksForParts(marks, new Set<SheetPart>())), ['band', 'chorus']);
    assert.equal(markPart(songform('drums')), undefined);
    assert.equal(markPart(section('vocal')), undefined);
    assert.ok(isMarkVisible(songform('drums'), new Set<SheetPart>(['vocal'])));
    assert.equal(markPart(stamp('x', 'bass')), 'bass');
});

test('withMarkPart tags a new mark without touching the original, but never a song form mark', () => {
    const plain = stamp('a');
    const tagged = withMarkPart(plain, 'drums');
    assert.equal(tagged.part, 'drums');
    assert.equal(plain.part, undefined);
    assert.equal(withMarkPart(plain, null), plain);
    const band = songform();
    assert.equal(withMarkPart(band, 'drums'), band);
    assert.equal(withMarkPart(section(), 'keys').part, undefined);
});

test('marksNotIn drops personal marks the team copy already holds', () => {
    const team = [stamp('a'), stamp('b', 'drums')];
    const personal = [stamp('a'), stamp('b', 'drums'), stamp('mine', 'keys')];
    assert.deepEqual(ids(marksNotIn(personal, team)), ['mine']);
    assert.deepEqual(ids(marksNotIn(personal, [])), ['a', 'b', 'mine']);
});

test('stored choices parse back, and unknown ones mean everyone', () => {
    assert.equal(parsePart('drums'), 'drums');
    assert.equal(parsePart('all'), null);
    assert.equal(parsePart('piano'), null);
    assert.equal(parsePart(null), null);

    assert.equal(parsePartSelection('all'), null);
    assert.equal(parsePartSelection(null), null);
    assert.equal(parsePartSelection('piano'), null);
    assert.deepEqual([...(parsePartSelection('keys,vocal,piano') ?? [])].sort(), ['keys', 'vocal']);
    assert.equal(parsePartSelection(SHEET_PARTS.join(',')), null);
    assert.equal(serializePartSelection(null), 'all');
    assert.equal(serializePartSelection(new Set<SheetPart>(['drums', 'vocal'])), 'vocal,drums');
    assert.equal(serializePartSelection(new Set<SheetPart>()), 'all');
});

test('tapping parts in the 보기 filter adds and drops them', () => {
    const drums = togglePartInSelection(null, 'drums');
    assert.deepEqual([...(drums ?? [])], ['drums']);
    const both = togglePartInSelection(drums, 'keys');
    assert.deepEqual([...(both ?? [])].sort(), ['drums', 'keys']);
    assert.deepEqual([...(togglePartInSelection(both, 'drums') ?? [])], ['keys']);
    // Dropping the last part, or adding the last missing one, shows every part again.
    assert.equal(togglePartInSelection(drums, 'drums'), null);
    assert.equal(togglePartInSelection(new Set<SheetPart>(['vocal', 'keys', 'guitar', 'bass']), 'drums'), null);
    // The earlier selection is never changed.
    assert.deepEqual([...(drums ?? [])], ['drums']);
});

test('validateSheet accepts each part and keeps it', () => {
    const doc = validateSheet(sheetWith(...SHEET_PARTS.map((part) => stamp(`mark-${part}`, part))));
    assert.deepEqual(doc.pages[0].marks.map((m) => m.part), [...SHEET_PARTS]);
});

test('validateSheet keeps documents saved before parts existed valid', () => {
    const doc = validateSheet(sheetWith(stamp('old'), { id: 'pen', kind: 'pen', color: '#dc2626', points: [[1, 1], [2, 2]] }));
    assert.equal(doc.pages[0].marks.length, 2);
    assert.equal(doc.pages[0].marks[0].part, undefined);
});

test('validateSheet rejects a part that is not one of the five', () => {
    for (const part of ['piano', '', 'Drums', 3, null, ['drums']]) {
        assert.throws(() => validateSheet(sheetWith({ ...stamp('x'), part })), /필기 데이터가 올바르지 않습니다/, `part ${JSON.stringify(part)}`);
    }
});

test('validateSheet accepts a part on a song form mark, which then shows for everyone anyway', () => {
    const doc = validateSheet(sheetWith(songform('drums'), section('vocal')));
    assert.deepEqual(ids(marksForParts(doc.pages[0].marks, new Set<SheetPart>(['keys']))), ['band', 'chorus']);
    assert.throws(() => validateSheet(sheetWith({ ...songform(), part: 'piano' })), /필기 데이터가 올바르지 않습니다/);
});

/** A canvas context that only records the text it is asked to paint. */
function recordingContext() {
    const painted: string[] = [];
    const state: Record<string, unknown> = {};
    const ctx = new Proxy(state, {
        get: (target, prop: string) => (prop === 'fillText' ? (text: string) => void painted.push(text) : prop in target ? target[prop] : () => undefined),
        set: (target, prop: string, value) => {
            target[prop] = value;
            return true;
        },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, painted };
}

test('drawSheetMarks draws only what the optional filter lets through', () => {
    const marks = [stamp('all'), stamp('drum-in', 'drums'), stamp('harmony', 'vocal')];
    const everything = recordingContext();
    drawSheetMarks(everything.ctx, marks, 1.4);
    assert.deepEqual(everything.painted.sort(), ['all', 'drum-in', 'harmony']);

    const drummer = recordingContext();
    drawSheetMarks(drummer.ctx, marks, 1.4, (all) => marksForParts(all, new Set<SheetPart>(['drums'])));
    assert.deepEqual(drummer.painted.sort(), ['all', 'drum-in']);
});

test('undo restores the marks as stored, whatever the view filter hides', () => {
    const page = (marks: SheetMark[]) => ({ image: IMAGE, width: 1000, height: 1414, marks });
    const doc = (marks: SheetMark[]): SheetDocument => ({ version: 1, title: '은혜로다', updatedAt: '2026-10-14T00:00:00.000Z', pages: [page(marks)] });
    const start = doc([stamp('harmony', 'vocal')]);
    const drummer = new Set<SheetPart>(['drums']);
    // The drummer's view hides the vocal mark, but drawing still adds to the full list.
    assert.deepEqual(ids(marksForParts(start.pages[0].marks, drummer)), []);
    const drawn = doc([...start.pages[0].marks, withMarkPart(stamp('drum-in'), 'drums')]);
    const history = recordSheetChange(EMPTY_HISTORY, start, drawn, 1000);
    assert.ok(canUndo(history, 0));
    const undone = undoPage(history, drawn, 0);
    assert.ok(undone);
    assert.equal(undone.doc.pages[0].marks, start.pages[0].marks);
    assert.deepEqual(undone.doc.pages[0].marks.map((m) => m.part), ['vocal']);
});
