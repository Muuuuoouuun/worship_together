import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanningCommand, planningForViewer } from '../lib/planning';
import { ANONYMOUS_AUTHOR, DEFAULT_DEADLINE_SETTINGS, afterQuietHours, deadlineAt, deadlineDay, deadlineStage, deadlineTargets, dueDeadlineNotices, nudgeTitle, type DeadlineSources } from '../lib/contiDeadline';
import { contiNotices, CONTI_DRAFT_TITLE } from '../lib/contiNotices';
import { emptyPlanningState, type PlanningCommand, type PlanningState } from '../types/planning';
import type { TeamMember } from '../types/team';

const members: TeamMember[] = [
    { userId: 'u-admin', name: '관리자', role: 'member', permission: 'owner' },
    { userId: 'u-lead', name: '박은혜', role: 'leader', permission: 'member' },
    { userId: 'u-keys', name: '정다윗', role: 'keyboard', permission: 'member' },
    { userId: 'u-bass', name: '윤사랑', role: 'bass', permission: 'member' },
    { userId: 'u-sound', name: '서하늘', role: 'sound', permission: 'member' },
];
const at = (iso: string) => new Date(iso);
const send = (state: PlanningState, actor: string, command: PlanningCommand, now = at('2026-10-26T12:00:00+09:00')) => applyPlanningCommand(state, members, actor, command, undefined, now);

/** 11/1(일) 11:00 주일 예배: 인도 박은혜, 건반 정다윗, 베이스 윤사랑, 음향 서하늘 */
function seed(): { state: PlanningState; eventId: string } {
    let state = send(emptyPlanningState(), 'u-admin', { type: 'event.save', input: { title: '주일 2부 예배', kind: 'worship', startsAt: '2026-11-01T11:00:00+09:00', endsAt: '2026-11-01T12:10:00+09:00', location: '본당', notes: '' } });
    const eventId = state.events[0].id;
    for (const [role, memberId] of [['leader', 'u-lead'], ['keyboard', 'u-keys'], ['bass', 'u-bass'], ['sound', 'u-sound']] as const) {
        state = send(state, 'u-admin', { type: 'slot.save', eventId, role, memberId });
    }
    return { state, eventId };
}
const sources = (state: PlanningState, extra: Partial<DeadlineSources> = {}): DeadlineSources => ({ events: state.events, setlists: [], detailsOf: () => null, members, state, ...extra });
const nudge = (eventId: string, overrides: Partial<Extract<PlanningCommand, { type: 'conti.nudge' }>> = {}): PlanningCommand => ({
    type: 'conti.nudge', deadlineKey: `event:${eventId}`, title: '주일 2부 예배', serviceAt: '2026-11-01T11:00:00+09:00', setlistId: '', eventId, leaderId: 'u-lead', message: '미리 연습하고 싶어요', anonymous: false, ...overrides,
});

test('마감은 예배일 이전의 가장 가까운 화요일 23:59 (한국 시간)', () => {
    const tuesday = DEFAULT_DEADLINE_SETTINGS.rule;
    assert.equal(deadlineDay('2026-11-01', tuesday), '2026-10-27'); // 주일 → 화
    assert.equal(deadlineDay('2026-10-28', tuesday), '2026-10-27'); // 수요예배 → 전날 화
    assert.equal(deadlineDay('2026-10-27', tuesday), '2026-10-20'); // 화요일 예배 → 1주 전 화
    assert.equal(deadlineDay('2026-10-26', tuesday), '2026-10-20'); // 월요일 예배 → 6일 전 화
    assert.equal(deadlineDay('2026-11-01', { kind: 'daysBefore', days: 3, time: '22:00' }), '2026-10-29');
    assert.equal(deadlineAt('2026-11-01T11:00:00+09:00', tuesday), '2026-10-27T14:59:00.000Z');
    // UTC 로 저장된 예배 시각도 한국 날짜로 계산
    assert.equal(deadlineAt('2026-11-01T02:00:00.000Z', tuesday), '2026-10-27T14:59:00.000Z');
});

