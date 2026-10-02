import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { TeamRepository } from '../lib/server/teamRepository';
import type { PlanningCommand, ScheduleInput } from '../types/planning';

const owner = { id: 'owner-id', name: '팀리더' };
const member1 = { id: 'm1', name: '김건반' };
const member2 = { id: 'm2', name: '박드럼' };
const member3 = { id: 'm3', name: '최보컬' };

function setup(t: TestContext) {
    const repo = new TeamRepository(':memory:');
    t.after(() => repo.close());
    const team = repo.create('사역 동의 및 초대 테스트팀', owner);
    const invite = repo.createInvite(team.id, owner.id);
    repo.join(invite.token, member1);
    repo.join(invite.token, member2);
    repo.join(invite.token, member3);
    repo.assignRole(team.id, owner.id, member1.id, 'keyboard');
    repo.assignRole(team.id, owner.id, member2.id, 'drums');
    repo.assignRole(team.id, owner.id, member3.id, 'vocal');

    return {
        repo,
        teamId: team.id,
        send: (actor: string, command: PlanningCommand | unknown) =>
            repo.updatePlanning(team.id, actor, command),
        read: (actor = owner.id) => repo.planning(team.id, actor),
        listMembers: () => repo.list(owner.id).find((item) => item.id === team.id)!.members,
    };
}

const sampleInput: ScheduleInput = {
    title: '주일 2부예배',
    kind: 'worship',
    startsAt: '2026-10-04T11:00:00+09:00',
    endsAt: '2026-10-04T12:30:00+09:00',
    location: '본당 대예배실',
    notes: '은혜로운 예배 준비',
};

test('slot.sendInvite notifies assigned member and records invitedAt timestamp', (t) => {
    const { send, read } = setup(t);

    // 1. Create event with template
    send(owner.id, {
        type: 'event.createWithTemplate',
        input: sampleInput,
        templateKey: 'acoustic', // 4 roles: leader, keyboard, guitar, vocal
    });

    let state = read(owner.id);
    const event = state.events[0];
    const keyboardSlot = event.slots.find((s) => s.role === 'keyboard')!;

    // 2. Assign member1 to keyboard
    send(owner.id, {
        type: 'slot.save',
        eventId: event.id,
        slotId: keyboardSlot.id,
        role: 'keyboard',
        memberId: member1.id,
    });

    // 3. Send direct invitation to member1
    send(owner.id, {
        type: 'slot.sendInvite',
        eventId: event.id,
        slotId: keyboardSlot.id,
        customNote: '10시 30분까지 본당 도착해주세요.',
    });

    state = read(owner.id);
    const updatedSlot = state.events[0].slots.find((s) => s.id === keyboardSlot.id)!;
    assert.ok(updatedSlot.invitedAt, 'invitedAt should be populated');

    // Verify notification was sent to member1
    const member1State = read(member1.id);
    const inviteNotif = member1State.notifications.find((n) => n.title === '사역 초대 알림');
    assert.ok(inviteNotif, 'Member 1 should receive 사역 초대 알림');
    assert.ok(inviteNotif.body.includes('10시 30분'));
});

test('schedule.sendInvites sends batch invitation to all pending assignees', (t) => {
    const { send, read } = setup(t);

    send(owner.id, {
        type: 'event.createWithTemplate',
        input: sampleInput,
        templateKey: 'acoustic',
    });

    let state = read(owner.id);
    const event = state.events[0];
    const kSlot = event.slots.find((s) => s.role === 'keyboard')!;
    const vSlot = event.slots.find((s) => s.role === 'vocal')!;

    send(owner.id, {
        type: 'slot.save',
        eventId: event.id,
        slotId: kSlot.id,
        role: 'keyboard',
        memberId: member1.id,
    });
    send(owner.id, {
        type: 'slot.save',
        eventId: event.id,
        slotId: vSlot.id,
        role: 'vocal',
        memberId: member3.id,
    });

    // Send invites to all pending
    send(owner.id, {
        type: 'schedule.sendInvites',
        eventId: event.id,
        target: 'pending',
    });

    state = read(owner.id);
    const e = state.events[0];
    assert.ok(e.slots.find((s) => s.id === kSlot.id)!.invitedAt);
    assert.ok(e.slots.find((s) => s.id === vSlot.id)!.invitedAt);

    // Both member 1 and member 3 receive notifications
    assert.ok(read(member1.id).notifications.some((n) => n.title === '사역 초대 알림'));
    assert.ok(read(member3.id).notifications.some((n) => n.title === '사역 초대 알림'));
});

test('attendance response records respondedAt timestamp and decline reason properly', (t) => {
    const { send, read } = setup(t);

    send(owner.id, {
        type: 'event.createWithTemplate',
        input: sampleInput,
        templateKey: 'acoustic',
    });

    let state = read(owner.id);
    const event = state.events[0];
    const kSlot = event.slots.find((s) => s.role === 'keyboard')!;
    const vSlot = event.slots.find((s) => s.role === 'vocal')!;

    send(owner.id, {
        type: 'slot.save',
        eventId: event.id,
        slotId: kSlot.id,
        role: 'keyboard',
        memberId: member1.id,
    });
    send(owner.id, {
        type: 'slot.save',
        eventId: event.id,
        slotId: vSlot.id,
        role: 'vocal',
        memberId: member3.id,
    });

    // 1. Member 1 accepts (confirms)
    send(member1.id, {
        type: 'attendance.set',
        eventId: event.id,
        slotId: kSlot.id,
        attendance: 'confirmed',
        reason: '',
    });

    // 2. Member 3 declines (absent) with reason
    send(member3.id, {
        type: 'attendance.set',
        eventId: event.id,
        slotId: vSlot.id,
        attendance: 'absent',
        reason: '회사 야근 일정',
        autoRequestSubstitute: true,
    });

    state = read(owner.id);
    const updatedK = state.events[0].slots.find((s) => s.id === kSlot.id)!;
    const updatedV = state.events[0].slots.find((s) => s.id === vSlot.id)!;

    assert.equal(updatedK.attendance, 'confirmed');
    assert.ok(updatedK.respondedAt, 'confirmed slot should have respondedAt');
    assert.equal(updatedK.declineReason, undefined);

    assert.equal(updatedV.attendance, 'absent');
    assert.ok(updatedV.respondedAt, 'absent slot should have respondedAt');
    assert.equal(updatedV.declineReason, '회사 야근 일정');
});
