'use client';

import { useState } from 'react';
import { Captions, Drum, Guitar, Mic, MicVocal, Piano, Plus, SlidersVertical, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ASSIGNMENTS,
    EVENTS,
    EVENT_KIND,
    PARTS,
    TEAM_SUNDAYS,
    THIS_WEEK_SETLIST_ID,
    dayOf,
    md,
    member,
    setlistById,
    shortWeekLabel,
    weekDates,
    weekday,
    monthOf,
    type AssignStatus,
    type Assignment,
    type PartId,
} from './mockData';
import { AddButton, Avatar, AvatarStack, Eyebrow, ScreenTitle, SectionTitle, TONE_BLOCK, chip, ink, line, selected, sub } from './ui';

const PART_ICON: Record<PartId, LucideIcon> = {
    lead: Mic,
    vocal: MicVocal,
    keys: Piano,
    electric: Guitar,
    acoustic: Guitar,
    bass: Guitar,
    drums: Drum,
    sound: SlidersVertical,
    caption: Captions,
};

const STATUS_TEXT: Record<AssignStatus, { label: string; className: string }> = {
    confirmed: { label: '확정', className: 'text-emerald-600 dark:text-emerald-400' },
    pending: { label: '응답 대기', className: 'text-amber-600 dark:text-amber-400' },
    declined: { label: '불참', className: 'text-rose-600 dark:text-rose-400' },
};

