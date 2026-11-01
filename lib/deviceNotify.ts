/*
 * 기기 알림. 앱 화면을 보고 있지 않을 때(다른 앱 · 다른 탭 · 화면 꺼짐 직전) 예배 시작 · 받은 큐를 시스템 알림으로 띄웁니다.
 * 화면을 보고 있을 때는 앱 안 알림(토스트 · 큐 아일랜드)만 씁니다.
 * 앱을 완전히 닫은 뒤에 오는 푸시는 아직 지원하지 않습니다.
 */

export type DeviceNotifyState = NotificationPermission | 'unsupported';

export function deviceNotifyState(): DeviceNotifyState {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

export async function requestDeviceNotify(): Promise<DeviceNotifyState> {
    if (deviceNotifyState() === 'unsupported') return 'unsupported';
    try { return await Notification.requestPermission(); } catch { return deviceNotifyState(); }
}

export async function notifyDevice({ title, body, tag, url }: { title: string; body?: string; tag: string; url: string }) {
    if (deviceNotifyState() !== 'granted' || document.visibilityState === 'visible') return;
    const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url } };
    try {
        // 안드로이드 크롬은 서비스 워커로만 알림을 띄울 수 있습니다.
        const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        if (registration) {
            await registration.showNotification(title, options);
            return;
        }
        const notification = new Notification(title, options);
        notification.onclick = () => {
            window.focus();
            if (window.location.pathname !== url) window.location.assign(url);
            notification.close();
        };
    } catch { /* 알림을 띄울 수 없는 환경 — 앱 안 알림은 그대로 */ }
}
