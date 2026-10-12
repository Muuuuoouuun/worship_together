'use client';

import { useState } from 'react';
import { ArrowRight, BookOpen, Check, HandHeart, Waves, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DRAFT_SETLISTS,
    PRIMARY_SETLIST_ID,
    SECTION_NAMES,
    moveItem,
    sectionTone,
    type DraftItem,
    type DraftMomentKind,
    type DraftSong,
    type DraftTab,
} from './draftData';

/** 세 시안이 공유하는 상태: 현재 탭, 선택한 콘티, 콘티별 순서(편집 가능). */
export function useDraftWorkspace(initialTab: DraftTab) {
    const [tab, setTab] = useState<DraftTab>(initialTab);
    const [selectedId, setSelectedId] = useState(PRIMARY_SETLIST_ID);
    const [orders, setOrders] = useState<Record<string, DraftItem[]>>(
        () => Object.fromEntries(DRAFT_SETLISTS.map((setlist) => [setlist.id, setlist.items])),
    );

    const setlist = DRAFT_SETLISTS.find((item) => item.id === selectedId) ?? DRAFT_SETLISTS[0];
    const items = orders[setlist.id] ?? setlist.items;

    function move(index: number, offset: number) {
        setOrders((prev) => ({ ...prev, [setlist.id]: moveItem(prev[setlist.id] ?? setlist.items, index, offset) }));
    }

    function openOrder(id: string) {
        setSelectedId(id);
        setTab('order');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return { tab, setTab, setlist, items, orders, move, openOrder, selectSetlist: setSelectedId };
}

export function KeyPill({ song, className }: { song: Pick<DraftSong, 'key' | 'originalKey'>; className?: string }) {
    const changed = song.key !== song.originalKey;
    return (
        <span
            title={changed ? `원키 ${song.originalKey} → 이번 주 ${song.key}` : `Key ${song.key}`}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-tight tabular-nums',
                changed ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground',
                className,
            )}
        >
            {changed && (
                <>
                    <span className="opacity-60">{song.originalKey}</span>
                    <ArrowRight size={10} aria-hidden="true" />
                </>
            )}
            <span>{song.key}</span>
        </span>
    );
}

export function FormChips({ form, className, size = 'default' }: { form: string[]; className?: string; size?: 'default' | 'sm' }) {
    return (
        <ol aria-label="송폼 진행 순서" className={cn('flex flex-wrap gap-1', className)}>
            {form.map((code, index) => {
                const tone = sectionTone(code);
                return (
                    <li
                        key={`${code}-${index}`}
                        title={SECTION_NAMES[code] ?? code}
                        className={cn(
                            'rounded-md border font-bold leading-none tabular-nums',
                            size === 'sm' ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
                            tone === 'chorus' && 'border-primary/20 bg-primary/10 text-primary',
                            tone === 'bridge' && 'border-accent/25 bg-accent/10 text-accent',
                            tone === 'plain' && 'border-border bg-card text-muted-foreground',
                        )}
                    >
                        {code}
                    </li>
                );
            })}
        </ol>
    );
}

export function ReadinessMeter({ label, value, className }: { label: string; value: [number, number]; className?: string }) {
    const [done, total] = value;
    const complete = total > 0 && done >= total;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div className={className}>
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-muted-foreground">{label}</span>
                <span className={cn('inline-flex items-center gap-1 font-bold tabular-nums', complete ? 'text-primary' : 'text-foreground')}>
                    {complete && <Check size={12} aria-hidden="true" />}
                    {done}/{total}
                </span>
            </div>
            <div
                role="progressbar"
                aria-label={`${label} 준비`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
            >
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

export const MOMENT_ICONS: Record<DraftMomentKind, LucideIcon> = {
    prayer: HandHeart,
    word: BookOpen,
    transition: Waves,
};
