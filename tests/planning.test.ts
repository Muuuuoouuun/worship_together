import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '../lib/planning';
import { TeamRepository } from '../lib/server/teamRepository';
import { emptyPlanningState, type PlanningCommand, type ScheduleInput } from '../types/planning';

const owner = { id: 'planning-owner', name: '소유자' };
const leader = { id: 'planning-leader', name: '담당 인도자' };
const author = { id: 'planning-author', name: '요청 작성자' };
const other = { id: 'planning-other', name: '다른 팀원' };
const otherLeader = { id: 'planning-other-leader', name: '다른 인도자' };
const people = [owner, leader, author, other, otherLeader];
const managerError = /인도자 또는 팀 관리자/;
const collisionError = /겹치는 일정/;
const cancelledError = /없거나 취소/;

function seed(repo: TeamRepository, joiningRepo = repo) {
    const team = repo.create('계획 테스트 팀', owner);
    const invite = repo.createInvite(team.id, owner.id);
    for (const person of people.slice(1)) assert.equal(joiningRepo.join(invite.token, person), team.id);
    repo.assignRole(team.id, owner.id, leader.id, 'leader');
    repo.assignRole(team.id, owner.id, otherLeader.id, 'leader');
    // Ownership must grant management even without the leader role.
    repo.assignRole(team.id, owner.id, owner.id, 'keyboard');
    return {
        repo, teamId: team.id,
        members: repo.list(owner.id).find(item => item.id === team.id)!.members,
        read: (actor = owner.id) => repo.planning(team.id, actor),
        send: (actor: string, command: PlanningCommand | unknown) => repo.updatePlanning(team.id, actor, command),
    };
}

type Fixture = ReturnType<typeof seed>;
function fixture(t: TestContext) {
    const repo = new TeamRepository(':memory:');
    t.after(() => repo.close());
    return seed(repo);
}

const schedule = (overrides: Partial<ScheduleInput> = {}): ScheduleInput => ({
    title: '주일 예배', kind: 'worship',
    startsAt: '2026-09-06T10:00:00+09:00', endsAt: '2026-09-06T11:00:00+09:00',
    location: '본당', notes: '', ...overrides,
});

function createEvent(f: Fixture, input = schedule(), actor = owner.id) {
    const before = new Set(f.read().events.map(event => event.id));
    const state = f.send(actor, { type: 'event.save', input });
    const event = state.events.find(item => !before.has(item.id));
    assert.ok(event, 'creation must return a new event');
    return event;
}

function addSlot(f: Fixture, eventId: string, memberId: string | null = author.id) {
    const before = new Set(f.read().events.find(event => event.id === eventId)!.slots.map(slot => slot.id));
    const state = f.send(owner.id, { type: 'slot.save', eventId, memberId, role: 'vocal' });
    const slot = state.events.find(event => event.id === eventId)!.slots.find(item => !before.has(item.id));
    assert.ok(slot, 'creation must return a new slot');
    return slot;
}

function createRequest(f: Fixture, actor = author.id, kind: 'question' | 'reminder' | 'change' = 'question') {
    return f.send(actor, {
        type: 'request.create', setlistId: '', setlistTitle: '  미등록 주일 콘티  ',
        kind, body: '  마지막 곡을 확인해 주세요.  ', leaderId: leader.id,
    }).requests[0];
}

function allViews(f: Fixture) {
    return people.map(person => f.read(person.id));
}

function rejectsAtomically(f: Fixture, actor: string, command: unknown, error: RegExp) {
    const before = allViews(f);
    assert.throws(() => f.send(actor, command), error);
    assert.deepEqual(allViews(f), before, 'rejection must preserve events, requests, alerts and every recipient notification');
}

test('domain commands preserve their input and validate persisted state and viewer membership', t => {
    const f = fixture(t);
    const before = emptyPlanningState();
    const state = applyPlanningCommand(before, f.members, author.id, {
        type: 'request.create', setlistId: '', setlistTitle: '콘티', kind: 'question', body: '질문', leaderId: leader.id,
    });
    assert.deepEqual(before, emptyPlanningState());
    assert.equal(state.requests.length, 1);
    const restored = parsePlanningState(JSON.parse(JSON.stringify(state)));
    assert.equal(restored.requests[0].id, state.requests[0].id);
    assert.equal(restored.requests[0].body, '질문');
    assert.deepEqual(restored.notifications, state.notifications);
    assert.deepEqual(parsePlanningState(null), emptyPlanningState());
    assert.throws(() => parsePlanningState({ ...state, events: [{}] }), /저장된 일정/);
    assert.equal(planningForViewer(state, f.members, other.id).requests.length, 0);
    assert.throws(() => planningForViewer(state, f.members, 'outsider'), /접근/);
    const snapshot = structuredClone(state);
    assert.throws(() => applyPlanningCommand(state, f.members, other.id, {
        type: 'request.reply', requestId: state.requests[0].id, body: '비공개 답변',
    }), /답변할 수 없습니다/);
    assert.deepEqual(state, snapshot);
    assert.throws(() => applyPlanningCommand(state, f.members, 'outsider', { type: 'event.save', input: schedule() }), /접근/);
});

test('repository scopes requests to author, target leader and owner, including mutation responses', t => {
    const f = fixture(t);
    const request = createRequest(f);
    for (const person of [author, leader, owner]) assert.deepEqual(f.read(person.id).requests.map(item => item.id), [request.id]);
    for (const person of [other, otherLeader]) {
        assert.deepEqual(f.read(person.id).requests, []);
        rejectsAtomically(f, person.id, { type: 'request.reply', requestId: request.id, body: '답변' }, /답변할 수 없습니다/);
        rejectsAtomically(f, person.id, { type: 'request.status', requestId: request.id, status: 'resolved' }, /수신 인도자 또는 관리자/);
    }
    const ownRequest = createRequest(f, other.id);
    assert.deepEqual(f.read(other.id).requests.map(item => item.id), [ownRequest.id]);
    assert.equal(f.read().requests.length, 2);
    assert.throws(() => f.repo.planning(f.teamId, 'outsider'), /접근/);
    rejectsAtomically(f, 'outsider', { type: 'request.reply', requestId: request.id, body: '답변' }, /접근/);
    const differentTeam = f.repo.create('별도 팀', other);
    assert.deepEqual(f.repo.planning(differentTeam.id, other.id).requests, []);
    assert.throws(() => f.repo.updatePlanning(differentTeam.id, other.id, { type: 'request.status', requestId: request.id, status: 'resolved' }), /찾지 못했습니다/);
});

