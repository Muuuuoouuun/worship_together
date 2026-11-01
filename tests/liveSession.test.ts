import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TeamRepository } from '../lib/server/teamRepository';
import { TeamEvents } from '../lib/server/teamEvents';
import { LiveRepository, PRESENCE_STALE_MS } from '../lib/server/liveRepository';
import { TeamDocs } from '../lib/server/teamDocs';

const leader = { id: 'leader-id', name: '김인도' };
const drummer = { id: 'drum-id', name: '박드럼' };
const sound = { id: 'sound-id', name: '한음향' };
const outsider = { id: 'outsider', name: '외부인' };

const snapshot = {
    setlistId: 'set-1', title: '주일 2부', dateLabel: '10월 26일', theme: null,
    songs: [
        { id: 'a', title: '믿음으로 서리라', key: 'D', bpm: 72, meter: '4/4', sections: ['Intro', 'Verse', 'Chorus'], note: null, transitionNote: null, lead: null },
        { id: 'b', title: '주님의 은혜', key: 'G', bpm: 68, meter: '6/8', sections: [], note: '피아노로 시작', transitionNote: null, lead: null },
    ],
};

function setup() {
    const teams = new TeamRepository(':memory:');
    const events = new TeamEvents(teams.database);
    const live = new LiveRepository(teams.database, teams, events);
    const docs = new TeamDocs(teams.database, teams, events);
    const team = teams.create('주일 예배팀', leader);
    const invite = teams.createInvite(team.id, leader.id);
    teams.join(invite.token, drummer);
    teams.join(invite.code, sound);
    teams.assignRole(team.id, leader.id, drummer.id, 'drums');
    teams.assignRole(team.id, leader.id, sound.id, 'sound');
    return { teams, events, live, docs, team };
}

test('only allowed people start/move/end; a second start joins the same session', () => {
    const { live, team, teams } = setup();
    try {
        assert.throws(() => live.start(team.id, drummer, snapshot), /권한/);
        assert.throws(() => live.start(team.id, outsider, snapshot), /접근/);
        const first = live.start(team.id, leader, snapshot);
        assert.equal(first.created, true);
        teams.setPolicy(team.id, leader.id, { sessionRun: 'everyone' });
        const second = live.start(team.id, drummer, snapshot);
        assert.equal(second.created, false);
        assert.equal(second.session.id, first.session.id);
        teams.setPolicy(team.id, leader.id, { sessionRun: 'leaders' });
        assert.throws(() => live.move(first.session.id, drummer, { songIndex: 1 }), /권한/);
        const moved = live.move(first.session.id, leader, { songIndex: 1 });
        assert.deepEqual([moved.songIndex, moved.sectionIndex, moved.bpm, moved.page], [1, -1, 68, 1]);
        assert.equal(live.move(first.session.id, leader, { songIndex: 9 }).songIndex, 1);
        assert.throws(() => live.end(first.session.id, drummer), /권한/);
        live.end(first.session.id, leader);
        assert.equal(live.active(team.id, drummer.id), null);
        assert.throws(() => live.join(first.session.id, drummer.id, 'dev-1'), /마친/);
    } finally { teams.close(); }
});

test('presence: join/leave per device, stale devices are swept, and events reach the team', () => {
    const { live, team, teams, events } = setup();
    try {
        const { session } = live.start(team.id, leader, snapshot);
        const before = events.latestId(team.id);
        live.join(session.id, drummer.id, 'phone');
        live.join(session.id, drummer.id, 'tablet');
        live.join(session.id, leader.id, 'laptop');
        assert.deepEqual(live.detail(session.id, leader.id).presence.map((item) => item.name).sort(), ['김인도', '박드럼']);
        live.leave(session.id, drummer.id, 'phone');
        assert.equal(live.detail(session.id, leader.id).presence.length, 2, 'still present on the tablet');
        live.leave(session.id, drummer.id, 'tablet');
        assert.deepEqual(live.detail(session.id, leader.id).presence.map((item) => item.userId), [leader.id]);
        const presenceEvents = events.since(team.id, before, sound.id).filter((event) => event.type === 'live.presence');
        assert.equal(presenceEvents.length, 3, 'joined, joined, left (devices of the same person do not repeat)');
        live.sweep(Date.now() + PRESENCE_STALE_MS + 1000);
        assert.equal(live.detail(session.id, leader.id).presence.length, 0);
        live.heartbeat(session.id, leader.id, 'laptop');
        assert.equal(live.detail(session.id, leader.id).presence.length, 1, 'a heartbeat after being swept rejoins');
    } finally { teams.close(); }
});

