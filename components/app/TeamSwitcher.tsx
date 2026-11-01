'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { selectTeam } from '@/actions/teamActions';
import { showAppToast } from '@/lib/appToast';

/**
 * 지금 팀 바꾸기. 고른 팀은 서버(쿠키)에 기억되어 홈 · 콘티 · 일정 · 팀 · 예배가 모두 같은 팀을 봅니다.
 * - sidebar: 데스크톱 사이드바의 넓은 버튼
 * - compact: 모바일 헤더의 팀 이름 버튼
 */
export default function TeamSwitcher({ teams, currentId, variant }: { teams: { id: string; name: string }[]; currentId: string; variant: 'sidebar' | 'compact' }) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const menuId = useId();
    const root = useRef<HTMLDivElement | null>(null);
    const current = teams.find((team) => team.id === currentId) ?? teams[0];

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    function choose(teamId: string) {
        setOpen(false);
        if (teamId === currentId) return;
        startTransition(async () => {
            const result = await selectTeam(teamId);
            if (!result.ok) {
                showAppToast({ tone: 'danger', title: result.error });
                return;
            }
            // 주소에 다른 팀이 적혀 있으면 지우고 새 팀으로 다시 그립니다.
            if (params.has('team')) {
                const next = new URLSearchParams(params);
                next.delete('team');
                router.replace(next.size ? `${pathname}?${next}` : pathname);
            }
            router.refresh();
            showAppToast({ group: 'team-switch', tone: 'success', title: `${teams.find((team) => team.id === teamId)?.name ?? '팀'}으로 바꿨어요`, ttl: 2500 });
        });
    }

    if (!current) return null;
    const sidebar = variant === 'sidebar';

    return (
        <div ref={root} className={cn('relative min-w-0', sidebar && 'w-full')}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={`지금 팀 ${current.name}, 팀 바꾸기`}
                disabled={pending}
                className={cn(
                    'flex min-w-0 items-center gap-2 text-left transition-colors disabled:opacity-60',
                    sidebar
                        ? 'w-full rounded-2xl bg-muted/70 px-3.5 py-2.5 hover:bg-muted'
                        : 'h-10 max-w-[11rem] rounded-full px-3 hover:bg-muted',
                )}
            >
                <span className="min-w-0 flex-1">
                    {sidebar ? <span className="block text-[11px] text-muted-foreground">지금 팀</span> : null}
                    <span className={cn('block truncate font-semibold tracking-tight text-foreground', sidebar ? 'text-sm' : 'text-[15px]')}>{current.name}</span>
                </span>
                <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {open ? (
                <div
                    id={menuId}
                    className={cn(
                        'absolute z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-card p-1.5 text-card-foreground shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-border animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none',
                        sidebar ? 'left-0 right-0 w-auto' : 'left-0',
                    )}
                >
                    <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">내 팀</p>
                    <ul>
                        {teams.map((team) => {
                            const active = team.id === current.id;
                            return (
                                <li key={team.id}>
                                    <button
                                        type="button"
                                        onClick={() => choose(team.id)}
                                        aria-current={active ? 'true' : undefined}
                                        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors hover:bg-muted"
                                    >
                                        <span className={cn('min-w-0 flex-1 truncate', active ? 'font-semibold' : 'font-medium')}>{team.name}</span>
                                        {active ? <Check aria-hidden="true" className="size-4 shrink-0 text-brand" /> : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="mt-1 border-t border-border pt-1">
                        <Link href="/dashboard/team" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-muted">
                            <Settings2 aria-hidden="true" className="size-4 text-muted-foreground" />
                            팀 · 초대 · 권한 관리
                        </Link>
                        <Link href="/welcome?step=team" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-muted">
                            <Plus aria-hidden="true" className="size-4 text-muted-foreground" />
                            새 팀 만들기 · 초대 코드로 참여
                        </Link>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