test('request replies and statuses notify only the other participants with the request target', t => {
    const f = fixture(t);
    const request = createRequest(f);
    const initial = f.read(leader.id).notifications[0];
    assert.deepEqual(initial.recipientIds, [leader.id]);
    assert.equal(initial.target, 'requests');
    assert.equal(initial.entityId, request.id);
    rejectsAtomically(f, author.id, { type: 'request.status', requestId: request.id, status: 'resolved' }, /수신 인도자 또는 관리자/);
    for (const command of [
        { type: 'request.reply', requestId: request.id, body: '인도자 답변' },
        { type: 'request.status', requestId: request.id, status: 'reviewing' },
    ] satisfies PlanningCommand[]) {
        const leaderNotifications = f.read(leader.id).notifications;
        f.send(leader.id, command);
        const notification = f.read(author.id).notifications[0];
        assert.deepEqual(notification.recipientIds, [author.id]);
        assert.equal(notification.target, 'requests');
        assert.equal(notification.entityId, request.id);
        assert.deepEqual(f.read(leader.id).notifications, leaderNotifications, 'actor should not notify themselves');
    }
    f.send(author.id, { type: 'request.reply', requestId: request.id, body: '작성자 답변' });
    assert.deepEqual(f.read(leader.id).notifications[0].recipientIds, [leader.id]);
    f.send(owner.id, { type: 'request.reply', requestId: request.id, body: '소유자 답변' });
    f.send(owner.id, { type: 'request.status', requestId: request.id, status: 'resolved' });
    const result = f.read().requests[0];
    assert.equal(result.status, 'resolved');
    assert.deepEqual(result.replies.map(reply => [reply.authorId, reply.body]), [
        [leader.id, '인도자 답변'], [author.id, '작성자 답변'], [owner.id, '소유자 답변'],
    ]);
    assert.deepEqual(f.read(author.id).notifications[0].recipientIds.sort(), [author.id, leader.id].sort());
    assert.deepEqual(f.read(other.id).notifications, []);
    assert.deepEqual(f.read(otherLeader.id).notifications, []);
});

test('all request kinds allow a title-only reference but reject invalid recipients and blank content', t => {
    const f = fixture(t);
    for (const kind of ['question', 'reminder', 'change'] as const) {
        const request = createRequest(f, author.id, kind);
        assert.equal(request.kind, kind);
        assert.equal(request.setlistId, '');
        assert.equal(request.setlistTitle, '미등록 주일 콘티');
        assert.equal(request.body, '마지막 곡을 확인해 주세요.');
    }
    const command = { type: 'request.create', setlistId: '', setlistTitle: '콘티', kind: 'question', body: '내용', leaderId: leader.id };
    for (const leaderId of [other.id, 'outsider']) rejectsAtomically(f, author.id, { ...command, leaderId }, /수신할 인도자/);
    for (const invalid of [{ setlistTitle: '   ' }, { body: '\n  ' }, { kind: 'unknown' }]) {
        rejectsAtomically(f, author.id, { ...command, ...invalid }, /입력 형식/);
    }
    const result = f.send(author.id, { ...command, leaderId: owner.id, authorId: other.id });
    assert.equal(result.requests[0].authorId, author.id, 'payload cannot impersonate another author');
    assert.equal(result.requests[0].leaderId, owner.id);
});

test('event and roster management allow owner or leader and reject ordinary members atomically', t => {
    const f = fixture(t);
    const event = createEvent(f, schedule(), leader.id);
    f.send(owner.id, { type: 'event.save', eventId: event.id, input: schedule({ title: '소유자 수정' }) });
    const slot = addSlot(f, event.id);
    f.send(leader.id, { type: 'alert.create', eventId: event.id, slotId: null, kind: 'notice', body: '긴급 안내' });
    const alert = f.read().alerts[0];
    const commands: PlanningCommand[] = [
        { type: 'event.save', input: schedule() },
        { type: 'event.save', eventId: event.id, input: schedule({ title: '권한 없는 수정' }) },
        { type: 'event.cancel', eventId: event.id },
        { type: 'slot.save', eventId: event.id, role: 'drums', memberId: other.id },
        { type: 'slot.save', eventId: event.id, slotId: slot.id, role: 'drums', memberId: other.id },
        { type: 'slot.remove', eventId: event.id, slotId: slot.id },
        { type: 'alert.create', eventId: event.id, slotId: null, kind: 'notice', body: '안내' },
        { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '대타' },
        { type: 'alert.resolve', alertId: alert.id },
        { type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: other.id },
    ];
    for (const command of commands) rejectsAtomically(f, other.id, command, managerError);
    rejectsAtomically(f, owner.id, { type: 'slot.save', eventId: event.id, role: 'vocal', memberId: 'outsider' }, /팀의 팀원/);
    f.send(leader.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, role: 'drums', memberId: other.id });
    assert.equal(f.read().events[0].slots[0].memberId, other.id);
    f.send(leader.id, { type: 'alert.resolve', alertId: alert.id });
    assert.ok(f.read().alerts[0].resolvedAt);
    f.send(leader.id, { type: 'slot.remove', eventId: event.id, slotId: slot.id });
    assert.deepEqual(f.read().events[0].slots, []);
    f.send(leader.id, { type: 'event.cancel', eventId: event.id });
    assert.equal(f.read().events[0].cancelled, true);
});

test('schedule validation rejects invalid dates and nonpositive or over-24-hour durations', async t => {
    const cases: [string, Partial<ScheduleInput>, RegExp][] = [
        ['invalid calendar date', { startsAt: '2026-02-30T10:00:00+09:00' }, /입력 형식/],
        ['invalid text', { startsAt: 'tomorrow' }, /입력 형식/],
        ['missing timezone', { endsAt: '2026-09-06T11:00:00' }, /입력 형식/],
        ['equal start and end', { endsAt: '2026-09-06T10:00:00+09:00' }, /종료는 시작 이후/],
        ['end before start', { endsAt: '2026-09-06T09:59:59+09:00' }, /종료는 시작 이후/],
        ['longer than 24 hours', { endsAt: '2026-09-07T10:00:01+09:00' }, /24시간/],
        ['different offsets but same instant', { endsAt: '2026-09-06T01:00:00Z' }, /종료는 시작 이후/],
    ];
    for (const [name, invalid, error] of cases) await t.test(name, t => {
        const f = fixture(t);
        const event = createEvent(f);
        rejectsAtomically(f, owner.id, { type: 'event.save', input: schedule(invalid) }, error);
        rejectsAtomically(f, leader.id, { type: 'event.save', eventId: event.id, input: schedule(invalid) }, error);
    });
});

