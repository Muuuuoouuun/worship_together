'use client';

import Link from 'next/link';
import { Library, RotateCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { buttonVariants } from '@/components/ui/button';
import { ContiProvider } from '@/components/conti/context';
import { useLiveContiData, type LiveContiInputs } from '@/components/conti/useLiveContiData';
import HomeTiles, { HomeTilesSkeleton } from './HomeTiles';

interface LiveHomeProps extends LiveContiInputs {
    /** 서버가 찾은 진행 중인 라이브 예배 세션 (없으면 데모 세션) */
    sessionId: string | null;
}

/**
 * 홈(/dashboard). 콘티·악보 화면과 같은 실제 데이터(useLiveContiData)를 파스텔 타일 홈(HomeTiles)에 넘깁니다.
 */
export default function LiveHome({ sessionId, ...inputs }: LiveHomeProps) {
    const { data, loading, error, source } = useLiveContiData(inputs);

    if (loading) return <HomeTilesSkeleton />;
    if (error !== null || !data) return <HomeError message={error ?? '저장된 콘티를 읽지 못했어요.'} />;

    const session = `/session/${encodeURIComponent(sessionId ?? DEMO_SESSION_ID)}`;
    const sessionHref = (setlistId: string | null) =>
        setlistId ? `${session}?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(source.teamId)}` : session;

    return (
        <ContiProvider value={data}>
            <HomeTiles sessionHref={sessionHref} team={source.teamName ? { name: source.teamName } : null} />
        </ContiProvider>
    );
}

/** 불러오지 못했을 때도 같은 머리말 · 같은 타일 모양으로 보여 줍니다. */
function HomeError({ message }: { message: string }) {
    return (
        <div className="space-y-6">
            <header>
                <p className="text-xs font-medium text-muted-foreground">오늘</p>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">이번 주 예배 준비</h1>
            </header>
            <section role="alert" className="flex flex-col items-start rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <TriangleAlert size={22} aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">홈 화면을 불러오지 못했어요</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
                <p className="mt-0.5 max-w-md text-xs text-muted-foreground">이 브라우저에 저장된 콘티 · 일정은 그대로 있어요. 다시 불러오거나 곡 보관함에서 확인해 주세요.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => window.location.reload()} className={buttonVariants({ size: 'sm' })}>
                        <RotateCw aria-hidden="true" />
                        다시 불러오기
                    </button>
                    <Link href="/dashboard/songs/library" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        <Library aria-hidden="true" />
                        곡 보관함 열기
                    </Link>
                </div>
            </section>
        </div>
    );
}
