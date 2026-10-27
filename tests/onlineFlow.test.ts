import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { providerUserId } from '../lib/authConfig';
import { TeamRepository } from '../lib/server/teamRepository';
import type { PlanningNotification, ScheduleInput } from '../types/planning';

/**
 * 로그인 → 팀 → 알림 흐름을 서버 저장소 수준에서 한 번에 검증합니다.
 * 신원은 lib/authConfig.ts 의 providerUserId 와 같은 규칙(제공자:계정ID 해시)으로 만들고,
 * 알림 집계는 actions/planningActions.ts 의 loadPlanningInbox 와 같은 방식으로 셉니다.
 */
const leader = { id: providerUserId('google', 'e2e-leader'), name: '테스트 리더' };
const keys = { id: providerUserId('naver', 'e2e-keys'), name: '테스트 건반' };
const outsider = { id: providerUserId('google', 'e2e-outsider'), name: '외부인' };

const worship: ScheduleInput = {
    title: '주일 2부 예배', kind: 'worship', location: '본당',
    startsAt: '2026-11-08T11:00:00+09:00', endsAt: '2026-11-08T12:30:00+09:00', notes: '',
};

function inbox(repo: TeamRepository, userId: string) {
    const unread = repo.list(userId).flatMap(team => repo.planning(team.id, userId).notifications
        .filter(item => !item.readBy.includes(userId)).map(item => ({ ...item, teamId: team.id })));
    unread.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { count: unread.length, urgent: unread.filter(item => item.urgent).length, first: unread[0] as (PlanningNotification & { teamId: string }) | undefined };
}

function setup(t: TestContext) {
    const repo = new TeamRepository(':memory:');
    t.after(() => repo.close());
    return repo;
}

test('같은 제공자 계정은 같은 신원이 되고, 이메일이 같아도 제공자가 다르면 다른 신원이다', () => {
    assert.equal(providerUserId('google', 'e2e-leader'), leader.id);
    assert.notEqual(providerUserId('google', 'acct-1'), providerUserId('naver', 'acct-1'));
    assert.match(leader.id, /^[a-f0-9]{64}$/);
    assert.throws(() => providerUserId('kakao', 'x'), /Invalid OAuth account/);
});

test('초대 링크로 들어온 팀원에게 배정 알림이 가고, 배지 집계·읽음 처리가 사용자별로 동작한다', (t) => {
    const repo = setup(t);
    const team = repo.create('E2E 예배팀', leader);
    const invite = repo.createInvite(team.id, leader.id);
    assert.equal(repo.join(invite.token, keys), team.id);
    repo.assignRole(team.id, leader.id, keys.id, 'keyboard');

    // 리더가 일정을 만들고 건반 자리에 팀원을 배정
    repo.updatePlanning(team.id, leader.id, { type: 'event.createWithTemplate', input: worship, templateKey: 'acoustic' });
    const event = repo.planning(team.id, leader.id).events[0];
    const slot = event.slots.find(item => item.role === 'keyboard')!;
    repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, slotId: slot.id, role: 'keyboard', memberId: keys.id });

    // 팀원 배지: 일정 생성 + 배정 알림, 리더 본인에게는 본인 행위 알림이 가지 않음
    const keysInbox = inbox(repo, keys.id);
    assert.ok(keysInbox.count >= 1, '팀원은 새 알림을 받아야 합니다');
    assert.equal(keysInbox.first?.target, 'schedule');
    assert.equal(keysInbox.first?.teamId, team.id);
    assert.equal(inbox(repo, leader.id).count, 0, '행위자 본인에게는 알림이 가지 않습니다');

    // 다른 사람의 알림은 읽음 처리할 수 없고, 본인 것은 한 건씩·일괄로 처리된다
    const own = keysInbox.first!;
    assert.throws(() => repo.updatePlanning(team.id, leader.id, { type: 'notification.read', notificationId: own.id }), /본인의 알림/);
    repo.updatePlanning(team.id, keys.id, { type: 'notification.read', notificationId: own.id });
    assert.equal(inbox(repo, keys.id).count, keysInbox.count - 1);
    repo.updatePlanning(team.id, keys.id, { type: 'notification.readAll' });
    assert.equal(inbox(repo, keys.id).count, 0);
});

