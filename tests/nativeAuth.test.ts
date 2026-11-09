import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { decode, encode } from 'next-auth/jwt';
import {
    APP_LOGIN_CODE_TTL_MS, NATIVE_LOGIN_TTL_MS, PENDING_LOGIN_KEY, androidIntentUrl, appCallbackUrl, appReturnUrl, base64UrlDecode, base64UrlEncode,
    beginNativeLogin, challengeFor, handoffCookieName, hashLoginCode, isAppStartNavigation, isLoginToken, isSameOriginRequest, parseAppReturn,
    randomToken, signHandoff, takePendingLogin, timingSafeEqual, verifyHandoff, type HandoffRecord,
} from '../lib/nativeAuth';
import { AppLoginCodes, type AppLoginRedeemResult } from '../lib/server/appLoginCodes';
import { TeamRepository } from '../lib/server/teamRepository';
import { SESSION_MAX_AGE, createAuthOptions, providerUserId, sessionCookieName, sessionTokenClaims } from '../lib/authConfig';

/*
 * 앱 셸 로그인(lib/nativeAuth.ts · lib/server/appLoginCodes.ts): verifier/challenge, 서명한 핸드오프 쿠키,
 * 일회용 코드(해시 저장 · 60초 · 한 번만 · 서버 프로세스가 둘이어도 한 번만), 교환 API 가 만드는 세션 토큰이 NextAuth 와 같은지.
 */

const SECRET = 'test-fixture-only-never-use-in-production';
const USER = { id: providerUserId('google', 'google-account-1'), name: '김찬양', email: 'praise@example.test', image: 'https://example.test/p.png' };

function tempFile() {
    const folder = mkdtempSync(path.join(tmpdir(), 'worship-native-auth-'));
    return { file: path.join(folder, 'teams.sqlite'), cleanup: () => rmSync(folder, { recursive: true, force: true }) };
}

function memoryStorage() {
    const values = new Map<string, string>();
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        removeItem: (key: string) => void values.delete(key),
    };
}

async function issuedCode(codes: AppLoginCodes, now = Date.now(), callbackUrl = '/invite/abc?from=app') {
    const verifier = randomToken();
    const code = await codes.issue({ user: USER, challenge: await challengeFor(verifier), callbackUrl }, now);
    return { verifier, code };
}

test('verifier/challenge round-trip matches RFC 7636 S256 and works with Node WebCrypto', async () => {
    // RFC 7636 Appendix B
    assert.equal(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    const verifier = randomToken();
    assert.equal(isLoginToken(verifier), true, '32바이트 → base64url 43글자');
    assert.equal(base64UrlDecode(verifier)?.length, 32);
    assert.notEqual(randomToken(), verifier);
    const challenge = await challengeFor(verifier);
    assert.equal(isLoginToken(challenge), true);
    assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'), 'Node crypto 와 같은 값');
    assert.equal(await hashLoginCode(verifier), createHash('sha256').update(verifier).digest('hex'));
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    assert.deepEqual(base64UrlDecode(base64UrlEncode(bytes)), bytes);
    assert.equal(base64UrlDecode('a+b/'), null);
    for (const bad of ['', 'short', `${verifier}=`, `${verifier.slice(1)}+`, 42, null]) assert.equal(isLoginToken(bad), false, String(bad));
    assert.equal(timingSafeEqual(challenge, challenge), true);
    assert.equal(timingSafeEqual(challenge, `${challenge.slice(0, -1)}A`) && !challenge.endsWith('A'), false);
    assert.equal(timingSafeEqual(challenge, challenge.slice(0, -1)), false);
});

test('beginNativeLogin keeps the verifier in the WebView (one attempt, 10 min) and sends only the challenge', async () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    const url = new URL(await beginNativeLogin({ origin: 'https://worship.example', provider: 'google', callbackUrl: '/invite/abc', storage, now }));
    assert.equal(`${url.origin}${url.pathname}`, 'https://worship.example/auth/app-start');
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('callbackUrl'), '/invite/abc');
    const stored = JSON.parse(storage.values.get(PENDING_LOGIN_KEY)!) as { verifier: string; expiresAt: number };
    assert.equal(stored.expiresAt, now + NATIVE_LOGIN_TTL_MS);
    assert.equal(url.searchParams.get('challenge'), await challengeFor(stored.verifier));
    assert.equal(url.toString().includes(stored.verifier), false, 'verifier 는 주소에 실리지 않음');
    assert.equal(takePendingLogin(storage, now + 1000), stored.verifier);
    assert.equal(takePendingLogin(storage, now + 1000), null, '한 번 꺼내면 지움');

    await beginNativeLogin({ origin: 'https://worship.example', provider: 'naver', callbackUrl: 'https://evil.example/x', storage, now });
    assert.equal(takePendingLogin(storage, now + NATIVE_LOGIN_TTL_MS), null, '만료');
    const again = new URL(await beginNativeLogin({ origin: 'https://worship.example', provider: 'naver', callbackUrl: 'https://evil.example/x', storage, now }));
    assert.equal(again.searchParams.get('callbackUrl'), '/dashboard', '다른 사이트로 돌아가지 않음');
    storage.setItem(PENDING_LOGIN_KEY, '{broken');
    assert.equal(takePendingLogin(storage, now), null);
});