test('KST schedules normalize both endpoints across midnight and allow exactly 24 hours', t => {
    const f = fixture(t);
    const overnight = createEvent(f, schedule({ startsAt: '2026-09-06T23:30:00+09:00', endsAt: '2026-09-07T00:30:00+09:00' }));
    assert.equal(overnight.startsAt, '2026-09-06T14:30:00.000Z');
    assert.equal(overnight.endsAt, '2026-09-06T15:30:00.000Z');
    const day = createEvent(f, schedule({ endsAt: '2026-09-07T10:00:00+09:00' }));
    assert.equal(Date.parse(day.endsAt) - Date.parse(day.startsAt), 24 * 60 * 60 * 1000);
    assert.equal(f.read(other.id).events.find(event => event.id === overnight.id)!.endsAt, overnight.endsAt);
});

test('duplicate and overlapping assignments roll back; adjacent and cancelled schedules permit reuse', t => {
    const f = fixture(t);
    const first = createEvent(f);
    const slot = addSlot(f, first.id);
    rejectsAtomically(f, owner.id, { type: 'slot.save', eventId: first.id, role: 'guitar', memberId: author.id }, collisionError);
    const overlap = createEvent(f, schedule({ title: '겹친 연습', startsAt: '2026-09-06T01:30:00Z', endsAt: '2026-09-06T02:30:00Z' }));
    const otherSlot = addSlot(f, overlap.id, other.id);
    rejectsAtomically(f, leader.id, { type: 'slot.save', eventId: overlap.id, slotId: otherSlot.id, role: 'vocal', memberId: author.id }, collisionError);
    rejectsAtomically(f, leader.id, { type: 'slot.save', eventId: overlap.id, role: 'vocal', memberId: author.id }, collisionError);
    f.send(owner.id, { type: 'slot.save', eventId: first.id, slotId: slot.id, role: 'keyboard', memberId: author.id });
    assert.equal(f.read().events.find(event => event.id === first.id)!.slots.length, 1, 'editing the same assignment is not a duplicate');
    const adjacent = createEvent(f, schedule({ startsAt: '2026-09-06T11:00:00+09:00', endsAt: '2026-09-06T12:00:00+09:00' }));
    addSlot(f, adjacent.id);
    f.send(owner.id, { type: 'event.cancel', eventId: first.id });
    f.send(owner.id, { type: 'event.cancel', eventId: adjacent.id });
    addSlot(f, overlap.id);
    assert.equal(f.read().events.find(event => event.id === overlap.id)!.slots.filter(item => item.memberId === author.id).length, 1);
});

test('slot saves preserve absent and vacant substitution state until the assignee changes', t => {
    for (const memberId of [author.id, null]) {
        const f = fixture(t);
        const event = createEvent(f);
        const slot = addSlot(f, event.id, memberId);
        if (memberId) {
            f.send(memberId, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '결석' });
            // An absent assignee may already hold another overlapping assignment.
            const overlap = createEvent(f);
            addSlot(f, overlap.id, memberId);
        } else {
            f.send(owner.id, { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '빈 배치 지원 요청' });
        }
        f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id });
        const readSlot = () => f.read().events.find(item => item.id === event.id)!.slots.find(item => item.id === slot.id)!;
        const beforeSlot = readSlot();
        const beforeAlerts = f.read().alerts;
        assert.equal(beforeSlot.attendance, memberId ? 'absent' : 'pending');
        assert.deepEqual(beforeSlot.volunteers, [other.id]);
        assert.equal(beforeAlerts[0].resolvedAt, null);

        const snapshot = allViews(f);
        f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId, role: 'vocal' });
        assert.deepEqual(allViews(f), snapshot, 'unchanged saves must not reset state or send notifications');

        f.send(leader.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId, role: 'keyboard' });
        assert.deepEqual(readSlot(), { ...beforeSlot, role: 'keyboard' }, 'role-only edits preserve absence or vacancy and candidates');
        assert.deepEqual(f.read().alerts, beforeAlerts, 'role-only edits keep the existing urgent request open');

        f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId: other.id, role: 'keyboard' });
        const kept = { ...beforeSlot };
        delete kept.asked; delete kept.passed;
        assert.deepEqual(readSlot(), { ...kept, role: 'keyboard', memberId: other.id, attendance: 'pending', volunteers: [] }, 'reassignment also clears the substitute asks');
        assert.ok(f.read().alerts.find(alert => alert.id === beforeAlerts[0].id)!.resolvedAt, 'assigning a replacement closes the old request');
    }
});

test('saving or changing the role of a confirmed assignee preserves confirmation, but reassignment resets it', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    f.send(author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' });
    f.send(author.id, { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '대체 인원 요청' });
    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id });
    const beforeSlot = f.read().events[0].slots[0];
    const beforeAlerts = f.read().alerts;
    assert.equal(beforeSlot.attendance, 'confirmed');
    assert.deepEqual(beforeSlot.volunteers, [other.id]);
    assert.equal(beforeAlerts[0].resolvedAt, null);

    const snapshot = allViews(f);
    f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId: author.id, role: 'vocal' });
    assert.deepEqual(allViews(f), snapshot);
    f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId: author.id, role: 'guitar' });
    assert.deepEqual(f.read().events[0].slots[0], { ...beforeSlot, role: 'guitar' });
    assert.deepEqual(f.read().alerts, beforeAlerts);

    f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, memberId: other.id, role: 'guitar' });
    const kept = { ...beforeSlot };
    delete kept.asked; delete kept.passed;
    assert.deepEqual(f.read().events[0].slots[0], { ...kept, role: 'guitar', memberId: other.id, attendance: 'pending', volunteers: [] });
    assert.ok(f.read().alerts.find(alert => alert.id === beforeAlerts[0].id)!.resolvedAt);
});

test('moving a staffed event into a collision is atomic for the entire event and its notifications', t => {
    const f = fixture(t);
    const first = createEvent(f);
    addSlot(f, first.id);
    const laterInput = schedule({ title: '오후 연습', startsAt: '2026-09-06T13:00:00+09:00', endsAt: '2026-09-06T14:00:00+09:00' });
    const later = createEvent(f, laterInput);
    addSlot(f, later.id, other.id);
    addSlot(f, later.id, author.id);
    rejectsAtomically(f, leader.id, { type: 'event.save', eventId: later.id, input: schedule({ title: '충돌하는 수정', location: '다른 장소' }) }, collisionError);
    assert.equal(f.read().events.find(event => event.id === later.id)!.title, laterInput.title);
});

