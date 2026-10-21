import test from 'node:test';
import assert from 'node:assert/strict';
import {
    abbreviateSectionLabel,
    isSongFormTint,
    isValidSongFormSections,
    layoutSectionMarker,
    layoutSongFormMarkup,
    songFormRowHeight,
    songFormChipColor,
    splitRepeat,
    toggleRepeat,
    SONG_FORM_MAX_SECTIONS,
    SONG_FORM_PRESETS,
    SONG_FORM_TINT_OPACITY,
} from '../lib/songFormMarkup';
import { isPointNearMark, validateSheet, type SheetDocument, type SheetMark } from '../lib/sheetAnnotations';

test('toggleRepeat sets, swaps and clears the ×n suffix', () => {
    assert.equal(toggleRepeat('C', 2), 'C×2');
    assert.equal(toggleRepeat('C×2', 3), 'C×3');
    assert.equal(toggleRepeat('C×2', 2), 'C');
    assert.deepEqual(splitRepeat('간주×3'), { base: '간주', repeat: 3 });
    assert.deepEqual(splitRepeat('V1'), { base: 'V1', repeat: null });
});

test('abbreviateSectionLabel maps saved song form labels to chips', () => {
    assert.equal(abbreviateSectionLabel('Intro'), 'I');
    assert.equal(abbreviateSectionLabel('2. Verse 1'), 'V1');
    assert.equal(abbreviateSectionLabel('Pre-Chorus'), 'PC');
    assert.equal(abbreviateSectionLabel('Chorus x2'), 'C×2');
    assert.equal(abbreviateSectionLabel('후렴'), 'C');
    assert.equal(abbreviateSectionLabel('2절'), 'V2');
    assert.equal(abbreviateSectionLabel('브릿지'), 'B');
    assert.equal(abbreviateSectionLabel('Interlude'), '간주');
    assert.equal(abbreviateSectionLabel('Ending'), 'O');
    assert.equal(abbreviateSectionLabel('Vamp x4'), 'Vamp×4');
    assert.equal(abbreviateSectionLabel('자유 찬양 및 기도 인도'), '자유 찬양 및 기도 인');
    assert.ok(isValidSongFormSections([abbreviateSectionLabel('자유 찬양 및 기도 인도 시간 x2')]));
});

test('chip colors group sections by role', () => {
    assert.equal(songFormChipColor('C×2'), songFormChipColor('C'));
    assert.notEqual(songFormChipColor('PC'), songFormChipColor('C'));
    assert.notEqual(songFormChipColor('V1'), songFormChipColor('B'));
    assert.equal(songFormChipColor('Vamp×4'), songFormChipColor('Tag'));
});

test('layout keeps one row when it fits and wraps before a chip that would cross the page edge', () => {
    const single = layoutSongFormMarkup(SONG_FORM_PRESETS[0].sections, [24, 16]);
    assert.equal(single.chips.length, 8);
    assert.equal(single.arrows.length, 7);
    assert.ok(single.chips.every((chip) => chip.y === single.chips[0].y));
    assert.ok(single.plate.x + single.plate.width <= 1000);

    const long = Array.from({ length: 20 }, (_, i) => (i % 2 ? 'C×2' : 'V1'));
    const wrapped = layoutSongFormMarkup(long, [600, 16]);
    const rows = new Set(wrapped.chips.map((chip) => chip.y));
    assert.ok(rows.size > 1);
    for (const chip of wrapped.chips) assert.ok(chip.x + chip.width <= 1000, `${chip.label} overflows`);
    const last = wrapped.chips[wrapped.chips.length - 1];
    assert.equal(wrapped.plate.y + wrapped.plate.height, last.y + last.height + 8);
});

