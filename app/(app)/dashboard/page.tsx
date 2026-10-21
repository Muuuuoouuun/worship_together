import type { Metadata } from 'next';
import LiveHome from '@/components/dashboard/LiveHome';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getCurrentSession } from '@/lib/data';
import { getLiveContiInputs } from '@/lib/server/contiInputs';

export const metadata: Metadata = {
    title: '오늘',
};

interface DashboardPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const params = await searchParams;
    // 콘티·악보 화면과 같은 규칙: 처음 보여줄 온라인 팀은 주소(?team=)에서 정합니다.
    const team = typeof params.team === 'string' && params.team ? params.team : undefined;
    const [inputs, currentSession] = await Promise.all([getLiveContiInputs(), getCurrentSession(DEMO_TEAM_ID)]);

    return <LiveHome {...inputs} onlineTeamId={team} sessionId={currentSession?.id ?? null} />;
}
