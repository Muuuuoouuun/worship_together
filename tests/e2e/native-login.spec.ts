import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/*
 * 앱 셸 로그인(lib/nativeAuth.ts)을 두 브라우저 컨텍스트로 재현합니다.
 * - "browser": 시스템 브라우저(Custom Tabs · SFSafariViewController) 역할. /auth/app-start → 개발용 이름 로그인 → /auth/app-complete → 앱 링크
 * - "webview": 앱 WebView 역할. verifier/challenge 를 만들고, 받은 코드를 /api/auth/app-exchange 로 세션 쿠키와 바꿉니다.
 * 실제 Google · 네이버 대신 DEV_LOGIN 공급자(scripts/e2e-server.mjs)를 씁니다.
 */

const DEV_PROVIDER = 'dev';

type Exchange = { status: number; body: { ok?: boolean; callbackUrl?: string; error?: string } };

/** WebView 에서: verifier(32바이트 base64url) · challenge = base64url(SHA-256(verifier)) */
function pkce(webview: Page) {
    return webview.evaluate(async () => {
        const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
        return { verifier, challenge };
    });
}

/** WebView 에서 같은 origin fetch 로 교환 (NativeBridge 와 같은 요청) */
function exchange(webview: Page, body: { code: string; verifier: string }): Promise<Exchange> {
    return webview.evaluate(async (payload) => {
        const response = await fetch('/api/auth/app-exchange', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        return { status: response.status, body: await response.json() };
    }, body);
}

/** 시스템 브라우저에서 로그인하고, 앱 링크로 넘어가는 코드를 돌려줍니다. */
async function browserLogin(browser: Page, name: string, challenge: string): Promise<string> {
    const complete = browser.waitForResponse((response) => new URL(response.url()).pathname === '/auth/app-complete');
    await browser.goto(`/auth/app-start?provider=${DEV_PROVIDER}&challenge=${challenge}&callbackUrl=${encodeURIComponent('/dashboard')}`);
    await expect(browser).toHaveURL(/\/auth\/app-signin$/);
    await expect(browser.getByRole('heading', { name: '앱 로그인' })).toBeVisible();
    await browser.getByLabel('개발용 로그인 · 이름이 같으면 같은 사람').fill(name);
    await browser.getByRole('button', { name: '로그인', exact: true }).click();
    await browser.waitForURL(/\/auth\/app-return\?code=/);
    const code = new URL(browser.url()).searchParams.get('code') ?? '';
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // app-complete: 앱 링크로 303, 핸드오프 쿠키와 이 브라우저의 세션 쿠키를 지움
    const redirect = await complete;
    expect(redirect.status()).toBe(303);
    const headers = await redirect.allHeaders();
    expect(headers.location).toBe(`${new URL(browser.url()).origin}/auth/app-return?code=${code}`);
    const setCookie = (await redirect.headersArray()).filter((header) => header.name.toLowerCase() === 'set-cookie').map((header) => header.value);
    expect(setCookie.some((value) => /^next-auth\.session-token=;/.test(value) && /Max-Age=0/i.test(value))).toBe(true);
    expect(setCookie.some((value) => /^wt-app-handoff=;/.test(value) && /Path=\/auth/i.test(value))).toBe(true);

    // 브라우저에 열린 앱 링크 화면: 교환하지 않고 "앱으로 돌아가기" 만 보여 줌
    await expect(browser.getByRole('heading', { name: '앱에서 열어 주세요' })).toBeVisible();
    await expect(browser.getByRole('link', { name: '앱으로 돌아가기' })).toHaveAttribute('href', `${new URL(browser.url()).origin}/auth/app-return?code=${code}`);
    return code;
}

async function expectSignedOut(context: BrowserContext, browser: Page) {
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names.filter((name) => /session-token|wt-app-handoff/.test(name))).toEqual([]);
    expect(await (await browser.request.get('/api/auth/session')).json()).toEqual({});
}

