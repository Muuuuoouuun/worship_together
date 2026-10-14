"use client";

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { STATUS } from '@/components/ui/status';
import { cn } from '@/lib/utils';

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
                className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), copied && cn('border-transparent', STATUS.ok.soft))}
            >
                {copied ? <Check size={13} aria-hidden="true" /> : <Share2 size={13} aria-hidden="true" />}
                {copied ? '복사했어요' : '공유용 콘티 복사'}
            </button>
            {copyFailed && (
                <div className="mt-2 animate-shake">
                    <p role="status" className="text-xs text-destructive">자동 복사를 사용할 수 없습니다. 아래 내용을 선택해 복사해주세요.</p>
                    <textarea aria-label="공유용 콘티 내용" readOnly value={shareText} rows={5} className="mt-2 w-full rounded-2xl border border-input bg-card p-3 text-base sm:text-sm" onFocus={event => event.currentTarget.select()} />
                </div>
            )}
        </div>
    );
}
