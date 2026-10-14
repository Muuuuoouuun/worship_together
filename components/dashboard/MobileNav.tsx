'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { isNavActive, primaryNavItems, secondaryNavItems } from './navItems';

const tab = 'relative flex select-none flex-col items-center justify-center gap-1 transition-colors';

/** 모바일 하단 내비게이션 + 더보기 시트 */
export default function MobileNav() {
    const pathname = usePathname() ?? '';
    const [moreOpen, setMoreOpen] = useState(false);
    const secondaryActive = secondaryNavItems.some((item) => isNavActive(pathname, item.href));

    return (
        <>
            <nav aria-label="하단 모바일 내비게이션" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
                <div className="safe-area-x grid h-16 grid-cols-5">
                    {primaryNavItems.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        return (
                            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(tab, active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" aria-hidden="true" />}
                                <item.icon size={20} aria-hidden="true" />
                                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}
                    <button type="button" onClick={() => setMoreOpen(true)} aria-label="더보기 메뉴 열기" className={cn(tab, secondaryActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        {secondaryActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" aria-hidden="true" />}
                        <Menu size={20} aria-hidden="true" />
                        <span className="text-[11px] leading-tight tracking-tight">더보기</span>
                    </button>
                </div>
            </nav>

            <Modal open={moreOpen} onOpenChange={setMoreOpen} title="더보기" description="나눔, 돌봄, 섬김, 그룹">
                <ul className="divide-y divide-border/70">
                    {secondaryNavItems.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        return (
                            <li key={item.href}>
                                <Link href={item.href} onClick={() => setMoreOpen(false)} aria-current={active ? 'page' : undefined} className="flex items-center gap-3.5 py-3.5">
                                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                                        <item.icon size={18} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={cn('block text-[15px] text-foreground', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
                                        <span className="block text-xs text-muted-foreground">{item.description}</span>
                                    </span>
                                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </Modal>
        </>
    );
}
