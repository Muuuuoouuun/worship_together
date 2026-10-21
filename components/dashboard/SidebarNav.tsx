'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavActive, primaryNavItems, secondaryNavItems, type NavItem } from './navItems';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    return (
        <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex min-h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors',
                active ? 'bg-primary font-semibold text-primary-foreground' : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            <item.icon size={18} className="shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
        </Link>
    );
}

/** 데스크톱 사이드바 메뉴. 레이아웃은 다시 그려지지 않으므로 현재 주소는 여기서 읽습니다. */
export default function SidebarNav() {
    const pathname = usePathname() ?? '';
    return (
        <nav aria-label="주 메뉴" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
            <p className="px-4 pb-2 text-[11px] font-medium text-muted-foreground">예배 운영</p>
            {primaryNavItems.map((item) => (
                <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
            ))}
            <p className="mt-5 px-4 pb-2 text-[11px] font-medium text-muted-foreground">나눔과 돌봄 · 준비 중</p>
            {secondaryNavItems.map((item) => (
                <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
            ))}
        </nav>
    );
}
