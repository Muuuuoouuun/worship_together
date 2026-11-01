import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeJson } from '../lib/merge3';

const song = (id: string, title: string) => ({ id, title });

test('edits to different songs on two devices both survive', () => {
    const base = { version: 1, songs: [song('a', 'A'), song('b', 'B')], setlists: [] };
    const local = { ...base, songs: [song('a', 'A (편곡)'), song('b', 'B')] };
    const remote = { ...base, songs: [song('a', 'A'), song('b', 'B'), song('c', 'C')] };
    assert.deepEqual(mergeJson(base, local, remote), { version: 1, songs: [song('a', 'A (편곡)'), song('b', 'B'), song('c', 'C')], setlists: [] });
});

test('deletion on one side wins over an untouched copy on the other', () => {
    const base = { songs: [song('a', 'A'), song('b', 'B')] };
    const local = { songs: [song('a', 'A')] };
    const remote = { songs: [song('a', 'A'), song('b', 'B'), song('c', 'C')] };
    assert.deepEqual(mergeJson(base, local, remote), { songs: [song('a', 'A'), song('c', 'C')] });
});

test('same field changed on both sides follows the preferred side', () => {
    const base = { overrides: { a: { targetKey: 'D' } } };
    const local = { overrides: { a: { targetKey: 'E' } } };
    const remote = { overrides: { a: { targetKey: 'F' } } };
    assert.deepEqual(mergeJson(base, local, remote, 'local'), local);
    assert.deepEqual(mergeJson(base, local, remote, 'remote'), remote);
});

test('without a base everything from both sides is kept and comments union by id', () => {
    const local = { comments: [{ id: 'c1', text: '내 코멘트' }] };
    const remote = { comments: [{ id: 'c2', text: '다른 코멘트' }] };
    assert.deepEqual(mergeJson(undefined, local, remote, 'remote'), { comments: [{ id: 'c2', text: '다른 코멘트' }, { id: 'c1', text: '내 코멘트' }] });
});
