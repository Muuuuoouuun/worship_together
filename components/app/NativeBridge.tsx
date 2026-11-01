'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/platform';
import { backAction, EXIT_CONFIRM_WINDOW_MS, resolveDeepLink } from '@/lib/nativeNav';

const emptySubscribe = () => () => {};
const EXIT_NOTICE = '한 번 더 누르면 앱을 닫아요';

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

/**
 * Android 앱 셸(Capacitor) 전용 연결. 웹 · 서버 렌더링에서는 아무것도 하지 않습니다.
 * - 뒤로가기 키: 열린 창 닫기 → 이전 화면 → (시작 화면) 두 번 눌러 종료
 * - 앱 링크: 초대 · 세션 · 라이브 · 대시보드 링크를 앱 안에서 엽니다
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

        const showNotice = (text: string) => {
            setNotice(text);
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => setNotice(null), EXIT_CONFIRM_WINDOW_MS);
        };
        const hideNotice = () => {
            clearTimeout(noticeTimer);
            setNotice(null);
        };

        (async () => {
            const { App } = await import('@capacitor/app');
            if (disposed) return;

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

            // 앱이 꺼져 있을 때 링크로 열렸으면 Capacitor 가 이 이벤트를 첫 리스너가 붙을 때까지 보관했다가 넘겨 줍니다.
            keep(await App.addListener('appUrlOpen', ({ url }) => {
                const path = resolveDeepLink(url, appLinkOrigins());
                if (!path) return;
                lastPressAt = null;
                hideNotice();
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
