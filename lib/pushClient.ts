/*
 * 앱을 닫아도 오는 알림 (브라우저 쪽).
 * 알림을 허락한 기기는 서비스 워커로 푸시를 구독하고 서버(/api/push)에 이 기기를 지금 로그인한 사람으로 알립니다.
 * 서버에 VAPID 키가 없거나 브라우저가 푸시를 못 쓰면(아이폰은 홈 화면에 추가한 앱에서만) 'unavailable' —
 * 그때도 앱이 열려 있는 동안의 기기 알림(lib/deviceNotify)은 그대로 됩니다.
 */

export type PushState = 'subscribed' | 'unavailable' | 'not-allowed';

const DEVICE_KEY = 'worship:device-id';

/** 이 브라우저를 가리키는 값. 서버는 앱이 열려 있는 기기에는 푸시를 보내지 않으려고 씁니다. */
export function deviceId(): string {
    try {
        const stored = localStorage.getItem(DEVICE_KEY);
        if (stored && /^[\w-]{8,64}$/.test(stored)) return stored;
        const id = crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, id);
        return id;
    } catch {
        return '';
    }
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
    if (!current) return false;
    const bytes = new Uint8Array(current);
    return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

let publicKeyRequest: Promise<string | null> | null = null;
function serverKey(): Promise<string | null> {
    publicKeyRequest ??= fetch('/api/push', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() as Promise<{ publicKey?: string | null }> : {}))
        .then((body) => ('publicKey' in body && typeof body.publicKey === 'string' ? body.publicKey : null))
        .catch(() => { publicKeyRequest = null; return null; });
    return publicKeyRequest;
}

export function pushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 푸시를 쓸 수 있는 환경인지 (서버 설정 포함) */
export async function pushAvailable(): Promise<boolean> {
    return pushSupported() && Boolean(await serverKey());
}

async function registration(): Promise<ServiceWorkerRegistration> {
    // 운영 빌드는 공통 틀이 이미 등록합니다. 개발 중에는 알림을 켤 때만 등록합니다.
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
}

/**
 * 알림을 허락한 기기면 푸시를 구독하고 서버에 이 기기를 알립니다. 여러 번 불러도 됩니다.
 * 같은 기기에서 다른 사람이 로그인했으면 서버가 그 사람에게 옮깁니다.
 */
export async function syncPushSubscription(): Promise<PushState> {
    if (!pushSupported()) return 'unavailable';
    if (Notification.permission !== 'granted') return 'not-allowed';
    const key = await serverKey();
    if (!key) return 'unavailable';
    try {
        const ready = await registration();
        const expected = keyBytes(key);
        let subscription = await ready.pushManager.getSubscription();
        if (subscription && !sameKey(subscription.options.applicationServerKey, expected)) {
            // 서버 키가 바뀌었으면 새 키로 다시 구독합니다.
            await subscription.unsubscribe();
            subscription = null;
        }
        subscription ??= await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expected });
        const response = await fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON(), deviceId: deviceId() }),
        });
        return response.ok ? 'subscribed' : 'unavailable';
    } catch {
        return 'unavailable';
    }
}

/** 로그아웃 전에 이 기기의 푸시를 끊습니다 (다음 사람에게 앞사람 알림이 가지 않게). */
export async function dropPushSubscription(): Promise<void> {
    if (!pushSupported()) return;
    try {
        const existing = await navigator.serviceWorker.getRegistration();
        const subscription = await existing?.pushManager.getSubscription();
        if (!subscription) return;
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }), keepalive: true });
        await subscription.unsubscribe();
    } catch {
        // 다음 로그인 때 서버가 그 사람에게 옮깁니다.
    }
}
