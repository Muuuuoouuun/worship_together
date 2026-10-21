'use client';

import { useConti } from '@/components/conti/context';

/** 자리 표시 — 시안 구현 전 */
export default function HomeDraft3() {
    const { setlists } = useConti();
    return <div className="rounded-3xl border border-dashed border-input p-10 text-sm text-muted-foreground">홈 시안 3 · 콘티 {setlists.length}개</div>;
}
