/**
 * 콘티·악보 디자인 시안 페이지용 목업 데이터. 기준일을 고정해 날짜 표시가 항상 같게 렌더링됩니다.
 * 팀 배치·일정·요청·알림은 일정·요청 화면의 저장 형식(PlanningState) 그대로 적어,
 * 실제 화면과 같은 변환·명령 규칙을 탑니다.
 */

import type { PlanningState } from '@/types/planning';
import type { TeamMember } from '@/types/team';
import { LINK_LABEL, type ContiSetlist, type ContiSong, type LinkKind, type SongComment, type SongLink, type Tone } from './model';

/** 시안의 오늘 (월요일). */
export const TODAY = '2026-10-12';
/** 시안의 지금 (서울 12:00) */
export const MOCK_NOW = new Date('2026-10-12T12:00:00+09:00');
/** 시안에서 화면을 보는 사람 (인도자) */
export const MOCK_VIEWER_ID = 'm1';
/** 코멘트 소식을 마지막으로 읽은 시각 */
export const MOCK_FEED_SEEN_AT = '2026-10-11T00:00:00+09:00';

/* ───────────── 사람 ───────────── */

export interface Member {
    id: string;
    name: string;
    tone: Tone;
}

export const MEMBERS: Member[] = [
    { id: 'm1', name: '김찬양', tone: 'mint' },
    { id: 'm2', name: '이소망', tone: 'sky' },
    { id: 'm3', name: '박은혜', tone: 'lilac' },
    { id: 'm4', name: '정다윗', tone: 'sand' },
    { id: 'm5', name: '최요셉', tone: 'peach' },
    { id: 'm6', name: '한믿음', tone: 'sky' },
    { id: 'm7', name: '윤사랑', tone: 'lilac' },
    { id: 'm8', name: '오기쁨', tone: 'peach' },
    { id: 'm9', name: '서하늘', tone: 'mint' },
    { id: 'm10', name: '장평강', tone: 'sand' },
];

export function member(id: string | null | undefined): Member | null {
    return MEMBERS.find((item) => item.id === id) ?? null;
}

/* ───────────── 콘티 (시안용) ───────────── */

const L = (...kinds: LinkKind[]): SongLink[] => kinds.map((kind) => ({ kind, label: LINK_LABEL[kind] }));

const FORM = {
    basic: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
    pre: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
    hymn: ['I', 'V1', 'C', 'V2', 'C', 'V3', 'C'],
};

type SongExtra = Partial<Pick<ContiSong, 'links' | 'notes'>> & { comments?: SongComment[] };

function song(id: string, title: string, originalKey: string, key: string, bpm: number, lead: string, form: string[], extra: SongExtra = {}): ContiSong {
    return {
        kind: 'song', id, songId: id, title, artist: null, originalKey, key, bpm, lead, form,
        links: extra.links ?? L('video', 'sheet'), notes: extra.notes ?? [], comments: extra.comments ?? [],
    };
}

