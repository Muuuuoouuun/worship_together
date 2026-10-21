import type { Metadata } from 'next';
import PlanningWorkspace from '@/components/planning/PlanningWorkspace';
import PageHeader from '@/components/ui/PageHeader';
import { getViewer } from '@/lib/server/viewer';

export const metadata: Metadata = {
    title: '일정·요청',
};

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = await searchParams;
    const value = (key: string, max: number) => (typeof query[key] === 'string' ? query[key].slice(0, max) : undefined);
    // 온라인 팀은 지금 팀(팀 바꾸기 · ?team=)을 씁니다.
    const viewer = await getViewer(value('team', 200));
    const user = viewer?.user ?? null;
    const teams = viewer?.teams ?? [];
    const title = value('setlistTitle', 120);
    return (
        <div className="space-y-6">
            <PageHeader title="일정·요청" description="예배·연습 일정과 역할 배치, 인도자에게 보내는 요청을 한곳에서 관리해요" />
            <PlanningWorkspace
                teams={teams}
                userId={user?.id}
                initialTeamId={viewer?.team?.id ?? value('team', 200)}
                initialTab={value('tab', 20)}
                initialSetlist={title ? { id: value('setlistId', 200) ?? '', title } : undefined}
            />
        </div>
    );
}
