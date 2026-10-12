/**
 * 콘티·악보 화면 목업 데이터. 실제 데이터 연결 전까지 화면 구성을 확인하는 용도입니다.
 * 실제 저장소와 분리되어 있고, 기준일을 고정해 날짜 표시가 항상 같게 렌더링됩니다.
 */

export type ScreenId = 'week' | 'conti' | 'order' | 'team' | 'requests' | 'alerts';
export type Tone = 'sky' | 'mint' | 'peach' | 'lilac' | 'sand';

/** 시안의 오늘 (월요일). */
export const TODAY = '2026-10-12';

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

/* ───────────── 콘티 ───────────── */

export type SetlistStatus = 'done' | 'confirmed' | 'writing' | 'empty';

export const SECTION_NAMES: Record<string, string> = {
    I: 'Intro', V1: 'Verse 1', V2: 'Verse 2', V3: 'Verse 3', PC: 'Pre-Chorus',
    C: 'Chorus', B: 'Bridge', Tag: 'Tag', O: 'Outro',
};

export type LinkKind = 'video' | 'sheet' | 'mr';

export interface SongLink {
    kind: LinkKind;
    label: string;
    /** 새로 올라온 자료 표시 */
    fresh?: boolean;
}

export interface SongComment {
    from: string;
    text: string;
    ago: string;
}

export interface Song {
    kind: 'song';
    id: string;
    title: string;
    originalKey: string;
    key: string;
    bpm: number;
    lead: string;
    /** 송폼 진행 순서. 반복되는 후렴도 각각 한 칸 */
    form: string[];
    links: SongLink[];
    /** 인도자가 정한 특이사항 */
    notes: string[];
    /** 팀원들이 남긴 코멘트 */
    comments: SongComment[];
}

export interface Moment {
    kind: 'moment';
    id: string;
    moment: 'prayer' | 'word';
    title: string;
    memo?: string;
}

export type OrderItem = Song | Moment;

export interface Setlist {
    id: string;
    /** 주일 날짜 YYYY-MM-DD */
    date: string;
    time: string;
    service: string;
    theme: string;
    owner: string;
    status: SetlistStatus;
    items: OrderItem[];
}

export const LINK_LABEL: Record<LinkKind, string> = { video: '원곡 영상', sheet: '악보', mr: 'MR' };
const L = (...kinds: LinkKind[]): SongLink[] => kinds.map((kind) => ({ kind, label: LINK_LABEL[kind] }));

const FORM = {
    basic: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
    pre: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
    hymn: ['I', 'V1', 'C', 'V2', 'C', 'V3', 'C'],
};

function song(
    id: string, title: string, originalKey: string, key: string, bpm: number, lead: string,
    form: string[], extra: Partial<Pick<Song, 'links' | 'notes' | 'comments'>> = {},
): Song {
    return { kind: 'song', id, title, originalKey, key, bpm, lead, form, links: extra.links ?? L('video', 'sheet'), notes: extra.notes ?? [], comments: extra.comments ?? [] };
}

