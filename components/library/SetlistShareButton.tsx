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
        <div>
            <button
                type="button"
                onClick={handleCopy}
                className={`tap-bounce inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-150 ${copied ? 'border-emerald-500/40 bg-emerald-50/80 text-emerald-800 shadow-[0_0_20px_rgba(16,185,129,0.2)] dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-primary/10 bg-card text-primary hover:border-primary/20 hover:bg-muted'}`}
            >
                {copied ? <Check size={14} className="animate-check-pop text-emerald-600 dark:text-emerald-400" /> : <Share2 size={13} />}
                {copied ? '복사 완료! 메신저에 붙여넣으세요' : '공유용 콘티 복사'}
            </button>
            {copyFailed && (
                <div className="mt-2 animate-shake">
                    <p role="status" className="text-xs text-destructive">자동 복사를 사용할 수 없습니다. 아래 내용을 선택해 복사해주세요.</p>
                    <textarea aria-label="공유용 콘티 내용" readOnly value={shareText} rows={5} className="mt-2 w-full rounded-lg border p-2 text-sm" onFocus={event => event.currentTarget.select()} />
                </div>
            )}
        </div>
    );
}
