import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_SESSION_ID } from '@/lib/constants';
import DesktopStage from '@/components/session/drafts/DesktopStage';
import DesktopConsole from '@/components/session/drafts/DesktopConsole';
import MobileNow from '@/components/session/drafts/MobileNow';
import MobileScore from '@/components/session/drafts/MobileScore';
import { DRAFT_VERSIONS, DRAFT_VERSION_IDS, type DraftVersion, type DraftVersionId } from '@/components/session/drafts/versions';
import type { DraftScreenProps } from '@/components/session/drafts/types';

export const metadata: Metadata = {
    title: '예배 중 디자인 시안',
};

const SCREENS: Record<DraftVersionId, (props: DraftScreenProps) => ReactNode> = {
    'desktop-a': DesktopStage,
    'desktop-b': DesktopConsole,
    'mobile-a': MobileNow,
    'mobile-b': MobileScore,
};

interface WorshipDraftsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorshipDraftsPage({ searchParams }: WorshipDraftsPageProps) {
    const params = await searchParams;
    const requested = typeof params.v === 'string' ? params.v : '';
    const single = DRAFT_VERSION_IDS.has(requested as DraftVersionId) ? (requested as DraftVersionId) : null;
    const alt = params.alt === '1';

    if (single) return <SingleView id={single} alt={alt} />;

    const desktops = DRAFT_VERSIONS.filter((version) => version.device === 'desktop');
    const mobiles = DRAFT_VERSIONS.filter((version) => version.device === 'mobile');

    return (
        <main className="min-h-dvh bg-muted dark:bg-background">
            {/* 휴대폰·태블릿: 모바일 A 를 실제 앱처럼 한 화면으로 (위 막대에서 다른 시안으로) */}
            <div className="lg:hidden">
                <SingleView id="mobile-a" alt={false} />
            </div>

            {/* 데스크톱: 시안을 실제 크기에 가깝게 나란히 놓고 비교 */}
            <div className="hidden px-10 pb-24 pt-12 lg:block">
                <header className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-4">
                    <div>
                        <Link href={`/session/${DEMO_SESSION_ID}`} className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <ChevronLeft size={14} />
                            지금 예배 중 화면으로
                        </Link>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">예배 중 화면 리디자인</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            예배가 진행되는 동안 팀이 보는 화면. 데스크톱과 모바일을 각각 두 가지 방향으로 그렸습니다. 섹션 넘김, 큐 보내기, 박자 표시는 직접 눌러 볼 수 있습니다.
                        </p>
                    </div>
                    <span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
                        목업 데이터 · 주일 2부 예배 10월 18일 (일)
                    </span>
                </header>

                <section aria-labelledby="desktop-drafts" className="mx-auto mt-14 max-w-[1280px]">
                    <h2 id="desktop-drafts" className="text-lg font-semibold tracking-tight text-foreground">데스크톱</h2>
                    <div className="mt-6 space-y-16">
                        {desktops.map((version) => {
                            const Screen = SCREENS[version.id];
                            return (
                                <figure key={version.id}>
                                    <VersionCaption version={version} />
                                    <div className="mt-5 overflow-hidden rounded-3xl bg-card shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-border">
                                        <BrowserBar />
                                        <div className="h-[780px] w-full">
                                            <Screen framed />
                                        </div>
                                    </div>
                                </figure>
                            );
                        })}
                    </div>
                </section>

                <section aria-labelledby="mobile-drafts" className="mx-auto mt-24 max-w-[1280px]">
                    <h2 id="mobile-drafts" className="text-lg font-semibold tracking-tight text-foreground">모바일</h2>
                    <div className="mt-6 space-y-20">
                        {mobiles.map((version) => {
                            const Screen = SCREENS[version.id];
                            return (
                                <figure key={version.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-12">
                                    <VersionCaption version={version} />
                                    <div className="flex gap-10">
                                        {[false, true].map((altState) => (
                                            <div key={String(altState)}>
                                                <div className="h-[780px] w-[375px] overflow-hidden rounded-[2.75rem] bg-card shadow-[0_40px_80px_-32px_rgba(15,23,42,0.28)] ring-1 ring-border">
                                                    <Screen framed alt={altState} />
                                                </div>
                                                <p className="mt-4 text-center text-xs text-muted-foreground">{altState ? version.altLabel : '기본 화면'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </figure>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}

function VersionCaption({ version }: { version: DraftVersion }) {
    return (
        <figcaption className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
            <div className="max-w-xl">
                <p className="text-xs text-muted-foreground">
                    {version.device === 'desktop' ? '데스크톱' : '모바일'} {version.letter} · {version.tone}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{version.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{version.summary}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                    {version.points.map((point) => (
                        <li key={point} className="flex gap-2">
                            <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                            {point}
                        </li>
                    ))}
                </ul>
            </div>
            <Link
                href={`/session/drafts?v=${version.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
            >
                한 화면으로 보기
                <ArrowUpRight size={15} className="text-muted-foreground" />
            </Link>
        </figcaption>
    );
}

function BrowserBar() {
    return (
        <div aria-hidden="true" className="flex h-10 items-center gap-3 border-b border-border bg-muted/60 px-4">
            <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
            </span>
            <span className="mx-auto w-80 truncate rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted-foreground ring-1 ring-border">
                worship-together · 예배 중
            </span>
            <span className="w-12" />
        </div>
    );
}

/** 시안 하나를 화면 가득. 위 막대에서 다른 시안으로 옮겨 다닙니다. */
function SingleView({ id, alt }: { id: DraftVersionId; alt: boolean }) {
    const Screen = SCREENS[id];
    const version = DRAFT_VERSIONS.find((item) => item.id === id)!;
    return (
        <div className="flex h-dvh flex-col bg-background">
            <nav aria-label="예배 중 디자인 시안" className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 text-xs [scrollbar-width:none]">
                <Link href="/session/drafts" className="hidden shrink-0 rounded-full px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground lg:inline-flex">
                    전체 보기
                </Link>
                {DRAFT_VERSIONS.map((item) => {
                    const active = item.id === id;
                    return (
                        <Link
                            key={item.id}
                            href={`/session/drafts?v=${item.id}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors',
                                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {item.device === 'desktop' ? '데스크톱' : '모바일'} {item.letter} · {item.title}
                        </Link>
                    );
                })}
                {version.altLabel ? (
                    <Link
                        href={alt ? `/session/drafts?v=${id}` : `/session/drafts?v=${id}&alt=1`}
                        className="ml-auto shrink-0 rounded-full px-3 py-1.5 font-medium text-brand hover:underline"
                    >
                        {alt ? '기본 화면' : version.altLabel}
                    </Link>
                ) : null}
            </nav>
            <h1 className="sr-only">예배 중 디자인 시안 — {version.title}</h1>
            <div className="min-h-0 flex-1">
                <Screen alt={alt} />
            </div>
        </div>
    );
}
