'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled app runtime error:', error);
    }, [error]);

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-6">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                일시적인 오류가 발생했습니다
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                화면을 불러오는 중 문제가 생겼습니다. 다시 시도하시거나 대시보드로 돌아가실 수 있습니다.
            </p>
            {error.message && (
                <div className="mt-4 max-w-lg rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive font-mono text-left break-all">
                    {error.message}
                </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                    onClick={() => reset()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition active:scale-[0.98]"
                >
                    <RefreshCw size={16} />
                    <span>다시 시도하기</span>
                </button>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition active:scale-[0.98]"
                >
                    <Home size={16} />
                    <span>대시보드로 이동</span>
                </Link>
            </div>
        </div>
    );
}
