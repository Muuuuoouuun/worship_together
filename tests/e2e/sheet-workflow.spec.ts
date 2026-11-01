import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('sample sheet can change key, turn pages, publish a local copy and export it', async ({ page }) => {
    await page.goto('/dashboard/songs/sheet');
    await page.getByRole('button', { name: '체험용 샘플 악보 불러오기' }).click();
    await expect(page.getByRole('status').filter({ hasText: '체험용 샘플 악보 2장을 불러왔습니다' })).toBeVisible();
    const key = page.getByRole('combobox', { name: '악보 키 고르기' });
    await key.selectOption('D');
    await expect(key).toHaveValue('D');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.getByText('2 / 2p', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '전체 공유본으로 저장', exact: true }).click();
    const exported = page.waitForEvent('download');
    await page.getByRole('button', { name: '공유 파일 내려받기', exact: true }).click();
    const file = await exported;
    expect(file.suggestedFilename()).toMatch(/공유악보\.json$/);
    const data = JSON.parse(await readFile((await file.path())!, 'utf8'));
    expect(data.pages).toHaveLength(2);
    await page.reload();
    await expect(page.getByRole('button', { name: '공유 파일 내려받기', exact: true })).toBeEnabled();
    await expect(key).toHaveValue('D');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
