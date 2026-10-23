'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowUpRight,
    Bell,
    CalendarDays,
    CalendarPlus,
    Check,
    ChevronRight,
    Inbox,
    Library,
    ListChecks,
    ListMusic,
    ListPlus,
    MapPin,
    Megaphone,
    MessageCircle,
    Plus,
    Radio,
    UserPlus,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { buttonVariants } from '@/components/ui/button';
import { TONE_TILE, TONE_TILE_ICON, type Tone } from '@/components/ui/tones';
import type { WorshipRole } from '@/types/team';
import { worshipRoles } from '@/types/team';
import { useConti } from '@/components/conti/context';
import { NoticeAvatar } from '@/components/conti/AlertsScreen';
import { EVENT_KIND } from '@/components/conti/planningUi';
import type { AnnouncementItem, PartAssignment, PlanningView, RequestItem, ServiceDay } from '@/components/conti/planningBridge';
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
    type ContiSetlist,
} from '@/components/conti/model';
import { AddButton, Avatar, AvatarStack, KeyText, SampleChip, STATUS, TONE_DOT, TONE_ICON, body, ink, line, ringCard, selected, sub, todayText } from '@/components/conti/ui';

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

/** 이번 주 콘티에서 한 번에 보여 줄 곡 수 (나머지는 '외 N곡') */
const SONG_LIMIT = 7;
/** 지금 할 일에서 접힌 상태로 보여 줄 수 */
const TODO_LIMIT = 3;

/** 큰 숫자 (카운트다운 · 요청 수 · 배치 수). 색은 늘 글자색이고, 주의 표시는 작은 주황 점으로만 합니다. */
const bigValue = 'text-[44px] font-semibold leading-none tracking-tight tabular-nums';
/** 타일 안의 흰 판 (날짜 줄 · 최근 요청 · 인용). 어두운 화면에서는 카드 위의 옅은 회색 판 */
const inset = 'bg-card/75 dark:bg-muted/50';
/** 타일 안 빈 상태의 보조 버튼 */
const quietAction = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4');

/**
 * 타일 자리. 모바일(한 단)에서는 이번 주 콘티 → 지금 할 일 → 다음 일정 → 요청 → 팀 소식 → 팀 배치 → 바로가기 순서,
 * 넓은 화면에서는 지금 할 일이 제목 바로 아래 첫 줄에 옵니다 (@2xl 부터 문서 순서).
 */
const SLOT = {
    todo: 'order-2 col-span-12 @2xl:order-none',
    conti: 'order-1 col-span-12 @2xl:order-none @2xl:col-span-6 @2xl:row-span-2',
    schedule: 'order-3 col-span-12 @2xl:order-none @2xl:col-span-6',
    request: 'order-4 col-span-12 @2xl:order-none @2xl:col-span-6 @4xl:col-span-3',
    team: 'order-6 col-span-12 @2xl:order-none @2xl:col-span-6 @4xl:col-span-3',
    feed: 'order-5 col-span-12 @2xl:order-none @2xl:col-span-6 @4xl:col-span-7',
    shortcuts: 'order-7 col-span-12 @2xl:order-none @4xl:col-span-5',
} as const;

function withTab(href: string, tab: string) {
    return href.includes('?') ? `${href}&tab=${tab}` : `${href}?tab=${tab}`;
}

function dayName(date: string) {
    return weekday(date) === '일' ? '주일' : `${weekday(date)}요일`;
}

/* ───────────── 요청 · 할 일 (같은 정의를 한곳에서) ───────────── */

export interface RequestSummary {
    /** 아직 끝나지 않은 요청 전체 = 확인할 요청 (모바일 '이번 주'의 '확인할 요청 N건'과 같은 수) */
    open: RequestItem[];
    /** 그중 내가 답하고 완료할 요청 = 할 일 '요청 N건에 답하기'의 N */
    toAnswer: RequestItem[];
    /** 그중 불참 · 대체 인원 · 긴급 공지 */
    alerts: RequestItem[];
    /** 그중 다른 사람의 답을 기다리는 요청 */
    waiting: RequestItem[];
}

/** open = toAnswer + alerts + waiting. 타일의 숫자와 할 일의 숫자가 서로 어긋나지 않도록 여기서만 나눕니다. */
export function summarizeRequests(requests: RequestItem[]): RequestSummary {
    const open = requests.filter((request) => !request.done);
    return {
        open,
        toAnswer: open.filter((request) => request.source === 'request' && request.canResolve),
        alerts: open.filter((request) => request.source === 'alert'),
        waiting: open.filter((request) => request.source === 'request' && !request.canResolve),
    };
}

interface Todo {
    id: string;
    icon: LucideIcon;
    title: string;
    detail: string;
    href: string;
    /** 기다리는 사람이 있는 일 (작은 주황 점) */
    urgent?: boolean;
}

interface TodoInput {
    planning: PlanningView;
    summary: RequestSummary;
    service: ServiceDay | null;
    today: string;
    anchor: string;
    /** 이번 주(다가오는 주일까지)의 콘티가 있는지 */
    hasWeekSetlist: boolean;
    hasTeam: boolean;
    createHref: string;
    scheduleHref: string;
    requestsHref: string;
}

