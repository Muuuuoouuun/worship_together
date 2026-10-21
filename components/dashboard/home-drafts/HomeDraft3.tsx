'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowUpRight,
    Bell,
    CalendarDays,
    ChevronRight,
    Inbox,
    Library,
    ListChecks,
    ListMusic,
    ListPlus,
    MapPin,
    MessageCircle,
    Plus,
    Radio,
    UserPlus,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { Tone } from '@/components/ui/tones';
import type { WorshipRole } from '@/types/team';
import { worshipRoles } from '@/types/team';
import { useConti } from '@/components/conti/context';
import { NoticeAvatar } from '@/components/conti/AlertsScreen';
import { EVENT_KIND } from '@/components/conti/planningUi';
import type { PartAssignment, PlanningView, RequestItem, ServiceDay } from '@/components/conti/planningBridge';
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
} from '@/components/conti/model';
import { AddButton, Avatar, AvatarStack, KeyText, SampleChip, STATUS, TONE_BLOCK, TONE_DOT, TONE_ICON, body, dashed, divide, ink, line, ringCard, selected, sub, todayText } from '@/components/conti/ui';

/** 데모 라이브 예배 세션 (실제 데이터가 연결되면 editor.sessionHref 를 씁니다) */
const DEMO_SESSION_HREF = '/session/00000000-0000-0000-0000-000000000201';

/** 팀 배치 타일의 짧은 역할 이름 */
const SHORT_ROLE: Record<WorshipRole, string> = {
    leader: '인도',
    vocal: '보컬',
    keyboard: '건반',
    guitar: '기타',
    bass: '베이스',
    drums: '드럼',
    sound: '음향',
    media: '영상',
    member: '미정',
};

const SLOT_STATUS: Record<NonNullable<PartAssignment['status']>, { label: string; dot: string }> = {
    confirmed: { label: '확정', dot: STATUS.ok.dot },
    pending: { label: '응답 대기', dot: STATUS.warn.dot },
    declined: { label: '불참', dot: STATUS.danger.dot },
};

/** 팀 배치 막대: 확정 → 대기 → 불참 → 빈자리 순서로 쌓습니다 (모바일 '악기 담당'의 막대와 같은 색) */
const SLOT_ORDER: { key: 'confirmed' | 'pending' | 'declined' | 'vacant'; bar: string }[] = [
    { key: 'confirmed', bar: STATUS.ok.bar },
    { key: 'pending', bar: STATUS.warn.bar },
    { key: 'declined', bar: STATUS.danger.bar },
    // 파스텔 바탕 위에서도 보이도록 bg-muted 대신 범례 점과 같은 색
    { key: 'vacant', bar: STATUS.idle.dot },
];

/** 큰 숫자 (카운트다운 · 요청 수 · 배치 수) */
const bigValue = 'text-[44px] font-semibold leading-none tracking-tight tabular-nums';
/** 파스텔 타일 안의 흰 판 (날짜 줄 · 최근 요청 · 인용) */
const inset = 'bg-card/75';

function withTab(href: string, tab: string) {
    return href.includes('?') ? `${href}&tab=${tab}` : `${href}?tab=${tab}`;
}

function dayName(date: string) {
    return weekday(date) === '일' ? '주일' : `${weekday(date)}요일`;
}

/**
 * 시안 3 · 파스텔 타일
 * 모바일 '이번 주'의 파스텔 블록을 타일로 나눠 배치한 홈. 타일마다 한 가지 색, 한 가지 일.
 * 민트 = 이번 주 콘티, 하늘 = 다음 일정, 복숭아 = 확인할 요청, 모래 = 팀 배치, 라일락 = 팀 소식, 흰 타일 = 할 일 · 바로가기.
 */
