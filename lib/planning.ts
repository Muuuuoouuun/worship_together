import * as z from 'zod';
import { createClientId } from './clientId';
import { worshipRoles, type TeamMember } from '../types/team';
import { canManagePlanning, emptyPlanningState, planningDate, planningDay, requestKinds, scheduleTemplates, type PlanningCommand, type PlanningState, type RotationGroup, type ScheduleSlot, type TeamSchedule } from '../types/planning';

const id = z.string().min(1).max(200);
const body = z.string().trim().min(1, '내용을 입력해주세요.').max(1500);
const role = z.enum(Object.keys(worshipRoles) as [keyof typeof worshipRoles, ...Array<keyof typeof worshipRoles>]);
const scheduleInput = z.object({
    title: z.string().trim().min(1).max(80),
    kind: z.enum(['rehearsal', 'worship']),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().max(120),
    notes: z.string().trim().max(1500),
    setlistTitle: z.string().trim().max(120).nullish(),
    setlistSongs: z.array(z.string().trim().max(100)).max(30).nullish(),
    setlistId: z.string().trim().max(200).nullish(),
});
const rotationTeamSchema = z.object({ id, name: z.string().trim().min(1).max(50), memberIds: z.array(id) });
const rotationGroupSchema = z.object({
    id,
    name: z.string().trim().min(1, '로테이션 이름을 입력해주세요.').max(80),
    targetRole: z.enum(['all', ...(Object.keys(worshipRoles) as [keyof typeof worshipRoles, ...Array<keyof typeof worshipRoles>])]),
    cycleType: z.enum(['team', 'individual']),
    teams: z.array(rotationTeamSchema).optional(),
    members: z.array(id).optional(),
    currentStep: z.number().int().min(0).default(0),
    notes: z.string().trim().max(500).optional(),
});
const commandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('request.create'), setlistId: z.string().max(200), setlistTitle: z.string().trim().min(1).max(120), kind: z.enum(['question', 'reminder', 'change']), body, leaderId: id }),
    z.object({ type: z.literal('request.reply'), requestId: id, body }),
    z.object({ type: z.literal('request.status'), requestId: id, status: z.enum(['open', 'reviewing', 'resolved']) }),
    z.object({ type: z.literal('request.delete'), requestId: id }),
    z.object({ type: z.literal('event.save'), eventId: id.optional(), input: scheduleInput }),
    z.object({ type: z.literal('event.cancel'), eventId: id }),
    z.object({ type: z.literal('event.delete'), eventId: id }),
    z.object({ type: z.literal('event.createRecurring'), input: scheduleInput, weeksCount: z.number().int().min(1).max(12) }),
    z.object({ type: z.literal('event.createWithTemplate'), input: scheduleInput, templateKey: z.enum(['standard', 'full', 'acoustic', 'vocalTeam']), weeksCount: z.number().int().min(1).max(12).optional() }),
    z.object({
        type: z.literal('event.updateSetlist'),
        eventId: id,
        setlistTitle: z.string().trim().min(1, '콘티 제목을 입력해주세요.').max(120),
        setlistSongs: z.array(z.string().trim().max(100)).max(30).optional(),
        setlistId: z.string().trim().max(200).optional(),
        notifyDuty: z.boolean().optional(),
    }),
    z.object({ type: z.literal('slot.save'), eventId: id, slotId: id.optional(), role, memberId: id.nullable() }),
    z.object({ type: z.literal('slot.remove'), eventId: id, slotId: id }),
    z.object({ type: z.literal('slots.applyTemplate'), eventId: id, templateKey: z.enum(['standard', 'full', 'acoustic', 'vocalTeam']) }),
    z.object({ type: z.literal('slots.copyFromEvent'), targetEventId: id, sourceEventId: id }),
    z.object({ type: z.literal('slots.autoAssign'), eventId: id }),
    z.object({ type: z.literal('slots.clear'), eventId: id }),
    z.object({ type: z.literal('slots.autoFillFromRecent'), eventId: id }),
    z.object({ type: z.literal('schedule.sendDutyReminder'), eventId: id }),
    z.object({ type: z.literal('slot.sendInvite'), eventId: id, slotId: id, customNote: z.string().trim().max(200).optional() }),
    z.object({ type: z.literal('schedule.sendInvites'), eventId: id, target: z.enum(['pending', 'all']).optional(), customNote: z.string().trim().max(200).optional() }),
    z.object({
        type: z.literal('event.createMonthlySundays'),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
        startHour: z.number().int().min(0).max(23),
        startMinute: z.number().int().min(0).max(59),
        endHour: z.number().int().min(0).max(23),
        endMinute: z.number().int().min(0).max(59),
        title: z.string().trim().min(1).max(80),
        location: z.string().trim().max(120).optional(),
        templateKey: z.enum(['standard', 'full', 'acoustic', 'vocalTeam']).optional(),
    }),
    z.object({ type: z.literal('attendance.set'), eventId: id, slotId: id, attendance: z.enum(['confirmed', 'absent']), reason: z.string().trim().max(500), autoRequestSubstitute: z.boolean().optional() }),
    z.object({ type: z.literal('attendance.batchConfirm'), items: z.array(z.object({ eventId: id, slotId: id })).min(1).max(50) }),
    z.object({
        type: z.literal('alert.create'),
        eventId: id,
        slotId: id.nullable(),
        kind: z.enum(['substitute', 'notice']),
        body,
        targetAudience: z.enum(['duty', 'all']).optional(),
    }),
    z.object({ type: z.literal('alert.resolve'), alertId: id }),
    z.object({ type: z.literal('slot.volunteer'), eventId: id, slotId: id }),
    z.object({ type: z.literal('slot.unvolunteer'), eventId: id, slotId: id }),
    z.object({ type: z.literal('slot.accept'), eventId: id, slotId: id, memberId: id }),
    z.object({
        type: z.literal('rotation.save'),
        rotationId: id.optional(),
        group: z.object({
            name: z.string().trim().min(1, '로테이션 이름을 입력해주세요.').max(80),
            targetRole: z.enum(['all', ...(Object.keys(worshipRoles) as [keyof typeof worshipRoles, ...Array<keyof typeof worshipRoles>])]),
            cycleType: z.enum(['team', 'individual']),
            teams: z.array(rotationTeamSchema).optional(),
            members: z.array(id).optional(),
            currentStep: z.number().int().min(0).optional(),
            notes: z.string().trim().max(500).optional(),
        }),
    }),
    z.object({ type: z.literal('rotation.remove'), rotationId: id }),
    z.object({ type: z.literal('rotation.step'), rotationId: id, direction: z.enum(['next', 'prev']) }),
    z.object({ type: z.literal('rotation.apply'), rotationId: id, eventId: id }),
    z.object({ type: z.literal('rotation.batchApply'), rotationId: id, eventIds: z.array(id).min(1).max(20) }),
    z.object({ type: z.literal('notification.read'), notificationId: id }),
    z.object({ type: z.literal('notification.readAll') }),
    z.object({ type: z.literal('member.blockDate'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().max(200).optional() }),
    z.object({ type: z.literal('member.unblockDate'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);
const stamp = z.string();
const stateSchema = z.object({
    version: z.literal(1),
    requests: z.array(z.object({ id, setlistId: z.string(), setlistTitle: z.string(), kind: z.enum(['question', 'reminder', 'change']), body: z.string(), authorId: id, leaderId: id, status: z.enum(['open', 'reviewing', 'resolved']), createdAt: stamp, updatedAt: stamp, replies: z.array(z.object({ id, authorId: id, body: z.string(), createdAt: stamp })) })),
    events: z.array(scheduleInput.extend({ id, cancelled: z.boolean(), slots: z.array(z.object({ id, role, memberId: id.nullable(), attendance: z.enum(['pending', 'confirmed', 'absent']), volunteers: z.array(id), invitedAt: stamp.optional(), respondedAt: stamp.optional(), declineReason: z.string().optional() })) })),
    alerts: z.array(z.object({ id, eventId: id, slotId: id.nullable(), kind: z.enum(['absence', 'substitute', 'notice']), body: z.string(), authorId: id, createdAt: stamp, resolvedAt: stamp.nullable() })),
    notifications: z.array(z.object({ id, title: z.string(), body: z.string(), urgent: z.boolean(), target: z.enum(['requests', 'schedule', 'rotation']), entityId: id, recipientIds: z.array(id), readBy: z.array(id), createdAt: stamp })),
    rotations: z.array(rotationGroupSchema).optional().default([]),
    blockedDates: z.array(z.object({ memberId: id, date: z.string(), reason: z.string().optional() })).optional().default([]),
});
export function parsePlanningState(value: unknown): PlanningState {
    if (value == null) return emptyPlanningState();
    const result = stateSchema.safeParse(value);
    if (!result.success) throw new Error('저장된 일정 자료를 읽지 못했습니다. 새로고침 후 다시 확인해주세요.');
    return { ...result.data, rotations: result.data.rotations ?? [], blockedDates: result.data.blockedDates ?? [] };
}
export function planningForViewer(state: PlanningState, members: TeamMember[], userId: string): PlanningState {
    if (!members.some(member => member.userId === userId)) throw new Error('이 팀에 접근할 수 없습니다.');
    const owner = members.some(member => member.userId === userId && member.permission === 'owner');
    return { ...state, requests: state.requests.filter(item => item.authorId === userId || item.leaderId === userId || owner), notifications: state.notifications.filter(item => item.recipientIds.includes(userId)) };
}

const BATCH_SKIP_MARK = ' · 빠진 팀원 ';

/** 로테이션 일괄 배정을 같은 규칙으로 미리 적용해 완료 메시지에 붙일 '빠진 팀원 N명: …' 안내를 돌려줍니다. 빠질 사람이 없거나 적용할 수 없으면 ''. */
export function previewRotationBatchSkips(state: PlanningState, members: TeamMember[], userId: string, command: Extract<PlanningCommand, { type: 'rotation.batchApply' }>): string {
    try {
        const next = applyPlanningCommand(state, members, userId, command);
        const body = next.notifications.find(item => !state.notifications.some(old => old.id === item.id))?.body ?? '';
        const index = body.indexOf(BATCH_SKIP_MARK);
        return index >= 0 ? body.slice(index + 3) : '';
    } catch {
        return '';
    }
}

/** Shared local-demo/server domain rules; the server supplies authenticated identity and roster. */
export function applyPlanningCommand(previous: PlanningState, members: TeamMember[], userId: string, input: PlanningCommand | unknown): PlanningState {
    const actor = members.find(member => member.userId === userId);
    if (!actor) throw new Error('이 팀에 접근할 수 없습니다.');
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new Error('입력 형식과 필수 항목을 확인해주세요.');
    const command = parsed.data;
    const state = structuredClone(previous);
    state.rotations = state.rotations ?? [];
    const now = new Date().toISOString();
    const managers = members.filter(member => member.permission === 'owner' || member.role === 'leader').map(member => member.userId);
    const manage = () => { if (!canManagePlanning(members, userId)) throw new Error('인도자 또는 팀 관리자만 변경할 수 있습니다.'); };
    /** includeSelf: 처리한 본인도 확인해야 할 결과(예: 일괄 배정에서 빠진 팀원)일 때 */
    const notify = (recipientIds: string[], title: string, text: string, target: 'requests' | 'schedule' | 'rotation', entityId: string, urgent = false, includeSelf = false) => {
        const recipients = [...new Set(recipientIds)].filter(recipient => (includeSelf || recipient !== userId) && members.some(member => member.userId === recipient));
        if (recipients.length) state.notifications.unshift({ id: createClientId(), title, body: text, target, entityId, urgent, recipientIds: recipients, readBy: [], createdAt: now });
    };
    const everyone = members.map(member => member.userId);
    const eventById = (eventId: string) => { const event = state.events.find(item => item.id === eventId); if (!event || event.cancelled) throw new Error('일정이 없거나 취소되었습니다.'); return event; };
    const slotById = (event: TeamSchedule, slotId: string) => { const slot = event.slots.find(item => item.id === slotId); if (!slot) throw new Error('배치 항목을 찾지 못했습니다.'); return slot; };
    const closeSlotAlerts = (eventId: string, slotId: string) => { state.alerts.filter(item => item.eventId === eventId && item.slotId === slotId && !item.resolvedAt).forEach(item => { item.resolvedAt = now; }); };
    /** 담당자가 바뀌면 이전 사람의 초대·응답 기록을 새 사람에게 넘기지 않습니다. */
    const resetResponse = (slot: ScheduleSlot) => { delete slot.invitedAt; delete slot.respondedAt; delete slot.declineReason; };
    const available = (event: TeamSchedule, memberId: string | null, slotId?: string) => {
        if (!memberId) return;
        if (!members.some(member => member.userId === memberId)) throw new Error('이 팀의 팀원만 배치할 수 있습니다.');
        const clash = state.events.find(other => !other.cancelled && Date.parse(other.startsAt) < Date.parse(event.endsAt) && Date.parse(event.startsAt) < Date.parse(other.endsAt) && other.slots.some(slot => slot.id !== slotId && slot.memberId === memberId && slot.attendance !== 'absent'));
        if (clash) throw new Error(`이미 겹치는 일정에 배치되어 있습니다: ${clash.title}`);
    };
    const urgent = (event: TeamSchedule, slotId: string | null, kind: 'absence' | 'substitute' | 'notice', text: string, targetRecipients?: string[]) => {
        if (slotId && state.alerts.some(item => item.eventId === event.id && item.slotId === slotId && !item.resolvedAt)) throw new Error('이 배치에는 이미 열린 긴급 요청이 있습니다.');
        const alertId = createClientId();
        state.alerts.unshift({ id: alertId, eventId: event.id, slotId, kind, body: text, authorId: userId, createdAt: now, resolvedAt: null });
        const recipients = targetRecipients ?? everyone;
        notify(recipients, kind === 'absence' ? '결석 · 대체 인원이 필요해요' : kind === 'substitute' ? '대체 인원을 구해요' : '긴급 안내', `${event.title} · ${text}`, 'schedule', event.id, true);
    };
    switch (command.type) {
        case 'request.create': {
            if (!managers.includes(command.leaderId)) throw new Error('수신할 인도자 또는 관리자를 선택해주세요.');
            if (state.requests.length >= 300) {
                const pruneIndex = state.requests.findLastIndex ? state.requests.findLastIndex(r => r.status === 'resolved') : -1;
                if (pruneIndex !== -1) {
                    state.requests.splice(pruneIndex, 1);
                } else {
                    throw new Error('요청 보관 한도에 도달했습니다.');
                }
            }
            const requestId = createClientId();
            state.requests.unshift({ ...command, id: requestId, authorId: userId, status: 'open', createdAt: now, updatedAt: now, replies: [] });
            notify([command.leaderId], `콘티 ${requestKinds[command.kind]}`, `${command.setlistTitle} · ${command.body}`, 'requests', requestId);
            break;
        }
        case 'request.delete': {
            const index = state.requests.findIndex(item => item.id === command.requestId);
            if (index === -1) throw new Error('요청을 찾지 못했습니다.');
            const request = state.requests[index];
            const canDelete = request.authorId === userId || request.leaderId === userId || actor.permission === 'owner';
            if (!canDelete) throw new Error('작성자 또는 관리자만 요청을 삭제할 수 있습니다.');
            state.requests.splice(index, 1);
            state.notifications = state.notifications.filter(item => item.entityId !== command.requestId);
            break;
        }
        case 'request.reply': case 'request.status': {
            const request = state.requests.find(item => item.id === command.requestId);
            if (!request) throw new Error('요청을 찾지 못했습니다.');
            const resolver = request.leaderId === userId || actor.permission === 'owner';
            if (command.type === 'request.status') {
                if (!resolver) throw new Error('수신 인도자 또는 관리자만 처리 상태를 변경할 수 있습니다.');
                request.status = command.status;
                notify([request.authorId, request.leaderId], '콘티 요청 상태 변경', request.setlistTitle, 'requests', request.id);
            } else {
                if (!resolver && request.authorId !== userId) throw new Error('이 요청에 답변할 수 없습니다.');
                if (request.replies.length >= 100) throw new Error('답변 한도에 도달했습니다.');
                request.replies.push({ id: createClientId(), authorId: userId, body: command.body, createdAt: now });
                notify([request.authorId, request.leaderId], '콘티 요청에 답변이 왔어요', `${request.setlistTitle} · ${command.body}`, 'requests', request.id);
            }
            request.updatedAt = now;
            break;
        }
        case 'event.save': {
            manage();
            const start = Date.parse(command.input.startsAt), end = Date.parse(command.input.endsAt);
            if (end <= start || end - start > 86400000) throw new Error('종료는 시작 이후, 일정 길이는 24시간 이내로 설정해주세요.');
            const existing = command.eventId ? eventById(command.eventId) : undefined;
            if (!existing && state.events.length >= 200) {
                const pruneIndex = state.events.findLastIndex ? state.events.findLastIndex(e => e.cancelled) : -1;
                if (pruneIndex !== -1) {
                    state.events.splice(pruneIndex, 1);
                } else {
                    throw new Error('일정 보관 한도에 도달했습니다.');
                }
            }
            const event: TeamSchedule = {
                setlistTitle: existing?.setlistTitle,
                setlistSongs: existing?.setlistSongs,
                setlistId: existing?.setlistId,
                ...command.input,
                startsAt: new Date(start).toISOString(),
                endsAt: new Date(end).toISOString(),
                id: existing?.id ?? createClientId(),
                cancelled: false,
                slots: existing?.slots ?? [],
            };
            for (const slot of event.slots) if (slot.attendance !== 'absent') available(event, slot.memberId, slot.id);
            if (existing) Object.assign(existing, event); else state.events.unshift(event);
            notify(everyone, existing ? '일정이 변경되었어요' : '새 연습·예배 일정', event.title, 'schedule', event.id);
            break;
        }
        case 'event.cancel': {
            manage(); const event = eventById(command.eventId); event.cancelled = true;
            state.alerts.filter(item => item.eventId === event.id && !item.resolvedAt).forEach(item => { item.resolvedAt = now; });
            notify(everyone, '일정이 취소되었어요', event.title, 'schedule', event.id, true); break;
        }
        case 'event.delete': {
            manage();
            const index = state.events.findIndex(item => item.id === command.eventId);
            if (index === -1) throw new Error('삭제할 일정을 찾지 못했습니다.');
            state.events.splice(index, 1);
            state.alerts = state.alerts.filter(item => item.eventId !== command.eventId);
            state.notifications = state.notifications.filter(item => item.entityId !== command.eventId);
            break;
        }
        case 'event.updateSetlist': {
            manage();
            const event = eventById(command.eventId);
            event.setlistTitle = command.setlistTitle;
            if (command.setlistSongs !== undefined) event.setlistSongs = command.setlistSongs;
            if (command.setlistId !== undefined) event.setlistId = command.setlistId;
            if (command.notifyDuty !== false) {
                const dutyMemberIds = event.slots.map(s => s.memberId).filter((mid): mid is string => Boolean(mid));
                const recipients = dutyMemberIds.length > 0 ? dutyMemberIds : everyone;
                const songsSummary = event.setlistSongs?.length ? ` (${event.setlistSongs.length}곡)` : '';
                notify(
                    recipients,
                    '콘티가 등록·변경되었어요',
                    `${event.title} · ${command.setlistTitle}${songsSummary}`,
                    'schedule',
                    event.id,
                    false
                );
            }
            break;
        }
        case 'slot.save': {
            manage(); const event = eventById(command.eventId);
            const existing = command.slotId ? slotById(event, command.slotId) : undefined;
            const sameMember = Boolean(existing && existing.memberId === command.memberId);
            if (sameMember && existing!.role === command.role) break;
            if (!sameMember || existing!.attendance !== 'absent') available(event, command.memberId, existing?.id);
            if (event.slots.length >= 50 && !existing) throw new Error('한 일정에 최대 50명을 배치할 수 있습니다.');
            const slot = { id: existing?.id ?? createClientId(), role: command.role, memberId: command.memberId, attendance: sameMember ? existing!.attendance : 'pending' as const, volunteers: sameMember ? existing!.volunteers : [] };
            const oldMember = existing?.memberId;
            if (existing) { Object.assign(existing, slot); if (!sameMember) { resetResponse(existing); closeSlotAlerts(event.id, slot.id); } } else event.slots.push(slot);
            notify([...(oldMember ? [oldMember] : []), ...(command.memberId ? [command.memberId] : [])], '인원 배치가 변경되었어요', `${event.title} · ${worshipRoles[command.role]}`, 'schedule', event.id);
            break;
        }
        case 'slot.remove': {
            manage(); const event = eventById(command.eventId); const slot = slotById(event, command.slotId);
            event.slots = event.slots.filter(item => item.id !== slot.id); closeSlotAlerts(event.id, slot.id);
            if (slot.memberId) notify([slot.memberId], '배치가 해제되었어요', event.title, 'schedule', event.id);
            break;
        }
        case 'attendance.set': {
            const event = eventById(command.eventId); const slot = slotById(event, command.slotId);
            if (slot.memberId !== userId) throw new Error('본인의 참석 여부만 응답할 수 있습니다.');
            if (slot.attendance === command.attendance) break;
            slot.respondedAt = new Date().toISOString();
            if (command.attendance === 'confirmed') {
                slot.declineReason = undefined;
                available(event, userId, slot.id); closeSlotAlerts(event.id, slot.id); slot.volunteers = []; notify(managers, '참석 응답', `${actor.name} · ${event.title}`, 'schedule', event.id);
            }
            else {
                slot.declineReason = command.reason || undefined;
                closeSlotAlerts(event.id, slot.id);
                urgent(event, slot.id, 'absence', `${actor.name} · ${worshipRoles[slot.role]} 결석${command.reason ? `: ${command.reason}` : ''}`);
                if (command.autoRequestSubstitute !== false) {
                    // Auto-suggest substitute: find candidates matching this role, sorted by workload
                    const wMap = new Map<string, number>();
                    for (const m of members) wMap.set(m.userId, 0);
                    for (const ev of state.events) { if (ev.cancelled) continue; for (const sl of ev.slots) { if (sl.memberId && wMap.has(sl.memberId)) wMap.set(sl.memberId, wMap.get(sl.memberId)! + 1); } }
                    const eventDate = planningDay(event.startsAt);
                    const blocked = new Set((state.blockedDates ?? []).filter(b => b.date === eventDate).map(b => b.memberId));
                    const assignedInEvent = new Set(event.slots.map(s => s.memberId).filter((mid): mid is string => Boolean(mid)));
                    const subs = members
                        .filter(m => m.userId !== userId && !assignedInEvent.has(m.userId) && !blocked.has(m.userId) && (m.role === slot.role || slot.role === 'member'))
                        .filter(m => { try { available(event, m.userId); return true; } catch { return false; } })
                        .sort((a, b) => (wMap.get(a.userId) ?? 0) - (wMap.get(b.userId) ?? 0));
                    if (subs.length > 0) {
                        const topNames = subs.slice(0, 3).map(m => m.name).join(', ');
                        notify(managers, '대체 인원 후보가 있어요', `${event.title} · ${worshipRoles[slot.role]} · 추천: ${topNames}`, 'schedule', event.id);
                    }
                }
            }
            slot.attendance = command.attendance; break;
        }
        case 'attendance.batchConfirm': {
            let confirmedCount = 0;
            const nowIso = new Date().toISOString();
            for (const item of command.items) {
                const event = eventById(item.eventId);
                const slot = slotById(event, item.slotId);
                if (slot.memberId !== userId) throw new Error('본인의 참석 여부만 응답할 수 있습니다.');
                if (slot.attendance === 'confirmed') continue;
                available(event, userId, slot.id);
                closeSlotAlerts(event.id, slot.id);
                slot.volunteers = [];
                slot.attendance = 'confirmed';
                slot.respondedAt = nowIso;
                slot.declineReason = undefined;
                confirmedCount++;
            }
            if (confirmedCount > 0) {
                notify(managers, '참석 일괄 확정', `${actor.name} · 다가오는 섬김 ${confirmedCount}건 참석 확정`, 'schedule', command.items[0].eventId);
            }
            break;
        }
        case 'alert.create': {
            const event = eventById(command.eventId);
            if (command.kind === 'notice') {
                manage();
                const dutyMemberIds = event.slots.map(s => s.memberId).filter((mid): mid is string => Boolean(mid));
                const targetAudience = command.targetAudience ?? 'duty';
                const recipients = (targetAudience === 'duty' && dutyMemberIds.length > 0) ? dutyMemberIds : everyone;
                urgent(event, null, 'notice', command.body, recipients);
            } else {
                if (!command.slotId) throw new Error('대체할 배치를 선택해주세요.');
                const slot = slotById(event, command.slotId);
                if (slot.memberId !== userId) manage();
                urgent(event, slot.id, 'substitute', command.body);
            }
            break;
        }
        case 'alert.resolve': {
            manage(); const alert = state.alerts.find(item => item.id === command.alertId);
            if (!alert) throw new Error('알림을 찾지 못했습니다.');
            eventById(alert.eventId);
            if (!alert.resolvedAt) { alert.resolvedAt = now; notify(everyone, '긴급 요청을 마감했어요', alert.body, 'schedule', alert.eventId); }
            break;
        }
        case 'slot.volunteer': {
            const event = eventById(command.eventId); const slot = slotById(event, command.slotId);
            const open = state.alerts.some(item => item.eventId === event.id && item.slotId === slot.id && !item.resolvedAt);
            if (!open && slot.memberId && slot.attendance !== 'absent') throw new Error('대체 요청이 없는 배치입니다.');
            if (slot.memberId === userId) throw new Error('본인 배치에는 대체 지원할 수 없습니다.');
            available(event, userId);
            if (!slot.volunteers.includes(userId)) { slot.volunteers.push(userId); notify(managers, '대체 지원자가 있어요', `${event.title} · ${actor.name}`, 'schedule', event.id, true); }
            break;
        }
        case 'slot.unvolunteer': {
            const event = eventById(command.eventId);
            const slot = slotById(event, command.slotId);
            slot.volunteers = slot.volunteers.filter(v => v !== userId);
            break;
        }
        case 'slot.accept': {
            manage(); const event = eventById(command.eventId); const slot = slotById(event, command.slotId);
            if (!slot.volunteers.includes(command.memberId)) throw new Error('지원한 팀원만 확정할 수 있습니다.');
            available(event, command.memberId, slot.id);
            const oldMember = slot.memberId;
            slot.memberId = command.memberId; slot.attendance = 'confirmed'; slot.volunteers = []; resetResponse(slot); closeSlotAlerts(event.id, slot.id);
            notify(everyone, '대체 인원이 확정되었어요', `${event.title} · ${worshipRoles[slot.role]} · ${members.find(member => member.userId === command.memberId)!.name}${oldMember ? ' (배치 변경)' : ''}`, 'schedule', event.id);
            break;
        }
        case 'notification.read': {
            const notification = state.notifications.find(item => item.id === command.notificationId);
            if (!notification || !notification.recipientIds.includes(userId)) throw new Error('본인의 알림만 확인할 수 있습니다.');
            if (!notification.readBy.includes(userId)) notification.readBy.push(userId);
            break;
        }
        case 'notification.readAll': {
            state.notifications.forEach(item => {
                if (item.recipientIds.includes(userId) && !item.readBy.includes(userId)) {
                    item.readBy.push(userId);
                }
            });
            break;
        }
        case 'event.createRecurring': {
            manage();
            const start = Date.parse(command.input.startsAt), end = Date.parse(command.input.endsAt);
            if (end <= start || end - start > 86400000) throw new Error('종료는 시작 이후, 일정 길이는 24시간 이내로 설정해주세요.');
            if (state.events.length + command.weeksCount > 200) throw new Error('일정 보관 한도에 도달했습니다.');
            const newEvents: TeamSchedule[] = [];
            for (let i = 0; i < command.weeksCount; i++) {
                const shiftMs = i * 7 * 86400000;
                newEvents.push({
                    ...command.input,
                    startsAt: new Date(start + shiftMs).toISOString(),
                    endsAt: new Date(end + shiftMs).toISOString(),
                    id: createClientId(),
                    cancelled: false,
                    slots: [],
                });
            }
            state.events.unshift(...newEvents);
            notify(everyone, '정기 일정이 등록되었어요', `${command.input.title} (${command.weeksCount}주)`, 'schedule', newEvents[0].id);
            break;
        }
        case 'event.createWithTemplate': {
            manage();
            const start = Date.parse(command.input.startsAt), end = Date.parse(command.input.endsAt);
            if (end <= start || end - start > 86400000) throw new Error('종료는 시작 이후, 일정 길이는 24시간 이내로 설정해주세요.');
            const weeks = command.weeksCount ?? 1;
            if (state.events.length + weeks > 200) throw new Error('일정 보관 한도에 도달했습니다.');
            const template = scheduleTemplates[command.templateKey];
            if (!template) throw new Error('템플릿을 찾지 못했습니다.');
            const newEvents: TeamSchedule[] = [];
            for (let i = 0; i < weeks; i++) {
                const shiftMs = i * 7 * 86400000;
                const slots: ScheduleSlot[] = template.roles.map(r => ({
                    id: createClientId(),
                    role: r,
                    memberId: null,
                    attendance: 'pending',
                    volunteers: [],
                }));
                newEvents.push({
                    ...command.input,
                    startsAt: new Date(start + shiftMs).toISOString(),
                    endsAt: new Date(end + shiftMs).toISOString(),
                    id: createClientId(),
                    cancelled: false,
                    slots,
                });
            }
            state.events.unshift(...newEvents);
            notify(everyone, '예배 일정이 템플릿과 함께 등록되었어요', `${command.input.title} (${weeks > 1 ? `${weeks}주 · ` : ''}${template.name})`, 'schedule', newEvents[0].id);
            break;
        }
        case 'slots.applyTemplate': {
            manage();
            const event = eventById(command.eventId);
            const template = scheduleTemplates[command.templateKey];
            if (!template) throw new Error('템플릿을 찾지 못했습니다.');
            if (event.slots.length + template.roles.length > 50) throw new Error('한 일정에 최대 50명을 배치할 수 있습니다.');
            for (const r of template.roles) {
                event.slots.push({ id: createClientId(), role: r, memberId: null, attendance: 'pending', volunteers: [] });
            }
            notify(everyone, '역할 템플릿이 적용되었어요', `${event.title} · ${template.name}`, 'schedule', event.id);
            break;
        }
        case 'slots.copyFromEvent': {
            manage();
            const targetEvent = eventById(command.targetEventId);
            const sourceEvent = eventById(command.sourceEventId);
            if (sourceEvent.id === targetEvent.id) throw new Error('동일한 일정으로는 복사할 수 없습니다.');
            if (sourceEvent.slots.length === 0) throw new Error('복사할 원본 일정에 배정된 역할이 없습니다.');
            if (targetEvent.slots.length + sourceEvent.slots.length > 50) throw new Error('한 일정에 최대 50명을 배치할 수 있습니다.');
            for (const src of sourceEvent.slots) {
                let candidateId: string | null = null;
                if (src.memberId && members.some(m => m.userId === src.memberId)) {
                    try {
                        available(targetEvent, src.memberId);
                        candidateId = src.memberId;
                    } catch {
                        candidateId = null;
                    }
                }
                targetEvent.slots.push({
                    id: createClientId(),
                    role: src.role,
                    memberId: candidateId,
                    attendance: 'pending',
                    volunteers: [],
                });
            }
            notify(everyone, '이전 배정을 복사해왔어요', `${targetEvent.title} ← ${sourceEvent.title}`, 'schedule', targetEvent.id);
            break;
        }
        case 'slots.autoAssign': {
            manage();
            const event = eventById(command.eventId);
            const emptySlots = event.slots.filter(s => s.memberId === null);
            if (emptySlots.length === 0) throw new Error('배정할 빈자리가 없습니다.');
            const workloadMap = new Map<string, number>();
            for (const m of members) workloadMap.set(m.userId, 0);
            for (const ev of state.events) {
                if (ev.cancelled) continue;
                for (const sl of ev.slots) {
                    if (sl.memberId && workloadMap.has(sl.memberId)) {
                        workloadMap.set(sl.memberId, workloadMap.get(sl.memberId)! + 1);
                    }
                }
            }
            const assignedInEvent = new Set(event.slots.map(s => s.memberId).filter((mid): mid is string => Boolean(mid)));
            const eventDate = planningDay(event.startsAt);
            const blocked = new Set((state.blockedDates ?? []).filter(b => b.date === eventDate).map(b => b.memberId));
            let assignedCount = 0;
            for (const slot of emptySlots) {
                const candidates = members.filter(m => !assignedInEvent.has(m.userId) && !blocked.has(m.userId) && (m.role === slot.role || slot.role === 'member'));
                const validCandidates = candidates.filter(m => {
                    try {
                        available(event, m.userId);
                        return true;
                    } catch {
                        return false;
                    }
                });
                validCandidates.sort((a, b) => (workloadMap.get(a.userId) ?? 0) - (workloadMap.get(b.userId) ?? 0));
                if (validCandidates.length > 0) {
                    const chosen = validCandidates[0];
                    slot.memberId = chosen.userId;
                    slot.attendance = 'pending';
                    slot.volunteers = [];
                    closeSlotAlerts(event.id, slot.id);
                    assignedInEvent.add(chosen.userId);
                    workloadMap.set(chosen.userId, (workloadMap.get(chosen.userId) ?? 0) + 1);
                    assignedCount++;
                }
            }
            if (assignedCount === 0) throw new Error('배정 가능한 적합한 팀원이 없습니다. (일정 충돌 또는 파트 불일치)');
            notify(everyone, '스마트 자동 배정이 완료되었어요', `${event.title} · ${assignedCount}명 배정`, 'schedule', event.id);
            break;
        }
        case 'slots.clear': {
            manage();
            const event = eventById(command.eventId);
            let clearedCount = 0;
            for (const slot of event.slots) {
                if (slot.memberId !== null) {
                    slot.memberId = null;
                    slot.attendance = 'pending';
                    slot.volunteers = [];
                    resetResponse(slot);
                    closeSlotAlerts(event.id, slot.id);
                    clearedCount++;
                }
            }
            if (clearedCount === 0) throw new Error('초기화할 배정 인원이 없습니다.');
            notify(everyone, '인원 배치가 초기화되었어요', event.title, 'schedule', event.id);
            break;
        }
        case 'slots.autoFillFromRecent': {
            manage();
            const event = eventById(command.eventId);
            if (event.slots.length > 0 && event.slots.some(s => s.memberId !== null)) throw new Error('이미 배정된 인원이 있습니다. 배분 초기화 후 다시 시도해주세요.');
            const eventDate = planningDay(event.startsAt);
            const blocked = new Set((state.blockedDates ?? []).filter(b => b.date === eventDate).map(b => b.memberId));
            // 이 일정보다 앞선 일정 중 가장 가까운 것을 먼저 쓰고, 앞선 일정이 없을 때만 이후 일정을 씁니다.
            const start = Date.parse(event.startsAt);
            const isBefore = (e: TeamSchedule) => Date.parse(e.startsAt) < start;
            const candidates = state.events
                .filter(e => e.id !== event.id && !e.cancelled && e.kind === event.kind && e.slots.some(s => s.memberId))
                .sort((a, b) => Number(isBefore(b)) - Number(isBefore(a)) || Math.abs(start - Date.parse(a.startsAt)) - Math.abs(start - Date.parse(b.startsAt)));
            if (candidates.length === 0) throw new Error('복사할 수 있는 이전 일정이 없습니다.');
            const source = candidates[0];
            if (event.slots.length === 0) {
                // No slots yet — copy entire slot structure from source
                for (const src of source.slots) {
                    let candidateId: string | null = null;
                    if (src.memberId && members.some(m => m.userId === src.memberId) && !blocked.has(src.memberId)) {
                        try { available(event, src.memberId); candidateId = src.memberId; } catch { candidateId = null; }
                    }
                    event.slots.push({ id: createClientId(), role: src.role, memberId: candidateId, attendance: 'pending', volunteers: [] });
                }
            } else {
                // Slots exist but are empty — try to fill from source
                for (const slot of event.slots) {
                    if (slot.memberId !== null) continue;
                    // 같은 파트가 여러 자리면(보컬 2~3명 등) 이미 채운 사람은 겹침으로 걸러지므로 다음 원본 자리를 시도합니다.
                    for (const src of source.slots) {
                        if (src.role !== slot.role || !src.memberId || blocked.has(src.memberId) || !members.some(m => m.userId === src.memberId)) continue;
                        try { available(event, src.memberId); slot.memberId = src.memberId; slot.attendance = 'pending'; break; } catch { /* 다음 후보 */ }
                    }
                }
            }
            const filledCount = event.slots.filter(s => s.memberId !== null).length;
            notify(everyone, '지난 배정을 자동으로 복사했어요', `${event.title} ← ${source.title} (${filledCount}명 배정)`, 'schedule', event.id);
            break;
        }
        case 'schedule.sendDutyReminder': {
            manage();
            const event = eventById(command.eventId);
            const pendingSlots = event.slots.filter(s => s.memberId && s.attendance === 'pending');
            if (pendingSlots.length === 0) throw new Error('참석 응답 대기 중인 팀원이 없습니다.');
            const nowIso = new Date().toISOString();
            for (const s of pendingSlots) {
                s.invitedAt = nowIso;
            }
            const pendingMemberIds = [...new Set(pendingSlots.map(s => s.memberId!))];
            const eventDate = planningDate(event.startsAt);
            notify(
                pendingMemberIds,
                '섬김 참석 여부를 확정해주세요',
                `${event.title} (${eventDate}) 섬김 참석 여부를 확인해주세요.`,
                'schedule',
                event.id,
                true
            );
            break;
        }
        case 'slot.sendInvite': {
            manage();
            const event = eventById(command.eventId);
            const slot = slotById(event, command.slotId);
            if (!slot.memberId) throw new Error('초대할 대상 팀원이 배정되어 있지 않습니다.');
            slot.invitedAt = new Date().toISOString();
            const eventDate = planningDate(event.startsAt);
            const customNoteText = command.customNote ? `\n안내: ${command.customNote}` : '';
            notify(
                [slot.memberId],
                '사역 초대 알림',
                `${event.title} (${eventDate}) · ${worshipRoles[slot.role]} 섬김에 초대되었습니다.${customNoteText}\n참석 여부를 확인해주세요.`,
                'schedule',
                event.id,
                true
            );
            break;
        }
        case 'schedule.sendInvites': {
            manage();
            const event = eventById(command.eventId);
            const target = command.target ?? 'pending';
            const targetSlots = target === 'all'
                ? event.slots.filter(s => s.memberId !== null)
                : event.slots.filter(s => s.memberId !== null && s.attendance === 'pending');
            if (targetSlots.length === 0) {
                throw new Error(target === 'all' ? '배정된 팀원이 없습니다.' : '참석 응답 대기 중인 팀원이 없습니다.');
            }
            const nowIso = new Date().toISOString();
            for (const s of targetSlots) {
                s.invitedAt = nowIso;
            }
            const uniqueMemberIds = [...new Set(targetSlots.map(s => s.memberId!))];
            const eventDate = planningDate(event.startsAt);
            const customNoteText = command.customNote ? `\n안내: ${command.customNote}` : '';
            notify(
                uniqueMemberIds,
                '사역 초대 알림',
                `${event.title} (${eventDate}) 섬김에 초대되었습니다.${customNoteText}\n참석 여부를 확정해주세요.`,
                'schedule',
                event.id,
                true
            );
            break;
        }
        case 'event.createMonthlySundays': {
            manage();
            const { year, month, startHour, startMinute, endHour, endMinute, title, location, templateKey } = command;
            const pad = (n: number) => String(n).padStart(2, '0');
            const sundays: Date[] = [];
            const date = new Date(year, month - 1, 1);
            while (date.getMonth() === month - 1) {
                if (date.getDay() === 0) {
                    sundays.push(new Date(date));
                }
                date.setDate(date.getDate() + 1);
            }
            if (sundays.length === 0) throw new Error('해당 월에 주일(일요일)이 없습니다.');
            if (state.events.length + sundays.length > 200) throw new Error('일정 보관 한도에 도달했습니다.');

            const template = templateKey ? scheduleTemplates[templateKey] : undefined;
            const newEvents: TeamSchedule[] = [];
            for (const sun of sundays) {
                const y = sun.getFullYear();
                const m = pad(sun.getMonth() + 1);
                const d = pad(sun.getDate());
                const startsAt = `${y}-${m}-${d}T${pad(startHour)}:${pad(startMinute)}:00+09:00`;
                const endsAt = `${y}-${m}-${d}T${pad(endHour)}:${pad(endMinute)}:00+09:00`;
                const startMs = Date.parse(startsAt);
                const endMs = Date.parse(endsAt);
                if (endMs <= startMs) throw new Error('종료 시간은 시작 시간 이후여야 합니다.');

                const slots: ScheduleSlot[] = template
                    ? template.roles.map(r => ({
                        id: createClientId(),
                        role: r,
                        memberId: null,
                        attendance: 'pending',
                        volunteers: [],
                    }))
                    : [];

                newEvents.push({
                    id: createClientId(),
                    title,
                    kind: 'worship',
                    // 다른 일정과 같은 UTC 형식으로 저장합니다.
                    startsAt: new Date(startMs).toISOString(),
                    endsAt: new Date(endMs).toISOString(),
                    location: location ?? '',
                    notes: '',
                    cancelled: false,
                    slots,
                });
            }
            state.events.unshift(...newEvents);
            notify(everyone, '월간 주일예배 일정이 일괄 등록되었어요', `${title} (${year}년 ${month}월 · ${sundays.length}회)`, 'schedule', newEvents[0].id);
            break;
        }
        case 'rotation.save': {
            manage();
            if (state.rotations.length >= 20 && !command.rotationId) throw new Error('로테이션은 최대 20개까지 등록할 수 있습니다.');
            const existing = command.rotationId ? state.rotations.find(r => r.id === command.rotationId) : undefined;
            if (command.rotationId && !existing) throw new Error('로테이션을 찾지 못했습니다.');
            const teams = command.group.cycleType === 'team' ? command.group.teams ?? [] : [];
            const individuals = command.group.cycleType === 'individual' ? command.group.members ?? [] : [];
            const validateMembers = (ids: string[]) => {
                if (new Set(ids).size !== ids.length) throw new Error('같은 순번에 팀원을 중복 등록할 수 없습니다.');
                if (ids.some(mid => !members.some(member => member.userId === mid))) throw new Error('이 팀의 팀원만 등록할 수 있습니다.');
            };
            if (command.group.cycleType === 'team') {
                if (teams.length < 2 || teams.length > 5 || teams.some(team => !team.memberIds.length)) throw new Error('2~5개 조에 각각 최소 1명 이상의 팀원을 등록해주세요.');
                if (new Set(teams.map(team => team.id)).size !== teams.length) throw new Error('조 식별자는 중복될 수 없습니다.');
                teams.forEach(team => validateMembers(team.memberIds));
            } else {
                if (individuals.length < 2) throw new Error('개인 순번제는 최소 2명의 팀원을 등록해주세요.');
                validateMembers(individuals);
            }
            const total = command.group.cycleType === 'team' ? teams.length : individuals.length;
            const rot: RotationGroup = {
                id: existing?.id ?? createClientId(),
                name: command.group.name,
                targetRole: command.group.targetRole,
                cycleType: command.group.cycleType,
                teams,
                members: individuals,
                currentStep: (command.group.currentStep ?? existing?.currentStep ?? 0) % total,
                notes: command.group.notes ?? '',
            };
            if (existing) Object.assign(existing, rot); else state.rotations.push(rot);
            notify(everyone, existing ? '로테이션 설정이 변경되었어요' : '새 로테이션이 등록되었어요', rot.name, 'rotation', rot.id);
            break;
        }
        case 'rotation.remove': {
            manage();
            const prevCount = state.rotations.length;
            state.rotations = state.rotations.filter(r => r.id !== command.rotationId);
            if (state.rotations.length === prevCount) throw new Error('로테이션을 찾지 못했습니다.');
            break;
        }
        case 'rotation.step': {
            manage();
            const rot = state.rotations.find(r => r.id === command.rotationId);
            if (!rot) throw new Error('로테이션을 찾지 못했습니다.');
            const total = rot.cycleType === 'team' ? (rot.teams?.length ?? 0) : (rot.members?.length ?? 0);
            if (total === 0) throw new Error('순번을 진행할 팀이나 팀원이 등록되어 있지 않습니다.');
            rot.currentStep = command.direction === 'next' ? (rot.currentStep + 1) % total : (rot.currentStep - 1 + total) % total;
            break;
        }
        case 'rotation.apply': {
            manage();
            const rot = state.rotations.find(r => r.id === command.rotationId);
            if (!rot) throw new Error('로테이션을 찾지 못했습니다.');
            const event = eventById(command.eventId);
            const teams = rot.teams ?? [];
            const individuals = rot.members ?? [];
            const activeTeam = rot.cycleType === 'team' ? teams[rot.currentStep % teams.length] : undefined;
            const assignees = rot.cycleType === 'team' ? activeTeam?.memberIds ?? [] : individuals.length ? [individuals[rot.currentStep % individuals.length]] : [];
            if (!assignees.length) throw new Error('현재 순번에 등록된 팀원이 없습니다.');
            // Commit the entire group or reject it; never report a partially applied roster as successful.
            for (const memberId of assignees) {
                const member = members.find(m => m.userId === memberId);
                if (!member) throw new Error('현재 순번에 이전 팀원이 있습니다. 로테이션을 다시 등록해주세요.');
                available(event, memberId);
                const roleToAssign = rot.targetRole !== 'all' ? rot.targetRole : member.role;
                const vacantSlot = event.slots.find(s => s.memberId === null && (s.role === roleToAssign || s.role === 'member'));
                if (vacantSlot) {
                    vacantSlot.memberId = memberId;
                    vacantSlot.role = roleToAssign;
                    vacantSlot.attendance = 'pending';
                    vacantSlot.volunteers = [];
                    closeSlotAlerts(event.id, vacantSlot.id);
                } else {
                    if (event.slots.length >= 50) throw new Error('한 일정에 최대 50명을 배치할 수 있습니다.');
                    event.slots.push({ id: createClientId(), role: roleToAssign, memberId, attendance: 'pending', volunteers: [] });
                }
            }
            notify(everyone, '로테이션 배정이 적용되었어요', `${event.title} · ${rot.name} · ${assignees.length}명`, 'schedule', event.id);
            break;
        }
        case 'rotation.batchApply': {
            manage();
            const rot = state.rotations.find(r => r.id === command.rotationId);
            if (!rot) throw new Error('로테이션을 찾지 못했습니다.');
            const teams = rot.teams ?? [];
            const individuals = rot.members ?? [];
            const totalSteps = rot.cycleType === 'team' ? teams.length : individuals.length;
            if (totalSteps === 0) throw new Error('로테이션에 등록된 조 또는 팀원이 없습니다.');
            let appliedEventsCount = 0;
            // 들어갈 수 있는 사람만 배정하고, 빠진 팀원과 이유는 완료 알림에 남깁니다.
            const skipped: string[] = [];
            for (const eventId of command.eventIds) {
                const event = eventById(eventId);
                const step = rot.currentStep % totalSteps;
                const activeTeam = rot.cycleType === 'team' ? teams[step] : undefined;
                const assignees = rot.cycleType === 'team' ? activeTeam?.memberIds ?? [] : individuals.length ? [individuals[step]] : [];
                if (!assignees.length) continue;
                const day = planningDay(event.startsAt);
                const skip = (name: string, reason: string) => skipped.push(`${name}(${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))} ${reason})`);
                for (const memberId of assignees) {
                    const member = members.find(m => m.userId === memberId);
                    if (!member) { skip('이전 팀원', '팀을 나감'); continue; }
                    try { available(event, memberId); } catch { skip(member.name, '겹치는 일정'); continue; }
                    const roleToAssign = rot.targetRole !== 'all' ? rot.targetRole : member.role;
                    const vacantSlot = event.slots.find(s => s.memberId === null && (s.role === roleToAssign || s.role === 'member'));
                    if (vacantSlot) {
                        vacantSlot.memberId = memberId;
                        vacantSlot.role = roleToAssign;
                        vacantSlot.attendance = 'pending';
                        vacantSlot.volunteers = [];
                        closeSlotAlerts(event.id, vacantSlot.id);
                    } else if (event.slots.length < 50) {
                        event.slots.push({ id: createClientId(), role: roleToAssign, memberId, attendance: 'pending', volunteers: [] });
                    } else {
                        skip(member.name, '인원 한도');
                    }
                }
                rot.currentStep = (rot.currentStep + 1) % totalSteps;
                appliedEventsCount++;
            }
            notify(everyone, '로테이션 일괄 배정이 완료되었어요', `${rot.name} · ${appliedEventsCount}개 일정${skipped.length ? `${BATCH_SKIP_MARK}${skipped.length}명: ${skipped.join(', ')}` : ''}`, 'schedule', command.eventIds[0], false, skipped.length > 0);
            break;
        }
        case 'member.blockDate': {
            state.blockedDates = state.blockedDates ?? [];
            if (state.blockedDates.some(b => b.memberId === userId && b.date === command.date)) throw new Error('이미 등록된 불가일입니다.');
            if (state.blockedDates.filter(b => b.memberId === userId).length >= 60) throw new Error('불가일은 최대 60일까지 등록할 수 있습니다.');
            state.blockedDates.push({ memberId: userId, date: command.date, reason: command.reason });
            notify(managers, '불가일 등록', `${actor.name} · ${command.date}${command.reason ? ` (${command.reason})` : ''}`, 'schedule', userId);
            break;
        }
        case 'member.unblockDate': {
            state.blockedDates = state.blockedDates ?? [];
            const idx = state.blockedDates.findIndex(b => b.memberId === userId && b.date === command.date);
            if (idx === -1) throw new Error('등록된 불가일이 아닙니다.');
            state.blockedDates.splice(idx, 1);
            break;
        }
    }
    state.notifications = state.notifications.slice(0, 500);
    state.alerts = [...state.alerts.filter(item => !item.resolvedAt), ...state.alerts.filter(item => item.resolvedAt).slice(0, 200)];
    return state;
}
