/**
 * 콘티·악보 화면의 공통 모델과 도우미.
 * 실제 저장 데이터(곡 보관함)와 시안용 목업 데이터가 모두 이 형태로 변환되어 화면에 전달됩니다.
 */

export type ScreenId = 'week' | 'conti' | 'order' | 'team' | 'requests' | 'alerts';
export type Tone = 'sky' | 'mint' | 'peach' | 'lilac' | 'sand';
export type SetlistStatus = 'done' | 'confirmed' | 'writing' | 'empty';
export type LinkKind = 'video' | 'sheet' | 'mr' | 'other';

export interface SongLink {
    kind: LinkKind;
    label: string;
    url?: string;
    /** 새로 올라온 자료 표시 */
    fresh?: boolean;
}

export interface SongComment {
    id?: string;
    author: string;
    text: string;
    ago: string;
}

export interface ContiSong {
    kind: 'song';
    /** 순서 안에서의 고유 키 (같은 곡이 두 번 들어가도 구분) */
    id: string;
    /** 곡 보관함의 곡 id */
    songId: string;
    title: string;
    artist: string | null;
    originalKey: string;
    key: string;
    bpm: number | null;
    lead: string | null;
    /** 송폼 진행 순서 코드 (I, V1, C, B …). 반복되는 후렴도 각각 한 칸 */
    form: string[];
    links: SongLink[];
    /** 인도자가 정한 특이사항 */
    notes: string[];
    /** 이 곡에서 다음 곡으로 넘어갈 때의 메모 */
    transitionNote?: string | null;
    /** 팀원들이 남긴 코멘트 */
    comments: SongComment[];
}

export interface ContiMoment {
    kind: 'moment';
    id: string;
    moment: 'prayer' | 'word';
    title: string;
    memo?: string;
}

export type OrderItem = ContiSong | ContiMoment;

export interface ContiSetlist {
    id: string;
    /** 예배 날짜 YYYY-MM-DD (서울 기준) */
    date: string;
    /** HH:mm */
    time: string;
    /** 예배 이름 (콘티 제목) */
    service: string;
    theme: string;
    /** 콘티 담당자 이름 */
    owner: string | null;
    status: SetlistStatus;
    items: OrderItem[];
}

export const SECTION_NAMES: Record<string, string> = {
    I: 'Intro', V: 'Verse', V1: 'Verse 1', V2: 'Verse 2', V3: 'Verse 3', V4: 'Verse 4', PC: 'Pre-Chorus',
    C: 'Chorus', B: 'Bridge', Int: 'Interlude', Tag: 'Tag', O: 'Outro',
};

/** 송폼 편집 팔레트 순서 */
export const SECTION_PALETTE = ['I', 'V1', 'V2', 'V3', 'PC', 'C', 'B', 'Int', 'Tag', 'O'];

export const LINK_LABEL: Record<LinkKind, string> = { video: '원곡 영상', sheet: '악보', mr: 'MR', other: '링크' };

