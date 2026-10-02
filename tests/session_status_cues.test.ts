import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_SESSION_FEEDBACK_PRESET_DEFS,
    inferSessionFeedbackPresetGroup,
    getCueCategory,
    getDefaultSessionFeedbackTarget,
    getCueDeliveryLabel,
    SESSION_FEEDBACK_PRESET_GROUPS,
    type SessionCueDelivery,
} from '../types/session.js';

test('SESSION_FEEDBACK_PRESET_GROUPS contains sound and tempo', () => {
    assert.ok(SESSION_FEEDBACK_PRESET_GROUPS.includes('tempo'));
    assert.ok(SESSION_FEEDBACK_PRESET_GROUPS.includes('sound'));
    assert.ok(SESSION_FEEDBACK_PRESET_GROUPS.includes('flow'));
    assert.ok(SESSION_FEEDBACK_PRESET_GROUPS.includes('band'));
    assert.ok(SESSION_FEEDBACK_PRESET_GROUPS.includes('media'));
});

test('DEFAULT_SESSION_FEEDBACK_PRESET_DEFS contains requested stage cues', () => {
    const labels = DEFAULT_SESSION_FEEDBACK_PRESET_DEFS.map((p) => p.label);

    // Tempo cues
    assert.ok(labels.includes('느려요'), 'Should include 느려요');
    assert.ok(labels.includes('빨라요'), 'Should include 빨라요');
    assert.ok(labels.includes('드럼 박자'), 'Should include 드럼 박자');
    assert.ok(labels.includes('박자 밀림'), 'Should include 박자 밀림');

    // Sound cues
    assert.ok(labels.includes('볼륨 업'), 'Should include 볼륨 업');
    assert.ok(labels.includes('볼륨 다운'), 'Should include 볼륨 다운');
    assert.ok(labels.includes('보컬 UP'), 'Should include 보컬 UP');
    assert.ok(labels.includes('모니터 체크'), 'Should include 모니터 체크');

    // Flow & band & system cues
    assert.ok(labels.includes('다음 섹션'), 'Should include 다음 섹션');
    assert.ok(labels.includes('한 번 더'), 'Should include 한 번 더');
    assert.ok(labels.includes('기도 BGM'), 'Should include 기도 BGM');
    assert.ok(labels.includes('엔딩 컷'), 'Should include 엔딩 컷');
    assert.ok(labels.includes('통신 점검'), 'Should include 통신 점검');

    // Validate groups
    const tempoPresets = DEFAULT_SESSION_FEEDBACK_PRESET_DEFS.filter((p) => p.group === 'tempo');
    assert.ok(tempoPresets.length >= 4);

    const soundPresets = DEFAULT_SESSION_FEEDBACK_PRESET_DEFS.filter((p) => p.group === 'sound');
    assert.ok(soundPresets.length >= 4);
});

test('inferSessionFeedbackPresetGroup accurately classifies keywords', () => {
    // Tempo
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '템포가 빨라요'), 'tempo');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '느려요', '조금 느려요 템포 올려주세요'), 'tempo');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '드럼 박자', '드럼 카운트 부탁'), 'tempo');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '박자가 안 맞아요'), 'tempo');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', 'BPM 빠르게'), 'tempo');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '비트 싱크 맞춰주세요'), 'tempo');

    // Sound
    assert.equal(inferSessionFeedbackPresetGroup('leader', '볼륨 업', '볼륨 업 해주세요'), 'sound');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '볼륨 다운', '소리 좀 줄여주세요'), 'sound');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '마이크 소리가 작아요'), 'sound');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '모니터 체크', '인이어 모니터 소리 올려주세요'), 'sound');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '보컬 UP', '보컬 소리 올려주세요'), 'sound');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '음향실 하울링 잡혔나요'), 'sound');

    // Flow
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '다음 섹션으로 이동'), 'flow');
    assert.equal(inferSessionFeedbackPresetGroup('leader', '', '후렴으로 바로 갈게요'), 'flow');

    // Band
    assert.equal(inferSessionFeedbackPresetGroup('instrument', '반주 유지', '코드 반주를 잔잔하게 유지해주세요'), 'band');
    assert.equal(inferSessionFeedbackPresetGroup('instrument', '', '건반 솔로'), 'band');

    // Media
    assert.equal(inferSessionFeedbackPresetGroup('broadcast', '', '가사 넘겨주세요'), 'media');
    assert.equal(inferSessionFeedbackPresetGroup('broadcast', '', '자막 준비'), 'media');
    assert.equal(inferSessionFeedbackPresetGroup('broadcast', '', '통신 점검 핑 테스트'), 'media');
});

test('getCueCategory accurately differentiates alert accents and groups', () => {
    assert.equal(getCueCategory('빨라요 조금 당겨주세요', 'tempo'), 'tempo');
    assert.equal(getCueCategory('너무 빨라요'), 'tempo');
    assert.equal(getCueCategory('볼륨 업', 'sound'), 'sound');
    assert.equal(getCueCategory('인이어 모니터 소리 올려줘'), 'sound');
    assert.equal(getCueCategory('통신 점검 신호', 'media'), 'system');
    assert.equal(getCueCategory('네트워크 핑 확인'), 'system');
    assert.equal(getCueCategory('한 번 더 반복', 'flow'), 'flow');
    assert.equal(getCueCategory('반주 유지', 'band'), 'band');
});

test('getDefaultSessionFeedbackTarget provides intuitive audience labels', () => {
    assert.equal(getDefaultSessionFeedbackTarget('leader', 'flow'), '전체');
    assert.equal(getDefaultSessionFeedbackTarget('broadcast', 'flow'), '팀');
    assert.equal(getDefaultSessionFeedbackTarget('instrument', 'tempo'), '리듬');
    assert.equal(getDefaultSessionFeedbackTarget('instrument', 'sound'), '음향');
    assert.equal(getDefaultSessionFeedbackTarget('instrument', 'band'), '악기');
    assert.equal(getDefaultSessionFeedbackTarget('broadcast', 'media'), '미디어');
});

test('getCueDeliveryLabel formats realtime ACK states clearly', () => {
    assert.equal(getCueDeliveryLabel(undefined), '전달 상태 없음');

    const sendingDelivery: SessionCueDelivery = {
        status: 'sending',
        receivedBy: [],
        transport: 'remote',
        saved: false,
    };
    assert.equal(getCueDeliveryLabel(sendingDelivery), '전송 중…');

    const deliveredZeroDelivery: SessionCueDelivery = {
        status: 'sent',
        receivedBy: [],
        transport: 'remote',
        saved: true,
    };
    assert.equal(getCueDeliveryLabel(deliveredZeroDelivery), '서버 전송 · 수신 미확인');

    const acknowledgedDelivery: SessionCueDelivery = {
        status: 'sent',
        receivedBy: ['client_1', 'client_2', 'client_3'],
        transport: 'remote',
        saved: true,
    };
    assert.equal(getCueDeliveryLabel(acknowledgedDelivery), '3개 기기 수신 · 확인됨');

    const failedDelivery: SessionCueDelivery = {
        status: 'failed',
        receivedBy: [],
        transport: 'remote',
        saved: false,
        error: '네트워크 연결 실패',
    };
    assert.equal(getCueDeliveryLabel(failedDelivery), '네트워크 연결 실패');
});