test('밤 23:00–07:00 은 아침 7시로 미룹니다', () => {
    assert.equal(new Date(afterQuietHours(Date.parse('2026-10-27T23:59:00+09:00'))).toISOString(), '2026-10-27T22:00:00.000Z');
    assert.equal(new Date(afterQuietHours(Date.parse('2026-10-28T03:00:00+09:00'))).toISOString(), '2026-10-27T22:00:00.000Z');
    const noon = Date.parse('2026-10-28T12:00:00+09:00');
    assert.equal(afterQuietHours(noon), noon);
});

test('마감 대상: 예배 일정 + 연결된 콘티, 콘티 담당은 같은 이름의 팀원', () => {
    const { state, eventId } = seed();
    const setlists = [{ id: 's1101', title: '주님 오실 때까지', worship_date: '2026-11-01T11:00:00+09:00', song_order: ['a', 'b'] }, { id: 's1108', title: '감사', worship_date: '2026-11-08T11:00:00+09:00' }];
    const targets = deadlineTargets(sources(state, { setlists, detailsOf: (id) => (id === 's1101' ? { status: 'draft', owner: '정다윗' } : null) }));
    assert.equal(targets.length, 2);
    const [service, loose] = targets;
    assert.equal(service.key, `event:${eventId}`);
    assert.equal(service.setlistId, 's1101');
    assert.equal(service.status, 'draft');
    assert.equal(service.leaderId, 'u-keys'); // 콘티 담당이 예배 인도 자리보다 먼저
    assert.deepEqual([...service.assignedIds].sort(), ['u-bass', 'u-keys', 'u-lead', 'u-sound']);
    assert.equal(service.deadlineAt, '2026-10-27T14:59:00.000Z');
    assert.equal(loose.key, 'setlist:s1108');
    assert.equal(loose.leaderId, null);

    const noSetlist = deadlineTargets(sources(state))[0];
    assert.equal(noSetlist.status, 'none');
    assert.equal(noSetlist.leaderId, 'u-lead'); // 콘티가 없으면 인도 자리
    assert.equal(deadlineStage(noSetlist, Date.parse('2026-10-27T21:00:00+09:00')), 'soon');
    assert.equal(deadlineStage(noSetlist, Date.parse('2026-10-28T09:00:00+09:00')), 'overdue');
    assert.equal(deadlineStage({ ...noSetlist, status: 'confirmed' }, Date.parse('2026-10-28T09:00:00+09:00')), 'met');
});

test('예약 알림: 하루 전 · 3시간 전 · 마감 지남(아침에) · 관리자, 보낸 건 다시 안 보냄', () => {
    const { state } = seed();
    const due = (iso: string, log: string[] = []) => dueDeadlineNotices({
        ...sources({ ...state, deadline: { log: log.map((id) => ({ id, at: iso })) } }),
        state: { ...state, deadline: { log: log.map((id) => ({ id, at: iso })) } },
        now: Date.parse(iso), managerIds: ['u-admin', 'u-lead'], leaderIds: ['u-admin', 'u-lead'],
    });
    assert.deepEqual(due('2026-10-26T20:00:00+09:00'), []);
    const dayBefore = due('2026-10-26T21:00:00+09:00');
    assert.equal(dayBefore.length, 1);
    assert.equal(dayBefore[0].title, '콘티 마감 하루 전이에요');
    assert.deepEqual(dayBefore[0].recipientIds, ['u-lead']);
    assert.deepEqual(due('2026-10-26T21:00:00+09:00', [dayBefore[0].logId]), []);

    assert.equal(due('2026-10-27T21:00:00+09:00', [dayBefore[0].logId])[0].title, '콘티 마감 3시간 전이에요');
    // 마감 23:59 는 밤이라 아침 7시에
    const quiet = due('2026-10-27T23:59:30+09:00').filter((item) => item.logId.includes('overdue'));
    assert.deepEqual(quiet, []);
    const morning = due('2026-10-28T07:00:00+09:00');
    const overdue = morning.find((item) => item.logId.includes('|overdue|'))!;
    assert.equal(overdue.urgent, true);
    assert.deepEqual(overdue.recipientIds, ['u-lead']);
    const team = morning.find((item) => item.logId.includes('|overdueTeam|'))!;
    assert.equal(team.title, '아직 콘티가 올라오지 않았어요');
    assert.deepEqual([...team.recipientIds].sort(), ['u-bass', 'u-keys', 'u-sound']);
    // 늦게 켠 하루 전 알림은 3시간 전 단계가 지나면 보내지 않음
    assert.ok(!morning.some((item) => item.logId.includes('dayBefore')));

    const escalate = due('2026-10-28T12:00:00+09:00').find((item) => item.logId.includes('escalate'))!;
    assert.deepEqual(escalate.recipientIds, ['u-admin']);
    assert.match(escalate.title, /12시간/);
});

