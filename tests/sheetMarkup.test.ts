import test from 'node:test';
import assert from 'node:assert/strict';
import {
    appendStrokePoint,
    assembleStoredSheet,
    isPointNearMark,
    lineMarkPath,
    lineMarkSegments,
    rotateMarks,
    snapLineEnd,
    splitSheetForStorage,
    validateSheet,
    type SheetDocument,
    type SheetMark,
} from '../lib/sheetAnnotations';

const IMAGE = 'data:image/jpeg;base64,/9j/4AAQ';
const doc = (marks: SheetMark[]): SheetDocument => ({
    version: 1,
    title: '은혜로다',
    updatedAt: new Date().toISOString(),
    pages: [{ image: IMAGE, width: 1200, height: 1600, marks }],
});

test('appendStrokePoint drops samples that sit on the last kept point', () => {
    const points: Array<[number, number]> = [];
    assert.equal(appendStrokePoint(points, [10, 10]), true);
    assert.equal(appendStrokePoint(points, [10.5, 10.6]), false);
    assert.equal(appendStrokePoint(points, [12, 10]), true);
    assert.deepEqual(points, [[10, 10], [12, 10]]);
});

test('line marks draw as a line, an arrow or a hairpin', () => {
    const base = { points: [[100, 100], [400, 100]] as Array<[number, number]>, strokeWidth: 3 };
    assert.equal(lineMarkSegments({ ...base, shape: 'line' }, 1).length, 1);
    const arrow = lineMarkSegments({ ...base, shape: 'arrow' }, 1);
    assert.equal(arrow.length, 3);
    // Both arrowhead strokes start at the tip and lean back toward the start.
    for (const [from, to] of arrow.slice(1)) {
        assert.deepEqual(from, [400, 100]);
        assert.ok(to[0] < 400);
    }
    const [upper, lower] = lineMarkSegments({ ...base, shape: 'cresc' }, 1);
    assert.deepEqual([upper[0], lower[0]], [[100, 100], [100, 100]]);
    assert.ok(Math.abs(upper[1][1] - lower[1][1]) > 10, 'crescendo opens toward the end');
    const [d1, d2] = lineMarkSegments({ ...base, shape: 'decresc' }, 1);
    assert.deepEqual([d1[0], d2[0]], [[400, 100], [400, 100]]);
    assert.match(lineMarkPath({ ...base, shape: 'arrow' }, 1.5), /^M 100\.00 150\.00 L 400\.00 150\.00 M /);
});

test('snapLineEnd snaps to 45° steps on screen', () => {
    const [x, y] = snapLineEnd([100, 100], [300, 104], 1.5);
    assert.ok(Math.abs(y - 100) < 1e-9 && x > 290);
    const diag = snapLineEnd([100, 100], [200, 160], 1.5);
    assert.ok(Math.abs((diag[0] - 100) - (diag[1] - 100) * 1.5) < 1e-6, 'equal on-screen dx and dy');
});

test('validateSheet accepts line and ellipse marks and rejects malformed ones', () => {
    const line: SheetMark = { id: 'l', kind: 'line', color: '#dc2626', points: [[100, 100], [300, 200]], shape: 'arrow', strokeWidth: 3 };
    const ellipse: SheetMark = { id: 'e', kind: 'rect', color: '#2563eb', points: [[100, 100], [300, 200]], shape: 'ellipse', strokeWidth: 3 };
    assert.doesNotThrow(() => validateSheet(doc([line, ellipse])));
    assert.throws(() => validateSheet(doc([{ ...line, points: [[100, 100]] }])));
    assert.throws(() => validateSheet(doc([{ ...line, shape: 'ellipse' }])));
    assert.throws(() => validateSheet(doc([{ ...ellipse, shape: 'arrow' }])));
});

test('the eraser finds a line by its segments, arrowheads included', () => {
    const ratio = 1600 / 1200;
    const mark: SheetMark = { id: 'l', kind: 'line', color: '#dc2626', points: [[100, 300], [500, 300]], shape: 'arrow', strokeWidth: 3 };
    assert.equal(isPointNearMark(300, 300, mark, ratio), true);
    assert.equal(isPointNearMark(300, 360, mark, ratio), false);
    const [, head] = lineMarkSegments(mark, ratio);
    assert.equal(isPointNearMark(head[1][0], head[1][1] / ratio, mark, ratio, 4), true);
});

test('rotateMarks moves marks with a page turned 90°, keeping their size on the music', () => {
    const pen: SheetMark = { id: 'p', kind: 'pen', color: '#111827', points: [[100, 200], [300, 250]], strokeWidth: 4 };
    const text: SheetMark = { id: 't', kind: 'text', color: '#111827', points: [[990, 10]], text: 'Capo 2', fontSize: 24 };
    const [rotated, label] = rotateMarks([pen, text], 90, 1200, 1600);
    assert.deepEqual(rotated.points, [[800, 100], [750, 300]]);
    assert.equal(rotated.strokeWidth, 3);
    assert.equal(label.fontSize, 18);
    assert.ok(label.points[0][0] <= 940, 'label anchor stays where the label fits');
    const back = rotateMarks(rotateMarks(rotateMarks(rotateMarks([pen], 90, 1200, 1600), 90, 1600, 1200), 90, 1200, 1600), 90, 1600, 1200);
    assert.deepEqual(back[0].points, pen.points);
    assert.ok(Math.abs((back[0].strokeWidth ?? 0) - 4) < 1e-9);
});

test('storage split keeps images apart from marks and puts them back together', () => {
    const marks: SheetMark[] = [{ id: 'p', kind: 'pen', color: '#111827', points: [[1, 2], [3, 4]] }];
    const sheet: SheetDocument = { ...doc(marks), pages: [{ image: IMAGE, width: 10, height: 20, marks }, { image: IMAGE, width: 10, height: 20, marks: [] }, { image: `${IMAGE}AA`, width: 10, height: 20, marks: [] }] };
    let n = 0;
    const known = new Map<string, string>();
    const first = splitSheetForStorage(sheet, (image) => known.get(image), () => `img-${++n}`);
    // The same image on two pages is stored once.
    assert.deepEqual(first.newImages.map(([id]) => id), ['img-1', 'img-2']);
    assert.deepEqual(first.stored.pages.map((p) => p.imageId), ['img-1', 'img-1', 'img-2']);
    assert.ok(first.stored.pages.every((p) => !('image' in p)));
    for (const [id, data] of first.newImages) known.set(data, id);
    // A later save of the same images writes marks only.
    assert.equal(splitSheetForStorage(sheet, (image) => known.get(image), () => 'unused').newImages.length, 0);
    const images = new Map(first.newImages);
    assert.deepEqual(assembleStoredSheet(first.stored, images), sheet);
    // v1 records keep their images inline and load as they are.
    assert.deepEqual(assembleStoredSheet(sheet, new Map()), sheet);
    assert.throws(() => assembleStoredSheet(first.stored, new Map()), /이미지/);
});
