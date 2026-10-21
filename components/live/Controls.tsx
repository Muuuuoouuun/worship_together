'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { controllerText, type LivePosition } from './derive';

/* 예배 중 화면의 작은 조작 부품 — 화면 바꾸기 · 넘김 버튼 · 따라가는 중 · 잠금 풀기 · 아이콘 스위치 */

export interface SwitchOption<T extends string> {
    value: T;
    label: string;
    icon: LucideIcon;
}

/** 화면 바꾸기 — 회색 트랙 위 흰 칩 (모바일은 맨 아래, 데스크톱은 위 막대 오른쪽) */
export function ViewSwitch<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: SwitchOption<T>[]; onChange: (value: T) => void; className?: string }) {
    return (
        <div role="group" aria-label={label} className={cn('grid shrink-0 auto-cols-fr grid-flow-col rounded-full bg-muted p-1', className)}>
            {options.map((option) => {
                const active = option.value === value;
                const Icon = option.icon;
                return (
                    <button
                        key={option.value}
                        type="button"
                        data-view={option.value}
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            // 보이는 칩은 36px, 누르는 자리는 트랙 여백까지 44px (after: 로 위아래 4px 넓힘)
                            'relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm outline-none transition-colors after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-[3px] focus-visible:ring-ring',
                            active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

/** 모바일 엄지 자리의 이전 · 다음 (진행할 수 있는 사람만) */
export function MobileNav({ pos, onPrev, onNext }: { pos: LivePosition; onPrev: () => void; onNext: () => void }) {
    return (
        <div className="flex items-center gap-2.5">
            <button
                type="button"
                onClick={onPrev}
                disabled={pos.atStart}
                aria-label={pos.hasForm ? '이전 섹션' : '이전 곡'}
                className={cn(buttonVariants({ variant: 'outline' }), 'size-14 shrink-0 flex-col gap-0 px-0 text-[11px] font-medium has-[>svg]:px-0')}
            >
                <ChevronLeft className="size-5" aria-hidden="true" />
                이전
            </button>
            <button
                type="button"
                onClick={onNext}
                disabled={pos.atEnd}
                className={cn(buttonVariants({ size: 'lg' }), 'h-14 min-w-0 flex-1 justify-between gap-3 pl-6 pr-4 text-[17px] has-[>svg]:pr-4')}
            >
                <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span>{pos.nextTitle}</span>
                    <span className="max-w-full truncate text-xs font-medium text-primary-foreground/60">{pos.nextName}</span>
                </span>
                <ChevronRight className="size-6" aria-hidden="true" />
            </button>
        </div>
    );
}

/**
 * 진행할 수 없는 사람의 넘김 자리 — 누를 수 없는 차분한 한 줄. 넘김 버튼과 같은 높이라 화면이 흔들리지 않습니다.
 */
export function FollowStatus({ controllerNames, desktop = false }: { controllerNames: string[]; desktop?: boolean }) {
    const who = controllerText(controllerNames);
    return (
        <div
            role="status"
            className={cn(
                'flex min-w-0 items-center gap-3 rounded-full bg-muted pl-5 pr-6 text-left',
                desktop ? 'h-12 w-[19rem] shrink-0' : 'h-14 w-full',
            )}
        >
            <span className="relative flex size-2 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-brand opacity-50 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-brand" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
                <span className={cn('truncate font-semibold', desktop ? 'text-sm' : 'text-[15px]')}>{who ? `${who}을 따라가는 중` : '진행하는 분을 기다리는 중'}</span>
                <span className="truncate text-xs text-muted-foreground">곡 · 섹션이 함께 넘어가요</span>
            </span>
        </div>
    );
}

export function HoldToUnlock({ onUnlock }: { onUnlock: () => void }) {
    const [holding, setHolding] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    function start(event: ReactPointerEvent<HTMLButtonElement>) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setHolding(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            setHolding(false);
            onUnlock();
        }, 700);
    }

    function cancel() {
        setHolding(false);
        if (timer.current) clearTimeout(timer.current);
    }

    return (
        <button
            type="button"
            onPointerDown={start}
            onPointerUp={cancel}
            onPointerCancel={cancel}
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => {
                // 키보드(Enter · Space)는 바로 풀고, 손가락은 길게 눌러야 풉니다.
                if (event.detail === 0) onUnlock();
            }}
            className={cn(buttonVariants({ variant: 'outline' }), 'relative h-14 w-full select-none overflow-hidden text-[15px] [-webkit-touch-callout:none]')}
        >
            <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 bg-muted ease-linear', holding ? 'w-full transition-[width] duration-700' : 'w-0 transition-[width] duration-150')} />
            <span className="relative inline-flex items-center gap-2">
                <Lock className="size-[18px]" aria-hidden="true" />
                길게 눌러 잠금 풀기
            </span>
        </button>
    );
}

export function IconToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(buttonVariants({ variant: pressed ? 'default' : 'ghost', size: 'icon' }), !pressed && 'text-muted-foreground hover:text-foreground')}
        >
            {children}
        </button>
    );
}