test('cues go to present members of the target group only, acks reach the sender, retries do not duplicate', () => {
    const { live, team, teams, events } = setup();
    try {
        const { session } = live.start(team.id, leader, snapshot);
        for (const [user, device] of [[leader, 'l'], [drummer, 'd'], [sound, 's']] as const) live.join(session.id, user.id, device);
        const start = events.latestId(team.id);
        const toSound = live.cue(session.id, drummer, 'entry-1', 'monitor');
        assert.deepEqual(toSound.recipients, [sound.id]);
        assert.equal(live.cue(session.id, drummer, 'entry-1', 'monitor').id, 'entry-1');
        assert.equal(events.since(team.id, start, leader.id).filter((event) => event.type === 'live.cue').length, 0, 'leader is not addressed');
        assert.equal(events.since(team.id, start, sound.id).filter((event) => event.type === 'live.cue').length, 1);
        const all = live.cue(session.id, leader, 'entry-2', 'ending');
        assert.deepEqual([...all.recipients].sort(), [drummer.id, sound.id].sort());
        teams.setPolicy(team.id, leader.id, { cueAll: 'leaders' });
        assert.throws(() => live.cue(session.id, drummer, 'entry-3', 'again'), /권한/);
        assert.throws(() => live.ack(session.id, leader, 'entry-1'), /나에게 온/);
        live.ack(session.id, sound, 'entry-1');
        live.ack(session.id, sound, 'entry-1');
        const acks = events.since(team.id, start, drummer.id).filter((event) => event.type === 'live.ack');
        assert.equal(acks.length, 1);
        assert.deepEqual(live.detail(session.id, drummer.id).cues.find((cue) => cue.id === 'entry-1')?.acks.map((ack) => ack.name), ['한음향']);
        assert.throws(() => live.cue(session.id, leader, 'entry-4', 'not-a-cue'), /큐를 확인/);
    } finally { teams.close(); }
});

test('snapshots are sanitized and required', () => {
    const { live, team, teams } = setup();
    try {
        assert.throws(() => live.start(team.id, leader, { songs: [] }), /곡이 없습니다/);
        const { session } = live.start(team.id, leader, { title: 'x'.repeat(500), songs: [{ id: 'a', title: '곡', bpm: 9999, meter: 'abc', sections: ['A', 5, ''] }, { id: 'a', title: '같은 곡 다시' }] });
        const detail = live.detail(session.id, leader.id);
        assert.equal(detail.session.snapshot.title.length, 80);
        assert.equal(detail.session.snapshot.songs[0].bpm, null);
        assert.equal(detail.session.snapshot.songs[0].meter, '4/4');
        assert.deepEqual(detail.session.snapshot.songs[0].sections, ['A']);
        assert.notEqual(detail.session.snapshot.songs[1].id, 'a');
    } finally { teams.close(); }
});

