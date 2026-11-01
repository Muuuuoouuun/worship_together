"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music2, Radio, Users, X } from 'lucide-react';
import { readPrototypeLibrary, LIBRARY_CHANGED_EVENT } from '@/lib/libraryPrototypeStorage';
import { getTeamSnapshot, parseTeamSnapshot, TEAM_STORAGE_EVENT, TEAM_STORAGE_KEY } from '@/lib/teamPrototype';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import { liveHref, useTeamConnection } from '@/components/app/TeamConnection';
import { liveStartHref } from '@/components/live/links';

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

/** online: 로그인한 지금 팀 (없으면 이 브라우저의 체험 팀) */
function readMiniBarState(online: { teamId: string; teamName: string } | null): MiniBarState {
    const snapshot = parseTeamSnapshot(getTeamSnapshot());
    const activeTeam = snapshot.teams[0];
    const teamId = online?.teamId ?? activeTeam?.id ?? DEMO_TEAM_ID;
    const teamName = online?.teamName ?? activeTeam?.name ?? '예배팀';
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
    // 닫은 바: 진행 중인 예배가 새로 시작되면(세션 id 가 바뀌면) 다시 보입니다.
    const [dismissed, setDismissed] = useState<string | null>(null);
    const [state, setState] = useState<MiniBarState>(INITIAL_STATE);
    // 공통 틀은 화면을 옮겨도 다시 만들어지지 않으므로, 화면이 바뀔 때마다 다시 읽습니다 (오늘 여부·다음 콘티).
    const pathname = usePathname();
    const connection = useTeamConnection();
    const onlineTeamId = connection?.teamId ?? null;
    const onlineTeamName = connection?.teamName ?? null;

    useEffect(() => {
        let active = true;
        const refresh = () => {
            if (!active) return;
            try {
                const next = readMiniBarState(onlineTeamId && onlineTeamName ? { teamId: onlineTeamId, teamName: onlineTeamName } : null);
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
    }, [pathname, onlineTeamId, onlineTeamName]);

    const live = connection?.live ?? null;
    const dismissKey = live ? `live:${live.id}` : 'next';
    // 홈(/dashboard)은 맨 위 '예배 진행 중' · 타일 안에 입장이 있으므로, 타일을 가리는 떠 있는 바를 두지 않습니다.
    if (!isClient || dismissed === dismissKey || pathname === '/dashboard') {
        return null;
    }

    if (live) {
        return (
            <aside
                aria-label="진행 중인 예배"
                className="fixed z-40 animate-in fade-in slide-in-from-bottom-3 duration-200 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] inset-x-3 sm:inset-x-6 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[28rem]"
            >
                <div className="flex items-center gap-3 rounded-3xl bg-brand p-2.5 text-brand-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-none">
                    <Link href={liveHref(live.id)} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-foreground/15">
                            <Radio size={18} aria-hidden="true" />
                            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-foreground motion-safe:animate-pulse" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] text-brand-foreground/75">예배 진행 중 · {live.present}명 접속</span>
                            <span className="block truncate text-sm font-semibold">{live.currentSongTitle ? `지금 「${live.currentSongTitle}」` : live.title}</span>
                        </span>
                    </Link>
                    <Link href={liveHref(live.id)} className="inline-flex h-9 shrink-0 items-center rounded-full bg-brand-foreground px-4 text-xs font-semibold text-brand transition-opacity hover:opacity-90">
                        입장
                    </Link>
                    <button
                        type="button"
                        onClick={() => setDismissed(dismissKey)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-brand-foreground/75 transition-colors hover:bg-brand-foreground/15 hover:text-brand-foreground"
                        aria-label="진행 중인 예배 바 닫기"
                    >
                        <X size={15} />
                    </button>
                </div>
            </aside>
        );
    }

    const { teamId, teamName, setlistId, title, songCount, isToday } = state;
    // 온라인 팀에 아직 콘티가 없으면 시작할 예배가 없으므로 바를 두지 않습니다 (빈 자리를 예시 제목으로 채우지 않음).
    if (connection && !setlistId) return null;
    const query = setlistId ? `?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(teamId)}` : '';
    // 온라인 팀은 서버 예배(팀원 모두 함께), 그 밖에는 이 기기의 예배 화면
    const sessionHref = connection ? liveStartHref(connection.teamId, setlistId) : `/session/${DEMO_SESSION_ID}${query}`;
    const teamSessionHref = connection ? sessionHref : `/session/${DEMO_SESSION_ID}/team${query}`;
    const startLabel = connection ? (connection.canRun ? '예배 시작' : '예배 대기') : '무대 모드';

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
                    title={connection ? '예배 화면으로' : '무대 모드로 이동'}
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
                    {connection ? null : (
                        <Link
                            href={teamSessionHref}
                            className="hidden h-9 items-center gap-1 whitespace-nowrap rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:inline-flex"
                            title="팀원 화면으로 입장"
                        >
                            <Users size={13} className="text-muted-foreground" aria-hidden="true" />
                            <span>팀뷰</span>
                        </Link>
                    )}
                    <Link
                        href={sessionHref}
                        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Radio size={13} aria-hidden="true" />
                        <span>{startLabel}</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setDismissed(dismissKey)}
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
