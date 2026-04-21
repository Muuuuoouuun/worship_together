import React from 'react';
import GlassCard from '@/components/ui/GlassCard';
import {
    BadgeCheck,
    HandHeart,
    HeartHandshake,
    LayoutGrid,
    ListMusic,
    LogOut,
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
    { icon: LayoutGrid, label: 'Today', href: '/dashboard' },
    { icon: HeartHandshake, label: 'Community', href: '/community' },
    { icon: HandHeart, label: 'Care', href: '/care' },
    { icon: BadgeCheck, label: 'Serve', href: '/serve' },
    { icon: UsersRound, label: 'Groups', href: '/groups' },
    { icon: ListMusic, label: 'Library', href: '/dashboard/songs' },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPath = '/dashboard' }) => {
    const currentLabel = navItems.find((item) => item.href === currentPath)?.label ?? 'Today';

    return (
        <div className="flex min-h-screen">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-primary/5 bg-background/50 backdrop-blur-md lg:flex">
                <div className="p-8">
                    <Link href="/dashboard">
                        <h1 className="text-xl font-serif font-bold text-primary">WorshipTogether</h1>
                    </Link>
                </div>

                <nav className="flex flex-1 flex-col gap-2 px-4">
                    {navItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${active
                                    ? 'bg-primary font-bold text-surface shadow-md'
                                    : 'text-primary/60 hover:bg-primary/5 hover:text-primary'
                                    }`}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4">
                    <GlassCard className="flex items-center gap-3 border-transparent p-3">
                        <div className="h-8 w-8 rounded-md bg-secondary/15" />
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-bold text-primary">Community Host</p>
                            <p className="truncate text-xs text-primary/40">Demo workspace</p>
                        </div>
                        <LogOut size={16} className="text-primary/40" />
                    </GlassCard>
                </div>
            </aside>

            <div className="flex flex-1 flex-col lg:ml-64">
                <header className="sticky top-0 z-30 border-b border-primary/5 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
                    <div className="safe-area-x flex items-center justify-between py-4">
                        <Link href="/dashboard" className="text-lg font-serif font-bold text-primary">
                            WorshipTogether
                        </Link>
                        <span className="rounded-full bg-primary/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/50">
                            {currentLabel}
                        </span>
                    </div>
                    <nav className="safe-area-x no-scrollbar flex gap-2 overflow-x-auto pb-4">
                        {navItems.map((item) => {
                            const active = currentPath === item.href;

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`tap-target inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active
                                        ? 'bg-primary text-surface shadow-md'
                                        : 'border border-primary/10 bg-white/70 text-primary/70 hover:bg-white hover:text-primary'
                                        }`}
                                >
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </header>

                <main className="app-bottom-space flex-1 p-4 sm:p-6 md:p-10 lg:p-12 lg:pb-32">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
