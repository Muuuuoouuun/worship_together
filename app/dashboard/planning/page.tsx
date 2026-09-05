import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PlanningWorkspace from '@/components/planning/PlanningWorkspace';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
    const teams = user ? getTeamRepository().list(user.id) : [];
    const value = (key: string, max: number) => typeof query[key] === 'string' ? query[key].slice(0, max) : undefined;
    const title = value('setlistTitle', 120);
    return <DashboardLayout currentPath="/dashboard/planning"><div className="mx-auto max-w-5xl space-y-6"><header><p className="text-sm font-bold text-secondary">함께 맞추는 예배 준비</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">일정과 요청</h1><p className="mt-3 text-base leading-7 text-muted-foreground">연습 시간부터 빈자리까지 함께 확인해요.<br />콘티에 궁금한 점은 인도자에게 남겨주세요.</p></header><PlanningWorkspace teams={teams} userId={user?.id} initialTeamId={value('team', 200)} initialTab={value('tab', 20)} initialSetlist={title ? { id: value('setlistId', 200) ?? '', title } : undefined} /></div></DashboardLayout>;
}
