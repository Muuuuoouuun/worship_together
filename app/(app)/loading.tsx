/** 화면을 불러오는 동안 틀(사이드바·내비)은 그대로 두고 본문 자리만 비워 둡니다. */
export default function Loading() {
    return (
        <div role="status" aria-label="불러오는 중" className="animate-pulse space-y-6">
            <div className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-muted" />
                <div className="h-7 w-44 rounded-full bg-muted" />
                <div className="h-4 w-64 max-w-full rounded-full bg-muted" />
            </div>
            <div className="h-40 rounded-3xl bg-muted" />
            <div className="h-24 rounded-3xl bg-muted" />
        </div>
    );
}
