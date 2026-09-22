import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { generateIcsContent } from '../lib/calendarExport';
import { TeamRepository } from '../lib/server/teamRepository';
import type { PlanningCommand, ScheduleInput } from '../types/planning';

const owner = { id: 'owner-id', name: '담임관리자' };
const member1 = { id: 'm1', name: '건반1' };
const member2 = { id: 'm2', name: '드럼1' };

function setup(t: TestContext) {
    const repo = new TeamRepository(':memory:');
    t.after(() => repo.close());
    const team = repo.create('고급 플래닝 테스트팀', owner);
    const invite = repo.createInvite(team.id, owner.id);
    repo.join(invite.token, member1);
    repo.join(invite.token, member2);
    repo.assignRole(team.id, owner.id, member1.id, 'keyboard');
    repo.assignRole(team.id, owner.id, member2.id, 'drums');

    return {
        repo,
        teamId: team.id,
        send: (actor: string, command: PlanningCommand | unknown) =>
            repo.updatePlanning(team.id, actor, command),
        read: (actor = owner.id) => repo.planning(team.id, actor),
        listMembers: () => repo.list(owner.id).find((item) => item.id === team.id)!.members,
    };
}

test('direct member and batch member addition, permission management, and member removal', (t) => {
    const { repo, teamId, listMembers } = setup(t);

    // 1. Direct member addition
    const addedDirect = repo.addMemberDirect(teamId, owner.id, '새기타', 'guitar');
    assert.equal(addedDirect.name, '새기타');
    assert.equal(addedDirect.role, 'guitar');
    assert.equal(addedDirect.permission, 'member');
    assert.ok(addedDirect.userId.startsWith('direct-'));

    // Verify in team roster
    let members = listMembers();
    assert.equal(members.length, 4);
    assert.ok(members.some((m) => m.userId === addedDirect.userId && m.role === 'guitar'));

    // 2. Batch addition
    const batchItems = [
        { name: '베이스1', role: 'bass' as const },
        { name: '싱어1', role: 'vocal' as const },
        { name: '음향1', role: 'sound' as const },
    ];
    const addedBatch = repo.addMembersBatch(teamId, owner.id, batchItems);
    assert.equal(addedBatch.length, 3);
    members = listMembers();
    assert.equal(members.length, 7);

    // 3. Permission management: promote member1 to owner
    repo.setMemberPermission(teamId, owner.id, member1.id, 'owner');
    members = listMembers();
    assert.equal(members.find((m) => m.userId === member1.id)?.permission, 'owner');

    // Demote member1 back to member
    repo.setMemberPermission(teamId, owner.id, member1.id, 'member');
    members = listMembers();
    assert.equal(members.find((m) => m.userId === member1.id)?.permission, 'member');

    // Cannot demote sole owner
    assert.throws(() => repo.setMemberPermission(teamId, owner.id, owner.id, 'member'), /마지막 관리자/);

    // 4. Member removal
    repo.removeMember(teamId, owner.id, addedDirect.userId);
    members = listMembers();
    assert.equal(members.length, 6);
    assert.ok(!members.some((m) => m.userId === addedDirect.userId));
});

test('slots.autoAssign matches roles, avoids clash, and balances workload', (t) => {
    const { repo, teamId, send, read } = setup(t);

    // Add another keyboardist with zero workload
    const k2 = repo.addMemberDirect(teamId, owner.id, '건반2', 'keyboard');

    // Create Event A: Keyboard already assigned to member1 ('건반1')
    const inputA: ScheduleInput = {
        title: '주일 1부 예배',
        kind: 'worship',
        startsAt: '2026-10-04T09:00:00+09:00',
        endsAt: '2026-10-04T10:30:00+09:00',
        location: '본당',
        notes: '',
    };
    send(owner.id, { type: 'event.save', input: inputA });
    let state = read();
    const eventA = state.events[0];
    send(owner.id, { type: 'slot.save', eventId: eventA.id, role: 'keyboard', memberId: member1.id });

    // member1 now has workload = 1, k2 has workload = 0

    // Create Event B: at a conflicting time (9:30 ~ 11:00) with an unassigned keyboard slot
    const inputB: ScheduleInput = {
        title: '주일 특송 연습',
        kind: 'rehearsal',
        startsAt: '2026-10-04T09:30:00+09:00',
        endsAt: '2026-10-04T11:00:00+09:00',
        location: '소예배실',
        notes: '',
    };
    send(owner.id, { type: 'event.save', input: inputB });
    state = read();
    const eventB = state.events[0];
    send(owner.id, { type: 'slot.save', eventId: eventB.id, role: 'keyboard', memberId: null });

    // Run auto-assignment on Event B
    // member1 is in clash with Event A -> MUST NOT be assigned. k2 has no clash -> MUST be assigned.
    send(owner.id, { type: 'slots.autoAssign', eventId: eventB.id });
    state = read();
    const updatedEventB = state.events.find((e) => e.id === eventB.id)!;
    const keyboardSlot = updatedEventB.slots.find((s) => s.role === 'keyboard')!;
    assert.equal(keyboardSlot.memberId, k2.userId);
    assert.equal(keyboardSlot.attendance, 'pending');

    // Notification generated for team members (excluding actor)
    const memberState = read(member1.id);
    assert.ok(memberState.notifications.some((n) => n.title.includes('스마트 자동 배정')));
});