test('only an assignee can respond; repeated absence creates exactly one urgent alert and notification', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    const command: PlanningCommand = { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '몸이 아파요' };
    for (const person of [owner, leader, other]) rejectsAtomically(f, person.id, command, /본인의 참석/);
    f.send(author.id, command);
    const alert = f.read().alerts[0];
    assert.equal(alert.kind, 'absence');
    assert.equal(alert.authorId, author.id);
    assert.equal(alert.eventId, event.id);
    assert.equal(alert.slotId, slot.id);
    assert.equal(alert.resolvedAt, null);
    assert.match(alert.body, /몸이 아파요/);
    assert.equal(f.read().events[0].slots[0].attendance, 'absent');
    const urgent = f.read(leader.id).notifications.filter(item => item.urgent);
    assert.equal(urgent.length, 1);
    assert.equal(urgent[0].target, 'schedule');
    assert.equal(urgent[0].entityId, event.id);
    // 예배 인도자도 파트 담당도 없으면 인도자·관리자에게 (팀 전체가 아니라)
    assert.deepEqual([...urgent[0].recipientIds].sort(), [owner.id, leader.id, otherLeader.id].sort());
    const snapshot = allViews(f);
    f.send(author.id, command);
    assert.deepEqual(allViews(f), snapshot);
    rejectsAtomically(f, author.id, { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '중복 요청' }, /이미 열린 긴급 요청/);
});

test('confirming attendance rechecks availability and closes the absence alert only after success', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    f.send(author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '' });
    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id });
    const overlap = createEvent(f);
    addSlot(f, overlap.id);
    const confirm: PlanningCommand = { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' };
    rejectsAtomically(f, author.id, confirm, collisionError);
    f.send(owner.id, { type: 'event.cancel', eventId: overlap.id });
    f.send(author.id, confirm);
    const restored = f.read().events.find(item => item.id === event.id)!.slots[0];
    assert.equal(restored.attendance, 'confirmed');
    assert.deepEqual(restored.volunteers, []);
    assert.ok(f.read().alerts[0].resolvedAt);
});

test('volunteering is idempotent; leader acceptance replaces the assignment, clears volunteers and closes alerts', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    f.send(author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '' });
    const volunteer: PlanningCommand = { type: 'slot.volunteer', eventId: event.id, slotId: slot.id };
    rejectsAtomically(f, author.id, volunteer, /본인 배치/);
    f.send(other.id, volunteer);
    const snapshot = allViews(f);
    f.send(other.id, volunteer);
    assert.deepEqual(allViews(f), snapshot);
    assert.deepEqual(f.read(leader.id).notifications[0].recipientIds.sort(), [owner.id, leader.id, otherLeader.id].sort());
    f.send(otherLeader.id, volunteer);
    const accept: PlanningCommand = { type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: other.id };
    rejectsAtomically(f, other.id, accept, managerError);
    f.send(leader.id, accept);
    const assigned = f.read().events[0].slots[0];
    assert.equal(assigned.memberId, other.id);
    assert.equal(assigned.attendance, 'confirmed');
    assert.deepEqual(assigned.volunteers, []);
    assert.equal(f.read().alerts.filter(alert => !alert.resolvedAt).length, 0);
    assert.ok(f.read().alerts[0].resolvedAt);
    const notification = f.read(author.id).notifications[0];
    assert.equal(notification.target, 'schedule');
    assert.equal(notification.entityId, event.id);
    assert.deepEqual([...notification.recipientIds].sort(), people.filter(person => person.id !== leader.id).map(person => person.id).sort());
    rejectsAtomically(f, author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '' }, /본인의 참석/);
});

test('volunteers need an eligible slot and availability, and managers cannot accept nonvolunteers', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const filled = addSlot(f, event.id);
    rejectsAtomically(f, other.id, { type: 'slot.volunteer', eventId: event.id, slotId: filled.id }, /대체 요청이 없는/);
    const vacancy = addSlot(f, event.id, null);
    const overlap = createEvent(f);
    addSlot(f, overlap.id, other.id);
    rejectsAtomically(f, other.id, { type: 'slot.volunteer', eventId: event.id, slotId: vacancy.id }, collisionError);
    rejectsAtomically(f, owner.id, { type: 'slot.accept', eventId: event.id, slotId: vacancy.id, memberId: otherLeader.id }, /지원한 팀원/);
    f.send(otherLeader.id, { type: 'slot.volunteer', eventId: event.id, slotId: vacancy.id });
    assert.deepEqual(f.read().events.find(item => item.id === event.id)!.slots.find(item => item.id === vacancy.id)!.volunteers, [otherLeader.id]);
});

test('acceptance rechecks a collision introduced after volunteering without losing the open alert or candidate', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    f.send(author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '' });
    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id });
    const laterAssignment = createEvent(f);
    addSlot(f, laterAssignment.id, other.id);
    const accept: PlanningCommand = { type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: other.id };
    rejectsAtomically(f, owner.id, accept, collisionError);
    const retained = f.read().events.find(item => item.id === event.id)!.slots[0];
    assert.equal(retained.memberId, author.id);
    assert.deepEqual(retained.volunteers, [other.id]);
    assert.equal(f.read().alerts[0].resolvedAt, null);
    f.send(owner.id, { type: 'event.cancel', eventId: laterAssignment.id });
    f.send(owner.id, accept);
    assert.equal(f.read().events.find(item => item.id === event.id)!.slots[0].memberId, other.id);
});

test('notification reads are recipient-only, self-only and idempotent, including forged readBy payloads', t => {
    const f = fixture(t);
    createRequest(f);
    const privateNotification = f.read(leader.id).notifications[0];
    for (const person of [owner, author, other, otherLeader]) {
        rejectsAtomically(f, person.id, { type: 'notification.read', notificationId: privateNotification.id }, /본인의 알림/);
    }
    rejectsAtomically(f, leader.id, { type: 'notification.read', notificationId: 'missing' }, /본인의 알림/);
    const event = createEvent(f);
    const shared = f.read(author.id).notifications.find(item => item.entityId === event.id)!;
    f.send(author.id, { type: 'notification.read', notificationId: shared.id, readBy: [other.id], userId: other.id });
    assert.deepEqual(f.read(other.id).notifications.find(item => item.id === shared.id)!.readBy, [author.id]);
    const snapshot = allViews(f);
    f.send(author.id, { type: 'notification.read', notificationId: shared.id });
    assert.deepEqual(allViews(f), snapshot);
    f.send(other.id, { type: 'notification.read', notificationId: shared.id });
    assert.deepEqual(f.read(author.id).notifications.find(item => item.id === shared.id)!.readBy, [author.id, other.id]);
});