test('확정됐거나 인도자가 예정 시간을 알려 둔 동안은 마감 알림을 멈춥니다', () => {
    const { state, eventId } = seed();
    const setlists = [{ id: 's1101', title: '주님 오실 때까지', worship_date: '2026-11-01T11:00:00+09:00' }];
    const base = { managerIds: ['u-admin'], leaderIds: ['u-lead'], now: Date.parse('2026-10-28T07:00:00+09:00') };
    assert.deepEqual(dueDeadlineNotices({ ...sources(state, { setlists, detailsOf: () => ({ status: 'confirmed' }) }), state, ...base }), []);
    const paused = { ...state, deadline: { etas: [{ key: `event:${eventId}`, until: '2026-10-28T23:59:00+09:00', label: '오늘 밤 안에', by: 'u-lead', at: '2026-10-28T06:00:00+09:00' }] } };
    assert.deepEqual(dueDeadlineNotices({ ...sources(paused), state: paused, ...base }), []);
});

test('콘티 요청: 인도자에게 묶어서, 3시간에 한 번, 이름 숨김은 아무에게도 안 보임', () => {
    const { state: seeded, eventId } = seed();
    let state = send(seeded, 'u-bass', nudge(eventId, { message: '곡 제목만 먼저 알려주셔도 좋아요' }), at('2026-10-27T18:20:00+09:00'));
    const first = state.notifications[0];
    assert.equal(first.title, '윤사랑님이 콘티를 요청했어요');
    assert.deepEqual(first.recipientIds, ['u-lead']);
    assert.equal(first.target, 'schedule');

    state = send(state, 'u-keys', nudge(eventId, { anonymous: true }), at('2026-10-27T19:00:00+09:00'));
    state = send(state, 'u-sound', nudge(eventId), at('2026-10-27T19:30:00+09:00'));
    const nudgeNotices = state.notifications.filter((item) => item.groupKey === `nudge:event:${eventId}`);
    assert.equal(nudgeNotices.length, 1, '인도자 알림은 하나로 묶임');
    assert.equal(nudgeNotices[0].title, '서하늘님 외 2명이 콘티를 요청했어요');

    assert.throws(() => send(state, 'u-bass', nudge(eventId), at('2026-10-27T20:00:00+09:00')), /다시 요청할 수 있어요/);
    assert.doesNotThrow(() => send(state, 'u-bass', nudge(eventId), at('2026-10-27T21:21:00+09:00')));

    const leaderView = planningForViewer(state, members, 'u-lead');
    const anonymous = leaderView.requests.find((item) => item.anonymous)!;
    assert.equal(anonymous.authorId, ANONYMOUS_AUTHOR);
    assert.equal(anonymous.body, '미리 연습하고 싶어요');
    const adminView = planningForViewer(state, members, 'u-admin');
    assert.equal(adminView.requests.find((item) => item.anonymous)!.authorId, ANONYMOUS_AUTHOR);
    const selfView = planningForViewer(state, members, 'u-keys');
    assert.equal(selfView.requests.find((item) => item.anonymous)!.authorId, 'u-keys');
    // 다른 팀원은 몇 명이 기다리는지만 (내용은 비움)
    const otherView = planningForViewer(state, members, 'u-sound');
    assert.equal(otherView.requests.filter((item) => item.deadlineKey).length, 3);
    assert.equal(otherView.requests.find((item) => item.authorId === 'u-bass')!.body, '');
    assert.equal(nudgeTitle(state.requests.filter((item) => item.anonymous), members), '팀원 1명이 콘티를 요청했어요');
});

