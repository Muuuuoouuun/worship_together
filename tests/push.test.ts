import { test } from 'node:test';
import assert from 'node:assert/strict';
import Sqlite from 'better-sqlite3';
import webpush from 'web-push';
import { PushStore, pushConfigFromEnv, type PushSendFn, type PushSubscriptionInput } from '../lib/server/push';

const config = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.com' };
const sub = (name: string): PushSubscriptionInput => ({ endpoint: `https://push.example.com/${name}`, keys: { p256dh: `key-${name}`, auth: `auth-${name}` } });

function store(send: PushSendFn | null = async () => ({}), withConfig = true) {
    const db = new Sqlite(':memory:');
    return { db, push: new PushStore(db, withConfig ? config : null, send) };
}

test('push goes only to the recipients’ devices whose app is closed, with the notice payload', async () => {
    const calls: { endpoint: string; payload: Record<string, string>; urgency: string }[] = [];
    const { push } = store(async (subscription, payload, options) => { calls.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), urgency: options.urgency }); return {}; });
    push.subscribe('keys', 'device-keys-phone', sub('keys-phone'));
    push.subscribe('keys', 'device-keys-laptop', sub('keys-laptop'));
    push.subscribe('vocal', 'device-vocal-phone', sub('vocal-phone'));
    // 노트북에서는 앱이 열려 있음 → 그 기기는 열린 앱이 알림을 띄움
    const release = push.deviceConnected('device-keys-laptop');
    const sent = await push.send(['keys'], { title: '결석 · 대체 인원이 필요해요', body: '주일 예배 · 건반', url: '/dashboard/planning?tab=schedule', tag: 'plan-1', urgent: true });
    assert.equal(sent, 1);
    assert.deepEqual(calls.map(call => call.endpoint), ['https://push.example.com/keys-phone']);
    assert.deepEqual(calls[0].payload, { title: '결석 · 대체 인원이 필요해요', body: '주일 예배 · 건반', url: '/dashboard/planning?tab=schedule', tag: 'plan-1' });
    assert.equal(calls[0].urgency, 'high');
    // 앱을 닫으면 그 기기에도 보냄
    release();
    calls.length = 0;
    await push.send(['keys'], { title: '공지', body: '내용', url: 'https://evil.example.com', tag: 'plan-2' });
    assert.deepEqual(calls.map(call => call.endpoint).sort(), ['https://push.example.com/keys-laptop', 'https://push.example.com/keys-phone']);
    assert.equal(calls[0].payload.url, '/dashboard', '사이트 밖 주소는 열지 않음');
});

test('a device moves to whoever logs in on it, gone subscriptions are removed, and nothing is sent without VAPID keys', async () => {
    const { push } = store(async (subscription) => {
        if (subscription.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
        return {};
    });
    push.subscribe('first', 'device-shared-1', sub('shared'));
    push.subscribe('second', 'device-shared-1', sub('shared'));
    assert.equal(push.subscriptionCount('first'), 0);
    assert.equal(push.subscriptionCount('second'), 1);
    push.subscribe('second', 'device-old-1234', sub('gone'));
    assert.equal(await push.send(['second'], { title: 't', body: 'b', url: '/', tag: 'x' }), 1);
    assert.equal(push.subscriptionCount('second'), 1, '410 구독은 지움');
    push.unsubscribe('second', sub('shared').endpoint);
    assert.equal(push.subscriptionCount('second'), 0);
    assert.throws(() => push.subscribe('x', 'device-x-12345', { endpoint: 'http://insecure.example.com', keys: { p256dh: 'a', auth: 'b' } }), /구독 정보/);

    let called = false;
    const off = store(async () => { called = true; return {}; }, false).push;
    off.subscribe('a', 'device-a-123456', sub('a'));
    assert.equal(await off.send(['a'], { title: 't', body: 'b', url: '/', tag: 'x' }), 0);
    assert.equal(called, false);
    assert.equal(off.publicKey, null);
    assert.equal(pushConfigFromEnv({}), null);
    assert.equal(pushConfigFromEnv({ VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'k', NEXTAUTH_URL: 'https://worship.example.com' })?.subject, 'https://worship.example.com');
});

test('a real VAPID-signed, encrypted push request is built for the subscription', async () => {
    // 실제 브라우저 키 모양으로 web-push 가 요청(암호화 · VAPID 서명)을 만드는지 — 보내지는 않습니다.
    const keys = webpush.generateVAPIDKeys();
    const { createECDH, randomBytes } = await import('node:crypto');
    const browser = createECDH('prime256v1');
    browser.generateKeys();
    const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: browser.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
    const request = webpush.generateRequestDetails(subscription, JSON.stringify({ title: '공지', body: '내용' }), { vapidDetails: { subject: 'mailto:test@example.com', publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 });
    assert.equal(request.method, 'POST');
    assert.match(String(request.headers.Authorization), /^vapid t=/);
    assert.ok(request.body && request.body.length > 0);
});
