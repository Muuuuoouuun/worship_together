import type Database from 'better-sqlite3';

/*
 * 앱을 닫아도 오는 알림 (Web Push).
 * - 기기마다 구독(브라우저가 준 주소 · 키)을 사용자에 묶어 저장합니다. 같은 기기에서 다른 사람이 로그인하면 그 사람에게 옮깁니다.
 * - 보낼 때 그 기기에서 앱이 열려 있으면(팀 소식 흐름이 붙어 있으면) 건너뜁니다 — 열린 앱이 앱 안 알림 · 기기 알림을 띄웁니다.
 * - 브라우저가 '없는 구독'(404 · 410)이라고 하면 지웁니다.
 * VAPID 키(VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY)가 없으면 아무것도 보내지 않습니다.
 */

export interface PushConfig {
    publicKey: string;
    privateKey: string;
    /** 푸시 서비스가 연락할 주소 (mailto: 또는 https:) */
    subject: string;
}

export interface PushSubscriptionInput {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export interface PushMessage {
    title: string;
    body: string;
    /** 알림을 누르면 열 주소 (이 사이트 안의 경로) */
    url: string;
    /** 같은 tag 의 알림은 기기에서 하나로 바뀝니다 (앱이 띄운 기기 알림과 겹치지 않게 같은 값을 씀) */
    tag: string;
    urgent?: boolean;
}

export type PushSendFn = (subscription: PushSubscriptionInput, payload: string, options: { TTL: number; urgency: 'normal' | 'high' }) => Promise<unknown>;

type Row = { endpoint: string; user_id: string; device_id: string; p256dh: string; auth: string };

const MAX_PER_USER = 10;

// Subscription URLs are client input. Only browser push services may receive
// server requests; arbitrary HTTPS URLs could otherwise reach private services.
function isPushService(url: URL): boolean {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname;
    return host === 'fcm.googleapis.com' || host === 'android.googleapis.com'
        || host === 'web.push.apple.com'
        || host === 'updates.push.services.mozilla.com'
        || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
}

function localPath(value: string): string {
    // URL parsers also treat backslashes as slashes for HTTP navigation.
    return value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n\t]/.test(value) ? value : '/dashboard';
}

export function pushConfigFromEnv(env: Record<string, string | undefined> = process.env): PushConfig | null {
    const publicKey = env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = env.VAPID_PRIVATE_KEY?.trim();
    if (!publicKey || !privateKey) return null;
    const subject = env.VAPID_SUBJECT?.trim() || env.NEXTAUTH_URL?.trim() || 'mailto:admin@example.com';
    return { publicKey, privateKey, subject };
}

export class PushStore {
    private connected = new Map<string, number>();

    constructor(private db: Database.Database, private config: PushConfig | null, private sendFn: PushSendFn | null) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
        `);
    }

    /** 화면에 넘길 공개 키 (설정되지 않았으면 null — 버튼은 앱이 열려 있을 때의 알림만 안내) */
    get publicKey(): string | null {
        return this.config?.publicKey ?? null;
    }

    subscribe(userId: string, deviceId: unknown, input: unknown): void {
        const value = input && typeof input === 'object' ? input as Partial<PushSubscriptionInput> : {};
        const endpoint = typeof value.endpoint === 'string' ? value.endpoint : '';
        const keys = value.keys && typeof value.keys === 'object' ? value.keys : null;
        let url: URL | null = null;
        try { url = new URL(endpoint); } catch { url = null; }
        if (!url || !isPushService(url) || endpoint.length > 1000 || !keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
            throw new Error('알림 구독 정보를 확인해주세요.');
        }
        const device = typeof deviceId === 'string' && /^[\w-]{8,64}$/.test(deviceId) ? deviceId : endpoint.slice(-64);
        this.db.transaction(() => {
            this.db.prepare(`INSERT INTO push_subscriptions(endpoint, user_id, device_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth`)
                .run(endpoint, userId, device, keys.p256dh, keys.auth, new Date().toISOString());
            // 한 사람의 오래된 기기 구독은 최근 MAX_PER_USER 개만 남깁니다.
            this.db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)').run(userId, userId, MAX_PER_USER);
        })();
    }

    unsubscribe(userId: string, endpoint: unknown): void {
        if (typeof endpoint !== 'string') return;
        this.db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
    }

    subscriptionCount(userId: string): number {
        return (this.db.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE user_id = ?').get(userId) as { n: number }).n;
    }

    /** 이 기기에서 앱이 열려 있는 동안 (팀 소식 흐름이 붙어 있는 동안). 돌려준 함수로 닫습니다. */
    deviceConnected(deviceId: string | null): () => void {
        if (!deviceId) return () => {};
        this.connected.set(deviceId, (this.connected.get(deviceId) ?? 0) + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const left = (this.connected.get(deviceId) ?? 1) - 1;
            if (left > 0) this.connected.set(deviceId, left);
            else this.connected.delete(deviceId);
        };
    }

    /** 받는 사람들의 기기 중 앱이 닫혀 있는 기기에 보냅니다. 보낸 기기 수를 돌려줍니다. */
    async send(userIds: string[], message: PushMessage): Promise<number> {
        if (!this.config || !this.sendFn || !userIds.length) return 0;
        const ids = [...new Set(userIds)];
        const rows = this.db.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Row[];
        const payload = JSON.stringify({
            title: message.title.slice(0, 120),
            body: message.body.length > 300 ? `${message.body.slice(0, 299)}…` : message.body,
            url: localPath(message.url),
            tag: message.tag.slice(0, 100),
        });
        let sent = 0;
        await Promise.all(rows.filter((row) => !this.connected.get(row.device_id)).map(async (row) => {
            try {
                await this.sendFn!({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 6, urgency: message.urgent ? 'high' : 'normal' });
                sent += 1;
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
                else console.error('[push] send', status ?? error);
            }
        }));
        return sent;
    }
}
