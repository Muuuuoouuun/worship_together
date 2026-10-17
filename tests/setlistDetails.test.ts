import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TRANSITION_NOTE_MAX_LENGTH,
    cleanTransitionNote,
    directionNotesOf,
    getSetlistDetailsKey,
    readSetlistDetails,
    readSetlistDetailsStamp,
    sanitizeSetlistDetails,
    saveSetlistDetails,
    updateSetlistDetails,
    validCustomBpm,
    type SetlistDetailMetadata,
} from '../lib/setlistDetailsStorage';
import {
    applyBpmOverrides,
    formatKey,
    formatKeyLabel,
    resolveKey,
    resolveSetlistPlans,
    resolveSongPlan,
    resolveStateBpm,
    withStageKeys,
} from '../lib/stageSongPlan';
import { buildContiSetlists, planSave } from '../components/conti/liveData';
import type { SetlistDraft } from '../components/conti/context';
import type { LibrarySetlist, LibrarySong } from '../lib/libraryPrototypeStorage';

const TEAM = 'team-1';
const NOW = '2026-10-12T00:00:00.000Z';

function song(id: string, key: string | null, bpm: number | null) {
    return { id, original_key: key, bpm };
}

function details(overrides: SetlistDetailMetadata['overrides']): SetlistDetailMetadata {
    return { setlistId: 'set-1', teamId: TEAM, overrides, updatedAt: NOW };
}

test('이번 주 Key 가 있으면 그것을, 없으면 원곡 Key 를 쓴다', () => {
    const changed = resolveSongPlan(song('s1', 'C', 70), { songId: 's1', targetKey: 'D' });
    assert.equal(changed.key, 'D');
    assert.equal(changed.originalKey, 'C');
    assert.equal(changed.keyChanged, true);

    const blank = resolveSongPlan(song('s1', 'C', 70), { songId: 's1', targetKey: '  ' });
    assert.equal(blank.key, 'C', '빈 값이면 원곡 Key');
    assert.equal(blank.keyChanged, false);

    const same = resolveSongPlan(song('s1', 'C', 70), { songId: 's1', targetKey: 'C' });
    assert.equal(same.keyChanged, false, '원곡과 같은 Key 는 바뀐 것이 아니다');

    const none = resolveSongPlan(song('s1', null, null), undefined);
    assert.equal(none.key, null);
    assert.equal(none.keyChanged, false);

    const onlyTarget = resolveSongPlan(song('s1', null, null), { songId: 's1', targetKey: 'E' });
    assert.equal(onlyTarget.key, 'E', '원곡 Key 를 몰라도 이번 주 Key 는 쓴다');
    assert.equal(onlyTarget.keyChanged, false);
});

test('이번 주 BPM 이 있으면 그것을, 없거나 잘못되면 곡 보관함 BPM 을 쓴다', () => {
    assert.equal(resolveSongPlan(song('s1', 'C', 70), { songId: 's1', customBpm: 84 }).bpm, 84);
    assert.equal(resolveSongPlan(song('s1', 'C', 70), { songId: 's1', customBpm: null }).bpm, 70);
    assert.equal(resolveSongPlan(song('s1', 'C', 70), { songId: 's1', customBpm: 500 }).bpm, 70, '범위를 벗어난 값은 무시');
    assert.equal(resolveSongPlan(song('s1', 'C', null), { songId: 's1', customBpm: 90 }).bpm, 90);
    assert.equal(resolveSongPlan(song('s1', 'C', null), undefined).bpm, null);
    assert.equal(validCustomBpm(72.5), null);
    assert.equal(validCustomBpm(19), null);
    assert.equal(validCustomBpm(300), 300);
});

test('무대 Key 표기: 원곡과 다르면 원키를 함께 보여준다', () => {
    assert.equal(formatKeyLabel(resolveKey('C', 'D')), 'Key D (원키 C)');
    assert.equal(formatKey(resolveKey('C', 'D')), 'D (원키 C)');
    assert.equal(formatKeyLabel(resolveKey('C', 'C')), 'Key C');
    assert.equal(formatKeyLabel(resolveKey('C', null)), 'Key C');
    assert.equal(formatKeyLabel(resolveKey(null, 'E')), 'Key E');
    assert.equal(formatKeyLabel(resolveKey(null, null)), '');
    assert.equal(formatKeyLabel(null), '');
});

