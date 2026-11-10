import * as z from 'zod';
import { isPlaceholderMember, type TeamMember } from '../types/team';
import { planningDate, planningDay, planningTime, type PlanningNotification, type PlanningState, type SetlistRequest, type TeamSchedule } from '../types/planning';
import { eventsForSetlist, linkableFromLibrary, linkedSetlistId, type LinkableSetlist } from './serviceLink';

/*
 * 콘티 마감 알림 · 인도자에게 콘티 요청 (docs/setlist-deadline-notifications.md).
 * 서버(예약 알림 · 요청 규칙)와 화면(마감 카드 · 요청 버튼)이 같은 계산을 씁니다. 시각은 모두 한국 시간 기준입니다.
 *
 * - 마감: 예배일 이전의 가장 가까운 화요일 23:59 (팀 설정으로 바꿀 수 있고, 일정마다 따로 바꿀 수 있음)
 * - 마감을 지킨 것: 콘티 '확정'. 곡 제목만 먼저 올린 '초안'은 팀에 알림은 가지만 마감은 아직입니다.
 * - 밤 23:00–07:00 에 생긴 알림은 아침 7시에 보냅니다.
 */

export type DeadlineRule = { kind: 'weekday'; weekday: number; time: string } | { kind: 'daysBefore'; days: number; time: string };
export type ReminderKey = 'dayBefore' | 'threeHours' | 'oneHour';
export type DeadlineSettings = {
    /** 마감 알림 · 요청을 쓰는지 */
    enabled: boolean;
    rule: DeadlineRule;
    /** 마감 전 인도자에게 미리 알림 */
    reminders: ReminderKey[];
    /** 마감이 지나면 그 예배에 배치된 팀원에게도 알림 (꺼도 인도자에게는 갑니다) */
    notifyTeam: boolean;
    /** 마감 후 이 시간이 지나도 확정이 없으면 관리자에게 알림. 0 이면 끔 */
    escalateHours: number;
    /** 마감 전에도 팀원이 콘티를 요청할 수 있는지 */
    nudgeBeforeDeadline: boolean;
    /** 같은 팀원이 같은 예배 콘티를 다시 요청할 수 있는 간격 (인도자 알림도 이 간격으로 묶임) */
    nudgeCooldownHours: number;
    allowAnonymous: boolean;
    /** 밤 23:00–07:00 알림은 아침 7시에 */
    quietHours: boolean;
};

export const DEFAULT_DEADLINE_SETTINGS: DeadlineSettings = {
    enabled: true,
    rule: { kind: 'weekday', weekday: 2, time: '23:59' },
    reminders: ['dayBefore', 'threeHours'],
    notifyTeam: true,
    escalateHours: 12,
    nudgeBeforeDeadline: true,
    nudgeCooldownHours: 3,
    allowAnonymous: true,
    quietHours: true,
};

export const REMINDER_LABEL: Record<ReminderKey, string> = { dayBefore: '하루 전 21:00', threeHours: '3시간 전', oneHour: '1시간 전' };
export const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const deadlineSettingsSchema = z.object({
    enabled: z.boolean(),
    rule: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('weekday'), weekday: z.number().int().min(0).max(6), time }),
        z.object({ kind: z.literal('daysBefore'), days: z.number().int().min(1).max(7), time }),
    ]),
    reminders: z.array(z.enum(['dayBefore', 'threeHours', 'oneHour'])).max(3),
    notifyTeam: z.boolean(),
    escalateHours: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(24)]),
    nudgeBeforeDeadline: z.boolean(),
    nudgeCooldownHours: z.union([z.literal(1), z.literal(3), z.literal(6)]),
    allowAnonymous: z.boolean(),
    quietHours: z.boolean(),
});

/** 일정 상태에 저장된 설정 (없으면 기본값) */
export const deadlineSettingsOf = (state: Pick<PlanningState, 'deadline'>): DeadlineSettings => state.deadline?.settings ?? DEFAULT_DEADLINE_SETTINGS;

