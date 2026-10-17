"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music2, Radio, Users, X } from 'lucide-react';
import { readPrototypeLibrary, LIBRARY_CHANGED_EVENT } from '@/lib/libraryPrototypeStorage';
import { getTeamSnapshot, parseTeamSnapshot, TEAM_STORAGE_EVENT, TEAM_STORAGE_KEY } from '@/lib/teamPrototype';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';

/** 바가 그리는 값만 담습니다. 모두 원시값이라 내용이 같으면 이전 상태를 그대로 둡니다. */
type MiniBarState = {
    teamId: string;
    teamName: string;
    setlistId: string | null;
    title: string;
    songCount: number;
    isToday: boolean;
};

const LIBRARY_KEY_PREFIX = 'worship-together:library:v1:';

const INITIAL_STATE: MiniBarState = {
    teamId: DEMO_TEAM_ID,
    teamName: '예배팀',
    setlistId: null,
    title: '라이브 예배 세션',
    songCount: 0,
    isToday: false,
};

function sameState(a: MiniBarState, b: MiniBarState) {
    return (Object.keys(a) as (keyof MiniBarState)[]).every((key) => a[key] === b[key]);
}

function readMiniBarState(): MiniBarState {
    const snapshot = parseTeamSnapshot(getTeamSnapshot());
    const activeTeam = snapshot.teams[0];
    const teamId = activeTeam?.id ?? DEMO_TEAM_ID;
    const teamName = activeTeam?.name ?? '예배팀';
    const lib = readPrototypeLibrary(teamId);

    if (!lib || !Array.isArray(lib.setlists) || lib.setlists.length === 0) {
        return { ...INITIAL_STATE, teamId, teamName };
    }

    const now = Date.now();
    const ordered = [...lib.setlists].sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date));
    const next = ordered.find((item) => Date.parse(item.worship_date) >= now - 1000 * 60 * 60 * 12) ?? ordered[ordered.length - 1];

    return {
        teamId,
        teamName,
        setlistId: next?.id ?? null,
        title: next?.title ?? INITIAL_STATE.title,
        songCount: next?.song_order?.length ?? 0,
        isToday: next ? new Date(next.worship_date).toDateString() === new Date().toDateString() : false,
    };
}

export default function LiveSessionMiniBar() {
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const [dismissed, setDismissed] = useState(false);
    const [state, setState] = useState<MiniBarState>(INITIAL_STATE);
    // 공통 틀은 화면을 옮겨도 다시 만들어지지 않으므로, 화면이 바뀔 때마다 다시 읽습니다 (오늘 여부·다음 콘티).
    const pathname = usePathname();

    useEffect(() => {
        let active = true;
        const refresh = () => {
            if (!active) return;
            try {
                const next = readMiniBarState();
                setState((prev) => (sameState(prev, next) ? prev : next));
            } catch {
                // Ignore storage parse errors
            }
        };
        // 다른 탭이 악보·무대 설정 같은 관련 없는 키를 바꿀 때는 다시 읽지 않습니다.
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === TEAM_STORAGE_KEY || event.key.startsWith(LIBRARY_KEY_PREFIX)) refresh();
        };

        queueMicrotask(refresh);
        window.addEventListener('storage', onStorage);
        window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
        // 같은 탭에서 팀을 만들거나 바꾸면 바로 반영합니다.
        window.addEventListener(TEAM_STORAGE_EVENT, refresh);

        return () => {
            active = false;
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh);
            window.removeEventListener(TEAM_STORAGE_EVENT, refresh);
        };
    }, [pathname]);

    if (!isClient || dismissed) {
        return null;
    }

    const { teamId, teamName, setlistId, title, songCount, isToday } = state;
    const query = setlistId ? `?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(teamId)}` : '';
    const sessionHref = `/session/${DEMO_SESSION_ID}${query}`;
    const teamSessionHref = `/session/${DEMO_SESSION_ID}/team${query}`;

    return (
        <aside
            aria-label="라이브 예배 빠른 실행 바"
            className="fixed z-40 animate-in fade-in slide-in-from-bottom-3 duration-200 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] inset-x-3 sm:inset-x-6 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[28rem]"
        >
            <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-none">
                {/* 세션 상태 정보 */}
                <Link
                    href={sessionHref}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                    title="무대 모드로 이동"
                >
                    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        {isToday ? <Radio size={18} aria-hidden="true" /> : <Music2 size={18} aria-hidden="true" />}
                        {isToday && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-secondary" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-muted-foreground">
                            {isToday ? <span className="font-semibold text-brand">오늘 예배</span> : '준비 중인 콘티'}
                            {` · ${teamName}`}
                            {songCount > 0 ? ` · ${songCount}곡` : ''}
                        </span>
                        <span className="block truncate text-sm font-semibold text-foreground">
                            {title}
                        </span>
                    </span>
                </Link>

                {/* 액션 버튼 */}
                <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                        href={teamSessionHref}
                        className="hidden h-9 items-center gap-1 whitespace-nowrap rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:inline-flex"
                        title="팀원 화면으로 입장"
                    >
                        <Users size={13} className="text-muted-foreground" aria-hidden="true" />
                        <span>팀뷰</span>
                    </Link>
                    <Link
                        href={sessionHref}
                        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Radio size={13} aria-hidden="true" />
                        <span>무대 모드</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="미니 플레이어 닫기"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
