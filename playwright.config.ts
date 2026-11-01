import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const external = process.env.E2E_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
// 로케일이 비어 있는 Linux(POSIX, 일부 CI · 컨테이너)에서는 Chromium이 한글 다운로드 파일명을 "download"로 바꿔
// 악보 내보내기 검사가 실패합니다. 사용자가 로케일을 정하지 않았을 때만 C.UTF-8을 브라우저에 넘깁니다.
const browserEnv = process.platform === 'linux' && !process.env.LC_ALL && !process.env.LANG ? { ...process.env, LC_ALL: 'C.UTF-8' } : undefined;
const launchOptions = { executablePath, env: browserEnv };
// 여러 사람이 한 팀을 함께 쓰는 긴 흐름은 데스크톱 · 폰에서만 돌립니다 (태블릿은 화면 폭 점검이 목적).
const multiUserFlows = ['**/team-journey.spec.ts', '**/planning-notices.spec.ts'];
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
        actionTimeout: 15_000,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { viewport: { width: 1440, height: 1000 }, launchOptions } },
        { name: 'phone', use: { ...devices['Pixel 7'], launchOptions } },
        { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, launchOptions }, testIgnore: multiUserFlows },
        ...(process.env.E2E_WEBKIT === '1' ? [{ name: 'webkit-phone', use: { ...devices['iPhone 13'], launchOptions: { env: browserEnv } }, testIgnore: multiUserFlows }] : []),
    ],
    webServer: external ? undefined : {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://localhost:4100/login',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