test('slots.clear resets slot assignments to pending and clears volunteers', (t) => {
    const { send, read } = setup(t);

    const input: ScheduleInput = {
        title: '토요 찬양 연습',
        kind: 'rehearsal',
        startsAt: '2026-10-10T17:00:00+09:00',
        endsAt: '2026-10-10T19:00:00+09:00',
        location: '연습실',
        notes: '',
    };
    send(owner.id, { type: 'event.save', input });
    let state = read();
    const event = state.events[0];
    send(owner.id, { type: 'slot.save', eventId: event.id, role: 'drums', memberId: member2.id });

    state = read();
    assert.equal(state.events[0].slots[0].memberId, member2.id);

    // Clear all assignments
    send(owner.id, { type: 'slots.clear', eventId: event.id });
    state = read();
    assert.equal(state.events[0].slots[0].memberId, null);
    assert.equal(state.events[0].slots[0].attendance, 'pending');
});

test('schedule.sendDutyReminder sends high priority notifications to pending members', (t) => {
    const { send, read } = setup(t);

    const input: ScheduleInput = {
        title: '주일 청년부 예배',
        kind: 'worship',
        startsAt: '2026-10-11T14:00:00+09:00',
        endsAt: '2026-10-11T16:00:00+09:00',
        location: '본당',
        notes: '',
    };
    send(owner.id, { type: 'event.save', input });
    const state = read();
    const event = state.events[0];
    send(owner.id, { type: 'slot.save', eventId: event.id, role: 'drums', memberId: member2.id });

    // Send reminder
    send(owner.id, { type: 'schedule.sendDutyReminder', eventId: event.id });
    const member2State = read(member2.id);

    const reminder = member2State.notifications.find((n) => n.title === '섬김 참석 여부를 확정해주세요');
    assert.ok(reminder);
    assert.equal(reminder.urgent, true);
    assert.ok(reminder.recipientIds.includes(member2.id));
    assert.ok(reminder.body.includes('주일 청년부 예배'));
});

test('event.createMonthlySundays generates all sundays for given month with template', (t) => {
    const { send, read } = setup(t);

    // September 2026 has 4 Sundays: 6, 13, 20, 27
    send(owner.id, {
        type: 'event.createMonthlySundays',
        year: 2026,
        month: 9,
        startHour: 11,
        startMinute: 0,
        endHour: 12,
        endMinute: 30,
        title: '주일 2부예배',
        location: '대예배실',
        templateKey: 'standard',
    });

    const state = read();
    const septemberEvents = state.events.filter((e) => e.title === '주일 2부예배');
    assert.equal(septemberEvents.length, 4);

    for (const ev of septemberEvents) {
        assert.equal(ev.location, '대예배실');
        assert.equal(ev.slots.length, 7); // standard template has 7 roles
        assert.ok(ev.slots.every((s) => s.memberId === null));
    }
});

test('generateIcsContent produces RFC 5545 valid calendar string', (t) => {
    const { read, send } = setup(t);

    const input: ScheduleInput = {
        title: '추수감사주일 찬양예배',
        kind: 'worship',
        startsAt: '2026-11-15T11:00:00+09:00',
        endsAt: '2026-11-15T12:30:00+09:00',
        location: '본당 대예배실',
        notes: '추수감사 찬양 콘티',
        setlistTitle: '감사 콘티',
        setlistSongs: ['날 구원하신 주 감사', '감사함으로'],
    };
    send(owner.id, { type: 'event.save', input });
    const state = read();
    const event = state.events[0];

    const ics = generateIcsContent(event, '주일 찬양팀');
    assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('SUMMARY:[주일 찬양팀] 추수감사주일 찬양예배'));
    assert.ok(ics.includes('LOCATION:본당 대예배실'));
    assert.ok(ics.includes('날 구원하신 주 감사'));
    assert.ok(ics.endsWith('END:VCALENDAR'));
});
