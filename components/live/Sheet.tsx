'use client';

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * 아래에서 올라오는 시트 (모바일). 열면 닫기 버튼에 포커스가 가고, Esc · 바깥 누르기 · 아래로 끌기로 닫힙니다.
 * 뒤 화면은 부모가 inert 로 막고, 닫은 뒤 포커스는 부모가 연 버튼으로 돌려줍니다.
 */
export default function Sheet({
    eyebrow,
    title,
    onClose,
    children,
}: {
    eyebrow: string;
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const titleId = useId();
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const drag = useRef<{ start: number; pointer: number } | null>(null);
    const [dragY, setDragY] = useState(0);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        closeRef.current?.focus({ preventScroll: true });
    }, []);

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if ((event.target as HTMLElement).closest('button')) return;
        drag.current = { start: event.clientY, pointer: event.pointerId };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!drag.current || drag.current.pointer !== event.pointerId) return;
        setDragY(Math.max(0, event.clientY - drag.current.start));
    }

    function onPointerUp() {
        if (!drag.current) return;
        drag.current = null;
        if (dragY > 90) onClose();
        else setDragY(0);
    }

    return (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
            <button type="button" tabIndex={-1} aria-label="시트 닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/35 animate-in fade-in duration-200 motion-reduce:animate-none dark:bg-background/70" />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
                className={cn(
                    'relative flex max-h-[85%] min-h-0 flex-col rounded-t-3xl bg-card text-card-foreground shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.25)] animate-in slide-in-from-bottom duration-300 motion-reduce:animate-none dark:ring-1 dark:ring-border',
                    !dragY && 'transition-transform',
                )}
            >
                <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={cn('shrink-0 touch-none select-none border-b transition-colors', scrolled ? 'border-border' : 'border-transparent')}
                >
                    <div className="flex justify-center pb-1 pt-2.5">
                        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-foreground/15" />
                    </div>
                    <header className="flex items-start justify-between gap-3 pb-3 pl-5 pr-3 pt-1.5">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-muted-foreground">{eyebrow}</p>
                            <h2 id={titleId} className="mt-0.5 text-lg font-semibold tracking-tight">
                                {title}
                            </h2>
                        </div>
                        <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                            <X className="size-5" aria-hidden="true" />
                        </button>
                    </header>
                </div>
                <div onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 2)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
                    {children}
                </div>
            </section>
        </div>
    );
}
