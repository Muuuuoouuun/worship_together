import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'gold';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'light', ...props }) => {
    const variantStyles = {
        light: 'border-border/80 bg-card/85 backdrop-blur-md text-card-foreground shadow-sm',
        dark: 'border-border/80 bg-muted/80 backdrop-blur-md text-foreground shadow-sm',
        gold: 'border-secondary/40 bg-secondary/10 backdrop-blur-md text-card-foreground shadow-sm',
    };

    return (
        <div
            {...props}
            className={cn(
                'rounded-2xl border p-6 transition-all duration-200',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </div>
    );
};

export default GlassCard;
