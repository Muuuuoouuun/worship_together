import test from 'node:test';
import assert from 'node:assert/strict';
import { getOfflineCueLabel, getRealtimeStatusMeta } from '../lib/stageStatus.js';

test('offline wins over the same-browser-tab transport', () => {
    const meta = getRealtimeStatusMeta('offline', true);
    assert.equal(meta.label, '오프라인');
    assert.equal(getRealtimeStatusMeta('error', true).label, '오프라인');
});

test('connected shows the realtime pill regardless of local transport', () => {
    assert.equal(getRealtimeStatusMeta('connected', true).label, '실시간');
    assert.equal(getRealtimeStatusMeta('connected', false).label, '실시간');
});

test('reconnecting with a local tab transport keeps the browser tab pill; without it shows reconnecting', () => {
    assert.equal(getRealtimeStatusMeta('reconnecting', true).label, '브라우저 탭');
    assert.equal(getRealtimeStatusMeta('reconnecting', false).label, '재연결');
});

test('idle without local transport is waiting; offline cue captions are short', () => {
    assert.equal(getRealtimeStatusMeta('idle', false).label, '대기');
    assert.equal(getOfflineCueLabel('이 브라우저 탭에 전송 · 수신 미확인', 'offline'), '오프라인 · 수신 미확인');
    assert.equal(getOfflineCueLabel('이 브라우저 탭에 전송 · 수신 미확인', 'connected'), '이 브라우저 탭에 전송 · 수신 미확인');
});
