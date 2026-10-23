/**
 * 일정·요청 화면의 저장 데이터(PlanningState)를 콘티·악보 화면이 쓰는 형태로 바꿉니다.
 * 순수 함수만 있어 서버·브라우저·테스트 어디서나 같은 결과를 냅니다.
 */

import { requestKinds, requestStatuses, type PlanningCommand, type PlanningNotification, type PlanningState, type SetlistRequest, type TeamSchedule, type UrgentAlert } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';
import { canHandleSlot, canManagePlanning, leadParts, type LeadPart } from '@/types/planning';
import { slotKeepers, substituteOptions, type SlotKeeper, type SubstituteOption } from '@/lib/planning';
import { DEFAULT_POLICY, type TeamPolicy } from '@/lib/permissions';
import { diffDays, relativeTime, seoulDateTime, type ContiSetlist } from './model';

export const ROLE_ORDER: WorshipRole[] = ['leader', 'vocal', 'keyboard', 'guitar', 'bass', 'drums', 'sound', 'media', 'member'];

/** 일정·요청 화면과 같은 불참 사유 프리셋 */
export const ABSENCE_REASONS = ['개인 사정', '시험/학업', '출장/야근', '가족 행사', '건강/컨디션'] as const;

export type AssignStatus = 'confirmed' | 'pending' | 'declined';

export interface PartAssignment {
    slotId: string;
    role: WorshipRole;
    roleLabel: string;
    memberId: string | null;
    memberName: string | null;
    /** 빈자리는 null */
    status: AssignStatus | null;
    /** 불참 사유 */
    note?: string;
    mine: boolean;
    /** 대체 인원을 찾는 중 (열린 긴급 요청이 있음) */
    substituteOpen: boolean;
    volunteers: {
        id: string;
        name: string;
        /** 아직 팀원인지 (팀을 나간 사람은 확정할 수 없습니다) */
        member: boolean;
        /** 지원한 뒤 같은 시간대의 다른 자리에 배치되어 지금은 확정할 수 없음 (그 일정이 취소되면 다시 확정할 수 있습니다) */
        placed: boolean;
    }[];
    invitedAt?: string;
    /** 보는 사람이 이 자리에 대체 지원할 수 있는지 (빈자리·불참·대체 모집 중이고, 같은 일정에 이미 배치되지 않음) */
    canVolunteer: boolean;
    volunteered: boolean;
    /** 보는 사람이 이 자리의 대체 요청·지원자 확정을 할 수 있는지 (관리자 또는 이 파트 담당) */
    canHandle: boolean;
    /** 결석·대체 알림을 받는 사람 (그 예배 인도자·파트 담당, 없으면 관리자). 대체가 필요한 자리만 채웁니다 */
    keepers: { id: string; name: string; label: string }[];
    /** 대체 부탁 현황: 부탁한 수, '이번엔 어려워요' 답한 사람 */
    asks: { asked: number; passedNames: string[] };
    /** 같은 역할의 다른 팀원. 설 수 있는 사람 먼저, 적게 선 순서. blocker 가 있으면 못 서는 이유 */
    options: { id: string; name: string; load: number; blocker: string | null }[];
}

export const KEEPER_LABEL: Record<SlotKeeper['as'], string> = { leader: '인도자', band: leadParts.band, vocal: leadParts.vocal, manager: '관리자' };
export const BLOCKER_LABEL: Record<NonNullable<SubstituteOption['blocker']>, string> = { assigned: '이 예배에 배치됨', blocked: '불가일', clash: '겹치는 일정' };

/** 팀 소식의 대체 부탁 카드에서 바로 응답하기 위한 자리 상태 */
export interface NoticeAsk {
    eventId: string;
    slotId: string;
    roleLabel: string;
    /** 아직 대체를 찾는 중인지 */
    open: boolean;
    canVolunteer: boolean;
    volunteered: boolean;
    passed: boolean;
    /** 다른 사람으로 채워졌으면 그 이름 */
    filledBy: string | null;
}

export interface PartLeadGroup {
    part: LeadPart;
    /** 악기장 · 싱어 담당 */
    label: string;
    /** 이 파트에 해당하는 역할 이름 */
    roles: string;
    members: { id: string; name: string }[];
}

