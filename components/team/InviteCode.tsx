'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 초대 코드 8자리 — 4자리씩 끊어 크게 보여 주고 한 번에 복사합니다. */
export default function InviteCode({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    const shown = `${code.slice(0, 4)}-${code.slice(4)}`;
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">초대 코드</p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tracking-[0.18em] text-foreground" aria-label={`초대 코드 ${code.split('').join(' ')}`}>{shown}</p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(shown);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    } catch { /* 복사가 막힌 브라우저는 길게 눌러 복사 */ }
                }}
            >
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? '복사됨' : '복사'}
            </Button>
        </div>
    );
}
