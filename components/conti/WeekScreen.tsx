'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, ListMusic, MapPin, MessageCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SETLIST_STATUS,
    commentsOf,
    dDay,
    dayOf,
    displayTitle,
    formatTimeLabel,
    md,
    monthOf,
    nextSunday,
    songsOf,
    weekDates,
    weekLabel,
    weekday,
    type ScreenId,
} from './model';
import { useConti } from './context';
import { EVENT_KIND } from './planningUi';
import { AddButton, Avatar, AvatarStack, Eyebrow, KeyText, RoundIconButton, SampleChip, ScreenTitle, SectionTitle, TONE_BLOCK, TONE_DOT, TONE_ICON, body, ink, line, selected, sub, todayText, STATUS, dashed, divide, ringCard } from './ui';
import { NoticeAvatar } from './AlertsScreen';

export default function WeekScreen({ go, openOrder }: { go: (screen: ScreenId) => void; openOrder: (id: string) => void }) {
    const { today, setlists, thisWeekId, editor, planning } = useConti();
    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const anchor = nextSunday(today);
    const dates = weekDates(anchor);
    const [day, setDay] = useState(anchor);
    const songs = setlist ? songsOf(setlist.items) : [];
    const comments = setlist ? commentsOf(setlist.items) : [];
    const setlistDates = new Set(setlists.map((item) => item.date));
    const events = planning.events.filter((event) => event.date === day);
    const unread = planning.unreadCount;
    const sample = planning.sample ? <SampleChip /> : null;
    const dayName = (date: string) => (weekday(date) === '일' ? '주일' : `${weekday(date)}요일`);
    const manageHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=schedule` : `${planning.planningHref}?tab=schedule`;
    const openRequests = planning.requests.filter((request) => !request.done);

    return (
        <div className="space-y-7">
            <ScreenTitle
                eyebrow={weekLabel(anchor)}
                title={`${monthOf(anchor)}월 ${dayOf(anchor)}일`}
                trailing={`${dayName(anchor)} · ${dDay(anchor, today)}`}
                aside={
                    <>
                        <span className="relative">
                            <RoundIconButton label={`알림 ${unread}개`} onClick={() => go('alerts')}>
                                <Bell size={18} />
                            </RoundIconButton>
                            {unread > 0 && <span className={cn('absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                        </span>
                        <AddButton label="일정 추가 (일정·요청 화면)" href={manageHref} />
                    </>
                }
            />

            <ol className="grid grid-cols-7 text-center" aria-label="이번 주 날짜">
                {dates.map((date) => {
                    const active = date === day;
                    const kinds = Array.from(new Set(planning.events.filter((event) => event.date === date).map((event) => event.kind)));
                    const hasSetlist = setlistDates.has(date);
                    return (
                        <li key={date}>
                            <button type="button" onClick={() => setDay(date)} aria-pressed={active} className="flex w-full flex-col items-center gap-2 py-1">
                                <span className={cn('relative text-xs', active ? cn('font-semibold', ink) : sub)}>
                                    {weekday(date)}
                                    {active && <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-foreground" aria-hidden="true" />}
                                </span>
                                <span
                                    className={cn(
                                        'mt-1 flex size-9 items-center justify-center rounded-xl text-[15px] tabular-nums',
                                        active ? cn(selected, 'font-semibold') : date === today ? todayText : body,
                                    )}
                                >
                                    {dayOf(date)}
                                </span>
                                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                                    {hasSetlist && <span className="size-1.5 rounded-full bg-brand" />}
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
                {setlist ? (
                    <button
                        type="button"
                        onClick={() => openOrder(setlist.id)}
                        className={cn('block w-full rounded-3xl p-5 text-left transition active:scale-[0.99]', TONE_BLOCK.mint)}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Eyebrow>
                                    {setlist.date === anchor ? '이번 주 콘티' : `${md(setlist.date)} ${dayName(setlist.date)} 콘티`} · <span className={SETLIST_STATUS[setlist.status].text}>{SETLIST_STATUS[setlist.status].label}</span>
                                </Eyebrow>
                                <h2 className={cn('mt-1 text-lg font-semibold tracking-tight', ink)}>{displayTitle(setlist)}</h2>
                                <p className={cn('mt-0.5 text-xs', sub)}>
                                    {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                                    {formatTimeLabel(setlist.time)}
                                </p>
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
                            {!songs.length && <li className={cn('text-[13px]', sub)}>아직 곡이 없어요</li>}
                        </ol>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-emerald-900/10 pt-3.5 dark:border-white/10">
                            <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                                <MessageCircle size={14} aria-hidden="true" />
                                {songs.length}곡 · 코멘트 {comments.length}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className={cn('text-xs', sub)}>담당</span>
                                {setlist.owner ? (
                                    <>
                                        <Avatar name={setlist.owner} size="sm" />
                                        <span className={cn('text-xs font-medium', ink)}>{setlist.owner}</span>
                                    </>
                                ) : (
                                    <span className={cn('text-xs', sub)}>미정</span>
                                )}
                            </span>
                        </div>
                    </button>
                ) : (
                    <div className={cn('rounded-3xl px-5 py-8 text-center', dashed)}>
                        <p className={cn('text-[15px] font-medium', ink)}>이번 주 콘티가 아직 없어요</p>
                        <p className={cn('mt-1 text-xs', sub)}>곡 보관함에서 콘티를 만들면 여기에 바로 보여요</p>
                        <Link
                            href={editor?.createHref ?? '/dashboard/songs/library'}
                            className={cn('mt-4 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold', selected)}
                        >
                            <Plus size={15} aria-hidden="true" />
                            콘티 만들기
                        </Link>
                    </div>
                )}
            </section>

            <section aria-label="팀 소식" className="space-y-1">
                <SectionTitle
                    title="팀 소식"
                    badge={sample}
                    meta={unread > 0 ? `새 소식 ${unread}` : undefined}
                    action={<button type="button" onClick={() => go('alerts')} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>모두 보기</button>}
                />
                <ul>
                    {planning.notices.slice(0, 3).map((notice) => (
                        <li key={notice.id} className={cn('flex gap-3 border-b py-3.5 last:border-b-0', line)}>
                            <NoticeAvatar notice={notice} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px]">
                                    {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                                    <span className={notice.actor ? body : cn('font-medium', ink)}>{notice.title}</span>
                                </p>
                                {(notice.quote || notice.message !== notice.title) && <p className={cn('mt-0.5 truncate text-xs', sub)}>{notice.quote ? `“${notice.quote}”` : notice.message}</p>}
                            </div>
                            <span className={cn('shrink-0 text-[11px]', sub)}>{notice.ago}</span>
                        </li>
                    ))}
                    {planning.ready && !planning.notices.length && <li className={cn('py-4 text-sm', sub)}>아직 팀 소식이 없어요</li>}
                </ul>
            </section>

            <section aria-label="일정" className="space-y-1">
                <SectionTitle
                    title={`${dayName(day)} 일정`}
                    badge={sample}
                    meta={`${monthOf(day)}/${dayOf(day)}`}
                    action={<button type="button" onClick={() => go('team')} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>팀 배치</button>}
                />
                <ul className={divide}>
                    {events.map((event) => {
                        const kind = EVENT_KIND[event.kind];
                        const Icon = kind.icon;
                        return (
                            <li key={event.id} className="flex gap-3.5 py-4">
                                <Icon size={18} className={cn('mt-4 shrink-0', TONE_ICON[kind.tone])} aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <Eyebrow>{kind.label}</Eyebrow>
                                    <p className={cn('mt-0.5 text-[15px] font-medium', ink)}>{event.title}</p>
                                    <p className={cn('mt-1.5 flex items-center gap-1 text-xs tabular-nums', sub)}>
                                        {event.start} - {event.end}
                                        {event.place && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <MapPin size={12} aria-hidden="true" />
                                                {event.place}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end justify-center gap-1">
                                    {event.attendees.length > 0 && <AvatarStack names={event.attendees} max={3} size="xs" />}
                                    <span className={cn('text-[11px] tabular-nums', sub)}>
                                        {event.expected ? `${event.attendees.length}/${event.expected}명` : '인원 미정'}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                    {!events.length && <li className={cn('py-8 text-center text-sm', sub)}>{planning.ready ? '이 날은 일정이 없어요' : '일정을 불러오는 중…'}</li>}
                </ul>
            </section>

            <button
                type="button"
                onClick={() => go('requests')}
                className={cn('flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99]', line)}
            >
                <span className={cn('flex size-2 rounded-full', openRequests.length ? TONE_DOT.peach : STATUS.idle.dot)} aria-hidden="true" />
                <span className={cn('flex-1 text-sm', ink)}>
                    확인할 요청 <span className="font-semibold tabular-nums">{openRequests.length}건</span>
                    {sample && <span className="ml-2">{sample}</span>}
                </span>
                <AvatarStack names={openRequests.map((request) => request.author).filter((name): name is string => Boolean(name))} max={3} size="xs" />
                <ChevronRight size={16} className={sub} aria-hidden="true" />
            </button>
        </div>
    );
}
