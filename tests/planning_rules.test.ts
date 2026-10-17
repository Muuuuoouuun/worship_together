import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanningCommand, planningForViewer, previewRotationBatchSkips } from '../lib/planning';
import { emptyPlanningState, planningDay, planningTime, type PlanningCommand, type PlanningState, type ScheduleInput } from '../types/planning';
import type { TeamMember } from '../types/team';
import { buildPlanningView } from '../components/conti/planningBridge';

const members: TeamMember[] = [
    { userId: 'lead', name: '인도자', role: 'leader', permission: 'owner' },
    { userId: 'v1', name: '보컬1', role: 'vocal', permission: 'member' },
    { userId: 'v2', name: '보컬2', role: 'vocal', permission: 'member' },
    { userId: 'v3', name: '보컬3', role: 'vocal', permission: 'member' },
    { userId: 'keys', name: '건반', role: 'keyboard', permission: 'member' },
];

const send = (state: PlanningState, actor: string, command: PlanningCommand) => applyPlanningCommand(state, members, actor, command);
const input = (date: string, start: string, end: string, overrides: Partial<ScheduleInput> = {}): ScheduleInput => ({
    title: '주일 예배', kind: 'worship', startsAt: `${date}T${start}:00+09:00`, endsAt: `${date}T${end}:00+09:00`, location: '본당', notes: '', ...overrides,
});
const eventOf = (state: PlanningState, eventId: string) => state.events.find((event) => event.id === eventId)!;

test('한국 시간 날짜·시각은 UTC 저장값과 +09:00 저장값에서 같다', () => {
    assert.equal(planningDay('2026-10-17T22:30:00.000Z'), '2026-10-18');
    assert.equal(planningTime('2026-10-17T22:30:00.000Z'), '07:30');
    assert.equal(planningDay('2026-10-18T07:30:00+09:00'), '2026-10-18');
    assert.equal(planningTime('2026-10-18T07:30:00+09:00'), '07:30');
});

test('오전 9시 이전 예배도 한국 날짜의 불가일로 자동 배정을 피한다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-10-18', '07:30', '09:00') });
    const eventId = state.events[0].id;
    assert.equal(state.events[0].startsAt, '2026-10-17T22:30:00.000Z', '일반 일정은 UTC로 저장된다');
    state = send(state, 'lead', { type: 'slot.save', eventId, role: 'vocal', memberId: null });
    state = send(state, 'v1', { type: 'member.blockDate', date: '2026-10-18' });
    state = send(state, 'v2', { type: 'member.blockDate', date: '2026-10-17' });
    state = send(state, 'lead', { type: 'slots.autoAssign', eventId });
    assert.equal(eventOf(state, eventId).slots[0].memberId, 'v2', '예배 당일(10/18) 불가인 v1은 빼고, 전날만 불가인 v2는 배정한다');
});

test('담당자를 바꾸면 이전 사람의 초대·응답·불참 사유가 새 담당자에게 넘어가지 않는다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-10-25', '11:00', '12:30') });
    const eventId = state.events[0].id;
    state = send(state, 'lead', { type: 'slot.save', eventId, role: 'vocal', memberId: 'v1' });
    const slotId = eventOf(state, eventId).slots[0].id;
    state = send(state, 'lead', { type: 'slot.sendInvite', eventId, slotId });
    state = send(state, 'v1', { type: 'attendance.set', eventId, slotId, attendance: 'absent', reason: '시험/학업' });

    const reassigned = eventOf(send(state, 'lead', { type: 'slot.save', eventId, slotId, role: 'vocal', memberId: 'v2' }), eventId).slots[0];
    assert.equal(reassigned.memberId, 'v2');
    assert.equal(reassigned.attendance, 'pending');
    assert.equal(reassigned.invitedAt, undefined);
    assert.equal(reassigned.respondedAt, undefined);
    assert.equal(reassigned.declineReason, undefined);

    state = send(state, 'v3', { type: 'slot.volunteer', eventId, slotId });
    const accepted = eventOf(send(state, 'lead', { type: 'slot.accept', eventId, slotId, memberId: 'v3' }), eventId).slots[0];
    assert.equal(accepted.memberId, 'v3');
    assert.equal(accepted.invitedAt, undefined);
    assert.equal(accepted.respondedAt, undefined);
    assert.equal(accepted.declineReason, undefined);

    const sameMemberRoleChange = eventOf(send(state, 'lead', { type: 'slot.save', eventId, slotId, role: 'leader', memberId: 'v1' }), eventId).slots[0];
    assert.equal(sameMemberRoleChange.declineReason, '시험/학업', '같은 사람의 역할만 바꾸면 응답 기록을 유지한다');
});