export const SETLISTS: ContiSetlist[] = [
    {
        id: 's1004', date: '2026-10-04', time: '11:00', service: '주일 2부 예배', theme: '은혜의 강', owner: '박은혜', status: 'done',
        items: [
            song('a1', '주 품에', 'E', 'E', 70, '박은혜', FORM.basic),
            song('a2', '은혜', 'D', 'D', 64, '이소망', FORM.basic),
            song('a3', '믿음으로 서리라', 'D', 'D', 72, '김찬양', FORM.pre),
            song('a4', '보내소서', 'A', 'A', 76, '박은혜', FORM.basic),
        ],
    },
    {
        id: 's1011', date: '2026-10-11', time: '11:00', service: '주일 2부 예배', theme: '부르심', owner: '김찬양', status: 'done',
        items: [
            song('b1', '예수 열방의 소망', 'G', 'G', 112, '김찬양', FORM.pre),
            song('b2', '주님의 은혜', 'G', 'G', 68, '이소망', FORM.basic),
            song('b3', '시선', 'A', 'A', 66, '박은혜', FORM.pre),
            song('b4', '보내소서', 'A', 'A', 76, '김찬양', FORM.basic),
        ],
    },
    {
        id: 's1018', date: '2026-10-18', time: '11:00', service: '주일 2부 예배', theme: '신실하신 하나님', owner: '김찬양', status: 'confirmed',
        items: [
            song('c1', '감사함으로 그 문에 들어가며', 'D', 'D', 124, '이소망', ['I', 'V1', 'C', 'V2', 'C', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['드럼 4카운트 후 바로 진입', '마지막 후렴 전 브레이크 1마디'],
                comments: [{ id: 'k1', author: '오기쁨', text: '카운트는 하이햇으로 칠게요', ago: '어제', createdAt: '2026-10-11T09:30:00+09:00' }],
            }),
            song('c2', '예수 열방의 소망', 'G', 'A', 112, '김찬양', FORM.pre, {
                notes: ['1절은 어쿠스틱 기타만', '후렴부터 풀밴드'],
                comments: [{ id: 'k2', author: '최요셉', text: '어쿠스틱 대체가 없으면 1절은 일렉 클린톤으로 갈게요', ago: '3시간 전', createdAt: '2026-10-12T09:00:00+09:00' }],
            }),
            { kind: 'moment', id: 'c-m1', moment: 'prayer', title: '인도자 기도', memo: '피아노 E 패드 유지, 다음 곡 Key로 연결' },
            song('c3', '믿음으로 서리라', 'D', 'E', 72, '박은혜', ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'B', 'B', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['브릿지 2회, 두 번째는 빌드업', '엔딩은 후렴 마지막 줄 2번'],
                comments: [
                    { id: 'k3', author: '정다윗', text: '첫 번째 브릿지는 패드만 깔게요', ago: '3시간 전', createdAt: '2026-10-12T09:05:00+09:00' },
                    { id: 'k4', author: '박은혜', text: '두 번째 브릿지부터 화음 들어갈게요', ago: '1시간 전', createdAt: '2026-10-12T11:00:00+09:00' },
                ],
            }),
            song('c4', '주님의 은혜', 'G', 'G', 68, '김찬양', [...FORM.basic.slice(0, 7), 'Tag'], {
                links: [{ kind: 'sheet', label: '악보', fresh: true }, { kind: 'video', label: '원곡 영상' }],
                comments: [{ id: 'k5', author: '박은혜', text: '편곡 버전 악보로 새로 올렸어요', ago: '2일 전', createdAt: '2026-10-10T20:00:00+09:00' }],
            }),
            song('c5', '내 영혼이 은총 입어', 'F', 'G', 64, '이소망', FORM.hymn, {
                links: L('sheet'),
                notes: ['3절은 무반주 회중 찬양', '자막은 찬송가 가사 그대로'],
            }),
            { kind: 'moment', id: 'c-m2', moment: 'word', title: '말씀 연결 · 대표 기도', memo: '건반만 잔잔하게, 기도 끝나면 Intro 바로' },
            song('c6', '보내소서', 'A', 'A', 76, '김찬양', ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['후렴 2회 반복 후 엔딩 리타르단도'],
                comments: [{ id: 'k6', author: '이소망', text: 'Key G로 내리는 거 요청 남겼어요!', ago: '2시간 전', createdAt: '2026-10-12T10:00:00+09:00' }],
            }),
        ],
    },
    {
        id: 's1025', date: '2026-10-25', time: '11:00', service: '주일 2부 예배', theme: '감사의 노래', owner: '이소망', status: 'writing',
        items: [
            song('d1', '감사함으로 그 문에 들어가며', 'D', 'D', 124, '이소망', ['I', 'V1', 'C', 'V2', 'C', 'O']),
            song('d2', '주님 다시 오실 때까지', 'G', 'G', 84, '박은혜', FORM.basic, { notes: ['2절 후 간주 4마디'] }),
            song('d3', '은혜', 'D', 'D', 64, '이소망', FORM.basic),
        ],
    },
    {
        id: 's1101', date: '2026-11-01', time: '11:00', service: '주일 2부 예배', theme: '', owner: '박은혜', status: 'empty',
        items: [],
    },
];

export const THIS_WEEK_SETLIST_ID = 's1018';

