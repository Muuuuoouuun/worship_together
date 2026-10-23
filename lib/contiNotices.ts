import { isPlaceholderMember, type TeamMember } from '../types/team';
import { planningDate, type PlanningNotification, type PlanningState } from '../types/planning';
import { eventsForSetlist, linkableFromLibrary } from './serviceLink';

/*
 * 콘티 확정 · 변경 알림. 팀 공유 자료(콘티 세부 · 곡 보관함)가 저장될 때 서버가 부릅니다.
 * - 콘티를 '확정' 으로 바꾸면 → 그 콘티를 준비하는 일정(예배 · 연습)에 배치된 사람에게 "콘티가 확정됐어요"
 * - 확정된 콘티의 곡 순서 · Key · BPM · 메모가 바뀌면 → 같은 사람에게 "확정된 콘티가 바뀌었어요" (콘티마다 10분에 한 번)
 * 작성 중인 콘티의 변경과 코멘트만 더한 저장은 알리지 않습니다(코멘트는 팀 소식에 따로 보임).
 * 그 콘티를 준비하는 일정이나 배치된 사람이 없으면 팀 전체에 알립니다.
 */

export const CONTI_CONFIRMED_TITLE = '콘티가 확정됐어요';
export const CONTI_CHANGED_TITLE = '확정된 콘티가 바뀌었어요';
const CHANGE_GAP_MS = 10 * 60 * 1000;

interface LibraryDoc {
    songs?: { id: string; title: string }[];
    setlists?: { id: string; title: string; worship_date: string; song_order: string[] }[];
}
interface DetailsDoc {
    status?: string;
    overrides?: Record<string, unknown>;
    owner?: string | null;
}

export interface ContiNotice {
    setlistId: string;
    title: string;
    body: string;
    recipientIds: string[];
}

export interface ContiNoticeInput {
    /** 'setlist-details' 면 setlistId 가 있어야 합니다 */
    kind: 'setlist-details' | 'library';
    setlistId?: string;
    before: string | null;
    after: string;
    /** 이 팀의 곡 보관함 (지금 저장한 것이 곡 보관함이면 after 와 같음) */
    library: string | null;
    /** setlistId → 콘티 세부 문서 (곡 보관함이 바뀌었을 때 확정 여부를 봅니다) */
    detailsOf: (setlistId: string) => string | null;
    planning: PlanningState;
    members: TeamMember[];
    editor: { id: string; name: string };
    now?: Date;
}

const parse = <T,>(json: string | null): T | null => {
    if (!json) return null;
    try { return JSON.parse(json) as T; } catch { return null; }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 그 콘티를 준비하는 일정에 배치된 사람 (불참 · 미가입 · 고친 사람 제외). 없으면 팀 전체 */
function recipientsFor(setlistId: string, input: ContiNoticeInput, library: LibraryDoc | null): string[] {
    const linkable = (library?.setlists ?? []).map(linkableFromLibrary);
    const reachable = (id: string) => id !== input.editor.id && !isPlaceholderMember(id) && input.members.some((member) => member.userId === id);
    const serving = eventsForSetlist(setlistId, input.planning.events, linkable)
        .flatMap((event) => event.slots.filter((slot) => slot.memberId && slot.attendance !== 'absent').map((slot) => slot.memberId!))
        .filter(reachable);
    const unique = [...new Set(serving)];
    return unique.length ? unique : input.members.map((member) => member.userId).filter(reachable);
}

function describe(setlistId: string, library: LibraryDoc | null): { title: string; when: string; songs: number } {
    const setlist = library?.setlists?.find((item) => item.id === setlistId);
    return { title: setlist?.title ?? '콘티', when: setlist ? planningDate(setlist.worship_date) : '', songs: setlist?.song_order.length ?? 0 };
}

function recentlyNotified(input: ContiNoticeInput, setlistId: string): boolean {
    const now = (input.now ?? new Date()).getTime();
    return input.planning.notifications.some((item: PlanningNotification) => item.entityId === setlistId && item.title === CONTI_CHANGED_TITLE && now - Date.parse(item.createdAt) < CHANGE_GAP_MS);
}

export function contiNotices(input: ContiNoticeInput): ContiNotice[] {
    const library = parse<LibraryDoc>(input.library);
    const notice = (setlistId: string, title: string, detail: string): ContiNotice | null => {
        const info = describe(setlistId, library);
        const recipientIds = recipientsFor(setlistId, input, library);
        if (!recipientIds.length) return null;
        const body = [input.editor.name, info.title, info.when, detail].filter(Boolean).join(' · ');
        return { setlistId, title, body, recipientIds };
    };

    if (input.kind === 'setlist-details' && input.setlistId) {
        const before = parse<DetailsDoc>(input.before);
        const after = parse<DetailsDoc>(input.after);
        if (!after) return [];
        const wasConfirmed = before?.status === 'confirmed';
        if (after.status === 'confirmed' && !wasConfirmed) {
            const info = describe(input.setlistId, library);
            const item = notice(input.setlistId, CONTI_CONFIRMED_TITLE, info.songs ? `${info.songs}곡 · 곡 순서와 Key를 확인해 주세요` : '곡 순서와 Key를 확인해 주세요');
            return item ? [item] : [];
        }
        if (after.status === 'confirmed' && wasConfirmed && !same(before?.overrides, after.overrides) && !recentlyNotified(input, input.setlistId)) {
            const item = notice(input.setlistId, CONTI_CHANGED_TITLE, 'Key · BPM · 메모가 바뀌었어요');
            return item ? [item] : [];
        }
        return [];
    }

    if (input.kind === 'library') {
        const before = parse<LibraryDoc>(input.before);
        const after = parse<LibraryDoc>(input.after);
        if (!before || !after) return [];
        return (after.setlists ?? []).flatMap((setlist) => {
            const previous = before.setlists?.find((item) => item.id === setlist.id);
            if (!previous) return [];
            const changed = !same(previous.song_order, setlist.song_order) || previous.worship_date !== setlist.worship_date || previous.title !== setlist.title;
            if (!changed || parse<DetailsDoc>(input.detailsOf(setlist.id))?.status !== 'confirmed' || recentlyNotified(input, setlist.id)) return [];
            const what = !same(previous.song_order, setlist.song_order) ? '곡 순서가 바뀌었어요' : previous.worship_date !== setlist.worship_date ? '예배 날짜 · 시간이 바뀌었어요' : '콘티 제목이 바뀌었어요';
            const item = notice(setlist.id, CONTI_CHANGED_TITLE, what);
            return item ? [item] : [];
        });
    }
    return [];
}
