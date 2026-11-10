import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TeamRepository } from '../lib/server/teamRepository';
import { TeamEvents } from '../lib/server/teamEvents';
import { TeamDocs } from '../lib/server/teamDocs';
import { contiSaveHook, sweepDeadlines } from '../lib/server/notices';
import { deadlineTargets } from '../lib/contiDeadline';

/*
 * 콘티 마감 예약 알림이 서버에서 실제로 받는 사람에게 가는지,
 * 확정하면 콘티 요청이 완료되고 요청한 사람도 확정 알림을 받는지.
 */

const leader = { id: 'deadline-leader', name: '박은혜' };
const keys = { id: 'deadline-keys', name: '정다윗' };
const vocal = { id: 'deadline-vocal', name: '이소망' };
const HOUR = 3600_000;

function seed() {
    const repo = new TeamRepository(':memory:');
    const team = repo.create('마감 테스트 팀', leader);
    const { code } = repo.createInvite(team.id, leader.id);
    repo.join(code, keys);
    repo.join(code, vocal);
    repo.assignRole(team.id, leader.id, leader.id, 'leader');
    repo.assignRole(team.id, leader.id, keys.id, 'keyboard');
    repo.assignRole(team.id, leader.id, vocal.id, 'vocal');
    const events = new TeamEvents(repo.database);
    const docs = new TeamDocs(repo.database, repo, events);
    docs.afterSave = contiSaveHook(repo, docs, events);
    const delivered: { type: string; audience: string[] | null; title?: string }[] = [];
    events.subscribe(team.id, (event) => delivered.push({ type: event.type, audience: event.audience, title: (event.payload as { title?: string }).title }));
    // 열흘 뒤 예배: 인도 박은혜, 건반 정다윗 (보컬은 배치 안 됨)
    const startsAt = new Date(Date.now() + 10 * 24 * HOUR);
    startsAt.setUTCMinutes(0, 0, 0);
    const event = repo.updatePlanning(team.id, leader.id, { type: 'event.save', input: { title: '주일 2부 예배', kind: 'worship', startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 2 * HOUR).toISOString(), location: '본당', notes: '' } }).events[0];
    repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, role: 'leader', memberId: leader.id });
    repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, role: 'keyboard', memberId: keys.id });
    const { state, members } = repo.planningSnapshot(team.id);
    const target = deadlineTargets({ events: state.events, setlists: [], detailsOf: () => null, members, state })[0];
    return { repo, docs, events, delivered, teamId: team.id, event, target };
}

test('마감이 지나면 아침에 인도자 · 배치된 팀원에게 한 번만 알리고, 밤에 미룬 알림은 아침에 보냄', () => {
    const { repo, docs, events, delivered, teamId, target } = seed();
    try {
        const deadline = Date.parse(target.deadlineAt);
        sweepDeadlines(repo, docs, events, undefined, deadline + 9 * HOUR);
        const notices = delivered.filter((item) => item.type === 'planning.notice');
        assert.deepEqual(notices.map((item) => [item.title, item.audience]), [
            ['콘티 마감이 지났어요', [leader.id]],
            ['아직 콘티가 올라오지 않았어요', [keys.id]],
        ]);
        sweepDeadlines(repo, docs, events, undefined, deadline + 9 * HOUR + 60_000);
        assert.equal(delivered.filter((item) => item.type === 'planning.notice').length, 2, '같은 알림은 다시 보내지 않음');

        // 밤에 미뤄 둔 알림(deliverAt)은 그 시각이 지나면 보냄
        const row = repo.database.prepare('SELECT state_json FROM online_planning WHERE team_id = ?').get(teamId) as { state_json: string };
        const state = JSON.parse(row.state_json);
        state.notifications.unshift({ id: 'deferred-1', title: '정다윗님이 콘티를 요청했어요', body: '주일 2부 예배', urgent: false, target: 'schedule', entityId: 'x', recipientIds: [leader.id], readBy: [], createdAt: new Date(deadline).toISOString(), deliverAt: new Date(deadline + 10 * HOUR).toISOString() });
        repo.database.prepare('UPDATE online_planning SET state_json = ? WHERE team_id = ?').run(JSON.stringify(state), teamId);
        sweepDeadlines(repo, docs, events, undefined, deadline + 9 * HOUR + 120_000);
        assert.equal(delivered.filter((item) => item.title === '정다윗님이 콘티를 요청했어요').length, 0);
        sweepDeadlines(repo, docs, events, undefined, deadline + 10 * HOUR);
        assert.deepEqual(delivered.filter((item) => item.title === '정다윗님이 콘티를 요청했어요').map((item) => item.audience), [[leader.id]]);
        assert.equal(repo.planning(teamId, leader.id).notifications.find((item) => item.id === 'deferred-1')?.deliverAt, undefined);
    } finally {
        repo.close();
    }
});

test('콘티를 확정하면 요청이 완료되고, 배치 안 된 요청자도 확정 알림을 받음 · 이후 마감 알림 없음', () => {
    const { repo, docs, events, delivered, teamId, event, target } = seed();
    try {
        repo.updatePlanning(teamId, vocal.id, { type: 'conti.nudge', deadlineKey: target.key, title: '주일 2부 예배', serviceAt: event.startsAt, setlistId: '', leaderId: leader.id, message: '미리 연습하고 싶어요', anonymous: true });
        assert.equal(repo.planning(teamId, leader.id).requests[0].status, 'open');
        const enc = encodeURIComponent(teamId);
        docs.put(teamId, leader, `worship-together:library:v1:${enc}`, JSON.stringify({ version: 1, songs: [{ id: 'a', title: '곡 A' }], setlists: [{ id: 'set-1', title: '주님 오실 때까지', worship_date: event.startsAt, song_order: ['a'] }] }), 0);
        docs.put(teamId, leader, `worship:setlist-details:v1:${enc}:set-1`, JSON.stringify({ status: 'confirmed', overrides: {} }), 0);
        const confirmed = delivered.find((item) => item.title === '콘티가 확정됐어요')!;
        assert.deepEqual([...confirmed.audience!].sort(), [keys.id, vocal.id].sort());
        assert.equal(repo.planning(teamId, vocal.id).requests[0].status, 'resolved');
        const before = delivered.length;
        sweepDeadlines(repo, docs, events, undefined, Date.parse(target.deadlineAt) + 9 * HOUR);
        assert.equal(delivered.length, before, '확정된 콘티에는 마감 알림 없음');
    } finally {
        repo.close();
    }
});