export const SETLISTS: Setlist[] = [
    {
        id: 's1004', date: '2026-10-04', time: '11:00', service: '주일 2부 예배', theme: '은혜의 강', owner: 'm3', status: 'done',
        items: [
            song('a1', '주 품에', 'E', 'E', 70, 'm3', FORM.basic),
            song('a2', '은혜', 'D', 'D', 64, 'm2', FORM.basic),
            song('a3', '믿음으로 서리라', 'D', 'D', 72, 'm1', FORM.pre),
            song('a4', '보내소서', 'A', 'A', 76, 'm3', FORM.basic),
        ],
    },
    {
        id: 's1011', date: '2026-10-11', time: '11:00', service: '주일 2부 예배', theme: '부르심', owner: 'm1', status: 'done',
        items: [
            song('b1', '예수 열방의 소망', 'G', 'G', 112, 'm1', FORM.pre),
            song('b2', '주님의 은혜', 'G', 'G', 68, 'm2', FORM.basic),
            song('b3', '시선', 'A', 'A', 66, 'm3', FORM.pre),
            song('b4', '보내소서', 'A', 'A', 76, 'm1', FORM.basic),
        ],
    },
    {
        id: 's1018', date: '2026-10-18', time: '11:00', service: '주일 2부 예배', theme: '신실하신 하나님', owner: 'm1', status: 'confirmed',
        items: [
            song('c1', '감사함으로 그 문에 들어가며', 'D', 'D', 124, 'm2', ['I', 'V1', 'C', 'V2', 'C', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['드럼 4카운트 후 바로 진입', '마지막 후렴 전 브레이크 1마디'],
                comments: [{ from: 'm8', text: '카운트는 하이햇으로 칠게요', ago: '어제' }],
            }),
            song('c2', '예수 열방의 소망', 'G', 'A', 112, 'm1', FORM.pre, {
                notes: ['1절은 어쿠스틱 기타만', '후렴부터 풀밴드'],
                comments: [{ from: 'm5', text: '어쿠스틱 대체가 없으면 1절은 일렉 클린톤으로 갈게요', ago: '3시간 전' }],
            }),
            { kind: 'moment', id: 'c-m1', moment: 'prayer', title: '인도자 기도', memo: '피아노 E 패드 유지, 다음 곡 Key로 연결' },
            song('c3', '믿음으로 서리라', 'D', 'E', 72, 'm3', ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'B', 'B', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['브릿지 2회, 두 번째는 빌드업', '엔딩은 후렴 마지막 줄 2번'],
                comments: [
                    { from: 'm4', text: '첫 번째 브릿지는 패드만 깔게요', ago: '3시간 전' },
                    { from: 'm3', text: '두 번째 브릿지부터 화음 들어갈게요', ago: '1시간 전' },
                ],
            }),
            song('c4', '주님의 은혜', 'G', 'G', 68, 'm1', [...FORM.basic.slice(0, 7), 'Tag'], {
                links: [{ kind: 'sheet', label: '악보', fresh: true }, { kind: 'video', label: '원곡 영상' }],
                comments: [{ from: 'm3', text: '편곡 버전 악보로 새로 올렸어요', ago: '2일 전' }],
            }),
            song('c5', '내 영혼이 은총 입어', 'F', 'G', 64, 'm2', FORM.hymn, {
                links: L('sheet'),
                notes: ['3절은 무반주 회중 찬양', '자막은 찬송가 가사 그대로'],
            }),
            { kind: 'moment', id: 'c-m2', moment: 'word', title: '말씀 연결 · 대표 기도', memo: '건반만 잔잔하게, 기도 끝나면 Intro 바로' },
            song('c6', '보내소서', 'A', 'A', 76, 'm1', ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'C', 'O'], {
                links: L('video', 'sheet', 'mr'),
                notes: ['후렴 2회 반복 후 엔딩 리타르단도'],
                comments: [{ from: 'm2', text: 'Key G로 내리는 거 요청 남겼어요!', ago: '2시간 전' }],
            }),
        ],
    },
    {
        id: 's1025', date: '2026-10-25', time: '11:00', service: '주일 2부 예배', theme: '감사의 노래', owner: 'm2', status: 'writing',
        items: [
            song('d1', '감사함으로 그 문에 들어가며', 'D', 'D', 124, 'm2', ['I', 'V1', 'C', 'V2', 'C', 'O']),
            song('d2', '주님 다시 오실 때까지', 'G', 'G', 84, 'm3', FORM.basic, { notes: ['2절 후 간주 4마디'] }),
            song('d3', '은혜', 'D', 'D', 64, 'm2', FORM.basic),
        ],
    },
    {
        id: 's1101', date: '2026-11-01', time: '11:00', service: '주일 2부 예배', theme: '', owner: 'm3', status: 'empty',
        items: [],
    },
];

export const THIS_WEEK_SETLIST_ID = 's1018';

