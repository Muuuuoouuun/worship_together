import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSongFormText, isValidSongFormSections, parseSongFormText, SONG_FORM_MAX_SECTIONS } from '../lib/songFormMarkup';
import { songFormRoute } from '../lib/songFormRoute';
import type { SheetMark } from '../lib/sheetAnnotations';

test('parseSongFormText reads chip labels, chat words and repeats', () => {
    assert.deepEqual(parseSongFormText('I - V1 - C×2 - B - O').sections, ['I', 'V1', 'C×2', 'B', 'O']);
    assert.deepEqual(parseSongFormText('전주 1절 후렴 x2 브릿지 후렴2 엔딩').sections, ['I', 'V1', 'C×2', 'B', 'C2', 'O']);
    assert.deepEqual(parseSongFormText('intro→verse→chorus 2번→bridge→outro').sections, ['I', 'V1', 'C×2', 'B', 'O']);
    assert.deepEqual(parseSongFormText('i v2 pc Cx3 c*2 간주 tag').sections, ['I', 'V2', 'PC', 'C×3', 'C×2', '간주', 'Tag']);
    assert.deepEqual(parseSongFormText('(I) V1, C | C').sections, ['I', 'V1', 'C', 'C']);
    assert.deepEqual(parseSongFormText('B vamp x4 뱀프 Tag').sections, ['B', 'Vamp×4', 'Vamp', 'Tag']);
});

test('parseSongFormText keeps unknown words as their own chips and reports them', () => {
    const { sections, custom } = parseSongFormText('I 솔로 V1 기도인도시간까지계속 C');
    assert.deepEqual(custom, ['솔로', '기도인도시간까지계속']);
    assert.deepEqual(sections, ['I', '솔로', 'V1', '기도인도시간까지계속'.slice(0, 12), 'C']);
    assert.ok(isValidSongFormSections(sections));
    assert.deepEqual(parseSongFormText('x2 I').sections, ['I']);
    assert.deepEqual(parseSongFormText('   ').sections, []);
    assert.equal(parseSongFormText(Array(40).fill('C').join(' ')).sections.length, SONG_FORM_MAX_SECTIONS);
});

test('formatSongFormText round-trips through the parser', () => {
    const sections = ['I', 'V1', 'PC', 'C×2', '간주', 'V2', 'C', 'B', 'C×3', 'Tag', 'O'];
    assert.equal(formatSongFormText(sections), 'I - V1 - PC - C×2 - 간주 - V2 - C - B - C×3 - Tag - O');
    assert.deepEqual(parseSongFormText(formatSongFormText(sections)).sections, sections);
});

const band = (sections: string[], id = 'band'): SheetMark => ({ id, kind: 'songform', color: '#0f172a', points: [[16, 3]], sections });
const marker = (id: string, text: string, y: number, x = 100): SheetMark => ({ id, kind: 'section', color: '#2563eb', text, points: [[x, y]] });

test('songFormRoute walks the band and resolves each section to its marker page', () => {
    const route = songFormRoute([
        { marks: [band(['I', 'V1', 'C', 'V2', 'C×2', 'B', 'O']), marker('i', 'I', 100), marker('v1', 'V1', 300), marker('c', 'C', 600)] },
        { marks: [marker('b', 'B', 200)] },
    ]);
    assert.ok(route);
    assert.equal(route.bandPage, 1);
    assert.equal(route.bandId, 'band');
    assert.deepEqual(
        route.stops.map((s) => [s.label, s.page, s.markId, s.sharedWith]),
        [
            ['I', 1, 'i', null],
            ['V1', 1, 'v1', null],
            ['C', 1, 'c', null],
            // No V2 marker: verse 2 is played from verse 1's measures.
            ['V2', 1, 'v1', 'V1'],
            ['C×2', 1, 'c', null],
            ['B', 2, 'b', null],
            ['O', null, null, null],
        ]
    );
});

test('songFormRoute prefers a later marker for a repeated section', () => {
    const route = songFormRoute([
        { marks: [marker('c-first', 'C', 500)] },
        { marks: [band(['V1', 'C', 'V2', 'C']), marker('v1', 'V1', 100), marker('v2', 'V2', 400), marker('c-second', 'C', 700)] },
    ]);
    assert.ok(route);
    assert.equal(route.bandPage, 2);
    assert.deepEqual(route.stops.map((s) => s.markId), ['v1', 'c-second', 'v2', 'c-second']);
    assert.equal(songFormRoute([{ marks: [marker('c', 'C', 100)] }]), null);
});