/** 시안 기준 이번 주 주일 (팀 배치 목업의 기본 선택값) */
export const MOCK_SUNDAY = '2026-10-18';

/* ───────────── 팀 (일정·요청 저장 형식) ───────────── */

const ROLE: Record<string, TeamMember['role']> = { m1: 'leader', m2: 'vocal', m3: 'vocal', m4: 'keyboard', m5: 'guitar', m6: 'guitar', m7: 'bass', m8: 'drums', m9: 'sound', m10: 'media' };

export const MOCK_MEMBERS: TeamMember[] = MEMBERS.map((item) => ({ userId: item.id, name: item.name, role: ROLE[item.id], permission: item.id === 'm1' ? 'owner' : 'member' }));

type Att = 'pending' | 'confirmed' | 'absent';
function slot(id: string, role: TeamMember['role'], memberId: string | null, attendance: Att = 'pending', extra: { declineReason?: string; volunteers?: string[]; invitedAt?: string } = {}) {
    return { id, role, memberId, attendance, volunteers: extra.volunteers ?? [], ...(extra.invitedAt ? { invitedAt: extra.invitedAt } : {}), ...(extra.declineReason ? { declineReason: extra.declineReason } : {}) };
}
const kst = (date: string, time: string) => `${date}T${time}:00+09:00`;
const seoul = (date: string, time: string) => new Date(kst(date, time)).toISOString();

