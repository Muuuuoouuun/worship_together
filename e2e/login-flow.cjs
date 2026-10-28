/**
 * E2E: login -> team -> invite -> planning/notification -> realtime cue -> authz probe
 *
 * 환경변수: E2E_BASE_URL (기본 http://localhost:4000), E2E_OUT (기본 <OS 임시폴더>/worship-together-e2e; 저장소 안은 비권장), NEXTAUTH_SECRET (없으면 .env.local)
 * 주의: 팀을 만들고 지우므로 TEAM_DATABASE_PATH 가 임시 DB 인 `next dev` 서버에서만 실행하세요. 자세한 내용은 e2e/README.md.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mintSessionCookie, sessionCookieFor } = require('./lib/session.cjs');

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const OUT = path.resolve(process.env.E2E_OUT || path.join(os.tmpdir(), 'worship-together-e2e'));
const SHOTS = path.join(OUT, 'shots');
const ESC_BASE = BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DEMO_SESSION = '00000000-0000-0000-0000-000000000201';
const STAGE_URL = `${BASE}/session/${DEMO_SESSION}/team`;
let userA; let userB; // main() 에서 mintSessionCookie 로 채움
const TEAM_NAME = 'E2E 예배팀';
const PRIVATE_TEAM = '비공개팀';
const EVENT_TITLE = 'E2E 주일예배';
const PRIVATE_EVENT = '비공개 일정 E2E';
/** 오늘 기준 n일 뒤의 날짜(YYYY-MM-DD). 일정이 항상 "다가오는" 범위에 들도록 상대 날짜를 씁니다. */
const dayPlus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const WORSHIP_DAY = dayPlus(3);
const PRIVATE_DAY = dayPlus(5);
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

const results = [];
const S = { step: 'init', errors: {} };
const ctx = {}; // shared data across steps

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }
function writeResults() { fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ ranAt: new Date().toISOString(), data: ctx.public ?? {}, steps: results }, null, 2)); }

function watch(page, who) {
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); (S.errors[S.step] ??= []).push(`[${who} console @${page.url().replace(BASE, '')}] ${/hydrat/i.test(t) ? t.slice(0, 4000) : t.slice(0, 400)}`); } });
    page.on('pageerror', (e) => { (S.errors[S.step] ??= []).push(`[${who} pageerror] ${String(e.message || e).slice(0, 400)}`); });
    page.on('dialog', (d) => d.accept().catch(() => {}));
    return page;
}

async function shot(page, name) {
    try { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false, caret: 'initial' }); return `${name}.png`; } catch { return null; }
}

async function step(name, fn) {
    S.step = name; S.pages = []; const t0 = Date.now(); let ok = false; let note = '';
    log('>>', name);
    try { note = (await fn()) ?? ''; ok = true; }
    catch (e) {
        note = `FAIL: ${String(e && e.message || e).split('\n').slice(0, 4).join(' | ')}`;
        for (const [i, p] of (S.pages || []).entries()) await shot(p, `${name}-FAIL${i ? '-' + i : ''}`);
    }
    const r = { step: name, ok, ms: Date.now() - t0, note, consoleErrors: S.errors[name] ?? [] };
    results.push(r); writeResults();
    log(ok ? 'OK ' : 'ERR', name, r.ms + 'ms', note);
    return ok;
}

function cookieFor(u) { return sessionCookieFor(u, BASE); }

async function newCtx(browser, u, viewport) {
    const c = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await c.addCookies(cookieFor(u));
    c.setDefaultTimeout(15000); c.setDefaultNavigationTimeout(60000);
    return c;
}

/** Poll for a locator to become visible; returns ms or null. */
async function pollVisible(locator, maxMs, intervalMs = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
        if (await locator.first().isVisible().catch(() => false)) return Date.now() - t0;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
}

const badge = (page) => page.locator('aside[aria-label="팀 준비 알림"]');