test('불참 응답은 인도자에게 긴급 알림(slotId 포함)으로 가고, 배지는 긴급을 먼저 보여준다', (t) => {
    const repo = setup(t);
    const team = repo.create('E2E 예배팀', leader);
    repo.join(repo.createInvite(team.id, leader.id).token, keys);
    repo.assignRole(team.id, leader.id, keys.id, 'keyboard');
    repo.updatePlanning(team.id, leader.id, { type: 'event.createWithTemplate', input: worship, templateKey: 'acoustic' });
    const event = repo.planning(team.id, leader.id).events[0];
    const leaderSlot = event.slots.find(item => item.role === 'leader')!;
    const keySlot = event.slots.find(item => item.role === 'keyboard')!;
    repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, slotId: leaderSlot.id, role: 'leader', memberId: leader.id });
    repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, slotId: keySlot.id, role: 'keyboard', memberId: keys.id });
    repo.updatePlanning(team.id, keys.id, { type: 'notification.readAll' });

    repo.updatePlanning(team.id, keys.id, { type: 'attendance.set', eventId: event.id, slotId: keySlot.id, attendance: 'absent', reason: '출장', autoRequestSubstitute: true });

    const leaderInbox = inbox(repo, leader.id);
    assert.ok(leaderInbox.urgent >= 1, '인도자는 긴급 알림을 받아야 합니다');
    assert.equal(leaderInbox.first?.urgent, true);
    assert.equal(leaderInbox.first?.slotId, keySlot.id);
    const state = repo.planning(team.id, leader.id);
    assert.equal(state.events[0].slots.find(item => item.id === keySlot.id)?.attendance, 'absent');
    assert.ok(state.alerts.some(alert => alert.slotId === keySlot.id && alert.resolvedAt === null), '미해결 긴급 요청이 남아야 합니다');
});

test('배지 집계는 가입한 모든 팀을 합산하고 팀별로 링크 대상을 고른다', (t) => {
    const repo = setup(t);
    const first = repo.create('첫 팀', leader);
    const second = repo.create('둘째 팀', leader);
    repo.join(repo.createInvite(first.id, leader.id).token, keys);
    repo.join(repo.createInvite(second.id, leader.id).token, keys);
    repo.updatePlanning(first.id, leader.id, { type: 'event.save', input: worship });
    repo.updatePlanning(second.id, leader.id, { type: 'event.save', input: { ...worship, title: '수요 연습', kind: 'rehearsal' } });
    repo.updatePlanning(second.id, leader.id, { type: 'event.cancel', eventId: repo.planning(second.id, leader.id).events[0].id });

    const summary = inbox(repo, keys.id);
    assert.equal(summary.count, 3);
    assert.equal(summary.urgent, 1, '일정 취소는 긴급입니다');
    assert.equal(summary.first?.teamId, second.id, '긴급 알림이 있는 팀으로 먼저 안내합니다');
    // readAll 은 호출한 팀 한 곳에만 적용됩니다 (배지 합계와 다를 수 있음)
    repo.updatePlanning(second.id, keys.id, { type: 'notification.readAll' });
    assert.equal(inbox(repo, keys.id).count, 1);
});

test('팀원이 아닌 사람, 탈퇴한 팀원, 취소된 초대는 팀 자료와 알림에 접근할 수 없다', (t) => {
    const repo = setup(t);
    const team = repo.create('E2E 예배팀', leader);
    const invite = repo.createInvite(team.id, leader.id);
    repo.join(invite.token, keys);
    repo.updatePlanning(team.id, leader.id, { type: 'event.save', input: worship });

    assert.throws(() => repo.planning(team.id, outsider.id), /접근할 수 없습니다/);
    assert.throws(() => repo.updatePlanning(team.id, outsider.id, { type: 'notification.readAll' }), /접근할 수 없습니다/);
    assert.deepEqual(repo.list(outsider.id), []);

    repo.revokeInvites(team.id, leader.id);
    assert.throws(() => repo.join(invite.token, outsider), /만료되었거나 취소/);

    repo.removeMember(team.id, leader.id, keys.id);
    assert.throws(() => repo.planning(team.id, keys.id), /접근할 수 없습니다/);
    assert.equal(inbox(repo, keys.id).count, 0);
});

test('알림에는 다른 수신자의 읽음 상태가 그대로 실려 나간다 (설계 개선 대상)', (t) => {
    const repo = setup(t);
    const team = repo.create('E2E 예배팀', leader);
    repo.join(repo.createInvite(team.id, leader.id).token, keys);
    repo.join(repo.createInvite(team.id, leader.id).token, outsider);
    repo.updatePlanning(team.id, leader.id, { type: 'event.save', input: worship });
    repo.updatePlanning(team.id, keys.id, { type: 'notification.readAll' });

    const seenByOutsider = repo.planning(team.id, outsider.id).notifications[0];
    assert.ok(seenByOutsider.recipientIds.includes(keys.id));
    assert.ok(seenByOutsider.readBy.includes(keys.id), '현재 구현은 남의 읽음 여부를 노출합니다');
});
