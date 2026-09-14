import React, { Suspense } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import ThemeToggle from '@/components/ui/ThemeToggle';
import AccountMenu from '@/components/auth/AccountMenu';
import PlanningInbox from '@/components/planning/PlanningInbox';
import MobileNav from './MobileNav';
import { primaryNavItems, secondaryNavItems } from './navItems';
import Link from 'next/link';

interface DashboardLayoutProps {
    children: React.ReactNode;
    currentPath?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPath = '/dashboard' }) => {
    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Suspense fallback={null}><PlanningInbox /></Suspense>

            {/* 데스크톱 사이드바 */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
                <div className="p-6">
                    <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-2.5 rounded-xl transition-opacity hover:opacity-80">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-serif font-bold text-lg shadow-xs">
                            W
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-serif font-bold tracking-tight text-primary">Worship Together</span>
                            <span className="text-[11px] font-medium text-muted-foreground">함께 준비하는 예배</span>
                        </div>
                    </Link>
                </div>

                <nav aria-label="주 메뉴" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
                    <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        예배 운영
                    </div>
                    {primaryNavItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                }`}
                            >
                                <item.icon size={19} className="shrink-0" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}

                    <div className="mt-4 px-3 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        나눔과 돌봄
                    </div>
                    {secondaryNavItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                }`}
                            >
                                <item.icon size={19} className="shrink-0" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="space-y-3 p-4 border-t border-border/60">
                    <ThemeToggle />
                    <div className="[&_details>div]:bottom-[calc(100%+8px)] [&_details>div]:left-0 [&_details>div]:right-auto [&_details>div]:top-auto">
                        <Suspense fallback={<p role="status" className="min-h-10 py-2 text-sm text-muted-foreground">계정 확인 중…</p>}>
                            <AccountMenu />
                        </Suspense>
                    </div>
                    <GlassCard className="flex items-center gap-3 border-border/60 p-3 bg-muted/40">
                        <div className="h-8 w-8 rounded-lg bg-secondary/15 flex items-center justify-center font-bold text-secondary text-xs">
                            WT
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-xs font-bold text-foreground">Worship Together</p>
                            <p className="truncate text-[11px] text-muted-foreground">모바일·웹 예배 플랫폼</p>
                        </div>
                    </GlassCard>
                </div>
            </aside>

            {/* 메인 영역 */}
            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
                {/* 모바일 상단 헤더 */}
                <header className="sticky top-0 z-30 border-b border-border/80 bg-card/85 backdrop-blur-md pt-[env(safe-area-inset-top)] shadow-2xs lg:hidden">
                    <div className="safe-area-x flex h-14 items-center justify-between gap-2">
                        <Link href="/dashboard" aria-label="Worship Together 홈" className="inline-flex min-h-12 min-w-0 items-center gap-2 font-serif font-bold text-sm min-[360px]:text-base text-primary">
                            <span aria-hidden="true" className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold font-serif min-[360px]:flex">
                                W
                            </span>
                            <span className="truncate">Worship Together</span>
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                            <ThemeToggle />
                            <Suspense fallback={<div className="size-8 rounded-full bg-muted animate-pulse" />}>
                                <AccountMenu />
                            </Suspense>
                        </div>
                    </div>
                </header>

                {/* 메인 콘텐츠 영역 */}
                <main className="flex-1 p-4 pb-28 sm:p-6 sm:pb-32 md:p-8 lg:p-10 lg:pb-24 max-w-7xl w-full mx-auto">
                    {children}
                </main>

                {/* 모바일 하단 내비게이션 바 */}
                <MobileNav currentPath={currentPath} />
            </div>
        </div>
    );
};

export default DashboardLayout;
