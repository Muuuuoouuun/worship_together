import React, { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import AppToaster from '@/components/app/AppToaster';
import TeamConnection, { type TeamConnectionInput } from '@/components/app/TeamConnection';
import TeamSwitcher from '@/components/app/TeamSwitcher';
import TeamParamSync from '@/components/app/TeamParamSync';
import { can, isAdmin } from '@/lib/permissions';
import { getViewer } from '@/lib/server/viewer';
import AccountMenu from '@/components/auth/AccountMenu';
import PlanningInbox from '@/components/planning/PlanningInbox';
import LiveSessionMiniBar from '@/components/session/LiveSessionMiniBar';
import MobileNav from './MobileNav';
import SidebarNav from './SidebarNav';

function Brand({ compact = false }: { compact?: boolean }) {
    return (
        <Link href="/dashboard" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl transition-opacity hover:opacity-80">
            <span aria-hidden="true" className={compact ? 'flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground' : 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground'}>
                W
            </span>
            <span className="min-w-0">
                <span className={compact ? 'block truncate text-[15px] font-bold tracking-tight text-foreground' : 'block text-[17px] font-bold tracking-tight text-foreground'}>Worship Together</span>
                {!compact && <span className="block text-[11px] text-muted-foreground">함께 준비하는 예배</span>}
            </span>
        </Link>
    );
}

function LogoMark() {
    return (
        <Link href="/dashboard" aria-label="Worship Together 홈" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-80">
            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">W</span>
        </Link>
    );
}

/**
 * 앱 공통 틀(사이드바·모바일 헤더·하단 내비·라이브 미니바·알림 자리).
 * app/(app)/layout.tsx 에서 한 번만 그리므로 화면을 옮겨도 다시 만들어지지 않습니다.
 * 본문 폭과 여백도 여기서 한 번만 정합니다.
 * 로그인한 사람은 지금 팀과 실시간으로 이어지고(TeamConnection), 팀이 없으면 시작 화면(/welcome)으로 갑니다.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const viewer = await getViewer();
    if (viewer && !viewer.teams.length && !viewer.profile.onboardedAt) redirect('/welcome');
    const connection: TeamConnectionInput | null = viewer?.team && viewer.member
        ? {
            userId: viewer.user.id,
            userName: viewer.profile.name,
            teamId: viewer.team.id,
            teamName: viewer.team.name,
            teams: viewer.teams.map((team) => ({ id: team.id, name: team.name })),
            isAdmin: isAdmin(viewer.member),
            canRun: can(viewer.member, viewer.policy, 'sessionRun'),
            canEditConti: can(viewer.member, viewer.policy, 'contiEdit'),
            policy: viewer.policy,
        }
        : null;
    const switcher = (variant: 'sidebar' | 'compact') => connection ? (
        <Suspense fallback={null}>
            <TeamSwitcher teams={connection.teams} currentId={connection.teamId} variant={variant} />
        </Suspense>
    ) : null;
    return (
        <TeamConnection value={connection}>
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-xl bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only">본문으로 건너뛰기</a>
        <div className="flex min-h-screen bg-background text-foreground [--app-header-h:calc(env(safe-area-inset-top)+3.5rem)] lg:[--app-header-h:0px]">
            <Suspense fallback={null}>
                <PlanningInbox />
            </Suspense>

            {/* 데스크톱 사이드바 */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/70 bg-card lg:flex">
                <div className="space-y-3 px-4 pb-4 pt-6">
                    <div className="px-2">
                        <Brand />
                    </div>
                    {switcher('sidebar')}
                </div>
                <SidebarNav />
                <div className="flex flex-col items-start gap-2 border-t border-border/70 p-4 [&_details>div]:bottom-[calc(100%+8px)] [&_details>div]:left-0 [&_details>div]:right-auto [&_details>div]:top-auto">
                    <ThemeToggle />
                    <Suspense fallback={<p role="status" className="min-h-10 py-2 text-sm text-muted-foreground">계정 확인 중…</p>}>
                        <AccountMenu />
                    </Suspense>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
                {/* 모바일 상단 헤더 */}
                <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
                    <div className="safe-area-x flex h-14 items-center justify-between gap-2">
                        {connection ? (
                            <div className="-ml-2 flex min-w-0 items-center">
                                <LogoMark />
                                {switcher('compact')}
                            </div>
                        ) : <Brand compact />}
                        <div className="flex shrink-0 items-center gap-2">
                            <ThemeToggle />
                            <Suspense fallback={<div className="size-10 animate-pulse rounded-full bg-muted" />}>
                                <AccountMenu />
                            </Suspense>
                        </div>
                    </div>
                </header>

                {/* 본문: 모든 화면이 같은 폭·여백을 씁니다 */}
                <main id="main-content" tabIndex={-1} className="w-full flex-1 px-4 pb-32 pt-5 outline-none sm:px-6 sm:pb-36 sm:pt-6 lg:px-10 lg:pb-24 lg:pt-10">
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">{children}</div>
                </main>

                <LiveSessionMiniBar />
                <MobileNav />
            </div>
            <AppToaster />
            {connection ? (
                <Suspense fallback={null}>
                    <TeamParamSync currentId={connection.teamId} teamIds={connection.teams.map((team) => team.id)} />
                </Suspense>
            ) : null}
        </div>
        </TeamConnection>
    );
}
