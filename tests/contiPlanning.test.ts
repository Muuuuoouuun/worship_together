import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanningCommand, planningForViewer } from '../lib/planning';
import { emptyPlanningState, type PlanningCommand, type PlanningState } from '../types/planning';
import type { TeamMember } from '../types/team';
import { actorFromBody, buildPlanningView, classifyNotice, groupOf, pickServices } from '../components/conti/planningBridge';
import type { ContiSetlist } from '../components/conti/model';

const members: TeamMember[] = [
    { userId: 'u-lead', name: '김찬양', role: 'leader', permission: 'owner' },
    { userId: 'u-keys', name: '정다윗', role: 'keyboard', permission: 'member' },
    { userId: 'u-guitar', name: '한믿음', role: 'guitar', permission: 'member' },
    { userId: 'u-guitar2', name: '최요셉', role: 'guitar', permission: 'member' },
    { userId: 'u-vocal', name: '이소망', role: 'vocal', permission: 'member' },
];

const TODAY = '2026-10-12';
const NOW = new Date('2026-10-12T03:00:00.000Z'); // 서울 12:00

function send(state: PlanningState, actor: string, command: PlanningCommand): PlanningState {
    return applyPlanningCommand(state, members, actor, command);
}

/** 주일 예배 1개(슬롯 4개), 목요 연습 1개, 질문 요청 1개가 있는 팀 */
function seed(): { state: PlanningState; eventId: string; slots: Record<string, string> } {
    let state = send(emptyPlanningState(), 'u-lead', {
        type: 'event.save',
        input: { title: '주일 2부 예배', kind: 'worship', startsAt: '2026-10-18T11:00:00+09:00', endsAt: '2026-10-18T12:10:00+09:00', location: '본당 3층', notes: '', setlistTitle: '신실하신 하나님', setlistId: 'set-1018' },
    });
    const eventId = state.events[0].id;
    for (const [role, memberId] of [['leader', 'u-lead'], ['keyboard', 'u-keys'], ['guitar', 'u-guitar'], ['vocal', null]] as const) {
        state = send(state, 'u-lead', { type: 'slot.save', eventId, role, memberId });
    }
    state = send(state, 'u-lead', {
        type: 'event.save',
        input: { title: '팀 연습', kind: 'rehearsal', startsAt: '2026-10-15T20:00:00+09:00', endsAt: '2026-10-15T22:00:00+09:00', location: '교육관', notes: '' },
    });
    state = send(state, 'u-keys', { type: 'request.create', setlistId: 'set-1018', setlistTitle: '신실하신 하나님', kind: 'question', body: '브릿지 몇 번 반복하나요?', leaderId: 'u-lead' });
    const event = state.events.find((item) => item.id === eventId)!;
    const slots = Object.fromEntries(event.slots.map((slot) => [slot.role, slot.id]));
    return { state, eventId, slots };
}

function view(state: PlanningState, userId: string, extra: Partial<Parameters<typeof buildPlanningView>[0]> = {}) {
    return buildPlanningView({ state: planningForViewer(state, members, userId), members, userId, today: TODAY, now: NOW, ...extra });
}

test('주일 예배의 배치를 역할 순서·상태·이름과 함께 보여준다', () => {
    const { state, eventId, slots } = seed();
    const result = view(state, 'u-keys');

    assert.equal(result.services.length, 1, '연습은 팀 배치 주일에 포함되지 않는다');
    const [service] = result.services;
    assert.equal(service.eventId, eventId);
    assert.equal(service.date, '2026-10-18');
    assert.equal(service.time, '11:00');
    assert.equal(service.setlistId, 'set-1018');
    assert.deepEqual(service.assignments.map((item) => [item.roleLabel, item.memberName, item.status, item.mine]), [
        ['인도자', '김찬양', 'pending', false],
        ['보컬', null, null, false],
        ['건반', '정다윗', 'pending', true],
        ['기타', '한믿음', 'pending', false],
    ]);
    assert.deepEqual(service.counts, { total: 4, confirmed: 0, pending: 3, declined: 0, vacant: 1 });
    assert.equal(service.assignments[2].slotId, slots.keyboard);

    assert.deepEqual(result.events.map((event) => [event.date, event.kind, event.expected, event.assigned]), [
        ['2026-10-15', 'rehearsal', 0, 0],
        ['2026-10-18', 'worship', 4, 3],
    ]);
    assert.equal(result.viewer?.canManage, false);
    assert.equal(view(state, 'u-lead').viewer?.canManage, true);
});

