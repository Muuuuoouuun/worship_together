import type { Metadata } from 'next';
import Link from 'next/link';
import { Library } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ContiWorkspace from '@/components/conti/ContiWorkspace';
import { SETLISTS, THIS_WEEK_SETLIST_ID, type ScreenId } from '@/components/conti/mockData';

export const metadata: Metadata = {
    title: '콘티·악보',
};

interface SongsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SCREENS: ScreenId[] = ['week', 'conti', 'order', 'team', 'requests', 'alerts'];

export default async function SongsPage({ searchParams }: SongsPageProps) {
    const params = await searchParams;
    const tab = typeof params.tab === 'string' ? params.tab : '';
    const setlist = typeof params.setlist === 'string' ? params.setlist : '';
    const screen = SCREENS.find((item) => item === tab) ?? 'week';
    const setlistId = SETLISTS.some((item) => item.id === setlist && item.items.length > 0) ? setlist : THIS_WEEK_SETLIST_ID;

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <section className="flex items-end justify-between gap-3 px-1">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                            콘티·악보
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">샘플 데이터</span>
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">이번 주 콘티와 순서, 팀 배치와 요청을 한곳에서</p>
                        <Link href="/dashboard/songs/deadline" className="mt-1.5 inline-flex min-h-8 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline">
                            콘티 마감 알림 목업 보기 →
                        </Link>
                    </div>
                    <Link
                        href="/dashboard/songs/library"
                        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                        <Library size={15} aria-hidden="true" />
                        곡 보관함
                    </Link>
                </section>

                <ContiWorkspace initialScreen={screen} initialSetlistId={setlistId} mode="embedded" />
            </div>
        </DashboardLayout>
    );
}
