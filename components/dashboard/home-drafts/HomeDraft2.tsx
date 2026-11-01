'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    Bell,
    Check,
    ChevronRight,
    Inbox,
    ListMusic,
    MapPin,
    MessageCircle,
    Music,
    Plus,
    Radio,
    UserPlus,
    UserRoundCheck,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { worshipRoles } from '@/types/team';
import { useConti } from '@/components/conti/context';
import { NoticeAvatar } from '@/components/conti/AlertsScreen';
import { EVENT_KIND, PlanningError, ROLE_ICON, useDispatch } from '@/components/conti/planningUi';
import type { PartAssignment, RequestItem, ServiceDay, TeamEvent } from '@/components/conti/planningBridge';
import {
    SETLIST_STATUS,
    addDays,
    commentsOf,
    dayOf,
    diffDays,
    displayTitle,
    formatTimeLabel,
    md,
    monthOf,
    nextSunday,
    songsOf,
    weekDates,
    weekLabel,
    weekday,
    type ContiSetlist,
} from '@/components/conti/model';
import {
    AddButton,
    Avatar,
    AvatarStack,
    Eyebrow,
    KeyText,
    SampleChip,
    SectionTitle,
    STATUS,
    TONE_BLOCK,
    TONE_DOT,
    TONE_ICON,
    attention,
    attentionText,
    body,
    chip,
    dashed,
    divide,
    ink,
    line,
    ringCard,
    selected,
    sub,
    todayText,
} from '@/components/conti/ui';

/**
 * 홈 시안 2 · 오늘 할 일
 * 지금 내가 할 일부터: 인사 + 주일까지 남은 날, 왼쪽에 오늘부터 주일까지의 타임라인(할 일 · 마감 · 일정),
 * 오른쪽에 이번 주 콘티(민트) · 응답이 필요한 요청 · 팀 소식.
 */

const SESSION_HREF = '/session/00000000-0000-0000-0000-000000000201';
const CONTI_HREF = '/dashboard/songs';
const ALERTS_HREF = '/dashboard/songs?tab=alerts';
const LIBRARY_HREF = '/dashboard/songs/library';
const TEAM_HREF = '/dashboard/team';
const QUICK_REPLIES = ['확인했어요', '반영할게요', '연습 때 이야기해요'];
const REQUESTS_ID = 'home2-requests';

const dayName = (date: string) => (weekday(date) === '일' ? '주일' : `${weekday(date)}요일`);

/** 콘티 마감: 예배일 이전의 가장 가까운 화요일 23:59 (docs/setlist-deadline-notifications.md) */
function deadlineOf(date: string): string {
    let day = addDays(date, -1);
    while (weekday(day) !== '화') day = addDays(day, -1);
    return day;
}

function withTab(href: string, tab: string) {
    return href.includes('?') ? `${href}&tab=${tab}` : `${href}?tab=${tab}`;
}

/** 내가 답해야 하는 요청: 내가 받은(처리할 수 있는) 열린 요청 중 아직 답하지 않은 것 */
function needsMyResponse(request: RequestItem) {
    if (request.done || request.mine) return false;
    if (request.source === 'alert') return request.canResolve;
    return request.canResolve && !request.replies.some((reply) => reply.mine);
}

const iconTile = 'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground';

interface Task {
    id: string;
    icon: LucideIcon;
    title: string;
    meta: ReactNode;
    done: boolean;
    action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
}

