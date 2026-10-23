import { planningDay, planningTime, type TeamSchedule } from '../types/planning';

/*
 * 일정 ↔ 콘티 연결 규칙. 서버(콘티 알림 받는 사람 찾기)와 화면(내 일정에서 콘티로 가기)이 같은 규칙을 씁니다.
 * - 일정에서 콘티를 직접 골랐으면(setlistId) 그 콘티
 * - 예배 일정: 같은 날(한국 시간)의 콘티, 여러 개면 시각이 가장 가까운 것
 * - 연습 일정: 그날부터 7일 안에 있는 가장 가까운 예배의 콘티 (토요일 연습 → 주일 콘티)
 */

export interface LinkableSetlist {
    id: string;
    /** YYYY-MM-DD (한국 시간) */
    day: string;
    /** HH:mm (한국 시간). 모르면 빈 문자열 */
    time: string;
}

export type LinkableEvent = Pick<TeamSchedule, 'kind' | 'startsAt' | 'cancelled'> & { setlistId?: string | null };

const REHEARSAL_WINDOW_DAYS = 7;

const minutesOf = (time: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/** 브라우저 저장소 · 서버 문서의 콘티(worship_date ISO)를 연결용 모양으로 */
export function linkableFromLibrary(setlist: { id: string; worship_date: string }): LinkableSetlist {
    return { id: setlist.id, day: planningDay(setlist.worship_date), time: planningTime(setlist.worship_date) };
}

/** 이 일정이 준비하는 콘티의 id (없으면 null) */
export function linkedSetlistId(event: LinkableEvent, setlists: readonly LinkableSetlist[]): string | null {
    if (event.cancelled) return null;
    if (event.setlistId && setlists.some((item) => item.id === event.setlistId)) return event.setlistId;
    const day = planningDay(event.startsAt);
    const start = minutesOf(planningTime(event.startsAt));
    if (event.kind === 'worship') {
        const sameDay = setlists.filter((item) => item.day === day);
        if (sameDay.length <= 1) return sameDay[0]?.id ?? null;
        const gap = (item: LinkableSetlist) => {
            const at = minutesOf(item.time);
            return at === null || start === null ? Number.MAX_SAFE_INTEGER : Math.abs(at - start);
        };
        return [...sameDay].sort((a, b) => gap(a) - gap(b))[0].id;
    }
    const from = dayIndex(day);
    const ahead = setlists
        .map((item) => ({ item, offset: dayIndex(item.day) - from }))
        .filter(({ offset }) => offset >= 0 && offset <= REHEARSAL_WINDOW_DAYS)
        .sort((a, b) => a.offset - b.offset || (minutesOf(a.item.time) ?? 0) - (minutesOf(b.item.time) ?? 0));
    return ahead[0]?.item.id ?? null;
}

/** 이 콘티를 준비하는 일정들 (예배 + 연습) */
export function eventsForSetlist<T extends LinkableEvent>(setlistId: string, events: readonly T[], setlists: readonly LinkableSetlist[]): T[] {
    return events.filter((event) => linkedSetlistId(event, setlists) === setlistId);
}

export interface LibrarySetlistSummary {
    id: string;
    title: string;
    worship_date: string;
    /** 곡 제목 (순서대로) */
    songs: string[];
}

/** 곡 보관함(브라우저 저장소 · 서버 문서)에서 콘티 요약을 만듭니다. */
export function summarizeLibrary(library: { songs: { id: string; title: string }[]; setlists: { id: string; title: string; worship_date: string; song_order: string[] }[] } | null): LibrarySetlistSummary[] {
    if (!library) return [];
    const titles = new Map(library.songs.map((song) => [song.id, song.title]));
    return library.setlists.map((setlist) => ({
        id: setlist.id,
        title: setlist.title,
        worship_date: setlist.worship_date,
        songs: setlist.song_order.map((id) => titles.get(id)).filter((title): title is string => Boolean(title)),
    }));
}

/**
 * 화면에 보여 줄 일정에 연결된 콘티를 채웁니다 (저장하지 않음).
 * 일정에 직접 적은 콘티 제목이 있으면 그대로 두고, 바로 가기용 id 만 붙입니다.
 */
export function withLinkedSetlists<T extends LinkableEvent & { setlistTitle?: string | null; setlistSongs?: string[] | null }>(events: readonly T[], library: readonly LibrarySetlistSummary[]): T[] {
    if (!library.length) return [...events];
    const linkable = library.map(linkableFromLibrary);
    return events.map((event) => {
        const id = linkedSetlistId(event, linkable);
        const setlist = id ? library.find((item) => item.id === id) : undefined;
        if (!setlist) return event;
        if (event.setlistTitle) return event.setlistId ? event : { ...event, setlistId: setlist.id };
        return { ...event, setlistId: setlist.id, setlistTitle: setlist.title, setlistSongs: setlist.songs };
    });
}
