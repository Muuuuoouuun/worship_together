import type { PlanningTarget } from '../types/planning';

/** 알림을 누르면 갈 곳 — 콘티 알림은 그 콘티, 나머지는 일정 · 요청 화면의 탭 (앱 안 알림 · 기기 알림 · 푸시가 같은 주소) */
export function noticeHref(teamId: string, notice: { target: PlanningTarget; entityId: string }): string {
    return notice.target === 'conti'
        ? `/dashboard/songs?${new URLSearchParams({ tab: 'order', setlist: notice.entityId, team: teamId })}`
        : `/dashboard/planning?${new URLSearchParams({ team: teamId, tab: notice.target, inbox: '1' })}`;
}

export const liveHref = (sessionId: string) => `/live/${encodeURIComponent(sessionId)}`;
