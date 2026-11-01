import type { NextRequest } from 'next/server';
import { apiUser, failure, json, unauthorized } from '@/lib/server/api';
import { getLiveRepository } from '@/lib/server/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 세션 전체 (콘티 사본 · 진행 상태 · 접속 · 최근 큐 · 팀원 · 정책) */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/live/[sessionId]'>) {
    const { sessionId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        return json(getLiveRepository().detail(sessionId, user.id));
    } catch (error) { return failure(error); }
}

type Body = { op?: string; deviceId?: string; patch?: Record<string, unknown>; entryId?: string; cueId?: string };

/**
 * 세션 동작. 나가기는 화면을 닫을 때 navigator.sendBeacon 으로도 옵니다 (그때는 본문이 text/plain).
 * op: join · heartbeat · leave · move · cue · ack · end
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/live/[sessionId]'>) {
    const { sessionId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    const live = getLiveRepository();
    try {
        const body = JSON.parse(await request.text() || '{}') as Body;
        const deviceId = String(body.deviceId ?? '');
        switch (body.op) {
            case 'join': live.join(sessionId, user.id, deviceId); return json({ ok: true });
            case 'heartbeat': live.heartbeat(sessionId, user.id, deviceId); return json({ ok: true });
            case 'leave': live.leave(sessionId, user.id, deviceId); return json({ ok: true });
            case 'move': return json({ state: live.move(sessionId, user, body.patch ?? {}) });
            case 'cue': return json({ cue: live.cue(sessionId, user, body.entryId, body.cueId) });
            case 'ack': live.ack(sessionId, user, body.entryId); return json({ ok: true });
            case 'end': live.end(sessionId, user); return json({ ok: true });
            default: return json({ error: '알 수 없는 요청입니다.' }, 400);
        }
    } catch (error) { return failure(error); }
}
