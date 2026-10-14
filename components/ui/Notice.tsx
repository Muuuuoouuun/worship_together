import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONES = {
    info: 'bg-muted text-foreground',
    success: 'bg-success/10 text-success',
    error: 'bg-destructive/10 text-destructive',
    /** 레퍼런스의 특이사항(옅은 주황) 블록 — 긴급·주의 안내 */
    warn: 'bg-orange-50 text-orange-800 dark:bg-orange-400/10 dark:text-orange-200',
} as const;

/** 저장 완료·오류 같은 한 줄 안내. 테두리 없이 옅은 바탕 하나로 보여줍니다. */
export default function Notice({ tone = 'info', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
    return (
        <p role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'} className={cn('rounded-2xl px-4 py-3 text-sm font-medium', TONES[tone], className)}>
            {children}
        </p>
    );
}
