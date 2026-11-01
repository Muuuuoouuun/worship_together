'use client';

import Link from 'next/link';
import { Radio } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import LiveScreen from './LiveScreen';
import { useLiveSession } from './useLiveSession';

/** 서버 예배 세션 화면: 세션을 불러와 예배 중 화면(LiveScreen)에 넘깁니다. */
export default function LiveSessionScreen({ sessionId }: { sessionId: string }) {
    const { model, handlers, error } = useLiveSession(sessionId);

    if (error) {
        return (
            <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Radio className="size-6" aria-hidden="true" /></span>
                <h1 className="text-xl font-semibold tracking-tight">{error.code === 403 ? '이 팀의 예배가 아니에요' : error.code === 404 ? '예배를 찾지 못했어요' : '예배에 들어가지 못했어요'}</h1>
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{error.message}</p>
                <Link href="/dashboard" className={buttonVariants({ size: 'lg' })}>홈으로</Link>
            </main>
        );
    }
    if (!model) {
        return (
            <main role="status" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground">
                <Radio className="size-6 motion-safe:animate-pulse" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">예배에 들어가는 중…</p>
            </main>
        );
    }
    return <LiveScreen model={model} handlers={handlers} />;
}
