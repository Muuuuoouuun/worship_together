import test from 'node:test';
import assert from 'node:assert/strict';
import {
    abbreviateSectionLabel,
    isValidSongFormSections,
    layoutSongFormMarkup,
    songFormChipColor,
    splitRepeat,
    toggleRepeat,
    SONG_FORM_MAX_SECTIONS,
    SONG_FORM_PRESETS,
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
    assert.equal(abbreviateSectionLabel('자유 찬양 및 기도 인도'), '자유 찬양 및 기도 인');
    assert.ok(isValidSongFormSections([abbreviateSectionLabel('자유 찬양 및 기도 인도 시간 x2')]));
});

test('chip colors group sections by role', () => {
    assert.equal(songFormChipColor('C×2'), songFormChipColor('C'));
    assert.notEqual(songFormChipColor('PC'), songFormChipColor('C'));
    assert.notEqual(songFormChipColor('V1'), songFormChipColor('B'));
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
