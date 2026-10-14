import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'gold';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'light', ...props }) => {
    // 기준 디자인: 흰 카드 + 가는 테두리 (그림자·블러 없음). dark = 회색 바탕, gold = 옅은 강조 바탕.
    const variantStyles = {
        light: 'border-border/70 bg-card text-card-foreground',
        dark: 'border-transparent bg-muted text-foreground',
        gold: 'border-transparent bg-amber-50 text-card-foreground dark:bg-amber-400/10',
    };

    return (
        <div
            {...props}
            className={cn(
                'rounded-3xl border p-5 sm:p-6',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </div>
    );
};

export default GlassCard;
