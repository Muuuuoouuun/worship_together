import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'gold';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'light', ...props }) => {
    const variantStyles = {
        light: 'border-border bg-card/72 shadow-[0_18px_45px_rgba(21,62,59,0.07)] dark:shadow-black/20',
        dark: 'border-white/10 bg-black/20',
        gold: 'border-secondary/20 bg-secondary/5 shadow-[0_0_15px_rgba(198,106,69,0.12)]',
    };

    return (
        <div
            {...props}
            className={cn(
                'rounded-lg border p-6 backdrop-blur-md transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </div>
    );
};

export default GlassCard;
