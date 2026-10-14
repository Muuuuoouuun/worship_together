import type { Metadata } from 'next';
import PageHeader, { PageBadge } from '@/components/ui/PageHeader';
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
        <>
            <div className="flex w-full max-w-3xl flex-col gap-5">
                <PageHeader back={{ href: '/dashboard/songs', label: '콘티·악보' }} title="콘티 마감 알림" badge={<PageBadge>목업</PageBadge>} description="마감 전후 화면과 인도자에게 콘티 요청하는 흐름" />

                <DeadlineMockup initialView={view} initialPhase={phase} />
            </div>
        </>
    );
}