/* ───────────── 시각 계산 (한국 시간은 일광 절약 시간이 없어 +09:00 고정) ───────────── */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const kstInstant = (day: string, hhmm: string) => Date.parse(`${day}T${hhmm}:00+09:00`);
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** 예배일(YYYY-MM-DD) → 마감일. 요일 규칙은 예배일 '이전'의 가장 가까운 그 요일 (예배가 화요일이면 1주 전 화요일) */
export function deadlineDay(serviceDay: string, rule: DeadlineRule): string {
    if (rule.kind === 'daysBefore') return shiftDay(serviceDay, -rule.days);
    let day = shiftDay(serviceDay, -1);
    while (weekdayOf(day) !== rule.weekday) day = shiftDay(day, -1);
    return day;
}

/** 예배 시작 시각(ISO) → 마감 시각(ISO) */
export function deadlineAt(serviceAt: string, rule: DeadlineRule): string {
    return new Date(kstInstant(deadlineDay(planningDay(serviceAt), rule), rule.time)).toISOString();
}

/** 밤 23:00–07:00 이면 다음 07:00 (아니면 그대로) */
export function afterQuietHours(at: number): number {
    const iso = new Date(at).toISOString();
    const hour = Number(planningTime(iso).slice(0, 2));
    if (hour >= 7 && hour < 23) return at;
    const day = planningDay(iso);
    return kstInstant(hour >= 23 ? shiftDay(day, 1) : day, '07:00');
}

export const inQuietHours = (at: number) => afterQuietHours(at) !== at;

/** 남은 시간 · 지난 시간을 '1일 4시간' · '3시간' · '25분' 으로 */
export function spanText(ms: number): string {
    const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days) return hours ? `${days}일 ${hours}시간` : `${days}일`;
    if (hours) return `${hours}시간`;
    return `${minutes}분`;
}

/* ───────────── 마감 대상: 예배 일정 + (일정이 없는) 콘티 ───────────── */

export type DeadlineStatus = 'none' | 'writing' | 'draft' | 'confirmed';
export type DeadlineStage = 'before' | 'soon' | 'overdue' | 'met';

export interface DeadlineTarget {
    /** 'event:<일정 id>' 또는 일정 없이 만든 콘티는 'setlist:<콘티 id>' */
    key: string;
    title: string;
    serviceAt: string;
    eventId: string | null;
    setlistId: string | null;
    setlistTitle: string | null;
    /** 콘티 담당(이름이 팀원과 같을 때) > 예배 인도 자리. 모르면 null (관리자 · 인도자 전체가 받음) */
    leaderId: string | null;
    /** 그 예배를 준비하는 일정(예배 · 연습)에 배치된 사람 (불참 제외) */
    assignedIds: string[];
    status: DeadlineStatus;
    songCount: number;
    deadlineAt: string;
}

export interface LibrarySetlistLike { id: string; title: string; worship_date: string; song_order?: string[] }
export interface SetlistDetailsLike { status?: string; owner?: string | null }

export interface DeadlineSources {
    events: readonly TeamSchedule[];
    setlists: readonly LibrarySetlistLike[];
    detailsOf: (setlistId: string) => SetlistDetailsLike | null;
    members: readonly TeamMember[];
    state: Pick<PlanningState, 'deadline'>;
}

const statusOf = (setlist: LibrarySetlistLike | undefined, details: SetlistDetailsLike | null): DeadlineStatus =>
    !setlist ? 'none' : details?.status === 'confirmed' ? 'confirmed' : details?.status === 'draft' ? 'draft' : 'writing';

