import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TeamRepository } from '../lib/server/teamRepository';
import { CATCH_UP_LIMIT, TeamEvents } from '../lib/server/teamEvents';
import { TeamDocs } from '../lib/server/teamDocs';
import type { PlanningCommand } from '../types/planning';

/*
 * 팀 소식 전달: 일정 · 결석 · 대체 · 요청 알림이 실제로 볼 수 있는 사람에게 가고,
 * 끊겼다 다시 붙은 화면이 놓친 소식을 이어 받거나(못 하면) 처음부터 다시 맞추는지.
 */

const leader = { id: 'delivery-leader', name: '인도자' };
const keys = { id: 'delivery-keys', name: '건반' };
const vocal = { id: 'delivery-vocal', name: '보컬' };

function seed() {
    const repo = new TeamRepository(':memory:');
    const team = repo.create('전달 테스트 팀', leader);
    const { code } = repo.createInvite(team.id, leader.id);
    repo.join(code, keys);
    repo.join(code, vocal);
    repo.assignRole(team.id, leader.id, keys.id, 'keyboard');
    repo.assignRole(team.id, leader.id, vocal.id, 'vocal');
    return { repo, teamId: team.id };
}

function addEvent(repo: TeamRepository, teamId: string) {
    const startsAt = new Date(Date.now() + 3 * 86400000);
    startsAt.setUTCMinutes(0, 0, 0);
    const command: PlanningCommand = { type: 'event.save', input: { title: '주일 예배', kind: 'worship', startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 7200000).toISOString(), location: '본당', notes: '' } };
    return repo.updatePlanning(teamId, leader.id, command).events[0];
}

test('substitute asks skip roster placeholders who cannot see them; with only placeholders the whole team is asked', () => {
    const { repo, teamId } = seed();
    try {
        const placeholder = repo.addMemberDirect(teamId, leader.id, '건반 (미가입)', 'keyboard');
        const event = addEvent(repo, teamId);
        const slot = repo.updatePlanning(teamId, leader.id, { type: 'slot.save', eventId: event.id, role: 'keyboard', memberId: keys.id }).events[0].slots[0];
        const state = repo.updatePlanning(teamId, keys.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '출장', autoRequestSubstitute: true });
        const asked = state.events[0].slots[0].asked ?? [];
        assert.ok(!asked.includes(placeholder.userId), '미가입 명단 자리에는 대체 부탁을 보내지 않습니다');
        // 같은 파트에 부탁할 사람이 없으면 팀 전체에 요청할 수 있어야 합니다 (실제 팀원만).
        const all = repo.updatePlanning(teamId, leader.id, { type: 'slot.askAll', eventId: event.id, slotId: slot.id });
        const askedAll = all.events[0].slots[0].asked ?? [];
        assert.ok(askedAll.includes(vocal.id));
        assert.ok(!askedAll.includes(placeholder.userId));
    } finally { repo.close(); }
});

test('absence alerts reach a real leader or manager even when the assigned leader is a roster placeholder', () => {
    const { repo, teamId } = seed();
    try {
        const placeholderLeader = repo.addMemberDirect(teamId, leader.id, '인도자 (미가입)', 'leader');
        const event = addEvent(repo, teamId);
        repo.updatePlanning(teamId, leader.id, { type: 'slot.save', eventId: event.id, role: 'leader', memberId: placeholderLeader.userId });
        const keysSlot = repo.updatePlanning(teamId, leader.id, { type: 'slot.save', eventId: event.id, role: 'keyboard', memberId: keys.id }).events[0].slots.find(item => item.role === 'keyboard')!;
        const { created } = repo.applyPlanning(teamId, keys.id, { type: 'attendance.set', eventId: event.id, slotId: keysSlot.id, attendance: 'absent', reason: '', autoRequestSubstitute: false });
        const absence = created.find(item => item.title.includes('결석'));
        assert.ok(absence, '결석 알림이 만들어집니다');
        assert.deepEqual(absence.recipientIds, [leader.id], '미가입 인도자 대신 실제 관리자에게 갑니다');
    } finally { repo.close(); }
});

test('request recipients must be leaders or managers who have joined', () => {
    const { repo, teamId } = seed();
    try {
        const placeholderLeader = repo.addMemberDirect(teamId, leader.id, '인도자 (미가입)', 'leader');
        assert.throws(() => repo.updatePlanning(teamId, vocal.id, { type: 'request.create', setlistId: 's1', setlistTitle: '주일 콘티', kind: 'question', body: '키 확인 부탁드려요', leaderId: placeholderLeader.userId }), /수신할 인도자/);
        repo.updatePlanning(teamId, vocal.id, { type: 'request.create', setlistId: 's1', setlistTitle: '주일 콘티', kind: 'question', body: '키 확인 부탁드려요', leaderId: leader.id });
    } finally { repo.close(); }
});

test('applyPlanning returns exactly the notifications this command created, newest first', () => {
    const { repo, teamId } = seed();
    try {
        addEvent(repo, teamId);
        const startsAt = new Date(Date.now() + 10 * 86400000);
        startsAt.setUTCMinutes(0, 0, 0);
        const { created } = repo.applyPlanning(teamId, leader.id, { type: 'event.save', input: { title: '수요 연습', kind: 'rehearsal', startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 3600000).toISOString(), location: '', notes: '' } });
        assert.equal(created.length, 1);
        assert.equal(created[0].body, '수요 연습');
        assert.deepEqual([...created[0].recipientIds].sort(), [keys.id, vocal.id].sort(), '만든 사람은 빼고 팀원 모두에게');
    } finally { repo.close(); }
});

