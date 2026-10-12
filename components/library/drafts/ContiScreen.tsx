'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SETLISTS,
    SETLIST_STATUS,
    THIS_WEEK_SETLIST_ID,
    TODAY,
    dayOf,
    diffDays,
    md,
    member,
    monthGrid,
    monthOf,
    shortWeekLabel,
    songsOf,
    weekday,
} from './draftData';
import { AddButton, Avatar, Eyebrow, RoundIconButton, ScreenTitle, SectionTitle, TONE_BLOCK, body, ink, line, selected, sub, today } from './ui';

const WEEK_HEAD = ['일', '월', '화', '수', '목', '금', '토'];
const YEAR = 2026;

export default function ContiScreen({ openOrder }: { openOrder: (id: string) => void }) {
    const [month, setMonth] = useState(10);
    const [picked, setPicked] = useState(SETLISTS.find((item) => item.id === THIS_WEEK_SETLIST_ID)?.date ?? TODAY);
    const cells = monthGrid(YEAR, month);
    const byDate = new Map(SETLISTS.map((item) => [item.date, item]));
    const history = [...SETLISTS].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="space-y-7">
            <ScreenTitle
                eyebrow="콘티·악보"
                title="콘티 관리"
                aside={
                    <>
                        <RoundIconButton label="콘티 검색">
                            <Search size={17} />
                        </RoundIconButton>
                        <AddButton label="새 콘티" />
                    </>
                }
            />

            <section aria-label="콘티 달력">
                <div className="flex items-center justify-between">
                    <p className={cn('text-sm font-semibold', ink)}>
                        {YEAR}년 {month}월
                    </p>
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label="이전 달" onClick={() => setMonth((value) => Math.max(9, value - 1))} className={cn('flex size-8 items-center justify-center rounded-full', sub)}>
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" aria-label="다음 달" onClick={() => setMonth((value) => Math.min(11, value + 1))} className={cn('flex size-8 items-center justify-center rounded-full', sub)}>
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
                                onClick={() => setPicked(date)}
                                aria-pressed={active}
                                aria-label={`${month}월 ${dayOf(date)}일${setlist ? ` 콘티 ${SETLIST_STATUS[setlist.status].label}` : ''}`}
                                className="flex flex-col items-center gap-1 py-1"
                            >
                                <span
                                    className={cn(
                                        'flex size-9 items-center justify-center rounded-full text-[15px] tabular-nums',
                                        active ? cn(selected, 'font-semibold') : date === TODAY ? today : body,
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
                <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5">
                    {SETLISTS.filter((setlist) => diffDays(setlist.date) >= -7).map((setlist) => {
                        const owner = member(setlist.owner);
                        const status = SETLIST_STATUS[setlist.status];
                        const current = setlist.id === THIS_WEEK_SETLIST_ID;
                        return (
                            <button
                                key={setlist.id}
                                type="button"
                                onClick={() => setPicked(setlist.date)}
                                className={cn(
                                    'flex w-[8.25rem] shrink-0 flex-col rounded-2xl p-3.5 text-left transition active:scale-[0.98]',
                                    current ? TONE_BLOCK.mint : cn('border', line),
                                    setlist.date === picked && !current && 'border-neutral-900 dark:border-white',
                                )}
                            >
                                <Eyebrow>
                                    {monthOf(setlist.date)}월 {shortWeekLabel(setlist.date)}
                                </Eyebrow>
                                <span className={cn('text-sm font-semibold tabular-nums', ink)}>{md(setlist.date)}</span>
                                <span className="mt-3 flex items-center gap-2">
                                    <Avatar id={setlist.owner} size="sm" />
                                    <span className={cn('truncate text-[13px] font-medium', ink)}>{owner?.name}</span>
                                </span>
                                <span className={cn('mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium', status.text)}>
                                    <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
                                    {status.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section aria-label="콘티 내역" className="space-y-1">
                <SectionTitle title="콘티 내역" meta="최근순" />
                <ul>
                    {history.map((setlist) => {
                        const songs = songsOf(setlist.items);
                        const status = SETLIST_STATUS[setlist.status];
                        const empty = setlist.status === 'empty';
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
                                            {monthOf(setlist.date)}월 {shortWeekLabel(setlist.date)} · <span className={status.text}>{status.label}</span>
                                        </Eyebrow>
                                        <span className={cn('mt-0.5 block truncate text-[15px] font-medium', empty ? sub : ink)}>
                                            {empty ? '아직 콘티가 없어요' : setlist.theme}
                                        </span>
                                        {!empty && (
                                            <span className={cn('mt-1 block truncate text-xs tabular-nums', sub)}>
                                                {songs.length}곡 · Key {songs.map((item) => item.key).join('·')}
                                            </span>
                                        )}
                                    </span>
                                    <Avatar id={setlist.owner} size="md" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
