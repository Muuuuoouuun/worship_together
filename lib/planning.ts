import { z } from 'zod';
import { createClientId } from './clientId';
import { worshipRoles, type TeamMember } from '../types/team';
import { canManagePlanning, emptyPlanningState, requestKinds, scheduleTemplates, type PlanningCommand, type PlanningState, type RotationGroup, type TeamSchedule } from '../types/planning';

const id = z.string().min(1).max(200);
const body = z.string().trim().min(1, '내용을 입력해주세요.').max(1500);
const role = z.enum(Object.keys(worshipRoles) as [keyof typeof worshipRoles, ...Array<keyof typeof worshipRoles>]);
const scheduleInput = z.object({ title: z.string().trim().min(1).max(80), kind: z.enum(['rehearsal', 'worship']), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), location: z.string().trim().max(120), notes: z.string().trim().max(1500) });
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
    z.object({ type: z.literal('event.save'), eventId: id.optional(), input: scheduleInput }),
    z.object({ type: z.literal('event.cancel'), eventId: id }),
    z.object({ type: z.literal('event.createRecurring'), input: scheduleInput, weeksCount: z.number().int().min(1).max(12) }),
    z.object({ type: z.literal('slot.save'), eventId: id, slotId: id.optional(), role, memberId: id.nullable() }),
    z.object({ type: z.literal('slot.remove'), eventId: id, slotId: id }),
    z.object({ type: z.literal('slots.applyTemplate'), eventId: id, templateKey: z.enum(['standard', 'full', 'acoustic', 'vocalTeam']) }),
    z.object({ type: z.literal('slots.copyFromEvent'), targetEventId: id, sourceEventId: id }),
    z.object({ type: z.literal('attendance.set'), eventId: id, slotId: id, attendance: z.enum(['confirmed', 'absent']), reason: z.string().trim().max(500) }),
    z.object({ type: z.literal('alert.create'), eventId: id, slotId: id.nullable(), kind: z.enum(['substitute', 'notice']), body }),
    z.object({ type: z.literal('alert.resolve'), alertId: id }),
    z.object({ type: z.literal('slot.volunteer'), eventId: id, slotId: id }),
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
    z.object({ type: z.literal('notification.read'), notificationId: id }),
]);
const stamp = z.string();
const stateSchema = z.object({
    version: z.literal(1),
    requests: z.array(z.object({ id, setlistId: z.string(), setlistTitle: z.string(), kind: z.enum(['question', 'reminder', 'change']), body: z.string(), authorId: id, leaderId: id, status: z.enum(['open', 'reviewing', 'resolved']), createdAt: stamp, updatedAt: stamp, replies: z.array(z.object({ id, authorId: id, body: z.string(), createdAt: stamp })) })),
    events: z.array(scheduleInput.extend({ id, cancelled: z.boolean(), slots: z.array(z.object({ id, role, memberId: id.nullable(), attendance: z.enum(['pending', 'confirmed', 'absent']), volunteers: z.array(id) })) })),
    alerts: z.array(z.object({ id, eventId: id, slotId: id.nullable(), kind: z.enum(['absence', 'substitute', 'notice']), body: z.string(), authorId: id, createdAt: stamp, resolvedAt: stamp.nullable() })),
    notifications: z.array(z.object({ id, title: z.string(), body: z.string(), urgent: z.boolean(), target: z.enum(['requests', 'schedule']), entityId: id, recipientIds: z.array(id), readBy: z.array(id), createdAt: stamp })),
    rotations: z.array(rotationGroupSchema).optional().default([]),
});
export function parsePlanningState(value: unknown): PlanningState {
    if (value == null) return emptyPlanningState();
    const result = stateSchema.safeParse(value);
    if (!result.success) throw new Error('저장된 일정 자료를 읽지 못했습니다. 새로고침 후 다시 확인해주세요.');
    return { ...result.data, rotations: result.data.rotations ?? [] };
}
export function planningForViewer(state: PlanningState, members: TeamMember[], userId: string): PlanningState {
    if (!members.some(member => member.userId === userId)) throw new Error('이 팀에 접근할 수 없습니다.');
    const owner = members.some(member => member.userId === userId && member.permission === 'owner');
    return { ...state, requests: state.requests.filter(item => item.authorId === userId || item.leaderId === userId || owner), notifications: state.notifications.filter(item => item.recipientIds.includes(userId)) };
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
    const notify = (recipientIds: string[], title: string, text: string, target: 'requests' | 'schedule', entityId: string, urgent = false) => {
        const recipients = [...new Set(recipientIds)].filter(recipient => recipient !== userId && members.some(member => member.userId === recipient));
        if (recipients.length) state.notifications.unshift({ id: createClientId(), title, body: text, target, entityId, urgent, recipientIds: recipients, readBy: [], createdAt: now });
    };
    const everyone = members.map(member => member.userId);
    const eventById = (eventId: string) => { const event = state.events.find(item => item.id === eventId); if (!event || event.cancelled) throw new Error('일정이 없거나 취소되었습니다.'); return event; };
    const slotById = (event: TeamSchedule, slotId: string) => { const slot = event.slots.find(item => item.id === slotId); if (!slot) throw new Error('배치 항목을 찾지 못했습니다.'); return slot; };
    const closeSlotAlerts = (eventId: string, slotId: string) => { state.alerts.filter(item => item.eventId === eventId && item.slotId === slotId && !item.resolvedAt).forEach(item => { item.resolvedAt = now; }); };
    const available = (event: TeamSchedule, memberId: string | null, slotId?: string) => {
        if (!memberId) return;
        if (!members.some(member => member.userId === memberId)) throw new Error('이 팀의 팀원만 배치할 수 있습니다.');
        const clash = state.events.find(other => !other.cancelled && Date.parse(other.startsAt) < Date.parse(event.endsAt) && Date.parse(event.startsAt) < Date.parse(other.endsAt) && other.slots.some(slot => slot.id !== slotId && slot.memberId === memberId && slot.attendance !== 'absent'));
        if (clash) throw new Error(`이미 겹치는 일정에 배치되어 있습니다: ${clash.title}`);
    };
    const urgent = (event: TeamSchedule, slotId: string | null, kind: 'absence' | 'substitute' | 'notice', text: string) => {
        if (slotId && state.alerts.some(item => item.eventId === event.id && item.slotId === slotId && !item.resolvedAt)) throw new Error('이 배치에는 이미 열린 긴급 요청이 있습니다.');
        const alertId = createClientId();
        state.alerts.unshift({ id: alertId, eventId: event.id, slotId, kind, body: text, authorId: userId, createdAt: now, resolvedAt: null });
        notify(everyone, kind === 'absence' ? '결석 · 대체 인원이 필요해요' : kind === 'substitute' ? '대체 인원을 구해요' : '긴급 안내', `${event.title} · ${text}`, 'schedule', event.id, true);
    };
    switch (command.type) {
        case 'request.create': {
            if (!managers.includes(command.leaderId)) throw new Error('수신할 인도자 또는 관리자를 선택해주세요.');
            if (state.requests.length >= 300) throw new Error('요청 보관 한도에 도달했습니다.');
            const requestId = createClientId();
            state.requests.unshift({ ...command, id: requestId, authorId: userId, status: 'open', createdAt: now, updatedAt: now, replies: [] });
            notify([command.leaderId], `콘티 ${requestKinds[command.kind]}`, `${command.setlistTitle} · ${command.body}`, 'requests', requestId);
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
            if (!existing && state.events.length >= 200) throw new Error('일정 보관 한도에 도달했습니다.');
            const event: TeamSchedule = { ...command.input, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), id: existing?.id ?? createClientId(), cancelled: false, slots: existing?.slots ?? [] };
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
        case 'slot.save': {
            manage(); const event = eventById(command.eventId);
            const existing = command.slotId ? slotById(event, command.slotId) : undefined;
            const sameMember = Boolean(existing && existing.memberId === command.memberId);
            if (sameMember && existing!.role === command.role) break;
            if (!sameMember || existing!.attendance !== 'absent') available(event, command.memberId, existing?.id);
            if (event.slots.length >= 50 && !existing) throw new Error('한 일정에 최대 50명을 배치할 수 있습니다.');
            const slot = { id: existing?.id ?? createClientId(), role: command.role, memberId: command.memberId, attendance: sameMember ? existing!.attendance : 'pending' as const, volunteers: sameMember ? existing!.volunteers : [] };
            const oldMember = existing?.memberId;
            if (existing) { Object.assign(existing, slot); if (!sameMember) closeSlotAlerts(event.id, slot.id); } else event.slots.push(slot);
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
            if (command.attendance === 'confirmed') { available(event, userId, slot.id); closeSlotAlerts(event.id, slot.id); slot.volunteers = []; notify(managers, '참석 응답', `${actor.name} · ${event.title}`, 'schedule', event.id); }
            else { closeSlotAlerts(event.id, slot.id); urgent(event, slot.id, 'absence', `${actor.name} · ${worshipRoles[slot.role]} 결석${command.reason ? `: ${command.reason}` : ''}`); }
            slot.attendance = command.attendance; break;
        }
        case 'alert.create': {
            const event = eventById(command.eventId);
            if (command.kind === 'notice') { manage(); urgent(event, null, 'notice', command.body); }
            else {
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
        case 'slot.accept': {
            manage(); const event = eventById(command.eventId); const slot = slotById(event, command.slotId);
            if (!slot.volunteers.includes(command.memberId)) throw new Error('지원한 팀원만 확정할 수 있습니다.');
            available(event, command.memberId, slot.id);
            const oldMember = slot.memberId;
            slot.memberId = command.memberId; slot.attendance = 'confirmed'; slot.volunteers = []; closeSlotAlerts(event.id, slot.id);
            notify(everyone, '대체 인원이 확정되었어요', `${event.title} · ${worshipRoles[slot.role]} · ${members.find(member => member.userId === command.memberId)!.name}${oldMember ? ' (배치 변경)' : ''}`, 'schedule', event.id);
            break;
        }
        case 'notification.read': {
            const notification = state.notifications.find(item => item.id === command.notificationId);
            if (!notification || !notification.recipientIds.includes(userId)) throw new Error('본인의 알림만 확인할 수 있습니다.');
            if (!notification.readBy.includes(userId)) notification.readBy.push(userId);
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
        case 'rotation.save': {
            manage();
            if (state.rotations.length >= 20 && !command.rotationId) throw new Error('로테이션은 최대 20개까지 등록할 수 있습니다.');
            const existing = command.rotationId ? state.rotations.find(r => r.id === command.rotationId) : undefined;
            const rot: RotationGroup = {
                id: existing?.id ?? createClientId(),
                name: command.group.name,
                targetRole: command.group.targetRole,
                cycleType: command.group.cycleType,
                teams: command.group.teams?.map(t => ({ id: t.id || createClientId(), name: t.name, memberIds: t.memberIds.filter(mid => members.some(m => m.userId === mid)) })) ?? [],
                members: command.group.members?.filter(mid => members.some(m => m.userId === mid)) ?? [],
                currentStep: command.group.currentStep ?? existing?.currentStep ?? 0,
                notes: command.group.notes ?? '',
            };
            if (existing) Object.assign(existing, rot); else state.rotations.push(rot);
            notify(everyone, existing ? '로테이션 설정이 변경되었어요' : '새 로테이션이 등록되었어요', rot.name, 'schedule', rot.id);
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
            if (rot.cycleType === 'team') {
                const teams = rot.teams ?? [];
                if (!teams.length) throw new Error('로테이션에 등록된 조가 없습니다.');
                const activeTeam = teams[rot.currentStep % teams.length];
                for (const memberId of activeTeam.memberIds) {
                    const member = members.find(m => m.userId === memberId);
                    if (!member) continue;
                    try { available(event, memberId); } catch { continue; }
                    const vacantSlot = event.slots.find(s => s.memberId === null && (s.role === member.role || s.role === 'member'));
                    if (vacantSlot) {
                        vacantSlot.memberId = memberId;
                        if (vacantSlot.role === 'member' && member.role !== 'member') vacantSlot.role = member.role;
                        vacantSlot.attendance = 'pending';
                    } else if (event.slots.length < 50) {
                        event.slots.push({
                            id: createClientId(),
                            role: member.role !== 'member' ? member.role : 'vocal',
                            memberId,
                            attendance: 'pending',
                            volunteers: [],
                        });
                    }
                }
                notify(everyone, '로테이션 조 배정이 적용되었어요', `${event.title} · ${rot.name} (${activeTeam.name})`, 'schedule', event.id);
            } else {
                const rotMembers = rot.members ?? [];
                if (!rotMembers.length) throw new Error('로테이션에 등록된 팀원이 없습니다.');
                const memberId = rotMembers[rot.currentStep % rotMembers.length];
                const member = members.find(m => m.userId === memberId);
                if (!member) throw new Error('선택된 순번의 팀원을 찾을 수 없습니다.');
                available(event, memberId);
                const roleToAssign = rot.targetRole !== 'all' ? rot.targetRole : (member.role !== 'member' ? member.role : 'vocal');
                const vacantSlot = event.slots.find(s => s.memberId === null && s.role === roleToAssign);
                if (vacantSlot) {
                    vacantSlot.memberId = memberId;
                    vacantSlot.attendance = 'pending';
                } else if (event.slots.length < 50) {
                    event.slots.push({
                        id: createClientId(),
                        role: roleToAssign,
                        memberId,
                        attendance: 'pending',
                        volunteers: [],
                    });
                }
                notify(everyone, '로테이션 담당자가 배정되었어요', `${event.title} · ${rot.name} (${member.name})`, 'schedule', event.id);
            }
            break;
        }
    }
    state.notifications = state.notifications.slice(0, 500);
    state.alerts = [...state.alerts.filter(item => !item.resolvedAt), ...state.alerts.filter(item => item.resolvedAt).slice(0, 200)];
    return state;
}
