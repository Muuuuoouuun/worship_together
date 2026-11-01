/** 예배 화면으로 가는 주소들. 온라인 팀은 서버 예배 세션(/live)을 씁니다. */

/** 콘티로 예배 시작 — 이미 진행 중이면 그 예배로 들어가고, 권한이 없으면 시작을 기다립니다. */
export function liveStartHref(teamId: string, setlistId: string | null): string {
    const query = new URLSearchParams({ team: teamId });
    if (setlistId) query.set('setlist', setlistId);
    return `/live/start?${query}`;
}

export function liveSessionHref(sessionId: string): string {
    return `/live/${encodeURIComponent(sessionId)}`;
}