test('디렉팅 메모는 줄 단위 특이사항을 먼저, 없으면 예전 한 줄 메모를 쓴다', () => {
    assert.deepEqual(directionNotesOf({ songId: 's1', notes: ['드럼 4카운트'], leaderNotes: '무시됨' }), ['드럼 4카운트']);
    assert.deepEqual(directionNotesOf({ songId: 's1', leaderNotes: '잔잔하게 시작\n  후렴 빌드업  \n' }), ['잔잔하게 시작', '후렴 빌드업']);
    assert.deepEqual(directionNotesOf({ songId: 's1', leaderNotes: null }), []);
    assert.deepEqual(directionNotesOf(undefined), []);
});

test('콘티 전체의 곡별 무대 값을 곡 id 로 찾을 수 있다', () => {
    const songs = [song('s1', 'C', 70), song('s2', 'G', 76), song('s1', 'C', 70)];
    const plans = resolveSetlistPlans(
        songs,
        details({
            s1: { songId: 's1', targetKey: 'D', customBpm: 80, leaderNotes: '잔잔하게', transitionNote: '기도 후 바로 E로 전조' },
        }),
    );
    assert.deepEqual(Object.keys(plans), ['s1', 's2']);
    assert.equal(plans.s1.key, 'D');
    assert.equal(plans.s1.bpm, 80);
    assert.deepEqual(plans.s1.directionNotes, ['잔잔하게']);
    assert.equal(plans.s1.transitionNote, '기도 후 바로 E로 전조');
    assert.equal(plans.s2.key, 'G', '정한 값이 없는 곡은 원곡 값');
    assert.equal(plans.s2.bpm, 76);
    assert.equal(plans.s2.transitionNote, null);

    const withoutDetails = resolveSetlistPlans(songs, null);
    assert.equal(withoutDetails.s1.key, 'C');
});

test('무대 화면에는 이번 주 Key 를 담은 복사본을 넘기고 나머지는 그대로 둔다', () => {
    const songs = [song('s1', 'C', 70), song('s2', 'G', 76)];
    const plans = resolveSetlistPlans(songs, details({ s1: { songId: 's1', targetKey: 'D' } }));
    const staged = withStageKeys(songs, plans);
    assert.equal(staged[0].original_key, 'D');
    assert.equal(songs[0].original_key, 'C', '원본은 바뀌지 않는다');
    assert.equal(staged[1], songs[1], '바뀌지 않은 곡은 같은 객체');
});

test('라이브 화면의 곡 BPM 에 이번 주 BPM 을 반영한다', () => {
    const songs = [song('s1', 'C', 70), song('s2', 'G', 76)];
    assert.equal(applyBpmOverrides(songs, null), songs);
    assert.equal(applyBpmOverrides(songs, details({ s1: { songId: 's1', customBpm: null }, s2: { songId: 's2', customBpm: 76 } })), songs, '바뀐 곡이 없으면 같은 배열');

    const applied = applyBpmOverrides(songs, details({ s1: { songId: 's1', customBpm: 84 }, s2: { songId: 's2', customBpm: 999 } }));
    assert.deepEqual(applied.map((item) => item.bpm), [84, 76]);
    assert.equal(songs[0].bpm, 70, '원본은 바뀌지 않는다');
    assert.equal(applied[0].original_key, 'C');
});

test('시작 BPM 은 곡 기본값 그대로일 때만 이번 주 BPM 으로 바꾼다', () => {
    const original = [song('s1', 'C', 70)];
    const effective = [song('s1', 'C', 84)];
    assert.equal(resolveStateBpm(70, 's1', original, effective), 84, '기본값 그대로면 이번 주 BPM');
    assert.equal(resolveStateBpm(null, 's1', original, effective), 84);
    assert.equal(resolveStateBpm(66, 's1', original, effective), 66, '인도자가 직접 정한 값은 그대로');
    assert.equal(resolveStateBpm(70, null, original, effective), 70);
    assert.equal(resolveStateBpm(70, 'unknown', original, effective), 70);
});