test('hand-off cookie: signed record round-trips; tampered, re-signed with another secret, expired or malformed values are rejected', async () => {
    const now = 1_700_000_000_000;
    const record: HandoffRecord = { provider: 'google', challenge: await challengeFor(randomToken()), callbackUrl: '/session/42', exp: now + NATIVE_LOGIN_TTL_MS };
    const value = await signHandoff(record, SECRET);
    assert.deepEqual(await verifyHandoff(value, SECRET, now), record);
    assert.equal(handoffCookieName(true), '__Secure-wt-app-handoff');
    assert.equal(handoffCookieName(false), 'wt-app-handoff');

    const [payload, signature] = value.split('.');
    const forged = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...record, challenge: await challengeFor(randomToken()) })));
    assert.equal(await verifyHandoff(`${forged}.${signature}`, SECRET, now), null, '내용을 바꾼 쿠키');
    const flipped = signature[0] === 'A' ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    assert.equal(await verifyHandoff(`${payload}.${flipped}`, SECRET, now), null, '서명을 바꾼 쿠키');
    assert.equal(await verifyHandoff(value, `${SECRET}-other`, now), null, '다른 비밀 키');
    assert.equal(await verifyHandoff(await signHandoff(record, `${SECRET}-other`), SECRET, now), null);
    assert.equal(await verifyHandoff(value, SECRET, record.exp), null, '만료 시각');
    assert.equal(await verifyHandoff(value, SECRET, record.exp + 1), null, '만료 뒤');
    assert.equal(await verifyHandoff(value, '', now), null);
    for (const bad of [undefined, '', payload, `${value}.x`, `.${signature}`, 'x'.repeat(3000)]) assert.equal(await verifyHandoff(bad, SECRET, now), null, String(bad).slice(0, 20));
    // 서명이 맞아도 칸이 틀리면 거절(서버가 잘못 만든 기록도 쓰지 않음)
    assert.equal(await verifyHandoff(await signHandoff({ ...record, challenge: 'short' }, SECRET), SECRET, now), null);
    assert.equal(await verifyHandoff(await signHandoff({ ...record, callbackUrl: 'https://evil.example' }, SECRET), SECRET, now), null);
    assert.equal(await verifyHandoff(await signHandoff({ ...record, provider: 'Evil Provider' }, SECRET), SECRET, now), null);
});

test('callbackUrl is sanitised to a local app page (no open redirect, no auth/login loops)', () => {
    assert.equal(appCallbackUrl('/invite/abc?from=kakao#top'), '/invite/abc?from=kakao#top');
    assert.equal(appCallbackUrl('https://worship.example/live/s-1', 'https://worship.example'), '/live/s-1');
    for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', '/api/auth/signout', '/auth/app-return?code=x', '/%61uth/app-start', '/login?callbackUrl=/x', 'javascript:alert(1)', undefined, 42]) {
        assert.equal(appCallbackUrl(bad, 'https://worship.example'), '/dashboard', String(bad));
    }
});

test('exchange accepts only same-origin requests; app-start only from the app-opened browser or this site', () => {
    const allowed = ['https://worship.example', null];
    assert.equal(isSameOriginRequest({ origin: 'https://worship.example', secFetchSite: 'same-origin' }, allowed), true);
    assert.equal(isSameOriginRequest({ origin: 'https://worship.example', secFetchSite: null }, allowed), true, 'Sec-Fetch-Site 를 보내지 않는 브라우저');
    assert.equal(isSameOriginRequest({ origin: 'https://evil.example', secFetchSite: null }, allowed), false);
    assert.equal(isSameOriginRequest({ origin: 'https://worship.example', secFetchSite: 'cross-site' }, allowed), false);
    assert.equal(isSameOriginRequest({ origin: 'https://worship.example', secFetchSite: 'same-site' }, allowed), false);
    assert.equal(isSameOriginRequest({ origin: null, secFetchSite: 'same-origin' }, allowed), false, 'Origin 없음');
    assert.equal(isSameOriginRequest({ origin: 'null', secFetchSite: null }, allowed), false);
    for (const site of [null, 'none', 'same-origin']) assert.equal(isAppStartNavigation(site), true, String(site));
    for (const site of ['cross-site', 'same-site']) assert.equal(isAppStartNavigation(site), false, site);
});

