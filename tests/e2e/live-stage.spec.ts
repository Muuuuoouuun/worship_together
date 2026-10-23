import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const preview = '/session/drafts/live-preview';
const current = (page: Page) => page.locator('[aria-label="섹션"], aside[aria-label="진행"]');

async function openPulse(page: Page, query = 'control=0') {
    await page.goto(`${preview}?${query}`);
    await page.getByRole('button', { name: '펄스', exact: true }).click();
    await expect(page.getByRole('button', { name: '펄스', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => document.fonts.ready);
}

async function accessible(page: Page) {
    const results = await new AxeBuilder({ page }).include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}

test('a follower reads now/next, uses the quiet pulse, and switches views without moving the team', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openPulse(page);
    await expect(page.locator('[data-current-section]')).toHaveText('후렴');
    await expect(current(page).getByText('2절', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/을 따라가는 중/).first()).toBeVisible();
    await expect(page.locator('[data-beat]')).toHaveCount(4);
    await expect(page.locator('[data-beat][data-active="true"]')).toHaveCount(1);
    const first = await page.locator('[data-pulse-count]').textContent();
    await expect.poll(() => page.locator('[data-pulse-count]').textContent()).not.toBe(first);
    expect(await page.locator('[data-pulse-count]').evaluate(e => getComputedStyle(e).transform)).toBe('none');
    expect(await page.locator('main').evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.effect?.getComputedTiming().iterations === Infinity).length)).toBe(0);
    await accessible(page);

    for (const target of await page.getByRole('group', { name: '화면', exact: true }).getByRole('button').all()) {
        const box = await target.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: '악보', exact: true }).click();
    await expect(page.locator('[data-live-view]')).toHaveAttribute('data-live-view', 'score');
    await expect(page.getByText('악보를 여는 중…', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '펄스', exact: true }).click();
    await expect(page.locator('[data-current-section]')).toHaveText('후렴');
    // The stage palette must not change the user's global theme preference.
    expect(await page.locator('html').evaluate(e => e.classList.contains('dark'))).toBe(false);
    expect(errors).toEqual([]);
});

test('a leader advances sections and a 6/8 song shows six beats in two groups', async ({ page }) => {
    await openPulse(page, 'control=1');
    await page.getByRole('button', { name: /^다음 (섹션 )?2절$/ }).click();
    await expect(page.locator('[data-current-section]')).toHaveText('2절');
    const order = page.getByRole('button', { name: /^순서 보기/ });
    if (await order.count()) await order.click();
    await page.getByRole('button', { name: /주님의 은혜.*Key G/ }).click();
    await expect(page.getByRole('img', { name: '68 BPM, 6/8' })).toBeVisible();
    await expect(page.locator('[data-beat]')).toHaveCount(6);
    expect(await page.locator('[data-beat="4"]').getAttribute('stroke-width')).toBe('3.5');
    const observed = new Set<string>();
    // Observe a complete compound bar instead of assuming that six eighth notes are six BPM pulses.
    await expect.poll(async () => {
        observed.add((await page.locator('[data-pulse-count]').textContent())!);
        return observed.size;
    }, { intervals: [80], timeout: 5000 }).toBe(6);
    await expect(page.locator('[data-current-section]')).toHaveText('전주');
    await accessible(page);
});

test('a teammate acknowledges a cue while locked, unlocks by keyboard, and sees connection recovery', async ({ page }) => {
    await openPulse(page);
    await page.getByRole('button', { name: /더보기, 팀/ }).click();
    await page.getByRole('button', { name: '잠그기', exact: true }).click();
    await expect(page.locator('[data-view="score"]')).toHaveCount(1);
    expect(await page.locator('[data-view="score"]').evaluate(e => Boolean(e.closest('[inert]')))).toBe(true);
    await page.getByRole('button', { name: '받은 큐 · 전체', exact: true }).click();
    const ack = page.getByRole('button', { name: /큐 확인$/ });
    await expect(ack).toBeVisible();
    await ack.click();
    await expect(page.locator('[data-island]').getByText('확인함', { exact: true })).toBeVisible();
    await accessible(page);
    const unlock = page.getByRole('button', { name: /^(길게 눌러 잠금 풀기|잠금 해제)$/ });
    await unlock.focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('[data-view="score"]').evaluate(e => Boolean(e.closest('[inert]')))).toBe(false);
    await page.getByRole('button', { name: '연결 끊김', exact: true }).click();
    await expect(page.getByText('연결이 끊겼어요', { exact: true }).first()).toBeVisible();
    await accessible(page);
    await page.getByRole('button', { name: '다시 연결', exact: true }).click();
    await expect(page.getByText('연결이 끊겼어요', { exact: true })).toHaveCount(0);
});

test('missing BPM and song form remain understandable without a fabricated pulse', async ({ page }) => {
    await openPulse(page, 'control=0&scene=noform');
    await expect(page.getByText('박자가 지정되지 않은 곡이에요', { exact: true })).toBeVisible();
    await expect(page.locator('[data-beat]')).toHaveCount(0);
    await expect(current(page).getByText('은혜 아니면', { exact: true }).first()).toBeVisible();
    await accessible(page);
});

test('a quick request reports failure, can be retried, and keeps the stage position', async ({ page }) => {
    await openPulse(page);
    await page.getByRole('button', { name: '다음 큐 실패', exact: true }).click();
    await page.getByRole('button', { name: '모니터 체크 음향에게 바로 보내기', exact: true }).click();
    const retry = page.getByRole('button', { name: '실패 다시 눌러 보내기 · 모니터 체크', exact: true });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.getByRole('button', { name: '보냄 음향에게 · 모니터 체크', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: '모니터 체크 음향에게 바로 보내기', exact: true })).toBeEnabled();
    await expect(page.locator('[data-current-section]')).toHaveText('후렴');
    await accessible(page);
});

test('the now screen is readable with either existing app theme', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'Desktop uses the score view and a persistent progress rail');
    await page.goto(`${preview}?control=0&bar=0`);
    await expect(page.getByRole('article', { name: '지금 섹션' })).toContainText('후렴');
    await accessible(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await accessible(page);
    await page.getByRole('button', { name: '펄스', exact: true }).click();
    await page.getByRole('button', { name: '지금', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('article', { name: '지금 섹션' })).toContainText('후렴');
});

test('small phone, landscape, and compact desktop keep pulse and controls on screen', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'Additional viewport coverage runs once');
    for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
        await page.setViewportSize(viewport);
        await openPulse(page, 'control=1&bar=0');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        const number = await page.locator('[data-pulse-count]').boundingBox();
        expect(number!.height).toBeGreaterThan(24);
        for (const target of [page.getByRole('button', { name: '펄스', exact: true }), page.getByRole('button', { name: /^다음 (섹션 )?2절$/ })]) {
            const box = await target.boundingBox();
            expect(box!.y).toBeGreaterThanOrEqual(0);
            expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        await accessible(page);
    }
});
