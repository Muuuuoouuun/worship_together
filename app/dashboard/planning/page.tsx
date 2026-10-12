import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PlanningWorkspace from '@/components/planning/PlanningWorkspace';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
    const teams = user ? getTeamRepository().list(user.id) : [];
    const value = (key: string, max: number) => typeof query[key] === 'string' ? query[key].slice(0, max) : undefined;
    const title = value('setlistTitle', 120);
    return <DashboardLayout currentPath="/dashboard/planning"><div className="mx-auto max-w-5xl space-y-6"><header className="flex flex-wrap items-end justify-between gap-2"><h1 className="text-2xl font-serif font-black tracking-tight text-primary sm:text-3xl">일정·요청</h1><Link href="/dashboard/planning/deadline-mockup" className="rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">콘티 마감 알림 목업 보기</Link></header><PlanningWorkspace teams={teams} userId={user?.id} initialTeamId={value('team', 200)} initialTab={value('tab', 20)} initialSetlist={title ? { id: value('setlistId', 200) ?? '', title } : undefined} /></div></DashboardLayout>;
}
