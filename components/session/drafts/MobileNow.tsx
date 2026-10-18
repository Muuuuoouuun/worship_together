'use client';

import type { DraftScreenProps } from './types';

/** 자리 표시 — 시안 구현 전 */
export default function MobileNow({ framed = false }: DraftScreenProps) {
    return <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground" data-framed={framed}>MobileNow</div>;
}
