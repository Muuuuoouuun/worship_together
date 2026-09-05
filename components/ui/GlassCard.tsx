import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'gold';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'light', ...props }) => {
    const variantStyles = {
        light: 'border-border bg-card text-card-foreground shadow-sm',
        dark: 'border-border bg-muted text-foreground',
        gold: 'border-secondary bg-card text-card-foreground shadow-sm',
    };

    return (
        <div
            {...props}
            className={cn(
                'rounded-2xl border p-6',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </div>
    );
};

export default GlassCard;
