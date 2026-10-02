"use client";

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, Music2, X, ChevronRight, Sparkles, Users } from 'lucide-react';
import { readPrototypeLibrary, LIBRARY_CHANGED_EVENT, type LibrarySetlist } from '@/lib/libraryPrototypeStorage';
import { getTeamSnapshot, parseTeamSnapshot } from '@/lib/teamPrototype';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';

export default function LiveSessionMiniBar() {
    const pathname = usePathname();
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const [dismissed, setDismissed] = useState(false);
    const [teamId, setTeamId] = useState<string>(DEMO_TEAM_ID);
    const [teamName, setTeamName] = useState<string>('예배팀');
    const [activeSetlist, setActiveSetlist] = useState<LibrarySetlist | null>(null);
    const [isToday, setIsToday] = useState(false);

    useEffect(() => {
        let active = true;
        const refresh = () => {
            if (!active) return;
            try {
                const snapshot = parseTeamSnapshot(getTeamSnapshot());
                const activeTeam = snapshot.teams[0];
                const activeId = activeTeam?.id ?? DEMO_TEAM_ID;
                setTeamId(activeId);
                setTeamName(activeTeam?.name ?? '예배팀');

                const lib = readPrototypeLibrary(activeId);
                if (lib && Array.isArray(lib.setlists) && lib.setlists.length > 0) {
                    const now = Date.now();
                    const todayDateString = new Date().toDateString();
                    const ordered = [...lib.setlists].sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date));
                    const next = ordered.find((item) => Date.parse(item.worship_date) >= now - 1000 * 60 * 60 * 12) ?? ordered[ordered.length - 1];
                    setActiveSetlist(next);
                    setIsToday(next ? new Date(next.worship_date).toDateString() === todayDateString : false);
                } else {
                    setActiveSetlist(null);
                    setIsToday(false);
                }
            } catch {
                // Ignore storage parse errors
            }
        };

        queueMicrotask(refresh);
        window.addEventListener('storage', refresh);
        window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);

        return () => {
            active = false;
            window.removeEventListener('storage', refresh);
            window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh);
        };
    }, []);

    // Do not show on session execution pages
    const isSessionPage = pathname?.startsWith('/session');
    if (!isClient || dismissed || isSessionPage) {
        return null;
    }

    const sessionHref = activeSetlist
        ? `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(activeSetlist.id)}&team=${encodeURIComponent(teamId)}`
        : `/session/${DEMO_SESSION_ID}`;

    const teamSessionHref = activeSetlist
        ? `/session/${DEMO_SESSION_ID}/team?setlist=${encodeURIComponent(activeSetlist.id)}&team=${encodeURIComponent(teamId)}`
        : `/session/${DEMO_SESSION_ID}/team`;

    const songCount = activeSetlist?.song_order?.length ?? 0;
    const title = activeSetlist?.title ?? '라이브 예배 세션';

    return (
        <aside
            aria-label="라이브 예배 빠른 실행 바"
            className="fixed z-40 animate-in fade-in slide-in-from-bottom-3 duration-200 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] inset-x-3 sm:inset-x-6 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-96"
        >
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-2.5 sm:p-3 shadow-xl backdrop-blur-md ring-1 ring-black/5 dark:ring-white/10">
                {/* 세션 상태 정보 */}
                <Link
                    href={sessionHref}
                    className="flex flex-1 min-w-0 items-center gap-2.5 group"
                    title="무대 모드로 이동"
                >
                    <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {isToday ? (
                            <>
                                <Radio size={18} className="animate-pulse text-destructive" />
                                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive animate-ping" />
                            </>
                        ) : (
                            <Music2 size={18} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                    isToday
                                        ? 'bg-destructive/15 text-destructive font-black'
                                        : 'bg-primary/15 text-primary'
                                }`}
                            >
                                <Sparkles size={10} />
                                {isToday ? 'TODAY LIVE' : '준비 중인 콘티'}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">{teamName}</span>
                        </div>
                        <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {title}
                        </p>
                        {songCount > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                                총 {songCount}곡 편성 · 실시간 큐 연동
                            </p>
                        )}
                    </div>
                </Link>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                        href={teamSessionHref}
                        className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        title="팀원 화면으로 입장"
                    >
                        <Users size={13} className="text-secondary" />
                        <span>팀뷰</span>
                    </Link>
                    <Link
                        href={sessionHref}
                        className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95"
                    >
                        <Radio size={13} />
                        <span>무대 모드</span>
                        <ChevronRight size={13} />
                    </Link>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="미니 플레이어 닫기"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
