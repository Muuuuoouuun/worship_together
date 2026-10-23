import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, name: string) {
    await page.goto('/login');
    await page.getByLabel('개발용 로그인 · 이름이 같으면 같은 사람').fill(name);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL(/\/(welcome|dashboard)/);
}

test('new leader and first-time teammate: invite, shared setlist, permission boundary, live delivery', async ({ page, browser, baseURL }, info) => {
    test.setTimeout(180_000);
    const suffix = Date.now().toString(36);
    const leader = `인도자 ${suffix}`;
    const member = `새 팀원 ${suffix}`;
    const teamName = `처음 함께 ${suffix}`;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, leader);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: /새 팀 만들기/ }).click();
    await page.getByLabel('팀 이름', { exact: true }).fill(teamName);
    await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
    await page.waitForURL(/dashboard\/team/);
    await page.getByRole('button', { name: '초대 링크 만들기', exact: true }).click();
    const invite = await page.getByRole('textbox', { name: '온라인 팀 초대 링크' }).inputValue();

    const other = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    const teammate = await other.newPage();
    teammate.on('pageerror', error => errors.push(error.message));
    try {
        await teammate.goto(invite);
        await teammate.getByRole('link', { name: /로그인/ }).click();
        await teammate.getByLabel('개발용 로그인 · 이름이 같으면 같은 사람').fill(member);
        await teammate.getByRole('button', { name: '로그인', exact: true }).click();
        await teammate.waitForURL(/\/invite\//);
        await teammate.getByRole('button', { name: '이 예배팀에 참여하기' }).click();
        await teammate.waitForURL(/\/dashboard/);
        await expect(page.getByRole('combobox', { name: `${member} 담당 역할` })).toBeVisible();
        await page.getByRole('combobox', { name: `${member} 담당 역할` }).selectOption('vocal');
        await expect(page.getByRole('combobox', { name: `${member} 담당 역할` })).toBeEnabled();

        const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        await page.getByRole('link', { name: '일정·요청', exact: true }).filter({ visible: true }).click();
        await page.getByRole('button', { name: '직접 일정 만들기', exact: true }).click();
        const scheduleForm = page.locator('form').filter({ has: page.getByRole('button', { name: '일정 만들기', exact: true }) });
        await scheduleForm.getByLabel('일정 종류').selectOption('worship');
        await scheduleForm.getByLabel('제목 (필수)').fill('함께 준비할 예배');
        await scheduleForm.getByLabel('시작 (필수)').fill(`${date}T11:00`);
        await scheduleForm.getByLabel('종료 (필수)').fill(`${date}T12:00`);
        await scheduleForm.getByRole('button', { name: '일정 만들기', exact: true }).click();
        const event = page.getByRole('article', { name: '함께 준비할 예배', exact: true });
        await event.getByText('역할·담당자 추가', { exact: true }).click();
        const slotForm = event.locator('form').filter({ has: page.getByRole('button', { name: '역할 추가', exact: true }) });
        await slotForm.getByLabel('역할', { exact: true }).selectOption('vocal');
        await slotForm.getByLabel('담당자', { exact: true }).selectOption({ label: `${member} · 보컬` });
        await slotForm.getByRole('button', { name: '역할 추가', exact: true }).click();
        await expect(page.getByText('변경 사항을 저장했습니다.', { exact: true })).toBeVisible();
        await teammate.getByRole('link', { name: '일정·요청', exact: true }).filter({ visible: true }).click();
        const memberEvent = teammate.getByRole('article', { name: '함께 준비할 예배', exact: true });
        await expect(memberEvent).toBeVisible();
        const details = memberEvent.locator('details').filter({ has: teammate.locator('summary').filter({ hasText: '일정 상세·참석·배정 보기' }) }).first();
        if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
        await memberEvent.getByRole('button', { name: '참석 확정', exact: true }).click();
        await expect(memberEvent.getByText('참석 확정됨', { exact: true })).toBeVisible();
        await expect(event.getByText('1/1').first()).toBeVisible();
        await info.attach('member-rsvp', { body: await teammate.screenshot(), contentType: 'image/png' });

        for (const actor of [page, teammate]) await actor.getByRole('tab', { name: /공지/ }).click();
        await page.getByRole('button', { name: '새 공지', exact: true }).click();
        const announcement = page.locator('form').filter({ has: page.getByRole('button', { name: '공지 올리기', exact: true }) });
        await announcement.getByLabel('제목 (필수)', { exact: true }).fill('처음 오는 팀원 준비 안내');
        await announcement.getByLabel('내용 (필수)', { exact: true }).fill('예배 시작 10분 전에 곡과 악보를 확인해 주세요.');
        await announcement.getByRole('button', { name: '공지 올리기', exact: true }).click();
        const memberNotice = teammate.getByRole('article').filter({ has: teammate.getByRole('heading', { name: '처음 오는 팀원 준비 안내' }) });
        await expect(memberNotice).toBeVisible();
        await memberNotice.getByRole('button', { name: '확인했어요', exact: true }).click();
        await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: '처음 오는 팀원 준비 안내' }) }).getByRole('img', { name: '1명 중 1명 확인' })).toBeVisible();

        for (const actor of [teammate, page]) {
            await actor.getByRole('link', { name: '콘티·악보', exact: true }).filter({ visible: true }).click();
            await actor.getByRole('link', { name: '곡 보관함', exact: true }).click();
        }
        await page.getByText('새 곡 추가하기', { exact: true }).click();
        const songForm = page.locator('form').filter({ has: page.getByRole('button', { name: '곡 저장', exact: true }) });
        for (const [title, key, bpm] of [['처음 함께 찬양', 'G', '72'], ['감사의 노래', 'D', '90']]) {
            await songForm.getByLabel('곡명', { exact: true }).fill(title);
            await songForm.getByLabel('원키', { exact: true }).fill(key);
            await songForm.getByLabel('BPM', { exact: true }).fill(bpm);
            await songForm.getByRole('button', { name: '곡 저장', exact: true }).click();
            await expect(page.getByRole('button', { name: `${title} 삭제` })).toBeVisible();
        }
        await expect(teammate.getByText('처음 함께 찬양', { exact: true })).toBeVisible();
        await expect(teammate.getByRole('button', { name: '처음 함께 찬양 삭제' })).toHaveCount(0);

        await page.getByText('새 콘티 만들기', { exact: true }).click();
        const form = page.locator('form').filter({ has: page.getByLabel('예배 제목', { exact: true }) });
        await form.getByLabel('예배 제목', { exact: true }).fill('처음 함께 예배');
        await form.getByLabel('예배 일시', { exact: true }).fill(`${date}T11:00`);
        await form.getByRole('button', { name: /처음 함께 찬양/ }).click();
        await form.getByRole('button', { name: /감사의 노래/ }).click();
        await form.getByRole('button', { name: '콘티 저장 (2곡)' }).click();
        await expect(page.getByRole('heading', { name: '처음 함께 예배', exact: true })).toBeVisible();
        await expect(teammate.getByRole('heading', { name: '처음 함께 예배', exact: true })).toBeVisible();
        await info.attach('member-shared-setlist', { body: await teammate.screenshot(), contentType: 'image/png' });

        const teamId = await page.evaluate(() => (JSON.parse(localStorage.getItem('worship:online-teams:v1') ?? '[]') as string[])[0]);
        expect(teamId).toBeTruthy();
        // A real signed-in teammate cannot start a session or change a shared document without permission.
        const denied = await other.request.post(`/api/teams/${teamId}/live`, { data: { snapshot: {} } });
        expect(denied.status()).toBe(403);
        const anonymous = await browser.newContext({ baseURL });
        try { expect((await anonymous.request.get(`/api/teams/${teamId}/docs`)).status()).toBe(401); }
        finally { await anonymous.close(); }

        await teammate.getByRole('link', { name: '예배 시작 · 입장', exact: true }).click();
        await expect(teammate.getByText(/시작하면/).first()).toBeVisible();
        await page.getByRole('link', { name: '예배 시작 · 입장', exact: true }).click();
        await page.getByRole('button', { name: '예배 시작', exact: true }).click();
        await page.waitForURL(url => url.pathname.startsWith('/live/') && url.pathname !== '/live/start');
        await teammate.waitForURL(url => url.pathname.startsWith('/live/') && url.pathname !== '/live/start');
        expect(teammate.url()).toBe(page.url());
        const sessionId = new URL(page.url()).pathname.split('/').at(-1)!;
        await expect(teammate.getByRole('heading', { name: '처음 함께 찬양', exact: true })).toBeVisible();
        await expect(teammate.getByText(/을 따라가는 중/).first()).toBeVisible();
        await page.getByRole('button', { name: /한 번 더 큐를 .*바로 보내기/ }).click();
        await expect(teammate.getByText('한 번 더', { exact: true }).first()).toBeVisible();
        await info.attach('member-live-cue', { body: await teammate.screenshot(), contentType: 'image/png' });
        const detail = await (await other.request.get(`/api/live/${sessionId}`)).json();
        expect(JSON.stringify(detail)).toContain('한 번 더');
        expect((await other.request.post(`/api/live/${sessionId}`, { data: { op: 'move', patch: { songIndex: 1 } } })).status()).toBe(403);
        await page.getByRole('button', { name: /더보기, 팀/ }).click();
        await page.getByRole('button', { name: /예배 마치기|예배 마침/ }).click();
        await page.getByRole('button', { name: '마치기', exact: true }).click();
        await expect(teammate.getByRole('heading', { name: /예배.*마|함께.*예배/ }).first()).toBeVisible();
        expect(errors).toEqual([]);
    } finally { await other.close(); }
});
