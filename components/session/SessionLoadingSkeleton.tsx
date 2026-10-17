/** 준비 화면을 여는 동안 보이는 자리표시 (흰 바탕 위 회색 덩어리). */
export function SessionSkeleton() {
    return (
        <main role="status" aria-label="예배 콘티 불러오는 중" className="safe-area-x mx-auto min-h-dvh max-w-7xl bg-background py-6 sm:px-6 sm:py-8 md:px-10">
            <span className="sr-only">예배 콘티 불러오는 중…</span>
            <div className="space-y-3 motion-safe:animate-pulse" aria-hidden="true">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="h-7 w-56 max-w-full rounded-full bg-muted" />
                <div className="h-3 w-40 rounded-full bg-muted" />
            </div>
            <div className="mt-8 grid gap-6 motion-safe:animate-pulse xl:grid-cols-[1.5fr_0.9fr]" aria-hidden="true">
                <div className="h-96 rounded-3xl bg-muted/60" />
                <div className="hidden h-96 rounded-3xl bg-muted/60 xl:block" />
            </div>
        </main>
    );
}

/** 무대(예배팀) 화면은 어두운 화면이라 흰 화면이 번쩍이지 않게 같은 어두운 바탕만 먼저 깝니다. */
export function TeamModeSkeleton() {
    return (
        <main role="status" aria-label="예배 콘티 불러오는 중" className="min-h-dvh bg-[#070D0C]">
            <span className="sr-only">예배 콘티 불러오는 중…</span>
        </main>
    );
}
