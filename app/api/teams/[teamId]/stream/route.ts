import type { NextRequest } from 'next/server';
import { apiUser, json, unauthorized } from '@/lib/server/api';
import { getTeamEvents, getTeamRepository } from '@/lib/server/teams';
import { visibleTo, type TeamEvent } from '@/lib/server/teamEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 팀 소식 실시간 흐름 (Server-Sent Events).
 * 다시 연결할 때 브라우저가 Last-Event-ID 로 마지막 소식 번호를 보내면 그다음부터 이어서 보냅니다.
 * 처음 연결은 ?after= 로 시작 번호를 줄 수 있고, 없으면 지금부터 받습니다.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/teams/[teamId]/stream'>) {
    const { teamId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    const teams = getTeamRepository();
    if (!teams.membership(teamId, user.id)) return json({ error: '이 팀에 접근할 수 없습니다.' }, 403);
    const events = getTeamEvents();
    const resume = Number(request.headers.get('last-event-id') ?? request.nextUrl.searchParams.get('after'));
    const start = Number.isFinite(resume) && resume >= 0 && (request.headers.has('last-event-id') || request.nextUrl.searchParams.has('after')) ? resume : events.latestId(teamId);
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
                if (event.id <= lastId) return;
                lastId = event.id;
                if (!visibleTo(event, user.id)) return;
                send(`id: ${event.id}\nevent: team\ndata: ${JSON.stringify({ id: event.id, type: event.type, payload: event.payload, createdAt: event.createdAt })}\n\n`);
                // 팀에서 빠진 사람에게는 더 보내지 않습니다.
                if (event.type === 'team.changed' && !teams.membership(teamId, user.id)) close();
            };
            const close = () => {
                if (closed) return;
                closed = true;
                unsubscribe();
                clearInterval(ping);
                try { controller.close(); } catch { /* 이미 닫힘 */ }
            };
            // 다시 연결하면 사이에 놓친 소식을 먼저 보냅니다.
            send(`retry: 3000\n: connected ${start}\n\n`);
            for (const event of events.since(teamId, start, user.id)) deliver(event);
            const unsubscribe = events.subscribe(teamId, deliver);
            // 중간 장비가 연결을 끊지 않도록 20초마다 빈 줄을 보냅니다.
            const ping = setInterval(() => send(`: ping\n\n`), 20_000);
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
