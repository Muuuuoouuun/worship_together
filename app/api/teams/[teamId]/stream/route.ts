import type { NextRequest } from 'next/server';
import { apiUser, json, unauthorized } from '@/lib/server/api';
import { getPushStore, getTeamEvents, getTeamRepository } from '@/lib/server/teams';
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
    const resuming = Number.isFinite(resume) && resume >= 0 && (request.headers.has('last-event-id') || request.nextUrl.searchParams.has('after'));
    // 오래 끊겨 있어 놓친 소식을 이어 줄 수 없으면, 지금부터 받으면서 화면에 처음부터 다시 읽으라고 알립니다.
    const reset = resuming && events.hasGap(teamId, resume);
    const start = resuming && !reset ? resume : events.latestId(teamId);
    const encoder = new TextEncoder();
    // 이 기기에서 앱이 열려 있는 동안에는 푸시 대신 열린 앱이 알림을 띄웁니다.
    const device = request.nextUrl.searchParams.get('device');
    const releaseDevice = getPushStore().deviceConnected(device && /^[\w-]{8,64}$/.test(device) ? device : null);
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
                releaseDevice();
                unsubscribe();
                clearInterval(ping);
                try { controller.close(); } catch { /* 이미 닫힘 */ }
            };
            // 다시 연결하면 사이에 놓친 소식을 먼저 보냅니다.
            // 시작 번호를 먼저 알려 둡니다 — 소식을 하나도 받기 전에 끊겨도 그 사이 소식부터 이어 받게.
            send(`retry: 3000\nid: ${start}\nevent: hello\ndata: ${start}\n\n`);
            if (reset) send(`id: ${start}\nevent: team\ndata: ${JSON.stringify({ id: start, type: 'stream.reset', payload: null, createdAt: new Date().toISOString() })}\n\n`);
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