test('each team keeps its own recent events even when other teams publish in between', () => {
    const repo = new TeamRepository(':memory:');
    try {
        const a = repo.create('A팀', leader), b = repo.create('B팀', leader);
        const events = new TeamEvents(repo.database);
        // 두 팀이 번갈아 소식을 쌓아도 각 팀은 최근 600개를 그대로 갖습니다.
        for (let index = 0; index < 700; index += 1) {
            events.publish(a.id, 'planning.changed', { index });
            events.publish(b.id, 'planning.changed', { index });
        }
        const count = (teamId: string) => (repo.database.prepare('SELECT count(*) AS n FROM team_events WHERE team_id = ?').get(teamId) as { n: number }).n;
        assert.ok(count(a.id) >= 600 && count(a.id) < 700, `A팀 ${count(a.id)}개`);
        assert.ok(count(b.id) >= 600 && count(b.id) < 700, `B팀 ${count(b.id)}개`);
    } finally { repo.close(); }
});

test('a reconnecting screen resumes when it can and is told to resync when events were pruned or too many piled up', () => {
    const repo = new TeamRepository(':memory:');
    try {
        const team = repo.create('A팀', leader);
        const events = new TeamEvents(repo.database);
        const first = events.publish(team.id, 'planning.changed', {});
        const recent = events.publish(team.id, 'planning.changed', {});
        assert.equal(events.hasGap(team.id, first.id), false, '바로 이어 받을 수 있음');
        // 오래 끊겨 있는 동안 이어 보낼 수 있는 것보다 많이 쌓임
        for (let index = 0; index <= CATCH_UP_LIMIT; index += 1) events.publish(team.id, 'live.presence', { index });
        assert.equal(events.hasGap(team.id, recent.id), true, '처음부터 다시 맞춰야 함');
        // 정리되어 마지막으로 받은 소식이 사라짐
        for (let index = 0; index < 700; index += 1) events.publish(team.id, 'live.presence', { index });
        assert.equal(events.hasGap(team.id, first.id), true);
        assert.equal(events.hasGap(team.id, events.latestId(team.id)), false);
    } finally { repo.close(); }
});

test('personal notices are only delivered to their recipients', () => {
    const { repo, teamId } = seed();
    try {
        const events = new TeamEvents(repo.database);
        const notice = events.publish(teamId, 'planning.notice', { title: '대체 가능하신가요?' }, [vocal.id]);
        assert.deepEqual(events.since(teamId, notice.id - 1, vocal.id).map(item => item.id), [notice.id]);
        assert.deepEqual(events.since(teamId, notice.id - 1, keys.id), []);
    } finally { repo.close(); }
});

test('a member without conti edit permission is told the save was denied, even for a brand-new document', () => {
    const { repo, teamId } = seed();
    try {
        const docs = new TeamDocs(repo.database, repo, new TeamEvents(repo.database));
        const key = `worship-together:library:v1:${encodeURIComponent(teamId)}`;
        const denied = docs.put(teamId, vocal, key, '{"songs":[]}', 0);
        assert.equal(denied.ok, false);
        assert.ok(!denied.ok && denied.denied && denied.conflict === null);
        const saved = docs.put(teamId, leader, key, '{"songs":[]}', 0);
        assert.ok(saved.ok);
        const again = docs.put(teamId, vocal, key, '{"songs":[1]}', saved.ok ? saved.version : 0);
        assert.ok(!again.ok && again.denied && again.conflict?.json === '{"songs":[]}', '서버 사본이 있으면 되돌릴 수 있게 돌려줍니다');
    } finally { repo.close(); }
});

test('team policy decides who manages schedules; manager notices stay with admins and leaders even when everyone may edit', () => {
    const { repo, teamId } = seed();
    try {
        const songLeader = { id: 'delivery-song-leader', name: '찬양 인도' };
        repo.join(repo.createInvite(teamId, leader.id).code, songLeader);
        repo.assignRole(teamId, leader.id, songLeader.id, 'leader');
        const startsAt = new Date(Date.now() + 5 * 86400000);
        startsAt.setUTCMinutes(0, 0, 0);
        const save: PlanningCommand = { type: 'event.save', input: { title: '금요 연습', kind: 'rehearsal', startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 3600000).toISOString(), location: '', notes: '' } };
        // 기본: 관리자 · 인도자
        assert.throws(() => repo.updatePlanning(teamId, vocal.id, save), /인도자 또는 팀 관리자/);
        repo.updatePlanning(teamId, songLeader.id, save);
        // 관리자만
        repo.setPolicy(teamId, leader.id, { ...repo.policy(teamId), planningManage: 'admins' });
        assert.throws(() => repo.updatePlanning(teamId, songLeader.id, save), /팀 관리자만/);
        // 모든 팀원
        repo.setPolicy(teamId, leader.id, { ...repo.policy(teamId), planningManage: 'everyone' });
        const event = repo.updatePlanning(teamId, vocal.id, save).events.at(-1)!;
        const slot = repo.updatePlanning(teamId, vocal.id, { type: 'slot.save', eventId: event.id, role: 'vocal', memberId: vocal.id }).events.find(item => item.id === event.id)!.slots[0];
        const { created } = repo.applyPlanning(teamId, vocal.id, { type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' });
        const answer = created.find(item => item.title === '참석 응답');
        assert.deepEqual([...answer!.recipientIds].sort(), [leader.id, songLeader.id].sort(), '참석 응답은 모두가 아니라 관리자 · 인도자에게');
    } finally { repo.close(); }
});
