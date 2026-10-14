import test from 'node:test';
import assert from 'node:assert/strict';
import {
    avatarLabel,
    formCodeFromLabel,
    labelFromFormCode,
    nextSunday,
    relativeTime,
    seoulDateTime,
    upcomingSetlistId,
    weekDates,
    type ContiSetlist,
} from '../components/conti/model';
import { buildContiSetlists, planSave, rebuildSections, statusFor } from '../components/conti/liveData';
import type { SetlistDraft } from '../components/conti/context';
import { isLegacyMatch, sanitizeSetlistDetails } from '../lib/setlistDetailsStorage';
import { normalizeLinkUrl, sanitizeSongLinks } from '../lib/songLinksStorage';
import type { LibrarySetlist, LibrarySong } from '../lib/libraryPrototypeStorage';
import type { SongForm } from '../lib/songForm';

const TEAM = 'team-1';

function songRow(id: string, title: string, key: string | null, bpm: number | null): LibrarySong {
    return { id, team_id: TEAM, title, artist: null, original_key: key, bpm, music_xml_url: null, data_xml: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
}

const SONGS = [songRow('s1', '주님의 은혜', 'G', 68), songRow('s2', '보내소서', 'A', 76), songRow('s3', '은혜', 'D', null)];

const SETLIST: LibrarySetlist = {
    id: 'set-1',
    team_id: TEAM,
    title: '주일 2부 예배',
    theme: '신실하신 하나님',
    // 서울 기준 2026-10-18 (일) 11:00
    worship_date: '2026-10-18T02:00:00.000Z',
    song_order: ['s1', 's2'],
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
};

const FORM: SongForm = {
    version: 1,
    songId: 's1',
    youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    source: 'chapters',
    sections: [
        { id: 'a', label: 'Intro', startSeconds: 0 },
        { id: 'b', label: 'Verse 1', startSeconds: 12 },
        { id: 'c', label: 'Chorus', startSeconds: 40 },
    ],
    updatedAt: '2026-10-01T00:00:00.000Z',
};

function draft(overrides: Partial<SetlistDraft['songs'][string]> = {}): SetlistDraft {
    const base = { key: 'G', bpm: '68', lead: '', form: ['I', 'V1', 'C'], notes: '', transition: '', video: FORM.youtubeUrl!, sheet: '', mr: '' };
    return {
        owner: '김찬양',
        status: 'confirmed',
        order: ['s1', 's2'],
        songs: {
            s1: { ...base, ...overrides },
            s2: { key: 'A', bpm: '76', lead: '', form: [], notes: '', transition: '', video: '', sheet: '', mr: '' },
        },
    };
}

test('송폼 섹션 이름을 화면용 코드로 바꾸고 다시 되돌린다', () => {
    assert.equal(formCodeFromLabel('Intro'), 'I');
    assert.equal(formCodeFromLabel('Verse 2'), 'V2');
    assert.equal(formCodeFromLabel('2절'), 'V2');
    assert.equal(formCodeFromLabel('Pre-Chorus'), 'PC');
    assert.equal(formCodeFromLabel('후렴'), 'C');
    assert.equal(formCodeFromLabel('Bridge'), 'B');
    assert.equal(formCodeFromLabel('간주'), 'Int');
    assert.equal(formCodeFromLabel('Outro'), 'O');
    assert.equal(formCodeFromLabel('기도 반주'), '기도 반주');
    assert.equal(labelFromFormCode('PC'), 'Pre-Chorus');
});

test('날짜 도우미는 서울 기준 날짜와 주를 계산한다', () => {
    assert.deepEqual(seoulDateTime('2026-10-18T02:00:00.000Z'), { date: '2026-10-18', time: '11:00' });
    assert.deepEqual(seoulDateTime('2026-10-17T16:30:00.000Z'), { date: '2026-10-18', time: '01:30' });
    assert.equal(nextSunday('2026-10-12'), '2026-10-18');
    assert.equal(nextSunday('2026-10-18'), '2026-10-18');
    assert.deepEqual(weekDates('2026-10-14'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    assert.equal(avatarLabel('김찬양'), '찬양');
    assert.equal(avatarLabel('Grace'), 'Gr');
    assert.equal(relativeTime('2026-10-12T00:00:00.000Z', new Date('2026-10-12T02:30:00.000Z')), '2시간 전');
});

test('다가오는 콘티는 오늘 이후 가장 가까운 날짜를 고른다', () => {
    const make = (id: string, date: string): ContiSetlist => ({ id, date, time: '11:00', service: '', theme: '', owner: null, status: 'writing', items: [] });
    assert.equal(upcomingSetlistId([make('a', '2026-10-11'), make('b', '2026-10-25'), make('c', '2026-10-18')], '2026-10-12'), 'c');
    assert.equal(upcomingSetlistId([make('a', '2026-10-11')], '2026-10-12'), null);
});

test('곡 보관함 콘티를 순서·송폼·Key·특이사항·코멘트와 함께 화면 모델로 바꾼다', () => {
    const [setlist] = buildContiSetlists({
        songs: SONGS,
        setlists: [SETLIST],
        details: {
            'set-1': {
                setlistId: 'set-1',
                teamId: TEAM,
                owner: '김찬양',
                status: 'confirmed',
                overrides: {
                    s1: { songId: 's1', targetKey: 'A', customBpm: 70, notes: ['드럼 4카운트'], lead: '이소망' },
                    s2: { songId: 's2', leaderNotes: '후렴 2회\n엔딩 리타르단도' },
                },
                comments: [{ id: 'c1', songId: 's1', author: '정다윗', text: '패드만 깔게요', createdAt: '2026-10-12T00:00:00.000Z' }],
                updatedAt: '2026-10-12T00:00:00.000Z',
            },
        },
        forms: { s1: FORM, s2: null },
        links: { s2: [{ kind: 'mr', url: 'https://example.com/mr.mp3' }] },
        today: '2026-10-12',
        now: new Date('2026-10-12T03:00:00.000Z'),
    });

    assert.equal(setlist.date, '2026-10-18');
    assert.equal(setlist.time, '11:00');
    assert.equal(setlist.owner, '김찬양');
    assert.equal(setlist.status, 'confirmed');
    const [first, second] = setlist.items;
    assert.ok(first.kind === 'song' && second.kind === 'song');
    assert.equal(first.key, 'A');
    assert.equal(first.originalKey, 'G');
    assert.equal(first.bpm, 70);
    assert.equal(first.lead, '이소망');
    assert.deepEqual(first.form, ['I', 'V1', 'C']);
    assert.deepEqual(first.links.map((link) => link.kind), ['video']);
    assert.deepEqual(first.comments.map((comment) => [comment.author, comment.ago]), [['정다윗', '3시간 전']]);
    assert.deepEqual(second.notes, ['후렴 2회', '엔딩 리타르단도'], '예전 디렉팅 메모도 특이사항으로 보인다');
    assert.equal(second.key, 'A');
    assert.equal(second.bpm, 76);
    assert.deepEqual(second.links.map((link) => [link.kind, link.url]), [['mr', 'https://example.com/mr.mp3']]);
});

test('콘티 상태는 지난 날짜·곡 유무·저장된 확정 여부로 정해진다', () => {
    assert.equal(statusFor('2026-10-11', '2026-10-12', 3, 'confirmed'), 'done');
    assert.equal(statusFor('2026-10-18', '2026-10-12', 0, 'confirmed'), 'empty');
    assert.equal(statusFor('2026-10-18', '2026-10-12', 3, 'confirmed'), 'confirmed');
    assert.equal(statusFor('2026-10-18', '2026-10-12', 3, undefined), 'writing');
});

test('송폼을 다시 만들 때 같은 자리의 같은 섹션은 시작 시간을 살린다', () => {
    let next = 0;
    const sections = rebuildSections(FORM.sections, ['I', 'V1', 'B', 'C'], () => `new-${next++}`);
    assert.deepEqual(sections.map((section) => [section.id, section.label, section.startSeconds]), [
        ['a', 'Intro', 0],
        ['b', 'Verse 1', 12],
        ['new-0', 'Bridge', null],
        ['new-1', 'Chorus', null],
    ]);
});

test('저장 계획: 바뀐 부분만 저장하고 잘못된 값은 저장 전에 막는다', () => {
    const common = { setlist: SETLIST, songs: SONGS, canReorder: true, forms: { s1: FORM, s2: null }, links: {}, now: '2026-10-12T00:00:00.000Z', createId: () => 'new' };

    const unchanged = planSave({ ...common, draft: draft() });
    assert.ok(unchanged.ok);
    assert.equal(unchanged.plan.order, null);
    assert.equal(unchanged.plan.forms.length, 0, '송폼·영상이 그대로면 송폼 저장소를 건드리지 않는다');
    assert.equal(unchanged.plan.links.length, 0);
    assert.equal(unchanged.plan.overrides.s1.targetKey, null, '원곡 Key와 같으면 저장하지 않는다');
    assert.equal(unchanged.plan.overrides.s1.customBpm, null, '원곡 BPM과 같으면 저장하지 않는다');
    assert.equal(unchanged.plan.owner, '김찬양');

    const changed = planSave({
        ...common,
        draft: { ...draft({ key: 'A', bpm: '72', form: ['I', 'V1', 'C', 'C'], notes: ' 드럼 4카운트 \n\n엔딩 2번 ', sheet: 'https://example.com/sheet.pdf', lead: ' 이소망 ' }), order: ['s2', 's1'] },
    });
    assert.ok(changed.ok);
    assert.deepEqual(changed.plan.order, ['s2', 's1']);
    assert.deepEqual(changed.plan.overrides.s1, { songId: 's1', targetKey: 'A', customBpm: 72, notes: ['드럼 4카운트', '엔딩 2번'], lead: '이소망', leaderNotes: null });
    assert.equal(changed.plan.forms.length, 1);
    assert.equal(changed.plan.forms[0].source, 'manual');
    assert.deepEqual(changed.plan.forms[0].sections.map((section) => section.label), ['Intro', 'Verse 1', 'Chorus', 'Chorus']);
    assert.deepEqual(changed.plan.links, [{ songId: 's1', links: [{ kind: 'sheet', url: 'https://example.com/sheet.pdf' }] }]);

    const noReorder = planSave({ ...common, canReorder: false, draft: { ...draft(), order: ['s2', 's1'] } });
    assert.ok(noReorder.ok);
    assert.equal(noReorder.plan.order, null, '서버 콘티는 순서를 저장하지 않는다');

    const badBpm = planSave({ ...common, draft: draft({ bpm: '500' }) });
    assert.deepEqual(badBpm, { ok: false, error: "'주님의 은혜' BPM은 20~300 사이 숫자로 입력해주세요." });
    const badVideo = planSave({ ...common, draft: draft({ video: 'https://example.com/video' }) });
    assert.equal(badVideo.ok, false);
    const badSheet = planSave({ ...common, draft: draft({ sheet: 'javascript:alert(1)' }) });
    assert.equal(badSheet.ok, false);
});

test('저장된 콘티 세부 정보는 형식이 맞는 값만 남긴다', () => {
    const clean = sanitizeSetlistDetails(
        {
            overrides: {
                s1: { targetKey: 'A', customBpm: 999, notes: ['  a  ', '', 3], lead: '  이소망 ' },
                bad: 'x',
            },
            owner: '  김찬양 ',
            status: 'confirmed',
            comments: [
                { id: 'c1', songId: 's1', author: '정다윗', text: '좋아요', createdAt: '2026-10-12T00:00:00.000Z' },
                { id: 'c2', songId: 's1', author: '', text: '이름 없음', createdAt: '2026-10-12T00:00:00.000Z' },
            ],
            updatedAt: '2026-10-12T00:00:00.000Z',
        },
        TEAM,
        'set-1',
    );
    assert.ok(clean);
    assert.deepEqual(clean.overrides.s1, { songId: 's1', targetKey: 'A', leaderNotes: null, customBpm: null, notes: ['a'], lead: '이소망' });
    assert.equal(clean.overrides.bad, undefined);
    assert.equal(clean.owner, '김찬양');
    assert.equal(clean.status, 'confirmed');
    assert.deepEqual(clean.comments?.map((comment) => comment.id), ['c1']);
    assert.equal(sanitizeSetlistDetails({ owner: 'x' }, TEAM, 'set-1'), null);

    // 예전 콘티 만들기 화면이 저장한 형식도 그대로 읽힌다.
    const legacy = sanitizeSetlistDetails({ setlistId: '주일 예배', teamId: TEAM, overrides: { s1: { songId: 's1', targetKey: 'G', customBpm: 68, leaderNotes: '잔잔하게' } }, updatedAt: '2026-10-01T00:00:00.000Z' }, TEAM, 'set-1');
    assert.equal(legacy?.overrides.s1.leaderNotes, '잔잔하게');
    assert.equal(legacy?.setlistId, 'set-1');
});

test('제목으로 저장된 예전 기록은 콘티 생성 시각과 가까울 때만 그 콘티의 것으로 본다', () => {
    assert.equal(isLegacyMatch('2026-10-01T10:00:05.000Z', '2026-10-01T10:00:00.000Z'), true);
    assert.equal(isLegacyMatch('2026-10-08T10:00:00.000Z', '2026-10-01T10:00:00.000Z'), false, '같은 제목의 다음 주 콘티 기록은 쓰지 않는다');
    assert.equal(isLegacyMatch('not-a-date', '2026-10-01T10:00:00.000Z'), false);
});

test('곡 링크는 http(s) 주소만 저장한다', () => {
    assert.equal(normalizeLinkUrl(' https://example.com/a b '), 'https://example.com/a%20b');
    assert.equal(normalizeLinkUrl('ftp://example.com'), null);
    assert.equal(normalizeLinkUrl('javascript:alert(1)'), null);
    assert.deepEqual(
        sanitizeSongLinks({ s1: [{ kind: 'sheet', url: 'https://example.com/s.pdf' }, { kind: 'video', url: 'https://youtu.be/x' }, { kind: 'mr', url: 'nope' }], s2: 'x' }),
        { s1: [{ kind: 'sheet', url: 'https://example.com/s.pdf' }] },
    );
});