export function deadlineTargets(sources: DeadlineSources): DeadlineTarget[] {
    const settings = deadlineSettingsOf(sources.state);
    const overrides = sources.state.deadline?.overrides ?? [];
    const linkable: LinkableSetlist[] = sources.setlists.map(linkableFromLibrary);
    const isMember = (id: string | null | undefined): id is string => Boolean(id) && !isPlaceholderMember(id!) && sources.members.some((member) => member.userId === id);
    const serving = (events: readonly TeamSchedule[]) => [...new Set(events.flatMap((event) => event.slots.filter((slot) => slot.memberId && slot.attendance !== 'absent').map((slot) => slot.memberId!)))].filter(isMember);
    const deadlineFor = (key: string, serviceAt: string) => overrides.find((item) => item.key === key)?.at ?? deadlineAt(serviceAt, settings.rule);
    /** 콘티 담당은 이름으로 적혀 있어(콘티 세부의 owner) 같은 이름의 팀원을 찾습니다. */
    const ownerId = (details: SetlistDetailsLike | null) => {
        const name = details?.owner?.trim();
        const found = name ? sources.members.filter((member) => member.name.trim() === name) : [];
        return found.length === 1 && isMember(found[0].userId) ? found[0].userId : null;
    };
    const targets: DeadlineTarget[] = [];
    const linkedSetlists = new Set<string>();

    for (const event of sources.events) {
        if (event.cancelled || event.kind !== 'worship') continue;
        const setlistId = linkedSetlistId(event, linkable);
        const setlist = setlistId ? sources.setlists.find((item) => item.id === setlistId) : undefined;
        if (setlistId) linkedSetlists.add(setlistId);
        const details = setlistId ? sources.detailsOf(setlistId) : null;
        const preparing = setlistId ? eventsForSetlist(setlistId, sources.events.filter((item) => !item.cancelled), linkable) : [event];
        const leaderSlot = event.slots.find((slot) => slot.role === 'leader' && slot.attendance !== 'absent' && isMember(slot.memberId));
        const key = `event:${event.id}`;
        targets.push({
            key,
            title: event.title,
            serviceAt: event.startsAt,
            eventId: event.id,
            setlistId: setlistId ?? null,
            setlistTitle: setlist?.title ?? null,
            leaderId: ownerId(details) ?? leaderSlot?.memberId ?? null,
            assignedIds: serving(preparing.length ? preparing : [event]),
            status: statusOf(setlist, details),
            songCount: setlist?.song_order?.length ?? 0,
            deadlineAt: deadlineFor(key, event.startsAt),
        });
    }
    for (const setlist of sources.setlists) {
        if (linkedSetlists.has(setlist.id)) continue;
        const details = sources.detailsOf(setlist.id);
        const key = `setlist:${setlist.id}`;
        targets.push({
            key,
            title: setlist.title || '예배',
            serviceAt: setlist.worship_date,
            eventId: null,
            setlistId: setlist.id,
            setlistTitle: setlist.title,
            leaderId: ownerId(details),
            assignedIds: serving(eventsForSetlist(setlist.id, sources.events.filter((item) => !item.cancelled), linkable)),
            status: statusOf(setlist, details),
            songCount: setlist.song_order?.length ?? 0,
            deadlineAt: deadlineFor(key, setlist.worship_date),
        });
    }
    return targets.sort((a, b) => Date.parse(a.serviceAt) - Date.parse(b.serviceAt));
}

/** 마감 단계: 확정 → met, 마감 전 3시간 안 → soon, 지남 → overdue */
export function deadlineStage(target: Pick<DeadlineTarget, 'status' | 'deadlineAt'>, now: number): DeadlineStage {
    if (target.status === 'confirmed') return 'met';
    const left = Date.parse(target.deadlineAt) - now;
    return left <= 0 ? 'overdue' : left <= 3 * HOUR ? 'soon' : 'before';
}

/* ───────────── 요청(독촉) · 예정 시간 ───────────── */

/** 이 예배 콘티에 대한 열린 요청 */
export const openNudges = (state: Pick<PlanningState, 'requests'>, key: string): SetlistRequest[] =>
    state.requests.filter((request) => request.deadlineKey === key && request.status !== 'resolved');

