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

export type PlanningState = {
    version: 1; requests: SetlistRequest[]; events: TeamSchedule[]; alerts: UrgentAlert[]; notifications: PlanningNotification[];
    rotations?: RotationGroup[];
    blockedDates?: BlockedDate[];
};
export const emptyPlanningState = (): PlanningState => ({ version: 1, requests: [], events: [], alerts: [], notifications: [], rotations: [], blockedDates: [] });
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
    | { type: 'event.createMonthlySundays'; year: number; month: number; startHour: number; startMinute: number; endHour: number; endMinute: number; title: string; location?: string; templateKey?: ScheduleTemplateKey }
    | { type: 'attendance.set'; eventId: string; slotId: string; attendance: 'confirmed' | 'absent'; reason: string; autoRequestSubstitute?: boolean }
    | { type: 'attendance.batchConfirm'; items: Array<{ eventId: string; slotId: string }> }
    | { type: 'alert.create'; eventId: string; slotId: string | null; kind: 'substitute' | 'notice'; body: string; targetAudience?: 'duty' | 'all' }
    | { type: 'alert.resolve'; alertId: string }
    | { type: 'slot.volunteer'; eventId: string; slotId: string }
    | { type: 'slot.unvolunteer'; eventId: string; slotId: string }
    | { type: 'slot.accept'; eventId: string; slotId: string; memberId: string }
    | { type: 'rotation.save'; rotationId?: string; group: { name: string; targetRole: WorshipRole | 'all'; cycleType: 'team' | 'individual'; teams?: RotationTeam[]; members?: string[]; currentStep?: number; notes?: string } }
    | { type: 'rotation.remove'; rotationId: string }
    | { type: 'rotation.step'; rotationId: string; direction: 'next' | 'prev' }
    | { type: 'rotation.apply'; rotationId: string; eventId: string }
    | { type: 'rotation.batchApply'; rotationId: string; eventIds: string[] }
    | { type: 'member.blockDate'; date: string; reason?: string }
    | { type: 'member.unblockDate'; date: string }
    | { type: 'notification.read'; notificationId: string }
    | { type: 'notification.readAll' };
export type PlanningPanelProps = {
    state: PlanningState; members: TeamMember[]; userId: string; busy: boolean;
    onCommand: (command: PlanningCommand) => Promise<boolean>;
};
export const canManagePlanning = (members: TeamMember[], userId: string) => members.some(member => member.userId === userId && (member.permission === 'owner' || member.role === 'leader'));
export const planningDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
