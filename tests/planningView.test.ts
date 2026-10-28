import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUTY_STATE_LABEL, pickNextDuty, summarizeMyDuties, type DutyAttendance } from '../lib/planningView';

const duty = (id: string, attendance: DutyAttendance) => ({ id, slot: { attendance } });

test('pickNextDuty: 확정된 사역을 응답 대기보다 먼저 고른다', () => {
    const items = [duty('a', 'pending'), duty('b', 'confirmed'), duty('c', 'confirmed')];
    assert.equal(pickNextDuty(items)?.id, 'b');
});

test('pickNextDuty: 확정이 없으면 가장 이른 응답 대기를 고른다', () => {
    const items = [duty('a', 'absent'), duty('b', 'pending'), duty('c', 'pending')];
    assert.equal(pickNextDuty(items)?.id, 'b');
});

test('pickNextDuty: 불참은 절대 고르지 않는다', () => {
    assert.equal(pickNextDuty([duty('a', 'absent')]), undefined);
    assert.equal(pickNextDuty([duty('a', 'absent'), duty('b', 'absent')]), undefined);
    assert.equal(pickNextDuty([duty('a', 'absent'), duty('b', 'confirmed')])?.id, 'b');
    assert.equal(pickNextDuty([]), undefined);
});

test('summarizeMyDuties: 불참만 있으면 "모두 확정됨"이 아니라 불참 응답으로 표시한다', () => {
    const one = summarizeMyDuties([duty('a', 'absent')]);
    assert.deepEqual({ ...one }, { total: 1, confirmed: 0, pending: 0, absent: 1, label: '불참 응답함', tone: 'absent' });
    assert.equal(summarizeMyDuties([duty('a', 'absent'), duty('b', 'absent')]).label, '불참 응답함 2건');
});

test('summarizeMyDuties: 상태별 개수와 머리글 문구', () => {
    assert.equal(summarizeMyDuties([]).label, null);
    assert.equal(summarizeMyDuties([duty('a', 'confirmed'), duty('b', 'confirmed')]).label, '모두 확정됨');
    assert.equal(summarizeMyDuties([duty('a', 'confirmed'), duty('b', 'absent')]).label, '확정 1건 · 불참 1건');
    const mixed = summarizeMyDuties([duty('a', 'pending'), duty('b', 'confirmed'), duty('c', 'absent')]);
    assert.equal(mixed.label, '응답 필요 1건');
    assert.deepEqual([mixed.confirmed, mixed.pending, mixed.absent, mixed.total], [1, 1, 1, 3]);
});

test('DUTY_STATE_LABEL: 실제 참석 상태 문구', () => {
    assert.deepEqual(DUTY_STATE_LABEL, { confirmed: '확정됨', pending: '응답 대기', absent: '불참' });
});
