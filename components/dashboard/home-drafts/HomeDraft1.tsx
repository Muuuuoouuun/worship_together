'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell, CalendarPlus, ChevronRight, Library, ListMusic, MapPin, MessageCircle, Radio, UserPlus, type LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { useConti } from '@/components/conti/context';
import { NoticeAvatar } from '@/components/conti/AlertsScreen';
import { EVENT_KIND, ROLE_ICON } from '@/components/conti/planningUi';
import { SETLIST_STATUS, commentsOf, dDay, dayOf, displayTitle, formatTimeLabel, md, monthOf, nextSunday, songsOf, weekDates, weekLabel, weekday, type ContiSetlist } from '@/components/conti/model';
import type { Notice, PartAssignment, RequestItem, ServiceDay, TeamEvent } from '@/components/conti/planningBridge';
import { AddButton, Avatar, AvatarStack, Eyebrow, KeyText, SampleChip, SectionTitle, STATUS, TONE_BLOCK, TONE_DOT, TONE_ICON, body, divide, ink, line, ringCard, selected, sub, todayText } from '@/components/conti/ui';

/**
 * 홈 시안 1 · 주간 보드
 * 모바일 '이번 주' 화면(components/conti/WeekScreen.tsx)을 데스크톱 폭에 그대로 편 홈.
 * 위: 제목 줄 · 지금 할 일 · 한 주 날짜 줄 / 아래 7:5 두 단: 왼쪽 이번 주 콘티 · 고른 날 일정, 오른쪽 팀 소식 · 확인할 요청 · 바로가기.
 * 좁은 화면에서는 같은 순서(콘티 → 고른 날 일정 → 팀 소식 → 요청 → 바로가기) 그대로 한 단이 됩니다.
 * 보이는 순서와 문서(포커스) 순서가 어느 폭에서도 같도록 CSS order 로 바꾸지 않습니다.
 */

const dayName = (date: string) => (weekday(date) === '일' ? '주일' : `${weekday(date)}요일`);
const withTab = (href: string, tab: string) => `${href}${href.includes('?') ? '&' : '?'}tab=${tab}`;

const textLink = cn('shrink-0 text-xs font-medium underline-offset-2 hover:underline', body);
const ALERTS_HREF = '/dashboard/songs?tab=alerts';
const TEAM_HREF = '/dashboard/songs?tab=team';
const contiHref = (id: string) => `/dashboard/songs?tab=order&setlist=${encodeURIComponent(id)}`;

/** 배치 줄의 좁은 칸에 쓰는 짧은 역할 이름 (전체 이름은 title · 화면 낭독용 문구에) */
const SHORT_ROLE: Partial<Record<PartAssignment['role'], string>> = { media: '영상' };

const ASSIGN_STATUS = {
    confirmed: { label: '확정', dot: STATUS.ok.dot },
    pending: { label: '응답 대기', dot: STATUS.warn.dot },
    declined: { label: '불참', dot: STATUS.danger.dot },
} as const;

export default function HomeDraft1() {
    const { today, setlists, thisWeekId, editor, planning } = useConti();
    const anchor = nextSunday(today);
    const dates = weekDates(anchor);
    const [day, setDay] = useState(anchor);
    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const sample = planning.sample ? <SampleChip /> : null;
    const scheduleHref = withTab(planning.planningHref, 'schedule');
    const requestsHref = withTab(planning.planningHref, 'requests');
    const sessionHref = (id: string) => editor?.sessionHref?.(id) ?? `/session/${DEMO_SESSION_ID}`;
    const openRequests = planning.requests.filter((request) => !request.done);

    return (
        <div className="space-y-7 break-keep">
            <Header anchor={anchor} today={today} unread={planning.unreadCount} scheduleHref={scheduleHref} />
            <NextSteps anchor={anchor} openRequests={openRequests} requestsHref={requestsHref} />
            <WeekStrip dates={dates} day={day} today={today} setlists={setlists} events={planning.events} onPick={setDay} />

            <div className="grid gap-8 xl:grid-cols-12 xl:items-start xl:gap-x-10">
                <div className="flex min-w-0 flex-col gap-8 xl:col-span-7">
                    <ContiBlock setlist={setlist} anchor={anchor} createHref={editor?.createHref ?? '/dashboard/songs/library'} />
                    <DaySchedule day={day} anchor={anchor} sample={sample} sessionHref={sessionHref} scheduleHref={scheduleHref} />
                </div>
                <div className="flex min-w-0 flex-col gap-8 xl:col-span-5">
                    <TeamNews sample={sample} requestsHref={requestsHref} />
                    <OpenRequests requests={openRequests} sample={sample} href={requestsHref} />
                    <QuickLinks createHref={editor?.createHref ?? '/dashboard/songs/library'} scheduleHref={scheduleHref} />
                </div>
            </div>
        </div>
    );
}

