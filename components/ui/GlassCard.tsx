import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'gold';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, variant = 'light' }) => {
    const variantStyles = {
        light: 'bg-white/40 border-white/20',
        dark: 'bg-black/20 border-white/10',
        gold: 'border-secondary/20 bg-secondary/5 shadow-[0_0_15px_rgba(198,106,69,0.12)]',
    };

    return (
        <div
            className={cn(
                'rounded-lg border p-6 backdrop-blur-md transition-all duration-300 hover:shadow-lg',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </div>
    );
};

export default GlassCard;