test('참석 확정·불참·대체 요청이 배치 상태와 요청 목록에 반영된다', () => {
    const { state: seeded, eventId, slots } = seed();
    let state = send(seeded, 'u-lead', { type: 'attendance.set', eventId, slotId: slots.leader, attendance: 'confirmed', reason: '' });
    state = send(state, 'u-guitar', { type: 'attendance.set', eventId, slotId: slots.guitar, attendance: 'absent', reason: '시험/학업' });

    const leaderView = view(state, 'u-lead');
    const [service] = leaderView.services;
    const guitar = service.assignments.find((item) => item.role === 'guitar')!;
    assert.equal(guitar.status, 'declined');
    assert.equal(guitar.note, '시험/학업');
    assert.equal(guitar.substituteOpen, true, '결석은 긴급 요청을 열어 대체를 찾는 상태가 된다');
    assert.deepEqual(service.counts, { total: 4, confirmed: 1, pending: 1, declined: 1, vacant: 1 });
    assert.deepEqual(service.assignments.map((item) => item.status), ['confirmed', null, 'pending', 'declined']);

    const absence = leaderView.requests.find((item) => item.source === 'alert')!;
    assert.equal(absence.kind, 'absence');
    assert.equal(absence.kindLabel, '결석');
    assert.equal(absence.author, '한믿음');
    assert.equal(absence.context, '10/18 주일 2부 예배');
    assert.equal(absence.canResolve, true, '관리자는 긴급 요청을 마감할 수 있다');
    assert.equal(absence.canVolunteer, false, '인도자도 같은 일정에 배치되어 있으면 지원할 수 없다');

    const otherGuitar = view(state, 'u-guitar2').requests.find((item) => item.source === 'alert')!;
    assert.equal(otherGuitar.canResolve, false);
    assert.equal(otherGuitar.canVolunteer, true);
    assert.equal(otherGuitar.volunteered, false);
    assert.equal(view(state, 'u-guitar2').services[0].assignments.find((item) => item.role === 'guitar')!.canVolunteer, true, '같은 일정에 배치되지 않은 팀원은 지원할 수 있다');
    assert.equal(view(state, 'u-keys').services[0].assignments.find((item) => item.role === 'guitar')!.canVolunteer, false, '같은 일정에 이미 배치된 팀원은 지원할 수 없다 (겹치는 일정 규칙)');
    assert.equal(view(state, 'u-keys').requests.find((item) => item.source === 'alert')!.canVolunteer, false);
    assert.equal(view(state, 'u-guitar2').services[0].assignments.find((item) => item.role === 'vocal')!.canVolunteer, true, '빈자리에도 지원할 수 있다');

    state = send(state, 'u-guitar2', { type: 'slot.volunteer', eventId, slotId: slots.guitar });
    const after = view(state, 'u-lead');
    assert.deepEqual(after.services[0].assignments.find((item) => item.role === 'guitar')!.volunteers, [{ id: 'u-guitar2', name: '최요셉', member: true }]);
    assert.equal(view(state, 'u-guitar2').requests.find((item) => item.source === 'alert')!.volunteered, true);
    assert.equal(after.services[0].assignments.find((item) => item.role === 'guitar')!.volunteers.length, 1);
    assert.equal(view(state, 'u-guitar2').services[0].assignments.find((item) => item.role === 'guitar')!.volunteered, true);
    assert.equal(leaderView.openRequestCount, 2, '질문 1 + 결석 1');
});

