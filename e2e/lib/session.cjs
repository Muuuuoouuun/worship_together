/**
 * 테스트용 NextAuth v4 세션 쿠키 발급 (개발 전용).
 *
 * `NEXTAUTH_SECRET` 으로 서명한 JWT 를 직접 만들어 OAuth 로그인 없이 로그인 상태를 재현합니다.
 * 운영 서버에는 절대 사용하지 마세요. (secret 을 아는 사람은 누구든 세션을 위조할 수 있습니다.)
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** lib/authConfig.ts 의 providerUserId 와 같은 규칙: sha256("provider:accountId") hex. 그쪽을 바꾸면 여기도 바꿔야 합니다. */
function providerUserId(provider, accountId) {
    if (!['google', 'naver'].includes(provider) || !String(accountId ?? '').trim()) throw new Error('Invalid OAuth account');
    return createHash('sha256').update(`${provider}:${accountId}`, 'utf8').digest('hex');
}

/** 환경변수 → 저장소 루트 .env.local 순서로 NEXTAUTH_SECRET 을 찾습니다 (dotenv 없이 최소 파싱). */
function loadSecret() {
    if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
    const file = path.join(REPO_ROOT, '.env.local');
    if (fs.existsSync(file)) {
        for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = raw.match(/^\s*(?:export\s+)?NEXTAUTH_SECRET\s*=\s*(.*?)\s*$/);
            if (!m) continue;
            let v = m[1];
            if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
            else v = v.replace(/\s+#.*$/, '');
            if (v) return v;
        }
    }
    throw new Error('NEXTAUTH_SECRET 을 찾을 수 없습니다. 환경변수로 넘기거나 .env.local 에 설정하세요.');
}

/** @returns {Promise<{ id: string, cookie: string }>} id 는 앱 내부 사용자 id, cookie 는 세션 토큰 값. */
async function mintSessionCookie({ provider = 'google', accountId, name, secret = loadSecret(), maxAge = 3600 }) {
    const { encode } = await import('next-auth/jwt');
    const id = providerUserId(provider, accountId);
    // lib/authConfig.ts 의 jwt 콜백이 만드는 토큰과 같은 모양
    const cookie = await encode({ secret, token: { sub: id, userId: id, name, email: null, picture: null }, maxAge });
    return { id, cookie };
}

/** Playwright context.addCookies 용 항목. https 에서는 __Secure- 접두 쿠키 이름을 씁니다. */
function sessionCookieFor(user, baseUrl) {
    const u = new URL(baseUrl);
    const secure = u.protocol === 'https:';
    return [{
        name: `${secure ? '__Secure-' : ''}next-auth.session-token`,
        value: user.cookie,
        domain: u.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure,
    }];
}

module.exports = { providerUserId, loadSecret, mintSessionCookie, sessionCookieFor };