test('cancelled schedules close urgent alerts and reject subsequent schedule mutations', async t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id);
    f.send(author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '' });
    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id });
    const alert = f.read().alerts[0];
    f.send(owner.id, { type: 'event.cancel', eventId: event.id });
    assert.equal(f.read().events[0].cancelled, true);
    assert.ok(f.read().alerts[0].resolvedAt);
    assert.equal(f.read(other.id).notifications[0].urgent, true);
    const commands: [string, string, PlanningCommand][] = [
        ['event edit', owner.id, { type: 'event.save', eventId: event.id, input: schedule() }],
        ['repeat cancel', owner.id, { type: 'event.cancel', eventId: event.id }],
        ['slot creation', owner.id, { type: 'slot.save', eventId: event.id, role: 'drums', memberId: null }],
        ['slot edit', owner.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, role: 'drums', memberId: other.id }],
        ['slot removal', owner.id, { type: 'slot.remove', eventId: event.id, slotId: slot.id }],
        ['attendance', author.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' }],
        ['notice', owner.id, { type: 'alert.create', eventId: event.id, slotId: null, kind: 'notice', body: '안내' }],
        ['substitute request', owner.id, { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '대타' }],
        ['volunteering', otherLeader.id, { type: 'slot.volunteer', eventId: event.id, slotId: slot.id }],
        ['acceptance', leader.id, { type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: other.id }],
        ['alert resolution', leader.id, { type: 'alert.resolve', alertId: alert.id }],
    ];
    for (const [name, actor, command] of commands) await t.test(name, () => rejectsAtomically(f, actor, command, cancelledError));
});

test('two SQLite connections preserve private requests and read receipts across interleaved writes and reopening', t => {
    const folder = mkdtempSync(path.join(tmpdir(), 'worship-planning-test-'));
    const filename = path.join(folder, 'planning.sqlite');
    const connections = new Set<TeamRepository>();
    const connect = () => {
        const repo = new TeamRepository(filename);
        connections.add(repo);
        return repo;
    };
    t.after(() => {
        for (const connection of connections) connection.close();
        // Delete only known SQLite files; never recursively remove a computed directory.
        assert.equal(path.dirname(folder), path.resolve(tmpdir()));
        for (const name of readdirSync(folder)) {
            assert.ok(['planning.sqlite', 'planning.sqlite-wal', 'planning.sqlite-shm'].includes(name));
            unlinkSync(path.join(folder, name));
        }
        rmdirSync(folder);
    });
    const first = connect(), second = connect();
    const f = seed(first, second);
    const firstRequest = createRequest(f);
    assert.equal(second.planning(f.teamId, leader.id).requests[0].id, firstRequest.id);
    const secondResult = second.updatePlanning(f.teamId, other.id, {
        type: 'request.create', setlistId: 'registered-setlist', setlistTitle: '저녁 콘티', kind: 'change', body: '수정 요청', leaderId: leader.id,
    });
    assert.equal(secondResult.requests.length, 1, 'returned state is scoped to the second author');
    assert.notEqual(secondResult.requests[0].id, firstRequest.id);
    assert.equal(f.read().requests.length, 2, 'scoped return must not replace another author’s persisted request');
    second.updatePlanning(f.teamId, leader.id, { type: 'request.reply', requestId: firstRequest.id, body: '다른 연결에서 답변' });
    assert.equal(f.read(author.id).requests[0].replies[0].body, '다른 연결에서 답변');
    const event = createEvent(f);
    const notification = f.read(author.id).notifications.find(item => item.entityId === event.id)!;
    first.updatePlanning(f.teamId, author.id, { type: 'notification.read', notificationId: notification.id });
    second.updatePlanning(f.teamId, other.id, { type: 'notification.read', notificationId: notification.id });
    assert.deepEqual(f.read(author.id).notifications.find(item => item.id === notification.id)!.readBy, [author.id, other.id]);
    const snapshot = allViews(f);
    first.close(); connections.delete(first);
    second.close(); connections.delete(second);
    const reopened = connect();
    assert.deepEqual(people.map(person => reopened.planning(f.teamId, person.id)), snapshot);
});

test('recurring events create weekly schedules and reject non-managers', (t: TestContext) => {
    const f = fixture(t);
    assert.throws(() => f.send(author.id, {
        type: 'event.createRecurring',
        input: schedule({ title: '주일 예배' }),
        weeksCount: 4,
    }), managerError);

    const state = f.send(owner.id, {
        type: 'event.createRecurring',
        input: schedule({ title: '정기 주일예배', startsAt: '2026-09-06T11:00:00+09:00', endsAt: '2026-09-06T12:00:00+09:00' }),
        weeksCount: 3,
    });
    assert.equal(state.events.length, 3);
    assert.equal(state.events[0].startsAt, '2026-09-06T02:00:00.000Z');
    assert.equal(state.events[1].startsAt, '2026-09-13T02:00:00.000Z');
    assert.equal(state.events[2].startsAt, '2026-09-20T02:00:00.000Z');
});

test('slot templates and roster copy populate slots with clash safety', (t: TestContext) => {
    const f = fixture(t);
    const event1 = createEvent(f, schedule({ startsAt: '2026-09-06T10:00:00+09:00', endsAt: '2026-09-06T11:00:00+09:00' }));

    // Apply standard template (7 roles)
    const afterTemplate = f.send(owner.id, {
        type: 'slots.applyTemplate',
        eventId: event1.id,
        templateKey: 'standard',
    });
    const updatedEvent1 = afterTemplate.events.find(e => e.id === event1.id)!;
    assert.equal(updatedEvent1.slots.length, 7);
    assert.equal(updatedEvent1.slots[0].role, 'leader');

    // Assign author to vocal slot
    const vocalSlot = updatedEvent1.slots.find(s => s.role === 'vocal')!;
    f.send(owner.id, {
        type: 'slot.save',
        eventId: event1.id,
        slotId: vocalSlot.id,
        role: 'vocal',
        memberId: author.id,
    });

    // Create next week's event
    const event2 = createEvent(f, schedule({ startsAt: '2026-09-13T10:00:00+09:00', endsAt: '2026-09-13T11:00:00+09:00' }));

    // Copy roster from event1 to event2
    const afterCopy = f.send(owner.id, {
        type: 'slots.copyFromEvent',
        targetEventId: event2.id,
        sourceEventId: event1.id,
    });
    const updatedEvent2 = afterCopy.events.find(e => e.id === event2.id)!;
    assert.equal(updatedEvent2.slots.length, 7);
    const copiedVocal = updatedEvent2.slots.find(s => s.role === 'vocal')!;
    assert.equal(copiedVocal.memberId, author.id);
});

