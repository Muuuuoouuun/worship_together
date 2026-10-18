import type { TeamMember, WorshipRole } from './team';

export const requestKinds = { question: '질문', reminder: '진행 확인 요청', change: '수정 요청' } as const;
export const requestStatuses = { open: '접수', reviewing: '확인 중', resolved: '완료' } as const;
export type SetlistRequest = {
    id: string; setlistId: string; setlistTitle: string; kind: keyof typeof requestKinds;
    body: string; authorId: string; leaderId: string; status: keyof typeof requestStatuses;
    createdAt: string; updatedAt: string;
    replies: { id: string; authorId: string; body: string; createdAt: string }[];
};
export type ScheduleSlot = {
    id: string; role: WorshipRole; memberId: string | null;
    attendance: 'pending' | 'confirmed' | 'absent'; volunteers: string[];
    invitedAt?: string;
    respondedAt?: string;
    declineReason?: string;
    /** 대체 부탁을 받은 팀원 (결석·대체 요청 때 같은 악기·파트로 등록된 팀원, 팀 전체 요청이면 그 대상까지) */
    asked?: string[];
    /** 부탁을 받고 '이번엔 어려워요'라고 답한 팀원 */
    passed?: string[];
};
export type TeamSchedule = {
    id: string; title: string; kind: 'rehearsal' | 'worship'; startsAt: string; endsAt: string;
    location: string; notes: string; cancelled: boolean; slots: ScheduleSlot[];
    setlistTitle?: string | null; setlistSongs?: string[] | null; setlistId?: string | null;
};
export type UrgentAlert = {
    id: string; eventId: string; slotId: string | null; kind: 'absence' | 'substitute' | 'notice';
    body: string; authorId: string; createdAt: string; resolvedAt: string | null;
};
export type PlanningNotification = {
    id: string; title: string; body: string; urgent: boolean; target: 'requests' | 'schedule' | 'rotation';
    entityId: string; recipientIds: string[]; readBy: string[]; createdAt: string;
    /** 특정 자리에 관한 알림이면 그 자리 (대체 부탁 카드에서 바로 지원·거절) */
    slotId?: string;
};
export type RotationTeam = { id: string; name: string; memberIds: string[] };
export type RotationGroup = {
    id: string;
    name: string;
    targetRole: WorshipRole | 'all';
    cycleType: 'team' | 'individual';
    teams?: RotationTeam[];
    members?: string[];
    currentStep: number;
    notes?: string;
};

export const scheduleTemplates = {
    standard: { name: '표준 밴드 (7명)', roles: ['leader', 'keyboard', 'guitar', 'bass', 'drums', 'vocal', 'sound'] as WorshipRole[] },
    full: { name: '풀 세션 & 미디어 (9명)', roles: ['leader', 'keyboard', 'guitar', 'bass', 'drums', 'vocal', 'vocal', 'sound', 'media'] as WorshipRole[] },
    acoustic: { name: '어쿠스틱 / 심플 (4명)', roles: ['leader', 'keyboard', 'guitar', 'vocal'] as WorshipRole[] },
    vocalTeam: { name: '보컬 중심 콰이어 (6명)', roles: ['leader', 'keyboard', 'vocal', 'vocal', 'vocal', 'sound'] as WorshipRole[] },
} as const;
export type ScheduleTemplateKey = keyof typeof scheduleTemplates;

export type BlockedDate = { memberId: string; date: string; reason?: string };

/** 파트 담당. 펑크(결석)가 나면 그 예배 인도자와 함께 이 사람들에게 알림이 갑니다. */
export const leadParts = { band: '악기장', vocal: '싱어 담당' } as const;
export type LeadPart = keyof typeof leadParts;
export type PartLead = { part: LeadPart; memberId: string };
/** 건반·기타·베이스·드럼은 악기장, 보컬은 싱어 담당 소관. 인도자·음향·영상은 해당 없음 */
export const partOfRole = (role: WorshipRole): LeadPart | null =>
    role === 'keyboard' || role === 'guitar' || role === 'bass' || role === 'drums' ? 'band' : role === 'vocal' ? 'vocal' : null;