/** 인도자가 알려준 예정 시간 (지났으면 없음) */
export function activeEta(state: Pick<PlanningState, 'deadline'>, key: string, now: number) {
    const eta = state.deadline?.etas?.find((item) => item.key === key);
    return eta && Date.parse(eta.until) > now ? eta : null;
}

/** 이 팀원이 다시 요청할 수 있는 시각 (지금 가능하면 null) */
export function nudgeAvailableAt(state: Pick<PlanningState, 'requests' | 'deadline'>, key: string, userId: string, now: number): number | null {
    const gap = deadlineSettingsOf(state).nudgeCooldownHours * HOUR;
    const last = openNudges(state, key).filter((request) => request.authorId === userId).map((request) => Date.parse(request.createdAt)).sort((a, b) => b - a)[0];
    return last !== undefined && now - last < gap ? last + gap : null;
}

/** 인도자 알림 제목: '윤사랑님이 …' · '서하늘님 외 2명이 …' · 이름을 숨긴 요청만 있으면 '팀원 2명이 …' (최근 요청한 사람이 앞) */
export function nudgeTitle(nudges: readonly SetlistRequest[], members: readonly TeamMember[]): string {
    const latest = [...nudges].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const people = new Set(latest.map((request) => request.authorId)).size;
    const named = latest.find((request) => !request.anonymous);
    const name = named ? members.find((member) => member.userId === named.authorId)?.name : undefined;
    if (!name) return `팀원 ${Math.max(1, people)}명이 콘티를 요청했어요`;
    return people > 1 ? `${name}님 외 ${people - 1}명이 콘티를 요청했어요` : `${name}님이 콘티를 요청했어요`;
}

/* ───────────── 예약 알림 (서버가 1분마다 확인) ───────────── */

export type DeadlineNoticeKind = ReminderKey | 'overdue' | 'overdueTeam' | 'escalate';
export interface DueDeadlineNotice {
    logId: string;
    title: string;
    body: string;
    urgent: boolean;
    recipientIds: string[];
    target: PlanningNotification['target'];
    entityId: string;
}

/** 이 시각이 지나면 보내고, 다음 단계가 오면 늦은 알림은 건너뜁니다. */
function reminderWindow(kind: DeadlineNoticeKind, target: DeadlineTarget, settings: DeadlineSettings): { at: number; until: number } {
    const deadline = Date.parse(target.deadlineAt);
    const service = Date.parse(target.serviceAt);
    const quiet = (at: number) => (settings.quietHours ? afterQuietHours(at) : at);
    switch (kind) {
        case 'dayBefore': return { at: quiet(kstInstant(shiftDay(planningDay(target.deadlineAt), -1), '21:00')), until: deadline - 3 * HOUR };
        case 'threeHours': return { at: quiet(deadline - 3 * HOUR), until: deadline - HOUR };
        case 'oneHour': return { at: quiet(deadline - HOUR), until: deadline };
        case 'overdue': case 'overdueTeam': return { at: quiet(deadline), until: service };
        case 'escalate': return { at: quiet(deadline + settings.escalateHours * HOUR), until: service };
    }
}

/**
 * 지금 보내야 할 마감 알림. 이미 보낸 것(log)과 확정된 콘티, 인도자가 예정 시간을 알려 둔 동안은 빼고 돌려줍니다.
 * logId 에 마감 시각을 넣어, 일정마다 마감을 바꾸면 새 마감 기준으로 다시 알립니다.
 */
