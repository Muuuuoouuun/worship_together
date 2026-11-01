import 'server-only';
import { getCurrentUser } from '@/lib/auth';
import { canMutateLibrary, type LegacySessionAccess, type LibraryAccess } from '@/lib/legacyAccess';
import { supabase } from '@/lib/supabase';
import { getTeamRepository } from './teams';

/*
 * 예전 Supabase 경로의 권한 확인 — 로그인한 사람과 온라인 팀(SQLite) 명단을 읽어 lib/legacyAccess 의 순수 함수에 넘깁니다.
 */

/** 곡 보관함 서버 액션: 이 팀의 곡 · 콘티를 바꿔도 되는지 */
export async function libraryMutationAccess(teamId: string): Promise<LibraryAccess> {
    const supabaseConfigured = Boolean(supabase);
    const user = supabaseConfigured ? await getCurrentUser() : null;
    if (!supabaseConfigured || !user) return canMutateLibrary({ user, teamId, isOnlineTeam: false, membership: null, supabaseConfigured });
    const repository = getTeamRepository();
    const isOnlineTeam = repository.teamName(teamId) !== null;
    return canMutateLibrary({
        user,
        teamId,
        isOnlineTeam,
        membership: isOnlineTeam ? repository.membership(teamId, user.id) : null,
        policy: isOnlineTeam ? repository.policy(teamId) : undefined,
        supabaseConfigured,
    });
}

/** /session/[id]: 보는 사람과 그 사람의 온라인 팀 자리 (lib/data 의 getSessionDetail 에 넘깁니다) */
export async function legacySessionAccess(): Promise<LegacySessionAccess> {
    const user = await getCurrentUser();
    return {
        user,
        membershipOf: (teamId) => (user && teamId ? getTeamRepository().membership(teamId, user.id) : null),
    };
}