test('app-return links: App Link URL, Android intent link to this package, and parsing in the app', () => {
    const code = randomToken();
    const link = appReturnUrl('https://worship.example', code);
    assert.equal(link, `https://worship.example/auth/app-return?code=${code}`);
    assert.equal(androidIntentUrl(link), `intent://worship.example/auth/app-return?code=${code}#Intent;scheme=https;package=com.worshiptogether.app;end`);
    assert.equal(androidIntentUrl('http://10.0.2.2:4000/auth/app-return?code=x'), null);
    assert.deepEqual(parseAppReturn(`/auth/app-return?code=${code}`), { code });
    assert.deepEqual(parseAppReturn('/auth/app-return?code=bad'), { code: null });
    assert.deepEqual(parseAppReturn('/auth/app-return'), { code: null });
    assert.equal(parseAppReturn('/dashboard?code=x'), null);
    assert.equal(parseAppReturn('/auth/app-returnx?code=x'), null);
});

test('login code: 256-bit, only its hash is stored, and it is single-use', async () => {
    const { file, cleanup } = tempFile();
    const repository = new TeamRepository(file);
    try {
        const codes = new AppLoginCodes(repository.database);
        const { code, verifier } = await issuedCode(codes);
        assert.equal(isLoginToken(code), true);
        assert.equal(base64UrlDecode(code)?.length, 32);
        const rows = repository.database.prepare('SELECT * FROM app_login_codes').all() as Record<string, unknown>[];
        assert.equal(rows.length, 1);
        assert.equal(rows[0].code_hash, createHash('sha256').update(code).digest('hex'));
        assert.equal(JSON.stringify(rows).includes(code), false, '코드 원문은 저장하지 않음');
        assert.equal(JSON.stringify(rows).includes(verifier), false);

        const first = await codes.redeem(code, verifier);
        assert.deepEqual(first, { ok: true, user: USER, callbackUrl: '/invite/abc?from=app' });
        assert.deepEqual(await codes.redeem(code, verifier), { ok: false, reason: 'used' }, '두 번째 교환은 실패');
        assert.deepEqual(await codes.redeem(randomToken(), verifier), { ok: false, reason: 'invalid' });
        assert.deepEqual(await codes.redeem('not-a-code', verifier), { ok: false, reason: 'invalid' });
        await assert.rejects(codes.issue({ user: { ...USER, id: 'not-a-provider-hash' }, challenge: await challengeFor(verifier), callbackUrl: '/' }));
        await assert.rejects(codes.issue({ user: USER, challenge: 'short', callbackUrl: '/' }));
    } finally {
        repository.close();
        cleanup();
    }
});

test('a wrong verifier fails AND consumes the code (an intercepted code cannot be retried)', async () => {
    // 선택: 틀린 verifier 도 코드를 써 버립니다. 가로챈 쪽이 여러 verifier 를 시도할 수 없고, 서버는 시도 횟수를 따로 세지 않아도 됩니다.
    // 대가: 진짜 앱이 받을 코드를 남이 먼저 태우면 앱은 로그인을 다시 시작해야 합니다(탈취는 아님).
    const { file, cleanup } = tempFile();
    const repository = new TeamRepository(file);
    try {
        const codes = new AppLoginCodes(repository.database);
        const { code, verifier } = await issuedCode(codes);
        assert.deepEqual(await codes.redeem(code, randomToken()), { ok: false, reason: 'verifier' });
        assert.deepEqual(await codes.redeem(code, verifier), { ok: false, reason: 'used' }, '맞는 verifier 로도 이제 실패');
    } finally {
        repository.close();
        cleanup();
    }
});

test('an expired code fails, and expired codes are purged', async () => {
    const { file, cleanup } = tempFile();
    const repository = new TeamRepository(file);
    try {
        const codes = new AppLoginCodes(repository.database);
        const now = Date.now();
        const old = await issuedCode(codes, now);
        assert.deepEqual(await codes.redeem(old.code, old.verifier, now + APP_LOGIN_CODE_TTL_MS), { ok: false, reason: 'expired' }, '정확히 60초');
        const late = await issuedCode(codes, now);
        assert.deepEqual(await codes.redeem(late.code, late.verifier, now + APP_LOGIN_CODE_TTL_MS + 5_000), { ok: false, reason: 'expired' });
        const used = await issuedCode(codes, now);
        assert.equal((await codes.redeem(used.code, used.verifier, now + 1)).ok, true);
        // 새 코드를 발급할 때 만료된 줄(쓴 것 · 안 쓴 것)을 지웁니다.
        const fresh = await issuedCode(codes, now + APP_LOGIN_CODE_TTL_MS + 10_000);
        const left = repository.database.prepare('SELECT count(*) AS n FROM app_login_codes').get() as { n: number };
        assert.equal(left.n, 1);
        assert.equal((await codes.redeem(fresh.code, fresh.verifier, now + APP_LOGIN_CODE_TTL_MS + 10_001)).ok, true);
    } finally {
        repository.close();
        cleanup();
    }
});

