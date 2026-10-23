import type { TeamEventType } from './server/teamEvents';

/*
 * 내 소식 흐름 (브라우저 쪽). 지금 팀이 아닌 다른 소속 팀의 알림 · 공지 · 예배 시작을 받습니다.
 * 끊기면 브라우저가 3초 뒤 마지막 번호부터 다시 붙고, 서버가 닫아 버리면(로그인 만료 · 서버 재시작) 여기서 다시 엽니다.
 */

export interface UserStreamEvent {
    id: number;
    teamId: string;
    teamName: string;
    type: TeamEventType;
    payload: unknown;
    createdAt: string;
}

export function subscribeUserStream(exclude: string, listener: (event: UserStreamEvent) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {};
    let source: EventSource | null = null;
    let lastId: number | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let stopped = false;

    const open = () => {
        source?.close();
        const params = new URLSearchParams({ exclude });
        if (lastId !== null) params.set('after', String(lastId));
        const current = new EventSource(`/api/me/stream?${params}`);
        source = current;
        current.onopen = () => { failures = 0; };
        current.addEventListener('hello', (message) => {
            const id = Number((message as MessageEvent<string>).data);
            if (Number.isFinite(id) && id >= 0) lastId = id;
        });
        current.addEventListener('team', (message) => {
            try {
                const event = JSON.parse((message as MessageEvent<string>).data) as UserStreamEvent;
                lastId = event.id;
                listener(event);
            } catch {
                // 망가진 한 줄은 건너뜁니다.
            }
        });
        current.onerror = () => {
            if (current.readyState !== EventSource.CLOSED || retry || stopped) return;
            failures += 1;
            retry = setTimeout(() => {
                retry = null;
                if (!stopped) open();
            }, Math.min(30_000, 2_000 * 2 ** Math.min(failures, 4)));
        };
    };
    open();
    return () => {
        stopped = true;
        source?.close();
        if (retry) clearTimeout(retry);
    };
}
