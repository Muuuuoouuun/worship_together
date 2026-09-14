"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { ChevronRight, Menu } from 'lucide-react';
import { primaryNavItems, secondaryNavItems } from './navItems';

interface MobileNavProps {
    currentPath: string;
}

export default function MobileNav({ currentPath }: MobileNavProps) {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const isSecondaryActive = secondaryNavItems.some((item) => currentPath === item.href);

    return (
        <>
            {/* 모바일 하단 고정 내비게이션 바 */}
            <nav
                aria-label="하단 모바일 내비게이션"
                className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-card/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] lg:hidden shadow-lg"
            >
                <div className="grid grid-cols-5 h-16 safe-area-x">
                    {primaryNavItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={`relative flex flex-col items-center justify-center gap-1 transition-colors select-none ${
                                    active
                                        ? 'text-primary font-bold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {active && (
                                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                                )}
                                <item.icon size={20} className={active ? 'scale-110 transition-transform' : ''} />
                                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}

                    {/* 더보기 메뉴 버튼 */}
                    <button
                        type="button"
                        onClick={() => setIsMoreMenuOpen(true)}
                        aria-label="더보기 메뉴 열기"
                        className={`relative flex flex-col items-center justify-center gap-1 transition-colors select-none ${
                            isSecondaryActive
                                ? 'text-primary font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {isSecondaryActive && (
                            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                        )}
                        <Menu size={20} className={isSecondaryActive ? 'scale-110 transition-transform' : ''} />
                        <span className="text-[11px] leading-tight tracking-tight">더보기</span>
                    </button>
                </div>
            </nav>

            {/* 모바일 더보기 바텀시트 모달 */}
            <Modal
                open={isMoreMenuOpen}
                onOpenChange={setIsMoreMenuOpen}
                title="더보기 메뉴"
                description="나눔, 돌봄, 봉사 등 팀 커뮤니티로 연결됩니다."
            >
                <div className="space-y-2 py-2">
                    {secondaryNavItems.map((item) => {
                        const active = currentPath === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMoreMenuOpen(false)}
                                className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                                    active
                                        ? 'border-primary bg-primary/10 text-primary font-bold'
                                        : 'border-border bg-card text-foreground hover:bg-muted'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`flex size-10 items-center justify-center rounded-xl ${
                                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        <item.icon size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-muted-foreground" />
                            </Link>
                        );
                    })}
                </div>
            </Modal>
        </>
    );
}