export interface ServiceDay {
    eventId: string;
    date: string;
    time: string;
    endTime: string;
    title: string;
    place: string;
    setlistId: string | null;
    setlistTitle: string | null;
    assignments: PartAssignment[];
    counts: { total: number; confirmed: number; pending: number; declined: number; vacant: number };
}

export interface TeamEvent {
    id: string;
    date: string;
    start: string;
    end: string;
    kind: TeamSchedule['kind'];
    title: string;
    place: string;
    /** 참석 확정한 팀원 이름 */
    attendees: string[];
    assigned: number;
    expected: number;
}

export type RequestItemKind = keyof typeof requestKinds | 'substitute' | 'absence' | 'notice';

export interface RequestReply {
    id: string;
    author: string | null;
    text: string;
    ago: string;
    mine: boolean;
}

export interface RequestItem {
    id: string;
    source: 'request' | 'alert';
    kind: RequestItemKind;
    kindLabel: string;
    title: string;
    body: string;
    author: string | null;
    authorId: string;
    context: string;
    createdAt: string;
    ago: string;
    done: boolean;
    status: SetlistRequest['status'];
    /** 접수 · 확인 중 · 완료 (일정·요청 화면과 같은 이름) */
    statusLabel: string;
    replies: RequestReply[];
    mine: boolean;
    canReply: boolean;
    canResolve: boolean;
    /** 긴급 요청(결석·대체)일 때 */
    eventId?: string;
    slotId?: string | null;
    canVolunteer?: boolean;
    volunteered?: boolean;
}

export type NoticeKind = 'request' | 'reply' | 'invite' | 'accept' | 'decline' | 'substitute' | 'volunteer' | 'conti' | 'schedule' | 'rotation' | 'comment' | 'other';
export type NoticeCategory = 'conti' | 'team' | 'request';
export type NoticeGroup = '오늘' | '어제' | '이번 주' | '이전';

export interface Notice {
    id: string;
    kind: NoticeKind;
    category: NoticeCategory;
    actor: string | null;
    title: string;
    message: string;
    quote?: string;
    urgent: boolean;
    target: PlanningNotification['target'] | 'conti';
    entityId: string;
    createdAt: string;
    group: NoticeGroup;
    ago: string;
    unread: boolean;
    /** 보는 사람에게 온 대체 부탁이면 그 자리 */
    ask?: NoticeAsk;
}

export interface PlanningViewer {
    id: string;
    name: string;
    role: WorshipRole;
    canManage: boolean;
}

export interface PlanningActions {
    /** 일정·요청 화면과 같은 명령을 보냅니다. 성공하면 true. */
    dispatch: (command: PlanningCommand) => Promise<boolean>;
    /** 콘티 코멘트 소식을 읽음으로 표시합니다. */
    markFeedSeen: (at: string) => void;
}

export interface PlanningView {
    /** 아직 실제 데이터가 아닌 시안용 */
    sample: boolean;
    ready: boolean;
    busy: boolean;
    error: string;
    viewer: PlanningViewer | null;
    roster: { id: string; name: string; role: WorshipRole }[];
    /** 파트 담당 (결석 알림을 받고 대체 지원자를 확정) */
    partLeads: PartLeadGroup[];
    services: ServiceDay[];
    events: TeamEvent[];
    requests: RequestItem[];
    notices: Notice[];
    unreadCount: number;
    openRequestCount: number;
    actions: PlanningActions | null;
    /** 일정·요청 화면 주소 (관리 기능은 그곳에서) */
    planningHref: string;
}

export const EMPTY_PLANNING_VIEW: PlanningView = {
    sample: false,
    ready: false,
    busy: false,
    error: '',
    viewer: null,
    roster: [],
    partLeads: [],
    services: [],
    events: [],
    requests: [],
    notices: [],
    unreadCount: 0,
    openRequestCount: 0,
    actions: null,
    planningHref: '/dashboard/planning',
};

