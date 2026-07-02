"use client";

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

interface SetlistShareButtonProps {
    shareText: string;
}

export default function SetlistShareButton({ shareText }: SetlistShareButtonProps) {
    const [copied, setCopied] = useState(false);

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
            return;
        }

        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
        } catch (error) {
            console.error('Failed to copy setlist share text:', error);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-white/70 px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary/20 hover:bg-white"
        >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
            {copied ? '복사됨' : '콘티 공유'}
        </button>
    );
}