test('validateSheet accepts songform marks and rejects malformed sections', () => {
    const doc = (mark: SheetMark): SheetDocument => ({
        version: 1,
        title: '은혜로다',
        updatedAt: new Date().toISOString(),
        pages: [{ image: 'data:image/jpeg;base64,/9j/4AAQ', width: 1200, height: 1600, marks: [mark] }],
    });
    const base: SheetMark = { id: 'sf', kind: 'songform', color: '#0f172a', points: [[24, 12]], sections: ['I', 'V1', 'C×2'] };
    assert.doesNotThrow(() => validateSheet(doc(base)));
    assert.throws(() => validateSheet(doc({ ...base, sections: [] })));
    assert.throws(() => validateSheet(doc({ ...base, sections: undefined })));
    assert.throws(() => validateSheet(doc({ ...base, sections: ['아주 긴 섹션 이름입니다아'] })));
    assert.throws(() => validateSheet(doc({ ...base, sections: Array(SONG_FORM_MAX_SECTIONS + 1).fill('C') })));
});

test('isPointNearMark hits the songform band plate only', () => {
    const ratio = 1600 / 1200;
    const mark: SheetMark = { id: 'sf', kind: 'songform', color: '#0f172a', points: [[24, 12]], sections: ['I', 'V1', 'C'] };
    const { plate } = layoutSongFormMarkup(mark.sections!, [24, 12 * ratio]);
    const insideY = (plate.y + plate.height / 2) / ratio;
    assert.equal(isPointNearMark(plate.x + 10, insideY, mark, ratio), true);
    assert.equal(isPointNearMark(plate.x + plate.width + 40, insideY, mark, ratio), false);
    assert.equal(isPointNearMark(plate.x + 10, 500, mark, ratio), false);
});

test('band and markers scale with the size preset and wrap earlier when larger', () => {
    const sections = SONG_FORM_PRESETS[1].sections;
    const normal = layoutSongFormMarkup(sections, [16, 4]);
    const large = layoutSongFormMarkup(sections, [16, 4], 42);
    assert.ok(large.chips[0].height > normal.chips[0].height * 1.6);
    assert.ok(new Set(large.chips.map((c) => c.y)).size > new Set(normal.chips.map((c) => c.y)).size);
    for (const chip of large.chips) assert.ok(chip.x + chip.width <= 1000, `${chip.label} overflows`);
    assert.equal(songFormRowHeight(48), songFormRowHeight(24) * 2);

    const marker = layoutSectionMarker('V1', [300, 500], 32);
    assert.deepEqual([marker.x, marker.y], [300, 500]);
    assert.equal(marker.height, layoutSectionMarker('V1', [0, 0], 16).height * 2);
});

test('translucent look is encoded as opacity below 1', () => {
    assert.equal(isSongFormTint(undefined), false);
    assert.equal(isSongFormTint(1), false);
    assert.equal(isSongFormTint(SONG_FORM_TINT_OPACITY), true);
});

test('section markers validate their label and hit-test their chip box', () => {
    const ratio = 1600 / 1200;
    const marker: SheetMark = { id: 'm1', kind: 'section', color: '#2563eb', text: 'V1', points: [[300, 400]], fontSize: 32, opacity: SONG_FORM_TINT_OPACITY };
    const doc: SheetDocument = {
        version: 1,
        title: '은혜로다',
        updatedAt: new Date().toISOString(),
        pages: [{ image: 'data:image/jpeg;base64,/9j/4AAQ', width: 1200, height: 1600, marks: [marker] }],
    };
    assert.doesNotThrow(() => validateSheet(doc));
    assert.throws(() => validateSheet({ ...doc, pages: [{ ...doc.pages[0], marks: [{ ...marker, text: '' }] }] }));
    assert.throws(() => validateSheet({ ...doc, pages: [{ ...doc.pages[0], marks: [{ ...marker, text: undefined }] }] }));

    const box = layoutSectionMarker('V1', [300, 400 * ratio], 32);
    const centerY = (box.y + box.height / 2) / ratio;
    assert.equal(isPointNearMark(box.x + box.width / 2, centerY, marker, ratio, 0), true);
    assert.equal(isPointNearMark(box.x + box.width + 30, centerY, marker, ratio, 0), false);
});