function buildTodos({ planning, summary, service, today, anchor, hasWeekSetlist, hasTeam, createHref, scheduleHref, requestsHref }: TodoInput): Todo[] {
    const todos: Todo[] = [];
    const manager = Boolean(planning.viewer?.canManage);
    if (summary.toAnswer.length) {
        todos.push({
            id: 'answer',
            icon: Inbox,
            title: `요청 ${summary.toAnswer.length}건에 답하기`,
            detail: summary.toAnswer.map((request) => request.title).join(' · '),
            href: requestsHref,
            urgent: true,
        });
    }
    if (service && manager) {
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
            }
        }
    }

    // 아직 준비되지 않은 것: 팀 → 이번 주 콘티 → 주일 예배 일정 (팀이 없거나 관리자일 때만)
    const canSetUp = !hasTeam || manager;
    if (!hasTeam) {
        todos.push({ id: 'team', icon: UserPlus, title: '팀 만들고 팀원 초대하기', detail: '링크로 초대하면 역할 배치와 알림을 함께 써요', href: '/dashboard/team' });
    }
    if (canSetUp && !hasWeekSetlist) {
        todos.push({ id: 'conti', icon: ListPlus, title: '이번 주 콘티 만들기', detail: `${md(anchor)} 주일 · 곡 보관함에서 곡 고르기`, href: createHref });
    }
    if (canSetUp && planning.ready && !planning.services.some((item) => item.date >= today && item.date <= anchor)) {
        todos.push({ id: 'service', icon: CalendarPlus, title: '주일 예배 일정 추가하기', detail: '역할을 배치하면 팀원에게 참석 요청이 가요', href: scheduleHref });
    }

    if (service && manager) {
        for (const item of service.assignments) {
            if (item.status === null) todos.push({ id: `vacant:${item.slotId}`, icon: Plus, title: `${item.roleLabel} 빈자리 채우기`, detail: `${md(service.date)} ${service.title}`, href: scheduleHref });
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

/* ───────────── 홈 ───────────── */

export interface HomeTilesProps {
    /** 라이브 예배 화면 주소 (콘티가 있으면 그 콘티로). 없으면 데모 세션 */
    sessionHref?: (setlistId: string | null) => string;
    /** 지금 팀. null = 아직 만든 팀이 없음, undefined = 시안(이름 없이 팀이 있는 것으로) */
    team?: { name: string } | null;
    /** 날짜 제목의 단계 (시안 페이지는 따로 h1 이 있어 h2) */
    titleAs?: 'h1' | 'h2';
    /** 팀에서 지금 진행 중인 예배 (온라인 팀) — 있으면 맨 위에 '입장' 을 띄웁니다 */
    live?: { title: string; startedByName: string; present: number; currentSongTitle: string | null; href: string } | null;
    /** 예배를 시작할 수 있는지 (온라인 팀 권한). false 면 '시작' 대신 '인도자가 시작하면 입장' */
    canStart?: boolean;
}

/**
 * 홈 · 파스텔 타일 (시안 3)
 * 모바일 '이번 주'의 파스텔 블록을 타일로 나눠 배치한 홈. 타일마다 한 가지 색, 한 가지 일.
 * 민트 = 이번 주 콘티, 하늘 = 다음 일정, 복숭아 = 확인할 요청, 모래 = 팀 배치, 라일락 = 팀 소식, 흰 타일 = 할 일 · 바로가기.
 * 데이터는 useConti() 하나에서만 읽으므로 실제 데이터(LiveHome)와 목업(시안 페이지)이 같은 화면을 씁니다.
 */
export default function HomeTiles({ sessionHref, team, titleAs: Title = 'h1', live = null, canStart = true }: HomeTilesProps) {
    const { today, setlists, thisWeekId, editor, planning, roster } = useConti();
    const setlist = setlists.find((item) => item.id === thisWeekId) ?? null;
    const anchor = nextSunday(today);
    const hasTeam = team !== null;

    const service =
        planning.services.find((item) => Boolean(setlist) && item.setlistId === setlist?.id) ??
        planning.services.find((item) => item.date === anchor) ??
        planning.services.find((item) => item.date >= today) ??
        null;
    const summary = summarizeRequests(planning.requests);
    const sample = planning.sample ? <SampleChip /> : null;

    const createHref = editor?.createHref ?? '/dashboard/songs/library';
    const scheduleHref = withTab(planning.planningHref, 'schedule');
    const requestsHref = withTab(planning.planningHref, 'requests');
    const alertsHref = '/dashboard/songs?tab=alerts';

    // 예배 당일에만 라이브 세션을 주요 동작(검정)으로 올립니다. 그 전에는 바로가기의 보조 동작입니다.
    const todaySetlist = setlists.find((item) => item.date === today) ?? null;
    const serviceToday = Boolean(todaySetlist) || planning.services.some((item) => item.date === today);
    const liveSetlist = todaySetlist ?? setlist;
    const liveHref = live?.href ?? (sessionHref ? sessionHref(liveSetlist?.id ?? null) : liveSetlist && editor?.sessionHref ? editor.sessionHref(liveSetlist.id) : `/session/${DEMO_SESSION_ID}`);
    const serviceDate = service?.date ?? setlist?.date ?? anchor;
    const serviceTime = service?.time ?? setlist?.time ?? '';

    const todos = buildTodos({
        planning,
        summary,
        service,
        today,
        anchor,
        hasWeekSetlist: Boolean(setlist && setlist.date <= anchor),
        hasTeam,
        createHref,
        scheduleHref,
        requestsHref,
    });

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                    <p className={cn('truncate text-xs font-medium', sub)}>
                        {team?.name ? `${team.name} · ` : ''}
                        {weekLabel(anchor)}
                    </p>
                    <Title className={cn('mt-0.5 text-2xl font-semibold tracking-tight', ink)}>
                        {monthOf(anchor)}월 {dayOf(anchor)}일{' '}
                        <span className={cn('ml-1 font-normal', sub)}>
                            {dayName(anchor)} · {anchor === today ? <span className={todayText}>오늘</span> : dDay(anchor, today)}
                        </span>
                    </Title>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {serviceToday && !live && canStart && (
                        <Link href={liveHref} className={buttonVariants({ size: 'sm' })}>
                            <Radio aria-hidden="true" />
                            예배 시작
                        </Link>
                    )}
                    <Link
                        href={alertsHref}
                        aria-label={planning.unreadCount > 0 ? `팀 소식 · 새 소식 ${planning.unreadCount}개` : '팀 소식'}
                        className={cn('relative inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted', line, ink)}
                    >
                        <Bell size={18} aria-hidden="true" />
                        {planning.unreadCount > 0 && <span className={cn('absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                    </Link>
                    <AddButton label="일정 추가 (일정·요청 화면)" href={scheduleHref} />
                </div>
            </header>

            {live ? <LiveNow live={live} /> : null}

            {planning.announcements.length > 0 && (
                <AnnouncementStrip
                    items={planning.announcements}
                    href={withTab(planning.planningHref, 'announcements')}
                    busy={planning.busy}
                    onAck={planning.actions ? (id) => void planning.actions!.dispatch({ type: 'announcement.ack', announcementId: id }) : null}
                />
            )}

            {planning.error && (
                <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {planning.error}
                </p>
            )}

            <div className="@container">
                <div className="grid grid-cols-12 gap-4">
                    <TodoStrip todos={todos} viewer={hasTeam ? planning.viewer : null} ready={planning.ready} href={scheduleHref} className={SLOT.todo} />
                    <ContiTile setlist={setlist} anchor={anchor} createHref={createHref} className={SLOT.conti} />
                    <ScheduleTile anchor={anchor} href={scheduleHref} sample={sample} className={SLOT.schedule} />
                    <RequestTile summary={summary} ready={planning.ready} href={requestsHref} sample={sample} className={SLOT.request} />
                    <TeamTile service={service} anchor={anchor} hasTeam={hasTeam} ready={planning.ready} rosterCount={roster.length} href={scheduleHref} className={SLOT.team} />
                    <FeedTile planning={planning} href={alertsHref} sample={sample} className={SLOT.feed} />
                    <ShortcutsTile
                        className={SLOT.shortcuts}
                        items={[
                            { href: createHref, icon: ListPlus, label: '콘티 만들기', detail: '곡 골라 순서 짜기' },
                            { href: '/dashboard/songs/library', icon: Library, label: '곡 보관함', detail: '키 · BPM · 악보' },
                            { href: '/dashboard/team', icon: UserPlus, label: hasTeam ? '팀 초대' : '팀 만들기 · 초대', detail: hasTeam && roster.length ? `팀원 ${roster.length}명 · 링크로 초대` : '링크로 초대' },
                            {
                                href: liveHref,
                                icon: Radio,
                                label: live ? '예배 입장 · 진행 중' : canStart ? '예배 시작 · 입장' : '예배 화면',
                                detail: live
                                    ? `${live.present}명 접속 · ${live.currentSongTitle ?? live.title}`
                                    : !canStart
                                      ? '인도자가 시작하면 바로 입장해요'
                                      : serviceToday
                                        ? `오늘${serviceTime ? ` ${serviceTime}` : ''} 예배 · 지금 시작`
                                        : serviceTime
                                          ? `${md(serviceDate)} ${dayName(serviceDate)} ${serviceTime} · ${dDay(serviceDate, today)}`
                                          : '예배 화면 미리 보기',
                                primary: Boolean(live) || (serviceToday && canStart),
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}

/* ───────────── 불러오는 중 (같은 자리 · 같은 색) ───────────── */

/**
 * 브라우저 저장소를 읽기 전(서버 렌더 · 첫 화면) 모습. 실제 홈과 같은 격자 · 같은 타일 색이라 불러온 뒤에도 자리가 크게 움직이지 않습니다.
 */
export function HomeTilesSkeleton() {
    return (
        <div role="status" aria-label="홈 화면을 불러오는 중" className="space-y-6">
            <div className="flex items-end justify-between gap-4" aria-hidden="true">
                <div className="space-y-2.5 py-0.5">
                    <Bar className="h-3 w-24" />
                    <Bar className="h-6 w-48" />
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn('size-10 rounded-full border', line)} />
                    <span className="size-9 rounded-xl bg-muted" />
                </div>
            </div>
            <div className="@container" aria-hidden="true">
                <div className="grid grid-cols-12 gap-4">
                    <SkeletonTile className={cn(SLOT.todo, 'min-h-[8rem]')} lines={1} />
                    <SkeletonTile tone="mint" className={cn(SLOT.conti, 'min-h-[22rem]')} lines={5} />
                    <SkeletonTile tone="sky" className={cn(SLOT.schedule, 'min-h-[18.5rem]')} lines={3} />
                    <SkeletonTile tone="peach" className={cn(SLOT.request, 'min-h-[18.75rem]')} lines={3} />
                    <SkeletonTile tone="sand" className={cn(SLOT.team, 'min-h-[18.75rem]')} lines={3} />
                    <SkeletonTile tone="lilac" className={cn(SLOT.feed, 'min-h-[18rem]')} lines={3} />
                    <SkeletonTile className={cn(SLOT.shortcuts, 'min-h-[18rem]')} lines={4} />
                </div>
            </div>
        </div>
    );
}

function Bar({ className }: { className?: string }) {
    return <span className={cn('block animate-pulse rounded-full bg-foreground/[0.07] motion-reduce:animate-none', className)} />;
}

function SkeletonTile({ tone, lines, className }: { tone?: Tone; lines: number; className?: string }) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-4 rounded-3xl p-5 @2xl:p-6', tone ? TONE_TILE[tone] : cn('border bg-card', line), className)}>
            <div className="flex items-center gap-2">
                <span className={cn('size-7 rounded-lg', tone ? TONE_TILE_ICON[tone] : 'bg-muted')} />
                <Bar className="h-3 w-20" />
            </div>
            <div className="space-y-3 pt-2">
                {Array.from({ length: lines }, (_, index) => (
                    <Bar key={index} className={cn('h-3', index % 3 === 0 ? 'w-3/4' : index % 3 === 1 ? 'w-1/2' : 'w-2/3')} />
                ))}
            </div>
        </div>
    );
}

/** 타일 안에서 일정 · 요청을 아직 읽는 중일 때 */
function Pending({ className }: { className?: string }) {
    return (
        <div aria-hidden="true" className={cn('space-y-2.5', className)}>
            <Bar className="h-3 w-2/3" />
            <Bar className="h-3 w-1/2" />
        </div>
    );
}

/* ───────────── 타일 뼈대 ───────────── */

function Tile({
    tone,
    title,
    icon: Icon,
    badge,
    meta,
    action,
    className,
    children,
}: {
    tone?: Tone;
    title: ReactNode;
    icon: LucideIcon;
    badge?: ReactNode;
    meta?: ReactNode;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    const id = useId();
    return (
        <section aria-labelledby={id} className={cn('flex min-w-0 flex-col rounded-3xl p-5 @2xl:p-6', tone ? TONE_TILE[tone] : cn('border bg-card', line), className)}>
            <div className="flex min-h-8 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', tone ? TONE_TILE_ICON[tone] : 'bg-muted text-foreground')}>
                        <Icon size={15} aria-hidden="true" />
                    </span>
                    <h2 id={id} className={cn('truncate text-xs font-medium', sub)}>
                        {title}
                    </h2>
                    {badge}
                    {meta}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/** 타일 오른쪽 위 이동 링크. tight = 좁은 1/4 타일(1280 폭 근처)에서는 제목이 잘리지 않도록 화살표만 남깁니다. */
function TileLink({ href, label, tight = false, children }: { href: string; label?: string; tight?: boolean; children: ReactNode }) {
    return (
        <Link href={href} aria-label={label} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-mr-2 shrink-0 gap-0.5 font-medium text-foreground/75 hover:bg-foreground/5 hover:text-foreground', tight && '@4xl:@max-5xl:px-2')}>
            <span className={cn(tight && '@4xl:@max-5xl:sr-only')}>{children}</span>
            <ChevronRight size={14} aria-hidden="true" />
        </Link>
    );
}

/** 타일 안의 빈 상태: (있으면) 타일 색 아이콘 + 한 줄 제목 + 한 줄 설명 + (있으면) 동작 하나. 타일 가운데에 조용히 둡니다. */
function Empty({ icon: Icon, tone, title, detail, action }: { icon?: LucideIcon; tone?: Tone; title: string; detail: string; action?: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-5 text-center">
            {Icon && (
                <span className={cn('mb-3 flex size-10 items-center justify-center rounded-2xl', tone ? TONE_TILE_ICON[tone] : 'bg-muted text-foreground')}>
                    <Icon size={18} aria-hidden="true" />
                </span>
            )}
            <p className={cn('text-[15px] font-semibold tracking-tight', ink)}>{title}</p>
            <p className={cn('mt-1 max-w-xs text-xs leading-relaxed', sub)}>{detail}</p>
            {action}
        </div>
    );
}

/* ───────────── 흰 줄 · 지금 할 일 ───────────── */

function TodoStrip({ todos, viewer, ready, href, className }: { todos: Todo[]; viewer: PlanningView['viewer']; ready: boolean; href: string; className?: string }) {
    const id = useId();
    const listId = useId();
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? todos : todos.slice(0, TODO_LIMIT);
    const hidden = todos.length - TODO_LIMIT;

    return (
        <section aria-labelledby={id} className={cn('min-w-0 rounded-3xl border bg-card px-5 py-4 @2xl:px-6', line, className)}>
            <div className="flex min-h-8 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <ListChecks size={15} aria-hidden="true" />
                    </span>
                    <h2 id={id} className={cn('shrink-0 text-sm font-semibold tracking-tight', ink)}>
                        지금 할 일{ready && todos.length > 0 && <span className="ml-1 tabular-nums">{todos.length}</span>}
                    </h2>
                    {viewer && (
                        <span className={cn('truncate text-xs', sub)}>
                            · {viewer.name} {worshipRoles[viewer.role]}
                        </span>
                    )}
                </div>
                <TileLink href={href} label="일정·요청 화면 열기">
                    일정·요청
                </TileLink>
            </div>

            {!ready ? (
                <Pending className="py-3" />
            ) : todos.length ? (
                <>
                    <ul id={listId} className="mt-1 grid @2xl:grid-cols-3 @2xl:gap-x-6">
                        {shown.map((todo) => {
                            const Icon = todo.icon;
                            return (
                                <li key={todo.id} className={cn('min-w-0 border-t first:border-t-0 @2xl:[&:nth-child(-n+3)]:border-t-0', line)}>
                                    <Link href={todo.href} className="group flex min-w-0 items-center gap-3 py-2.5">
                                        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                                            <Icon size={16} aria-hidden="true" />
                                            {todo.urgent && <span className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={cn('block truncate text-sm font-medium group-hover:underline group-hover:underline-offset-2', ink)}>{todo.title}</span>
                                            <span className={cn('mt-0.5 block truncate text-xs', sub)}>{todo.detail}</span>
                                        </span>
                                        <ChevronRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5 @2xl:@max-4xl:hidden', sub)} aria-hidden="true" />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {hidden > 0 && (
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={listId}
                            onClick={() => setExpanded((value) => !value)}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-ml-3 mt-1 font-medium text-foreground/75')}
                        >
                            {expanded ? '접기' : `할 일 ${hidden}개 더 보기`}
                        </button>
                    )}
                </>
            ) : (
                <p className={cn('flex items-center gap-2 py-2.5 text-sm', body)}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Check size={16} className={STATUS.ok.text} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className={cn('block font-medium', ink)}>지금 할 일이 없어요</span>
                        <span className={cn('block text-xs', sub)}>새 요청이나 배치가 생기면 여기에 모아 드려요</span>
                    </span>
                </p>
            )}
        </section>
    );
}

/* ───────────── 민트 · 이번 주 콘티 ───────────── */

function ContiTile({ setlist, anchor, createHref, className }: { setlist: ContiSetlist | null; anchor: string; createHref: string; className?: string }) {
    if (!setlist) {
        return (
            <Tile tone="mint" icon={ListMusic} title="이번 주 콘티" className={className}>
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                    <span className={cn('flex size-12 items-center justify-center rounded-2xl', TONE_TILE_ICON.mint)}>
                        <ListMusic size={22} aria-hidden="true" />
                    </span>
                    <p className={cn('mt-4 text-[17px] font-semibold tracking-tight', ink)}>이번 주 콘티가 아직 없어요</p>
                    <p className={cn('mt-1 max-w-xs text-sm leading-relaxed', sub)}>곡 보관함에서 곡을 고르면 {md(anchor)} 주일 콘티가 여기에 바로 보여요</p>
                    <Link href={createHref} className={cn(buttonVariants({ size: 'sm' }), 'mt-5')}>
                        <Plus aria-hidden="true" />
                        콘티 만들기
                    </Link>
                </div>
            </Tile>
        );
    }

    const songs = songsOf(setlist.items);
    const shown = songs.slice(0, SONG_LIMIT);
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
                <TileLink href={`/dashboard/songs?tab=order&setlist=${encodeURIComponent(setlist.id)}`} label={`${displayTitle(setlist)} 콘티 열기`}>
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

            {/* 곡이 많으면 타일 높이에 맞춰 고르게, 적으면 위에서부터 */}
            <ol className={cn('mt-5 flex flex-1 flex-col gap-1', shown.length >= 5 && 'justify-between')} aria-label="곡 순서">
                {shown.map((item, index) => {
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
                {songs.length > SONG_LIMIT && <li className={cn('py-1.5 pl-8 text-xs', sub)}>외 {songs.length - SONG_LIMIT}곡</li>}
                {!songs.length && (
                    <li className="py-6 text-center">
                        <p className={cn('text-sm font-medium', ink)}>아직 곡이 없어요</p>
                        <p className={cn('mt-1 text-xs', sub)}>콘티를 열어 곡과 순서를 채워 주세요</p>
                    </li>
                )}
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

function ScheduleTile({ anchor, href, sample, className }: { anchor: string; href: string; sample: ReactNode; className?: string }) {
    const { today, setlists, planning } = useConti();
    const dates = weekDates(anchor);
    const weekEvents = planning.events.filter((event) => event.date >= dates[0] && event.date <= dates[6]);
    // 처음에는 오늘부터 주일 사이의 가장 가까운 일정 날, 없으면 주일
    const nextDay = weekEvents.find((event) => event.date >= today)?.date ?? anchor;
    const [picked, setPicked] = useState<string | null>(null);
    const day = picked ?? nextDay;
    const setlistDates = new Set(setlists.map((item) => item.date));
    const events = planning.events.filter((event) => event.date === day);
    const [first, ...rest] = events;

    return (
        <Tile tone="sky" icon={CalendarDays} title={`${dayName(day)} 일정 · ${md(day)}`} badge={sample} action={<TileLink href={href} label="일정 모두 보기">일정 보기</TileLink>} className={className}>
            {!planning.ready ? (
                <Pending className="mt-5 flex-1" />
            ) : first ? (
                <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                        <p className={bigValue}>
                            <span className={ink}>{day === today ? '오늘' : dDay(day, today)}</span>
                            <span className={cn('ml-3', sub)}>{first.start}</span>
                        </p>
                        <p className={cn('mt-3 truncate text-sm font-medium', ink)}>
                            <span className={cn('mr-1.5 text-xs font-normal', TONE_ICON[EVENT_KIND[first.kind].tone])}>{EVENT_KIND[first.kind].label}</span>
                            {first.title}
                        </p>
                        <p className={cn('mt-1 flex min-w-0 items-center gap-1 text-xs tabular-nums', sub)}>
                            <span className="shrink-0">
                                {first.start} - {first.end}
                            </span>
                            {first.place && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <MapPin size={12} className="shrink-0" aria-hidden="true" />
                                    <span className="truncate">{first.place}</span>
                                </>
                            )}
                            {rest.length > 0 && <span className="ml-1 shrink-0">외 {rest.length}개</span>}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {first.attendees.length > 0 && <AvatarStack names={first.attendees} max={3} size="xs" />}
                        <span className={cn('text-[11px] tabular-nums', sub)}>{first.expected ? `${first.attendees.length}/${first.expected}명` : '인원 미정'}</span>
                    </div>
                </div>
            ) : weekEvents.length ? (
                <div className="mt-4">
                    <p className={cn(bigValue, ink)}>{day === today ? '오늘' : dDay(day, today)}</p>
                    <p className={cn('mt-3 text-sm font-medium', ink)}>이 날은 일정이 없어요</p>
                    <p className={cn('mt-1 text-xs', sub)}>점이 있는 날을 누르면 그날 일정이 보여요</p>
                </div>
            ) : (
                <Empty
                    title="이번 주 일정이 아직 없어요"
                    detail="연습 · 예배 일정을 추가하면 팀원에게 참석 요청이 가요"
                    action={
                        <Link href={href} className={quietAction}>
                            <CalendarPlus aria-hidden="true" />
                            일정 추가
                        </Link>
                    }
                />
            )}

            <ol className={cn('mt-5 grid grid-cols-7 rounded-2xl p-1.5 text-center', inset)} aria-label="이번 주 날짜">
                {dates.map((date) => {
                    const active = date === day;
                    const dayEvents = planning.events.filter((event) => event.date === date);
                    const kinds = Array.from(new Set(dayEvents.map((event) => event.kind)));
                    return (
                        <li key={date}>
                            <button
                                type="button"
                                onClick={() => setPicked(date)}
                                aria-pressed={active}
                                aria-current={date === today ? 'date' : undefined}
                                aria-label={`${monthOf(date)}월 ${dayOf(date)}일 ${weekday(date)}요일${date === today ? ' (오늘)' : ''}${dayEvents.length ? ` · 일정 ${dayEvents.length}개` : ''}`}
                                className="group flex w-full flex-col items-center gap-1 rounded-xl py-1.5"
                            >
                                <span className={cn('text-[11px]', active ? cn('font-semibold', ink) : sub)}>{weekday(date)}</span>
                                <span
                                    className={cn(
                                        'flex size-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors',
                                        active ? cn(selected, 'font-semibold') : cn('group-hover:bg-foreground/5', date === today ? todayText : body),
                                    )}
                                >
                                    {dayOf(date)}
                                </span>
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

function RequestTile({ summary, ready, href, sample, className }: { summary: RequestSummary; ready: boolean; href: string; sample: ReactNode; className?: string }) {
    const { open, toAnswer, alerts, waiting } = summary;
    const authors = Array.from(new Set(open.map((request) => request.author).filter((name): name is string => Boolean(name))));
    const latest = toAnswer[0] ?? open[0];
    const parts = [
        { label: '내가 답할 요청', value: toAnswer.length, dot: 'bg-secondary', strong: true },
        { label: '불참 · 대체', value: alerts.length, dot: STATUS.danger.dot, strong: false },
        { label: '답변 기다림', value: waiting.length, dot: STATUS.idle.dot, strong: false },
    ].filter((item) => item.value > 0);

    return (
        <Tile tone="peach" icon={Inbox} title="확인할 요청" action={<TileLink href={href} label="확인할 요청 모두 보기" tight>모두 보기</TileLink>} className={className}>
            {!ready ? (
                <Pending className="mt-5 flex-1" />
            ) : !open.length ? (
                <Empty icon={Inbox} tone="peach" title="확인할 요청이 없어요" detail="팀원이 콘티 질문이나 수정 요청을 남기면 여기에 모여요" />
            ) : (
                <>
                    <div className="mt-4 flex items-end justify-between gap-3">
                        <p className="flex items-baseline gap-1">
                            <span className={cn(bigValue, ink)}>{open.length}</span>
                            <span className={cn('text-base font-medium', ink)}>건</span>
                        </p>
                        {authors.length > 0 && <AvatarStack names={authors} max={3} size="sm" />}
                    </div>
                    <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums" aria-label="확인할 요청 나누어 보기">
                        {parts.map((item) => (
                            <li key={item.label} className={cn('inline-flex items-center gap-1.5', item.strong ? cn('font-medium', ink) : sub)}>
                                <span className={cn('size-1.5 rounded-full', item.dot)} aria-hidden="true" />
                                {item.label} {item.value}
                            </li>
                        ))}
                        {sample && <li className="inline-flex">{sample}</li>}
                    </ul>
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
                </>
            )}
        </Tile>
    );
}

/* ───────────── 모래 · 주일 팀 배치 ───────────── */

function TeamTile({ service, anchor, hasTeam, ready, rosterCount, href, className }: { service: ServiceDay | null; anchor: string; hasTeam: boolean; ready: boolean; rosterCount: number; href: string; className?: string }) {
    if (!hasTeam) {
        return (
            <Tile tone="sand" icon={UsersRound} title="주일 팀 배치" className={className}>
                <Empty
                    icon={UserPlus}
                    tone="sand"
                    title="아직 팀이 없어요"
                    detail="팀을 만들고 링크로 초대하면 역할별 담당과 참석 여부가 여기에 보여요"
                    action={
                        <Link href="/dashboard/team" className={quietAction}>
                            <UserPlus aria-hidden="true" />
                            팀 만들기 · 초대
                        </Link>
                    }
                />
            </Tile>
        );
    }
    if (!ready) {
        return (
            <Tile tone="sand" icon={UsersRound} title="주일 팀 배치" className={className}>
                <Pending className="mt-5 flex-1" />
            </Tile>
        );
    }
    if (!service || service.counts.total === 0) {
        return (
            <Tile tone="sand" icon={UsersRound} title={service ? `${md(service.date)} ${dayName(service.date)} 팀 배치` : '주일 팀 배치'} className={className}>
                <Empty
                    icon={UsersRound}
                    tone="sand"
                    title={service ? '아직 역할을 배치하지 않았어요' : '예배 일정이 아직 없어요'}
                    detail={rosterCount ? `팀원 ${rosterCount}명 · 역할을 배치하면 참석 요청이 가요` : '예배 일정에 역할을 배치하면 참석 여부가 여기에 보여요'}
                    action={
                        <Link href={href} className={quietAction}>
                            {service ? <UsersRound aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
                            {service ? '역할 배치하기' : '일정 추가'}
                        </Link>
                    }
                />
            </Tile>
        );
    }

    const { counts } = service;
    const issues = [
        { label: '대기', value: counts.pending, dot: STATUS.warn.dot },
        { label: '불참', value: counts.declined, dot: STATUS.danger.dot },
        { label: '빈자리', value: counts.vacant, dot: STATUS.idle.dot },
    ].filter((item) => item.value > 0);
    const title = service.date === anchor ? `${dayName(service.date)} 팀 배치` : `${md(service.date)} ${dayName(service.date)} 팀 배치`;

    return (
        <Tile tone="sand" icon={UsersRound} title={title} action={<TileLink href={href} label="팀 배치 보기" tight>배치 보기</TileLink>} className={className}>
            <p className="mt-4 flex items-baseline gap-1">
                <span className={cn(bigValue, ink)}>
                    {counts.confirmed}
                    <span className={sub}>/{counts.total}</span>
                </span>
                <span className={cn('ml-0.5 text-base font-medium', ink)}>확정</span>
            </p>
            <div className="mt-3.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`확정 ${counts.confirmed}, 대기 ${counts.pending}, 불참 ${counts.declined}, 빈자리 ${counts.vacant}`}>
                {SLOT_ORDER.flatMap(({ key, bar }) => Array.from({ length: counts[key] }, (_, index) => <span key={`${key}:${index}`} className={cn('flex-1', bar)} />))}
            </div>
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
                    <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', ink)}>
                        <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />새 소식 {unread}
                    </span>
                )
            }
            action={<TileLink href={href} label="팀 소식 모두 보기">모두 보기</TileLink>}
            className={className}
        >
            {!planning.ready ? (
                <Pending className="mt-5 flex-1" />
            ) : !planning.notices.length ? (
                <Empty icon={MessageCircle} tone="lilac" title="아직 팀 소식이 없어요" detail="콘티 코멘트 · 요청 답변 · 배치 소식이 생기면 여기에 모여요" />
            ) : (
                <ul className="mt-4 flex flex-1 flex-col gap-4">
                    {planning.notices.slice(0, 3).map((notice) => (
                        <li key={notice.id} className="flex gap-3">
                            <NoticeAvatar notice={notice} size="sm" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                    {/* 좁은 화면에서도 제목이 잘리지 않도록 두 줄까지 */}
                                    <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">
                                        {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                                        <span className={notice.actor ? body : cn('font-medium', ink)}>{notice.title}</span>
                                    </p>
                                    <span className={cn('mt-px shrink-0 text-[11px]', sub)}>
                                        {notice.unread && <span className="mr-1 inline-block size-1.5 rounded-full bg-secondary align-middle" aria-label="새 소식" />}
                                        {notice.ago}
                                    </span>
                                </div>
                                {notice.quote ? (
                                    <p className={cn('mt-1.5 truncate rounded-2xl rounded-tl-md px-3.5 py-2 text-[13px]', inset, body)}>“{notice.quote}”</p>
                                ) : (
                                    notice.message !== notice.title && <p className={cn('mt-1 truncate text-xs', sub)}>{notice.message}</p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Tile>
    );
}

/* ───────────── 흰 타일 · 바로가기 ───────────── */

interface Shortcut {
    href: string;
    icon: LucideIcon;
    label: string;
    detail: string;
    /** 예배 당일의 라이브 세션만 검정 */
    primary?: boolean;
}

function ShortcutsTile({ items, className }: { items: Shortcut[]; className?: string }) {
    return (
        <Tile icon={ArrowUpRight} title="바로가기" className={className}>
            <ul className="mt-2 grid flex-1 content-between @2xl:grid-cols-2 @2xl:gap-x-6 @4xl:grid-cols-1">
                {items.map(({ href, icon: Icon, label, detail, primary }) => (
                    <li key={label} className={cn('min-w-0 border-t first:border-t-0 @2xl:@max-4xl:[&:nth-child(2)]:border-t-0', line)}>
                        <Link href={href} className="group -mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/60">
                            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', primary ? selected : 'bg-muted text-foreground')}>
                                <Icon size={18} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-sm font-semibold', ink)}>{label}</span>
                                <span className={cn('mt-0.5 block truncate text-xs', sub)}>{detail}</span>
                            </span>
                            <ChevronRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5', sub)} aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        </Tile>
    );
}

/** 팀에서 예배가 진행 중일 때 홈 맨 위 — 누가 시작했고 몇 명이 들어와 있는지, 그리고 '입장' */
/**
 * 팀 공지. 내가 확인할 공지를 먼저(최대 2개), 없으면 가장 최근 공지 하나를 보여 줍니다.
 * 확인을 받는 공지는 여기서 바로 '확인했어요', 내가 쓴 공지는 확인 현황을 봅니다.
 */
function AnnouncementStrip({ items, href, busy, onAck }: { items: AnnouncementItem[]; href: string; busy: boolean; onAck: ((id: string) => void) | null }) {
    const waiting = items.filter((item) => item.needsMyAck);
    const shown = waiting.length ? waiting.slice(0, 2) : items.slice(0, 1);
    return (
        <section aria-label="팀 공지" className="space-y-2">
            {shown.map((item) => (
                <article key={item.id} className={cn('flex flex-wrap items-start gap-x-3.5 gap-y-3 rounded-3xl p-4 sm:p-5', item.needsMyAck ? TONE_TILE.peach : cn('border bg-card', line))}>
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', item.needsMyAck ? TONE_TILE_ICON.peach : 'bg-muted text-orange-600 dark:text-orange-300')}>
                        <Megaphone className="size-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                        <p className={cn('text-xs font-medium', sub)}>
                            공지 · {item.authorName} · {item.ago}
                            {waiting.length > 2 && item === shown[0] ? ` · 확인할 공지 ${waiting.length}개` : ''}
                        </p>
                        <p className={cn('mt-0.5 break-words text-[15px] font-semibold leading-snug tracking-tight', ink)}>{item.title}</p>
                        <p className={cn('mt-1 line-clamp-2 whitespace-pre-line break-words text-[13px] leading-relaxed', body)}>{item.body}</p>
                        {item.mine && item.requireAck && (
                            <p className={cn('mt-1.5 text-xs font-medium', item.ackCount < item.total ? 'text-secondary' : 'text-brand')}>
                                확인 {item.ackCount}/{item.total}{item.ackCount < item.total ? ` · 아직 ${item.total - item.ackCount}명` : ' · 모두 확인'}
                            </p>
                        )}
                    </div>
                    <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                        {item.needsMyAck && onAck && (
                            <button type="button" disabled={busy} onClick={() => onAck(item.id)} className={cn(buttonVariants({ size: 'sm' }), 'flex-1 sm:flex-none')}>
                                <Check aria-hidden="true" />
                                {item.requireAck ? '확인했어요' : '확인'}
                            </button>
                        )}
                        <Link href={href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 sm:flex-none')}>
                            공지 보기
                        </Link>
                    </div>
                </article>
            ))}
        </section>
    );
}

function LiveNow({ live }: { live: NonNullable<HomeTilesProps['live']> }) {
    return (
        <section aria-label="진행 중인 예배" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-brand p-4 text-brand-foreground sm:p-5">
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-foreground/15">
                <Radio className="size-5" aria-hidden="true" />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-foreground motion-safe:animate-pulse" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-brand-foreground/75">예배 진행 중 · {live.startedByName}님이 시작</p>
                <p className="mt-0.5 truncate text-[17px] font-semibold tracking-tight">{live.currentSongTitle ? `지금 「${live.currentSongTitle}」` : live.title}</p>
                <p className="mt-0.5 text-xs text-brand-foreground/75">{live.present}명 접속 · {live.title}</p>
            </div>
            <Link href={live.href} className={cn(buttonVariants({ size: 'lg' }), 'w-full bg-brand-foreground text-brand hover:bg-brand-foreground/90 sm:w-auto')}>
                입장
            </Link>
        </section>
    );
}
