import 'server-only';
import { cookies } from 'next/headers';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { DEFAULT_POLICY, type TeamPolicy } from '@/lib/permissions';
import type { OnlineTeam, TeamMember, UserProfile } from '@/types/team';
import { getTeamRepository } from './teams';

/** 지금 보고 있는 팀 (팀 바꾸기에서 고른 팀). 주소의 ?team= 이 있으면 그쪽이 먼저입니다. */
export const TEAM_COOKIE = 'wt_team';

export interface Viewer {
    user: CurrentUser;
    profile: UserProfile;
    teams: OnlineTeam[];
    /** 지금 팀 (팀이 없으면 null) */
    team: OnlineTeam | null;
    member: TeamMember | null;
    policy: TeamPolicy;
}

/**
 * 로그인한 사람과 지금 팀. 로그인하지 않았으면 null.
 * 처음 로그인한 사람은 여기서 사용자 기록이 만들어집니다.
 */
export async function getViewer(requestedTeamId?: string | null): Promise<Viewer | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    const repository = getTeamRepository();
    const profile = repository.ensureUser(user);
    const teams = repository.list(user.id);
    const cookieTeam = (await cookies()).get(TEAM_COOKIE)?.value;
    const team = teams.find((item) => item.id === requestedTeamId) ?? teams.find((item) => item.id === cookieTeam) ?? teams[0] ?? null;
    const member = team?.members.find((item) => item.userId === user.id) ?? null;
    return { user: { ...user, name: profile.name }, profile, teams, team, member, policy: team ? repository.policy(team.id) : DEFAULT_POLICY };
}
