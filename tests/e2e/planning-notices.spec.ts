import { test, expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

/*
 * 일정·알림 시나리오 (팀원이 불참을 응답하면 인도자와 본인 화면에 무엇이 보이는가, 남의 팀 주소로 들어가면 무엇이 막히는가).
 * 인도자 · 팀원 · 다른 팀의 인도자, 세 사람이 각자 브라우저로 한 팀씩 실제로 만들어 확인합니다.
 * 여러 사람이 함께하는 흐름이라 team-journey 처럼 태블릿 프로젝트에서는 건너뜁니다 (playwright.config.ts).
 */

type Actor = { context: BrowserContext; page: Page };

const LOGIN_LABEL = '개발용 로그인 · 이름이 같으면 같은 사람';
const dayPlus = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function openActor(browser: Browser, info: TestInfo, errors: string[]): Promise<Actor> {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use;
    const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
}

async function login(page: Page, name: string) {
    await page.goto('/login');
    await page.getByLabel(LOGIN_LABEL).fill(name);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL(/\/(welcome|dashboard)/);
}

/** 처음 로그인한 사람이 이름 확인 후 새 팀을 만들어 팀 화면까지 */
async function createTeam(page: Page, name: string, teamName: string) {
    await login(page, name);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: /새 팀 만들기/ }).click();
    await page.getByLabel('팀 이름', { exact: true }).fill(teamName);
    await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
    await page.waitForURL(/dashboard\/team/);
}

/** 일정·요청 화면에서 직접 일정을 만들고 그 카드를 돌려줍니다. */
async function createEvent(page: Page, title: string, day: string) {
    await page.goto('/dashboard/planning');
    await page.getByRole('button', { name: '직접 일정 만들기', exact: true }).click();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: '일정 만들기', exact: true }) });
    await form.getByLabel('일정 종류').selectOption('worship');
    await form.getByLabel('제목 (필수)').fill(title);
    await form.getByLabel('시작 (필수)').fill(`${day}T11:00`);
    await form.getByLabel('종료 (필수)').fill(`${day}T12:00`);
    await form.getByRole('button', { name: '일정 만들기', exact: true }).click();
    const card = page.getByRole('article', { name: title, exact: true });
    await expect(card).toBeVisible();
    return card;
}

/** 이 브라우저가 알고 있는 첫 온라인 팀의 id (팀 자료 동기화가 채웁니다) */
async function firstTeamId(page: Page) {
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('worship:online-teams:v1') ?? '[]') as string[])[0] ?? '')).not.toBe('');
    return page.evaluate(() => (JSON.parse(localStorage.getItem('worship:online-teams:v1') ?? '[]') as string[])[0]);
}