export interface BuildInput {
    state: PlanningState;
    members: TeamMember[];
    userId: string;
    today: string;
    now: Date;
    /** 팀 권한 설정 (없으면 기본값: 일정 관리는 관리자 · 인도자) */
    policy?: TeamPolicy;
    /** 콘티 코멘트를 팀 소식에 섞을 때 */
    setlists?: ContiSetlist[];
    /** 코멘트 소식을 읽은 시각 (ISO). 이보다 늦은 코멘트만 새 소식 */
    feedSeenAt?: string | null;
}

export type BuiltPlanning = Pick<PlanningView, 'viewer' | 'roster' | 'partLeads' | 'services' | 'events' | 'requests' | 'notices' | 'unreadCount' | 'openRequestCount'>;

/** 일정·요청 화면(SchedulePanel)과 같은 이름을 씁니다. */
const ALERT_KIND_LABEL: Record<UrgentAlert['kind'], string> = { absence: '불참 알림', substitute: '대체 인원 요청', notice: '긴급 공지' };

/** 저장값은 UTC('Z')와 '+09:00' 형식이 섞여 있어 문자열이 아니라 시각으로 정렬합니다. */
const byStart = (a: TeamSchedule, b: TeamSchedule) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export function buildPlanningView(input: BuildInput): BuiltPlanning {
    const { state, members, userId, today, now, policy = DEFAULT_POLICY } = input;
    const me = members.find((member) => member.userId === userId) ?? null;
    const nameOf = (id: string | null | undefined): string | null => members.find((member) => member.userId === id)?.name ?? null;
    const canManage = me ? canManagePlanning(members, userId, policy) : false;
    const owner = me?.permission === 'owner';
    const ago = (iso: string) => relativeTime(iso, now);

    const live = state.events.filter((event) => !event.cancelled);
    const openAlert = (eventId: string, slotId: string) => state.alerts.some((alert) => alert.eventId === eventId && alert.slotId === slotId && !alert.resolvedAt);
    /** 겹치는 시간의 다른 일정(또는 같은 일정의 다른 자리)에 이미 배치된 사람은 지원할 수 없습니다 (lib/planning 의 available 과 같은 규칙). */
    const overlaps = (a: TeamSchedule, b: TeamSchedule) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
    const placedElsewhere = (event: TeamSchedule, slot: TeamSchedule['slots'][number], memberId = userId) =>
        live.some((other) => overlaps(other, event) && other.slots.some((item) => item.id !== slot.id && item.memberId === memberId && item.attendance !== 'absent'));
    const canVolunteerFor = (event: TeamSchedule, slot: TeamSchedule['slots'][number]) =>
        Boolean(me) && slot.memberId !== userId && (!slot.memberId || slot.attendance === 'absent' || openAlert(event.id, slot.id)) && !placedElsewhere(event, slot);

    /** 대체가 필요한 자리(빈자리·불참·대체 모집 중)만 알림 대상과 대체 후보를 계산합니다. */
    const substituteView = (event: TeamSchedule, slot: TeamSchedule['slots'][number]): Pick<PartAssignment, 'keepers' | 'asks' | 'options'> => {
        const needs = !slot.memberId || slot.attendance === 'absent' || openAlert(event.id, slot.id);
        if (!needs) return { keepers: [], asks: { asked: 0, passedNames: [] }, options: [] };
        return {
            keepers: slotKeepers(state, members, event, slot, policy).map((keeper) => ({ id: keeper.memberId, name: nameOf(keeper.memberId) ?? '팀원', label: KEEPER_LABEL[keeper.as] })),
            asks: { asked: (slot.asked ?? []).length, passedNames: (slot.passed ?? []).map((id) => nameOf(id)).filter((name): name is string => name !== null) },
            options: substituteOptions(state, members, event, slot).map((option) => ({ id: option.memberId, name: nameOf(option.memberId) ?? '팀원', load: option.load, blocker: option.blocker ? BLOCKER_LABEL[option.blocker] : null })),
        };
    };

    const services: ServiceDay[] = live
        .filter((event) => event.kind === 'worship')
        .sort(byStart)
        .map((event) => {
            const { date, time } = seoulDateTime(event.startsAt);
            const assignments = [...event.slots]
                .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                .map((slot): PartAssignment => ({
                    slotId: slot.id,
                    role: slot.role,
                    roleLabel: worshipRoles[slot.role],
                    memberId: slot.memberId,
                    memberName: nameOf(slot.memberId),
                    status: slot.memberId ? (slot.attendance === 'absent' ? 'declined' : slot.attendance) : null,
                    note: slot.attendance === 'absent' && slot.declineReason ? slot.declineReason : undefined,
                    mine: Boolean(slot.memberId && slot.memberId === userId),
                    substituteOpen: openAlert(event.id, slot.id),
                    volunteers: slot.volunteers.map((id) => ({ id, name: nameOf(id) ?? '팀원', member: nameOf(id) !== null, placed: placedElsewhere(event, slot, id) })),
                    invitedAt: slot.invitedAt,
                    canVolunteer: canVolunteerFor(event, slot),
                    volunteered: slot.volunteers.includes(userId),
                    canHandle: Boolean(me) && canHandleSlot(state, members, userId, slot.role, policy),
                    ...substituteView(event, slot),
                }));
            return {
                eventId: event.id,
                date,
                time,
                endTime: seoulDateTime(event.endsAt).time,
                title: event.title,
                place: event.location,
                setlistId: event.setlistId ?? null,
                setlistTitle: event.setlistTitle ?? null,
                assignments,
                counts: {
                    total: assignments.length,
                    confirmed: assignments.filter((item) => item.status === 'confirmed').length,
                    pending: assignments.filter((item) => item.status === 'pending').length,
                    declined: assignments.filter((item) => item.status === 'declined').length,
                    vacant: assignments.filter((item) => item.status === null).length,
                },
            };
        });

    const events: TeamEvent[] = live
        .sort(byStart)
        .map((event) => {
            const start = seoulDateTime(event.startsAt);
            return {
                id: event.id,
                date: start.date,
                start: start.time,
                end: seoulDateTime(event.endsAt).time,
                kind: event.kind,
                title: event.title,
                place: event.location,
                attendees: event.slots.filter((slot) => slot.memberId && slot.attendance === 'confirmed').map((slot) => nameOf(slot.memberId) ?? '팀원'),
                assigned: event.slots.filter((slot) => slot.memberId).length,
                expected: event.slots.length,
            };
        });

    const requests: RequestItem[] = state.requests.map((request): RequestItem => {
        const canResolve = request.leaderId === userId || owner;
        return {
            id: request.id,
            source: 'request',
            kind: request.kind,
            kindLabel: requestKinds[request.kind],
            title: firstLine(request.body),
            body: request.body,
            author: nameOf(request.authorId),
            authorId: request.authorId,
            context: request.setlistTitle,
            createdAt: request.createdAt,
            ago: ago(request.createdAt),
            done: request.status === 'resolved',
            status: request.status,
            statusLabel: requestStatuses[request.status],
            replies: request.replies.map((reply) => ({ id: reply.id, author: nameOf(reply.authorId), text: reply.body, ago: ago(reply.createdAt), mine: reply.authorId === userId })),
            mine: request.authorId === userId,
            canReply: canResolve || request.authorId === userId,
            canResolve,
        };
    });

    const eventById = new Map(state.events.map((event) => [event.id, event]));
    const alertItems: RequestItem[] = state.alerts
        .filter((alert) => !alert.resolvedAt || diffDays(today, seoulDateTime(alert.resolvedAt).date) <= 14)
        .map((alert): RequestItem | null => {
            const event = eventById.get(alert.eventId);
            if (!event || event.cancelled) return null;
            const slot = alert.slotId ? event.slots.find((item) => item.id === alert.slotId) : undefined;
            const { date } = seoulDateTime(event.startsAt);
            const [month, day] = [Number(date.slice(5, 7)), Number(date.slice(8, 10))];
            const canVolunteer = Boolean(!alert.resolvedAt && slot && alert.kind !== 'notice' && canVolunteerFor(event, slot));
            return {
                id: alert.id,
                source: 'alert',
                kind: alert.kind,
                kindLabel: ALERT_KIND_LABEL[alert.kind],
                title: firstLine(alert.body),
                body: alert.body,
                author: nameOf(alert.authorId),
                authorId: alert.authorId,
                context: `${month}/${day} ${event.title}`,
                createdAt: alert.createdAt,
                ago: ago(alert.createdAt),
                done: Boolean(alert.resolvedAt),
                status: alert.resolvedAt ? 'resolved' : 'open',
                statusLabel: requestStatuses[alert.resolvedAt ? 'resolved' : 'open'],
                replies: [],
                mine: alert.authorId === userId,
                canReply: false,
                canResolve: canManage,
                eventId: event.id,
                slotId: alert.slotId,
                canVolunteer,
                volunteered: Boolean(slot?.volunteers.includes(userId)),
            };
        })
        .filter((item): item is RequestItem => item !== null);

    const allRequests = [...requests, ...alertItems].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));

    const memberNames = members.map((member) => member.name);
    /** 나에게 온 대체 부탁 알림이면, 지금 그 자리 상태 */
    const askOf = (item: PlanningNotification): NoticeAsk | undefined => {
        if (!item.slotId) return undefined;
        const event = state.events.find((candidate) => candidate.id === item.entityId);
        const slot = event?.slots.find((candidate) => candidate.id === item.slotId);
        if (!event || event.cancelled || !slot || !slot.asked?.includes(userId)) return undefined;
        const open = !slot.memberId || slot.attendance === 'absent' || openAlert(event.id, slot.id);
        return {
            eventId: event.id,
            slotId: slot.id,
            roleLabel: worshipRoles[slot.role],
            open,
            canVolunteer: canVolunteerFor(event, slot),
            volunteered: slot.volunteers.includes(userId),
            passed: Boolean(slot.passed?.includes(userId)),
            filledBy: open ? null : nameOf(slot.memberId),
        };
    };

    const notices: Notice[] = state.notifications
        .filter((item) => item.recipientIds.includes(userId))
        .map((item): Notice => {
            const kind = classifyNotice(item);
            const actor = actorFromBody(item.body, memberNames);
            return {
                id: item.id,
                kind,
                category: kind === 'request' || kind === 'reply' ? 'request' : kind === 'conti' ? 'conti' : 'team',
                actor,
                title: item.title,
                message: collapse(item.body),
                quote: quoteFromNotice(kind, item.body),
                urgent: item.urgent,
                target: item.target,
                entityId: item.entityId,
                createdAt: item.createdAt,
                group: groupOf(item.createdAt, today),
                ago: ago(item.createdAt),
                unread: !item.readBy.includes(userId),
                ask: askOf(item),
            };
        });

    const seenAt = input.feedSeenAt ? Date.parse(input.feedSeenAt) : 0;
    // 내가 남긴 코멘트는 소식이 아닙니다. ('나'는 로그인 없이 남긴 이 브라우저의 코멘트)
    const ownAuthors = new Set(['나', ...(me ? [me.name] : [])]);
    const commentNotices: Notice[] = (input.setlists ?? []).flatMap((setlist) =>
        setlist.items.flatMap((item) =>
            item.kind === 'song'
                ? item.comments
                    .filter((comment) => comment.createdAt && !ownAuthors.has(comment.author))
                    .map((comment): Notice => ({
                        id: `comment:${setlist.id}:${comment.id ?? comment.createdAt}`,
                        kind: 'comment',
                        category: 'conti',
                        actor: comment.author,
                        title: `'${item.title}'에 코멘트를 남겼어요`,
                        message: setlist.theme.trim() ? `${setlist.service} · ${setlist.theme}` : setlist.service,
                        quote: comment.text,
                        urgent: false,
                        target: 'conti',
                        entityId: setlist.id,
                        createdAt: comment.createdAt!,
                        group: groupOf(comment.createdAt!, today),
                        ago: ago(comment.createdAt!),
                        unread: Date.parse(comment.createdAt!) > seenAt,
                    }))
                : [],
        ),
    );

    const allNotices = [...notices, ...commentNotices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
        viewer: me ? { id: me.userId, name: me.name, role: me.role, canManage } : null,
        roster: members.map((member) => ({ id: member.userId, name: member.name, role: member.role })),
        partLeads: (Object.keys(leadParts) as LeadPart[]).map((part) => ({
            part,
            label: leadParts[part],
            roles: part === 'band' ? '건반·기타·베이스·드럼' : '보컬',
            members: (state.partLeads ?? [])
                .filter((lead) => lead.part === part)
                .map((lead) => ({ id: lead.memberId, name: nameOf(lead.memberId) }))
                .filter((lead): lead is { id: string; name: string } => lead.name !== null),
        })),
        services,
        events,
        requests: allRequests,
        notices: allNotices,
        unreadCount: allNotices.filter((item) => item.unread).length,
        openRequestCount: allRequests.filter((item) => !item.done).length,
    };
}

