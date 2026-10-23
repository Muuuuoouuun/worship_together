import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedSetlistId, linkableFromLibrary, withLinkedSetlists, eventsForSetlist, summarizeLibrary } from '../lib/serviceLink';

const event = (kind: 'worship' | 'rehearsal', startsAt: string, extra: Record<string, unknown> = {}) => ({ id: `${kind}-${startsAt}`, kind, startsAt, endsAt: startsAt, cancelled: false, ...extra });
// 한국 시간 10월 25일(주일) 오전 9시 · 11시 콘티, 11월 1일 콘티
const library = [
    { id: 'first', title: '주일 1부', worship_date: '2026-10-25T00:00:00Z', songs: ['A'] },
    { id: 'second', title: '주일 2부', worship_date: '2026-10-25T02:00:00Z', songs: ['B', 'C'] },
    { id: 'next', title: '다음 주일', worship_date: '2026-11-01T02:00:00Z', songs: [] },
];
const linkable = library.map(linkableFromLibrary);

test('a worship schedule links to the same-day conti closest in time; an explicit choice wins', () => {
    assert.equal(linkedSetlistId(event('worship', '2026-10-25T01:50:00Z'), linkable), 'second', '10:50 예배 → 11시 콘티');
    assert.equal(linkedSetlistId(event('worship', '2026-10-24T23:30:00Z'), linkable), 'first', '한국 시간 25일 8:30 → 같은 날');
    assert.equal(linkedSetlistId(event('worship', '2026-10-25T01:50:00Z', { setlistId: 'next' }), linkable), 'next');
    assert.equal(linkedSetlistId(event('worship', '2026-10-28T10:00:00Z'), linkable), null, '수요일엔 콘티 없음');
    assert.equal(linkedSetlistId(event('worship', '2026-10-25T01:50:00Z', { cancelled: true }), linkable), null);
});

test('a rehearsal links to the nearest upcoming conti within a week', () => {
    assert.equal(linkedSetlistId(event('rehearsal', '2026-10-24T10:00:00Z'), linkable), 'first', '토요일 연습 → 주일 첫 콘티');
    assert.equal(linkedSetlistId(event('rehearsal', '2026-10-28T10:00:00Z'), linkable), 'next');
    assert.equal(linkedSetlistId(event('rehearsal', '2026-11-10T10:00:00Z'), linkable), null);
    const events = [event('rehearsal', '2026-10-24T10:00:00Z'), event('worship', '2026-10-25T00:00:00Z'), event('worship', '2026-10-25T02:00:00Z')];
    assert.deepEqual(eventsForSetlist('first', events, linkable).map(item => item.kind), ['rehearsal', 'worship']);
});

test('display linking fills conti title and songs without overriding what was typed on the schedule', () => {
    const [auto, typed] = withLinkedSetlists([event('worship', '2026-10-25T02:00:00Z'), event('worship', '2026-10-25T00:00:00Z', { setlistTitle: '직접 적은 콘티' })], library);
    assert.equal(auto.setlistId, 'second');
    assert.equal(auto.setlistTitle, '주일 2부');
    assert.deepEqual(auto.setlistSongs, ['B', 'C']);
    assert.equal(typed.setlistTitle, '직접 적은 콘티');
    assert.equal(typed.setlistId, 'first', '바로 가기용 id 는 붙입니다');
    assert.deepEqual(summarizeLibrary({ songs: [{ id: 's1', title: '은혜' }], setlists: [{ id: 'x', title: 'X', worship_date: '2026-10-25T00:00:00Z', song_order: ['s1', 'missing'] }] })[0].songs, ['은혜']);
});