test('app-shell sign-in: system-browser login → one-time code → WebView session; replay, wrong verifier and cross-origin are rejected', async ({ browser: playwright, baseURL }) => {
    test.setTimeout(240_000);
    const name = `앱 로그인 ${Date.now().toString(36)}`;
    const options = { baseURL, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' as const };
    const browserContext = await playwright.newContext(options);
    const webviewContext = await playwright.newContext(options);
    try {
        const browser = await browserContext.newPage();
        const webview = await webviewContext.newPage();
        await webview.goto('/login');

        // 다른 사이트의 링크로는 앱 로그인을 시작하지 않습니다(핸드오프 쿠키 없음).
        const crossSite = await browserContext.request.get(`/auth/app-start?provider=${DEV_PROVIDER}&challenge=${(await pkce(webview)).challenge}`, { headers: { 'Sec-Fetch-Site': 'cross-site' }, maxRedirects: 0 });
        expect(crossSite.status()).toBe(303);
        expect(crossSite.headers().location).toMatch(/\/auth\/app-signin\?error=InvalidRequest$/);
        expect((await browserContext.cookies()).some((cookie) => cookie.name === 'wt-app-handoff' && cookie.value)).toBe(false);

        // 1) 정상 흐름
        const first = await pkce(webview);
        const code = await browserLogin(browser, name, first.challenge);
        await expectSignedOut(browserContext, browser);
        await browser.goto('/login');
        await expect(browser.getByLabel('개발용 로그인 · 이름이 같으면 같은 사람')).toBeVisible();

        expect(await exchange(webview, { code, verifier: first.verifier })).toEqual({ status: 200, body: { ok: true, callbackUrl: '/dashboard' } });
        const session = (await webviewContext.cookies()).find((cookie) => cookie.name === 'next-auth.session-token');
        expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', secure: false });
        const days = (session!.expires * 1000 - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(29.9);
        expect(days).toBeLessThanOrEqual(30);

        await webview.goto('/dashboard');
        await webview.waitForURL(/\/(welcome|dashboard)/);
        await expect(webview.getByLabel('이름', { exact: true })).toHaveValue(name);
        expect((await (await webview.request.get('/api/auth/session')).json()).user.name).toBe(name);
        await webview.goto('/login');
        await expect(webview.getByText(`${name}님, 로그인되어 있습니다.`)).toBeVisible();

        // 2) 같은 코드를 다시 쓰면 거절
        const replay = await exchange(webview, { code, verifier: first.verifier });
        expect(replay.status).toBe(400);
        expect(replay.body.ok).toBe(false);

        // 3) 새 코드 + 틀린 verifier → 거절, 그리고 코드는 써 버려 맞는 verifier 로도 실패
        const second = await pkce(webview);
        const secondCode = await browserLogin(browser, name, second.challenge);
        await expectSignedOut(browserContext, browser);
        const wrong = await exchange(webview, { code: secondCode, verifier: (await pkce(webview)).verifier });
        expect(wrong.status).toBe(400);
        expect((await exchange(webview, { code: secondCode, verifier: second.verifier })).status).toBe(400);

        // 4) 다른 사이트 Origin 의 교환 요청 → 403 (코드는 쓰이지 않아 앱의 같은 origin 요청은 성공)
        const third = await pkce(webview);
        const thirdCode = await browserLogin(browser, name, third.challenge);
        const crossOrigin = await webviewContext.request.post('/api/auth/app-exchange', {
            headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
            data: { code: thirdCode, verifier: third.verifier },
        });
        expect(crossOrigin.status()).toBe(403);
        const noOrigin = await webviewContext.request.post('/api/auth/app-exchange', { headers: { 'Content-Type': 'application/json' }, data: { code: thirdCode, verifier: third.verifier } });
        expect(noOrigin.status()).toBe(403);
        expect(await exchange(webview, { code: thirdCode, verifier: third.verifier })).toMatchObject({ status: 200, body: { ok: true } });
    } finally {
        await browserContext.close();
        await webviewContext.close();
    }
});
