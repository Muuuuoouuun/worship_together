import type { Metadata } from 'next';
import PlanningWorkspace from '@/components/planning/PlanningWorkspace';
import PageHeader from '@/components/ui/PageHeader';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';

export const metadata: Metadata = {
    title: '일정·요청',
};

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
    const teams = user ? getTeamRepository().list(user.id) : [];
    const value = (key: string, max: number) => (typeof query[key] === 'string' ? query[key].slice(0, max) : undefined);
    const title = value('setlistTitle', 120);
    return (
        <div className="space-y-6">
            <PageHeader title="일정·요청" description="예배·연습 일정과 역할 배치, 인도자에게 보내는 요청을 한곳에서 관리해요" />
            <PlanningWorkspace
                teams={teams}
                userId={user?.id}
                initialTeamId={value('team', 200)}
                initialTab={value('tab', 20)}
                initialSetlist={title ? { id: value('setlistId', 200) ?? '', title } : undefined}
            />
        </div>
    );
}
