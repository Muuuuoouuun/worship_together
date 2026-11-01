'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { LiveScreenHandlers, LiveScreenModel } from './model';

/* 예배를 마친 뒤 · 콘티에 곡이 없을 때의 조용한 한 화면. 진행 조작은 없습니다. */

export default function LiveEnded({ model }: { model: LiveScreenModel }) {
    const headingRef = useRef<HTMLHeadingElement | null>(null);

    // 화면이 통째로 바뀌므로 제목으로 포커스를 옮겨 스크린리더가 바로 읽게 합니다
    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
    }, []);

    const meta = [model.teamName, model.dateLabel].filter(Boolean).join(' · ');
    return (
        <main className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none">
                <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
            </span>
            {meta ? <p className="mt-6 text-xs font-medium text-muted-foreground">{meta}</p> : null}
            <h1 ref={headingRef} tabIndex={-1} className="mt-1.5 text-[28px] font-semibold tracking-tight outline-none">
                예배를 마쳤어요
            </h1>
            <p className="mt-2 max-w-sm text-balance text-[15px] leading-relaxed text-muted-foreground [word-break:keep-all]">
                {model.endedByName ? `${model.endedByName}님이 예배를 마쳤어요. ` : ''}함께 섬겨 주셔서 고마워요.
            </p>
            <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                <ListMusic className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">{model.title}</span>
                <span className="shrink-0 text-muted-foreground">· {model.songs.length}곡</span>
            </p>
            <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5">
                <Link href={model.exitHref} className={cn(buttonVariants({ size: 'lg' }), 'h-14 w-full text-base')}>
                    홈으로
                </Link>
                <Link href={model.contiHref} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 w-full text-base')}>
                    콘티 보기
                </Link>
            </div>
        </main>
    );
}

/** 콘티에 곡이 하나도 없을 때 — 지어낸 곡 없이 나가는 길만 */
export function LiveEmpty({ model, handlers }: { model: LiveScreenModel; handlers: LiveScreenHandlers }) {
    return (
        <main className="flex h-full flex-col">
            <div className="shrink-0 px-2 pt-[max(env(safe-area-inset-top),0.375rem)]">
                <button type="button" onClick={handlers.leave} aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                    <ChevronLeft className="size-[22px]" aria-hidden="true" />
                </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight">콘티에 곡이 없어요</h1>
                <p className="mt-2 max-w-sm text-balance text-[15px] leading-relaxed text-muted-foreground [word-break:keep-all]">콘티에 곡을 넣으면 여기서 함께 넘겨 볼 수 있어요.</p>
                <Link href={model.contiHref} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-6 h-12 px-6')}>
                    콘티 보기
                </Link>
            </div>
        </main>
    );
}