test('concurrent exchanges of one code from separate DB connections (threads): exactly one succeeds', async () => {
    const { file, cleanup } = tempFile();
    const repository = new TeamRepository(file);
    try {
        const codes = new AppLoginCodes(repository.database);
        for (let round = 0; round < 3; round += 1) {
            const { code, verifier } = await issuedCode(codes);
            const count = 4;
            const barrier = new SharedArrayBuffer(4);
            const results = await Promise.all(Array.from({ length: count }, () => new Promise<AppLoginRedeemResult>((resolve, reject) => {
                const worker = new Worker(new URL('./workers/tsxBootstrap.mjs', import.meta.url), {
                    workerData: { entry: new URL('./workers/appLoginRedeem.ts', import.meta.url).href, file, code, verifier, barrier, count },
                });
                worker.once('message', resolve);
                worker.once('error', reject);
                worker.once('exit', (exitCode) => reject(new Error(`worker exited (${exitCode}) without a result`)));
            })));
            assert.equal(results.filter((result) => result.ok).length, 1, JSON.stringify(results.map((result) => result.ok || result.reason)));
            assert.deepEqual(results.filter((result) => !result.ok).map((result) => !result.ok && result.reason), ['used', 'used', 'used']);
        }
        // 같은 파일을 쓰는 두 연결: 한쪽에서 쓴 코드는 다른 쪽에서도 쓴 코드
        const other = new TeamRepository(file);
        try {
            const { code, verifier } = await issuedCode(codes);
            assert.equal((await new AppLoginCodes(other.database).redeem(code, verifier)).ok, true);
            assert.deepEqual(await codes.redeem(code, verifier), { ok: false, reason: 'used' });
        } finally {
            other.close();
        }
    } finally {
        repository.close();
        cleanup();
    }
});

test('the exchanged session token has the jwt-callback shape and is read by NextAuth like a real login', async () => {
    const env = { NEXTAUTH_URL: 'https://worship.example', NEXTAUTH_SECRET: SECRET, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
    const options = createAuthOptions(env);
    assert.equal(options.session?.maxAge, SESSION_MAX_AGE);
    const fromCallback = await options.callbacks!.jwt!({
        token: { name: 'x' }, user: { id: 'google-account-1', name: USER.name, email: USER.email, image: USER.image },
        account: { provider: 'google', providerAccountId: 'google-account-1', type: 'oauth' },
    } as Parameters<NonNullable<NonNullable<typeof options.callbacks>['jwt']>>[0]);
    assert.deepEqual(sessionTokenClaims(USER), fromCallback);
    assert.deepEqual(Object.keys(fromCallback).sort(), ['email', 'name', 'picture', 'sub', 'userId']);

    const token = await encode({ token: sessionTokenClaims(USER), secret: SECRET, maxAge: SESSION_MAX_AGE });
    const decoded = await decode({ token, secret: SECRET });
    assert.equal(decoded?.userId, USER.id);
    assert.equal(Number(decoded?.exp) - Number(decoded?.iat), SESSION_MAX_AGE);
    assert.equal(sessionCookieName(true), '__Secure-next-auth.session-token');
    assert.equal(sessionCookieName(false), 'next-auth.session-token');

    // 실제 NextAuth 세션 처리로 읽어 봅니다(getServerSession 과 같은 경로).
    const require = createRequire(import.meta.url);
    const { AuthHandler } = require(path.join(path.dirname(require.resolve('next-auth')), 'core/index.js')) as { AuthHandler: (params: unknown) => Promise<{ body?: { user?: unknown } }> };
    const previous = { url: process.env.NEXTAUTH_URL, secret: process.env.NEXTAUTH_SECRET };
    Object.assign(process.env, { NEXTAUTH_URL: env.NEXTAUTH_URL, NEXTAUTH_SECRET: SECRET });
    try {
        const session = await AuthHandler({ options, req: { action: 'session', method: 'GET', cookies: { [sessionCookieName(true)]: token }, headers: {} } });
        assert.deepEqual(session.body?.user, USER);
        const plain = await AuthHandler({ options, req: { action: 'session', method: 'GET', cookies: { [sessionCookieName(false)]: token }, headers: {} } });
        assert.deepEqual(plain.body, {}, 'https 배포에서는 __Secure- 이름만 읽음');
    } finally {
        for (const [key, value] of [['NEXTAUTH_URL', previous.url], ['NEXTAUTH_SECRET', previous.secret]] as const) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