test('곡 전환 메모는 한 줄로 정리하고 120자까지만 남긴다', () => {
    assert.equal(cleanTransitionNote('  기도 후 바로\n E로   전조 '), '기도 후 바로 E로 전조');
    assert.equal(cleanTransitionNote('   '), null);
    assert.equal(cleanTransitionNote(null), null);
    assert.equal(cleanTransitionNote(42), null);
    assert.equal(cleanTransitionNote('가'.repeat(300))?.length, TRANSITION_NOTE_MAX_LENGTH);
    assert.equal(TRANSITION_NOTE_MAX_LENGTH, 120);
});

test('저장된 곡 전환 메모는 있을 때만 남고, 없는 곡의 형식은 바뀌지 않는다', () => {
    const clean = sanitizeSetlistDetails(
        {
            overrides: {
                s1: { targetKey: 'D', transitionNote: '  피아노만 남기고\n다음 곡 인트로  ' },
                s2: { targetKey: 'A', transitionNote: '   ' },
                s3: { transitionNote: 123 },
            },
            updatedAt: NOW,
        },
        TEAM,
        'set-1',
    );
    assert.ok(clean);
    assert.equal(clean.overrides.s1.transitionNote, '피아노만 남기고 다음 곡 인트로');
    assert.equal('transitionNote' in clean.overrides.s2, false);
    assert.equal('transitionNote' in clean.overrides.s3, false);
});

test('저장 계획: 곡 전환 메모를 정리해 담고, 비우면 지운다', () => {
    const songs: LibrarySong[] = [
        { id: 's1', team_id: TEAM, title: '주님의 은혜', artist: null, original_key: 'G', bpm: 68, music_xml_url: null, data_xml: null, created_at: NOW, updated_at: NOW },
        { id: 's2', team_id: TEAM, title: '보내소서', artist: null, original_key: 'A', bpm: 76, music_xml_url: null, data_xml: null, created_at: NOW, updated_at: NOW },
    ];
    const setlist: LibrarySetlist = { id: 'set-1', team_id: TEAM, title: '주일 예배', theme: null, worship_date: '2026-10-18T02:00:00.000Z', song_order: ['s1', 's2'], created_at: NOW, updated_at: NOW };
    const song = { key: 'G', bpm: '68', lead: '', form: [], notes: '', transition: '', video: '', sheet: '', mr: '' };
    const draft = (transition: string): SetlistDraft => ({
        owner: '',
        status: 'writing',
        order: ['s1', 's2'],
        songs: { s1: { ...song, transition }, s2: { ...song, key: 'A', bpm: '76' } },
    });
    const common = { setlist, songs, canReorder: true, forms: {}, links: {}, now: NOW, createId: () => 'new' };

    const set = planSave({ ...common, draft: draft('  기도 후 바로\nE로 전조  ') });
    assert.ok(set.ok);
    assert.equal(set.plan.overrides.s1.transitionNote, '기도 후 바로 E로 전조');
    assert.equal('transitionNote' in set.plan.overrides.s2, false);

    const long = planSave({ ...common, draft: draft('가'.repeat(200)) });
    assert.ok(long.ok);
    assert.equal(long.plan.overrides.s1.transitionNote?.length, TRANSITION_NOTE_MAX_LENGTH);

    const cleared = planSave({ ...common, draft: draft('   ') });
    assert.ok(cleared.ok);
    assert.equal('transitionNote' in cleared.plan.overrides.s1, false, '비우면 저장하지 않아 지워진다');

    // 콘티 화면 모델로 다시 읽어도 같은 메모가 보인다.
    const [model] = buildContiSetlists({
        songs,
        setlists: [setlist],
        details: { 'set-1': details({ s1: { songId: 's1', transitionNote: '피아노만 남기기' } }) },
        forms: {},
        links: {},
        today: '2026-10-12',
        now: new Date(NOW),
    });
    const [first, second] = model.items;
    assert.ok(first.kind === 'song' && second.kind === 'song');
    assert.equal(first.transitionNote, '피아노만 남기기');
    assert.equal(second.transitionNote, null);
});

