import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function settled(page: Page) {
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('status', { name: '홈 화면을 불러오는 중' })).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
}

test('first-time teammate finds help, understands terms, and enters a safe practice', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '처음 오셨나요?' })).toBeVisible();
    await page.getByRole('link', { name: '3분 사용 안내 · 연습' }).click();
    await expect(page.getByRole('heading', { name: '처음이어도, 순서대로 해보세요' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '초대받은 팀원', exact: true })).toBeVisible();
    await expect(page.getByText('예배에서 부를 곡과 그 순서를 정리한 목록이에요.')).toBeVisible();
    await page.getByRole('link', { name: '팀원으로 연습', exact: true }).click();
    await expect(page.getByRole('heading', { name: /예배 중/ }).first()).toBeAttached();
    await expect(page.getByText(/을 따라가는 중/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /에게 바로 보내기/ }).first()).toBeVisible();
});

test('core pages render without errors, horizontal overflow or accessibility violations', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/dashboard', '/dashboard/songs', '/dashboard/planning', '/dashboard/team', '/dashboard/songs/library', '/login', '/guide']) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await settled(page);
        await expect(page).toHaveTitle(/Worship Together/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflows`).toBe(true);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(result.violations, `${path}: ${JSON.stringify(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })))}`).toEqual([]);
    }
    expect(errors).toEqual([]);
});

test('mobile menu keeps keyboard focus inside, Escape closes and restores focus', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'Mobile navigation test');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '처음 오셨나요?' })).toBeVisible();
    const opener = page.getByRole('button', { name: '더보기 메뉴 열기' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: '더보기', exact: true });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i++) {
        await page.keyboard.press(i % 3 === 0 ? 'Shift+Tab' : 'Tab');
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    await dialog.getByRole('link', { name: /처음 사용 안내/ }).click();
    await expect(page.getByRole('heading', { name: '처음이어도, 순서대로 해보세요' })).toBeVisible();
    expect(await page.locator('main').evaluate(e => Boolean(e.closest('[inert]')))).toBe(false);
});

test('theme persists, reduced motion and 320px reflow remain usable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/login');
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.goto('/dashboard');
    await settled(page);
    await page.getByRole('button', { name: /^테마 전환/ }).filter({ visible: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await settled(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('install prompt stays above mobile navigation and can be dismissed', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'Mobile navigation overlap regression');
    await page.goto('/dashboard');
    await settled(page);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true })));
    const close = page.getByRole('button', { name: '안내 닫기', exact: true });
    await expect(close).toBeVisible();
    const target = await close.boundingBox();
    const menu = await page.getByRole('button', { name: '더보기 메뉴 열기' }).boundingBox();
    expect(target!.y + target!.height).toBeLessThan(menu!.y);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(close).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('worship_pwa_prompt_dismissed'))).toBeTruthy();
});
