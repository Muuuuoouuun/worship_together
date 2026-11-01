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
    // 콘티·악보 화면과 같은 규칙: 온라인 팀은 지금 팀(팀 바꾸기, 또는 주소의 ?team=)을 봅니다.
    const team = typeof params.team === 'string' && params.team ? params.team : undefined;
    const [inputs, currentSession] = await Promise.all([getLiveContiInputs(team), getCurrentSession(DEMO_TEAM_ID)]);

    return <LiveHome {...inputs} sessionId={currentSession?.id ?? null} />;
}
