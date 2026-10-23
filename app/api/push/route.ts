import type { NextRequest } from 'next/server';
import { apiUser, failure, json, unauthorized } from '@/lib/server/api';
import { getPushStore } from '@/lib/server/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 푸시 공개 키 (서버에 VAPID 키가 없으면 null) */
export async function GET() {
    return json({ publicKey: getPushStore().publicKey });
}

/** 이 기기 구독을 지금 로그인한 사람에게 묶습니다 { subscription, deviceId } */
export async function POST(request: NextRequest) {
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        const body = await request.json() as { subscription?: unknown; deviceId?: unknown };
        getPushStore().subscribe(user.id, body.deviceId, body.subscription);
        return json({ ok: true });
    } catch (error) { return failure(error); }
}

/** 이 기기 구독 끊기 { endpoint } */
export async function DELETE(request: NextRequest) {
    const user = await apiUser();
    if (!user) return unauthorized();
    try {
        const body = await request.json().catch(() => ({})) as { endpoint?: unknown };
        getPushStore().unsubscribe(user.id, body.endpoint);
        return json({ ok: true });
    } catch (error) { return failure(error); }
}