test('rotations manage teams and individuals, cycle steps, and apply to event slots', (t: TestContext) => {
    const f = fixture(t);
    // 1. Team-based rotation
    const saveState = f.send(owner.id, {
        type: 'rotation.save',
        group: {
            name: '주일 찬양팀 조별 교대',
            targetRole: 'all',
            cycleType: 'team',
            teams: [
                { id: 'team-a', name: '1조 (기드온)', memberIds: [author.id, other.id] },
                { id: 'team-b', name: '2조 (바라)', memberIds: [leader.id] },
            ],
            notes: '격주로 교대',
        },
    });
    assert.equal(saveState.rotations?.length, 1);
    const rot = saveState.rotations![0];
    assert.equal(rot.name, '주일 찬양팀 조별 교대');
    assert.equal(rot.currentStep, 0);

    // Step to next
    const stepped = f.send(owner.id, {
        type: 'rotation.step',
        rotationId: rot.id,
        direction: 'next',
    });
    assert.equal(stepped.rotations![0].currentStep, 1);

    // Step prev
    const steppedBack = f.send(owner.id, {
        type: 'rotation.step',
        rotationId: rot.id,
        direction: 'prev',
    });
    assert.equal(steppedBack.rotations![0].currentStep, 0);

    // Apply rotation (team 1) to event
    const event = createEvent(f);
    const applied = f.send(owner.id, {
        type: 'rotation.apply',
        rotationId: rot.id,
        eventId: event.id,
    });
    const updatedEvent = applied.events.find(e => e.id === event.id)!;
    // author and other should have slots created/assigned
    assert.ok(updatedEvent.slots.some(s => s.memberId === author.id));
    assert.ok(updatedEvent.slots.some(s => s.memberId === other.id));

    // 2. Individual rotation
    const saveIndiv = f.send(owner.id, {
        type: 'rotation.save',
        group: {
            name: '음향 엔지니어 순번',
            targetRole: 'sound',
            cycleType: 'individual',
            members: [other.id, author.id],
        },
    });
    const soundRot = saveIndiv.rotations!.find(r => r.name === '음향 엔지니어 순번')!;
    assert.equal(soundRot.currentStep, 0);

    // Remove rotation
    const afterRemove = f.send(owner.id, {
        type: 'rotation.remove',
        rotationId: rot.id,
    });
    assert.equal(afterRemove.rotations?.length, 1);
    assert.equal(afterRemove.rotations?.[0].id, soundRot.id);
});

const rotationGroup = () => ({
    name: '보컬 조별 교대', targetRole: 'vocal' as const, cycleType: 'team' as const,
    teams: [
        { id: 'a', name: '1조', memberIds: [author.id, other.id] },
        { id: 'b', name: '2조', memberIds: [leader.id] },
    ],
});

test('rotation validation rejects empty, duplicate and foreign rosters without changing stored data', t => {
    const f = fixture(t);
    for (const group of [
        { ...rotationGroup(), teams: [] },
        { ...rotationGroup(), teams: [{ id: 'a', name: '1조', memberIds: [] }, rotationGroup().teams[1]] },
        { ...rotationGroup(), teams: [{ id: 'a', name: '1조', memberIds: ['outsider'] }, rotationGroup().teams[1]] },
        { ...rotationGroup(), teams: [{ id: 'a', name: '1조', memberIds: [author.id, author.id] }, rotationGroup().teams[1]] },
        { ...rotationGroup(), teams: [rotationGroup().teams[0], { ...rotationGroup().teams[1], id: 'a' }] },
        { ...rotationGroup(), cycleType: 'individual', members: [author.id] },
        { ...rotationGroup(), cycleType: 'individual', members: [author.id, author.id] },
        { ...rotationGroup(), cycleType: 'individual', members: [author.id, 'outsider'] },
    ]) rejectsAtomically(f, owner.id, { type: 'rotation.save', group }, /팀원|조|중복/);
    rejectsAtomically(f, owner.id, { type: 'rotation.save', rotationId: 'missing', group: rotationGroup() }, /찾지 못했습니다/);
});

test('rotation commands require management and rotation notifications open the rotation tab', t => {
    const f = fixture(t);
    const group = rotationGroup();
    const state = f.send(leader.id, { type: 'rotation.save', group, });
    const rotationId = state.rotations![0].id;
    const event = createEvent(f);
    for (const command of [
        { type: 'rotation.save', group },
        { type: 'rotation.save', rotationId, group },
        { type: 'rotation.step', rotationId, direction: 'next' },
        { type: 'rotation.remove', rotationId },
        { type: 'rotation.apply', rotationId, eventId: event.id },
    ]) rejectsAtomically(f, other.id, command, managerError);
    const notification = f.read(other.id).notifications.find(item => item.entityId === rotationId)!;
    assert.equal(notification.target, 'rotation');
    assert.equal(parsePlanningState(f.read(other.id)).notifications.find(item => item.id === notification.id)!.target, 'rotation');
});

test('team rotation rolls back all assignments and notifications when one member has a conflict', t => {
    const f = fixture(t);
    const rotationId = f.send(owner.id, { type: 'rotation.save', group: rotationGroup() }).rotations![0].id;
    const occupied = createEvent(f, schedule({ title: '겹치는 연습' }));
    addSlot(f, occupied.id, other.id);
    const target = createEvent(f);
    rejectsAtomically(f, owner.id, { type: 'rotation.apply', rotationId, eventId: target.id }, collisionError);
});

test('rotation uses the selected part, clears filled vacancy alerts and volunteers, and rejects repeat assignment', t => {
    const f = fixture(t);
    const rotationId = f.send(owner.id, { type: 'rotation.save', group: rotationGroup() }).rotations![0].id;
    const event = createEvent(f);
    const vacancy = addSlot(f, event.id, null);
    f.send(owner.id, { type: 'alert.create', eventId: event.id, slotId: vacancy.id, kind: 'substitute', body: '보컬이 필요해요' });
    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: vacancy.id });
    const applied = f.send(owner.id, { type: 'rotation.apply', rotationId, eventId: event.id });
    const slots = applied.events.find(item => item.id === event.id)!.slots;
    assert.deepEqual(slots.map(slot => [slot.role, slot.memberId]), [['vocal', author.id], ['vocal', other.id]]);
    assert.deepEqual(slots[0].volunteers, []);
    assert.ok(applied.alerts.find(alert => alert.slotId === vacancy.id)!.resolvedAt);
    assert.equal(applied.rotations![0].currentStep, 0, 'applying should not silently advance the rotation');
    rejectsAtomically(f, owner.id, { type: 'rotation.apply', rotationId, eventId: event.id }, collisionError);
});

