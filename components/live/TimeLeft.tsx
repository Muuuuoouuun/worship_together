'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { LiveToast } from './model';

/**
 * 저절로 사라지는 알림의 남은 시간 — 얇은 선이 줄어듭니다.
 * 펼침 · 접힘으로 다시 그려져도 알림이 생긴 시각(createdAt)부터 남은 만큼만 줄어듭니다.
 */
export default function TimeLeft({ toast, className }: { toast: LiveToast; className?: string }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node || !toast.createdAt) return;
        node.style.animationDelay = `${-(Date.now() - toast.createdAt)}ms`;
    }, [toast.createdAt]);
    if (!toast.ttl || toast.acked) return null;
    return (
        <span
            ref={ref}
            aria-hidden="true"
            className={cn('pointer-events-none absolute h-0.5 origin-left rounded-full animate-toast-progress', className)}
            style={{ '--toast-duration': `${toast.ttl}ms` } as CSSProperties}
        />
    );
}
