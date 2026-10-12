'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SETLIST_STATUS,
    dayOf,
    diffDays,
    displayTitle,
    md,
    monthGrid,
    monthOf,
    shortWeekLabel,
    songsOf,
    weekday,
    yearOf,
} from './model';
import { useConti } from './context';
import { AddButton, Avatar, Eyebrow, ScreenTitle, SectionTitle, TONE_BLOCK, body, ink, line, selected, sub, todayText } from './ui';

const WEEK_HEAD = ['일', '월', '화', '수', '목', '금', '토'];

export default function ContiScreen({ openOrder }: { openOrder: (id: string) => void }) {
    const { today, setlists, thisWeekId, editor } = useConti();
    const anchor = setlists.find((item) => item.id === thisWeekId)?.date ?? today;
    const [view, setView] = useState({ year: yearOf(anchor), month: monthOf(anchor) });
    const [picked, setPicked] = useState(anchor);
    const cells = monthGrid(view.year, view.month);
    const byDate = new Map(setlists.map((item) => [item.date, item]));
    const history = [...setlists].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    const owners = [...setlists].filter((item) => diffDays(item.date, today) >= -7).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    const createHref = editor?.createHref ?? '/dashboard/songs/library';

    function shiftMonth(offset: number) {
        setView(({ year, month }) => {
            const index = year * 12 + (month - 1) + offset;
            return { year: Math.floor(index / 12), month: (index % 12) + 1 };
        });
    }

    return (
        <div className="space-y-7">
            <ScreenTitle eyebrow="콘티·악보" title="콘티 관리" aside={<AddButton label="새 콘티 만들기 (곡 보관함)" href={createHref} />} />

            <section aria-label="콘티 달력">
                <div className="flex items-center justify-between">
                    <p className={cn('text-sm font-semibold', ink)}>
                        {view.year}년 {view.month}월
                    </p>
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className={cn('flex size-8 items-center justify-center rounded-full', sub)}>
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className={cn('flex size-8 items-center justify-center rounded-full', sub)}>
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-7 text-center">
                    {WEEK_HEAD.map((label) => (
                        <span key={label} className={cn('pb-2 text-xs', sub)}>
                            {label}
                        </span>
                    ))}
                    {cells.map((date, index) => {
                        if (!date) return <span key={`blank-${index}`} />;
                        const setlist = byDate.get(date);
                        const active = date === picked;
                        return (
                            <button
                                key={date}
                                type="button"
                                onClick={() => (setlist && setlist.items.length ? openOrder(setlist.id) : setPicked(date))}
                                aria-pressed={active}
                                aria-label={`${view.month}월 ${dayOf(date)}일${setlist ? ` 콘티 ${SETLIST_STATUS[setlist.status].label}` : ''}`}
                                className="flex flex-col items-center gap-1 py-1"
                            >
                                <span
                                    className={cn(
                                        'flex size-9 items-center justify-center rounded-full text-[15px] tabular-nums',
                                        active ? cn(selected, 'font-semibold') : date === today ? todayText : body,
                                    )}
                                >
                                    {dayOf(date)}
                                </span>
                                <span className={cn('size-1.5 rounded-full', setlist ? SETLIST_STATUS[setlist.status].dot : 'bg-transparent')} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
            </section>

            <section aria-label="주차별 콘티 담당" className="space-y-3">
                <SectionTitle title="주차별 담당" meta="인도·콘티 작성" />
                {owners.length ? (
                    <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
                        {owners.map((setlist) => {
                            const status = SETLIST_STATUS[setlist.status];
                            const current = setlist.id === thisWeekId;
                            return (
                                <button
                                    key={setlist.id}
                                    type="button"
                                    onClick={() => (setlist.items.length ? openOrder(setlist.id) : setPicked(setlist.date))}
                                    className={cn(
                                        'flex w-[8.25rem] shrink-0 flex-col rounded-2xl p-3.5 text-left transition active:scale-[0.98]',
                                        current ? TONE_BLOCK.mint : cn('border', line),
                                        setlist.date === picked && !current && 'border-neutral-900 dark:border-white',
                                    )}
                                >
                                    <Eyebrow>
                                        {monthOf(setlist.date)}월 {shortWeekLabel(setlist.date)}
                                    </Eyebrow>
                                    <span className={cn('text-sm font-semibold tabular-nums', ink)}>
                                        {md(setlist.date)} <span className={cn('font-normal', sub)}>{weekday(setlist.date)}</span>
                                    </span>
                                    <span className="mt-3 flex min-w-0 items-center gap-2">
                                        {setlist.owner ? (
                                            <>
                                                <Avatar name={setlist.owner} size="sm" />
                                                <span className={cn('truncate text-[13px] font-medium', ink)}>{setlist.owner}</span>
                                            </>
                                        ) : (
                                            <span className={cn('text-[13px]', sub)}>담당 미정</span>
                                        )}
                                    </span>
                                    <span className={cn('mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium', status.text)}>
                                        <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
                                        {status.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className={cn('text-sm', sub)}>다가오는 콘티가 없어요</p>
                )}
            </section>

            <section aria-label="콘티 내역" className="space-y-1">
                <SectionTitle title="콘티 내역" meta={`${history.length}개 · 최근순`} />
                <ul>
                    {history.map((setlist) => {
                        const songs = songsOf(setlist.items);
                        const status = SETLIST_STATUS[setlist.status];
                        const empty = songs.length === 0;
                        return (
                            <li key={setlist.id} className={cn('border-b last:border-b-0', line)}>
                                <button
                                    type="button"
                                    disabled={empty}
                                    onClick={() => openOrder(setlist.id)}
                                    className={cn(
                                        '-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-2xl px-3 py-4 text-left transition disabled:cursor-default',
                                        setlist.date === picked && 'bg-neutral-50 dark:bg-neutral-800/60',
                                    )}
                                >
                                    <span className="w-9 shrink-0 text-center leading-none">
                                        <span className={cn('block text-[11px]', sub)}>{weekday(setlist.date)}</span>
                                        <span className={cn('mt-1 block text-lg font-semibold tabular-nums', empty ? sub : ink)}>{dayOf(setlist.date)}</span>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <Eyebrow>
                                            {setlist.date.slice(0, 4) !== String(yearOf(today)) && `${yearOf(setlist.date)}년 `}
                                            {monthOf(setlist.date)}월 {shortWeekLabel(setlist.date)} · <span className={status.text}>{status.label}</span>
                                        </Eyebrow>
                                        <span className={cn('mt-0.5 block truncate text-[15px] font-medium', empty ? sub : ink)}>
                                            {empty ? '아직 곡이 없어요' : displayTitle(setlist)}
                                        </span>
                                        {!empty && (
                                            <span className={cn('mt-1 block truncate text-xs tabular-nums', sub)}>
                                                {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                                                {songs.length}곡 · Key {songs.map((item) => item.key || '-').join('·')}
                                            </span>
                                        )}
                                    </span>
                                    {setlist.owner && <Avatar name={setlist.owner} size="md" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {!history.length && (
                    <div className="py-10 text-center">
                        <p className={cn('text-sm', sub)}>아직 저장된 콘티가 없어요</p>
                        <Link href={createHref} className={cn('mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold', selected)}>
                            곡 보관함에서 콘티 만들기
                        </Link>
                    </div>
                )}
            </section>
        </div>
    );
}