export function dueDeadlineNotices(input: DeadlineSources & { state: Pick<PlanningState, 'deadline' | 'requests'>; now: number; managerIds: readonly string[]; leaderIds: readonly string[] }): DueDeadlineNotice[] {
    const settings = deadlineSettingsOf(input.state);
    if (!settings.enabled) return [];
    const sent = new Set((input.state.deadline?.log ?? []).map((item) => item.id));
    const result: DueDeadlineNotice[] = [];
    for (const target of deadlineTargets(input)) {
        if (target.status === 'confirmed' || Date.parse(target.serviceAt) <= input.now) continue;
        if (activeEta(input.state, target.key, input.now)) continue;
        const leaders = target.leaderId ? [target.leaderId] : [...input.leaderIds];
        const when = planningDate(target.serviceAt);
        const deadlineText = planningDate(target.deadlineAt);
        const waiting = openNudges(input.state, target.key).length;
        const draft = target.status === 'draft' ? ' 초안은 올라와 있어요.' : '';
        const kinds: DeadlineNoticeKind[] = [...settings.reminders, 'overdue', ...(settings.notifyTeam ? ['overdueTeam' as const] : []), ...(settings.escalateHours ? ['escalate' as const] : [])];
        for (const kind of kinds) {
            const logId = `${target.key}|${kind}|${target.deadlineAt}`;
            if (sent.has(logId)) continue;
            const window = reminderWindow(kind, target, settings);
            if (input.now < window.at || input.now >= window.until) continue;
            const entity = { target: 'deadline' as const, entityId: target.key };
            const push = (title: string, body: string, recipientIds: readonly string[], urgent = false) => {
                const recipients = [...new Set(recipientIds)].filter((id) => !isPlaceholderMember(id) && input.members.some((member) => member.userId === id));
                if (recipients.length) result.push({ logId, title, body, urgent, recipientIds: recipients, ...entity });
            };
            const head = `${target.title} · ${when}`;
            if (kind === 'dayBefore') push('콘티 마감 하루 전이에요', `${head} 콘티를 ${deadlineText}까지 확정해 주세요.${draft}`, leaders);
            if (kind === 'threeHours') push('콘티 마감 3시간 전이에요', `${head} · 곡 제목만 먼저 올려도 팀원들이 연습을 시작할 수 있어요.${draft}`, leaders);
            if (kind === 'oneHour') push('콘티 마감 1시간 전이에요', `${head} · ${deadlineText} 마감`, leaders);
            if (kind === 'overdue') push('콘티 마감이 지났어요', `${head}${waiting ? ` · 팀원 ${waiting}명이 기다리고 있어요` : ''}. 예정 시간을 알려주면 팀원들이 덜 기다려요.${draft}`, leaders, true);
            if (kind === 'overdueTeam') push(target.status === 'draft' ? '콘티 초안만 올라와 있어요' : '아직 콘티가 올라오지 않았어요', `${head} · 마감(${deadlineText})이 지났어요. 인도자에게 요청할 수 있어요.`, target.assignedIds.filter((id) => !leaders.includes(id)));
            if (kind === 'escalate') push(`콘티 미확정 ${settings.escalateHours}시간이 지났어요`, `${head}${target.leaderId ? ` · 담당 ${input.members.find((member) => member.userId === target.leaderId)?.name ?? ''}` : ''}${waiting ? ` · 팀원 요청 ${waiting}건` : ''}. 인도자와 연락해 주세요.`, input.managerIds.filter((id) => !leaders.includes(id)), true);
        }
    }
    return result;
}

/** 다음 일요일 같은 화면 기본 대상: 아직 지나지 않은 가장 가까운 예배 */
export function nextTarget(targets: readonly DeadlineTarget[], now: number): DeadlineTarget | null {
    return targets.find((target) => Date.parse(target.serviceAt) > now) ?? null;
}

/** 이름을 숨긴 요청의 작성자 자리 (화면에 내려갈 때 실제 작성자 대신) */
export const ANONYMOUS_AUTHOR = 'anonymous';

export const nudgePresets = ['콘티 언제쯤 올라올까요?', '미리 연습하고 싶어요', '곡 제목만 먼저 알려주셔도 좋아요', 'Key와 BPM이 궁금해요'] as const;