test('같은 시간대 다른 자리에 확정된 지원자는 후보로 남되 확정 버튼은 막힌다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-11-01', '11:00', '12:30') });
    const eventId = state.events[0].id;
    state = send(state, 'lead', { type: 'slot.save', eventId, role: 'vocal', memberId: null });
    state = send(state, 'lead', { type: 'slot.save', eventId, role: 'keyboard', memberId: null });
    const [vocalSlot, keysSlot] = eventOf(state, eventId).slots.map((slot) => slot.id);
    for (const slotId of [vocalSlot, keysSlot]) {
        state = send(state, 'v3', { type: 'slot.volunteer', eventId, slotId });
        state = send(state, 'v2', { type: 'slot.volunteer', eventId, slotId });
    }
    state = send(state, 'lead', { type: 'slot.accept', eventId, slotId: vocalSlot, memberId: 'v3' });

    assert.deepEqual(eventOf(state, eventId).slots.find((slot) => slot.id === keysSlot)!.volunteers, ['v3', 'v2'], '후보는 지우지 않는다 (겹친 배치가 풀리면 다시 확정할 수 있다)');
    const keys = buildPlanningView({ state: planningForViewer(state, members, 'lead'), members, userId: 'lead', today: '2026-10-17', now: new Date('2026-10-17T03:00:00Z') })
        .services[0].assignments.find((item) => item.slotId === keysSlot)!;
    assert.deepEqual(keys.volunteers.map((person) => [person.id, person.placed]), [['v3', true], ['v2', false]], '확정해도 실패할 지원자를 표시한다');
    assert.throws(() => send(state, 'lead', { type: 'slot.accept', eventId, slotId: keysSlot, memberId: 'v3' }), /겹치는 일정/);
    assert.doesNotThrow(() => send(state, 'lead', { type: 'slot.accept', eventId, slotId: keysSlot, memberId: 'v2' }));
});

test('지난 배정 복사는 같은 파트의 여러 자리를 원본 순서대로 모두 채운다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.createWithTemplate', input: input('2026-11-08', '11:00', '12:30'), templateKey: 'vocalTeam' });
    const sourceId = state.events[0].id;
    const vocals = eventOf(state, sourceId).slots.filter((slot) => slot.role === 'vocal');
    for (const [index, memberId] of ['v1', 'v2', 'v3'].entries()) {
        state = send(state, 'lead', { type: 'slot.save', eventId: sourceId, slotId: vocals[index].id, role: 'vocal', memberId });
    }
    state = send(state, 'v2', { type: 'member.blockDate', date: '2026-11-15' });
    state = send(state, 'lead', { type: 'event.createWithTemplate', input: input('2026-11-15', '11:00', '12:30'), templateKey: 'vocalTeam' });
    const targetId = state.events[0].id;
    state = send(state, 'lead', { type: 'slots.autoFillFromRecent', eventId: targetId });
    assert.deepEqual(eventOf(state, targetId).slots.filter((slot) => slot.role === 'vocal').map((slot) => slot.memberId), ['v1', 'v3', null], '불가일인 v2만 비워 둔다');
});

test('월간 주일 일괄 생성도 다른 일정처럼 UTC로 저장한다', () => {
    const state = send(emptyPlanningState(), 'lead', { type: 'event.createMonthlySundays', year: 2026, month: 10, startHour: 7, startMinute: 30, endHour: 9, endMinute: 0, title: '1부 예배' });
    const sunday = state.events.find((event) => planningDay(event.startsAt) === '2026-10-18')!;
    assert.equal(sunday.startsAt, '2026-10-17T22:30:00.000Z');
    assert.equal(sunday.endsAt, '2026-10-18T00:00:00.000Z');
    assert.deepEqual(state.events.map((event) => planningDay(event.startsAt)).sort(), ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
});

test('팀 배치·이번 주 일정은 이전에 +09:00 형식으로 저장된 일정이 섞여도 시간순으로 놓인다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-10-18', '07:30', '09:00', { title: '1부 예배' }) });
    // 이전 버전의 월간 주일 일괄 생성은 '+09:00' 문자열을 그대로 저장했습니다.
    state = { ...state, events: state.events.map((event) => ({ ...event, startsAt: '2026-10-18T07:30:00+09:00', endsAt: '2026-10-18T09:00:00+09:00' })) };
    state = send(state, 'lead', { type: 'event.save', input: input('2026-10-18', '09:30', '10:30', { title: '2부 예배' }) });
    const day = state.events.filter((event) => planningDay(event.startsAt) === '2026-10-18');
    assert.deepEqual(day.map((event) => event.startsAt).sort(), ['2026-10-18T00:30:00.000Z', '2026-10-18T07:30:00+09:00'], '두 형식이 함께 저장된 상태');
    const result = buildPlanningView({ state: planningForViewer(state, members, 'lead'), members, userId: 'lead', today: '2026-10-17', now: new Date('2026-10-17T03:00:00Z') });
    assert.deepEqual(result.services.filter((service) => service.date === '2026-10-18').map((service) => [service.title, service.time]), [['1부 예배', '07:30'], ['2부 예배', '09:30']]);
    assert.deepEqual(result.events.filter((event) => event.date === '2026-10-18').map((event) => event.title), ['1부 예배', '2부 예배']);
});