/** 시안 팀의 일정·요청 저장 데이터. 일정·요청 화면에 그대로 넣어도 같은 화면이 나옵니다. */
export function buildMockPlanningState(): PlanningState {
    return {
        version: 1,
        events: [
            {
                id: 'ev-1101', title: '주일 2부 예배', kind: 'worship', startsAt: kst('2026-11-01', '11:00'), endsAt: kst('2026-11-01', '12:10'), location: '본당 3층', notes: '', cancelled: false,
                setlistTitle: null, setlistSongs: null, setlistId: 's1101',
                slots: [slot('s1101-lead', 'leader', 'm3'), slot('s1101-v1', 'vocal', null), slot('s1101-v2', 'vocal', null), slot('s1101-key', 'keyboard', 'm4'), slot('s1101-g1', 'guitar', null), slot('s1101-g2', 'guitar', 'm6'), slot('s1101-bass', 'bass', 'm7'), slot('s1101-drum', 'drums', null), slot('s1101-sound', 'sound', 'm9'), slot('s1101-media', 'media', null)],
            },
            {
                id: 'ev-1025', title: '주일 2부 예배', kind: 'worship', startsAt: kst('2026-10-25', '11:00'), endsAt: kst('2026-10-25', '12:10'), location: '본당 3층', notes: '', cancelled: false,
                setlistTitle: '감사의 노래', setlistSongs: ['감사함으로 그 문에 들어가며', '주님 다시 오실 때까지', '은혜'], setlistId: 's1025',
                slots: [slot('s1025-lead', 'leader', 'm1', 'pending', { invitedAt: seoul('2026-10-11', '18:00') }), slot('s1025-v1', 'vocal', 'm2', 'confirmed'), slot('s1025-v2', 'vocal', 'm3'), slot('s1025-key', 'keyboard', 'm4'), slot('s1025-g1', 'guitar', 'm5', 'confirmed'), slot('s1025-g2', 'guitar', 'm6'), slot('s1025-bass', 'bass', null), slot('s1025-drum', 'drums', 'm8', 'confirmed'), slot('s1025-sound', 'sound', 'm9'), slot('s1025-media', 'media', 'm10', 'confirmed')],
            },
            {
                id: 'ev-1018', title: '주일 2부 예배', kind: 'worship', startsAt: kst('2026-10-18', '11:00'), endsAt: kst('2026-10-18', '12:10'), location: '본당 3층', notes: '', cancelled: false,
                setlistTitle: '신실하신 하나님', setlistSongs: ['감사함으로 그 문에 들어가며', '예수 열방의 소망', '믿음으로 서리라', '주님의 은혜', '내 영혼이 은총 입어', '보내소서'], setlistId: 's1018',
                slots: [slot('s1018-lead', 'leader', 'm1', 'confirmed'), slot('s1018-v1', 'vocal', 'm2', 'confirmed'), slot('s1018-v2', 'vocal', 'm3', 'confirmed'), slot('s1018-key', 'keyboard', 'm4', 'confirmed'), slot('s1018-g1', 'guitar', 'm5', 'pending', { invitedAt: seoul('2026-10-11', '18:00') }), { ...slot('s1018-g2', 'guitar', 'm6', 'absent', { declineReason: '시험 기간', volunteers: ['m10'] }), asked: ['m10'] }, slot('s1018-bass', 'bass', 'm7', 'confirmed'), slot('s1018-drum', 'drums', 'm8', 'confirmed'), slot('s1018-sound', 'sound', 'm9', 'confirmed'), slot('s1018-media', 'media', null)],
            },
            {
                id: 'ev-1016', title: '금요 기도회 찬양', kind: 'worship', startsAt: kst('2026-10-16', '20:30'), endsAt: kst('2026-10-16', '22:00'), location: '본당', notes: '', cancelled: false,
                slots: [slot('s1016-v1', 'vocal', 'm2', 'confirmed'), slot('s1016-key', 'keyboard', 'm4', 'confirmed'), slot('s1016-drum', 'drums', 'm8', 'confirmed'), slot('s1016-g1', 'guitar', null)],
            },
            {
                id: 'ev-1015', title: '팀 연습', kind: 'rehearsal', startsAt: kst('2026-10-15', '20:00'), endsAt: kst('2026-10-15', '22:00'), location: '교육관 B1', notes: '', cancelled: false,
                slots: [slot('s1015-lead', 'leader', 'm1', 'confirmed'), slot('s1015-v1', 'vocal', 'm2', 'confirmed'), slot('s1015-v2', 'vocal', 'm3', 'confirmed'), slot('s1015-key', 'keyboard', 'm4', 'confirmed'), slot('s1015-g1', 'guitar', 'm5'), slot('s1015-g2', 'guitar', 'm6'), slot('s1015-bass', 'bass', 'm7', 'confirmed'), slot('s1015-drum', 'drums', 'm8', 'confirmed'), slot('s1015-sound', 'sound', 'm9', 'confirmed')],
            },
            {
                id: 'ev-1011', title: '주일 2부 예배', kind: 'worship', startsAt: kst('2026-10-11', '11:00'), endsAt: kst('2026-10-11', '12:10'), location: '본당 3층', notes: '', cancelled: false,
                setlistTitle: '부르심', setlistSongs: ['예수 열방의 소망', '주님의 은혜', '시선', '보내소서'], setlistId: 's1011',
                slots: [slot('s1011-lead', 'leader', 'm1', 'confirmed'), slot('s1011-v1', 'vocal', 'm2', 'confirmed'), slot('s1011-v2', 'vocal', 'm3', 'confirmed'), slot('s1011-key', 'keyboard', 'm4', 'confirmed'), slot('s1011-g1', 'guitar', 'm5', 'confirmed'), slot('s1011-g2', 'guitar', 'm6', 'confirmed'), slot('s1011-bass', 'bass', 'm7', 'confirmed'), slot('s1011-drum', 'drums', 'm8', 'confirmed'), slot('s1011-sound', 'sound', 'm9', 'confirmed'), slot('s1011-media', 'media', 'm10', 'confirmed')],
            },
        ],
        alerts: [
            { id: 'al-1', eventId: 'ev-1018', slotId: 's1018-g2', kind: 'absence', body: '한믿음 · 기타 결석: 시험 기간', authorId: 'm6', createdAt: seoul('2026-10-11', '21:40'), resolvedAt: null },
        ],
        requests: [
            { id: 'r1', setlistId: 's1018', setlistTitle: '신실하신 하나님', kind: 'change', body: '보내소서 Key를 G로 내려도 될까요?\n후렴 고음이 계속 부담돼서요. 한 키만 내려도 회중이 따라 부르기 편할 것 같아요.', authorId: 'm2', leaderId: 'm1', status: 'open', createdAt: seoul('2026-10-12', '10:00'), updatedAt: seoul('2026-10-12', '10:00'), replies: [] },
            { id: 'r3', setlistId: 's1018', setlistTitle: '신실하신 하나님', kind: 'question', body: '믿음으로 서리라 브릿지 몇 번 반복하나요?\n메모에 2회라고 되어 있는데 엔딩 전에 한 번 더 가는지 궁금합니다.', authorId: 'm4', leaderId: 'm1', status: 'open', createdAt: seoul('2026-10-11', '18:00'), updatedAt: seoul('2026-10-11', '18:00'), replies: [] },
            { id: 'r4', setlistId: '', setlistTitle: '10/15 팀 연습', kind: 'change', body: '목요 연습 30분 늦게 시작 가능할까요?\n퇴근이 늦어 20:30부터 가능할 것 같습니다.', authorId: 'm8', leaderId: 'm1', status: 'resolved', createdAt: seoul('2026-10-09', '12:00'), updatedAt: seoul('2026-10-09', '13:00'), replies: [{ id: 'r4-1', authorId: 'm1', body: '네, 20:30에 시작할게요.', createdAt: seoul('2026-10-09', '13:00') }] },
            { id: 'r5', setlistId: 's1018', setlistTitle: '신실하신 하나님', kind: 'reminder', body: '주님의 은혜 최신 악보 올려주세요\n지난번 편곡 버전으로 부탁드려요.', authorId: 'm5', leaderId: 'm1', status: 'resolved', createdAt: seoul('2026-10-08', '09:00'), updatedAt: seoul('2026-10-10', '20:00'), replies: [] },
        ],
        notifications: [
            { id: 'n1', title: '콘티 수정 요청', body: '신실하신 하나님 · 보내소서 Key를 G로 내려도 될까요?', urgent: false, target: 'requests', entityId: 'r1', recipientIds: ['m1'], readBy: [], createdAt: seoul('2026-10-12', '10:00') },
            { id: 'n2', title: '결석 · 대체 인원이 필요해요', body: '주일 2부 예배 · 한믿음 · 기타 결석: 시험 기간', urgent: true, target: 'schedule', entityId: 'ev-1018', recipientIds: ['m1', 'm4'], readBy: [], createdAt: seoul('2026-10-11', '21:40') },
            { id: 'n3', title: '대체 인원 후보가 있어요', body: '주일 2부 예배 · 기타 · 추천: 장평강', urgent: false, target: 'schedule', entityId: 'ev-1018', recipientIds: ['m1'], readBy: ['m1'], createdAt: seoul('2026-10-11', '21:40') },
            { id: 'n4', title: '대체 지원자가 있어요', body: '주일 2부 예배 · 장평강', urgent: true, target: 'schedule', entityId: 'ev-1018', recipientIds: ['m1'], readBy: [], createdAt: seoul('2026-10-11', '22:05') },
            { id: 'n5', title: '콘티 질문', body: '신실하신 하나님 · 믿음으로 서리라 브릿지 몇 번 반복하나요?', urgent: false, target: 'requests', entityId: 'r3', recipientIds: ['m1'], readBy: ['m1'], createdAt: seoul('2026-10-11', '18:00') },
            { id: 'n6', title: '참석 응답', body: '오기쁨 · 팀 연습', urgent: false, target: 'schedule', entityId: 'ev-1015', recipientIds: ['m1'], readBy: ['m1'], createdAt: seoul('2026-10-11', '12:15') },
            { id: 'n7', title: '불가일 등록', body: '한믿음 · 2026-10-18 (시험 기간)', urgent: false, target: 'schedule', entityId: 'm6', recipientIds: ['m1'], readBy: ['m1'], createdAt: seoul('2026-10-10', '09:10') },
            { id: 'n8', title: '콘티 요청에 답변이 왔어요', body: '10/15 팀 연습 · 네, 20:30에 시작할게요.', urgent: false, target: 'requests', entityId: 'r4', recipientIds: ['m8'], readBy: [], createdAt: seoul('2026-10-09', '13:00') },
        ],
        rotations: [],
        blockedDates: [{ memberId: 'm6', date: '2026-10-18', reason: '시험 기간' }],
        partLeads: [{ part: 'band', memberId: 'm4' }, { part: 'vocal', memberId: 'm2' }],
    };
}
