import test from 'node:test';
import assert from 'node:assert/strict';
import { canRedo, canUndo, EMPTY_HISTORY, HISTORY_LIMIT, recordSheetChange, redoPage, undoPage } from '../lib/markHistory';
import type { SheetDocument, SheetMark } from '../lib/sheetAnnotations';

const mark = (id: string, x = 100): SheetMark => ({ id, kind: 'stamp', color: '#2563eb', text: '한 번 더', points: [[x, 100]] });
const doc = (...pages: SheetMark[][]): SheetDocument => ({
    version: 1,
    title: '은혜로다',
    updatedAt: '2026-10-14T00:00:00.000Z',
    pages: pages.map((marks, index) => ({ image: `page-${index}`, width: 1200, height: 1600, marks })),
});
const editPage = (current: SheetDocument, pageIndex: number, marks: SheetMark[]): SheetDocument => ({
    ...current,
    pages: current.pages.map((page, index) => (index === pageIndex ? { ...page, marks } : page)),
});

test('erasing and clearing undo and redo like drawing does', () => {
    const start = doc([mark('a'), mark('b')], []);
    const erased = editPage(start, 0, [start.pages[0].marks[0]]);
    let history = recordSheetChange(EMPTY_HISTORY, start, erased, 1000);
    const cleared = editPage(erased, 0, []);
    history = recordSheetChange(history, erased, cleared, 2000);
    assert.ok(canUndo(history, 0));
    assert.ok(!canUndo(history, 1));

    const first = undoPage(history, cleared, 0);
    assert.ok(first);
    assert.equal(first.doc.pages[0].marks, erased.pages[0].marks);
    const second = undoPage(first.history, first.doc, 0);
    assert.ok(second);
    assert.deepEqual(second.doc.pages[0].marks.map((m) => m.id), ['a', 'b']);
    assert.ok(!canUndo(second.history, 0));
    assert.ok(canRedo(second.history, 0));

    const again = redoPage(second.history, second.doc, 0);
    assert.ok(again);
    assert.deepEqual(again.doc.pages[0].marks.map((m) => m.id), ['a']);
    // A new edit after undoing drops what could be redone.
    const drawn = editPage(again.doc, 0, [...again.doc.pages[0].marks, mark('c')]);
    assert.ok(!canRedo(recordSheetChange(again.history, again.doc, drawn, 3000), 0));
});

test('each page keeps its own steps, so undo on one page never touches another', () => {
    const start = doc([], []);
    const onFirst = editPage(start, 0, [mark('a')]);
    let history = recordSheetChange(EMPTY_HISTORY, start, onFirst, 1000);
    const onSecond = editPage(onFirst, 1, [mark('b')]);
    history = recordSheetChange(history, onFirst, onSecond, 2000);
    const undone = undoPage(history, onSecond, 0);
    assert.ok(undone);
    assert.deepEqual(undone.doc.pages[0].marks, []);
    assert.deepEqual(undone.doc.pages[1].marks.map((m) => m.id), ['b']);
    assert.equal(redoPage(undone.history, undone.doc, 1), null);
});

test('a burst of nudges undoes as one move, separate moves do not merge', () => {
    const start = doc([mark('a', 100)]);
    let current = start;
    let history = EMPTY_HISTORY;
    for (const [x, at] of [[110, 1000], [120, 1300], [130, 1600]] as const) {
        const next = editPage(current, 0, [mark('a', x)]);
        history = recordSheetChange(history, current, next, at, true);
        current = next;
    }
    assert.equal(history[0].undo.length, 1);
    assert.equal(undoPage(history, current, 0)?.doc.pages[0].marks[0].points[0][0], 100);

    // A later nudge, or a drawn mark right after, is its own step.
    const later = editPage(current, 0, [mark('a', 140)]);
    history = recordSheetChange(history, current, later, 5000, true);
    const drawn = editPage(later, 0, [...later.pages[0].marks, mark('b')]);
    history = recordSheetChange(history, later, drawn, 5100);
    assert.equal(history[0].undo.length, 3);
});

test('page changes clear the history; a re-keyed image with the same marks keeps it', () => {
    const start = doc([]);
    const drawn = editPage(start, 0, [mark('a')]);
    const history = recordSheetChange(EMPTY_HISTORY, start, drawn, 1000);

    const rekeyed: SheetDocument = { ...drawn, pages: drawn.pages.map((page) => ({ ...page, image: 'page-0-in-D' })) };
    assert.equal(recordSheetChange(history, drawn, rekeyed, 2000), history);
    assert.ok(undoPage(history, rekeyed, 0));

    const rotated: SheetDocument = { ...drawn, pages: [{ ...drawn.pages[0], image: 'rotated', width: 1600, height: 1200, marks: [mark('a', 900)] }] };
    assert.equal(recordSheetChange(history, drawn, rotated, 2000), EMPTY_HISTORY);
    assert.equal(recordSheetChange(history, drawn, doc([mark('a')], []), 2000), EMPTY_HISTORY);
    assert.equal(recordSheetChange(history, null, drawn, 2000), EMPTY_HISTORY);
});

test('undo refuses a page that moved on without being recorded, and history is capped', () => {
    const start = doc([]);
    const drawn = editPage(start, 0, [mark('a')]);
    const history = recordSheetChange(EMPTY_HISTORY, start, drawn, 1000);
    assert.equal(undoPage(history, editPage(drawn, 0, [mark('x')]), 0), null);

    let current = start;
    let capped = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
        const next = editPage(current, 0, [...current.pages[0].marks, mark(`m${i}`)]);
        capped = recordSheetChange(capped, current, next, i * 2000);
        current = next;
    }
    assert.equal(capped[0].undo.length, HISTORY_LIMIT);
});