export type PlanningState = {
    version: 1; requests: SetlistRequest[]; events: TeamSchedule[]; alerts: UrgentAlert[]; notifications: PlanningNotification[];
    rotations?: RotationGroup[];
    blockedDates?: BlockedDate[];
    partLeads?: PartLead[];
};
export const emptyPlanningState = (): PlanningState => ({ version: 1, requests: [], events: [], alerts: [], notifications: [], rotations: [], blockedDates: [], partLeads: [] });
export type ScheduleInput = {
    title: string; kind: TeamSchedule['kind']; startsAt: string; endsAt: string; location: string; notes: string;
    setlistTitle?: string | null; setlistSongs?: string[] | null; setlistId?: string | null;
};
export type PlanningCommand =
    | { type: 'request.create'; setlistId: string; setlistTitle: string; kind: SetlistRequest['kind']; body: string; leaderId: string }
    | { type: 'request.reply'; requestId: string; body: string }
    | { type: 'request.status'; requestId: string; status: SetlistRequest['status'] }
    | { type: 'request.delete'; requestId: string }
    | { type: 'event.save'; eventId?: string; input: ScheduleInput }
    | { type: 'event.cancel'; eventId: string }
    | { type: 'event.delete'; eventId: string }
    | { type: 'event.createRecurring'; input: ScheduleInput; weeksCount: number }
    | { type: 'event.createWithTemplate'; input: ScheduleInput; templateKey: ScheduleTemplateKey; weeksCount?: number }
    | { type: 'event.updateSetlist'; eventId: string; setlistTitle: string; setlistSongs?: string[]; setlistId?: string; notifyDuty?: boolean }
    | { type: 'slot.save'; eventId: string; slotId?: string; role: WorshipRole; memberId: string | null }
    | { type: 'slot.remove'; eventId: string; slotId: string }
    | { type: 'slots.applyTemplate'; eventId: string; templateKey: ScheduleTemplateKey }
    | { type: 'slots.copyFromEvent'; targetEventId: string; sourceEventId: string }
    | { type: 'slots.autoAssign'; eventId: string }
    | { type: 'slots.clear'; eventId: string }
    | { type: 'slots.autoFillFromRecent'; eventId: string }
    | { type: 'schedule.sendDutyReminder'; eventId: string }
    | { type: 'slot.sendInvite'; eventId: string; slotId: string; customNote?: string }
    | { type: 'schedule.sendInvites'; eventId: string; target?: 'pending' | 'all'; customNote?: string }
    | { type: 'event.createMonthlySundays'; year: number; month: number; startHour: number; startMinute: number; endHour: number; endMinute: number; title: string; location?: string; templateKey?: ScheduleTemplateKey }
    | { type: 'attendance.set'; eventId: string; slotId: string; attendance: 'confirmed' | 'absent'; reason: string; autoRequestSubstitute?: boolean }
    | { type: 'attendance.batchConfirm'; items: Array<{ eventId: string; slotId: string }> }
    | { type: 'alert.create'; eventId: string; slotId: string | null; kind: 'substitute' | 'notice'; body: string; targetAudience?: 'duty' | 'all' }
    | { type: 'alert.resolve'; alertId: string }
    | { type: 'slot.volunteer'; eventId: string; slotId: string }
    | { type: 'slot.unvolunteer'; eventId: string; slotId: string }
    | { type: 'slot.accept'; eventId: string; slotId: string; memberId: string }
    | { type: 'slot.pass'; eventId: string; slotId: string }
    | { type: 'slot.askAll'; eventId: string; slotId: string }
    | { type: 'rotation.save'; rotationId?: string; group: { name: string; targetRole: WorshipRole | 'all'; cycleType: 'team' | 'individual'; teams?: RotationTeam[]; members?: string[]; currentStep?: number; notes?: string } }
    | { type: 'rotation.remove'; rotationId: string }
    | { type: 'rotation.step'; rotationId: string; direction: 'next' | 'prev' }
    | { type: 'rotation.apply'; rotationId: string; eventId: string }
    | { type: 'rotation.batchApply'; rotationId: string; eventIds: string[] }
    | { type: 'member.blockDate'; date: string; reason?: string }
    | { type: 'member.unblockDate'; date: string }
    | { type: 'partLead.set'; part: LeadPart; memberIds: string[] }
    | { type: 'notification.read'; notificationId: string }
    | { type: 'notification.readAll' };
export type PlanningPanelProps = {
    state: PlanningState; members: TeamMember[]; userId: string; busy: boolean;
    onCommand: (command: PlanningCommand) => Promise<boolean>;
};
export const canManagePlanning = (members: TeamMember[], userId: string) => members.some(member => member.userId === userId && (member.permission === 'owner' || member.role === 'leader'));
/** 관리자이거나 이 역할 파트의 담당이면 대체 요청·지원자 확정을 할 수 있습니다. */
export const canHandleSlot = (state: Pick<PlanningState, 'partLeads'>, members: TeamMember[], userId: string, role: WorshipRole) => {
    if (canManagePlanning(members, userId)) return true;
    const part = partOfRole(role);
    return Boolean(part) && (state.partLeads ?? []).some(lead => lead.part === part && lead.memberId === userId);
};
const PLANNING_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
/** 형식기는 한 번만 만듭니다 (호출마다 만들면 약 40배 느림). 잘못된 날짜는 예전처럼 'Invalid Date'. */
export const planningDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? 'Invalid Date' : PLANNING_DATE.format(date);
};
/** 저장된 시각은 UTC('Z')와 '+09:00' 형식이 섞여 있어 문자열을 자르지 않고 한국 시간으로 바꿔 씁니다. */
const kst = (iso: string) => new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString();
/** 한국 시간 기준 날짜 YYYY-MM-DD */
export const planningDay = (iso: string) => kst(iso).slice(0, 10);
/** 한국 시간 기준 시각 HH:mm */
export const planningTime = (iso: string) => kst(iso).slice(11, 16);
