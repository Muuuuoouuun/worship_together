'use client';

import { useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, Clock3, HandHeart, Music2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SETLISTS,
    SETLIST_STATUS,
    clock,
    dayOf,
    md,
    member,
    monthOf,
    setlistById,
    songsOf,
    toMinutes,
    totalMinutes,
    weekLabel,
    type OrderItem,
    type Tone,
} from './draftData';
import { AddButton, Avatar, Eyebrow, KeyText, RoundIconButton, TONE_BLOCK, TONE_DOT, TONE_ICON, body, ink, line, selected, sub } from './ui';

/** 1분당 높이(px). 곡 길이가 블록 높이로 드러납니다. */
const PX_PER_MINUTE = 28;

function toneOf(item: OrderItem): Tone {
    if (item.kind === 'moment') return 'lilac';
    return item.bpm >= 100 ? 'peach' : 'sky';
}

export default function OrderScreen({ setlistId, onBack, onSelect }: { setlistId: string; onBack: () => void; onSelect: (id: string) => void }) {
    const [picking, setPicking] = useState(false);
    const setlist = setlistById(setlistId);
    const owner = member(setlist.owner);
    const start = toMinutes(setlist.time);
    const total = totalMinutes(setlist.items);
    const songs = songsOf(setlist.items);
    const choices = SETLISTS.filter((item) => item.items.length > 0);
    const numbers = setlist.items.map((_, index) => songsOf(setlist.items.slice(0, index + 1)).length);
    const offsets = setlist.items.map((_, index) => totalMinutes(setlist.items.slice(0, index)));

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <RoundIconButton label="콘티 내역으로" onClick={onBack}>
                    <ArrowLeft size={18} />
                </RoundIconButton>
                <button type="button" onClick={() => setPicking((value) => !value)} aria-expanded={picking} className="min-w-0 flex-1 text-left">
                    <Eyebrow>
                        {weekLabel(setlist.date)} · {owner?.name} 담당
                    </Eyebrow>
                    <span className={cn('mt-0.5 flex items-center gap-1.5 text-[17px] font-semibold tracking-tight', ink)}>
                        {monthOf(setlist.date)}월 {dayOf(setlist.date)}일
                        <span className={cn('font-normal', sub)}>주일</span>
                        <ChevronDown size={18} className={cn('transition-transform', picking && 'rotate-180')} aria-hidden="true" />
                    </span>
                </button>
                <AddButton label="순서 추가" />
            </header>

            {picking && (
                <ul className={cn('overflow-hidden rounded-2xl border animate-in fade-in slide-in-from-top-1 duration-150', line)}>
                    {choices.map((item) => (
                        <li key={item.id} className={cn('border-b last:border-b-0', line)}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(item.id);
                                    setPicking(false);
                                }}
                                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left text-sm', item.id === setlist.id && 'bg-neutral-50 dark:bg-neutral-800/60')}
                            >
                                <span className={cn('w-10 tabular-nums', sub)}>{md(item.date)}</span>
                                <span className={cn('flex-1 truncate font-medium', ink)}>{item.theme}</span>
                                <span className={cn('text-xs', SETLIST_STATUS[item.status].text)}>{SETLIST_STATUS[item.status].label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div>
                <div className="flex items-end justify-between gap-3">
                    <h2 className={cn('text-xl font-semibold tracking-tight', ink)}>{setlist.theme}</h2>
                    <span className={cn('shrink-0 text-xs tabular-nums', sub)}>
                        {songs.length}곡 · {total}분
                    </span>
                </div>
                <p className={cn('mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]', sub)}>
                    <Legend tone="peach" label="빠른 곡" />
                    <Legend tone="sky" label="느린 곡" />
                    <Legend tone="lilac" label="기도·말씀" />
                </p>
            </div>

            <ol aria-label={`${setlist.theme} 예배 순서`}>
                {setlist.items.map((item, index) => {
                    const begin = start + offsets[index];
                    const end = begin + item.minutes;
                    const tone = toneOf(item);
                    const number = numbers[index];
                    const isSong = item.kind === 'song';

                    return (
                        <li
                            key={item.id}
                            className={cn('grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 border-t', line)}
                            style={{ minHeight: Math.max(item.minutes * PX_PER_MINUTE, isSong ? 118 : 72) }}
                        >
                            <span className={cn('pt-2.5 text-xs tabular-nums', sub)}>{clock(begin)}</span>
                            <article className={cn('my-1.5 flex flex-col rounded-2xl px-4 py-3', TONE_BLOCK[tone])}>
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className={cn('min-w-0 truncate text-[15px] font-semibold', ink)}>{item.title}</h3>
                                    {item.kind === 'song' ? (
                                        <Music2 size={17} className={cn('mt-0.5 shrink-0', TONE_ICON[tone])} aria-hidden="true" />
                                    ) : item.moment === 'prayer' ? (
                                        <HandHeart size={17} className={cn('mt-0.5 shrink-0', TONE_ICON[tone])} aria-hidden="true" />
                                    ) : (
                                        <BookOpen size={17} className={cn('mt-0.5 shrink-0', TONE_ICON[tone])} aria-hidden="true" />
                                    )}
                                </div>

                                {item.kind === 'song' ? (
                                    <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                                        {number}번 곡 · <KeyText from={item.originalKey} to={item.key} /> · {item.bpm} BPM
                                    </p>
                                ) : (
                                    <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                                        {item.minutes}분 · {clock(begin)} - {clock(end)}
                                    </p>
                                )}

                                {item.memo && <p className={cn('mt-2 line-clamp-2 text-xs leading-relaxed', body)}>{item.memo}</p>}

                                {item.kind === 'song' && (
                                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/5 pt-2.5 dark:border-white/10">
                                        <span className={cn('inline-flex items-center gap-1.5 text-xs tabular-nums', body)}>
                                            <Clock3 size={14} aria-hidden="true" />
                                            {clock(begin)} - {clock(end)}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Avatar id={item.lead} size="xs" />
                                            <span className={cn('text-xs', body)}>
                                                {member(item.lead)?.name} <span className={sub}>리드</span>
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </article>
                        </li>
                    );
                })}
                <li className={cn('grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 border-t pt-2.5', line)}>
                    <span className={cn('text-xs tabular-nums', sub)}>{clock(start + total)}</span>
                    <span className={cn('text-xs', sub)}>찬양 마침 · 말씀으로 이어집니다</span>
                </li>
            </ol>

            <button type="button" className={cn('flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99]', selected)}>
                <Radio size={17} aria-hidden="true" />
                이 순서로 예배 열기
            </button>
        </div>
    );
}

function Legend({ tone, label }: { tone: Tone; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden="true" />
            {label}
        </span>
    );
}
