'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageTab<T extends string> {
    id: T;
    label: ReactNode;
    /** 탭 옆 숫자 (0 이면 숨김) */
    count?: number;
    /** 숫자를 주의 표시(주황)로 보여줄지 */
    attention?: boolean;
    icon?: ReactNode;
    controls?: string;
}

/**
 * 화면 안의 큰 구분 탭 (콘티·순서 리디자인의 밑줄 탭).
 * 선택 = 검정 글씨 + 검정 밑줄, 나머지 = 회색 글씨.
 */
export default function PageTabs<T extends string>({ tabs, value, onChange, label, className }: { tabs: PageTab<T>[]; value: T; onChange: (id: T) => void; label: string; className?: string }) {
    return (
        <div role="tablist" aria-label={label} className={cn('no-scrollbar flex gap-5 overflow-x-auto border-b border-border/70', className)}>
            {tabs.map((tab) => {
                const active = tab.id === value;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`tab-${tab.id}`}
                        aria-selected={active}
                        aria-controls={tab.controls}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            '-mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-sm transition-colors',
                            active ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        {Boolean(tab.count) &&
                            (tab.attention ? (
                                <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold tabular-nums text-secondary-foreground">{tab.count}</span>
                            ) : (
                                <span className="text-xs tabular-nums opacity-60">{tab.count}</span>
                            ))}
                    </button>
                );
            })}
        </div>
    );
}
