'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BLOCK } from '@/components/conti/ui';
import { keyText, songMeta, type LivePosition } from './derive';
import type { LiveScreenModel } from './model';

/*
 * 모바일 '지금' 화면의 부품 — 곡 줄 · 지금 카드 · 특이사항 · 송폼 줄 · 다음, 그리고 펄스 화면의 섹션 줄.
 * 모두 모델의 실제 값(곡 · Key · 송폼 · 메모 · 리드)만 보여 줍니다. 가사 · 코드는 모델에 없으므로 그리지 않습니다.
 */

/** @param beat 박자 점 · BPM · 박자표 자리 (TempoBeat) */
export function SongStrip({ model, pos, onOrder, beat }: { model: LiveScreenModel; pos: LivePosition; onOrder: () => void; beat: ReactNode }) {
    const { song } = pos;
    return (
        <section aria-label="지금 곡" className="shrink-0 px-5 pb-3 pt-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 truncate text-[23px] font-semibold leading-tight tracking-tight">{song.title}</h2>
                <button
                    type="button"
                    onClick={onOrder}
                    aria-haspopup="dialog"
                    className="relative -mr-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-2 pr-1 text-[13px] text-muted-foreground outline-none after:absolute after:-inset-y-1.5 after:inset-x-0 focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    <span className="sr-only">순서 보기, </span>
                    <span className="tabular-nums">
                        {pos.songIndex + 1}/{model.songs.length}곡
                    </span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-3 text-[13px]">
                <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-3 text-[15px] font-semibold">
                    <span className="mr-1 text-xs font-medium text-muted-foreground">Key</span>
                    {keyText(song.key)}
                </span>
                {beat}
            </div>
        </section>
    );
}

export function NowCard({ pos }: { pos: LivePosition }) {
    const { song } = pos;
    return (
        // 남는 높이는 카드가 차지하고 내용은 세로 가운데 — 시각적 가운데를 위해 위 2 : 아래 3 으로 나눕니다
        <article
            aria-label="지금 섹션"
            className={cn('flex shrink-0 grow flex-col rounded-3xl px-5 pb-5 pt-4 [@container(max-height:740px)]:pb-4 [@container(max-height:740px)]:pt-3', TONE_BLOCK.mint)}
        >
            <span aria-hidden="true" className="grow-[2]" />
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <p className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    지금
                </p>
                <p className="tabular-nums">{pos.hasForm ? `${pos.sectionIndex + 1} / ${song.sections.length}` : '송폼 없음'}</p>
            </div>
            {pos.hasForm ? (
                <p className="mt-1.5 truncate text-[46px] font-semibold leading-[1.08] tracking-tight [@container(max-height:740px)]:mt-1 [@container(max-height:740px)]:text-[42px] [@container(min-height:770px)]:text-[52px]">
                    {pos.section}
                </p>
            ) : (
                <>
                    <p className="mt-1.5 line-clamp-2 text-[32px] font-semibold leading-[1.12] tracking-tight">{song.title}</p>
                    <p className="mt-2 text-[15px] leading-snug text-foreground/70">송폼이 없는 곡이라 곡 단위로 함께 넘어가요</p>
                </>
            )}
            {song.lead ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">리드</span>
                    <span className="font-semibold">{song.lead}</span>
                </p>
            ) : null}
            <span aria-hidden="true" className="grow-[3]" />
        </article>
    );
}

/** 특이사항 · 인도자 메모 (복숭아 블록) */
export function NoteBlock({ note, className }: { note: string; className?: string }) {
    return (
        <p className={cn('shrink-0 rounded-2xl px-4 py-2.5 text-sm leading-snug', TONE_BLOCK.peach, className)}>
            <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
            <span className="[overflow-wrap:anywhere]">{note}</span>
        </p>
    );
}

