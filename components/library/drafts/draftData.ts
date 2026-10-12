/**
 * 콘티·순서 탭 디자인 시안 전용 목업 데이터.
 * 실제 라이브러리 저장소와 분리되어 있으며, 날짜 계산은 고정된 기준일로 결정적으로 렌더링됩니다.
 */

export type DraftTab = 'setlists' | 'order';
export type DraftVariant = 'stack' | 'cuesheet' | 'stage';
export type DraftStatus = 'confirmed' | 'draft' | 'done';
export type DraftMomentKind = 'prayer' | 'word' | 'transition';

export interface DraftSong {
    kind: 'song';
    id: string;
    title: string;
    artist: string;
    originalKey: string;
    key: string;
    bpm: number;
    minutes: number;
    /** 송폼 진행 순서. 반복되는 후렴도 각각 한 칸입니다. */
    form: string[];
    memo?: string;
}

export interface DraftMoment {
    kind: 'moment';
    id: string;
    moment: DraftMomentKind;
    label: string;
    detail?: string;
    minutes: number;
}

export type DraftItem = DraftSong | DraftMoment;

export interface DraftSetlist {
    id: string;
    title: string;
    theme: string;
    /** YYYY-MM-DD */
    date: string;
    /** HH:mm */
    time: string;
    leader: string;
    status: DraftStatus;
    readiness: { sheets: [number, number]; forms: [number, number]; members: [number, number] };
    items: DraftItem[];
}

/** 시안 화면의 기준일 (월요일). 목업 날짜가 시간이 지나도 같은 상태로 보이도록 고정합니다. */
export const DRAFT_TODAY = '2026-10-12';

export const DRAFT_VARIANTS: { id: DraftVariant; letter: string; name: string; summary: string }[] = [
    { id: 'stack', letter: 'A', name: '카드 스택', summary: '지금 화면을 정돈한 카드형. 이번 주 콘티가 가장 먼저 보이고, 순서는 타임라인으로 읽습니다.' },
    { id: 'cuesheet', letter: 'B', name: '큐시트', summary: '시간 기준 운영표. 시작 시각·Key·BPM·송폼을 한 줄에 놓아 인도자와 음향팀이 함께 봅니다.' },
    { id: 'stage', letter: 'C', name: '스테이지', summary: '흐름 중심 몰입형. 콘티는 커버처럼 넘겨 보고, 순서는 템포 곡선과 큰 글씨로 따라갑니다.' },
];

export const SECTION_NAMES: Record<string, string> = {
    I: 'Intro',
    V1: 'Verse 1',
    V2: 'Verse 2',
    V3: 'Verse 3',
    PC: 'Pre-Chorus',
    C: 'Chorus',
    B: 'Bridge',
    Int: 'Interlude',
    Tag: 'Tag',
    O: 'Outro',
};

