import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SetlistDeadlineMockup, { type MockupPhase, type MockupView } from '@/components/planning/SetlistDeadlineMockup';

const views: MockupView[] = ['member', 'leader', 'settings', 'inbox'];
const phases: MockupPhase[] = ['before', 'soon', 'overdue', 'done'];

export default async function DeadlineMockupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = await searchParams;
    const view = views.find(item => item === query.view);
    const phase = phases.find(item => item === query.phase);
    return <DashboardLayout currentPath="/dashboard/planning"><div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
            <Link href="/dashboard/planning" className="text-xs font-semibold text-muted-foreground hover:text-foreground">← 일정·요청</Link>
            <h1 className="text-2xl font-serif font-black tracking-tight text-primary sm:text-3xl">콘티 마감 알림</h1>
        </header>
        <SetlistDeadlineMockup initialView={view} initialPhase={phase} />
    </div></DashboardLayout>;
}
