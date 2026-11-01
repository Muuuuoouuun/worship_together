import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import HomeDraftProvider from '@/components/dashboard/home-drafts/HomeDraftProvider';
import HomeDraft1 from '@/components/dashboard/home-drafts/HomeDraft1';
import HomeDraft2 from '@/components/dashboard/home-drafts/HomeDraft2';
import HomeDraft3 from '@/components/dashboard/home-drafts/HomeDraft3';
import { HOME_DRAFTS, HOME_DRAFT_IDS, type HomeDraftId } from '@/components/dashboard/home-drafts/versions';

export const metadata: Metadata = {
    title: '홈 화면 시안',
};

interface HomeDraftsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SCREENS: Record<HomeDraftId, () => ReactNode> = {
    '1': HomeDraft1,
    '2': HomeDraft2,
    '3': HomeDraft3,
};

/**
 * 데스크톱 홈 시안. 실제 앱 틀(사이드바 · 본문 폭) 안에서 그대로 보여 줍니다.
 * ?v=1|2|3 → 시안 하나, 없으면 시안 목록.
 */
export default async function HomeDraftsPage({ searchParams }: HomeDraftsPageProps) {
    const params = await searchParams;
    const requested = typeof params.v === 'string' ? params.v : '';
    const id = HOME_DRAFT_IDS.has(requested as HomeDraftId) ? (requested as HomeDraftId) : null;

    if (id) {
        const Screen = SCREENS[id];
        return (
            <HomeDraftProvider>
                <h1 className="sr-only">홈 화면 시안 {id} · {HOME_DRAFTS.find((draft) => draft.id === id)?.title}</h1>
                <Screen />
            </HomeDraftProvider>
        );
    }

    return (
        <>
            <PageHeader eyebrow="디자인 시안" title="홈 화면 시안" description="모바일 '이번 주' 화면의 색과 블록으로 데스크톱 홈을 세 가지 방향으로 그렸습니다. 목업 데이터(기준일 10월 12일 월요일)입니다." />
            <ul className="divide-y divide-border/70 border-y border-border/70">
                {HOME_DRAFTS.map((draft) => (
                    <li key={draft.id}>
                        <Link href={`/dashboard/home-drafts?v=${draft.id}`} className="flex items-start justify-between gap-6 py-5 transition-colors hover:bg-muted/40">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">시안 {draft.id}</p>
                                <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{draft.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{draft.summary}</p>
                            </div>
                            <ArrowUpRight size={18} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
