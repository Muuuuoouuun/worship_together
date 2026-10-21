'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Hourglass, ListMusic, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import Notice from '@/components/ui/Notice';
import { buildLiveSnapshot, type LiveSnapshotInput } from '@/lib/liveSnapshot';
import { registerOnlineTeams, syncTeam } from '@/lib/teamDocSync';
import { subscribeTeamStream } from '@/lib/teamStream';
import type { LiveSessionSummary } from '@/lib/server/liveRepository';
import { liveSessionHref } from './links';

type Phase =
    | { kind: 'checking' }
    | { kind: 'confirm'; snapshot: LiveSnapshotInput }
    | { kind: 'starting' }
    | { kind: 'waiting' }
    | { kind: 'error'; message: string };

/**
 * 예배 시작 · 입장 대기. 휴대폰 한 손 기준 한 화면.
 * - 진행 중인 예배가 있으면 바로 들어갑니다.
 * - 시작 권한이 있으면 최신 콘티를 받아 와 확인 화면 → '예배 시작' (팀원 모두에게 알림)
 * - 권한이 없으면 인도자가 시작할 때까지 기다리다 시작되면 저절로 들어갑니다.
 */
export default function LiveStart({ teamId, teamName, teamIds, setlistId, canRun, leaders }: { teamId: string; teamName: string; teamIds: string[]; setlistId: string | null; canRun: boolean; leaders: string[] }) {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

    useEffect(() => {
        let active = true;
        const enter = (session: Pick<LiveSessionSummary, 'id'>) => router.replace(liveSessionHref(session.id));
        (async () => {
            try {
                const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/live`, { cache: 'no-store' });
                const body = await response.json().catch(() => ({})) as { session?: LiveSessionSummary | null; error?: string };
                if (!active) return;
                if (!response.ok) throw new Error(body.error ?? '팀 예배 정보를 읽지 못했어요.');
                if (body.session) { enter(body.session); return; }
                if (!canRun) { setPhase({ kind: 'waiting' }); return; }
                // 다른 팀원이 방금 바꾼 콘티까지 받아 온 뒤 사본을 만듭니다.
                registerOnlineTeams(teamIds);
                await syncTeam(teamId);
                if (!active) return;
                setPhase({ kind: 'confirm', snapshot: buildLiveSnapshot(teamId, setlistId) });
            } catch (error) {
                if (active) setPhase({ kind: 'error', message: error instanceof Error ? error.message : '예배를 열지 못했어요.' });
            }
        })();
        // 기다리는 동안(또는 확인 화면에서) 다른 사람이 먼저 시작하면 그 예배로 들어갑니다.
        const unsubscribe = subscribeTeamStream(teamId, (event) => {
            if (event.type === 'live.started') enter(event.payload as LiveSessionSummary);
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, [teamId, teamIds, setlistId, canRun, router]);

    async function start(snapshot: LiveSnapshotInput) {
        setPhase({ kind: 'starting' });
        try {
            const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshot }),
            });
            const body = await response.json().catch(() => ({})) as { session?: LiveSessionSummary; error?: string };
            if (!response.ok || !body.session) throw new Error(body.error ?? '예배를 시작하지 못했어요.');
            router.replace(liveSessionHref(body.session.id));
        } catch (error) {
            setPhase({ kind: 'error', message: error instanceof Error ? error.message : '예배를 시작하지 못했어요.' });
        }
    }

    const leaderText = useMemo(() => (leaders.length ? `${leaders.slice(0, 2).join(', ')}${leaders.length > 2 ? ` 외 ${leaders.length - 2}명` : ''}` : '인도자'), [leaders]);

    return (
        <main className="flex min-h-dvh flex-col bg-background px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),0.5rem)] text-foreground sm:items-center sm:justify-center sm:py-10">
            <section className="flex w-full max-w-[440px] flex-1 flex-col sm:flex-none sm:rounded-[28px] sm:border sm:border-border sm:bg-card sm:p-8">
                <div className="flex h-12 items-center">
                    <Link href="/dashboard" aria-label="홈으로" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), '-ml-3')}>
                        <ChevronLeft className="size-[22px]" aria-hidden="true" />
                    </Link>
                    <p className="ml-1 truncate text-sm font-medium text-muted-foreground">{teamName}</p>
                </div>

                {phase.kind === 'checking' || phase.kind === 'starting' ? (
                    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
                        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                            <Radio className="size-6 motion-safe:animate-pulse" aria-hidden="true" />
                        </span>
                        <p className="text-[15px] font-medium">{phase.kind === 'starting' ? '예배를 여는 중…' : '팀 예배를 확인하는 중…'}</p>
                    </div>
                ) : phase.kind === 'waiting' ? (
                    <div className="flex flex-1 flex-col">
                        <div className="mt-8">
                            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted"><Hourglass className="size-[22px]" aria-hidden="true" /></span>
                            <h1 className="mt-5 text-2xl font-semibold leading-tight tracking-tight">{leaderText}님이 시작하면<br />바로 들어가요</h1>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">이 화면을 켜 두세요. 예배가 시작되면 저절로 예배 화면으로 넘어가요. 다른 화면에 있어도 알림이 와요.</p>
                        </div>
                        <p role="status" className="mt-8 flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-3 text-sm">
                            <span className="size-2 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" aria-hidden="true" />
                            시작을 기다리는 중
                        </p>
                        <div className="mt-auto grid gap-2 pt-8">
                            <Link href="/dashboard/songs" className={buttonVariants({ variant: 'outline', size: 'lg' })}>콘티 미리 보기</Link>
                        </div>
                    </div>
                ) : phase.kind === 'confirm' ? (
                    <div className="flex flex-1 flex-col">
                        <div className="mt-6">
                            <p className="text-xs font-medium text-muted-foreground">{phase.snapshot.dateLabel ?? '예배'}</p>
                            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight">{phase.snapshot.title}</h1>
                            {phase.snapshot.theme ? <p className="mt-1 text-sm text-muted-foreground">{phase.snapshot.theme}</p> : null}
                        </div>
                        <ol aria-label="예배 순서" className="mt-6 divide-y divide-border border-y border-border">
                            {phase.snapshot.songs.map((song, index) => (
                                <li key={`${song.id}-${index}`} className="flex min-h-12 items-center gap-3 py-2.5">
                                    <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{song.title}</span>
                                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{[song.key, song.bpm ? `${song.bpm}` : null].filter(Boolean).join(' · ')}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                            <ListMusic className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            시작하면 팀원 모두에게 &lsquo;예배가 시작됐어요&rsquo; 알림이 가고, 들어온 사람은 내가 넘기는 곡 · 섹션을 함께 따라와요.
                        </p>
                        <div className="mt-auto grid gap-2 pt-8">
                            <Button size="lg" variant="brand" onClick={() => void start(phase.snapshot)}>
                                <Radio aria-hidden="true" />
                                예배 시작
                            </Button>
                            <Link href={setlistId ? `/dashboard/songs?tab=order&setlist=${encodeURIComponent(setlistId)}` : '/dashboard/songs'} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
                                콘티 먼저 고치기
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col">
                        <h1 className="mt-8 text-2xl font-semibold tracking-tight">예배를 열지 못했어요</h1>
                        <Notice tone="error" className="mt-4">{phase.message}</Notice>
                        <div className="mt-auto grid gap-2 pt-8">
                            <Link href="/dashboard/songs" className={buttonVariants({ size: 'lg' })}>콘티로 가기</Link>
                            <Link href="/dashboard" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>홈으로</Link>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
