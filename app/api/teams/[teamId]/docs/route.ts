import type { NextRequest } from 'next/server';
import { apiUser, failure, json, unauthorized } from '@/lib/server/api';
import { getTeamDocs } from '@/lib/server/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 팀 공유 자료: since 이후에 바뀐 문서 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/teams/[teamId]/docs'>) {
    const { teamId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        return json(getTeamDocs().list(teamId, user.id, Number(request.nextUrl.searchParams.get('since')) || 0));
    } catch (error) { return failure(error); }
}

/** 문서 하나 올리기 { key, json, baseVersion } — 그새 바뀌었으면 409 와 서버 문서 */
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/teams/[teamId]/docs'>) {
    const { teamId } = await ctx.params;
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        const body = await request.json() as { key?: unknown; json?: unknown; baseVersion?: unknown };
        const result = getTeamDocs().put(teamId, user, String(body.key ?? ''), body.json, body.baseVersion);
        if (result.ok) return json(result);
        if (result.error) return json(result, result.denied ? 403 : 400);
        return json(result, 409);
    } catch (error) { return failure(error); }
}
