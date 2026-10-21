import type { NextRequest } from 'next/server';
import { apiUser, failure, json, unauthorized } from '@/lib/server/api';
import { getLiveRepository } from '@/lib/server/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 팀에서 지금 진행 중인 예배 (없으면 session: null) */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/teams/[teamId]/live'>) {
    const { teamId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        return json({ session: getLiveRepository().active(teamId, user.id) });
    } catch (error) { return failure(error); }
}

/** 예배 시작 — 콘티 사본(snapshot)을 받습니다. 이미 진행 중이면 그 세션으로 들어갑니다. */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/teams/[teamId]/live'>) {
    const { teamId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        const body = await request.json() as { snapshot?: unknown };
        return json(getLiveRepository().start(teamId, user, body.snapshot));
    } catch (error) { return failure(error); }
}