test('예정 시간: 요청한 사람에게 알리고, 그 시간까지 요청을 막음 · 밤에는 아침에 보냄', () => {
    const { state: seeded, eventId } = seed();
    let state = send(seeded, 'u-bass', nudge(eventId), at('2026-10-28T08:00:00+09:00'));
    assert.throws(() => send(state, 'u-bass', { type: 'conti.eta', deadlineKey: `event:${eventId}`, title: '주일 2부 예배', setlistId: '', eventId, until: '2026-10-28T23:59:00+09:00', label: '오늘 밤 안에 올릴게요' }, at('2026-10-28T09:00:00+09:00')), /인도자 또는 관리자/);
    state = send(state, 'u-lead', { type: 'conti.eta', deadlineKey: `event:${eventId}`, title: '주일 2부 예배', setlistId: '', eventId, until: '2026-10-28T23:59:00+09:00', label: '오늘 밤 안에 올릴게요' }, at('2026-10-28T09:00:00+09:00'));
    const notice = state.notifications[0];
    assert.equal(notice.title, '박은혜님이 예정 시간을 알려줬어요');
    assert.deepEqual(notice.recipientIds, ['u-bass']);
    assert.equal(state.requests[0].status, 'reviewing');
    assert.match(state.requests[0].replies[0].body, /오늘 밤 안에/);
    assert.throws(() => send(state, 'u-keys', nudge(eventId), at('2026-10-28T12:00:00+09:00')), /예정 시간/);

    const night = send(seeded, 'u-keys', nudge(eventId), at('2026-10-28T23:30:00+09:00'));
    assert.equal(night.notifications[0].deliverAt, '2026-10-28T22:00:00.000Z');
});

test('마감 설정은 관리자만, 마감 전 요청을 끄면 마감 뒤에만 요청', () => {
    const { state: seeded, eventId } = seed();
    const settings = { ...DEFAULT_DEADLINE_SETTINGS, nudgeBeforeDeadline: false, allowAnonymous: false };
    assert.throws(() => send(seeded, 'u-lead', { type: 'deadline.settings', settings }), /팀 관리자/);
    const state = send(seeded, 'u-admin', { type: 'deadline.settings', settings });
    assert.throws(() => send(state, 'u-bass', nudge(eventId), at('2026-10-27T12:00:00+09:00')), /마감\(.*\) 후에/);
    assert.throws(() => send(state, 'u-bass', nudge(eventId, { anonymous: true }), at('2026-10-28T12:00:00+09:00')), /이름을 숨긴/);
    assert.doesNotThrow(() => send(state, 'u-bass', nudge(eventId), at('2026-10-28T12:00:00+09:00')));
    // 일정별 마감 변경
    const moved = send(state, 'u-lead', { type: 'deadline.override', deadlineKey: `event:${eventId}`, at: '2026-10-29T22:00:00+09:00' });
    assert.equal(deadlineTargets(sources(moved))[0].deadlineAt, '2026-10-29T22:00:00+09:00');
});

test('초안 공유는 배치된 팀원에게 알림, 확정에서 되돌린 초안은 알리지 않음', () => {
    const { state } = seed();
    const library = JSON.stringify({ songs: [], setlists: [{ id: 's1101', title: '주님 오실 때까지', worship_date: '2026-11-01T11:00:00+09:00', song_order: ['a', 'b', 'c'] }] });
    const input = { kind: 'setlist-details' as const, setlistId: 's1101', library, detailsOf: () => null, planning: state, members, editor: { id: 'u-lead', name: '박은혜' } };
    const shared = contiNotices({ ...input, before: JSON.stringify({ status: 'writing' }), after: JSON.stringify({ status: 'draft' }) });
    assert.equal(shared.length, 1);
    assert.equal(shared[0].title, CONTI_DRAFT_TITLE);
    assert.match(shared[0].body, /3곡 · 확정 전 초안/);
    assert.deepEqual([...shared[0].recipientIds].sort(), ['u-bass', 'u-keys', 'u-sound']);
    assert.deepEqual(contiNotices({ ...input, before: JSON.stringify({ status: 'confirmed' }), after: JSON.stringify({ status: 'draft' }) }), []);
});