/** 알림 제목(lib/planning.ts 의 notify 호출)에서 종류를 알아냅니다. */
export function classifyNotice(item: Pick<PlanningNotification, 'title' | 'target'>): NoticeKind {
    const title = item.title;
    if (title.includes('답변')) return 'reply';
    if (title.startsWith('콘티 ') && (title.includes('요청') || title.includes('질문'))) return 'request';
    if (title.includes('초대') || title.includes('참석 여부를 확정')) return 'invite';
    if (title.startsWith('참석')) return 'accept';
    if (title.startsWith('결석')) return 'decline';
    if (title.includes('지원자')) return 'volunteer';
    if (title.includes('대체')) return 'substitute';
    if (title.includes('콘티')) return 'conti';
    if (title.includes('로테이션') || item.target === 'rotation') return 'rotation';
    if (item.target === 'requests') return 'request';
    if (item.target === 'schedule') return 'schedule';
    return 'other';
}

/** 알림 본문에서 ' · ' 로 구분된 조각 중 팀원 이름과 정확히 같은 것을 찾습니다. */
export function actorFromBody(body: string, memberNames: string[]): string | null {
    const segments = firstLine(body).split(' · ').map((segment) => segment.trim());
    return segments.find((segment) => memberNames.includes(segment)) ?? null;
}