export const DRAFT_SETLISTS: DraftSetlist[] = [
    {
        id: 'draft-1018',
        title: '주일 2부 예배',
        theme: '신실하신 하나님',
        date: '2026-10-18',
        time: '11:00',
        leader: '김찬양',
        status: 'confirmed',
        readiness: { sheets: [6, 6], forms: [5, 6], members: [5, 7] },
        items: [
            {
                kind: 'song', id: 'd1018-1', title: '감사함으로 그 문에 들어가며', artist: 'CCM',
                originalKey: 'D', key: 'D', bpm: 124, minutes: 4,
                form: ['I', 'V1', 'C', 'V2', 'C', 'C', 'O'],
                memo: '드럼 4카운트 후 바로 진입. 밝고 힘 있게.',
            },
            {
                kind: 'song', id: 'd1018-2', title: '예수 열방의 소망', artist: 'CCM',
                originalKey: 'G', key: 'A', bpm: 112, minutes: 4,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
                memo: '1절은 어쿠스틱 기타만, 후렴부터 풀밴드.',
            },
            {
                kind: 'moment', id: 'd1018-m1', moment: 'prayer', label: '인도자 기도', minutes: 2,
                detail: '피아노 E 패드 유지, 다음 곡 Key로 자연스럽게 연결',
            },
            {
                kind: 'song', id: 'd1018-3', title: '믿음으로 서리라', artist: '주일 2부팀',
                originalKey: 'D', key: 'E', bpm: 72, minutes: 5,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'B', 'C', 'O'],
                memo: '브릿지 2회 반복, 두 번째는 빌드업.',
            },
            {
                kind: 'song', id: 'd1018-4', title: '주님의 은혜', artist: '주일 2부팀',
                originalKey: 'G', key: 'G', bpm: 68, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'Tag'],
            },
            {
                kind: 'song', id: 'd1018-5', title: '내 영혼이 은총 입어', artist: '찬송가',
                originalKey: 'F', key: 'G', bpm: 64, minutes: 4,
                form: ['I', 'V1', 'C', 'V2', 'C', 'V3', 'C'],
                memo: '3절은 무반주 회중 찬양.',
            },
            {
                kind: 'moment', id: 'd1018-m2', moment: 'word', label: '말씀 연결 · 대표 기도', minutes: 3,
                detail: '건반만 잔잔하게, 기도 끝나면 Intro 바로',
            },
            {
                kind: 'song', id: 'd1018-6', title: '보내소서', artist: '주일 2부팀',
                originalKey: 'A', key: 'A', bpm: 76, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'C', 'O'],
                memo: '후렴 2회 반복 후 엔딩 리타르단도.',
            },
        ],
    },
    {
        id: 'draft-1023',
        title: '금요 기도회',
        theme: '회복의 시간',
        date: '2026-10-23',
        time: '20:30',
        leader: '이소망',
        status: 'draft',
        readiness: { sheets: [3, 4], forms: [2, 4], members: [2, 5] },
        items: [
            {
                kind: 'song', id: 'd1023-1', title: '주 품에', artist: 'CCM',
                originalKey: 'E', key: 'D', bpm: 70, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C'],
            },
            {
                kind: 'song', id: 'd1023-2', title: '시선', artist: 'CCM',
                originalKey: 'A', key: 'A', bpm: 66, minutes: 5,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
            },
            {
                kind: 'moment', id: 'd1023-m1', moment: 'prayer', label: '통성 기도', minutes: 8,
                detail: '건반 패드만, 인도자 사인 후 다음 곡',
            },
            {
                kind: 'song', id: 'd1023-3', title: '은혜', artist: 'CCM',
                originalKey: 'D', key: 'D', bpm: 64, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1023-4', title: '나의 갈 길 다 가도록', artist: '찬송가',
                originalKey: 'F', key: 'F', bpm: 72, minutes: 4,
                form: ['V1', 'V2', 'V3', 'V3'],
            },
        ],
    },
    {
        id: 'draft-1025',
        title: '주일 2부 예배',
        theme: '감사의 노래',
        date: '2026-10-25',
        time: '11:00',
        leader: '김찬양',
        status: 'draft',
        readiness: { sheets: [2, 3], forms: [1, 3], members: [0, 7] },
        items: [
            {
                kind: 'song', id: 'd1025-1', title: '감사함으로 그 문에 들어가며', artist: 'CCM',
                originalKey: 'D', key: 'D', bpm: 124, minutes: 4,
                form: ['I', 'V1', 'C', 'V2', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1025-2', title: '주님 다시 오실 때까지', artist: 'CCM',
                originalKey: 'G', key: 'G', bpm: 84, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C'],
            },
            {
                kind: 'song', id: 'd1025-3', title: '은혜', artist: 'CCM',
                originalKey: 'D', key: 'D', bpm: 64, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
            },
        ],
    },
    {
        id: 'draft-1011',
        title: '주일 2부 예배',
        theme: '부르심',
        date: '2026-10-11',
        time: '11:00',
        leader: '김찬양',
        status: 'done',
        readiness: { sheets: [5, 5], forms: [5, 5], members: [7, 7] },
        items: [
            {
                kind: 'song', id: 'd1011-1', title: '예수 열방의 소망', artist: 'CCM',
                originalKey: 'G', key: 'G', bpm: 112, minutes: 4,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1011-2', title: '주님의 은혜', artist: '주일 2부팀',
                originalKey: 'G', key: 'G', bpm: 68, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C'],
            },
            {
                kind: 'song', id: 'd1011-3', title: '시선', artist: 'CCM',
                originalKey: 'A', key: 'A', bpm: 66, minutes: 5,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1011-4', title: '보내소서', artist: '주일 2부팀',
                originalKey: 'A', key: 'A', bpm: 76, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
            },
        ],
    },
    {
        id: 'draft-1004',
        title: '주일 2부 예배',
        theme: '은혜의 강',
        date: '2026-10-04',
        time: '11:00',
        leader: '박은혜',
        status: 'done',
        readiness: { sheets: [4, 4], forms: [4, 4], members: [6, 7] },
        items: [
            {
                kind: 'song', id: 'd1004-1', title: '주 품에', artist: 'CCM',
                originalKey: 'E', key: 'E', bpm: 70, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C'],
            },
            {
                kind: 'song', id: 'd1004-2', title: '은혜', artist: 'CCM',
                originalKey: 'D', key: 'D', bpm: 64, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1004-3', title: '믿음으로 서리라', artist: '주일 2부팀',
                originalKey: 'D', key: 'D', bpm: 72, minutes: 5,
                form: ['I', 'V1', 'PC', 'C', 'V2', 'PC', 'C', 'B', 'C', 'O'],
            },
            {
                kind: 'song', id: 'd1004-4', title: '보내소서', artist: '주일 2부팀',
                originalKey: 'A', key: 'A', bpm: 76, minutes: 5,
                form: ['I', 'V1', 'C', 'V2', 'C', 'B', 'C', 'O'],
            },
        ],
    },
];