test.describe('불참 응답과 비소속 팀 주소', () => {
    test.describe.configure({ mode: 'serial', timeout: 120_000 });

    const errors: string[] = [];
    const suffix = Date.now().toString(36);
    const names = { leader: `인도자 ${suffix}`, member: `팀원 ${suffix}`, outsider: `다른 팀 인도자 ${suffix}` };
    const teamName = `함께 섬김 ${suffix}`;
    const eventTitle = `주일 예배 ${suffix}`;
    const foreignTitle = `비공개 연습 ${suffix}`;
    const foreignTeamName = `다른 교회팀 ${suffix}`;
    let leader: Actor, member: Actor, outsider: Actor;
    let teamId = '', foreignTeamId = '';

    test.beforeAll(async ({ browser }, info) => {
        test.setTimeout(180_000);
        [leader, member, outsider] = await Promise.all([openActor(browser, info, errors), openActor(browser, info, errors), openActor(browser, info, errors)]);

        // 인도자: 팀 만들기 → 초대 링크
        await createTeam(leader.page, names.leader, teamName);
        await leader.page.getByRole('button', { name: '초대 링크 만들기', exact: true }).click();
        const invite = await leader.page.getByRole('textbox', { name: '온라인 팀 초대 링크' }).inputValue();

        // 팀원: 초대 링크 → 로그인 → 참여
        await member.page.goto(invite);
        await member.page.getByRole('link', { name: /로그인/ }).click();
        await member.page.getByLabel(LOGIN_LABEL).fill(names.member);
        await member.page.getByRole('button', { name: '로그인', exact: true }).click();
        await member.page.waitForURL(/\/invite\//);
        await member.page.getByRole('button', { name: '이 예배팀에 참여하기' }).click();
        await member.page.waitForURL(/\/dashboard/);

        // 인도자: 보컬 역할을 정하고 일정에 팀원을 배정
        const role = leader.page.getByRole('combobox', { name: `${names.member} 담당 역할` });
        await role.selectOption('vocal');
        await expect(role).toBeEnabled();
        const card = await createEvent(leader.page, eventTitle, dayPlus(7));
        await card.getByText('역할·담당자 추가', { exact: true }).click();
        const slotForm = card.locator('form').filter({ has: leader.page.getByRole('button', { name: '역할 추가', exact: true }) });
        await slotForm.getByLabel('역할', { exact: true }).selectOption('vocal');
        await slotForm.getByLabel('담당자', { exact: true }).selectOption({ label: `${names.member} · 보컬` });
        await slotForm.getByRole('button', { name: '역할 추가', exact: true }).click();
        await expect(leader.page.getByText('변경 사항을 저장했습니다.', { exact: true })).toBeVisible();

        // 다른 팀: 팀원이 속하지 않은 팀과 그 팀의 일정
        await createTeam(outsider.page, names.outsider, foreignTeamName);
        await createEvent(outsider.page, foreignTitle, dayPlus(9));
        foreignTeamId = await firstTeamId(outsider.page);

        // 팀원 화면에서 자기 팀 id 와 배정 확인
        await member.page.goto('/dashboard/planning');
        await expect(member.page.getByRole('region', { name: '나의 다가오는 섬김과 참석 응답' }).getByText(eventTitle)).toBeVisible();
        teamId = await firstTeamId(member.page);
        expect(foreignTeamId).not.toBe(teamId);
    });

    test.afterEach(async ({}, info) => {
        if (info.status === info.expectedStatus) return;
        for (const [who, actor] of Object.entries({ leader, member, outsider })) {
            if (actor) await info.attach(`${who}-after-failure`, { body: await actor.page.screenshot().catch(() => Buffer.alloc(0)), contentType: 'image/png' });
        }
    });

    test.afterAll(async () => {
        await Promise.all([leader, member, outsider].map(actor => actor?.context.close()));
    });

    test('a declined slot reaches the leader as an urgent absence notice without a reload', async () => {
        // 인도자는 일정 화면이 아닌 홈에 있습니다 (일정 화면 밖에서도 배지와 알림 줄이 떠야 합니다).
        // 배지는 0건이면 아무것도 그리지 않으므로, 배지가 처음 읽은 결과(loadPlanningInbox 응답)를 직접 기다려 0건임을 확인합니다.
        const firstInbox = leader.page.waitForResponse(async response => {
            if (response.request().method() !== 'POST' || !response.request().headers()['next-action'] || new URL(response.url()).pathname !== '/dashboard') return false;
            return /"count":\d+,"urgent":\d+/.test(await response.text().catch(() => ''));
        });
        await leader.page.goto('/dashboard');
        const inboxBody = await (await firstInbox).text();
        expect(inboxBody.match(/"count":\d+,"urgent":(\d+)/)?.[1]).toBe('0');
        const badge = leader.page.locator('aside[aria-label="팀 준비 알림"]');
        await expect(badge.getByText(/긴급 미확인/)).toHaveCount(0);
        // 팀 소식 흐름은 연결한 뒤의 소식만 보내므로, 인도자 화면이 연결된 뒤에 팀원이 응답합니다.
        await expect(leader.page.locator('html')).toHaveAttribute('data-team-stream', 'online');

        const duty = member.page.getByRole('region', { name: '나의 다가오는 섬김과 참석 응답' });
        await member.page.goto('/dashboard/planning');
        await duty.getByRole('button', { name: '참석 확정 (1클릭)' }).click();
        await expect(duty.getByText('모두 확정됨', { exact: true })).toBeVisible();

        await duty.getByRole('button', { name: '참석 상태 변경' }).click();
        await duty.getByRole('button', { name: '개인 사정', exact: true }).click();
        await expect(duty.getByText('불참 응답함', { exact: true })).toBeVisible();

        // 15초 주기 확인을 기다리지 않고, 소식 흐름으로 바로 배지가 바뀝니다.
        await expect(badge.getByText('긴급 미확인 1건')).toBeVisible({ timeout: 10_000 });
        await expect(leader.page.getByText('결석 · 대체 인원이 필요해요').first()).toBeVisible();

        await badge.getByRole('link').click();
        await leader.page.waitForURL(/\/dashboard\/planning\?.*inbox=1/);
        const inbox = leader.page.locator('details').filter({ has: leader.page.getByText('내 알림', { exact: true }) });
        await expect(inbox.getByText('긴급 확인 필요')).toBeVisible();
        const urgent = inbox.getByRole('listitem').filter({ hasText: '결석 · 대체 인원이 필요해요' });
        await expect(urgent).toContainText('긴급');
        await expect(urgent).toContainText('대체');
        await expect(urgent).toContainText(eventTitle);
        await expect(urgent).toContainText('미확인');
        expect(errors).toEqual([]);
    });

    test('after declining, "나의 다가오는 섬김" shows 불참 응답함 and never says 확정됨', async () => {
        const duty = member.page.getByRole('region', { name: '나의 다가오는 섬김과 참석 응답' });
        // 저장된 상태를 서버에서 새로 읽어도 같아야 합니다.
        await member.page.reload();
        await expect(duty.getByText(eventTitle)).toBeVisible();
        await expect(duty.getByText('불참 응답함', { exact: true })).toBeVisible();
        await expect(duty.getByText(/불참으로 응답한 사역입니다/)).toBeVisible();
        await expect(duty.getByText('불참', { exact: true })).toBeVisible();
        await expect(duty).not.toContainText('확정됨');
        await expect(duty.getByRole('button', { name: '참석 확정 (1클릭)' })).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('opening another team\'s planning URL shows the fallback notice, swaps the team id and leaks nothing', async () => {
        for (const requested of [foreignTeamId, `missing-${suffix}`]) {
            const response = await member.page.goto(`/dashboard/planning?team=${requested}`);
            expect(response?.status()).toBe(200);
            await expect(member.page.getByTestId('team-fallback-notice')).toContainText('접근 권한이 없어');
            await expect(member.page).toHaveURL(url => new URL(url).searchParams.get('team') === teamId);
            // 대신 보여 주는 것은 내 팀의 일정입니다.
            await expect(member.page.getByRole('article', { name: eventTitle, exact: true })).toBeVisible();
            expect(await member.page.locator('body').innerText()).not.toContain(foreignTitle);
            expect(await member.page.content()).not.toContain(foreignTitle);

            // 서버가 처음 보낸 문서(내장된 RSC 자료 포함)에도 남의 팀 일정과 팀 이름이 없어야 합니다.
            const html = await (await member.context.request.get(`/dashboard/planning?team=${requested}`)).text();
            expect(html).toContain(teamName); // 서버가 그린 내 팀 정보는 들어 있습니다 (대조)
            expect(html).not.toContain(foreignTitle);
            expect(html).not.toContain(foreignTeamName);
        }
        // 안내를 닫을 수 있고, 닫아도 일정은 그대로입니다.
        await member.page.goto(`/dashboard/planning?team=${foreignTeamId}`);
        await member.page.getByRole('button', { name: '안내 닫기', exact: true }).click();
        await expect(member.page.getByTestId('team-fallback-notice')).toHaveCount(0);
        await expect(member.page.getByRole('article', { name: eventTitle, exact: true })).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('a signed-in non-member cannot read another team through the API or the planning server action', async () => {
        const api = member.context.request;
        // 같은 요청이 내 팀에는 통하는지 먼저 확인해, 아래 거절이 요청 모양 때문이 아님을 보입니다.
        expect((await api.get(`/api/teams/${teamId}/docs`)).status()).toBe(200);
        for (const path of ['docs', 'live', 'stream']) {
            const denied = await api.get(`/api/teams/${foreignTeamId}/${path}`);
            expect(denied.status(), path).toBe(403);
            const body = await denied.text();
            expect(body).not.toContain(foreignTitle);
            expect(body).not.toContain(foreignTeamName);
        }
        expect((await api.put(`/api/teams/${foreignTeamId}/docs`, { data: { key: 'x', json: {}, baseVersion: 0 } })).status()).toBe(403);
        expect((await api.post(`/api/teams/${foreignTeamId}/live`, { data: { snapshot: {} } })).status()).toBe(403);

        // 일정 화면이 스스로 부르는 서버 동작(loadPlanningContext)을 잡아, 팀 id 만 남의 것으로 바꿔 다시 보냅니다.
        const captured = new Promise<{ url: string; headers: Record<string, string>; body: string }>(resolve => {
            member.page.on('request', request => {
                const headers = request.headers();
                const body = request.postData() ?? '';
                if (request.method() === 'POST' && headers['next-action'] && body.includes(teamId)) resolve({ url: request.url(), headers, body });
            });
        });
        await member.page.goto('/dashboard/planning');
        const action = await captured;
        const replay = (id: string) => member.context.request.post(action.url, {
            headers: { 'next-action': action.headers['next-action'], 'content-type': action.headers['content-type'] ?? 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: new URL(action.url).origin },
            data: action.body.replaceAll(teamId, id),
        });
        const own = await (await replay(teamId)).text();
        expect(own).toContain(eventTitle);
        const foreign = await (await replay(foreignTeamId)).text();
        expect(foreign).toContain('접근할 수 없습니다');
        expect(foreign).not.toContain(foreignTitle);
        expect(foreign).not.toContain(eventTitle);
        expect(errors).toEqual([]);
    });
});
