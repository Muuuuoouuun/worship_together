import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { getTeamRepository } from './teams';

export const noStore = { 'Cache-Control': 'no-store' };

export function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers: noStore });
}

/** 한국어로 쓴 안내 문구만 화면에 그대로 보여 주고, 그 밖의 오류는 일반 문구로 바꿉니다. */
export function failure(error: unknown, status = 400) {
    const message = error instanceof Error && /[가-힣]/.test(error.message) ? error.message : '처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
    if (!(error instanceof Error && /[가-힣]/.test(error.message))) console.error('[api]', error);
    const code = /접근할 수 없|권한/.test(message) ? 403 : /찾지 못/.test(message) ? 404 : status;
    return json({ error: message }, code);
}

/** 로그인한 사람 (프로필 이름 반영). 없으면 null */
export async function apiUser(): Promise<CurrentUser | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    const profile = getTeamRepository().ensureUser(user);
    return { ...user, name: profile.name };
}

export const unauthorized = () => json({ error: '로그인 후 다시 시도해주세요.' }, 401);