/* ───────────── 제목 줄 ───────────── */

function Header({ anchor, today, unread, scheduleHref }: { anchor: string; today: string; unread: number; scheduleHref: string }) {
    return (
        <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <Eyebrow className="text-xs">{weekLabel(anchor)}</Eyebrow>
                <h2 className={cn('mt-1 text-2xl font-semibold tracking-tight', ink)}>
                    {monthOf(anchor)}월 {dayOf(anchor)}일{' '}
                    <span className={cn('ml-1 font-normal', sub)}>
                        {dayName(anchor)} · {dDay(anchor, today)}
                    </span>
                </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Link
                    href={ALERTS_HREF}
                    aria-label={unread > 0 ? `팀 소식 · 새 소식 ${unread}개` : '팀 소식'}
                    className={cn('relative inline-flex size-10 items-center justify-center rounded-full border transition hover:bg-muted active:scale-95', line, ink)}
                >
                    <Bell size={18} aria-hidden="true" />
                    {unread > 0 && <span className={cn('absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                </Link>
                <AddButton label="일정 추가 (일정·요청 화면)" href={scheduleHref} />
            </div>
        </header>
    );
}

/* ───────────── 지금 할 일 (인도자 기준) ───────────── */

function NextSteps({ anchor, openRequests, requestsHref }: { anchor: string; openRequests: RequestItem[]; requestsHref: string }) {
    const { planning } = useConti();
    const viewer = planning.viewer;
    const service = planning.services.find((item) => item.date === anchor) ?? null;
    const steps: { key: string; label: string; href: string; dot: string }[] = [];

    if (openRequests.length) steps.push({ key: 'requests', label: `요청 ${openRequests.length}건 답하기`, href: requestsHref, dot: 'bg-secondary' });
    if (service && viewer?.canManage) {
        for (const item of service.assignments.filter((slot) => slot.status === 'declined' && slot.volunteers.length)) {
            steps.push({ key: `sub-${item.slotId}`, label: `${item.roleLabel} 대체 확정 · ${item.volunteers[0].name} 지원`, href: TEAM_HREF, dot: STATUS.danger.dot });
        }
        const vacant = service.assignments.filter((slot) => slot.status === null);
        if (vacant.length) steps.push({ key: 'vacant', label: vacant.length === 1 ? `${vacant[0].roleLabel} 빈자리 채우기` : `빈자리 ${vacant.length}개 채우기`, href: TEAM_HREF, dot: STATUS.idle.dot });
    }
    const mine = planning.services.find((item) => item.date > anchor && item.assignments.some((slot) => slot.mine && slot.status === 'pending'));
    if (mine) steps.push({ key: 'mine', label: `${md(mine.date)} ${mine.assignments.find((slot) => slot.mine)?.roleLabel ?? ''} 참석 응답`, href: TEAM_HREF, dot: STATUS.warn.dot });

    if (!viewer || !steps.length) return null;

    return (
        <section aria-label="지금 할 일" className={cn('-mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-y py-2.5', line)}>
            <p className={cn('mr-1 text-sm', body)}>
                <span className={cn('font-semibold', ink)}>{viewer.name}님</span>, 지금 할 일 <span className="font-semibold tabular-nums">{steps.length}개</span>
            </p>
            <ul className="flex flex-wrap gap-2">
                {steps.slice(0, 4).map((step) => (
                    <li key={step.key}>
                        <Link href={step.href} className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'gap-2 font-medium')}>
                            <span className={cn('size-1.5 rounded-full', step.dot)} aria-hidden="true" />
                            {step.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ───────────── 한 주 날짜 줄 ───────────── */

function WeekStrip({ dates, day, today, setlists, events, onPick }: { dates: string[]; day: string; today: string; setlists: ContiSetlist[]; events: TeamEvent[]; onPick: (date: string) => void }) {
    return (
        <ol className="grid grid-cols-7 gap-1 sm:gap-2" aria-label="이번 주 날짜">
            {dates.map((date) => {
                const active = date === day;
                const isToday = date === today;
                const dayEvents = events.filter((event) => event.date === date);
                const conti = setlists.find((item) => item.date === date);
                const labels = [
                    ...dayEvents.map((event) => ({
                        key: event.id,
                        dot: TONE_DOT[EVENT_KIND[event.kind].tone],
                        text: event.kind === 'rehearsal' ? `${EVENT_KIND.rehearsal.label} ${event.start}` : event.title,
                    })),
                    ...(conti ? [{ key: conti.id, dot: active ? TONE_DOT.mint : 'bg-brand', text: `콘티 ${SETLIST_STATUS[conti.status].label}` }] : []),
                ];
                const kinds = Array.from(new Set(dayEvents.map((event) => event.kind)));
                const summary = labels.length ? labels.map((label) => label.text).join(', ') : '일정 없음';
                return (
                    <li key={date} className="min-w-0">
                        <button
                            type="button"
                            onClick={() => onPick(date)}
                            aria-pressed={active}
                            aria-current={isToday ? 'date' : undefined}
                            aria-label={`${monthOf(date)}월 ${dayOf(date)}일 ${dayName(date)}${isToday ? ' (오늘)' : ''} · ${summary}`}
                            className={cn(
                                // 모바일: 기준 화면처럼 날짜 숫자만 검정 칸 · 요일 밑줄 / sm 이상: 칸 전체가 검정
                                'flex h-full w-full min-w-0 flex-col items-center gap-2 rounded-2xl py-1 transition',
                                'sm:min-h-[6.25rem] sm:items-stretch sm:gap-0 sm:border sm:px-2.5 sm:py-2.5 sm:text-left xl:px-3.5',
                                active ? 'sm:border-transparent sm:bg-primary sm:text-primary-foreground' : 'sm:border-border/70 sm:hover:bg-muted',
                            )}
                        >
                            <span className={cn('relative flex items-center gap-1.5 text-xs', active ? cn('font-semibold', ink, 'sm:text-current') : sub)}>
                                {weekday(date)}
                                {isToday && <span className={cn('hidden text-[11px] font-semibold sm:inline', active ? 'opacity-80' : 'text-brand')}>오늘</span>}
                                {active && <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-foreground sm:hidden" aria-hidden="true" />}
                            </span>
                            <span
                                className={cn(
                                    'mt-1 flex size-9 items-center justify-center rounded-xl text-[15px] tabular-nums',
                                    'sm:mt-0.5 sm:size-auto sm:justify-start sm:rounded-none sm:text-[22px] sm:leading-7 sm:tracking-tight',
                                    active ? cn(selected, 'font-semibold sm:bg-transparent sm:text-current') : isToday ? todayText : cn('font-medium', body),
                                )}
                            >
                                {dayOf(date)}
                            </span>
                            <span className="flex h-1.5 gap-0.5 sm:hidden" aria-hidden="true">
                                {conti && <span className="size-1.5 rounded-full bg-brand" />}
                                {kinds.map((kind) => (
                                    <span key={kind} className={cn('size-1.5 rounded-full', TONE_DOT[EVENT_KIND[kind].tone])} />
                                ))}
                            </span>
                            <span className="mt-auto hidden space-y-1 pt-2 sm:block" aria-hidden="true">
                                {labels.slice(0, 2).map((label) => (
                                    <span key={label.key} className={cn('flex min-w-0 items-start gap-1.5 text-[11px] leading-4', active ? 'opacity-85' : body)}>
                                        <span className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', label.dot)} />
                                        <span className="line-clamp-2 min-w-0">{label.text}</span>
                                    </span>
                                ))}
                                {labels.length > 2 && <span className={cn('block pl-3 text-[11px] leading-4', active ? 'opacity-70' : sub)}>외 {labels.length - 2}개</span>}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/* ───────────── 이번 주 콘티 (민트 블록) ───────────── */

function ContiBlock({ setlist, anchor, createHref, className }: { setlist: ContiSetlist | null; anchor: string; createHref: string; className?: string }) {
    if (!setlist) {
        return (
            <section aria-label="이번 주 콘티" className={cn('rounded-3xl border border-dashed border-input px-6 py-10 text-center', className)}>
                <p className={cn('text-base font-medium', ink)}>이번 주 콘티가 아직 없어요</p>
                <p className={cn('mt-1 text-sm', sub)}>곡 보관함에서 콘티를 만들면 여기에 바로 보여요</p>
                <Link href={createHref} className={cn(buttonVariants({ size: 'sm' }), 'mt-5')}>
                    콘티 만들기
                </Link>
            </section>
        );
    }
    const songs = songsOf(setlist.items);
    const comments = commentsOf(setlist.items);
    const status = SETLIST_STATUS[setlist.status];
    return (
        <section aria-labelledby="home1-conti-title" className={cn('rounded-3xl p-6 sm:px-7', TONE_BLOCK.mint, className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <Eyebrow className="text-xs">
                        {setlist.date === anchor ? '이번 주 콘티' : `${md(setlist.date)} ${dayName(setlist.date)} 콘티`} · <span className={status.text}>{status.label}</span>
                    </Eyebrow>
                    <h2 id="home1-conti-title" className={cn('mt-1 text-2xl font-semibold tracking-tight', ink)}>
                        {displayTitle(setlist)}
                    </h2>
                    <p className={cn('mt-1 text-sm', sub)}>
                        {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                        {md(setlist.date)} {dayName(setlist.date)} {formatTimeLabel(setlist.time)}
                    </p>
                </div>
                <ListMusic size={22} className={cn('mt-0.5 shrink-0', TONE_ICON.mint)} aria-hidden="true" />
            </div>

            <ol className="mt-4 divide-y divide-foreground/[0.07]">
                {songs.map((item, index) => (
                    <li key={item.id} className="flex items-center gap-3 py-2 text-sm sm:gap-4">
                        <span className={cn('w-4 shrink-0 text-[13px] tabular-nums', sub)}>{index + 1}</span>
                        <span className={cn('min-w-0 flex-1 truncate', ink)}>{item.title}</span>
                        {item.lead && <span className={cn('hidden w-[4.5rem] shrink-0 truncate text-xs sm:inline', sub)}>리드 {item.lead}</span>}
                        <span className={cn('hidden w-8 shrink-0 items-center gap-1 text-xs tabular-nums sm:inline-flex', sub)}>
                            {item.comments.length > 0 && (
                                <>
                                    <MessageCircle size={12} aria-hidden="true" />
                                    <span className="sr-only">코멘트</span>
                                    {item.comments.length}
                                </>
                            )}
                        </span>
                        <span className={cn('w-[4.5rem] shrink-0 text-right text-xs tabular-nums', body)}>
                            <KeyText from={item.originalKey} to={item.key} />
                        </span>
                    </li>
                ))}
                {!songs.length && <li className={cn('py-3 text-sm', sub)}>아직 곡이 없어요</li>}
            </ol>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-foreground/10 pt-3.5">
                <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                    <MessageCircle size={14} aria-hidden="true" />
                    {songs.length}곡 · 코멘트 {comments.length}
                </span>
                <div className="flex items-center gap-4">
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
                    <Link href={contiHref(setlist.id)} className={cn(buttonVariants({ size: 'sm' }), 'gap-1 pr-2.5')}>
                        콘티 열기
                        <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* ───────────── 고른 날 일정 · 팀 배치 ───────────── */

function DaySchedule({ day, anchor, sample, sessionHref, scheduleHref, className }: { day: string; anchor: string; sample: ReactNode; sessionHref: (id: string) => string; scheduleHref: string; className?: string }) {
    const { planning, thisWeekId } = useConti();
    const events = planning.events.filter((event) => event.date === day);
    return (
        <section aria-label={`${dayName(day)} 일정`} className={cn('space-y-1', className)}>
            <SectionTitle title={`${dayName(day)} 일정`} badge={sample} meta={`${monthOf(day)}/${dayOf(day)}`} action={<Link href={TEAM_HREF} className={textLink}>팀 배치</Link>} />
            <ul className={divide}>
                {events.map((event) => {
                    const service = event.kind === 'worship' ? (planning.services.find((item) => item.eventId === event.id) ?? null) : null;
                    const live = Boolean(service && event.date === anchor && thisWeekId && service.setlistId === thisWeekId);
                    return <EventRow key={event.id} event={event} service={service} liveHref={live && thisWeekId ? sessionHref(thisWeekId) : null} />;
                })}
                {!events.length && (
                    <li className="flex flex-wrap items-center justify-between gap-3 py-6">
                        <span className={cn('text-sm', sub)}>{planning.ready ? '이 날은 일정이 없어요' : '일정을 불러오는 중…'}</span>
                        <Link href={scheduleHref} className={cn(buttonVariants({ variant: 'outline', size: 'xs' }))}>
                            <CalendarPlus aria-hidden="true" />
                            일정 추가
                        </Link>
                    </li>
                )}
            </ul>
        </section>
    );
}

function EventRow({ event, service, liveHref }: { event: TeamEvent; service: ServiceDay | null; liveHref: string | null }) {
    const kind = EVENT_KIND[event.kind];
    const Icon = kind.icon;
    return (
        <li className="py-3.5">
            <div className="flex items-start gap-3.5">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', TONE_BLOCK[kind.tone])}>
                    <Icon size={18} className={TONE_ICON[kind.tone]} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <Eyebrow>{kind.label}</Eyebrow>
                    <h3 className={cn('mt-0.5 text-base font-semibold tracking-tight', ink)}>{event.title}</h3>
                    <p className={cn('mt-1 flex flex-wrap items-center gap-x-1 text-xs tabular-nums', sub)}>
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
                {liveHref ? (
                    <Link href={liveHref} className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
                        <Radio aria-hidden="true" />
                        <span className="hidden sm:inline">라이브 예배 세션</span>
                        <span className="sm:hidden">세션 입장</span>
                    </Link>
                ) : (
                    !service && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            {event.attendees.length > 0 && <AvatarStack names={event.attendees} max={4} size="xs" />}
                            <span className={cn('text-[11px] tabular-nums', sub)}>{event.expected ? `${event.attendees.length}/${event.expected}명 확인` : '인원 미정'}</span>
                        </div>
                    )
                )}
            </div>
            {service && <ServiceTeam service={service} />}
        </li>
    );
}

function ServiceTeam({ service }: { service: ServiceDay }) {
    const { counts } = service;
    const substitutes = service.assignments.filter((item) => item.status === 'declined' && item.volunteers.length);
    if (!counts.total) return <p className={cn('mt-3 text-xs sm:pl-[3.375rem]', sub)}>아직 역할이 없어요</p>;
    return (
        <div className="mt-4 space-y-4 sm:pl-[3.375rem]">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <p className={cn('text-sm', ink)}>
                    팀 배치 <span className="font-semibold tabular-nums">{counts.confirmed}/{counts.total}</span> <span className={sub}>확인</span>
                </p>
                <p className={cn('flex flex-wrap gap-x-3 text-[11px] tabular-nums', sub)}>
                    {counts.pending > 0 && <Legend dot={STATUS.warn.dot} label={`대기 ${counts.pending}`} />}
                    {counts.declined > 0 && <Legend dot={STATUS.danger.dot} label={`불참 ${counts.declined}`} />}
                    {counts.vacant > 0 && <Legend dot={STATUS.idle.dot} label={`빈자리 ${counts.vacant}`} />}
                </p>
            </div>
            <ul className="grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-10" aria-label="역할별 배치">
                {service.assignments.map((item) => (
                    <RoleSlot key={item.slotId} item={item} />
                ))}
            </ul>
            {substitutes.map((item) => (
                <p key={item.slotId} className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-3.5 py-2.5 text-xs', TONE_BLOCK.peach)}>
                    <span className={ink}>
                        <span className="font-semibold">{item.roleLabel}</span> {item.memberName} 불참{item.note ? ` · ${item.note}` : ''}
                    </span>
                    <span className={sub}>→</span>
                    <span className="inline-flex items-center gap-1.5">
                        <Avatar name={item.volunteers[0].name} size="xs" />
                        <span className={ink}>{item.volunteers[0].name} 대체 지원</span>
                    </span>
                    <Link href={TEAM_HREF} className={cn('ml-auto font-semibold underline-offset-2 hover:underline', ink)}>
                        확정하러 가기
                    </Link>
                </p>
            ))}
        </div>
    );
}

function RoleSlot({ item }: { item: PartAssignment }) {
    const status = item.status ? ASSIGN_STATUS[item.status] : null;
    const Icon = ROLE_ICON[item.role];
    const description = `${item.roleLabel} · ${item.memberName ?? '빈자리'}${status ? ` · ${status.label}` : ''}${item.mine ? ' (나)' : ''}`;
    return (
        <li className="flex min-w-0 flex-col items-center gap-1.5 text-center" title={description}>
            <span className="relative inline-flex">
                {item.memberName ? (
                    <Avatar name={item.memberName} size="md" className={cn(item.status === 'declined' && 'opacity-40')} />
                ) : (
                    <span className={cn('flex size-9 items-center justify-center rounded-full border border-dashed border-input', sub)}>
                        <Icon size={14} aria-hidden="true" />
                    </span>
                )}
                {status && item.status !== 'confirmed' && <span className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full', status.dot, ringCard)} aria-hidden="true" />}
            </span>
            <span className={cn('w-full truncate text-[11px]', item.mine ? 'font-semibold text-brand' : sub)} aria-hidden="true">
                {SHORT_ROLE[item.role] ?? item.roleLabel}
            </span>
            <span className="sr-only">{description}</span>
        </li>
    );
}

function Legend({ dot, label }: { dot: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
            {label}
        </span>
    );
}

/* ───────────── 팀 소식 ───────────── */

function TeamNews({ sample, requestsHref, className }: { sample: ReactNode; requestsHref: string; className?: string }) {
    const { planning, setlists } = useConti();
    const unread = planning.unreadCount;
    const hrefOf = (notice: Notice) => {
        if (notice.target === 'conti') return setlists.some((item) => item.id === notice.entityId) ? contiHref(notice.entityId) : '/dashboard/songs?tab=conti';
        if (notice.target === 'requests') return requestsHref;
        if (notice.target === 'schedule') return TEAM_HREF;
        return ALERTS_HREF;
    };
    return (
        <section aria-label="팀 소식" className={cn('space-y-1', className)}>
            <SectionTitle
                title="팀 소식"
                badge={sample}
                meta={
                    unread > 0 ? (
                        <>
                            새 소식 <span className="font-semibold tabular-nums text-secondary">{unread}</span>
                        </>
                    ) : undefined
                }
                action={<Link href={ALERTS_HREF} className={textLink}>모두 보기</Link>}
            />
            <ul>
                {planning.notices.slice(0, 4).map((notice) => (
                    <li key={notice.id} className={cn('border-b last:border-b-0', line)}>
                        <Link href={hrefOf(notice)} className="group flex gap-3 py-3.5">
                            <NoticeAvatar notice={notice} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] group-hover:underline group-hover:underline-offset-2">
                                    {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                                    <span className={notice.actor ? body : cn('font-medium', ink)}>{notice.title}</span>
                                </p>
                                {(notice.quote || notice.message !== notice.title) && <p className={cn('mt-0.5 truncate text-xs', sub)}>{notice.quote ? `“${notice.quote}”` : notice.message}</p>}
                            </div>
                            <span className="flex shrink-0 flex-col items-end gap-1.5">
                                <span className={cn('text-[11px]', sub)}>{notice.ago}</span>
                                {notice.unread && (
                                    <>
                                        <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
                                        <span className="sr-only">새 소식</span>
                                    </>
                                )}
                            </span>
                        </Link>
                    </li>
                ))}
                {planning.ready && !planning.notices.length && <li className={cn('py-8 text-center text-sm', sub)}>아직 팀 소식이 없어요</li>}
            </ul>
        </section>
    );
}

/* ───────────── 확인할 요청 ───────────── */

function OpenRequests({ requests, sample, href, className }: { requests: RequestItem[]; sample: ReactNode; href: string; className?: string }) {
    const authors = Array.from(new Set(requests.map((request) => request.author).filter((name): name is string => Boolean(name))));
    return (
        <section aria-label="확인할 요청" className={cn('space-y-1', className)}>
            <SectionTitle
                title="확인할 요청"
                badge={
                    <>
                        {requests.length > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold tabular-nums text-secondary-foreground">
                                {requests.length}
                                <span className="sr-only">건</span>
                            </span>
                        )}
                        {sample}
                    </>
                }
                meta={authors.length ? <AvatarStack names={authors} max={3} size="xs" /> : undefined}
                action={<Link href={href} className={textLink}>모두 보기</Link>}
            />
            <ul>
                {requests.slice(0, 3).map((request) => (
                    <li key={request.id} className={cn('border-b last:border-b-0', line)}>
                        <Link href={href} className="group flex items-center gap-3 py-3.5">
                            {request.author ? <Avatar name={request.author} size="sm" /> : <span className={cn('size-7 shrink-0 rounded-full', TONE_BLOCK.peach)} aria-hidden="true" />}
                            <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-[13px] font-medium group-hover:underline group-hover:underline-offset-2', ink)}>{request.title}</p>
                                <p className={cn('mt-0.5 truncate text-xs', sub)}>
                                    {request.kindLabel} · {request.author ?? '팀원'} · {request.ago}
                                </p>
                            </div>
                            <ChevronRight size={16} className={cn('shrink-0', sub)} aria-hidden="true" />
                        </Link>
                    </li>
                ))}
                {!requests.length && <li className={cn('py-6 text-sm', sub)}>확인할 요청이 없어요</li>}
            </ul>
        </section>
    );
}

/* ───────────── 바로가기 ───────────── */

function QuickLinks({ createHref, scheduleHref, className }: { createHref: string; scheduleHref: string; className?: string }) {
    const links: { label: string; hint: string; href: string; icon: LucideIcon }[] = [
        { label: '콘티 만들기', hint: '곡을 골라 순서 짜기', href: createHref, icon: ListMusic },
        { label: '곡 보관함', hint: '악보 · 키 · BPM', href: '/dashboard/songs/library', icon: Library },
        { label: '팀 초대', hint: '링크로 팀원 초대', href: '/dashboard/team', icon: UserPlus },
        { label: '일정 추가', hint: '연습 · 예배 일정', href: scheduleHref, icon: CalendarPlus },
    ];
    return (
        <section aria-label="바로가기" className={cn('space-y-1', className)}>
            <SectionTitle title="바로가기" />
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {links.map(({ label, hint, href, icon: Icon }) => (
                    <li key={label} className={cn('border-b', line)}>
                        <Link href={href} className="group flex items-center gap-3 py-3">
                            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted', ink)}>
                                <Icon size={18} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-sm font-medium group-hover:underline group-hover:underline-offset-2', ink)}>{label}</span>
                                <span className={cn('block truncate text-[11px]', sub)}>{hint}</span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
