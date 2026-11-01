import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TeamRepository } from '../lib/server/teamRepository';
import { TeamEvents, type TeamEventType } from '../lib/server/teamEvents';
import { TeamDocs } from '../lib/server/teamDocs';
import { SqliteBusyError } from '../lib/server/sqliteRetry';
import { contiSaveHook, deliverNotices, type NoticePayload } from '../lib/server/notices';
import type { PlanningNotification } from '../types/planning';

/*
 * 저장 뒤 알림 전달: 한 단계(팀 소식 저장)가 잠금 충돌 등으로 실패해도
 * 그 알림의 푸시와 나머지 알림은 그대로 나가는지.
 */

const notification = (id: string, recipientIds: string[], urgent = false): PlanningNotification => ({
    id, title: `알림 ${id}`, body: '내용', urgent, target: 'schedule', entityId: 'event-1', recipientIds, readBy: [], createdAt: new Date().toISOString(),
});

type Published = { type: TeamEventType; payload: unknown; audience: string[] | null };

function fakeEvents(failWhen: (type: TeamEventType, payload: unknown) => boolean) {
    const published: Published[] = [];
    const attempts: Published[] = [];
    return {
        published,
        attempts,
        publish(teamId: string, type: TeamEventType, payload: unknown, audience: string[] | null = null) {
            attempts.push({ type, payload, audience });
            if (failWhen(type, payload)) throw new SqliteBusyError(Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' }));
            published.push({ type, payload, audience });
            return { id: published.length, teamId, type, payload, audience, createdAt: new Date().toISOString() };
        },
    };
}

test('a failing team-event publish does not stop the push for that notice or the notices after it', (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    // 알림 목록은 최신이 앞 — 보낼 때는 만든 순서(n1 → n2 → n3)
    const created = [notification('n3', ['leader']), notification('n2', ['direct-placeholder']), notification('n1', ['leader', 'manager'], true)];
    const events = fakeEvents((type, payload) => type === 'planning.notice' && (payload as NoticePayload).id === 'n1');
    const pushed: { recipients: string[]; id: string; urgent: boolean }[] = [];
    deliverNotices(events, 'team-1', created, 'member', (recipients, notice) => { pushed.push({ recipients, id: notice.id, urgent: notice.urgent }); });

    // 긴급 알림 n1 의 화면 소식은 실패했지만 푸시는 나갔고, 뒤의 n3 도 소식 · 푸시 모두 나갔습니다.
    assert.deepEqual(events.attempts.map((item) => (item.payload as NoticePayload).id), ['n1', 'n3'], '미가입 자리만 받는 n2 는 보내지 않습니다');
    assert.deepEqual(events.published.map((item) => (item.payload as NoticePayload).id), ['n3']);
    assert.deepEqual(pushed, [{ recipients: ['leader', 'manager'], id: 'n1', urgent: true }, { recipients: ['leader'], id: 'n3', urgent: false }]);
    assert.equal(logged.mock.callCount(), 1);
    assert.equal(logged.mock.calls[0].arguments[0], '[notices] publish');
});

test('a throwing push for one notice does not stop the next notice', (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const events = fakeEvents(() => false);
    const pushed: string[] = [];
    deliverNotices(events, 'team-1', [notification('b', ['leader']), notification('a', ['leader'])], 'member', (_recipients, notice) => {
        pushed.push(notice.id);
        if (notice.id === 'a') throw new Error('push service down');
    });
    assert.deepEqual(events.published.map((item) => (item.payload as NoticePayload).id), ['a', 'b']);
    assert.deepEqual(pushed, ['a', 'b']);
    assert.equal(logged.mock.calls[0].arguments[0], '[notices] push');
});

test('conti confirmation still notifies and pushes when the planning.changed nudge fails', (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const leader = { id: 'hook-leader', name: '인도자' };
    const keys = { id: 'hook-keys', name: '건반' };
    const repo = new TeamRepository(':memory:');
    try {
        const team = repo.create('알림 격리 팀', leader);
        const { code } = repo.createInvite(team.id, leader.id);
        repo.join(code, keys);
        repo.assignRole(team.id, leader.id, keys.id, 'keyboard');
        const startsAt = new Date(Date.now() + 3 * 86400000);
        startsAt.setUTCMinutes(0, 0, 0);
        const event = repo.updatePlanning(team.id, leader.id, { type: 'event.save', input: { title: '주일 예배', kind: 'worship', startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 7200000).toISOString(), location: '본당', notes: '' } }).events[0];
        repo.updatePlanning(team.id, leader.id, { type: 'slot.save', eventId: event.id, role: 'keyboard', memberId: keys.id });

        const real = new TeamEvents(repo.database);
        const docs = new TeamDocs(repo.database, repo, real);
        // 알림 쪽 소식만 가로채서, planning.changed 는 잠금 충돌로 실패시킵니다.
        const events = fakeEvents((type) => type === 'planning.changed');
        const pushed: { recipients: string[]; title: string }[] = [];
        docs.afterSave = contiSaveHook(repo, docs, events, () => (recipients, notice) => { pushed.push({ recipients, title: notice.title }); });

        const enc = encodeURIComponent(team.id);
        docs.put(team.id, leader, `worship-together:library:v1:${enc}`, JSON.stringify({ version: 1, songs: [{ id: 'a', title: '곡 A' }], setlists: [{ id: 'set-1', title: '주일 예배 콘티', worship_date: event.startsAt, song_order: ['a'] }] }), 0);
        const detailsKey = `worship:setlist-details:v1:${enc}:${encodeURIComponent('set-1')}`;
        docs.put(team.id, leader, detailsKey, JSON.stringify({ status: 'confirmed', overrides: {} }), 0);

        assert.deepEqual(events.attempts.map((item) => item.type), ['planning.changed', 'planning.notice']);
        assert.deepEqual(events.published.map((item) => [item.type, item.audience]), [['planning.notice', [keys.id]]]);
        assert.deepEqual(pushed, [{ recipients: [keys.id], title: '콘티가 확정됐어요' }]);
        assert.equal(repo.planning(team.id, keys.id).notifications[0].title, '콘티가 확정됐어요');
        assert.equal(logged.mock.calls[0].arguments[0], '[notices] planning.changed');
    } finally { repo.close(); }
});
