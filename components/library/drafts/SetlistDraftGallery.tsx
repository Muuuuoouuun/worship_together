'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { DRAFT_TODAY, DRAFT_VARIANTS, dateParts, type DraftTab, type DraftVariant } from './draftData';
import DraftStack from './DraftStack';
import DraftCueSheet from './DraftCueSheet';
import DraftStage from './DraftStage';

export default function SetlistDraftGallery({ initialVariant, initialTab }: { initialVariant: DraftVariant; initialTab: DraftTab }) {
    const [variant, setVariant] = useState<DraftVariant>(initialVariant);
    const current = DRAFT_VARIANTS.find((item) => item.id === variant) ?? DRAFT_VARIANTS[0];
    const today = dateParts(DRAFT_TODAY);

    function choose(next: DraftVariant) {
        setVariant(next);
        const url = new URL(window.location.href);
        url.searchParams.set('v', next);
        url.searchParams.delete('tab');
        window.history.replaceState(null, '', url);
    }

    return (
        <div className={cn('mx-auto flex flex-col gap-5', variant === 'cuesheet' ? 'max-w-6xl' : 'max-w-3xl')}>
            <header className="space-y-2">
                <Link href="/dashboard/songs" className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronLeft size={14} />
                    콘티·악보로 돌아가기
                </Link>
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <h1 className="text-2xl font-serif font-black tracking-tight text-primary sm:text-3xl">콘티·순서 탭 디자인 시안</h1>
                    <Badge variant="outline" size="sm">목업 데이터 · 기준일 {today.month}/{today.day}</Badge>
                </div>
            </header>

            <nav aria-label="시안 선택" className="grid grid-cols-3 gap-2">
                {DRAFT_VARIANTS.map((item) => {
                    const active = item.id === variant;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => choose(item.id)}
                            className={cn(
                                'flex min-h-14 flex-col items-start justify-center gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all sm:flex-row sm:items-center sm:gap-2.5',
                                active ? 'border-primary bg-primary/[0.06] shadow-xs' : 'border-border bg-card hover:border-primary/30',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-6 shrink-0 items-center justify-center rounded-full font-serif text-xs font-black sm:size-8 sm:text-sm',
                                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}
                            >
                                {item.letter}
                            </span>
                            <span className={cn('whitespace-nowrap text-[13px] font-bold leading-tight sm:text-sm', active ? 'text-primary' : 'text-foreground')}>{item.name}</span>
                        </button>
                    );
                })}
            </nav>

            <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">시안 {current.letter} · {current.name}</span> — {current.summary}
            </p>

            <div key={variant} className="animate-in fade-in duration-200">
                {variant === 'stack' && <DraftStack initialTab={initialTab} />}
                {variant === 'cuesheet' && <DraftCueSheet initialTab={initialTab} />}
                {variant === 'stage' && <DraftStage initialTab={initialTab} />}
            </div>
        </div>
    );
}
