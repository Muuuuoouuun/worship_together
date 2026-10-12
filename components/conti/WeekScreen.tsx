'use client';

import { useState } from 'react';
import { Bell, CalendarDays, ChevronRight, CircleDashed, ListMusic, MapPin, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    EVENTS,
    EVENT_KIND,
    SETLIST_STATUS,
    THIS_WEEK_SETLIST_ID,
    TODAY,
    dDay,
    dayOf,
    member,
    monthOf,
    setlistById,
    commentsOf,
    songsOf,
    weekDates,
    weekLabel,
    weekday,
    type EventKind,
    type Notice,
    type ScreenId,
    type TeamRequest,
} from './mockData';
import { AddButton, Avatar, AvatarStack, Eyebrow, KeyText, RoundIconButton, ScreenTitle, SectionTitle, TONE_BLOCK, TONE_DOT, TONE_ICON, body, ink, line, selected, sub, today } from './ui';
import { NoticeAvatar } from './AlertsScreen';

const EVENT_ICON: Record<EventKind, typeof Bell> = {
    rehearsal: CircleDashed,
    service: CalendarDays,
    prayer: Bell,
};

export default function WeekScreen({ requests, notices, go, openOrder }: { requests: TeamRequest[]; notices: Notice[]; go: (screen: ScreenId) => void; openOrder: (id: string) => void }) {
    const setlist = setlistById(THIS_WEEK_SETLIST_ID);
    const dates = weekDates(setlist.date);
    const [day, setDay] = useState(setlist.date);
    const songs = songsOf(setlist.items);
    const owner = member(setlist.owner);
    const events = EVENTS.filter((event) => event.date === day);
    const openRequests = requests.filter((request) => !request.done);
    const comments = commentsOf(setlist.items);
    const unread = notices.filter((notice) => notice.unread).length;

    return (
        <div className="space-y-7">
            <ScreenTitle
                eyebrow={weekLabel(setlist.date)}
                title={`${monthOf(setlist.date)}월 ${dayOf(setlist.date)}일`}
                trailing={`주일 · ${dDay(setlist.date)}`}
                aside={
                    <>
                        <span className="relative">
                            <RoundIconButton label={`알림 ${unread}개`} onClick={() => go('alerts')}>
                                <Bell size={18} />
                            </RoundIconButton>
                            {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-900" aria-hidden="true" />}
                        </span>
                        <AddButton label="일정 추가" />
                    </>
                }
            />

            <ol className="grid grid-cols-7 text-center" aria-label="이번 주 날짜">
                {dates.map((date) => {
                    const active = date === day;
                    const kinds = Array.from(new Set(EVENTS.filter((event) => event.date === date).map((event) => event.kind)));
                    return (
                        <li key={date}>
                            <button type="button" onClick={() => setDay(date)} aria-pressed={active} className="flex w-full flex-col items-center gap-2 py-1">
                                <span className={cn('relative text-xs', active ? cn('font-semibold', ink) : sub)}>
                                    {weekday(date)}
                                    {active && <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-neutral-900 dark:bg-white" aria-hidden="true" />}
                                </span>
                                <span
                                    className={cn(
                                        'mt-1 flex size-9 items-center justify-center rounded-xl text-[15px] tabular-nums',
                                        active ? cn(selected, 'font-semibold') : date === TODAY ? today : body,
                                    )}
                                >
                                    {dayOf(date)}
                                </span>
                                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                                    {kinds.map((kind) => (
                                        <span key={kind} className={cn('size-1.5 rounded-full', TONE_DOT[EVENT_KIND[kind].tone])} />
                                    ))}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>

            <section aria-label="이번 주 콘티">
                <button
                    type="button"
                    onClick={() => openOrder(setlist.id)}
                    className={cn('block w-full rounded-3xl p-5 text-left transition active:scale-[0.99]', TONE_BLOCK.mint)}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <Eyebrow>
                                이번 주 콘티 · <span className={SETLIST_STATUS[setlist.status].text}>{SETLIST_STATUS[setlist.status].label}</span>
                            </Eyebrow>
                            <h2 className={cn('mt-1 text-lg font-semibold tracking-tight', ink)}>{setlist.theme}</h2>
                            <p className={cn('mt-0.5 text-xs', sub)}>{setlist.service} · 오전 11:00</p>
                        </div>
                        <ListMusic size={20} className={TONE_ICON.mint} aria-hidden="true" />
                    </div>

                    <ol className="mt-4 space-y-2">
                        {songs.map((item, index) => (
                            <li key={item.id} className="flex items-center gap-3 text-[13px]">
                                <span className={cn('w-3 tabular-nums', sub)}>{index + 1}</span>
                                <span className={cn('min-w-0 flex-1 truncate', ink)}>{item.title}</span>
                                <span className={cn('shrink-0 text-xs tabular-nums', sub)}>
                                    <KeyText from={item.originalKey} to={item.key} />
                                </span>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-emerald-900/10 pt-3.5 dark:border-white/10">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                            <MessageCircle size={14} aria-hidden="true" />
                            {songs.length}곡 · 코멘트 {comments.length}
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <span className={cn('text-xs', sub)}>담당</span>
                            <Avatar id={setlist.owner} size="sm" />
                            <span className={cn('text-xs font-medium', ink)}>{owner?.name}</span>
                        </span>
                    </div>
                </button>
            </section>

            <section aria-label="팀 소식" className="space-y-1">
                <SectionTitle
                    title="팀 소식"
                    meta={unread > 0 ? `새 소식 ${unread}` : undefined}
                    action={<button type="button" onClick={() => go('alerts')} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>모두 보기</button>}
                />
                <ul>
                    {notices.slice(0, 3).map((notice) => (
                        <li key={notice.id} className={cn('flex gap-3 border-b py-3.5 last:border-b-0', line)}>
                            <NoticeAvatar notice={notice} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px]">
                                    <span className={cn('font-semibold', ink)}>{member(notice.actor)?.name}</span>
                                    <span className={body}>님이 {notice.message}</span>
                                </p>
                                {notice.quote && <p className={cn('mt-0.5 truncate text-xs', sub)}>“{notice.quote}”</p>}
                            </div>
                            <span className={cn('shrink-0 text-[11px]', sub)}>{notice.ago}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-label="일정" className="space-y-1">
                <SectionTitle
                    title={day === setlist.date ? '주일 일정' : `${weekday(day)}요일 일정`}
                    meta={`${monthOf(day)}/${dayOf(day)}`}
                    action={<button type="button" onClick={() => go('team')} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>팀 배치</button>}
                />
                <ul className={cn('divide-y', 'divide-neutral-100 dark:divide-neutral-800')}>
                    {events.map((event) => {
                        const kind = EVENT_KIND[event.kind];
                        const Icon = EVENT_ICON[event.kind];
                        return (
                            <li key={event.id} className="flex gap-3.5 py-4">
                                <Icon size={18} className={cn('mt-4 shrink-0', TONE_ICON[kind.tone])} aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <Eyebrow>{kind.label}</Eyebrow>
                                    <p className={cn('mt-0.5 text-[15px] font-medium', ink)}>{event.title}</p>
                                    <p className={cn('mt-1.5 flex items-center gap-1 text-xs tabular-nums', sub)}>
                                        {event.start} - {event.end}
                                        <span aria-hidden="true">·</span>
                                        <MapPin size={12} aria-hidden="true" />
                                        {event.place}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end justify-center gap-1">
                                    <AvatarStack ids={event.attendees} max={3} size="xs" />
                                    <span className={cn('text-[11px] tabular-nums', sub)}>
                                        {event.attendees.length}/{event.expected}명
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                    {!events.length && <li className={cn('py-8 text-center text-sm', sub)}>이 날은 일정이 없어요</li>}
                </ul>
            </section>

            <button
                type="button"
                onClick={() => go('requests')}
                className={cn('flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99]', line)}
            >
                <span className={cn('flex size-2 rounded-full', TONE_DOT.peach)} aria-hidden="true" />
                <span className={cn('flex-1 text-sm', ink)}>
                    확인할 요청 <span className="font-semibold tabular-nums">{openRequests.length}건</span>
                </span>
                <AvatarStack ids={openRequests.map((request) => request.from)} max={3} size="xs" />
                <ChevronRight size={16} className={sub} aria-hidden="true" />
            </button>
        </div>
    );
}