test('요청은 보는 사람에 따라 답변·처리 권한이 달라지고 답변이 이어진다', () => {
    const { state: seeded } = seed();
    const requestId = seeded.requests[0].id;
    const state = send(seeded, 'u-lead', { type: 'request.reply', requestId, body: '2회예요. 두 번째는 빌드업!' });

    const authorView = view(state, 'u-keys');
    const mine = authorView.requests.find((item) => item.id === requestId)!;
    assert.equal(mine.kindLabel, '질문');
    assert.equal(mine.title, '브릿지 몇 번 반복하나요?');
    assert.equal(mine.author, '정다윗');
    assert.equal(mine.mine, true);
    assert.equal(mine.canReply, true);
    assert.equal(mine.canResolve, false, '작성자는 처리 상태를 바꿀 수 없다');
    assert.deepEqual(mine.replies.map((reply) => [reply.author, reply.text, reply.mine]), [['김찬양', '2회예요. 두 번째는 빌드업!', false]]);

    const leader = view(state, 'u-lead').requests.find((item) => item.id === requestId)!;
    assert.equal(leader.canResolve, true);
    assert.equal(leader.done, false);

    assert.equal(view(state, 'u-vocal').requests.some((item) => item.id === requestId), false, '관련 없는 팀원에게는 보이지 않는다');

    const resolved = send(state, 'u-lead', { type: 'request.status', requestId, status: 'resolved' });
    assert.equal(view(resolved, 'u-keys').requests.find((item) => item.id === requestId)!.done, true);
});

test('알림을 종류·행위자·새 소식 여부로 분류하고 콘티 코멘트를 함께 보여준다', () => {
    const { state: seeded, eventId, slots } = seed();
    let state = send(seeded, 'u-lead', { type: 'slot.sendInvite', eventId, slotId: slots.keyboard });
    state = send(state, 'u-guitar', { type: 'attendance.set', eventId, slotId: slots.guitar, attendance: 'absent', reason: '시험/학업' });

    const keysView = view(state, 'u-keys');
    const invite = keysView.notices.find((item) => item.kind === 'invite')!;
    assert.equal(invite.title, '사역 초대 알림');
    assert.equal(invite.urgent, true);
    assert.equal(invite.unread, true);
    assert.equal(invite.category, 'team');
    assert.equal(invite.group, '오늘');
    assert.ok(!invite.message.includes('\n'), '여러 줄 본문은 한 줄로 합친다');

    const decline = keysView.notices.find((item) => item.kind === 'decline')!;
    assert.equal(decline.actor, '한믿음');
    assert.equal(decline.quote, '시험/학업');

    const leaderView = view(state, 'u-lead');
    const request = leaderView.notices.find((item) => item.kind === 'request')!;
    assert.equal(request.category, 'request');
    assert.equal(request.quote, '브릿지 몇 번 반복하나요?');
    assert.equal(request.actor, null, '요청 알림 본문에는 이름이 없다');

    const read = send(state, 'u-keys', { type: 'notification.read', notificationId: state.notifications.find((item) => item.title === '사역 초대 알림')!.id });
    assert.equal(view(read, 'u-keys').notices.find((item) => item.kind === 'invite')!.unread, false);

    const setlists: ContiSetlist[] = [{
        id: 'set-1018', date: '2026-10-18', time: '11:00', service: '주일 2부 예배', theme: '신실하신 하나님', owner: '김찬양', status: 'confirmed',
        items: [{
            kind: 'song', id: 'x', songId: 's1', title: '믿음으로 서리라', artist: null, originalKey: 'D', key: 'E', bpm: 72, lead: null, form: [], links: [], notes: [],
            comments: [
                { id: 'c1', author: '박은혜', text: '화음 들어갈게요', ago: '', createdAt: '2026-10-12T01:00:00.000Z' },
                { id: 'c2', author: '정다윗', text: '내 코멘트', ago: '', createdAt: '2026-10-12T02:00:00.000Z' },
                { id: 'c3', author: '최요셉', text: '지난주 코멘트', ago: '', createdAt: '2026-10-05T02:00:00.000Z' },
            ],
        }],
    }];
    const withComments = view(state, 'u-keys', { setlists, feedSeenAt: '2026-10-10T00:00:00.000Z' });
    const comments = withComments.notices.filter((item) => item.kind === 'comment');
    assert.deepEqual(comments.map((item) => [item.actor, item.quote, item.unread, item.group]), [
        ['박은혜', '화음 들어갈게요', true, '오늘'],
        ['최요셉', '지난주 코멘트', false, '이전'],
    ], '내 코멘트는 빼고, 읽은 시각 이전 코멘트는 새 소식이 아니다');
    assert.equal(comments[0].entityId, 'set-1018');
    assert.equal(withComments.notices[0].createdAt >= withComments.notices[1].createdAt, true, '최신순');
});