export default function TeamScreen() {
    const [sunday, setSunday] = useState(setlistById(THIS_WEEK_SETLIST_ID).date);
    const list = ASSIGNMENTS[sunday] ?? [];
    const count = {
        confirmed: list.filter((item) => item.status === 'confirmed').length,
        pending: list.filter((item) => item.status === 'pending').length,
        declined: list.filter((item) => item.status === 'declined').length,
        vacant: list.filter((item) => !item.memberId).length,
    };
    const dates = weekDates(sunday);
    const events = EVENTS.filter((event) => dates.includes(event.date));

    return (
        <div className="space-y-7">
            <ScreenTitle eyebrow="팀" title="악기 담당 · 일정" aside={<AddButton label="담당 배정" />} />

            <div className={cn('grid grid-cols-4 gap-1 rounded-2xl border p-1.5', line)} role="tablist" aria-label="주일 선택">
                {TEAM_SUNDAYS.map((date) => {
                    const active = date === sunday;
                    return (
                        <button
                            key={date}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setSunday(date)}
                            className={cn('flex flex-col items-center rounded-xl py-2 transition', active ? selected : ink)}
                        >
                            <span className={cn('text-[10px]', active ? 'opacity-70' : sub)}>
                                {monthOf(date)}월 {shortWeekLabel(date)}
                            </span>
                            <span className="mt-0.5 text-sm font-semibold tabular-nums">{md(date)}</span>
                        </button>
                    );
                })}
            </div>

            <section aria-label="배치 현황" className="space-y-3">
                <p className={cn('text-[15px]', ink)}>
                    <span className="font-semibold tabular-nums">{list.length}자리</span> 중 <span className="font-semibold tabular-nums">{count.confirmed}명</span> 확정
                </p>
                <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`확정 ${count.confirmed}, 대기 ${count.pending}, 불참 ${count.declined}, 빈자리 ${count.vacant}`}>
                    {list.map((item, index) => (
                        <span
                            key={`${item.part}-${index}`}
                            className={cn(
                                'flex-1',
                                !item.memberId && 'bg-neutral-200 dark:bg-neutral-700',
                                item.status === 'confirmed' && 'bg-emerald-500',
                                item.status === 'pending' && 'bg-amber-400',
                                item.status === 'declined' && 'bg-rose-400',
                            )}
                        />
                    ))}
                </div>
                <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums', sub)}>
                    <Dot className="bg-emerald-500" label={`확정 ${count.confirmed}`} />
                    <Dot className="bg-amber-400" label={`대기 ${count.pending}`} />
                    <Dot className="bg-rose-400" label={`불참 ${count.declined}`} />
                    <Dot className="bg-neutral-300 dark:bg-neutral-600" label={`빈자리 ${count.vacant}`} />
                </p>
            </section>

            <section aria-label="악기 담당">
                <SectionTitle title="악기 담당" meta={`${md(sunday)} 주일`} />
                <ul className="mt-1">
                    {PARTS.map((part) => {
                        const rows = list.filter((item) => item.part === part.id);
                        if (!rows.length) return null;
                        const Icon = PART_ICON[part.id];
                        return (
                            <li key={part.id} className={cn('flex items-center gap-3.5 border-b py-3.5 last:border-b-0', line)}>
                                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', chip, ink)}>
                                    <Icon size={18} aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={cn('text-[15px] font-medium', ink)}>{part.name}</p>
                                    <p className="mt-0.5 truncate text-xs">{rows.map((row, index) => <StatusLabel key={index} row={row} last={index === rows.length - 1} />)}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    {rows.map((row, index) =>
                                        row.memberId ? (
                                            <span key={index} className={cn('inline-flex items-center gap-1.5', row.status === 'declined' && 'opacity-40')}>
                                                <Avatar id={row.memberId} size="sm" />
                                                {rows.length === 1 && row.status !== 'pending' && <span className={cn('text-[13px]', ink, row.status === 'declined' && 'line-through')}>{member(row.memberId)?.name}</span>}
                                            </span>
                                        ) : (
                                            <button key={index} type="button" className={cn('inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs font-medium', 'border-neutral-300 dark:border-neutral-600', ink)}>
                                                <Plus size={13} aria-hidden="true" />
                                                배정
                                            </button>
                                        ),
                                    )}
                                    {rows.length === 1 && rows[0].status === 'pending' && (
                                        <button type="button" className={cn('inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-amber-700 dark:text-amber-200', TONE_BLOCK.sand)}>
                                            다시 알리기
                                        </button>
                                    )}
                                    {rows.some((row) => row.status === 'declined') && (
                                        <button type="button" className={cn('inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-orange-700 dark:text-orange-200', TONE_BLOCK.peach)}>
                                            대체 찾기
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section aria-label="이번 주 일정" className="space-y-3">
                <SectionTitle title="이번 주 일정" meta={`${md(dates[0])} - ${md(dates[6])}`} />
                {events.length ? (
                    <ul className="space-y-2">
                        {events.map((event) => {
                            const kind = EVENT_KIND[event.kind];
                            return (
                                <li key={event.id} className={cn('flex items-center gap-3.5 rounded-2xl p-3', TONE_BLOCK[kind.tone])}>
                                    <span className="flex w-10 shrink-0 flex-col items-center leading-none">
                                        <span className={cn('text-[11px]', sub)}>{weekday(event.date)}</span>
                                        <span className={cn('mt-1 text-lg font-semibold tabular-nums', ink)}>{dayOf(event.date)}</span>
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <Eyebrow>{kind.label}</Eyebrow>
                                        <p className={cn('truncate text-sm font-medium', ink)}>{event.title}</p>
                                        <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                                            {event.start} - {event.end} · {event.place}
                                        </p>
                                    </div>
                                    <span className="flex flex-col items-end gap-1">
                                        <AvatarStack ids={event.attendees} max={2} size="xs" />
                                        <span className={cn('text-[11px] tabular-nums', sub)}>
                                            {event.attendees.length}/{event.expected}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <button type="button" className={cn('flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed text-sm', 'border-neutral-300 dark:border-neutral-600', sub)}>
                        <Plus size={15} aria-hidden="true" />
                        연습 일정 추가
                    </button>
                )}
            </section>
        </div>
    );
}

function StatusLabel({ row, last }: { row: Assignment; last: boolean }) {
    const text = row.status ? STATUS_TEXT[row.status] : { label: '빈자리', className: sub };
    return (
        <span className={text.className}>
            {text.label}
            {row.note && <span className={sub}> · {row.note}</span>}
            {!last && <span className={sub}> / </span>}
        </span>
    );
}

function Dot({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', className)} aria-hidden="true" />
            {label}
        </span>
    );
}