test('team and individual rotations reject capacity overflow atomically but can fill an existing vacancy at capacity', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const first = addSlot(f, event.id, null);
    for (let index = 1; index < 50; index++) addSlot(f, event.id, null);
    for (const group of [
        { ...rotationGroup(), targetRole: 'sound' },
        { name: '음향 순번', targetRole: 'sound', cycleType: 'individual', members: [author.id, other.id] },
    ]) {
        const state = f.send(owner.id, { type: 'rotation.save', group });
        const rotationId = state.rotations!.at(-1)!.id;
        rejectsAtomically(f, owner.id, { type: 'rotation.apply', rotationId, eventId: event.id }, /최대 50명/);
    }
    const rotationId = f.read().rotations!.at(-1)!.id;
    f.send(owner.id, { type: 'slot.save', eventId: event.id, slotId: first.id, role: 'sound', memberId: null });
    const applied = f.send(owner.id, { type: 'rotation.apply', rotationId, eventId: event.id });
    assert.equal(applied.events[0].slots.length, 50);
    assert.equal(applied.events[0].slots[0].memberId, author.id);
});

test('rotation step normalization survives edits and the 20-group limit cannot be bypassed with a missing id', t => {
    const f = fixture(t);
    const group = { ...rotationGroup(), currentStep: 999 };
    const rotationId = f.send(owner.id, { type: 'rotation.save', group }).rotations![0].id;
    assert.equal(f.read().rotations![0].currentStep, 1);
    assert.equal(f.send(owner.id, { type: 'rotation.step', rotationId, direction: 'next' }).rotations![0].currentStep, 0);
    assert.equal(f.send(owner.id, { type: 'rotation.step', rotationId, direction: 'prev' }).rotations![0].currentStep, 1);
    for (let index = 1; index < 20; index++) f.send(owner.id, { type: 'rotation.save', group });
    rejectsAtomically(f, owner.id, { type: 'rotation.save', group }, /최대 20개/);
    rejectsAtomically(f, owner.id, { type: 'rotation.save', rotationId: 'missing', group }, /찾지 못했습니다/);
    assert.equal(f.send(owner.id, { type: 'rotation.save', rotationId, group: { ...group, name: '수정한 조' } }).rotations!.length, 20);
});

test('rotations reject former members and cancelled schedules without partial changes', t => {
    const f = fixture(t);
    const rotationId = f.send(owner.id, { type: 'rotation.save', group: rotationGroup() }).rotations![0].id;
    const event = createEvent(f);
    const previous = f.read();
    const snapshot = structuredClone(previous);
    assert.throws(() => applyPlanningCommand(previous, f.members.filter(member => member.userId !== other.id), owner.id, {
        type: 'rotation.apply', rotationId, eventId: event.id,
    }), /이전 팀원/);
    assert.deepEqual(previous, snapshot);
    f.send(owner.id, { type: 'event.cancel', eventId: event.id });
    rejectsAtomically(f, owner.id, { type: 'rotation.apply', rotationId, eventId: event.id }, cancelledError);
});

test('rotation.batchApply applies rotation across multiple events and advances steps', t => {
    const f = fixture(t);
    const rotationId = f.send(owner.id, { type: 'rotation.save', group: rotationGroup() }).rotations![0].id;
    const event1 = createEvent(f, schedule({ startsAt: '2026-09-06T10:00:00+09:00', endsAt: '2026-09-06T11:00:00+09:00' }));
    const event2 = createEvent(f, schedule({ startsAt: '2026-09-13T10:00:00+09:00', endsAt: '2026-09-13T11:00:00+09:00' }));

    const afterBatch = f.send(owner.id, {
        type: 'rotation.batchApply',
        rotationId,
        eventIds: [event1.id, event2.id],
    });

    const e1 = afterBatch.events.find(e => e.id === event1.id)!;
    const e2 = afterBatch.events.find(e => e.id === event2.id)!;

    // event1 had step 0 (1조: author, other)
    assert.ok(e1.slots.some(s => s.memberId === author.id));
    assert.ok(e1.slots.some(s => s.memberId === other.id));

    // event2 had step 1 (2조: leader)
    assert.ok(e2.slots.some(s => s.memberId === leader.id));
});

test('event.createWithTemplate creates multiple events populated with template roles', t => {
    const f = fixture(t);
    const result = f.send(owner.id, {
        type: 'event.createWithTemplate',
        input: schedule({ title: '주일 2부 예배' }),
        templateKey: 'standard',
        weeksCount: 4,
    });
    assert.equal(result.events.length, 4);
    for (const ev of result.events) {
        assert.equal(ev.title, '주일 2부 예배');
        assert.equal(ev.slots.length, 7); // standard has 7 roles
        assert.equal(ev.slots[0].role, 'leader');
        assert.equal(ev.slots[0].attendance, 'pending');
    }
    // rejects non-manager
    rejectsAtomically(f, author.id, {
        type: 'event.createWithTemplate',
        input: schedule(),
        templateKey: 'standard',
    }, managerError);
});

test('attendance.batchConfirm confirms multiple slots atomically and rejects other users', t => {
    const f = fixture(t);
    const event1 = createEvent(f, schedule({ startsAt: '2026-09-06T10:00:00+09:00', endsAt: '2026-09-06T11:00:00+09:00' }));
    const event2 = createEvent(f, schedule({ startsAt: '2026-09-13T10:00:00+09:00', endsAt: '2026-09-13T11:00:00+09:00' }));
    const slot1 = addSlot(f, event1.id, author.id);
    const slot2 = addSlot(f, event2.id, author.id);

    // author confirms both
    const confirmed = f.send(author.id, {
        type: 'attendance.batchConfirm',
        items: [{ eventId: event1.id, slotId: slot1.id }, { eventId: event2.id, slotId: slot2.id }],
    });
    const s1 = confirmed.events.find(e => e.id === event1.id)!.slots.find(s => s.id === slot1.id)!;
    const s2 = confirmed.events.find(e => e.id === event2.id)!.slots.find(s => s.id === slot2.id)!;
    assert.equal(s1.attendance, 'confirmed');
    assert.equal(s2.attendance, 'confirmed');

    // other user cannot confirm author's slot
    rejectsAtomically(f, other.id, {
        type: 'attendance.batchConfirm',
        items: [{ eventId: event1.id, slotId: slot1.id }],
    }, /본인의 참석 여부/);
});

