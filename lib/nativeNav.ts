/*
 * Android 앱 셸(Capacitor)의 뒤로가기 키 · 앱 링크를 어떻게 처리할지 정하는 순수 함수.
 * 플러그인 연결과 화면 처리는 components/app/NativeBridge.tsx 가 맡습니다.
 */

/** 뒤로가기 키로 이전 화면 대신 '한 번 더 누르면 닫혀요' 안내를 띄우는 시작 화면 */
export const NATIVE_ROOT_PATHS: readonly string[] = ['/', '/dashboard', '/login'];
/** 시작 화면이 아닌데 돌아갈 기록이 없을 때(앱 링크로 바로 연 화면 등) 보낼 곳 */
export const NATIVE_HOME_PATH = '/dashboard';
/** 첫 누름 뒤 이 시간 안에 한 번 더 누르면 앱을 닫습니다 */
export const EXIT_CONFIRM_WINDOW_MS = 2000;
/**
 * 앱 링크로 앱 안에서 열 수 있는 경로. android/app/src/main/AndroidManifest.xml 의 pathPrefix 와 맞춥니다.
 * '/' 로 끝나지 않는 항목은 그 경로 자체와 그 아래 경로만 허용합니다(/dashboard, /dashboard/... — /dashboardx 는 아님).
 */
export const APP_LINK_PATH_PREFIXES: readonly string[] = ['/invite/', '/session/', '/live/', '/dashboard'];

export type BackAction =
    | { type: 'close-overlay' }
    | { type: 'history-back' }
    | { type: 'go-home'; href: string }
    | { type: 'confirm-exit' }
    | { type: 'exit' };

export interface BackState {
    /** 모달 · 시트(aria-modal)가 열려 있는지 */
    overlayOpen: boolean;
    /** WebView 에 돌아갈 기록이 있는지 (Capacitor backButton 이벤트의 canGoBack) */
    canGoBack: boolean;
    pathname: string;
    /** 시작 화면에서 직전에 '한 번 더' 안내를 띄운 시각. 없으면 null */
    lastPressAt: number | null;
    now: number;
}

function trimTrailingSlash(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
}

export function isNativeRootPath(pathname: string): boolean {
    return NATIVE_ROOT_PATHS.includes(trimTrailingSlash(pathname));
}

/**
 * 뒤로가기 키 한 번에 할 일.
 * 1) 열린 창이 있으면 그 창만 닫습니다.
 * 2) 시작 화면(/dashboard · /login)에서는 돌아갈 기록이 있어도 이전 화면으로 가지 않고,
 *    첫 누름은 안내, 2초 안의 두 번째 누름은 앱 종료입니다. (로그인 · 로그아웃 뒤의 기록은 대부분
 *    로그인 화면이나 다시 넘겨 주는 주소라서, 거기로 돌아가면 같은 화면을 맴돌게 됩니다.)
 * 3) 그 밖의 화면은 기록이 있으면 이전 화면, 없으면 홈으로 갑니다.
 */
export function backAction({ overlayOpen, canGoBack, pathname, lastPressAt, now }: BackState): BackAction {
    if (overlayOpen) return { type: 'close-overlay' };
    if (isNativeRootPath(pathname)) {
        const elapsed = lastPressAt === null ? Number.POSITIVE_INFINITY : now - lastPressAt;
        return elapsed >= 0 && elapsed <= EXIT_CONFIRM_WINDOW_MS ? { type: 'exit' } : { type: 'confirm-exit' };
    }
    if (canGoBack) return { type: 'history-back' };
    return { type: 'go-home', href: NATIVE_HOME_PATH };
}

/** 'https://app.example.com', 'app.example.com' (https 로 봄) 을 같은 모양의 origin 으로 맞춥니다 */
export function normalizeOrigin(value: string): string | null {
    const raw = value.trim();
    if (!raw) return null;
    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return url.origin;
    } catch {
        return null;
    }
}

function matchesPrefix(pathname: string, prefix: string): boolean {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix) && pathname.length > prefix.length;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 앱 링크(appUrlOpen)로 받은 주소를 앱 안에서 열 경로로 바꿉니다. 열면 안 되는 주소는 null.
 * - http(s) 이고, 허용한 origin(지금 불러온 서버 · 설정한 앱 링크 호스트)과 같아야 합니다.
 * - 경로가 APP_LINK_PATH_PREFIXES 중 하나여야 합니다. (내보낸 Activity 라 다른 앱이 아무 주소나 보낼 수 있으므로
 *   intent-filter 와 같은 범위만 받습니다. '//다른호스트' 처럼 다른 사이트로 읽힐 경로도 여기서 걸러집니다.)
 */
export function resolveDeepLink(
    url: string,
    allowedOrigins: readonly string[],
    pathPrefixes: readonly string[] = APP_LINK_PATH_PREFIXES,
): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    const allowed = new Set(allowedOrigins.map(normalizeOrigin).filter((origin): origin is string => origin !== null));
    if (!allowed.has(parsed.origin)) return null;
    if (!pathPrefixes.some((prefix) => matchesPrefix(parsed.pathname, prefix))) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
