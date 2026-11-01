import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_LINK_PATH_PREFIXES, backAction, EXIT_CONFIRM_WINDOW_MS, isNativeRootPath, normalizeOrigin, resolveDeepLink, type BackState } from '../lib/nativeNav';

const state = (extra: Partial<BackState> = {}): BackState => ({ overlayOpen: false, canGoBack: true, pathname: '/dashboard/songs', lastPressAt: null, now: 10_000, ...extra });

test('back closes an open modal or sheet before anything else', () => {
    assert.deepEqual(backAction(state({ overlayOpen: true })), { type: 'close-overlay' });
    assert.deepEqual(backAction(state({ overlayOpen: true, pathname: '/dashboard', canGoBack: false })), { type: 'close-overlay' }, '시작 화면이어도 창부터 닫음');
    assert.deepEqual(backAction(state({ overlayOpen: true, pathname: '/login', lastPressAt: 9_500 })), { type: 'close-overlay' }, '종료 대기 중이어도 창부터 닫음');
});

test('back on an inner screen goes back in history, or home when there is no history', () => {
    assert.deepEqual(backAction(state()), { type: 'history-back' });
    assert.deepEqual(backAction(state({ pathname: '/live/abc', canGoBack: true })), { type: 'history-back' });
    assert.deepEqual(backAction(state({ pathname: '/invite/token123', canGoBack: false })), { type: 'go-home', href: '/dashboard' }, '앱 링크로 바로 연 화면');
});

test('back on a root screen asks first and exits only on a second press within 2 s', () => {
    for (const pathname of ['/dashboard', '/dashboard/', '/login', '/']) {
        assert.deepEqual(backAction(state({ pathname, canGoBack: true })), { type: 'confirm-exit' }, `${pathname}: 기록이 있어도 이전 화면으로 가지 않음`);
        assert.deepEqual(backAction(state({ pathname, canGoBack: false, lastPressAt: 9_000 })), { type: 'exit' }, `${pathname}: 1초 뒤 두 번째`);
    }
    assert.deepEqual(backAction(state({ pathname: '/dashboard', lastPressAt: 10_000 - EXIT_CONFIRM_WINDOW_MS })), { type: 'exit' }, '경계(정확히 2초)는 종료');
    assert.deepEqual(backAction(state({ pathname: '/dashboard', lastPressAt: 10_000 - EXIT_CONFIRM_WINDOW_MS - 1 })), { type: 'confirm-exit' }, '2초가 지나면 다시 안내');
    assert.deepEqual(backAction(state({ pathname: '/dashboard', lastPressAt: 12_000 })), { type: 'confirm-exit' }, '시계가 뒤로 가면 종료하지 않음');
    assert.equal(isNativeRootPath('/dashboard/songs'), false);
    assert.equal(isNativeRootPath('/loginx'), false);
});

test('normalizeOrigin accepts origins and bare hosts, rejects other schemes', () => {
    assert.equal(normalizeOrigin('https://App.Example.com/'), 'https://app.example.com');
    assert.equal(normalizeOrigin('app.example.com'), 'https://app.example.com');
    assert.equal(normalizeOrigin('http://10.0.2.2:4000'), 'http://10.0.2.2:4000');
    assert.equal(normalizeOrigin('https://app.example.com:443'), 'https://app.example.com');
    assert.equal(normalizeOrigin(''), null);
    assert.equal(normalizeOrigin('javascript://x'), null);
});

test('resolveDeepLink opens same-origin app links in the app', () => {
    const origins = ['http://10.0.2.2:4000', 'worship.example.org'];
    assert.equal(resolveDeepLink('https://worship.example.org/invite/abc?from=kakao#top', origins), '/invite/abc?from=kakao#top');
    assert.equal(resolveDeepLink('http://10.0.2.2:4000/live/s-1', origins), '/live/s-1');
    assert.equal(resolveDeepLink('https://worship.example.org/session/42/team', origins), '/session/42/team');
    assert.equal(resolveDeepLink('https://worship.example.org/dashboard', origins), '/dashboard');
    assert.equal(resolveDeepLink('https://worship.example.org/dashboard/planning?team=t1&inbox=1', origins), '/dashboard/planning?team=t1&inbox=1');
    assert.equal(resolveDeepLink('https://WORSHIP.example.org:443/live/s-1', origins), '/live/s-1', '대소문자 · 기본 포트');
});

test('resolveDeepLink ignores other hosts, schemes and paths outside the intent-filter', () => {
    const origins = ['https://worship.example.org'];
    assert.equal(resolveDeepLink('https://evil.example/invite/abc', origins), null, '다른 호스트');
    assert.equal(resolveDeepLink('http://worship.example.org/invite/abc', origins), null, 'https 만 허용한 호스트에 http');
    assert.equal(resolveDeepLink('https://worship.example.org.evil.example/invite/abc', origins), null);
    assert.equal(resolveDeepLink('https://user:pw@worship.example.org/invite/abc', origins), null, '자격 정보가 붙은 주소');
    assert.equal(resolveDeepLink('javascript:alert(1)', origins), null);
    assert.equal(resolveDeepLink('com.worshiptogether.app://invite/abc', origins), null);
    assert.equal(resolveDeepLink('not a url', origins), null);
    assert.equal(resolveDeepLink('https://worship.example.org//evil.example/x', origins), null, '다른 사이트로 읽힐 경로');
    assert.equal(resolveDeepLink('https://worship.example.org/api/auth/signout', origins), null, 'intent-filter 밖 경로');
    assert.equal(resolveDeepLink('https://worship.example.org/dashboardx', origins), null);
    assert.equal(resolveDeepLink('https://worship.example.org/invite/', origins), null, '토큰 없는 초대');
    assert.equal(resolveDeepLink('https://worship.example.org/invite/abc', []), null, '허용 origin 없음');
});

test('the app-link path list matches the AndroidManifest intent-filter', () => {
    const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const prefixes = [...manifest.matchAll(/android:pathPrefix="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(prefixes, [...APP_LINK_PATH_PREFIXES]);
    assert.match(manifest, /<intent-filter android:autoVerify="true">/);
    assert.match(manifest, /android:host="\$\{appLinkHost\}"/);
});