test('지난 배정 복사는 다음 주보다 지난주 배정을 먼저 가져온다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-10-11', '11:00', '12:00') });
    state = send(state, 'lead', { type: 'slot.save', eventId: state.events[0].id, role: 'vocal', memberId: 'v1' });
    state = send(state, 'lead', { type: 'event.save', input: input('2026-10-18', '11:00', '12:00') });
    const targetId = state.events[0].id;
    state = send(state, 'lead', { type: 'event.save', input: input('2026-10-25', '11:00', '12:00') });
    const nextWeekId = state.events[0].id;
    state = send(state, 'lead', { type: 'slot.save', eventId: nextWeekId, role: 'vocal', memberId: 'v2' });

    const copied = send(state, 'lead', { type: 'slots.autoFillFromRecent', eventId: targetId });
    assert.deepEqual(eventOf(copied, targetId).slots.map((slot) => slot.memberId), ['v1'], '같은 7일 거리여도 지난주(10/11)가 원본');

    const onlyFuture = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-10-18', '11:00', '12:00') });
    let future = send(onlyFuture, 'lead', { type: 'event.save', input: input('2026-10-25', '11:00', '12:00') });
    future = send(future, 'lead', { type: 'slot.save', eventId: future.events[0].id, role: 'vocal', memberId: 'v2' });
    const firstId = future.events.find((event) => planningDay(event.startsAt) === '2026-10-18')!.id;
    assert.deepEqual(eventOf(send(future, 'lead', { type: 'slots.autoFillFromRecent', eventId: firstId }), firstId).slots.map((slot) => slot.memberId), ['v2'], '앞선 일정이 없으면 이후 일정을 쓴다');
});

test('로테이션 일괄 배정은 들어갈 수 있는 사람만 배정하고 빠진 팀원과 이유를 알린다', () => {
    let state = send(emptyPlanningState(), 'lead', { type: 'event.save', input: input('2026-11-01', '11:00', '12:00') });
    const first = state.events[0].id;
    state = send(state, 'lead', { type: 'event.save', input: input('2026-11-08', '11:00', '12:00') });
    const second = state.events[0].id;
    state = send(state, 'lead', { type: 'event.save', input: input('2026-11-08', '10:30', '11:30', { title: '다른 행사', kind: 'rehearsal' }) });
    state = send(state, 'lead', { type: 'slot.save', eventId: state.events[0].id, role: 'vocal', memberId: 'v2' });
    state = send(state, 'lead', { type: 'rotation.save', group: { name: '보컬조', targetRole: 'vocal', cycleType: 'team', teams: [{ id: 't1', name: '1조', memberIds: ['v1', 'v3'] }, { id: 't2', name: '2조', memberIds: ['v1', 'v2'] }] } });
    const command: PlanningCommand = { type: 'rotation.batchApply', rotationId: state.rotations![0].id, eventIds: [first, second] };

    const preview = previewRotationBatchSkips(planningForViewer(state, members, 'lead'), members, 'lead', command);
    assert.equal(preview, '빠진 팀원 1명: 보컬2(11/8 겹치는 일정)');

    const after = send(state, 'lead', command);
    assert.deepEqual(eventOf(after, first).slots.map((slot) => slot.memberId), ['v1', 'v3']);
    assert.deepEqual(eventOf(after, second).slots.map((slot) => slot.memberId), ['v1'], '충돌한 보컬2만 빠진다');
    const notice = after.notifications[0];
    assert.equal(notice.body, '보컬조 · 2개 일정 · 빠진 팀원 1명: 보컬2(11/8 겹치는 일정)');
    assert.ok(notice.recipientIds.includes('lead'), '배정한 관리자 본인도 빠진 팀원을 알림으로 확인한다');

    const clean = send(state, 'lead', { ...command, eventIds: [first] });
    assert.equal(clean.notifications[0].body, '보컬조 · 1개 일정');
    assert.ok(!clean.notifications[0].recipientIds.includes('lead'), '빠진 사람이 없으면 본인에게는 알리지 않는다 (기존과 같음)');
    assert.equal(previewRotationBatchSkips(planningForViewer(state, members, 'lead'), members, 'lead', { ...command, eventIds: [first] }), '');
});
