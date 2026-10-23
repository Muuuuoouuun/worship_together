import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const external = process.env.E2E_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: process.env.E2E_OUTPUT_DIR ?? join(tmpdir(), 'worship-together-e2e-results'),
    use: {
        baseURL: external ?? 'http://localhost:4100',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } } },
        { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
        { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, launchOptions: { executablePath } }, testIgnore: '**/team-journey.spec.ts' },
        ...(process.env.E2E_WEBKIT === '1' ? [{ name: 'webkit-phone', use: { ...devices['iPhone 13'] }, testIgnore: '**/team-journey.spec.ts' }] : []),
    ],
    webServer: external ? undefined : {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://localhost:4100/login',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
