import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLiveDetail } from '../components/live/model';
import type { LiveSessionDetail } from '../lib/server/liveRepository';

function detail(version: number, presence: string[]): LiveSessionDetail {
    return { state: { version }, presence: presence.map((name) => ({ name })), cues: [] } as unknown as LiveSessionDetail;
}

test('newer incoming detail replaces current', () => {
    const merged = mergeLiveDetail(detail(4, ['a']), detail(5, ['b']));
    assert.equal(merged.state.version, 5);
    assert.deepEqual(merged.presence, [{ name: 'b' }]);
});

test('older incoming keeps current state but updates presence', () => {
    const current = detail(5, ['a']);
    const merged = mergeLiveDetail(current, detail(4, ['b']));
    assert.equal(merged.state, current.state);
    assert.deepEqual(merged.presence, [{ name: 'b' }]);
});

test('equal version takes incoming', () => {
    const incoming = detail(5, ['b']);
    assert.equal(mergeLiveDetail(detail(5, ['a']), incoming), incoming);
});