async function main() {
    const host = new URL(BASE).hostname;
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) && process.env.E2E_ALLOW_REMOTE !== '1') {
        throw new Error(`이 플로우는 팀을 만들고 지웁니다. 로컬이 아닌 ${BASE} 에는 실행하지 않습니다 (정말 필요하면 E2E_ALLOW_REMOTE=1).`);
    }
    fs.mkdirSync(SHOTS, { recursive: true });
    // 가짜 OAuth 계정 2개 (google:e2e-leader / google:e2e-keyboard). 앱 쪽 사용자 id 는 sha256 규칙으로 정해집니다.
    userA = await mintSessionCookie({ provider: 'google', accountId: 'e2e-leader', name: '테스트 리더' });
    userB = await mintSessionCookie({ provider: 'google', accountId: 'e2e-keyboard', name: '테스트 건반' });
    const browser = await chromium.launch();
    const cA = await newCtx(browser, userA, MOBILE);
    const cB = await newCtx(browser, userB, MOBILE);
    const pA = watch(await cA.newPage(), 'A');
    const pB = watch(await cB.newPage(), 'B');
    ctx.public = {};

    // 0. cleanup (isolated scratch DB): delete teams A owns from previous runs so unread counts start clean.
    await step('00-cleanup', async () => {
        S.pages = [pA];
        let deleted = 0;
        for (let i = 0; i < 25; i++) {
            await pA.goto(`${BASE}/dashboard/team`);
            await pA.getByRole('heading', { name: '팀·초대' }).first().waitFor();
            const del = pA.getByRole('button', { name: '팀 영구 삭제' });
            if (!(await del.isVisible().catch(() => false))) break;
            await del.click();
            await pA.getByText('팀이 안전하게 삭제되었습니다.').waitFor();
            deleted++;
        }
        return `deleted ${deleted} pre-existing team(s) owned by A`;
    });

    // 1. A creates team
    await step('01-create-team', async () => {
        S.pages = [pA];
        await pA.goto(`${BASE}/dashboard/team`);
        await pA.getByText('아직 참여 중인 팀이 없습니다.').waitFor();
        const details = pA.locator('details', { hasText: '새 예배팀 만들기' });
        if (!(await details.getAttribute('open').then((v) => v !== null))) await details.locator('summary').click();
        await pA.getByLabel('새 팀 명칭').fill(TEAM_NAME);
        await pA.getByRole('button', { name: '팀 만들기', exact: true }).click();
        await pA.getByText('새 팀을 만들었습니다.').waitFor();
        const row = pA.locator('li', { hasText: '테스트 리더' });
        await row.waitFor();
        const rowText = (await row.innerText()).replace(/\s+/g, ' ');
        if (!/관리자/.test(rowText) || !/나/.test(rowText)) throw new Error(`owner row unexpected: ${rowText}`);
        const href = await pA.getByRole('link', { name: '이 팀의 콘티 준비' }).getAttribute('href');
        ctx.teamId = new URL(href, BASE).searchParams.get('team');
        ctx.public.teamId = ctx.teamId;
        const selText = await pA.getByLabel('현재 선택된 팀').locator('option:checked').innerText();
        await shot(pA, '01-team-created');
        return `teamId=${ctx.teamId}; select="${selText}"; owner row="${rowText.slice(0, 80)}"`;
    });

    // 2. A issues invite link
    await step('02-invite-link', async () => {
        S.pages = [pA];
        await pA.getByRole('button', { name: '초대 링크 만들기' }).click();
        const input = pA.getByLabel('온라인 팀 초대 링크');
        await input.waitFor();
        ctx.inviteUrl = await input.inputValue();
        ctx.public.inviteUrl = ctx.inviteUrl;
        await shot(pA, '02-invite-link');
        if (!new RegExp(`^${ESC_BASE}/invite/[0-9a-f]{64}$`).test(ctx.inviteUrl)) throw new Error(`unexpected invite url: ${ctx.inviteUrl}`);
        return `inviteUrl=${ctx.inviteUrl}`;
    });

    // 3. B accepts invite
    await step('03-accept-invite', async () => {
        S.pages = [pB];
        if (!ctx.inviteUrl) throw new Error('no invite url');
        await pB.goto(ctx.inviteUrl);
        await pB.getByRole('heading', { name: TEAM_NAME }).waitFor();
        await pB.getByText('테스트 건반 님으로 참여합니다.').waitFor();
        await shot(pB, '03a-invite-page');
        await pB.getByRole('button', { name: '이 예배팀에 참여하기' }).click();
        await pB.waitForURL(/\/dashboard\/team\?team=/, { timeout: 30000 });
        const landedTeam = new URL(pB.url()).searchParams.get('team');
        const me = pB.locator('li', { hasText: '테스트 건반' });
        await me.waitFor();
        const meText = (await me.innerText()).replace(/\s+/g, ' ');
        await pB.getByText('초대 링크 발급은 팀 관리자 권한이 필요합니다.').waitFor();
        await shot(pB, '03b-B-team-page');
        if (landedTeam !== ctx.teamId) throw new Error(`landed on team ${landedTeam} != ${ctx.teamId}`);
        if (!/팀원/.test(meText)) throw new Error(`B row not 팀원: ${meText}`);
        return `B landed ${pB.url().replace(BASE, '')}; B row="${meText}"`;
    });

    // 4. A sees B, sets role 건반
    await step('04-assign-role', async () => {
        S.pages = [pA];
        await pA.goto(`${BASE}/dashboard/team?team=${ctx.teamId}`);
        const row = pA.locator('li', { hasText: '테스트 건반' });
        await row.waitFor();
        await pA.getByLabel('테스트 건반 담당 역할').selectOption('keyboard');
        await pA.getByText('담당 역할을 저장했습니다.').waitFor();
        await pA.reload();
        await row.waitFor();
        const txt = (await row.innerText()).replace(/\s+/g, ' ');
        await shot(pA, '04-role-keyboard');
        if (!/주 역할: 건반/.test(txt)) throw new Error(`role not persisted: ${txt}`);
        // Pre-open B's dashboard to measure live (non-reload) badge latency in step 6.
        ctx.pBLive = watch(await cB.newPage(), 'B-live');
        await ctx.pBLive.goto(`${BASE}/dashboard`);
        await ctx.pBLive.waitForLoadState('networkidle').catch(() => {});
        const pre = await badge(ctx.pBLive).isVisible().catch(() => false);
        return `B row after reload="${txt}"; B live dashboard pre-opened, badge visible before schedule=${pre}`;
    });

    // 5. A creates schedule + assigns B to 건반
    await step('05-schedule-assign', async () => {
        S.pages = [pA];
        await pA.goto(`${BASE}/dashboard/planning?team=${ctx.teamId}`);
        await pA.getByRole('heading', { name: '연습·예배 일정' }).waitFor();
        await pA.getByText('준비 자료를 불러오는 중…').waitFor({ state: 'hidden' }).catch(() => {});
        await pA.getByRole('button', { name: '직접 일정 만들기' }).click();
        const form = pA.locator('div', { has: pA.getByRole('heading', { name: '직접 일정 만들기' }) }).last();
        await form.getByLabel('일정 종류').selectOption('worship');
        await form.getByLabel('제목 (필수)').fill(EVENT_TITLE);
        await form.getByLabel('시작 (필수)').fill(`${WORSHIP_DAY}T11:00`);
        await form.getByLabel('종료 (필수)').fill(`${WORSHIP_DAY}T12:30`);
        await form.getByLabel('장소').fill('본당');
        await form.getByRole('button', { name: '일정 만들기', exact: true }).click();
        const article = pA.locator(`article[aria-label="${EVENT_TITLE}"]`);
        await article.waitFor();
        ctx.tEventCreated = Date.now();
        await pA.getByText('팀에 저장했습니다.').waitFor();
        // open details if collapsed
        const mgmt = article.locator('summary', { hasText: '일정 관리 (역할 템플릿 · 배정 복사 · 삭제)' });
        if (!(await mgmt.isVisible().catch(() => false))) await article.locator('summary', { hasText: '일정 상세·참석·배정 보기' }).click();
        await mgmt.click();
        await article.locator('summary', { hasText: '역할·담당자 1명 추가' }).click();
        const slotForm = article.locator('form', { has: pA.getByRole('button', { name: '역할 추가' }) });
        await slotForm.getByLabel('역할', { exact: true }).selectOption('keyboard');
        await slotForm.getByLabel('담당자', { exact: true }).selectOption(userB.id);
        await slotForm.getByRole('button', { name: '역할 추가' }).click();
        const slotSelect = article.getByLabel('건반 담당자 선택').first();
        await slotSelect.waitFor();
        ctx.tSlotSaved = Date.now();
        const val = await slotSelect.inputValue();
        await article.scrollIntoViewIfNeeded();
        await shot(pA, '05-schedule-assigned');
        if (val !== userB.id) throw new Error(`slot select value ${val} != B`);
        return `event "${EVENT_TITLE}" (예배, ${WORSHIP_DAY} 11:00-12:30) created; 건반 slot -> 테스트 건반. Commands: event.save (직접 일정 만들기 → 일정 만들기), slot.save (일정 관리 → 역할·담당자 1명 추가 → 역할 추가)`;
    });

    // 6. B badge latency + read
    await step('06-badge-latency-read', async () => {
        S.pages = [pB];
        const notes = [];
        // (a) already-open page, no reload: time since event creation
        if (ctx.pBLive) {
            const ms = await pollVisible(badge(ctx.pBLive), 40000);
            const sinceEvent = ms === null ? null : Date.now() - ctx.tEventCreated;
            ctx.public.badgeLiveSinceEventMs = sinceEvent;
            notes.push(`live page (no reload): badge ${ms === null ? 'NOT shown in 40s' : `shown ${sinceEvent}ms after event creation`}`);
            await shot(ctx.pBLive, '06a-B-live-badge');
            await ctx.pBLive.close();
        }
        // (b) fresh page
        const t0 = Date.now();
        await pB.goto(`${BASE}/dashboard`);
        const b = badge(pB);
        const ms = await pollVisible(b.getByText(/새 알림|긴급/), 40000);
        const fresh = ms === null ? null : Date.now() - t0;
        ctx.public.badgeFreshLoadMs = fresh;
        if (fresh === null) { await shot(pB, '06b-B-dashboard-nobadge'); throw new Error('badge not shown within 40s on fresh /dashboard'); }
        const label = (await b.innerText()).replace(/\s+/g, ' ');
        notes.push(`fresh /dashboard: badge "${label}" after ${fresh}ms (incl. navigation)`);
        await shot(pB, '06b-B-dashboard-badge');
        await b.getByRole('link').click();
        await pB.waitForURL(/\/dashboard\/planning\?team=.*inbox=1/);
        const inboxDetails = pB.locator('details', { hasText: '내 알림' }).first();
        await inboxDetails.getByText(/미확인 [1-9]/).waitFor();
        const inboxText = (await inboxDetails.locator('summary').innerText()).replace(/\s+/g, ' ');
        await shot(pB, '06c-B-inbox');
        await inboxDetails.getByRole('button', { name: '모두 읽음' }).click();
        await pB.getByText('확인 상태를 저장했습니다.').waitFor();
        await inboxDetails.getByText('미확인 0').waitFor();
        const tRead = Date.now();
        const goneHere = await badge(pB).waitFor({ state: 'hidden', timeout: 20000 }).then(() => Date.now() - tRead).catch(() => null);
        ctx.public.badgeHideAfterReadMs = goneHere;
        await pB.goto(`${BASE}/dashboard`);
        await pB.waitForLoadState('networkidle').catch(() => {});
        await pB.waitForTimeout(1500);
        const stillThere = await badge(pB).isVisible().catch(() => false);
        await shot(pB, '06d-B-after-read');
        notes.push(`inbox summary="${inboxText}"; after 모두 읽음: badge hidden on planning page ${goneHere === null ? 'NOT within 20s' : `after ${goneHere}ms`}, on fresh /dashboard=${!stillThere}`);
        if (stillThere) throw new Error('badge still visible after read: ' + notes.join(' ; '));
        return notes.join(' ; ');
    });

    // 7. B RSVP 참석 → 불참; A gets urgent
    await step('07-rsvp-urgent', async () => {
        S.pages = [pB];
        const notes = [];
        await pB.goto(`${BASE}/dashboard/planning?team=${ctx.teamId}`);
        const mine = pB.locator('section[aria-label="나의 다가오는 섬김과 참석 응답"]');
        await mine.getByText(EVENT_TITLE).waitFor();
        const mineText = (await mine.innerText()).replace(/\s+/g, ' ');
        notes.push(`B 나의 다가오는 섬김: ${/건반/.test(mineText) ? '건반 shown' : 'NO 건반'}; ${/응답 필요 1건/.test(mineText) ? '응답 필요 1건' : ''}`);
        await shot(pB, '07a-B-my-duty');
        await mine.getByRole('button', { name: '참석 확정 (1클릭)' }).click();
        await pB.getByText('팀에 저장했습니다.').waitFor();
        await mine.getByText('확정됨').first().waitFor();
        notes.push('참석 확정 OK');
        // A live page opened before 불참 to measure non-reload latency
        const pALive = watch(await cA.newPage(), 'A-live');
        await pALive.goto(`${BASE}/dashboard`);
        await pALive.waitForLoadState('networkidle').catch(() => {});
        await pALive.waitForTimeout(1000);
        const preLabel = (await badge(pALive).innerText().catch(() => '')).replace(/\s+/g, ' ');
        await mine.getByRole('button', { name: '참석 상태 변경' }).click();
        await mine.getByRole('button', { name: '개인 사정' }).click();
        const tAbsent = Date.now();
        await pB.getByText('팀에 저장했습니다.').waitFor();
        await pB.waitForTimeout(500);
        const mineAfter = (await mine.innerText()).replace(/\s+/g, ' ');
        const art = pB.locator(`article[aria-label="${EVENT_TITLE}"]`);
        const slotLi = art.locator('section[aria-label="역할 배정과 참석"] li').first();
        const slotText = (await slotLi.innerText().catch(() => '(slot row not visible)')).replace(/\s+/g, ' ');
        await shot(pB, '07b-B-absent');
        ctx.public.absentShownAsConfirmed = /확정됨/.test(mineAfter) && /불참/.test(slotText);
        notes.push(`불참(개인 사정) saved; B duty card after 불참="${mineAfter.slice(0, 160)}"; event slot row="${slotText.slice(0, 120)}"; A badge before="${preLabel || '(none)'}"`);
        const msLive = await pollVisible(badge(pALive).getByText(/긴급 미확인/), 40000);
        ctx.public.urgentLiveMs = msLive === null ? null : Date.now() - tAbsent;
        notes.push(`A live page: urgent badge ${msLive === null ? 'NOT shown within 40s' : `after ${ctx.public.urgentLiveMs}ms`}`);
        await shot(pALive, '07c-A-live-urgent');
        await pALive.close();
        S.pages = [pA];
        const t0 = Date.now();
        await pA.goto(`${BASE}/dashboard`);
        const ms = await pollVisible(badge(pA).getByText(/긴급 미확인/), 40000);
        ctx.public.urgentFreshMs = ms === null ? null : Date.now() - t0;
        const label = (await badge(pA).innerText().catch(() => '')).replace(/\s+/g, ' ');
        await shot(pA, '07d-A-urgent-badge');
        notes.push(`A fresh /dashboard badge="${label}" after ${ctx.public.urgentFreshMs}ms`);
        if (ms === null) throw new Error('A urgent badge not shown: ' + notes.join(' ; '));
        // open A inbox to capture the urgent notification title
        await badge(pA).getByRole('link').click();
        await pA.waitForURL(/inbox=1/);
        const inbox = pA.locator('details', { hasText: '내 알림' }).first();
        await inbox.getByText('긴급 ·').first().waitFor();
        const urgentItems = (await inbox.locator('li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 120));
        await shot(pA, '07e-A-inbox');
        notes.push(`A inbox items: ${JSON.stringify(urgentItems)}`);
        return notes.join(' ; ');
    });

    // 8. realtime, same browser (2 pages in context A)
    let s1, s2;
    await step('08-realtime-same-browser', async () => {
        s1 = watch(await cA.newPage(), 'A-stage1'); s2 = watch(await cA.newPage(), 'A-stage2');
        await s1.setViewportSize(DESKTOP); await s2.setViewportSize(DESKTOP);
        S.pages = [s1, s2];
        for (const p of [s1, s2]) {
            await p.goto(STAGE_URL);
            const skip = p.getByRole('button', { name: '카운트인 없이 무대 화면 열기' });
            await skip.waitFor({ timeout: 45000 });
            await p.getByRole('button', { name: /예배 시작/ }).waitFor();
            await skip.click();
            await p.getByRole('heading', { name: '즉시 큐' }).waitFor();
        }
        await s1.waitForTimeout(1000);
        const hasMasterToggle = await s1.getByRole('button', { name: /인도|마스터/ }).count();
        await s1.getByLabel('큐 받을 대상').selectOption('everyone');
        const conn = (await s1.getByText(/다른 접속 기기 \d+개/).innerText()).replace(/\s+/g, ' ');
        const msg = '다음 섹션으로 넘어갑니다.';
        const t0 = Date.now();
        await s1.getByTestId('team-action-cue-next-section').click();
        const recvMs = await pollVisible(s2.getByText(msg), 3000, 50);
        ctx.public.cueSameBrowserMs = recvMs;
        const ackMs = await pollVisible(s1.getByText(/1개 기기 수신 · 확인됨/), 3000, 50);
        ctx.public.cueAckMs = ackMs === null ? null : Date.now() - t0;
        const ackText = await s1.getByText(/기기 수신|수신 미확인|전송 중/).first().innerText().catch(() => '');
        await shot(s1, '08a-stage-sender');
        await shot(s2, '08b-stage-receiver');
        const note = `master/인도 toggle buttons found=${hasMasterToggle}; sender status="${conn}"; cue "다음 섹션" -> page2 ${recvMs === null ? 'NOT received in 3s' : `received in ${recvMs}ms`}; sender receipt="${ackText}" ${ackMs === null ? '(no ack in 3s)' : `at ${ctx.public.cueAckMs}ms`}`;
        if (recvMs === null || ackMs === null) throw new Error(note);
        return note;
    });

    // 9. realtime, cross-browser (context B) — expected gap
    await step('09-realtime-cross-browser', async () => {
        if (!s1) throw new Error('no stage page from step 8');
        const sb = watch(await cB.newPage(), 'B-stage');
        await sb.setViewportSize(DESKTOP);
        S.pages = [s1, sb];
        await sb.goto(STAGE_URL);
        const skip = sb.getByRole('button', { name: '카운트인 없이 무대 화면 열기' });
        await skip.waitFor({ timeout: 45000 });
        await skip.click();
        await sb.getByRole('heading', { name: '즉시 큐' }).waitFor();
        await sb.waitForTimeout(1500);
        const bConn = (await sb.getByText(/다른 접속 기기 \d+개/).innerText()).replace(/\s+/g, ' ');
        const msg = '현재 섹션을 한 번 더 반복합니다.';
        await s1.getByTestId('team-action-cue-repeat-section').click();
        const ctrl = await pollVisible(s2.getByText(msg), 3000, 50);
        const bMs = await pollVisible(sb.getByText(msg), 5000, 100);
        const ackText = await s1.getByText(/기기 수신|수신 미확인|전송 중/).first().innerText().catch(() => '');
        await shot(sb, '09-stage-B-other-browser');
        await shot(s1, '09-stage-A-sender');
        ctx.public.crossBrowserReceived = bMs !== null;
        await sb.close();
        return `EXPECTED GAP: B(other context) ${bMs === null ? 'did NOT receive cue within 5s' : `RECEIVED in ${bMs}ms (unexpected)`}; control A page2 ${ctrl === null ? 'not received' : `received in ${ctrl}ms`}; A sender status="${ackText}"; B stage status="${bConn}"`;
    });
    for (const p of [s1, s2]) await p?.close().catch(() => {});

    // 10. authz probe: B -> planning of a team B is not in
    await step('10-authz-probe', async () => {
        S.pages = [pA];
        await pA.goto(`${BASE}/dashboard/team?team=${ctx.teamId}`);
        await pA.locator('details', { hasText: '새 예배팀 만들기' }).locator('summary').click();
        await pA.getByLabel('새 팀 명칭').fill(PRIVATE_TEAM);
        await pA.getByRole('button', { name: '팀 만들기', exact: true }).click();
        await pA.getByText('새 팀을 만들었습니다.').waitFor();
        await pA.waitForTimeout(800);
        const href = await pA.getByRole('link', { name: '이 팀의 콘티 준비' }).getAttribute('href');
        const secondId = new URL(href, BASE).searchParams.get('team');
        if (!secondId || secondId === ctx.teamId) throw new Error(`could not read second team id (${secondId})`);
        ctx.public.secondTeamId = secondId;
        // put a schedule in the private team
        await pA.goto(`${BASE}/dashboard/planning?team=${secondId}`);
        await pA.getByRole('heading', { name: '연습·예배 일정' }).waitFor();
        await pA.getByText('준비 자료를 불러오는 중…').waitFor({ state: 'hidden' }).catch(() => {});
        await pA.getByRole('button', { name: '직접 일정 만들기' }).click();
        const form = pA.locator('div', { has: pA.getByRole('heading', { name: '직접 일정 만들기' }) }).last();
        await form.getByLabel('제목 (필수)').fill(PRIVATE_EVENT);
        await form.getByLabel('시작 (필수)').fill(`${PRIVATE_DAY}T19:00`);
        await form.getByLabel('종료 (필수)').fill(`${PRIVATE_DAY}T21:00`);
        await form.getByRole('button', { name: '일정 만들기', exact: true }).click();
        await pA.locator(`article[aria-label="${PRIVATE_EVENT}"]`).waitFor();
        await shot(pA, '10a-A-private-team-schedule');
        // B navigates there
        S.pages = [pB];
        await pB.goto(`${BASE}/dashboard/planning?team=${secondId}`);
        await pB.getByRole('heading', { name: '연습·예배 일정' }).waitFor();
        await pB.getByText('준비 자료를 불러오는 중…').waitFor({ state: 'hidden' }).catch(() => {});
        await pB.waitForTimeout(1500);
        const body = await pB.locator('body').innerText();
        const picker = await pB.getByLabel('함께 준비할 팀').locator('option:checked').innerText().catch(() => '(no picker)');
        const leakEvent = body.includes(PRIVATE_EVENT);
        const leakTeam = body.includes(PRIVATE_TEAM);
        const denied = /접근할 수 없습니다|권한|access/i.test(body);
        await shot(pB, '10b-B-probe');
        // raw HTML/RSC via page.request with B cookie
        const res = await pB.request.get(`${BASE}/dashboard/planning?team=${secondId}`);
        const html = await res.text();
        const rawLeak = html.includes(PRIVATE_EVENT) || html.includes(PRIVATE_TEAM);
        const note = `secondTeamId=${secondId}; B sees team picker="${picker}"; private event shown=${leakEvent}; private team name shown=${leakTeam}; access-denied text=${denied}; raw HTML (page.request, B cookie) status=${res.status()} contains private data=${rawLeak}`;
        if (leakEvent || rawLeak) throw new Error('DATA LEAK: ' + note);
        return note;
    });

    writeResults();
    await browser.close();
    log('done');
}

function printTable() {
    const pad = (v, n) => String(v).padEnd(n);
    console.log('\n' + pad('step', 30) + pad('result', 8) + pad('ms', 8) + 'console errors');
    console.log('-'.repeat(60));
    for (const r of results) console.log(pad(r.step, 30) + pad(r.ok ? 'PASS' : 'FAIL', 8) + pad(r.ms, 8) + r.consoleErrors.length);
    for (const r of results.filter((x) => !x.ok)) console.log(`\n[FAIL] ${r.step}: ${r.note}`);
    const noisy = results.filter((r) => r.consoleErrors.length);
    for (const r of noisy) for (const e of r.consoleErrors.slice(0, 3)) console.log(`  (console @${r.step}) ${e}`);
    console.log(`\nartifacts: ${OUT}`);
}

main().then(
    () => { printTable(); process.exit(results.length > 0 && results.every((r) => r.ok) ? 0 : 1); },
    (e) => { console.error('FATAL', e); try { writeResults(); } catch {} printTable(); process.exit(1); },
);
