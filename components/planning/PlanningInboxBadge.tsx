'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { loadPlanningInbox } from '@/actions/planningActions';
import { cn } from '@/lib/utils';

export default function PlanningInboxBadge() {
    const [inbox, setInbox] = useState<{ count: number; urgent: number; teamId?: string; target?: string; title?: string } | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true, pending = false;
        async function refresh() {
            if (pending || document.visibilityState !== 'visible') return;
            pending = true;
            try {
                const result = await loadPlanningInbox();
                if (active) { if (result.ok) { setInbox(result.value); setFailed(false); } else setFailed(true); }
            } catch { if (active) setFailed(true); }
            finally { pending = false; }
        }
        void refresh();
        const timer = setInterval(() => void refresh(), 15000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('worship-planning-changed', refresh);
        return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('worship-planning-changed', refresh); };
    }, []);
    if (!inbox?.count && !failed) return null;
    const href = `/dashboard/planning?team=${encodeURIComponent(inbox?.teamId ?? '')}&tab=${inbox?.target ?? 'schedule'}&inbox=1`;
    const label = failed ? '알림 연결 확인 필요' : inbox?.urgent ? `긴급 미확인 ${inbox.urgent}건` : `새 알림 ${inbox?.count}건`;
    const detail = failed ? '눌러서 다시 확인해주세요' : inbox?.title;
    // 모바일: 하단 내비(4rem) 위로 띄우고, 라이브 미니바가 떠 있으면 그 위로 한 칸 더 올립니다.
    // 데스크톱: 사이드바(16rem) 옆 본문 왼쪽 아래 — 오른쪽 아래의 라이브 미니바와 겹치지 않게.
    return <aside className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-50 max-w-[calc(100vw-2rem)] max-lg:[body:has(aside[aria-label='라이브_예배_빠른_실행_바'])_&]:bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] lg:bottom-6 lg:left-[calc(16rem+1.5rem)] lg:right-auto lg:max-w-sm" aria-label="팀 준비 알림">
        <Link href={href} className="flex h-11 min-w-0 items-center gap-2.5 rounded-full border border-border bg-card pl-1.5 pr-4 text-foreground shadow-lg shadow-black/5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98] motion-reduce:transform-none dark:shadow-black/40">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bell size={16} aria-hidden="true" className={failed ? 'text-muted-foreground' : 'text-foreground'} />
                {!failed && Boolean(inbox?.urgent) && <span aria-hidden="true" className="absolute right-1 top-1 size-2 rounded-full bg-secondary ring-2 ring-muted" />}
            </span>
            <span className="flex min-w-0 items-baseline gap-1.5">
                <span role="status" className={cn('shrink-0 text-[13px] font-semibold', !failed && inbox?.urgent ? 'text-secondary' : 'text-foreground')}>{label}</span>
                {detail && <span className="min-w-0 truncate text-xs text-muted-foreground">{detail}</span>}
            </span>
        </Link>
    </aside>;
}