/** 송폼 줄 — 지금 섹션이 가운데로 오게 가로로 스크롤. 진행할 수 있는 사람만 눌러서 이동합니다 */
export function FormRow({ pos, canControl, onPick }: { pos: LivePosition; canControl: boolean; onPick: (index: number) => void }) {
    const scroller = useRef<HTMLOListElement | null>(null);
    const first = useRef(true);

    useEffect(() => {
        const list = scroller.current;
        const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
        if (!list || !current) return;
        const left = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        list.scrollTo({ left: Math.max(0, left), behavior: first.current || reduce ? 'auto' : 'smooth' });
        first.current = false;
    }, [pos.sectionIndex, pos.songIndex]);

    if (!pos.hasForm) return null;

    return (
        <nav aria-label={`${pos.song.title} 송폼`}>
            <ol ref={scroller} className="relative flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {pos.song.sections.map((name, index) => {
                    const current = index === pos.sectionIndex;
                    const done = index < pos.sectionIndex;
                    const look = cn(
                        'inline-flex h-11 items-center rounded-full px-4 text-[15px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                        current
                            ? 'bg-primary font-semibold text-primary-foreground'
                            : done
                              ? 'font-medium text-muted-foreground'
                              : 'font-medium text-foreground ring-1 ring-inset ring-border',
                        canControl && !current && (done ? 'hover:text-foreground' : 'hover:bg-muted'),
                    );
                    return (
                        <li key={`${name}-${index}`} className="shrink-0">
                            {canControl ? (
                                <button type="button" aria-current={current ? 'step' : undefined} onClick={() => onPick(index)} className={look}>
                                    {name}
                                </button>
                            ) : (
                                <span aria-current={current ? 'step' : undefined} className={look}>
                                    {name}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/** 다음 섹션 (곡의 끝이면 다음 곡과 넘어갈 때 메모) — 넘김 버튼 쪽에 둡니다 */
export function NextUp({ pos }: { pos: LivePosition }) {
    const label = pos.nextKind === 'song' ? '다음 곡' : '다음';
    const detail =
        pos.nextKind === 'song' && pos.nextSong
            ? pos.song.transitionNote
                ? `넘어갈 때 · ${pos.song.transitionNote}`
                : songMeta(pos.nextSong)
            : pos.nextKind === 'end'
              ? '콘티의 마지막이에요'
              : null;

    return (
        <section aria-label="다음" className="shrink-0 border-t border-border px-1 pt-3.5">
            <div className="flex items-baseline gap-3">
                <p className="w-11 shrink-0 text-xs font-medium text-muted-foreground">{label}</p>
                <p className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground/50">{pos.nextName}</p>
            </div>
            {detail ? <p className="mt-0.5 truncate pl-14 text-[15px] text-muted-foreground [@container(max-height:660px)]:hidden">{detail}</p> : null}
        </section>
    );
}

/** 펄스 화면의 섹션 줄 — 눈썹(지금 · 다음)끼리, 이름끼리 같은 기준선에 섭니다 */
export function SectionNow({ pos }: { pos: LivePosition }) {
    return (
        <section aria-label="섹션" className="grid shrink-0 grid-cols-[minmax(0,auto)_minmax(0,auto)] items-baseline justify-between gap-x-4 px-5 pt-5">
            <p className="text-xs font-medium text-muted-foreground">
                지금 <span className="tabular-nums">· {pos.hasForm ? `${pos.sectionIndex + 1}/${pos.song.sections.length}` : '송폼 없음'}</span>
            </p>
            <p className="text-right text-xs font-medium text-muted-foreground">{pos.nextKind === 'section' ? '다음' : pos.nextKind === 'song' ? '다음 곡' : '끝'}</p>
            <h2 className={cn('mt-1 truncate font-semibold leading-[1.05] tracking-tight', pos.hasForm ? 'text-[44px] [@media(max-height:700px)]:text-[40px]' : 'text-[32px]')}>{pos.section ?? pos.song.title}</h2>
            <p className="mt-1 truncate text-right text-xl font-semibold tracking-tight text-muted-foreground">{pos.nextName}</p>
        </section>
    );
}

/**
 * 가운데 스크롤 영역. 내용이 넘칠 때만(앱 알림 줄이 열렸거나 화면이 낮을 때) 아래 끝을 흐리게 해서
 * 반쯤 잘린 채로 보이지 않고 '아래에 더 있음' 으로 읽히게 합니다. 끝까지 내리면 흐림이 사라집니다.
 */
export function FadeScroller({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            // 아래 여백(pb-3)만 넘치는 건 잘린 게 아니므로 흐리지 않습니다
            const padding = parseFloat(getComputedStyle(el).paddingBottom) || 0;
            setFade(el.scrollHeight - el.clientHeight - el.scrollTop > padding + 1);
        };
        const resize = new ResizeObserver(update);
        // 안의 내용이 통째로 바뀌면 다시 지켜봅니다
        const watch = () => {
            resize.disconnect();
            resize.observe(el);
            for (const child of Array.from(el.children)) resize.observe(child);
            update();
        };
        const mutation = new MutationObserver(watch);
        mutation.observe(el, { childList: true });
        watch();
        el.addEventListener('scroll', update, { passive: true });
        return () => {
            resize.disconnect();
            mutation.disconnect();
            el.removeEventListener('scroll', update);
        };
    }, []);

    return (
        <div
            ref={ref}
            className={cn(
                'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3 pt-0.5 [scrollbar-width:none]',
                fade && 'mask-b-from-[calc(100%-2rem)]',
            )}
        >
            {children}
        </div>
    );
}
