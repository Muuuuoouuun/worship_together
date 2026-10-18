'use client';

import type { FinalistProps } from './types';

/** 자리 표시 — 후보 구현 전 */
export default function FinalistStage({ device, view = 'main', toasts }: FinalistProps) {
    return <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">FinalistStage · {device} · {view} · 알림 {toasts.length}개</div>;
}
