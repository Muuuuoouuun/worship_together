import type Database from 'better-sqlite3';
import { writeTransaction } from './sqliteRetry';
import { APP_LOGIN_CODE_TTL_MS, appCallbackUrl, challengeFor, hashLoginCode, isLoginToken, randomToken, timingSafeEqual } from '../nativeAuth';

/*
 * 앱 셸 로그인의 일회용 코드 (흐름: lib/nativeAuth.ts).
 * - 코드는 무작위 32바이트(256비트). 서버에는 SHA-256 해시만 두고, 60초 동안 한 번만 쓸 수 있습니다.
 * - 교환은 쓰기 트랜잭션 하나(BEGIN IMMEDIATE)에서 조회 → 확인 → 사용 표시까지 합니다. 서버 프로세스가 둘이어도 둘 다 성공할 수 없습니다.
 * - verifier 가 틀려도 코드를 써 버립니다(사용 표시). 코드를 가로챈 쪽이 verifier 를 여러 번 맞혀 볼 수 없게 하기 위해서입니다.
 *   그 대신 진짜 앱이 받을 코드를 남이 먼저 틀린 verifier 로 태우면 앱은 로그인을 다시 시작해야 합니다(서비스 거부일 뿐 탈취는 아님).
 * - 만료된 줄은 발급 · 교환 때 함께 지웁니다.
 * 세션 클레임(이름 · 이메일 · 사진)도 함께 둡니다. 교환 API 가 NextAuth jwt 콜백과 같은 모양의 토큰을 만들 때 씁니다.
 */

export type AppLoginIdentity = { id: string; name: string; email?: string | null; image?: string | null };
export type AppLoginFailure = 'invalid' | 'expired' | 'used' | 'verifier';
export type AppLoginRedeemResult =
    | { ok: true; user: AppLoginIdentity; callbackUrl: string }
    | { ok: false; reason: AppLoginFailure };

type CodeRow = {
    user_id: string;
    name: string;
    email: string | null;
    picture: string | null;
    challenge: string;
    callback_url: string;
    expires_at: number;
    used_at: number | null;
};

export class AppLoginCodes {
    constructor(private readonly db: Database.Database) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_login_codes (
                code_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                picture TEXT,
                challenge TEXT NOT NULL,
                callback_url TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                used_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS app_login_codes_expires ON app_login_codes(expires_at);
        `);
    }

    /** 로그인한 사람에게 코드를 발급합니다. 돌려준 코드 원문은 저장하지 않습니다. */
    async issue({ user, challenge, callbackUrl }: { user: AppLoginIdentity; challenge: string; callbackUrl: string }, now = Date.now()): Promise<string> {
        if (!/^[a-f0-9]{64}$/.test(user.id)) throw new Error('Invalid user id');
        if (!isLoginToken(challenge)) throw new Error('Invalid challenge');
        const code = randomToken();
        const codeHash = await hashLoginCode(code);
        writeTransaction(this.db, () => {
            this.purge(now);
            this.db.prepare(`INSERT INTO app_login_codes(code_hash, user_id, name, email, picture, challenge, callback_url, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                codeHash, user.id, (user.name || '예배팀원').slice(0, 200), user.email ?? null, user.image ?? null,
                challenge, appCallbackUrl(callbackUrl), now + APP_LOGIN_CODE_TTL_MS,
            );
        });
        return code;
    }

    /** 코드와 verifier 를 확인하고, 맞든 틀리든 코드를 써 버립니다(만료 · 없는 코드는 그대로). */
    async redeem(code: unknown, verifier: unknown, now = Date.now()): Promise<AppLoginRedeemResult> {
        if (!isLoginToken(code) || !isLoginToken(verifier)) return { ok: false, reason: 'invalid' };
        const [codeHash, challenge] = await Promise.all([hashLoginCode(code), challengeFor(verifier)]);
        return this.consume(codeHash, challenge, now);
    }

    /** 동기: 쓰기 트랜잭션 하나에서 조회 → 만료 · 사용 확인 → 사용 표시 → challenge 비교 */
    consume(codeHash: string, verifierChallenge: string, now = Date.now()): AppLoginRedeemResult {
        return writeTransaction(this.db, (): AppLoginRedeemResult => {
            const row = this.db.prepare(`SELECT user_id, name, email, picture, challenge, callback_url, expires_at, used_at
                FROM app_login_codes WHERE code_hash = ?`).get(codeHash) as CodeRow | undefined;
            this.purge(now, codeHash);
            if (!row) return { ok: false, reason: 'invalid' };
            if (row.used_at !== null) return { ok: false, reason: 'used' };
            if (row.expires_at <= now) return { ok: false, reason: 'expired' };
            // 조건부 UPDATE 라 트랜잭션 밖의 경합이 있더라도 한 번만 바뀝니다.
            const marked = this.db.prepare('UPDATE app_login_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL').run(now, codeHash);
            if (marked.changes !== 1) return { ok: false, reason: 'used' };
            if (!timingSafeEqual(verifierChallenge, row.challenge)) return { ok: false, reason: 'verifier' };
            return {
                ok: true,
                user: { id: row.user_id, name: row.name, email: row.email, image: row.picture },
                callbackUrl: appCallbackUrl(row.callback_url),
            };
        });
    }

    /** 만료된 코드(쓴 것 · 안 쓴 것 모두)를 지웁니다. keep 은 지금 확인 중인 코드 */
    private purge(now: number, keep = '') {
        this.db.prepare('DELETE FROM app_login_codes WHERE expires_at <= ? AND code_hash <> ?').run(now, keep);
    }
}
