import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DeadlineMockup, { type DeadlinePhase, type DeadlineView } from '@/components/conti/DeadlineMockup';

export const metadata: Metadata = {
    title: '콘티 마감 알림',
};

const VIEWS: DeadlineView[] = ['member', 'leader', 'settings', 'alerts'];
const PHASES: DeadlinePhase[] = ['before', 'soon', 'overdue', 'done'];

export default async function DeadlinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const view = VIEWS.find((item) => item === params.view);
    const phase = PHASES.find((item) => item === params.phase);

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <section className="px-1">
                    <Link href="/dashboard/songs" className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ChevronLeft size={14} aria-hidden="true" />
                        콘티·악보
                    </Link>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                        콘티 마감 알림
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">목업</span>
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">마감 전후 화면과 인도자에게 콘티 요청하는 흐름</p>
                </section>

                <DeadlineMockup initialView={view} initialPhase={phase} />
            </div>
        </DashboardLayout>
    );
}
