/**
 * 모바일 스모크: 핵심 6개 경로를 Pixel 7 / iPhone 14 Pro Max 에뮬레이션으로 열어
 *  - 가로 넘침(horizontal overflow), console error, pageerror 가 있으면 실패
 *  - 터치 대상 40px 미만 개수는 보고만 합니다 (실패 아님)
 *
 * 환경변수: E2E_BASE_URL (기본 http://localhost:4000), E2E_OUT (기본 <OS 임시폴더>/worship-together-e2e; 저장소 안은 비권장), NEXTAUTH_SECRET (없으면 .env.local)
 * 읽기만 하므로 DB 를 바꾸지 않습니다. 로그인 상태로 보기 위해 테스트 세션 쿠키를 발급해 씁니다.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mintSessionCookie, sessionCookieFor } = require('./lib/session.cjs');

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const OUT = path.resolve(process.env.E2E_OUT || path.join(os.tmpdir(), 'worship-together-e2e'));
const SID = '00000000-0000-0000-0000-000000000201';
const ROUTES = [
    '/dashboard',
    '/dashboard/songs',
    '/dashboard/planning',
    '/dashboard/team',
    `/session/${SID}`,
    `/session/${SID}/team`,
];
const DEVICES = { 'Pixel 7': devices['Pixel 7'], 'iPhone 14 Pro Max': devices['iPhone 14 Pro Max'] };
// 개발 서버 잡음(HMR, RSC prefetch 취소 등)은 앱 오류가 아니므로 제외
const IGNORE = /_rsc|favicon|HMR|hot-update|webpack|Fast Refresh|Download the React DevTools/i;

/** 페이지 안에서 실행: 가로 넘침과 작은 터치 대상을 측정 */
function audit() {
    const W = window.innerWidth;
    const vis = (e) => { try { return e.checkVisibility({ checkVisibilityCSS: true }); } catch { return true; } };
    const label = (e) => ((e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.getAttribute('title') || e.value || '') + '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const overflow = document.documentElement.scrollWidth > W + 1;
    const offenders = [];
    for (const e of document.querySelectorAll('body *')) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.right <= W + 1 || !vis(e)) continue;
        let clipped = false; // 가로 스크롤러/잘림 컨테이너 안이면 페이지 넘침이 아님
        for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
            const cs = getComputedStyle(a);
            if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); if (ar.right <= W + 1 || a === document.body) { clipped = true; break; } }
            if (cs.position === 'fixed') break;
        }
        if (!clipped) offenders.push({ el: `${e.tagName.toLowerCase()} "${label(e)}"`, over: Math.round(r.right - W) });
    }
    offenders.sort((a, b) => b.over - a.over);
    let small = 0; const smallTop = [];
    for (const e of document.querySelectorAll('button, a[href], [role=button], input, select, [role=tab]')) {
        if (!vis(e) || e.closest('[aria-hidden=true]')) continue;
        if (e.tagName === 'INPUT' && ['hidden', 'file'].includes(e.type)) continue;
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // sr-only / skip link
        if (r.width < 40 || r.height < 40) { small++; if (smallTop.length < 3) smallTop.push(`${e.tagName.toLowerCase()} "${label(e)}" ${Math.round(r.width)}x${Math.round(r.height)}`); }
    }
    return { overflow, scrollW: document.documentElement.scrollWidth, W, offenders: offenders.slice(0, 3), small, smallTop };
}

(async () => {
    const host = new URL(BASE).hostname;
    fs.mkdirSync(path.join(OUT, 'mobile'), { recursive: true });
    const user = await mintSessionCookie({ provider: 'google', accountId: 'e2e-mobile', name: '모바일 점검' });
    const browser = await chromium.launch();
    const rows = [];
    try {
        for (const [dev, opts] of Object.entries(DEVICES)) {
            const ctx = await browser.newContext({ ...opts, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
            await ctx.addCookies(sessionCookieFor(user, BASE));
            const page = await ctx.newPage();
            page.setDefaultTimeout(30000);
            let errors = [];
            page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });
            page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message || e).slice(0, 160)}`));
            for (const route of ROUTES) {
                const row = { device: dev, route, ok: true, problems: [], small: 0, smallTop: [] };
                try {
                    // 첫 방문은 개발 서버 컴파일 때문에 느릴 수 있어 워밍업 후 다시 측정
                    await page.goto(BASE + route, { waitUntil: 'load', timeout: 120000 });
                    await page.waitForTimeout(800);
                    errors = [];
                    await page.goto(BASE + route, { waitUntil: 'load', timeout: 120000 });
                    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
                    await page.waitForTimeout(1200);
                    const a = await page.evaluate(audit);
                    if (a.overflow) row.problems.push(`가로 넘침 scrollW=${a.scrollW} > ${a.W}: ${a.offenders.map((o) => `${o.el} +${o.over}px`).join(', ')}`);
                    row.problems.push(...errors);
                    row.small = a.small; row.smallTop = a.smallTop;
                    await page.screenshot({ path: path.join(OUT, 'mobile', `${dev.replace(/\s+/g, '-')}${route.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => {});
                } catch (e) {
                    row.problems.push(`navigation: ${String(e.message || e).split('\n')[0]}`);
                }
                row.ok = row.problems.length === 0;
                rows.push(row);
                console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${dev.padEnd(18)} ${route}  small-targets=${row.small}`);
            }
            await ctx.close();
        }
    } finally {
        await browser.close();
    }
    fs.writeFileSync(path.join(OUT, 'mobile-result.json'), JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, host, rows }, null, 2));
    console.log('\ndevice              route                                                         result  small<40px');
    console.log('-'.repeat(100));
    for (const r of rows) console.log(`${r.device.padEnd(19)} ${r.route.padEnd(62)}${(r.ok ? 'PASS' : 'FAIL').padEnd(8)}${r.small}`);
    const failed = rows.filter((r) => !r.ok);
    for (const r of failed) for (const p of r.problems) console.log(`[FAIL] ${r.device} ${r.route}: ${p}`);
    const totalSmall = rows.reduce((n, r) => n + r.small, 0);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed; 터치 대상 40px 미만 합계 ${totalSmall}건 (보고만, 실패 아님)`);
    process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
