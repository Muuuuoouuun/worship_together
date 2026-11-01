import type { NextRequest } from 'next/server';
import { apiUser, unauthorized } from '@/lib/server/api';
import { getTeamEvents, getTeamRepository } from '@/lib/server/teams';
import { visibleTo, type TeamEvent, type TeamEventType } from '@/lib/server/teamEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 다른 팀에서 받을 소식: 나에게 온 알림 · 공지와 예배 시작 */
const TYPES: TeamEventType[] = ['planning.notice', 'live.started'];

/**
 * 내 소식 흐름 (Server-Sent Events). 지금 보고 있는 팀은 팀 소식 흐름(/api/teams/[teamId]/stream)이 맡고,
 * 여기서는 내가 속한 다른 팀(?exclude=지금 팀)의 알림 · 공지 · 예배 시작만 한 줄로 보냅니다.
 * 소식 번호는 모든 팀이 함께 쓰므로 끊겼다 붙으면 마지막 번호 다음부터 이어 받습니다.
 */
export async function GET(request: NextRequest) {
    const user = await apiUser();
    if (!user) return unauthorized();
    const exclude = request.nextUrl.searchParams.get('exclude');
    const teams = getTeamRepository().list(user.id).filter((team) => team.id !== exclude);
    const names = new Map(teams.map((team) => [team.id, team.name]));
    const events = getTeamEvents();
    const resume = Number(request.headers.get('last-event-id') ?? request.nextUrl.searchParams.get('after'));
    const resuming = Number.isFinite(resume) && resume >= 0 && (request.headers.has('last-event-id') || request.nextUrl.searchParams.has('after'));
    const start = resuming ? resume : events.latestIdOverall();
    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let lastId = start;
            const send = (chunk: string) => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(chunk)); } catch { close(); }
            };
            const deliver = (event: TeamEvent) => {
                if (event.id <= lastId || !TYPES.includes(event.type)) return;
                lastId = event.id;
                if (!visibleTo(event, user.id)) return;
                send(`id: ${event.id}\nevent: team\ndata: ${JSON.stringify({ id: event.id, teamId: event.teamId, teamName: names.get(event.teamId) ?? '다른 팀', type: event.type, payload: event.payload, createdAt: event.createdAt })}\n\n`);
            };
            const unsubscribers: (() => void)[] = [];
            // 중간 장비가 연결을 끊지 않도록 20초마다 빈 줄을 보냅니다.
            const ping = setInterval(() => send(`: ping\n\n`), 20_000);
            const close = () => {
                if (closed) return;
                closed = true;
                unsubscribers.forEach((off) => off());
                clearInterval(ping);
                try { controller.close(); } catch { /* 이미 닫힘 */ }
            };
            send(`retry: 3000\nid: ${start}\nevent: hello\ndata: ${start}\n\n`);
            for (const event of events.sinceAcross([...names.keys()], start, user.id, TYPES)) deliver(event);
            if (closed) return;
            for (const teamId of names.keys()) unsubscribers.push(events.subscribe(teamId, deliver));
            request.signal.addEventListener('abort', close);
            cleanup = close;
        },
        cancel() { cleanup(); },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