test('shared docs: editors write, members may only add comments, stale writes conflict', () => {
    const { docs, team, teams } = setup();
    try {
        const library = `worship-together:library:v1:${encodeURIComponent(team.id)}`;
        const details = `worship:setlist-details:v1:${encodeURIComponent(team.id)}:set-1`;
        assert.equal(docs.put(team.id, leader, 'worship-together:library:v1:other-team', '{}', 0).ok, false);
        const saved = docs.put(team.id, leader, library, JSON.stringify({ version: 1, songs: [], setlists: [] }), 0);
        assert.ok(saved.ok);
        const stale = docs.put(team.id, leader, library, JSON.stringify({ version: 1, songs: [{ id: 'x' }], setlists: [] }), 0);
        assert.equal(stale.ok, false);
        assert.ok(!stale.ok && stale.conflict && stale.conflict.version === (saved.ok ? saved.version : -1));
        const denied = docs.put(team.id, drummer, library, '{"version":1,"songs":[],"setlists":[],"x":1}', saved.ok ? saved.version : 0);
        assert.ok(!denied.ok && /권한/.test(denied.error ?? ''));
        const base = { setlistId: 'set-1', teamId: team.id, overrides: { a: { songId: 'a', targetKey: 'E' } }, comments: [], updatedAt: '2026-10-20T00:00:00Z' };
        const v1 = docs.put(team.id, leader, details, JSON.stringify(base), 0);
        assert.ok(v1.ok);
        const comment = { ...base, comments: [{ id: 'c1', songId: 'a', author: '박드럼', text: '인트로 드럼 먼저?', createdAt: '2026-10-20T01:00:00Z' }], updatedAt: '2026-10-20T01:00:00Z' };
        const v2 = docs.put(team.id, drummer, details, JSON.stringify(comment), v1.ok ? v1.version : 0);
        assert.ok(v2.ok, 'member can add a comment');
        const sneaky = { ...comment, overrides: { a: { songId: 'a', targetKey: 'F' } } };
        assert.equal(docs.put(team.id, drummer, details, JSON.stringify(sneaky), v2.ok ? v2.version : 0).ok, false);
        const erase = { ...base, comments: [], updatedAt: '2026-10-20T02:00:00Z' };
        assert.equal(docs.put(team.id, drummer, details, JSON.stringify(erase), v2.ok ? v2.version : 0).ok, false, "members cannot remove others' comments");
        const listed = docs.list(team.id, sound.id, 0);
        assert.equal(listed.docs.length, 2);
        assert.equal(docs.list(team.id, sound.id, listed.cursor).docs.length, 0);
        assert.throws(() => docs.list(team.id, outsider.id), /접근/);
    } finally { teams.close(); }
});

test('profiles, invite codes and claiming a pre-listed roster seat', () => {
    const teams = new TeamRepository(':memory:');
    try {
        teams.ensureUser(leader);
        const team = teams.create('청년부', leader);
        const seat = teams.addMemberDirect(team.id, leader.id, '박드럼', 'drums');
        const starts = new Date(Date.now() + 3 * 86400000);
        const planned = teams.updatePlanning(team.id, leader.id, { type: 'event.save', input: { title: '주일 예배', kind: 'worship', startsAt: starts.toISOString(), endsAt: new Date(starts.getTime() + 3600000).toISOString(), location: '본당', notes: '' } });
        teams.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: planned.events[0].id, role: 'drums', memberId: seat.userId });
        const invite = teams.createInvite(team.id, leader.id);
        assert.match(invite.code, /^[A-Z2-9]{8}$/);
        const preview = teams.preview(invite.code.toLowerCase().replace(/(.{4})/, '$1-'));
        assert.equal(preview?.teamName, '청년부');
        assert.deepEqual(preview?.claimable.map((item) => item.userId), [seat.userId]);
        teams.ensureUser(drummer);
        teams.updateProfile(drummer.id, '박드럼(진)');
        teams.join(invite.code, drummer, seat.userId);
        const member = teams.membership(team.id, drummer.id);
        assert.deepEqual([member?.role, member?.name], ['drums', '박드럼(진)']);
        assert.equal(teams.membership(team.id, seat.userId), null);
        assert.equal(teams.planning(team.id, drummer.id).events[0].slots.find((slot) => slot.role === 'drums')?.memberId, drummer.id, 'schedule duty follows the claimed seat');
        assert.throws(() => teams.setMemberPermission(team.id, drummer.id, leader.id, 'member'), /관리자/);
        teams.setMemberPermission(team.id, leader.id, drummer.id, 'owner');
        assert.throws(() => teams.setMemberPermission(team.id, drummer.id, leader.id, 'member'), /만든 사람/);
        assert.throws(() => teams.deleteTeam(team.id, drummer.id), /만든 사람/);
        teams.leaveTeam(team.id, leader.id);
        assert.equal(teams.list(drummer.id)[0].ownerId, drummer.id, 'creator leaving hands the team to another admin');
    } finally { teams.close(); }
});
