'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 같은 내용을 다른 방식으로 보는 작은 전환 (목록/캘린더, 전체/예배/연습).
 * 회색 바탕 위에 선택된 것만 흰 칩으로 떠 있습니다.
 */
export default function Segmented<T extends string>({ options, value, onChange, label, size = 'sm', className }: { options: { id: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (id: T) => void; label: string; size?: 'sm' | 'md'; className?: string }) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1', className)}>
            {options.map((option) => {
                const active = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 font-medium transition-colors',
                            size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
                            active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