function quoteFromNotice(kind: NoticeKind, body: string): string | undefined {
    const line = firstLine(body);
    if (kind === 'request' || kind === 'reply') {
        const index = line.indexOf(' · ');
        return index >= 0 ? line.slice(index + 3).trim() || undefined : undefined;
    }
    if (kind === 'decline') {
        const match = line.match(/결석:\s*(.+)$/);
        return match?.[1]?.trim() || undefined;
    }
    return undefined;
}

export function groupOf(iso: string, today: string): NoticeGroup {
    const days = diffDays(today, seoulDateTime(iso).date);
    if (days <= 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return '이번 주';
    return '이전';
}

function firstLine(text: string): string {
    return text.split(/\r?\n/)[0]?.trim() ?? '';
}

function collapse(text: string): string {
    return text.replace(/\s*\n+\s*/g, ' · ').trim();
}

/** 팀 배치 탭에 보여줄 주일들: 오늘 기준 지난 1개 + 다가오는 3개 */
export interface RoleRow {
    key: string;
    role: WorshipRole;
    /** 같은 역할이 두 자리 이상인 예배가 있으면 '기타 1', '기타 2' */
    label: string;
    /** 예배 순서대로. 그 예배에 이 자리가 없으면 null */
    cells: (PartAssignment | null)[];
}

/** 여러 예배의 자리를 역할·순번으로 맞춰 한 장의 배치표로 만듭니다. */
export function buildRoleMatrix(services: ServiceDay[]): RoleRow[] {
    const most = new Map<WorshipRole, number>();
    for (const service of services) {
        const counts = new Map<WorshipRole, number>();
        for (const item of service.assignments) counts.set(item.role, (counts.get(item.role) ?? 0) + 1);
        for (const [role, count] of counts) most.set(role, Math.max(most.get(role) ?? 0, count));
    }
    return ROLE_ORDER.flatMap((role) => {
        const size = most.get(role) ?? 0;
        return Array.from({ length: size }, (_, index) => ({
            key: `${role}:${index}`,
            role,
            label: size > 1 ? `${worshipRoles[role]} ${index + 1}` : worshipRoles[role],
            cells: services.map((service) => service.assignments.filter((item) => item.role === role)[index] ?? null),
        }));
    });
}

export function pickServices(services: ServiceDay[], today: string, count = 4): ServiceDay[] {
    const index = services.findIndex((service) => service.date >= today);
    if (index === -1) return services.slice(-count);
    const start = Math.max(0, index - 1);
    return services.slice(start, start + count);
}
