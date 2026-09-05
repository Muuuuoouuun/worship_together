'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { loadPlanningInbox } from '@/actions/planningActions';

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
    return <aside className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] pb-[env(safe-area-inset-bottom)]" aria-label="팀 준비 알림"><Link href={href} className={`flex min-h-12 max-w-md items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-foreground shadow-lg ${inbox?.urgent ? 'border-secondary' : 'border-border'}`}><Bell size={19} className="shrink-0 text-secondary" /><span className="min-w-0"><span role="status" className="block text-sm font-bold">{failed ? '알림 연결 확인 필요' : inbox?.urgent ? `긴급 미확인 ${inbox.urgent}건` : `새 알림 ${inbox?.count}건`}</span><span className="block truncate text-xs text-muted-foreground">{failed ? '눌러서 다시 확인해주세요' : inbox?.title}</span></span></Link></aside>;
}