export const SETLIST_STATUS: Record<SetlistStatus, { label: string; dot: string; text: string }> = {
    done: { label: '완료', dot: 'bg-neutral-300 dark:bg-neutral-600', text: 'text-neutral-400 dark:text-neutral-500' },
    confirmed: { label: '확정', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    writing: { label: '작성 중', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    empty: { label: '미작성', dot: 'bg-neutral-300 dark:bg-neutral-600', text: 'text-neutral-400 dark:text-neutral-500' },
};

export function setlistById(id: string): Setlist {
    return SETLISTS.find((item) => item.id === id) ?? SETLISTS[0];
}

export function songsOf(items: OrderItem[]): Song[] {
    return items.filter((item): item is Song => item.kind === 'song');
}

export function commentsOf(items: OrderItem[]): SongComment[] {
    return songsOf(items).flatMap((item) => item.comments);
}

/* ───────────── 팀 배치 ───────────── */

export type PartId = 'lead' | 'vocal' | 'keys' | 'electric' | 'acoustic' | 'bass' | 'drums' | 'sound' | 'caption';
export type AssignStatus = 'confirmed' | 'pending' | 'declined';

export const PARTS: { id: PartId; name: string }[] = [
    { id: 'lead', name: '인도' },
    { id: 'vocal', name: '싱어' },
    { id: 'keys', name: '건반' },
    { id: 'electric', name: '일렉 기타' },
    { id: 'acoustic', name: '어쿠스틱 기타' },
    { id: 'bass', name: '베이스' },
    { id: 'drums', name: '드럼' },
    { id: 'sound', name: '음향' },
    { id: 'caption', name: '자막' },
];

export interface Assignment {
    part: PartId;
    memberId: string | null;
    status: AssignStatus | null;
    note?: string;
}

const a = (part: PartId, memberId: string | null, status: AssignStatus | null, note?: string): Assignment => ({ part, memberId, status, note });

export const ASSIGNMENTS: Record<string, Assignment[]> = {
    '2026-10-11': [
        a('lead', 'm1', 'confirmed'), a('vocal', 'm2', 'confirmed'), a('vocal', 'm3', 'confirmed'), a('keys', 'm4', 'confirmed'),
        a('electric', 'm5', 'confirmed'), a('acoustic', 'm6', 'confirmed'), a('bass', 'm7', 'confirmed'), a('drums', 'm8', 'confirmed'),
        a('sound', 'm9', 'confirmed'), a('caption', 'm10', 'confirmed'),
    ],
    '2026-10-18': [
        a('lead', 'm1', 'confirmed'), a('vocal', 'm2', 'confirmed'), a('vocal', 'm3', 'confirmed'), a('keys', 'm4', 'confirmed'),
        a('electric', 'm5', 'pending'), a('acoustic', 'm6', 'declined', '시험 기간'), a('bass', 'm7', 'confirmed'), a('drums', 'm8', 'confirmed'),
        a('sound', 'm9', 'confirmed'), a('caption', null, null),
    ],
    '2026-10-25': [
        a('lead', 'm2', 'confirmed'), a('vocal', 'm3', 'pending'), a('vocal', 'm1', 'confirmed'), a('keys', 'm4', 'pending'),
        a('electric', 'm5', 'confirmed'), a('acoustic', 'm6', 'pending'), a('bass', null, null), a('drums', 'm8', 'confirmed'),
        a('sound', 'm9', 'pending'), a('caption', 'm10', 'confirmed'),
    ],
    '2026-11-01': [
        a('lead', 'm3', 'pending'), a('vocal', null, null), a('vocal', null, null), a('keys', 'm4', 'pending'),
        a('electric', null, null), a('acoustic', 'm6', 'pending'), a('bass', 'm7', 'pending'), a('drums', null, null),
        a('sound', 'm9', 'pending'), a('caption', null, null),
    ],
};

export const TEAM_SUNDAYS = Object.keys(ASSIGNMENTS);

/* ───────────── 일정 ───────────── */

export type EventKind = 'rehearsal' | 'service' | 'prayer';

export interface ScheduleEvent {
    id: string;
    date: string;
    start: string;
    end: string;
    kind: EventKind;
    title: string;
    place: string;
    attendees: string[];
    expected: number;
}

export const EVENTS: ScheduleEvent[] = [
    { id: 'e1', date: '2026-10-15', start: '20:00', end: '22:00', kind: 'rehearsal', title: '팀 연습', place: '교육관 B1', attendees: ['m1', 'm2', 'm3', 'm4', 'm7', 'm8', 'm9'], expected: 9 },
    { id: 'e2', date: '2026-10-16', start: '20:30', end: '22:00', kind: 'prayer', title: '금요 기도회 찬양', place: '본당', attendees: ['m2', 'm4', 'm8'], expected: 4 },
    { id: 'e3', date: '2026-10-18', start: '09:30', end: '10:30', kind: 'rehearsal', title: '리허설', place: '본당', attendees: ['m1', 'm2', 'm3', 'm4', 'm7', 'm8', 'm9'], expected: 9 },
    { id: 'e4', date: '2026-10-18', start: '11:00', end: '12:10', kind: 'service', title: '주일 2부 예배', place: '본당 3층', attendees: ['m1', 'm2', 'm3', 'm4', 'm7', 'm8', 'm9'], expected: 9 },
];

export const EVENT_KIND: Record<EventKind, { label: string; tone: Tone }> = {
    rehearsal: { label: '연습', tone: 'mint' },
    service: { label: '예배', tone: 'sky' },
    prayer: { label: '기도회', tone: 'lilac' },
};

/* ───────────── 요청 ───────────── */

export type RequestKind = 'key' | 'substitute' | 'question' | 'schedule' | 'sheet';

export interface TeamRequest {
    id: string;
    kind: RequestKind;
    title: string;
    body: string;
    from: string;
    context: string;
    ago: string;
    done: boolean;
}

export const REQUEST_KIND: Record<RequestKind, string> = {
    key: 'Key 변경',
    substitute: '대체 요청',
    question: '곡 질문',
    schedule: '일정 변경',
    sheet: '악보 요청',
};

export const REQUESTS: TeamRequest[] = [
    { id: 'r1', kind: 'key', title: '보내소서 Key를 G로 내려도 될까요?', body: '후렴 고음이 계속 부담돼서요. 한 키만 내려도 회중이 따라 부르기 편할 것 같아요.', from: 'm2', context: '10/18 콘티', ago: '2시간 전', done: false },
    { id: 'r2', kind: 'substitute', title: '어쿠스틱 기타 대체 인원이 필요해요', body: '시험 기간이라 이번 주는 참석이 어렵습니다. 죄송해요.', from: 'm6', context: '10/18 팀 배치', ago: '어제', done: false },
    { id: 'r3', kind: 'question', title: '믿음으로 서리라 브릿지 몇 번 반복하나요?', body: '메모에 2회라고 되어 있는데 엔딩 전에 한 번 더 가는지 궁금합니다.', from: 'm4', context: '10/18 콘티', ago: '어제', done: false },
    { id: 'r4', kind: 'schedule', title: '목요 연습 30분 늦게 시작 가능할까요?', body: '퇴근이 늦어 20:30부터 가능할 것 같습니다.', from: 'm8', context: '10/15 팀 연습', ago: '3일 전', done: true },
    { id: 'r5', kind: 'sheet', title: '주님의 은혜 최신 악보 올려주세요', body: '지난번 편곡 버전으로 부탁드려요.', from: 'm5', context: '10/18 콘티', ago: '4일 전', done: true },
];

/* ───────────── 알림 (팀원들의 입력) ───────────── */

export type NoticeKind = 'request' | 'comment' | 'decline' | 'accept' | 'pending' | 'confirm' | 'upload' | 'edit';
export type NoticeCategory = 'conti' | 'team' | 'request';

export interface Notice {
    id: string;
    actor: string;
    kind: NoticeKind;
    /** 이름 뒤에 이어지는 문장 */
    message: string;
    /** 본인이 입력한 내용 (코멘트, 사유 등) */
    quote?: string;
    group: '오늘' | '어제' | '이번 주';
    ago: string;
    unread: boolean;
    action?: string;
}

export const NOTICE_KIND: Record<NoticeKind, { category: NoticeCategory; tone: Tone }> = {
    request: { category: 'request', tone: 'peach' },
    comment: { category: 'conti', tone: 'sky' },
    decline: { category: 'team', tone: 'peach' },
    accept: { category: 'team', tone: 'mint' },
    pending: { category: 'team', tone: 'sand' },
    confirm: { category: 'conti', tone: 'mint' },
    upload: { category: 'conti', tone: 'lilac' },
    edit: { category: 'conti', tone: 'sky' },
};

export const NOTICES: Notice[] = [
    { id: 'n1', actor: 'm3', kind: 'comment', message: "'믿음으로 서리라'에 코멘트를 남겼어요", quote: '두 번째 브릿지부터 화음 들어갈게요', group: '오늘', ago: '1시간 전', unread: true },
    { id: 'n2', actor: 'm2', kind: 'request', message: "'보내소서' Key 변경을 요청했어요", quote: '후렴 고음이 부담돼서 G로 내려도 될까요?', group: '오늘', ago: '2시간 전', unread: true, action: '답변하기' },
    { id: 'n3', actor: 'm4', kind: 'comment', message: "'믿음으로 서리라'에 코멘트를 남겼어요", quote: '첫 번째 브릿지는 패드만 깔게요', group: '오늘', ago: '3시간 전', unread: true },
    { id: 'n4', actor: 'm5', kind: 'comment', message: "'예수 열방의 소망'에 코멘트를 남겼어요", quote: '어쿠스틱 대체가 없으면 1절은 일렉 클린톤으로 갈게요', group: '오늘', ago: '3시간 전', unread: false },
    { id: 'n5', actor: 'm6', kind: 'decline', message: '10/18 어쿠스틱 기타에 불참으로 응답했어요', quote: '시험 기간이라 이번 주는 어려워요', group: '어제', ago: '어제 21:40', unread: true, action: '대체 찾기' },
    { id: 'n6', actor: 'm5', kind: 'pending', message: '10/18 일렉 기타 배치에 아직 응답하지 않았어요', group: '어제', ago: '어제 18:00', unread: false, action: '다시 알리기' },
    { id: 'n7', actor: 'm8', kind: 'accept', message: '목요 팀 연습 참석을 확정했어요', quote: '20:30부터 가능해요', group: '어제', ago: '어제 12:15', unread: false },
    { id: 'n8', actor: 'm1', kind: 'confirm', message: '10/18 콘티를 확정했어요', group: '어제', ago: '어제 10:02', unread: false },
    { id: 'n9', actor: 'm3', kind: 'upload', message: "'주님의 은혜' 새 악보를 올렸어요", group: '이번 주', ago: '2일 전', unread: false },
    { id: 'n10', actor: 'm2', kind: 'edit', message: '10/25 콘티 작성을 시작했어요', group: '이번 주', ago: '3일 전', unread: false },
];

/* ───────────── 날짜 도우미 ───────────── */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

function parts(date: string) {
    const [y, m, d] = date.split('-').map(Number);
    return { y, m, d, utc: Date.UTC(y, m - 1, d) };
}

export function weekday(date: string): string {
    return WEEKDAYS[new Date(parts(date).utc).getUTCDay()];
}

export function dayOf(date: string): number {
    return parts(date).d;
}

export function monthOf(date: string): number {
    return parts(date).m;
}

export function addDays(date: string, days: number): string {
    const next = new Date(parts(date).utc + days * 86_400_000);
    return next.toISOString().slice(0, 10);
}

export function diffDays(date: string, from = TODAY): number {
    return Math.round((parts(date).utc - parts(from).utc) / 86_400_000);
}

export function dDay(date: string): string {
    const diff = diffDays(date);
    return diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** 주일 날짜 → '10월 셋째 주' */
export function weekLabel(sunday: string): string {
    const { m, d } = parts(sunday);
    return `${m}월 ${ORDINALS[Math.floor((d - 1) / 7)]} 주`;
}

export function shortWeekLabel(sunday: string): string {
    const { d } = parts(sunday);
    return `${ORDINALS[Math.floor((d - 1) / 7)]} 주`;
}

export function md(date: string): string {
    const { m, d } = parts(date);
    return `${m}/${d}`;
}

/** 해당 주일로 끝나는 월~일 7일 */
export function weekDates(sunday: string): string[] {
    return Array.from({ length: 7 }, (_, index) => addDays(sunday, index - 6));
}

/** 'YYYY-MM' 달력 6주 그리드 (일요일 시작). 다른 달 날짜는 null. */
export function monthGrid(year: number, month: number): (string | null)[] {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const lead = first.getUTCDay();
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1) {
        cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7) cells.push(null);
    return cells;
}