export const SETLIST_STATUS: Record<SetlistStatus, { label: string; dot: string; text: string }> = {
    done: { label: '완료', dot: 'bg-neutral-300 dark:bg-neutral-600', text: 'text-neutral-500 dark:text-neutral-400' },
    confirmed: { label: '확정', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    writing: { label: '작성 중', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    empty: { label: '미작성', dot: 'bg-neutral-300 dark:bg-neutral-600', text: 'text-neutral-500 dark:text-neutral-400' },
};

export function songsOf(items: OrderItem[]): ContiSong[] {
    return items.filter((item): item is ContiSong => item.kind === 'song');
}

export function commentsOf(items: OrderItem[]): SongComment[] {
    return songsOf(items).flatMap((item) => item.comments);
}

/** 화면 제목: 주제가 있으면 주제, 없으면 예배 이름 */
export function displayTitle(setlist: Pick<ContiSetlist, 'theme' | 'service'>): string {
    return setlist.theme.trim() || setlist.service;
}

/** 오늘 이후 가장 가까운 콘티 (없으면 null) */
export function upcomingSetlistId(setlists: ContiSetlist[], today: string): string | null {
    const next = setlists
        .filter((setlist) => setlist.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];
    return next?.id ?? null;
}

/* ───────────── 송폼 라벨 ↔ 코드 ───────────── */

const LABEL_RULES: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
    [/^(intro|인트로|전주)/i, 'I'],
    [/^(pre[\s-]?chorus|프리\s?코러스)/i, 'PC'],
    [/^(verse|v)\s*(\d)/i, (match) => `V${match[2]}`],
    [/^(\d)\s*절/, (match) => `V${match[1]}`],
    [/^(verse|절)$/i, 'V'],
    [/^(chorus|후렴|코러스)/i, 'C'],
    [/^(bridge|브릿지|브리지)/i, 'B'],
    [/^(interlude|간주)/i, 'Int'],
    [/^(tag|태그)/i, 'Tag'],
    [/^(outro|아웃트로|후주|엔딩|ending)/i, 'O'],
];

/** 송폼 섹션 이름을 화면용 짧은 코드로 바꿉니다. 모르는 이름은 앞 6글자를 그대로 씁니다. */
export function formCodeFromLabel(label: string): string {
    const text = label.trim();
    for (const [pattern, code] of LABEL_RULES) {
        const match = text.match(pattern);
        if (match) return typeof code === 'string' ? code : code(match);
    }
    return text.slice(0, 6);
}

/** 화면용 코드를 송폼 저장용 섹션 이름으로 되돌립니다. */
export function labelFromFormCode(code: string): string {
    return SECTION_NAMES[code] ?? code;
}

/* ───────────── 사람 ───────────── */

const TONES: Tone[] = ['mint', 'sky', 'lilac', 'sand', 'peach'];

/** 이름마다 항상 같은 색 */
export function toneForName(name: string): Tone {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return TONES[hash % TONES.length];
}

/** 아바타 글자: 한글 세 글자 이름은 성을 뺀 두 글자, 그 외에는 앞 두 글자 */
export function avatarLabel(name: string, short = false): string {
    const text = name.trim();
    const body = /^[가-힣]{3,4}$/.test(text) ? text.slice(1) : text.slice(0, 2);
    return short ? body.slice(0, 1) : body;
}

/* ───────────── 날짜 ───────────── */

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

export function yearOf(date: string): number {
    return parts(date).y;
}

export function addDays(date: string, days: number): string {
    return new Date(parts(date).utc + days * 86_400_000).toISOString().slice(0, 10);
}

export function diffDays(date: string, from: string): number {
    return Math.round((parts(date).utc - parts(from).utc) / 86_400_000);
}

export function dDay(date: string, today: string): string {
    const diff = diffDays(date, today);
    return diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** '10월 셋째 주' */
export function weekLabel(date: string): string {
    const { m, d } = parts(date);
    return `${m}월 ${ORDINALS[Math.floor((d - 1) / 7)]} 주`;
}

export function shortWeekLabel(date: string): string {
    return `${ORDINALS[Math.floor((dayOf(date) - 1) / 7)]} 주`;
}

export function md(date: string): string {
    const { m, d } = parts(date);
    return `${m}/${d}`;
}

/** 오늘이 일요일이면 오늘, 아니면 다가오는 일요일 */
export function nextSunday(today: string): string {
    const day = new Date(parts(today).utc).getUTCDay();
    return addDays(today, (7 - day) % 7);
}

/** 해당 날짜가 속한 주의 월~일 7일 (일요일로 끝남) */
export function weekDates(date: string): string[] {
    const sunday = nextSunday(date);
    return Array.from({ length: 7 }, (_, index) => addDays(sunday, index - 6));
}

/** 달력 그리드 (일요일 시작). 다른 달 칸은 null. */
export function monthGrid(year: number, month: number): (string | null)[] {
    const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1) {
        cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7) cells.push(null);
    return cells;
}

/** 형식 지정 자체를 캐시해 반복 변환 비용을 줄입니다. */
const seoulFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

/** ISO 시각 → 서울 기준 날짜(YYYY-MM-DD)·시각(HH:mm) */
export function seoulDateTime(iso: string | Date): { date: string; time: string } {
    const value = seoulFormatter.formatToParts(typeof iso === 'string' ? new Date(iso) : iso);
    const get = (type: Intl.DateTimeFormatPartTypes) => value.find((part) => part.type === type)?.value ?? '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function formatTimeLabel(time: string): string {
    const [h, min] = time.split(':').map(Number);
    const period = h < 12 ? '오전' : '오후';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${period} ${hour}:${String(min).padStart(2, '0')}`;
}

/** '방금', '5분 전', '3시간 전', '어제', '4일 전', '9/30' */
export function relativeTime(iso: string, now: Date): string {
    const then = new Date(iso);
    const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
    if (Number.isNaN(minutes)) return '';
    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = diffDays(seoulDateTime(now).date, seoulDateTime(then).date);
    if (days <= 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return md(seoulDateTime(then).date);
}
