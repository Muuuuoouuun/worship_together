'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/platform';
import { backAction, EXIT_CONFIRM_WINDOW_MS, resolveDeepLink } from '@/lib/nativeNav';
import { APP_EXCHANGE_PATH, appCallbackUrl, parseAppReturn, takePendingLogin } from '@/lib/nativeAuth';

const emptySubscribe = () => () => {};
const EXIT_NOTICE = '한 번 더 누르면 앱을 닫아요';
/** 로그인 실패 안내는 읽을 시간을 더 줍니다 */
const LOGIN_NOTICE_MS = 6000;
const LOGIN_EXPIRED = '로그인 요청이 만료되었어요. 다시 로그인해 주세요.';
const LOGIN_FAILED = '로그인을 마치지 못했어요. 다시 로그인해 주세요.';

/** 지금 열린 모달 · 시트가 있는지. 공통 Modal · useSheetDismiss · 라이브 시트 모두 aria-modal 을 씁니다. */
function overlayOpen(): boolean {
    return Array.from(document.querySelectorAll('[aria-modal="true"], dialog[open]')).some((element) => element.getClientRects().length > 0);
}

/** 맨 위 창 닫기. 창들은 모두 document 의 Escape keydown 으로 닫힙니다(useSheetDismiss 는 맨 위 하나만). */
function closeTopOverlay() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
}

/** 이 셸이 앱 안에서 열 앱 링크 origin: 지금 불러온 서버 + (다르면) 빌드 때 설정한 앱 링크 호스트 */
function appLinkOrigins(): string[] {
    const configured = process.env.NEXT_PUBLIC_APP_LINK_HOST?.trim();
    return configured ? [window.location.origin, configured] : [window.location.origin];
}

type ListenerHandle = { remove: () => Promise<void> };

/** sessionStorage 를 못 쓰는 환경(사생활 보호 설정 등)에서는 verifier 가 없는 것으로 봅니다. */
function takeVerifier(): string | null {
    try {
        return takePendingLogin(window.sessionStorage);
    } catch {
        return null;
    }
}

/**
 * 앱 로그인 복귀(/auth/app-return?code=…): 시스템 브라우저를 닫고, 이 WebView 가 보관한 verifier 와 코드를 같은 origin 으로 교환합니다.
 * 성공하면 서버가 이 WebView 에 세션 쿠키를 설정하므로, 새로 불러와(router.push 가 아니라) 서버 화면이 로그인 상태로 그려지게 합니다.
 * 실패 메시지(한국어)를 돌려줍니다.
 */
async function completeNativeLogin(code: string | null): Promise<string | null> {
    const verifier = takeVerifier();
    void import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => { /* 이미 닫혔거나 지원하지 않음 */ });
    if (!code || !verifier) return LOGIN_EXPIRED;
    try {
        const response = await fetch(APP_EXCHANGE_PATH, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, verifier }),
        });
        const body = await response.json().catch(() => null) as { ok?: boolean; callbackUrl?: unknown; error?: unknown } | null;
        if (response.ok && body?.ok) {
            window.location.replace(appCallbackUrl(body.callbackUrl));
            return null;
        }
        return typeof body?.error === 'string' && /[가-힣]/.test(body.error) ? body.error : LOGIN_FAILED;
    } catch {
        return LOGIN_FAILED;
    }
}

/**
 * 앱 셸(Capacitor Android · iOS) 전용 연결. 웹 · 서버 렌더링에서는 아무것도 하지 않습니다.
 * - 뒤로가기 키(Android 만): 열린 창 닫기 → 이전 화면 → (시작 화면) 두 번 눌러 종료
 * - 앱 링크(Android App Links · iOS 유니버설 링크): 초대 · 세션 · 라이브 · 대시보드 링크를 앱 안에서 엽니다
 * - 앱 로그인 복귀(/auth/app-return): 시스템 브라우저에서 받은 일회용 코드를 세션으로 바꿉니다(lib/nativeAuth.ts)
 * @capacitor/app 은 네이티브일 때만 동적으로 불러와 웹 번들과 서버 렌더링에 들어가지 않게 합니다.
 */
export default function NativeBridge() {
    const native = useSyncExternalStore(emptySubscribe, isNativeApp, () => false);
    const router = useRouter();
    const routerRef = useRef(router);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        routerRef.current = router;
    });

    useEffect(() => {
        if (!native) return;
        let disposed = false;
        let lastPressAt: number | null = null;
        let noticeTimer: ReturnType<typeof setTimeout> | undefined;
        const handles: ListenerHandle[] = [];
        const keep = (handle: ListenerHandle) => {
            if (disposed) void handle.remove();
            else handles.push(handle);
        };

        const showNotice = (text: string, duration = EXIT_CONFIRM_WINDOW_MS) => {
            setNotice(text);
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => setNotice(null), duration);
        };
        const hideNotice = () => {
            clearTimeout(noticeTimer);
            setNotice(null);
        };

        (async () => {
            const [{ App }, { Capacitor }] = await Promise.all([import('@capacitor/app'), import('@capacitor/core')]);
            if (disposed) return;

            // iOS 에는 뒤로가기 키가 없어 backButton 이벤트가 오지 않습니다. Android 에서만 붙입니다.
            if (Capacitor.getPlatform() === 'android') {
                keep(await App.addListener('backButton', ({ canGoBack }) => {
                    const now = Date.now();
                    const action = backAction({ overlayOpen: overlayOpen(), canGoBack, pathname: window.location.pathname, lastPressAt, now });
                    lastPressAt = action.type === 'confirm-exit' ? now : null;
                    // '한 번 더' 안내는 바로 다음 누름에만 해당합니다. 다른 동작을 하면 지웁니다.
                    if (action.type !== 'confirm-exit') hideNotice();
                    switch (action.type) {
                        case 'close-overlay':
                            closeTopOverlay();
                            break;
                        case 'history-back':
                            window.history.back();
                            break;
                        case 'go-home':
                            routerRef.current.replace(action.href);
                            break;
                        case 'confirm-exit':
                            showNotice(EXIT_NOTICE);
                            break;
                        case 'exit':
                            void App.exitApp();
                            break;
                    }
                }));
            }

            // 앱이 꺼져 있을 때 링크로 열렸으면 Capacitor 가 이 이벤트를 첫 리스너가 붙을 때까지 보관했다가 넘겨 줍니다.
            keep(await App.addListener('appUrlOpen', ({ url }) => {
                const path = resolveDeepLink(url, appLinkOrigins());
                if (!path) return;
                lastPressAt = null;
                hideNotice();
                // 로그인 복귀는 화면 이동이 아니라 코드 교환입니다. (브라우저에서 열린 /auth/app-return 화면은 교환하지 않습니다.)
                const appReturn = parseAppReturn(path);
                if (appReturn) {
                    void completeNativeLogin(appReturn.code).then((failure) => {
                        if (failure && !disposed) showNotice(failure, LOGIN_NOTICE_MS);
                    });
                    return;
                }
                routerRef.current.push(path);
            }));
        })().catch((error) => {
            console.warn('Native bridge setup failed:', error);
        });

        return () => {
            disposed = true;
            clearTimeout(noticeTimer);
            handles.splice(0).forEach((handle) => void handle.remove());
        };
    }, [native]);

    if (!native) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-[60] flex justify-center lg:bottom-6"
        >
            {notice ? (
                <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg animate-in fade-in duration-150 motion-reduce:animate-none">
                    {notice}
                </p>
            ) : null}
        </div>
    );
}