export default function HomeDraft2() {
    const { today, setlists, thisWeekId, editor, planning } = useConti();
    const { send, busy } = useDispatch();
    const anchor = nextSunday(today);
    const dates = weekDates(anchor);
    const [day, setDay] = useState(anchor);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [handled, setHandled] = useState<string[]>([]);

    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const viewer = planning.viewer;
    const sample = planning.sample ? <SampleChip /> : null;
    const scheduleHref = withTab(planning.planningHref, 'schedule');
    const requestsHref = withTab(planning.planningHref, 'requests');
    const sunday = planning.services.find((service) => service.date === anchor) ?? null;
    const daysLeft = diffDays(anchor, today);

    const respondable = planning.requests.filter(needsMyResponse);
    const openRequests = planning.requests.filter((request) => !request.done && !request.mine);
    const myAssignments = planning.services.flatMap((service) =>
        service.assignments
            .filter((item) => item.mine && (item.status === 'pending' || handled.includes(`slot:${item.slotId}`)))
            .map((item) => ({ service, item })),
    );
    const unreadComments = planning.notices.filter((notice) => notice.kind === 'comment' && notice.unread);
    const commentAuthors = Array.from(new Set(unreadComments.map((notice) => notice.actor).filter((name): name is string => Boolean(name))));

    const mark = (id: string) => setHandled((list) => (list.includes(id) ? list : [...list, id]));

    function focusRequests() {
        const first = respondable.find((request) => request.source === 'request');
        if (first) setReplyTo(first.id);
        const panel = document.getElementById(REQUESTS_ID);
        panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        panel?.focus({ preventScroll: true });
    }

    const tasks: Task[] = [];
    if (respondable.length || handled.includes('requests')) {
        const authors = Array.from(new Set(respondable.map((request) => request.author).filter((name): name is string => Boolean(name))));
        tasks.push({
            id: 'requests',
            icon: Inbox,
            title: respondable.length ? `요청 ${respondable.length}건에 응답하기` : '받은 요청에 모두 응답했어요',
            meta: respondable.length ? (
                <>
                    <AvatarStack names={authors} max={3} size="xs" />
                    <span className="truncate">{authors.join(' · ')}</span>
                </>
            ) : (
                '진행 중인 요청은 오른쪽에서 이어서 볼 수 있어요'
            ),
            done: !respondable.length,
            action: { label: '응답하기', onClick: focusRequests },
        });
    }
    for (const { service, item } of myAssignments) {
        tasks.push({
            id: `slot:${item.slotId}`,
            icon: UserRoundCheck,
            title: `${md(service.date)} ${item.roleLabel} 참석 확인`,
            meta: `${service.title}${service.title.startsWith(dayName(service.date)) ? '' : ` · ${dayName(service.date)}`} · ${formatTimeLabel(service.time)}`,
            done: item.status === 'confirmed',
            action: {
                label: '확인',
                disabled: busy,
                onClick: async () => {
                    const ok = await send({ type: 'attendance.set', eventId: service.eventId, slotId: item.slotId, attendance: 'confirmed', reason: '' });
                    if (ok) mark(`slot:${item.slotId}`);
                },
            },
        });
    }
    if (unreadComments.length) {
        const [first, second] = commentAuthors;
        const rest = commentAuthors.length - 2;
        tasks.push({
            id: 'comments',
            icon: MessageCircle,
            title: `새 코멘트 ${unreadComments.length}개 읽기`,
            meta: `${[first, second].filter(Boolean).join(' · ')}${rest > 0 ? ` 외 ${rest}명` : ''}${setlist ? ` · ${displayTitle(setlist)}` : ''}`,
            done: false,
            action: { label: '콘티 보기', href: CONTI_HREF },
        });
    }
    const openTasks = tasks.filter((task) => !task.done).length;
    const primaryTaskId = tasks.find((task) => !task.done)?.id;

    const roleLabel = viewer ? worshipRoles[viewer.role] : null;
    const greeting = daysLeft === 0 ? '오늘은 주일이에요' : `주일까지 ${daysLeft}일 남았어요`;

    return (
        <div className="@container">
            <header className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <Eyebrow className="text-xs">
                        {monthOf(today)}월 {dayOf(today)}일 {dayName(today)}
                        {roleLabel && ` · ${roleLabel}`}
                    </Eyebrow>
                    <h2 className={cn('mt-1 text-2xl font-semibold tracking-tight', ink)}>
                        {viewer ? `${viewer.name}님, ` : ''}
                        <span className="whitespace-nowrap">{greeting}</span>
                    </h2>
                    {/* 좁은 폭에서 "11:00"만 다음 줄로 떨어지지 않도록 구절 단위로 줄바꿈합니다. */}
                    <p className={cn('mt-1 flex flex-wrap gap-x-1.5 text-sm', sub)}>
                        <span className="whitespace-nowrap">{openTasks ? `오늘 할 일 ${openTasks}개` : '오늘 할 일을 모두 마쳤어요'}</span>
                        {sunday && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="whitespace-nowrap">
                                    {sunday.title} {md(sunday.date)} {formatTimeLabel(sunday.time)}
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <nav aria-label="바로가기" className="hidden items-center gap-2 @3xl:flex">
                        <QuickLinks createHref={editor?.createHref} />
                    </nav>
                    <span className="relative">
                        <Link
                            href={ALERTS_HREF}
                            aria-label={`알림${planning.unreadCount ? ` ${planning.unreadCount}개` : ''}`}
                            className={cn('inline-flex size-10 items-center justify-center rounded-full border transition hover:bg-muted', line, ink)}
                        >
                            <Bell size={18} aria-hidden="true" />
                        </Link>
                        {planning.unreadCount > 0 && <span className={cn('pointer-events-none absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                    </span>
                    <AddButton label="일정 추가" href={scheduleHref} />
                </div>
            </header>
            <nav aria-label="바로가기" className="mt-4 flex flex-wrap gap-2 @3xl:hidden">
                <QuickLinks createHref={editor?.createHref} />
            </nav>

            <PlanningError />

            <div className="mt-6 grid gap-x-10 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_19rem] @5xl:grid-cols-[minmax(0,1fr)_21rem]">
                <section aria-label="이번 주 할 일" className="min-w-0">
                    <SectionTitle
                        title="이번 주 할 일"
                        badge={sample}
                        meta={<span className="hidden @md:inline">{weekLabel(anchor)}</span>}
                        action={
                            <Link href={scheduleHref} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>
                                일정 보기
                            </Link>
                        }
                    />
                    <ol aria-label={`${md(today)}부터 ${md(anchor)} 주일까지`} className={cn('mt-3 border-t', divide, line)}>
                        {dates.map((date) => (
                            <DayRow
                                key={date}
                                date={date}
                                today={today}
                                active={date === day}
                                onSelect={() => setDay(date)}
                                tasks={date === today ? tasks : []}
                                primaryTaskId={primaryTaskId}
                                events={planning.events.filter((event) => event.date === date)}
                                services={planning.services}
                                deadline={setlist && deadlineOf(setlist.date) === date ? setlist : null}
                                setlists={setlists}
                                thisWeekId={thisWeekId}
                                hasSetlist={setlists.some((item) => item.date === date)}
                                scheduleHref={scheduleHref}
                                ready={planning.ready}
                            />
                        ))}
                    </ol>
                </section>

                <div className="grid content-start gap-10 @2xl:grid-cols-2 @2xl:gap-x-8 @4xl:grid-cols-1">
                    <ContiBlock setlist={setlist} anchor={anchor} createHref={editor?.createHref} />

                    <section
                        id={REQUESTS_ID}
                        tabIndex={-1}
                        aria-label="응답이 필요한 요청"
                        className="min-w-0 scroll-mt-6 rounded-sm outline-none"
                    >
                        <SectionTitle
                            title="응답이 필요한 요청"
                            badge={
                                <>
                                    {respondable.length > 0 && (
                                        <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums', attention)}>
                                            {respondable.length}
                                        </span>
                                    )}
                                    {sample}
                                </>
                            }
                            action={
                                <Link href={requestsHref} className={cn('whitespace-nowrap text-xs font-medium underline-offset-2 hover:underline', body)}>
                                    모두 보기
                                </Link>
                            }
                        />
                        <ul className={cn('mt-1', divide)}>
                            {openRequests.map((request) => (
                                <RequestRow
                                    key={request.id}
                                    request={request}
                                    services={planning.services}
                                    open={replyTo === request.id}
                                    onToggle={() => setReplyTo(replyTo === request.id ? null : request.id)}
                                    onHandled={() => mark('requests')}
                                    requestsHref={requestsHref}
                                />
                            ))}
                            {planning.ready && !openRequests.length && <li className={cn('py-6 text-sm', sub)}>지금은 응답할 요청이 없어요</li>}
                        </ul>
                    </section>

                    <section aria-label="팀 소식" className="min-w-0 @2xl:col-span-2 @4xl:col-span-1">
                        <SectionTitle
                            title="팀 소식"
                            badge={sample}
                            meta={planning.unreadCount > 0 ? <span className={cn('font-medium', attentionText)}>새 소식 {planning.unreadCount}</span> : undefined}
                            action={
                                <Link href={ALERTS_HREF} className={cn('whitespace-nowrap text-xs font-medium underline-offset-2 hover:underline', body)}>
                                    모두 보기
                                </Link>
                            }
                        />
                        <ul className="mt-1">
                            {planning.notices.slice(0, 3).map((notice) => (
                                <li key={notice.id} className={cn('flex gap-3 border-b py-3.5 last:border-b-0', line)}>
                                    <NoticeAvatar notice={notice} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        {/* 좁은 오른쪽 칸에서는 한 줄로 자르면 무엇에 대한 소식인지 잘려서 두 줄까지 보여 줍니다. */}
                                        <p className="line-clamp-2 text-[13px] leading-snug">
                                            {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                                            <span className={notice.actor ? body : cn('font-medium', ink)}>{notice.title}</span>
                                        </p>
                                        {(notice.quote || notice.message !== notice.title) && (
                                            <p className={cn('mt-0.5 truncate text-xs', sub)}>{notice.quote ? `“${notice.quote}”` : notice.message}</p>
                                        )}
                                    </div>
                                    <span className={cn('flex shrink-0 items-start gap-1.5 text-[11px]', sub)}>
                                        {notice.ago}
                                        {notice.unread && <span className="mt-1 size-1.5 rounded-full bg-secondary" aria-label="새 소식" />}
                                    </span>
                                </li>
                            ))}
                            {planning.ready && !planning.notices.length && <li className={cn('py-6 text-sm', sub)}>아직 팀 소식이 없어요</li>}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}

function QuickLinks({ createHref }: { createHref?: string }) {
    const links = [
        { label: '콘티 만들기', href: createHref ?? LIBRARY_HREF, icon: ListMusic },
        { label: '곡 보관함', href: LIBRARY_HREF, icon: Music },
        { label: '팀 초대', href: TEAM_HREF, icon: UserPlus },
    ];
    return (
        <>
            {links.map(({ label, href, icon: Icon }) => (
                <Link key={label} href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Icon aria-hidden="true" />
                    {label}
                </Link>
            ))}
        </>
    );
}

/* ───────────── 타임라인 ───────────── */

interface DayRowProps {
    date: string;
    today: string;
    active: boolean;
    onSelect: () => void;
    tasks: Task[];
    primaryTaskId?: string;
    events: TeamEvent[];
    services: ServiceDay[];
    deadline: ContiSetlist | null;
    setlists: ContiSetlist[];
    thisWeekId: string | null;
    hasSetlist: boolean;
    scheduleHref: string;
    ready: boolean;
}

function DayRow({ date, today, active, onSelect, tasks, primaryTaskId, events, services, deadline, setlists, thisWeekId, hasSetlist, scheduleHref, ready }: DayRowProps) {
    const isToday = date === today;
    const past = date < today;
    const kinds = Array.from(new Set(events.map((event) => event.kind)));
    const empty = !tasks.length && !events.length && !deadline;
    const panelId = `home2-day-${date}`;
    const thisWeek = setlists.find((item) => item.id === thisWeekId) ?? null;

    return (
        <li
            className={cn(
                'grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 pt-4 @md:grid-cols-[3.25rem_minmax(0,1fr)] @md:gap-x-5',
                // 일정이 없는 날은 아래 여백을 줄여 주일 카드가 첫 화면에 더 올라오게 합니다.
                empty && !active ? 'pb-2' : 'pb-3.5',
                past && 'opacity-55',
            )}
        >
            {/* 날짜 칸: 요일 글자는 위 여백에 걸쳐 두고, 날짜 칩이 오른쪽 첫 줄과 같은 높이에 오게 합니다. */}
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={active}
                aria-current={isToday ? 'date' : undefined}
                aria-controls={panelId}
                aria-label={`${monthOf(date)}월 ${dayOf(date)}일 ${dayName(date)}${isToday ? ' (오늘)' : ''}`}
                className="-mt-2 flex flex-col items-center gap-1 self-start rounded-2xl"
            >
                <span className={cn('text-[11px] leading-none', isToday ? 'font-semibold text-brand' : active ? cn('font-semibold', ink) : sub)}>{isToday ? '오늘' : weekday(date)}</span>
                <span
                    className={cn(
                        'flex size-9 items-center justify-center rounded-xl text-[15px] tabular-nums transition',
                        active ? cn(selected, 'font-semibold') : isToday ? todayText : past ? sub : cn(body, 'hover:bg-muted'),
                    )}
                >
                    {dayOf(date)}
                </span>
                {(hasSetlist || kinds.length > 0 || deadline) && (
                    <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                        {hasSetlist && <span className="size-1.5 rounded-full bg-brand" />}
                        {kinds.map((kind) => (
                            <span key={kind} className={cn('size-1.5 rounded-full', TONE_DOT[EVENT_KIND[kind].tone])} />
                        ))}
                        {deadline && <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
                    </span>
                )}
            </button>

            <div id={panelId} className="min-w-0 space-y-3">
                {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} primary={task.id === primaryTaskId} />
                ))}

                {deadline && <DeadlineRow setlist={deadline} />}

                {events.map((event) => {
                    const setlist = setlistFor(event, services, setlists);
                    return (
                        <EventEntry
                            key={event.id}
                            event={event}
                            service={services.find((service) => service.eventId === event.id) ?? null}
                            setlist={setlist}
                            expanded={active}
                            live={Boolean(setlist && setlist.id === thisWeekId)}
                            rehearsalSetlist={event.kind === 'rehearsal' && thisWeek && thisWeek.date >= event.date ? thisWeek : null}
                            scheduleHref={scheduleHref}
                        />
                    );
                })}

                {empty && !active && <p className={cn('flex h-10 items-center text-[13px]', sub)}>{ready ? (isToday ? '오늘은 할 일과 일정이 없어요' : '일정 없음') : '불러오는 중…'}</p>}
                {active && !events.length && !deadline && (
                    <div className={cn('flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5', dashed)}>
                        <p className={cn('text-[13px]', sub)}>{dayName(date)}에는 아직 일정이 없어요</p>
                        <Link href={scheduleHref} className="inline-flex items-center gap-1 text-xs font-semibold text-brand underline-offset-2 hover:underline">
                            <Plus size={14} aria-hidden="true" />
                            일정 추가
                        </Link>
                    </div>
                )}
            </div>
        </li>
    );
}

function setlistFor(event: TeamEvent, services: ServiceDay[], setlists: ContiSetlist[]): ContiSetlist | null {
    const service = services.find((item) => item.eventId === event.id);
    if (!service?.setlistId) return null;
    return setlists.find((item) => item.id === service.setlistId) ?? null;
}

function TaskRow({ task, primary }: { task: Task; primary: boolean }) {
    const Icon = task.done ? Check : task.icon;
    const action = task.action;
    const actionClass = cn(buttonVariants({ variant: primary ? 'default' : 'outline', size: 'xs' }), 'shrink-0');
    return (
        <div className="flex items-center gap-3.5">
            <span className={cn(iconTile, task.done && 'text-brand')}>
                <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[15px] font-medium', task.done ? sub : ink)}>{task.title}</p>
                <p className={cn('mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs', sub)}>{task.meta}</p>
            </div>
            {task.done ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">완료</span>
            ) : action?.href ? (
                <Link href={action.href} className={actionClass}>
                    {action.label}
                </Link>
            ) : action ? (
                <button type="button" onClick={action.onClick} disabled={action.disabled} className={actionClass}>
                    {action.label}
                </button>
            ) : null}
        </div>
    );
}

function DeadlineRow({ setlist }: { setlist: ContiSetlist }) {
    const status = SETLIST_STATUS[setlist.status];
    const met = setlist.status === 'confirmed' || setlist.status === 'done';
    return (
        <div className="flex items-center gap-3.5">
            <span className={cn(iconTile, met && 'text-brand')}>{met ? <Check size={18} aria-hidden="true" /> : <ListMusic size={18} aria-hidden="true" />}</span>
            <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[15px] font-medium', ink)}>콘티 마감</p>
                <p className={cn('mt-0.5 truncate text-xs', sub)}>
                    23:59까지 · {md(setlist.date)} {displayTitle(setlist)}
                </p>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-semibold', status.text)}>{met ? '확정 완료' : status.label}</span>
        </div>
    );
}

function EventEntry({
    event,
    service,
    setlist,
    expanded,
    live,
    rehearsalSetlist,
    scheduleHref,
}: {
    event: TeamEvent;
    service: ServiceDay | null;
    setlist: ContiSetlist | null;
    expanded: boolean;
    live: boolean;
    rehearsalSetlist: ContiSetlist | null;
    scheduleHref: string;
}) {
    const kind = EVENT_KIND[event.kind];
    const Icon = kind.icon;
    const mine = service?.assignments.find((item) => item.mine) ?? null;
    const confirmed = service ? service.counts.confirmed : event.attendees.length;
    const total = service ? service.counts.total : event.expected;
    const tile = (
        <span className={iconTile}>
            <Icon size={18} className={TONE_ICON[kind.tone]} aria-hidden="true" />
        </span>
    );
    const where = (
        <>
            <span className="shrink-0">
                {event.start} - {event.end}
            </span>
            {event.place && (
                <>
                    <span aria-hidden="true">·</span>
                    <MapPin size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{event.place}</span>
                </>
            )}
        </>
    );
    const people = (
        <div className="flex shrink-0 flex-col items-end gap-1">
            {event.attendees.length > 0 && <AvatarStack names={event.attendees} max={3} size="xs" />}
            <span className={cn('text-[11px] tabular-nums', sub)}>{total ? `${confirmed}/${total}명 확인` : '인원 미정'}</span>
        </div>
    );

    if (!expanded) {
        return (
            <div className="flex items-center gap-3.5">
                {tile}
                <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[15px] font-medium', ink)}>{event.title}</p>
                    <p className={cn('mt-0.5 flex min-w-0 items-center gap-1 text-xs tabular-nums', sub)}>
                        <span className="shrink-0">{kind.label}</span>
                        <span aria-hidden="true">·</span>
                        {where}
                    </p>
                </div>
                {people}
            </div>
        );
    }

    return (
        <div className={cn('rounded-3xl border p-4 @md:px-5 @md:pt-4', line)}>
            <div className="flex items-start gap-3.5">
                {tile}
                <div className="min-w-0 flex-1">
                    <Eyebrow>
                        {kind.label}
                        {mine && (
                            <>
                                {' · 내 자리 '}
                                {mine.roleLabel}
                                {mine.status === 'confirmed' ? <span className="text-brand"> 확정</span> : mine.status === 'pending' ? <span className={attentionText}> 확인 전</span> : null}
                            </>
                        )}
                    </Eyebrow>
                    <p className={cn('mt-0.5 truncate text-[15px] font-semibold', ink)}>{event.title}</p>
                    <p className={cn('mt-1 flex min-w-0 items-center gap-1 text-xs tabular-nums', sub)}>{where}</p>
                </div>
                {live ? (
                    <Link href={SESSION_HREF} className={cn(buttonVariants({ size: 'sm' }), 'hidden shrink-0 @md:inline-flex')}>
                        <Radio aria-hidden="true" />
                        예배 시작
                    </Link>
                ) : (
                    people
                )}
            </div>
            {live && (
                <Link href={SESSION_HREF} className={cn(buttonVariants({ size: 'sm' }), 'mt-4 w-full @md:hidden')}>
                    <Radio aria-hidden="true" />
                    예배 시작
                </Link>
            )}

            {/* 예배일은 팀 배치를 먼저: 콘티는 오른쪽 민트 블록에도 있으니 바로가기 한 줄로 아래에 둡니다.
                연습일은 연습할 곡을 먼저, 참석자는 그 아래에 둡니다. */}
            <div className={cn('mt-3.5 border-t', divide, line)}>
                {service ? (
                    <>
                        <Assignments service={service} href={scheduleHref} />
                        {setlist && <DetailLink label="콘티" href={CONTI_HREF} title={displayTitle(setlist)} meta={`${songsOf(setlist.items).length}곡`} status={SETLIST_STATUS[setlist.status]} />}
                    </>
                ) : (
                    <>
                        {rehearsalSetlist && <DetailLink label="연습 곡" href={CONTI_HREF} title={displayTitle(rehearsalSetlist)} meta={`${md(rehearsalSetlist.date)} 콘티 · ${songsOf(rehearsalSetlist.items).length}곡`} />}
                        {event.attendees.length > 0 && (
                            <div className="flex items-start gap-3 pt-3">
                                <span className={cn('w-14 shrink-0 pt-0.5 text-xs', sub)}>참석 확인</span>
                                <p className={cn('min-w-0 flex-1 text-[13px] leading-relaxed', body)}>{event.attendees.join(' · ')}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function DetailLink({ label, href, title, meta, status }: { label: string; href: string; title: string; meta: string; status?: { label: string; text: string } }) {
    return (
        <Link href={href} className="group flex items-center gap-3 py-3">
            <span className={cn('w-14 shrink-0 text-xs', sub)}>{label}</span>
            <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', ink)}>
                {title}
                <span className={cn('ml-1.5 font-normal', sub)}>{meta}</span>
                {status && <span className={cn('ml-1.5 font-normal', status.text)}>{status.label}</span>}
            </span>
            <ChevronRight size={16} className={cn('shrink-0 transition group-hover:translate-x-0.5', sub)} aria-hidden="true" />
        </Link>
    );
}

const STATUS_LABEL: Record<NonNullable<PartAssignment['status']>, { label: string; tone: keyof typeof STATUS }> = {
    confirmed: { label: '확정', tone: 'ok' },
    pending: { label: '대기', tone: 'warn' },
    declined: { label: '불참', tone: 'danger' },
};

function Assignments({ service, href }: { service: ServiceDay; href: string }) {
    const { counts, assignments } = service;
    const issues = assignments.filter((item) => item.status !== 'confirmed');
    const confirmedNames = assignments.filter((item) => item.status === 'confirmed' && item.memberName).map((item) => item.memberName as string);
    return (
        <div className="pt-3">
            <div className="flex items-center gap-3">
                <span className={cn('w-14 shrink-0 text-xs', sub)}>팀 배치</span>
                <span className={cn('whitespace-nowrap text-[13px] font-semibold tabular-nums', ink)}>
                    {counts.total}자리 중 {counts.confirmed}명 확정
                </span>
                <span className="ml-auto hidden shrink-0 @sm:block">
                    <AvatarStack names={confirmedNames} max={4} size="xs" />
                </span>
            </div>
            <div className="mt-2.5 flex gap-1 @md:ml-[4.25rem]" aria-hidden="true">
                {assignments.map((item) => (
                    <span key={item.slotId} className={cn('h-1.5 flex-1 rounded-full', item.status ? STATUS[STATUS_LABEL[item.status].tone].bar : STATUS.idle.bar)} />
                ))}
            </div>
            {issues.length > 0 ? (
                <ul className="mt-1.5 @md:ml-[4.25rem]">
                    {issues.map((item) => {
                        const RoleIcon = ROLE_ICON[item.role];
                        const status = item.status ? STATUS_LABEL[item.status] : null;
                        const volunteer = item.volunteers[0]?.name;
                        return (
                            <li key={item.slotId} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                                <RoleIcon size={14} className={cn('shrink-0', sub)} aria-hidden="true" />
                                <span className={cn('w-14 shrink-0 truncate text-xs', sub)}>{item.roleLabel}</span>
                                {item.memberName ? (
                                    <>
                                        <Avatar name={item.memberName} size="xs" />
                                        <span className={cn('truncate', ink)}>{item.memberName}</span>
                                    </>
                                ) : (
                                    <span className={cn('truncate', sub)}>비어 있음</span>
                                )}
                                <span className={cn('ml-auto shrink-0 text-xs font-medium', status ? STATUS[status.tone].text : STATUS.idle.text)}>
                                    {status ? status.label : '빈자리'}
                                    {item.status === 'declined' && volunteer && <span className={cn('font-normal', sub)}> · {volunteer} 지원</span>}
                                    {!item.status && item.substituteOpen && <span className={cn('font-normal', sub)}> · 모집 중</span>}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className={cn('mt-2 text-xs font-medium @md:ml-[4.25rem]', STATUS.ok.text)}>모든 자리가 확정됐어요</p>
            )}
            <Link href={href} className={cn('mt-2 inline-flex h-8 items-center gap-0.5 text-xs font-medium underline-offset-2 hover:underline @md:ml-[4.25rem]', body)}>
                팀 배치 자세히
                <ChevronRight size={14} aria-hidden="true" />
            </Link>
        </div>
    );
}

/* ───────────── 오른쪽 ───────────── */

function ContiBlock({ setlist, anchor, createHref }: { setlist: ContiSetlist | null; anchor: string; createHref?: string }) {
    if (!setlist) {
        return (
            <section aria-label="이번 주 콘티" className={cn('rounded-3xl px-5 py-8 text-center', dashed)}>
                <p className={cn('text-[15px] font-medium', ink)}>이번 주 콘티가 아직 없어요</p>
                <p className={cn('mt-1 text-xs', sub)}>곡 보관함에서 콘티를 만들면 여기에 바로 보여요</p>
                <Link href={createHref ?? LIBRARY_HREF} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
                    <Plus aria-hidden="true" />
                    콘티 만들기
                </Link>
            </section>
        );
    }
    const songs = songsOf(setlist.items);
    const comments = commentsOf(setlist.items);
    const status = SETLIST_STATUS[setlist.status];
    return (
        <section aria-label="이번 주 콘티" className="min-w-0">
            <Link href={CONTI_HREF} className={cn('block rounded-3xl p-5 transition hover:brightness-[0.98] active:scale-[0.99] dark:hover:brightness-110', TONE_BLOCK.mint)}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {/* 모바일과 같은 눈썹 글씨지만, 문서 구조에서는 이 블록의 제목(h2)입니다. */}
                        <h2 className={cn('text-[11px] font-medium', sub)}>
                            {setlist.date === anchor ? '이번 주 콘티' : `${md(setlist.date)} ${dayName(setlist.date)} 콘티`} · <span className={status.text}>{status.label}</span>
                        </h2>
                        <h3 className={cn('mt-1 truncate text-lg font-semibold tracking-tight', ink)}>{displayTitle(setlist)}</h3>
                        <p className={cn('mt-0.5 text-xs', sub)}>
                            {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                            {formatTimeLabel(setlist.time)}
                        </p>
                    </div>
                    <ListMusic size={20} className={cn('shrink-0', TONE_ICON.mint)} aria-hidden="true" />
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

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3.5">
                    <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                        <MessageCircle size={14} aria-hidden="true" />
                        {songs.length}곡 · 코멘트 {comments.length}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <span className={cn('text-xs', sub)}>담당</span>
                        {setlist.owner ? (
                            <>
                                <Avatar name={setlist.owner} size="sm" />
                                <span className={cn('truncate text-xs font-medium', ink)}>{setlist.owner}</span>
                            </>
                        ) : (
                            <span className={cn('text-xs', sub)}>미정</span>
                        )}
                    </span>
                </div>
            </Link>
        </section>
    );
}

function RequestRow({
    request,
    services,
    open,
    onToggle,
    onHandled,
    requestsHref,
}: {
    request: RequestItem;
    services: ServiceDay[];
    open: boolean;
    onToggle: () => void;
    onHandled: () => void;
    requestsHref: string;
}) {
    const { send, busy } = useDispatch();
    const replied = request.replies.some((reply) => reply.mine);
    const slot = request.source === 'alert' ? services.find((service) => service.eventId === request.eventId)?.assignments.find((item) => item.slotId === request.slotId) : undefined;
    const volunteer = slot?.volunteers.find((person) => person.member);
    const pill = buttonVariants({ variant: 'outline', size: 'xs' });

    async function reply(text: string) {
        const ok = await send({ type: 'request.reply', requestId: request.id, body: text });
        if (ok) {
            onHandled();
            onToggle();
        }
    }

    return (
        <li className="flex gap-3 py-3.5">
            <span className="pt-0.5">
                <Avatar name={request.author ?? '팀원'} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
                <Eyebrow className="truncate">
                    {request.kindLabel} · {request.context}
                </Eyebrow>
                <p className={cn('mt-0.5 line-clamp-2 text-sm font-medium leading-snug', ink)}>{request.title}</p>
                {/* 보낸 사람·시간과 바로 할 일을 한 줄에: 좁은 오른쪽 칸에서 요청 세 개가 첫 화면에 들어오게 합니다. */}
                <div className="mt-1.5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <p className={cn('min-w-0 truncate text-[11px]', sub)}>
                        {request.author ?? '팀원'} · {request.ago}
                        {replied && <span className="text-brand"> · 답변함</span>}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                        {request.source === 'alert' ? (
                            volunteer && slot && request.eventId ? (
                                <button
                                    type="button"
                                    disabled={busy || !request.canResolve}
                                    onClick={async () => {
                                        const ok = await send({ type: 'slot.accept', eventId: request.eventId!, slotId: slot.slotId, memberId: volunteer.id });
                                        if (ok) onHandled();
                                    }}
                                    className={pill}
                                >
                                    <Check aria-hidden="true" />
                                    {volunteer.name} 대체 확정
                                </button>
                            ) : (
                                <Link href={withTab('/dashboard/planning', 'schedule')} className={pill}>
                                    대체 찾기
                                </Link>
                            )
                        ) : replied ? (
                            request.canResolve && (
                                <button type="button" disabled={busy} onClick={() => void send({ type: 'request.status', requestId: request.id, status: 'resolved' })} className={pill}>
                                    <Check aria-hidden="true" />
                                    완료로 표시
                                </button>
                            )
                        ) : (
                            request.canReply && (
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    aria-label={`${request.author ?? '팀원'}님 요청에 답하기`}
                                    onClick={onToggle}
                                    className={cn(pill, open && cn(selected, 'border-transparent hover:bg-primary/90'))}
                                >
                                    답하기
                                </button>
                            )
                        )}
                    </div>
                </div>

                {open && !replied && request.canReply && (
                    <div className={cn('mt-2.5 rounded-2xl p-3', chip)}>
                        <p className={cn('text-[11px] font-medium', sub)}>바로 답하기</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {QUICK_REPLIES.map((text) => (
                                <button key={text} type="button" disabled={busy} onClick={() => void reply(text)} className={cn(pill, 'bg-card')}>
                                    {text}
                                </button>
                            ))}
                            <Link href={requestsHref} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), body)}>
                                직접 쓰기
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </li>
    );
}
