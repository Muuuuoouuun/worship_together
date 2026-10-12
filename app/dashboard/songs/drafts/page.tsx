import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import ContiWorkspace from '@/components/conti/ContiWorkspace';
import type { ScreenId } from '@/components/conti/mockData';

export const metadata: Metadata = {
    title: '콘티·순서 디자인 시안',
};

interface SetlistDraftsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FRAMES: { screen: ScreenId; title: string; detail: string }[] = [
    { screen: 'week', title: '이번 주', detail: '이번 주 콘티와 담당자 · 팀 소식 · 일정' },
    { screen: 'conti', title: '콘티 내역', detail: '달력 · 주차별 담당 · 지난 콘티' },
    { screen: 'order', title: '순서', detail: '곡 순서 · 송폼 · 링크 · 특이사항 · 팀원 코멘트' },
    { screen: 'team', title: '악기 담당 · 일정', detail: '주일별 배치 현황과 연습 일정' },
    { screen: 'requests', title: '요청', detail: 'Key 변경 · 대체 · 질문을 한곳에서' },
    { screen: 'alerts', title: '팀 소식', detail: '팀원들의 입력·응답·코멘트 알림' },
];

const SCREENS = new Set<ScreenId>(FRAMES.map((frame) => frame.screen));

export default async function SetlistDraftsPage({ searchParams }: SetlistDraftsPageProps) {
    const params = await searchParams;
    const requested = typeof params.screen === 'string' ? params.screen : '';
    const screen: ScreenId = SCREENS.has(requested as ScreenId) ? (requested as ScreenId) : 'week';

    return (
        <main className="min-h-dvh bg-neutral-100 dark:bg-neutral-950">
            {/* 휴대폰·태블릿: 실제 앱처럼 한 화면 */}
            <div className="lg:hidden">
                <div className="mx-auto min-h-dvh max-w-md bg-white shadow-sm dark:bg-neutral-900">
                    <ContiWorkspace initialScreen={screen} mode="app" />
                </div>
            </div>

            {/* 데스크톱: 레퍼런스처럼 화면을 나란히 놓고 비교 */}
            <div className="hidden px-10 py-12 lg:block">
                <header className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-4">
                    <div>
                        <Link href="/dashboard/songs" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
                            <ChevronLeft size={14} />
                            콘티·악보로 돌아가기
                        </Link>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">콘티 · 순서 리디자인</h1>
                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                            흰 바탕과 여백, 한 가지 강조색. 주차별 담당부터 순서·악기 담당·요청·팀 소식까지 한 흐름으로 이어집니다.
                        </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs text-neutral-500 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800">
                        목업 데이터 · 기준일 2026.10.12 (월)
                    </span>
                </header>

                <div className="mx-auto mt-12 grid max-w-[1240px] grid-cols-[repeat(auto-fit,375px)] justify-center gap-x-10 gap-y-16">
                    {FRAMES.map((frame, index) => (
                        <figure key={frame.screen}>
                            <div className="h-[780px] w-[375px] overflow-hidden rounded-[2.75rem] bg-white shadow-[0_40px_80px_-32px_rgba(15,23,42,0.28)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
                                <ContiWorkspace initialScreen={frame.screen} mode="framed" />
                            </div>
                            <figcaption className="mt-5 px-2">
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                                    <span className="mr-2 tabular-nums text-neutral-400">{String(index + 1).padStart(2, '0')}</span>
                                    {frame.title}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{frame.detail}</p>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </main>
    );
}
