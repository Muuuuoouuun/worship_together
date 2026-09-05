"use client";

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

interface SetlistShareButtonProps {
    shareText: string;
}

export default function SetlistShareButton({ shareText }: SetlistShareButtonProps) {
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = setTimeout(() => {
            setCopied(false);
        }, 1800);

        return () => clearTimeout(timer);
    }, [copied]);

    const handleCopy = async () => {
        if (!navigator.clipboard) {
            setCopyFailed(true);
            return;
        }

        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            setCopyFailed(false);
        } catch (error) {
            setCopyFailed(true);
            console.error('Failed to copy setlist share text:', error);
        }
    };

    return (
        <div><button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-primary/10 bg-card px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary/20 hover:bg-muted"
        >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
            {copied ? '복사됨 · 메신저에 붙여넣으세요' : '공유용 콘티 복사'}
        </button>
        {copyFailed && <div className="mt-2"><p role="status" className="text-xs">자동 복사를 사용할 수 없습니다. 아래 내용을 선택해 복사해주세요.</p><textarea aria-label="공유용 콘티 내용" readOnly value={shareText} rows={5} className="mt-2 w-full rounded-lg border p-2 text-sm" onFocus={event => event.currentTarget.select()} /></div>}</div>
    );
}