test('알림 제목 분류와 본문 행위자 추출', () => {
    assert.equal(classifyNotice({ title: '콘티 요청에 답변이 왔어요', target: 'requests' }), 'reply');
    assert.equal(classifyNotice({ title: '콘티 진행 확인 요청', target: 'requests' }), 'request');
    assert.equal(classifyNotice({ title: '콘티 요청 상태 변경', target: 'requests' }), 'request');
    assert.equal(classifyNotice({ title: '섬김 참석 여부를 확정해주세요', target: 'schedule' }), 'invite');
    assert.equal(classifyNotice({ title: '참석 일괄 확정', target: 'schedule' }), 'accept');
    assert.equal(classifyNotice({ title: '결석 · 대체 인원이 필요해요', target: 'schedule' }), 'decline');
    assert.equal(classifyNotice({ title: '대체 지원자가 있어요', target: 'schedule' }), 'volunteer');
    assert.equal(classifyNotice({ title: '대체 인원 후보가 있어요', target: 'schedule' }), 'substitute');
    assert.equal(classifyNotice({ title: '콘티가 등록·변경되었어요', target: 'schedule' }), 'conti');
    assert.equal(classifyNotice({ title: '로테이션 배정이 적용되었어요', target: 'schedule' }), 'rotation');
    assert.equal(classifyNotice({ title: '새 연습·예배 일정', target: 'schedule' }), 'schedule');
    assert.equal(actorFromBody('주일 2부 예배 · 김찬양', ['김찬양', '정다윗']), '김찬양');
    assert.equal(actorFromBody('주일 2부 예배 · 기타 · 추천: 김찬양, 정다윗', ['김찬양', '정다윗']), null);
    assert.equal(groupOf('2026-10-11T15:30:00.000Z', TODAY), '오늘', '서울 기준 날짜로 묶는다');
    assert.equal(groupOf('2026-10-10T15:30:00.000Z', TODAY), '어제');
    assert.equal(groupOf('2026-10-03T00:00:00.000Z', TODAY), '이전');
});

test('팀 배치 주일은 지난 1개와 다가오는 3개를 고른다', () => {
    const make = (date: string) => ({ eventId: date, date, time: '11:00', endTime: '12:00', title: '', place: '', setlistId: null, setlistTitle: null, assignments: [], counts: { total: 0, confirmed: 0, pending: 0, declined: 0, vacant: 0 } });
    const services = ['2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'].map(make);
    assert.deepEqual(pickServices(services, TODAY).map((item) => item.date), ['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01']);
    assert.deepEqual(pickServices(services, '2026-12-01').map((item) => item.date), ['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'], '다가오는 주일이 없으면 최근 것들');
    assert.deepEqual(pickServices(services.slice(0, 2), TODAY).map((item) => item.date), ['2026-09-27', '2026-10-04']);
});