test('event.updateSetlist updates setlist info and notifies only assigned duty members', t => {
    const f = fixture(t);
    const event = createEvent(f, schedule({ title: '주일 2부 예배' }));
    // Assign author to slot, but other is NOT assigned
    addSlot(f, event.id, author.id);

    const updated = f.send(owner.id, {
        type: 'event.updateSetlist',
        eventId: event.id,
        setlistTitle: '9월 첫째 주 콘티',
        setlistSongs: ['꽃들도', '은혜', '주는 완전합니다'],
        notifyDuty: true,
    });
    const ev = updated.events.find(e => e.id === event.id)!;
    assert.equal(ev.setlistTitle, '9월 첫째 주 콘티');
    assert.deepEqual(ev.setlistSongs, ['꽃들도', '은혜', '주는 완전합니다']);

    // Notification check: author is duty -> author receives it. other is not duty -> other does not.
    const authorView = f.read(author.id);
    const authorNotif = authorView.notifications.find(n => n.entityId === event.id && n.title.includes('콘티'));
    assert.ok(authorNotif, 'Assigned duty member should receive setlist notification');
    assert.match(authorNotif.body, /9월 첫째 주 콘티/);
    assert.match(authorNotif.body, /3곡/);

    const otherView = f.read(other.id);
    const otherNotif = otherView.notifications.find(n => n.entityId === event.id && n.title.includes('콘티'));
    assert.equal(otherNotif, undefined, 'Non-duty member should not receive duty-targeted setlist notification');

    // Rejects non-manager
    rejectsAtomically(f, other.id, {
        type: 'event.updateSetlist',
        eventId: event.id,
        setlistTitle: '해킹 콘티',
    }, managerError);
});

test('alert.create with targetAudience=duty notifies only duty members, while all notifies everyone', t => {
    const f = fixture(t);
    const event = createEvent(f, schedule({ title: '주일 11시 예배' }));
    addSlot(f, event.id, author.id); // author is on duty, other is not

    // 1. Leader sends notice with targetAudience: 'duty'
    f.send(owner.id, {
        type: 'alert.create',
        eventId: event.id,
        slotId: null,
        kind: 'notice',
        body: '이번 주 당번분들은 30분 전까지 도착해주세요!',
        targetAudience: 'duty',
    });

    const authorNotifs = f.read(author.id).notifications;
    const dutyNoticeForAuthor = authorNotifs.find(n => n.body.includes('30분 전까지 도착'));
    assert.ok(dutyNoticeForAuthor, 'Duty member must receive duty notice');

    const otherNotifs = f.read(other.id).notifications;
    const dutyNoticeForOther = otherNotifs.find(n => n.body.includes('30분 전까지 도착'));
    assert.equal(dutyNoticeForOther, undefined, 'Unassigned member must not receive duty-only notice');

    // 2. Leader sends notice with targetAudience: 'all'
    f.send(owner.id, {
        type: 'alert.create',
        eventId: event.id,
        slotId: null,
        kind: 'notice',
        body: '찬양팀 전체 수련회 일정 공지',
        targetAudience: 'all',
    });

    const authorAllNotif = f.read(author.id).notifications.find(n => n.body.includes('전체 수련회'));
    const otherAllNotif = f.read(other.id).notifications.find(n => n.body.includes('전체 수련회'));
    assert.ok(authorAllNotif, 'Author must receive all-member notice');
    assert.ok(otherAllNotif, 'Other member must receive all-member notice');
});

test('event.delete permanently removes event and associated alerts/notifications and rejects non-managers', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const slot = addSlot(f, event.id, author.id);
    f.send(owner.id, { type: 'alert.create', eventId: event.id, slotId: slot.id, kind: 'substitute', body: '대체 구함' });
    
    assert.equal(f.read().events.length, 1);
    assert.equal(f.read().alerts.length, 1);

    // Non-manager cannot delete
    assert.throws(() => f.send(author.id, { type: 'event.delete', eventId: event.id }), managerError);

    // Manager can delete
    f.send(owner.id, { type: 'event.delete', eventId: event.id });
    assert.equal(f.read().events.length, 0);
    assert.equal(f.read().alerts.filter(a => a.eventId === event.id).length, 0);
});

test('request.delete permanently removes request and rejects unauthorized users', t => {
    const f = fixture(t);
    f.send(author.id, { type: 'request.create', setlistId: 's-1', setlistTitle: '콘티 1', kind: 'question', body: '송폼 질문', leaderId: leader.id });
    const requestId = f.read().requests[0].id;

    // Unrelated member cannot delete
    assert.throws(() => f.send(other.id, { type: 'request.delete', requestId }), /작성자 또는 관리자/);

    // Author can delete
    f.send(author.id, { type: 'request.delete', requestId });
    assert.equal(f.read().requests.length, 0);
});

test('slot.unvolunteer allows members to withdraw their volunteer application', t => {
    const f = fixture(t);
    const event = createEvent(f);
    const vacancy = addSlot(f, event.id, null);

    f.send(other.id, { type: 'slot.volunteer', eventId: event.id, slotId: vacancy.id });
    assert.deepEqual(f.read().events[0].slots[0].volunteers, [other.id]);

    f.send(other.id, { type: 'slot.unvolunteer', eventId: event.id, slotId: vacancy.id });
    assert.deepEqual(f.read().events[0].slots[0].volunteers, []);
});

test('notification.readAll marks all unread notifications for recipient as read', t => {
    const f = fixture(t);
    const event = createEvent(f);
    f.send(owner.id, { type: 'alert.create', eventId: event.id, slotId: null, kind: 'notice', body: '공지 1', targetAudience: 'all' });
    f.send(owner.id, { type: 'alert.create', eventId: event.id, slotId: null, kind: 'notice', body: '공지 2', targetAudience: 'all' });

    const before = f.read(author.id).notifications.filter(n => !n.readBy.includes(author.id));
    assert.ok(before.length >= 2, 'Author should have multiple unread notifications');

    f.send(author.id, { type: 'notification.readAll' });
    const after = f.read(author.id).notifications.filter(n => !n.readBy.includes(author.id));
    assert.equal(after.length, 0, 'All notifications should be marked as read');
});



