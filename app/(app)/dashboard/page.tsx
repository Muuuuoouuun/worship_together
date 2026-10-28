import WorshipHome, { type HomeOnlineTeam } from '@/components/dashboard/WorshipHome';
import { getCurrentUser } from '@/lib/auth';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getCurrentSession } from '@/lib/data';
import { getTeamRepository } from '@/lib/server/teams';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [currentSession, user, query] = await Promise.all([getCurrentSession(DEMO_TEAM_ID), getCurrentUser(), searchParams]);
    const requestedTeamId = typeof query.team === 'string' ? query.team.slice(0, 200) : undefined;
    // 로그인한 경우 서버의 온라인 팀을 머리글에 씁니다. 클라이언트로는 직렬화 가능한 최소 정보만 넘깁니다.
    const onlineTeams: HomeOnlineTeam[] = user
        ? getTeamRepository().list(user.id).map((team) => ({
              id: team.id,
              name: team.name,
              memberCount: team.members.length,
              myRole: team.members.find((member) => member.userId === user.id)?.permission ?? 'member',
              memberNames: team.members.map((member) => member.name),
              hasLeader: team.members.some((member) => member.role === 'leader'),
          }))
        : [];

    return (
        <>
            <WorshipHome currentSessionId={currentSession?.id} onlineTeams={onlineTeams} initialTeamId={requestedTeamId} />
        </>
    );
}
