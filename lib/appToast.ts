/*
 * 앱 알림(토스트). 어느 화면에서든 showAppToast 로 띄우면 공통 틀의 AppToaster 가 같은 모양으로 보여 줍니다.
 * (예배 중 화면은 자기 알림 자리 — 큐 아일랜드 · 아래 카드 줄 — 를 따로 씁니다.)
 */

export type AppToastTone = 'info' | 'success' | 'warning' | 'danger' | 'live';

export interface AppToastInput {
    /** 같은 id(또는 group)의 새 알림은 이전 것을 대신합니다 */
    id?: string;
    group?: string;
    tone?: AppToastTone;
    title: string;
    body?: string;
    /** 버튼 하나 — 링크 */
    action?: { label: string; href: string };
    /** 자동으로 사라질 때까지 ms (기본 4.5초). null 이면 닫을 때까지 */
    ttl?: number | null;
}

export const APP_TOAST_EVENT = 'worship:app-toast';

export function showAppToast(input: AppToastInput) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<AppToastInput>(APP_TOAST_EVENT, { detail: input }));
}