export const PRIMARY_SETLIST_ID = 'draft-1018';

export const STATUS_META: Record<DraftStatus, { label: string; variant: 'success' | 'warning' | 'subtle' }> = {
    confirmed: { label: '확정', variant: 'success' },
    draft: { label: '작성 중', variant: 'warning' },
    done: { label: '완료', variant: 'subtle' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toUtcDay(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function dayDiff(date: string): number {
    return toUtcDay(date) - toUtcDay(DRAFT_TODAY);
}

export function dDayLabel(date: string): string {
    const diff = dayDiff(date);
    if (diff === 0) return 'D-DAY';
    return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export function dateParts(date: string) {
    const [y, m, d] = date.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { year: y, month: m, day: d, weekday };
}

export function formatTimeLabel(time: string): string {
    const [h, min] = time.split(':').map(Number);
    const period = h < 12 ? '오전' : '오후';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${period} ${hour}시${min ? ` ${min}분` : ''}`;
}

export function formatDateLabel(setlist: Pick<DraftSetlist, 'date' | 'time'>): string {
    const { month, day, weekday } = dateParts(setlist.date);
    return `${month}월 ${day}일 (${weekday}) ${formatTimeLabel(setlist.time)}`;
}

export function shortDate(date: string): string {
    const { month, day, weekday } = dateParts(date);
    return `${month}/${day} ${weekday}`;
}

export function songsOf(items: DraftItem[]): DraftSong[] {
    return items.filter((item): item is DraftSong => item.kind === 'song');
}

/** 순서 항목별 곡 번호. 기도·멘트 같은 순서는 null입니다. */
export function songNumbers(items: DraftItem[]): (number | null)[] {
    let count = 0;
    return items.map((item) => (item.kind === 'song' ? ++count : null));
}

export function totalMinutes(items: DraftItem[]): number {
    return items.reduce((sum, item) => sum + item.minutes, 0);
}

/** 각 순서 항목의 시작 시각(HH:mm)을 누적 길이로 계산합니다. */
export function startTimes(items: DraftItem[], start: string): string[] {
    const [h, m] = start.split(':').map(Number);
    let cursor = h * 60 + m;
    return items.map((item) => {
        const label = clockLabel(cursor);
        cursor += item.minutes;
        return label;
    });
}

export function clockLabel(totalMinutesOfDay: number): string {
    const h = Math.floor(totalMinutesOfDay / 60) % 24;
    const m = totalMinutesOfDay % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function upcomingSetlists(setlists: DraftSetlist[]): DraftSetlist[] {
    return setlists.filter((s) => dayDiff(s.date) >= 0).sort((a, b) => dayDiff(a.date) - dayDiff(b.date));
}

export function pastSetlists(setlists: DraftSetlist[]): DraftSetlist[] {
    return setlists.filter((s) => dayDiff(s.date) < 0).sort((a, b) => dayDiff(b.date) - dayDiff(a.date));
}

export function moveItem<T>(list: T[], index: number, offset: number): T[] {
    const target = index + offset;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function sectionTone(code: string): 'chorus' | 'bridge' | 'plain' {
    if (code === 'C' || code === 'Tag') return 'chorus';
    if (code === 'B') return 'bridge';
    return 'plain';
}