export default function HomeDraft3() {
    const { today, setlists, thisWeekId, editor, planning, roster } = useConti();
    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const anchor = nextSunday(today);
    const [day, setDay] = useState(anchor);

    const service = planning.services.find((item) => Boolean(setlist) && item.setlistId === setlist?.id) ?? planning.services.find((item) => item.date === anchor) ?? planning.services.find((item) => item.date >= today) ?? null;
    const openRequests = planning.requests.filter((request) => !request.done);
    const sample = planning.sample ? <SampleChip /> : null;

    const scheduleHref = withTab(planning.planningHref, 'schedule');
    const requestsHref = withTab(planning.planningHref, 'requests');
    const alertsHref = '/dashboard/songs?tab=alerts';
    const sessionHref = setlist && editor?.sessionHref ? editor.sessionHref(setlist.id) : DEMO_SESSION_HREF;
    const serviceTime = service?.time ?? setlist?.time ?? '';

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className={cn('text-xs font-medium', sub)}>{weekLabel(anchor)}</p>
                    <h2 className={cn('mt-0.5 truncate text-2xl font-semibold tracking-tight', ink)}>
                        {monthOf(anchor)}월 {dayOf(anchor)}일{' '}
                        <span className={cn('ml-1 font-normal', sub)}>
                            {dayName(anchor)} · {dDay(anchor, today)}
                        </span>
                    </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link href={alertsHref} aria-label={planning.unreadCount > 0 ? `알림 · 새 소식 ${planning.unreadCount}개` : '알림'} className={cn('relative inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted', line, ink)}>
                        <Bell size={18} aria-hidden="true" />
                        {planning.unreadCount > 0 && <span className={cn('absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                    </Link>
                    <AddButton label="일정 추가 (일정·요청 화면)" href={scheduleHref} />
                </div>
            </header>

            <div className="@container">
                <div className="grid grid-cols-12 gap-4">
                    <ContiTile className="col-span-12 @2xl:col-span-6 @2xl:row-span-2" />
                    <ScheduleTile day={day} onPick={setDay} anchor={anchor} href={scheduleHref} sample={sample} className="col-span-12 @2xl:col-span-6" />
                    <RequestTile requests={openRequests} href={requestsHref} sample={sample} className="col-span-12 @lg:col-span-6 @2xl:col-span-6 @4xl:col-span-3" />
                    <TeamTile service={service} href={scheduleHref} className="col-span-12 @lg:col-span-6 @2xl:col-span-6 @4xl:col-span-3" />
                    {/* 688px 폭에서는 팀 배치 옆에 팀 소식, 그 아래 할 일을 넓게 둡니다 */}
                    <TodoTile planning={planning} service={service} today={today} scheduleHref={scheduleHref} requestsHref={requestsHref} className="col-span-12 @2xl:order-2 @4xl:order-none @4xl:col-span-6" />
                    <FeedTile planning={planning} href={alertsHref} sample={sample} className="col-span-12 @2xl:order-1 @2xl:col-span-6 @4xl:order-none" />

                    <nav aria-label="바로가기" className="col-span-12 grid grid-cols-2 gap-4 @2xl:order-3 @2xl:grid-cols-4 @4xl:order-none">
                        <Shortcut href={editor?.createHref ?? '/dashboard/songs/library'} icon={ListPlus} label="콘티 만들기" detail="곡 골라 순서 짜기" />
                        <Shortcut href="/dashboard/songs/library" icon={Library} label="곡 보관함" detail="키 · BPM · 악보" />
                        <Shortcut href="/dashboard/team" icon={UserPlus} label="팀 초대" detail={roster.length ? `팀원 ${roster.length}명` : '링크로 초대'} />
                        <Shortcut
                            href={sessionHref}
                            icon={Radio}
                            label="라이브 세션 입장"
                            detail={serviceTime ? `${dayName(anchor)} ${serviceTime} · ${dDay(anchor, today)}` : '예배 화면 열기'}
                            primary
                        />
                    </nav>
                </div>
            </div>
        </div>
    );
}

/* ───────────── 타일 뼈대 ───────────── */

function Tile({ tone, title, icon: Icon, badge, meta, action, className, children }: { tone?: Tone; title: ReactNode; icon: LucideIcon; badge?: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
    const id = useId();
    return (
        <section aria-labelledby={id} className={cn('flex min-w-0 flex-col rounded-3xl p-6', tone ? TONE_BLOCK[tone] : cn('border bg-card', line), className)}>
            <div className="flex min-h-8 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Icon size={15} className={cn('shrink-0', tone ? TONE_ICON[tone] : sub)} aria-hidden="true" />
                    <h3 id={id} className={cn('truncate text-xs font-medium', sub)}>
                        {title}
                    </h3>
                    {badge}
                    {meta}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function TileLink({ href, label, children }: { href: string; label?: string; children: ReactNode }) {
    return (
        <Link href={href} aria-label={label} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-mr-2 shrink-0 gap-0.5 font-medium text-foreground/75 hover:bg-foreground/5 hover:text-foreground')}>
            {children}
            <ChevronRight size={14} aria-hidden="true" />
        </Link>
    );
}

/* ───────────── 민트 · 이번 주 콘티 ───────────── */

function ContiTile({ className }: { className?: string }) {
    const { today, setlists, thisWeekId, editor } = useConti();
    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const anchor = nextSunday(today);

    if (!setlist) {
        return (
            <section aria-label="이번 주 콘티" className={cn('flex flex-col items-center justify-center rounded-3xl px-6 py-12 text-center', dashed, className)}>
                <ListMusic size={22} className={TONE_ICON.mint} aria-hidden="true" />
                <h3 className={cn('mt-3 text-[15px] font-medium', ink)}>이번 주 콘티가 아직 없어요</h3>
                <p className={cn('mt-1 text-xs', sub)}>곡 보관함에서 콘티를 만들면 여기에 바로 보여요</p>
                <Link href={editor?.createHref ?? '/dashboard/songs/library'} className={cn(buttonVariants({ size: 'sm' }), 'mt-5')}>
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
        <Tile
            tone="mint"
            icon={ListMusic}
            title={
                <>
                    {setlist.date === anchor ? '이번 주 콘티' : `${md(setlist.date)} ${dayName(setlist.date)} 콘티`} · <span className={status.text}>{status.label}</span>
                </>
            }
            action={
                <TileLink href={`/dashboard/songs?tab=order&setlist=${encodeURIComponent(setlist.id)}`} label="이번 주 콘티 열기">
                    콘티 열기
                </TileLink>
            }
            className={className}
        >
            <p className={cn('mt-4 text-[28px] font-semibold leading-tight tracking-tight', ink)}>{displayTitle(setlist)}</p>
            <p className={cn('mt-1 text-sm', sub)}>
                {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                {md(setlist.date)} {dayName(setlist.date)} {formatTimeLabel(setlist.time)}
            </p>

            <ol className="mt-5 flex flex-1 flex-col justify-between gap-1" aria-label="곡 순서">
                {songs.map((item, index) => {
                    const meta = [item.lead && `리드 ${item.lead}`, item.bpm && `${item.bpm} BPM`, item.comments.length > 0 && `코멘트 ${item.comments.length}`].filter(Boolean).join(' · ');
                    return (
                        <li key={item.id} className="flex items-center gap-4 py-1.5">
                            <span className={cn('w-4 shrink-0 text-sm tabular-nums', sub)}>{index + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-[15px] font-medium', ink)}>{item.title}</p>
                                {meta && <p className={cn('mt-0.5 truncate text-xs', sub)}>{meta}</p>}
                            </div>
                            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs tabular-nums', inset, body)}>
                                <KeyText from={item.originalKey} to={item.key} />
                            </span>
                        </li>
                    );
                })}
                {!songs.length && <li className={cn('text-sm', sub)}>아직 곡이 없어요</li>}
            </ol>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-foreground/10 pt-4">
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
        </Tile>
    );
}

/* ───────────── 하늘 · 다음 일정 + 이번 주 날짜 ───────────── */

function ScheduleTile({ day, onPick, anchor, href, sample, className }: { day: string; onPick: (date: string) => void; anchor: string; href: string; sample: ReactNode; className?: string }) {
    const { today, setlists, planning } = useConti();
    const dates = weekDates(anchor);
    const setlistDates = new Set(setlists.map((item) => item.date));
    const events = planning.events.filter((event) => event.date === day);
    const [first, ...rest] = events;

    return (
        <Tile tone="sky" icon={CalendarDays} title={`${dayName(day)} 일정 · ${md(day)}`} badge={sample} action={<TileLink href={href} label="일정 모두 보기">일정 보기</TileLink>} className={className}>
            <div className="mt-4 flex items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className={bigValue}>
                        <span className={ink}>{day === today ? '오늘' : dDay(day, today)}</span>
                        {first && <span className={cn('ml-3', sub)}>{first.start}</span>}
                    </p>
                    {first ? (
                        <>
                            <p className={cn('mt-3 truncate text-sm font-medium', ink)}>
                                <span className={cn('mr-1.5 text-xs font-normal', TONE_ICON[EVENT_KIND[first.kind].tone])}>{EVENT_KIND[first.kind].label}</span>
                                {first.title}
                            </p>
                            <p className={cn('mt-1 flex items-center gap-1 text-xs tabular-nums', sub)}>
                                {first.start} - {first.end}
                                {first.place && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <MapPin size={12} aria-hidden="true" />
                                        <span className="truncate">{first.place}</span>
                                    </>
                                )}
                                {rest.length > 0 && <span className="ml-1">외 {rest.length}개</span>}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className={cn('mt-3 text-sm font-medium', ink)}>{planning.ready ? '이 날은 일정이 없어요' : '일정을 불러오는 중…'}</p>
                            <p className={cn('mt-1 text-xs', sub)}>연습·예배 일정은 + 버튼으로 추가해요</p>
                        </>
                    )}
                </div>
                {first && (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {first.attendees.length > 0 && <AvatarStack names={first.attendees} max={3} size="xs" />}
                        <span className={cn('text-[11px] tabular-nums', sub)}>{first.expected ? `${first.attendees.length}/${first.expected}명` : '인원 미정'}</span>
                    </div>
                )}
            </div>

            <ol className={cn('mt-5 grid grid-cols-7 rounded-2xl p-1.5 text-center', inset)} aria-label="이번 주 날짜">
                {dates.map((date) => {
                    const active = date === day;
                    const kinds = Array.from(new Set(planning.events.filter((event) => event.date === date).map((event) => event.kind)));
                    const count = planning.events.filter((event) => event.date === date).length;
                    return (
                        <li key={date}>
                            <button
                                type="button"
                                onClick={() => onPick(date)}
                                aria-pressed={active}
                                aria-current={date === today ? 'date' : undefined}
                                aria-label={`${monthOf(date)}월 ${dayOf(date)}일 ${weekday(date)}요일${date === today ? ' (오늘)' : ''}${count ? ` · 일정 ${count}개` : ''}`}
                                className="group flex w-full flex-col items-center gap-1 rounded-xl py-1.5"
                            >
                                <span className={cn('text-[11px]', active ? cn('font-semibold', ink) : sub)}>{weekday(date)}</span>
                                <span className={cn('flex size-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors', active ? cn(selected, 'font-semibold') : cn('group-hover:bg-foreground/5', date === today ? todayText : body))}>{dayOf(date)}</span>
                                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                                    {setlistDates.has(date) && <span className="size-1.5 rounded-full bg-brand" />}
                                    {kinds.map((kind) => (
                                        <span key={kind} className={cn('size-1.5 rounded-full', TONE_DOT[EVENT_KIND[kind].tone])} />
                                    ))}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </Tile>
    );
}

/* ───────────── 복숭아 · 확인할 요청 ───────────── */

function RequestTile({ requests, href, sample, className }: { requests: RequestItem[]; href: string; sample: ReactNode; className?: string }) {
    const authors = Array.from(new Set(requests.map((request) => request.author).filter((name): name is string => Boolean(name))));
    const latest = requests[0];
    return (
        <Tile tone="peach" icon={Inbox} title="확인할 요청" action={<TileLink href={href} label="확인할 요청 모두 보기">모두 보기</TileLink>} className={className}>
            <div className="mt-4 flex items-end justify-between gap-3">
                <p className="flex items-baseline gap-1">
                    <span className={cn(bigValue, requests.length ? 'text-secondary' : sub)}>{requests.length}</span>
                    <span className={cn('text-base font-medium', ink)}>건</span>
                </p>
                {authors.length > 0 && (
                    <span className="flex items-center gap-1" aria-hidden="true">
                        {authors.slice(0, 3).map((name) => (
                            <Avatar key={name} name={name} size="sm" />
                        ))}
                        {authors.length > 3 && <span className={cn('inline-flex size-7 items-center justify-center rounded-full text-[10px] font-semibold', selected)}>{authors.length - 3}+</span>}
                    </span>
                )}
            </div>
            <p className={cn('mb-4 mt-2 flex min-w-0 items-center gap-1.5 text-xs', sub)}>
                <span className="truncate">{authors.length ? `${authors[0]}${authors.length > 1 ? ` 외 ${authors.length - 1}명` : ''}이 기다려요` : '답할 요청이 없어요'}</span>
                {sample}
            </p>
            {latest && (
                <div className={cn('mt-auto rounded-2xl px-4 py-3', inset)}>
                    <p className={cn('truncate text-[11px]', sub)}>
                        {latest.kindLabel}
                        {latest.context ? ` · ${latest.context}` : ''}
                    </p>
                    <p className={cn('mt-1 line-clamp-2 text-[13px] font-medium leading-snug', ink)}>{latest.title}</p>
                    <p className={cn('mt-1.5 truncate text-[11px]', sub)}>
                        {latest.author ?? '팀원'} · {latest.ago}
                    </p>
                </div>
            )}
        </Tile>
    );
}

/* ───────────── 모래 · 주일 팀 배치 ───────────── */

function TeamTile({ service, href, className }: { service: ServiceDay | null; href: string; className?: string }) {
    if (!service) {
        return (
            <Tile tone="sand" icon={UsersRound} title="주일 팀 배치" action={<TileLink href={href}>배치 보기</TileLink>} className={className}>
                <p className={cn('mt-4 text-sm', sub)}>아직 예배 일정이 없어요</p>
            </Tile>
        );
    }
    const { counts } = service;
    const issues = [
        { label: '대기', value: counts.pending, dot: STATUS.warn.dot },
        { label: '불참', value: counts.declined, dot: STATUS.danger.dot },
        { label: '빈자리', value: counts.vacant, dot: STATUS.idle.dot },
    ].filter((item) => item.value > 0);
    return (
        <Tile tone="sand" icon={UsersRound} title={`${dayName(service.date)} 팀 배치`} action={<TileLink href={href} label="팀 배치 보기">배치 보기</TileLink>} className={className}>
            <p className="mt-4 flex items-baseline gap-1">
                <span className={cn(bigValue, ink)}>
                    {counts.confirmed}
                    <span className={sub}>/{counts.total}</span>
                </span>
                <span className={cn('ml-0.5 text-base font-medium', ink)}>확인</span>
            </p>
            {counts.total > 0 && (
                <div className="mt-3.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`확정 ${counts.confirmed}, 대기 ${counts.pending}, 불참 ${counts.declined}, 빈자리 ${counts.vacant}`}>
                    {SLOT_ORDER.flatMap(({ key, bar }) => Array.from({ length: counts[key] }, (_, index) => <span key={`${key}:${index}`} className={cn('flex-1', bar)} />))}
                </div>
            )}
            <p className={cn('mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tabular-nums', sub)}>
                {issues.length ? (
                    issues.map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-1">
                            <span className={cn('size-1.5 rounded-full', item.dot)} aria-hidden="true" />
                            {item.label} {item.value}
                        </span>
                    ))
                ) : (
                    <span>모두 확정됐어요</span>
                )}
            </p>
            <ul className="mt-auto grid grid-cols-5 gap-x-1 gap-y-3 pt-4" aria-label="역할별 담당">
                {service.assignments.map((item) => (
                    <SlotCell key={item.slotId} item={item} />
                ))}
            </ul>
        </Tile>
    );
}

function SlotCell({ item }: { item: PartAssignment }) {
    const status = item.status ? SLOT_STATUS[item.status] : null;
    const role = SHORT_ROLE[item.role] ?? worshipRoles[item.role];
    return (
        <li className="flex min-w-0 flex-col items-center gap-1">
            <span className="relative inline-flex">
                {item.memberName ? (
                    <Avatar name={item.memberName} size="sm" className={cn(item.status === 'declined' && 'opacity-45')} />
                ) : (
                    <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-foreground/25" aria-hidden="true">
                        <Plus size={12} className={sub} />
                    </span>
                )}
                {status && <span className={cn('absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full', status.dot, ringCard)} aria-hidden="true" />}
            </span>
            <span className={cn('max-w-full truncate text-[10px] leading-3', sub)} aria-hidden="true">
                {role}
            </span>
            <span className="sr-only">
                {item.roleLabel} {item.memberName ?? '빈자리'} {status?.label ?? ''}
            </span>
        </li>
    );
}

/* ───────────── 흰 타일 · 지금 할 일 ───────────── */

interface Todo {
    id: string;
    icon: LucideIcon;
    title: string;
    detail: string;
    href: string;
    urgent?: boolean;
}

function buildTodos(planning: PlanningView, service: ServiceDay | null, today: string, scheduleHref: string, requestsHref: string): Todo[] {
    const todos: Todo[] = [];
    const toAnswer = planning.requests.filter((request) => !request.done && request.source === 'request' && request.canResolve);
    if (toAnswer.length) {
        todos.push({ id: 'answer', icon: Inbox, title: `요청 ${toAnswer.length}건에 답하기`, detail: toAnswer.map((request) => request.title).join(' · '), href: requestsHref, urgent: true });
    }
    if (service && planning.viewer?.canManage) {
        for (const item of service.assignments) {
            if (item.status === 'declined' || item.substituteOpen) {
                const volunteers = item.volunteers.filter((person) => person.member).map((person) => person.name);
                todos.push({
                    id: `sub:${item.slotId}`,
                    icon: UsersRound,
                    title: volunteers.length ? `${item.roleLabel} 대체 인원 확정하기` : `${item.roleLabel} 대체 인원 찾기`,
                    detail: [`${item.memberName ?? '팀원'} 불참${item.note ? `(${item.note})` : ''}`, volunteers.length ? `${volunteers.join(', ')} 지원` : ''].filter(Boolean).join(' · '),
                    href: scheduleHref,
                    urgent: true,
                });
            } else if (item.status === null) {
                todos.push({ id: `vacant:${item.slotId}`, icon: Plus, title: `${item.roleLabel} 빈자리 채우기`, detail: `${md(service.date)} ${service.title}`, href: scheduleHref });
            }
        }
        const waiting = service.assignments.filter((item) => item.status === 'pending' && !item.mine);
        if (waiting.length) {
            todos.push({ id: 'waiting', icon: Bell, title: `응답 대기 ${waiting.length}명 확인하기`, detail: waiting.map((item) => `${item.roleLabel} ${item.memberName ?? ''}`.trim()).join(', '), href: scheduleHref });
        }
    }
    for (const day of planning.services.filter((item) => item.date >= today)) {
        const mine = day.assignments.find((item) => item.mine && item.status === 'pending');
        if (mine) todos.push({ id: `mine:${mine.slotId}`, icon: CalendarDays, title: `${md(day.date)} ${mine.roleLabel} 참석 응답하기`, detail: `${day.title} · ${day.time}`, href: scheduleHref });
    }
    return todos;
}

function TodoTile({ planning, service, today, scheduleHref, requestsHref, className }: { planning: PlanningView; service: ServiceDay | null; today: string; scheduleHref: string; requestsHref: string; className?: string }) {
    const todos = buildTodos(planning, service, today, scheduleHref, requestsHref);
    const viewer = planning.viewer;
    return (
        <Tile
            icon={ListChecks}
            title={viewer ? `내 할 일 · ${viewer.name} ${worshipRoles[viewer.role]}` : '내 할 일'}
            action={<TileLink href={scheduleHref} label="일정·요청 화면 열기">일정·요청</TileLink>}
            className={className}
        >
            <p className={cn('mt-4 text-xl font-semibold tracking-tight', ink)}>
                지금 할 일 <span className="tabular-nums">{todos.length}</span>가지
            </p>
            {todos.length ? (
                <ul className={cn('mt-2', divide)}>
                    {todos.map((todo) => {
                        const Icon = todo.icon;
                        return (
                            <li key={todo.id}>
                                <Link href={todo.href} className="group flex items-center gap-3 rounded-xl py-2.5">
                                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                                        <Icon size={16} aria-hidden="true" />
                                        {todo.urgent && <span className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={cn('block truncate text-sm font-medium', ink)}>{todo.title}</span>
                                        <span className={cn('mt-0.5 block truncate text-xs', sub)}>{todo.detail}</span>
                                    </span>
                                    <ChevronRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5', sub)} aria-hidden="true" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className={cn('mt-2 text-sm', sub)}>주일 준비가 모두 끝났어요</p>
            )}
        </Tile>
    );
}

/* ───────────── 라일락 · 팀 소식 ───────────── */

function FeedTile({ planning, href, sample, className }: { planning: PlanningView; href: string; sample: ReactNode; className?: string }) {
    const unread = planning.unreadCount;
    return (
        <Tile
            tone="lilac"
            icon={MessageCircle}
            title="팀 소식"
            badge={sample}
            meta={
                unread > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-secondary">
                        <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />새 소식 {unread}
                    </span>
                )
            }
            action={<TileLink href={href} label="팀 소식 모두 보기">모두 보기</TileLink>}
            className={className}
        >
            <ul className="mt-4 flex flex-1 flex-col justify-between gap-4">
                {planning.notices.slice(0, 4).map((notice, index) => (
                    <li key={notice.id} className={cn('flex gap-3', index === 3 && '@2xl:@max-4xl:hidden')}>
                        <NoticeAvatar notice={notice} size="sm" />
                        <div className="min-w-0 flex-1">
                            <p className="flex items-baseline gap-2 text-[13px]">
                                <span className="min-w-0 flex-1 truncate">
                                    {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                                    <span className={notice.actor ? body : cn('font-medium', ink)}>{notice.title}</span>
                                </span>
                                <span className={cn('shrink-0 text-[11px]', sub)}>{notice.ago}</span>
                            </p>
                            {notice.quote ? (
                                <p className={cn('mt-1.5 truncate rounded-2xl rounded-tl-md px-3.5 py-2 text-[13px]', inset, body)}>“{notice.quote}”</p>
                            ) : (
                                notice.message !== notice.title && <p className={cn('mt-1 truncate text-xs', sub)}>{notice.message}</p>
                            )}
                        </div>
                    </li>
                ))}
                {planning.ready && !planning.notices.length && <li className={cn('py-6 text-center text-sm', sub)}>아직 팀 소식이 없어요</li>}
            </ul>
        </Tile>
    );
}

/* ───────────── 흰 타일 · 바로가기 ───────────── */

function Shortcut({ href, icon: Icon, label, detail, primary = false }: { href: string; icon: LucideIcon; label: string; detail: string; primary?: boolean }) {
    return (
        <Link href={href} className={cn('group relative flex min-w-0 flex-col gap-4 rounded-3xl border bg-card p-5 transition-colors hover:bg-muted/50 @4xl:flex-row @4xl:items-center @4xl:gap-3.5 @4xl:p-4', line)}>
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', primary ? selected : 'bg-muted text-foreground')}>
                <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 @4xl:pr-5">
                <span className={cn('block truncate text-sm font-semibold', ink)}>{label}</span>
                <span className={cn('mt-0.5 block truncate text-xs', sub)}>{detail}</span>
            </span>
            <ArrowUpRight size={16} className={cn('absolute right-4 top-4 transition-colors group-hover:text-foreground', sub)} aria-hidden="true" />
        </Link>
    );
}