test('저장소 변화 표식: 콘티 id 로 저장된 값을 먼저, 없으면 예전 제목 키 값을 쓴다', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null };
    assert.equal(readSetlistDetailsStamp(TEAM, 'set-1', '주일 예배', storage), '');

    store.set(getSetlistDetailsKey(TEAM, '주일 예배'), '{"old":true}');
    assert.equal(readSetlistDetailsStamp(TEAM, 'set-1', '주일 예배', storage), 'legacy:{"old":true}');
    assert.equal(readSetlistDetailsStamp(TEAM, 'set-1', null, storage), '', '예전 기록을 찾지 않으면 비어 있다');

    store.set(getSetlistDetailsKey(TEAM, 'set-1'), '{"new":true}');
    assert.equal(readSetlistDetailsStamp(TEAM, 'set-1', '주일 예배', storage), '{"new":true}');

    const broken = { getItem: () => { throw new Error('blocked'); } };
    assert.equal(readSetlistDetailsStamp(TEAM, 'set-1', null, broken), '', '저장소를 읽지 못해도 오류를 내지 않는다');
});

test('콘티 id 로 저장한 메모를 같은 id 로 다시 읽고, 예전 제목 키 기록도 한 번 이어받는다', () => {
    const store = new Map<string, string>();
    const events: string[] = [];
    const fakeStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
    };
    const fakeWindow = { dispatchEvent: (event: Event) => { events.push(event.type); return true; } };
    const saved = { localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), window: Object.getOwnPropertyDescriptor(globalThis, 'window') };
    Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
    try {
        // 새 콘티: 미리 정한 id 로 저장하면 같은 id 로 읽힌다. (제목으로는 찾지 않는다)
        saveSetlistDetails(TEAM, 'set-new', {
            s1: { songId: 's1', targetKey: 'D', customBpm: 80, leaderNotes: '잔잔하게', transitionNote: '기도 후 바로 E로 전조' },
            s2: { songId: 's2', targetKey: 'A' },
        });
        const read = readSetlistDetails(TEAM, 'set-new');
        assert.equal(read?.overrides.s1.targetKey, 'D');
        assert.equal(read?.overrides.s1.customBpm, 80);
        assert.equal(read?.overrides.s1.transitionNote, '기도 후 바로 E로 전조');
        assert.equal(readSetlistDetails(TEAM, '새 콘티'), null);
        assert.deepEqual(events, ['worship:setlist-details-changed'], '저장하면 열려 있는 화면에 알린다');

        // 예전 화면이 제목 키로 저장한 기록: 생성 시각과 가까운 콘티만 이어받는다.
        store.set(getSetlistDetailsKey(TEAM, '주일 예배'), JSON.stringify({ setlistId: '주일 예배', teamId: TEAM, overrides: { s1: { songId: 's1', targetKey: 'F' } }, updatedAt: '2026-10-01T10:00:30.000Z' }));
        const thisWeek = { title: '주일 예배', createdAt: '2026-10-01T10:00:00.000Z' };
        const nextWeek = { title: '주일 예배', createdAt: '2026-10-08T10:00:00.000Z' };
        assert.equal(readSetlistDetails(TEAM, 'set-old', thisWeek)?.overrides.s1.targetKey, 'F');
        assert.equal(readSetlistDetails(TEAM, 'set-other', nextWeek), null, '제목이 같은 다른 주 콘티는 이어받지 않는다');

        // 이어받은 뒤 저장하면 콘티 id 로 옮겨지고, 곡 전환 메모도 함께 남는다.
        const next = updateSetlistDetails(TEAM, 'set-old', { overrides: { s1: { songId: 's1', targetKey: 'F', transitionNote: '바로 다음 곡' } } }, thisWeek);
        assert.equal(next.setlistId, 'set-old');
        assert.equal(readSetlistDetails(TEAM, 'set-old')?.overrides.s1.transitionNote, '바로 다음 곡');
    } finally {
        for (const name of ['localStorage', 'window'] as const) {
            if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
            else Reflect.deleteProperty(globalThis, name);
        }
    }
});
