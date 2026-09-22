import Link from 'next/link';
import { HelpCircle, Home, Music } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <HelpCircle size={32} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">404 Error</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                요청하신 페이지를 찾을 수 없습니다
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                페이지 주소가 잘못되었거나, 이동 또는 삭제되어 표시할 수 없습니다.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition active:scale-[0.98]"
                >
                    <Home size={16} />
                    <span>대시보드로 가기</span>
                </Link>
                <Link
                    href="/dashboard/songs"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition active:scale-[0.98]"
                >
                    <Music size={16} />
                    <span>콘티·곡 목록</span>
                </Link>
            </div>
        </div>
    );
}
