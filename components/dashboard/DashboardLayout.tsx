import React, { Suspense } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import ThemeToggle from '@/components/ui/ThemeToggle';
import AccountMenu from '@/components/auth/AccountMenu';
import PlanningInbox from '@/components/planning/PlanningInbox';
import {
    BadgeCheck,
    CalendarDays,
    HandHeart,
    HeartHandshake,
    LayoutGrid,
    ListMusic,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardLayoutProps {
    children: React.ReactNode;
    currentPath?: string;
}

type NavItem = {
    icon: LucideIcon;
    label: string;
    href: string;
};

const navItems: NavItem[] = [
    { icon: LayoutGrid, label: '오늘', href: '/dashboard' },
    { icon: ListMusic, label: '콘티·악보', href: '/dashboard/songs' },
    { icon: UsersRound, label: '팀·초대', href: '/dashboard/team' },
    { icon: CalendarDays, label: '일정·요청', href: '/dashboard/planning' },
    { icon: HeartHandshake, label: '팀 커뮤니티', href: '/community' },
    { icon: HandHeart, label: '케어', href: '/care' },
    { icon: BadgeCheck, label: '섬김', href: '/serve' },
    { icon: UsersRound, label: '그룹', href: '/groups' },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPath = '/dashboard' }) => {
    return (
        <div className="flex min-h-screen">
            <Suspense fallback={null}><PlanningInbox /></Suspense>
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
                <div className="p-8">
                    <Link href="/dashboard" className="inline-flex min-h-12 items-center rounded-lg">
                        <h1 className="text-xl font-serif font-bold text-primary">Worship Together</h1>
                    </Link>
                </div>

                <nav aria-label="주 메뉴" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-1">
                    {navItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-colors ${active
                                    ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="space-y-3 p-4">
                    <ThemeToggle />
                    <div className="[&_details>div]:bottom-[calc(100%+8px)] [&_details>div]:left-0 [&_details>div]:right-auto [&_details>div]:top-auto">
                        <Suspense fallback={<p role="status" className="min-h-12 py-3 text-sm text-muted-foreground">계정 확인 중…</p>}>
                            <AccountMenu />
                        </Suspense>
                    </div>
                    <GlassCard className="flex items-center gap-3 border-transparent p-3">
                        <div className="h-8 w-8 rounded-md bg-secondary/15" />
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-bold text-primary">함께 준비하는 예배</p>
                            <p className="truncate text-xs text-muted-foreground">웹 프로토타입</p>
                        </div>
                    </GlassCard>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
                <header className="sticky top-0 z-30 border-b border-border bg-card pt-[env(safe-area-inset-top)] shadow-sm lg:hidden">
                    <div className="safe-area-x flex flex-wrap items-center justify-between gap-2 py-2">
                        <Link href="/dashboard" className="inline-flex min-h-12 items-center rounded-lg text-base font-serif font-bold text-primary sm:text-lg">
                            Worship Together
                        </Link>
                        <div className="ml-auto flex min-w-0 items-center gap-2">
                            <ThemeToggle />
                            <Suspense fallback={<p role="status" className="min-h-12 py-3 text-sm text-muted-foreground">계정 확인 중…</p>}>
                                <AccountMenu />
                            </Suspense>
                        </div>
                    </div>
                    <nav aria-label="주 메뉴" className="safe-area-x grid grid-cols-4 gap-1 pb-3 sm:gap-2">
                        {navItems.slice(0, 4).map((item) => {
                            const active = currentPath === item.href;

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`tap-target inline-flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold transition sm:flex-row sm:px-2 sm:text-sm ${active
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'border border-border bg-card text-foreground hover:bg-muted'
                                        }`}
                                >
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    <details className="safe-area-x pb-1 text-sm text-muted-foreground">
                        <summary className="min-h-12 cursor-pointer rounded-lg py-3">나눔·돌봄 더 보기</summary>
                        <div className="flex flex-wrap gap-3 py-2">{navItems.slice(4).map((item) => <Link className="tap-target inline-flex items-center rounded-lg border border-border bg-card px-3 text-foreground hover:bg-muted" key={item.href} href={item.href}>{item.label}</Link>)}</div>
                    </details>
                </header>

                <main className="app-bottom-space flex-1 p-4 sm:p-6 md:p-10 lg:p-12 lg:pb-32">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
