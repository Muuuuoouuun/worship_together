'use client';

import type { PulseDraftProps } from './types';

/** 자리 표시 — 시안 구현 전 */
export default function PulseRing({ device, toasts }: PulseDraftProps) {
    return <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">PulseRing · {device} · 알림 {toasts.length}개</div>;
}
