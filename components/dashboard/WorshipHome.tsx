"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
    BellRing,
    CalendarDays,
    ChevronRight,
    Gauge,
    ListMusic,
    Music,
    PenLine,
    Radio,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import { getTeamSnapshot, getTeamServerSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';
import { LIBRARY_CHANGED_EVENT, readPrototypeLibrary, type LibrarySetlist, type LibrarySong } from '@/lib/libraryPrototypeStorage';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import Notice from '@/components/ui/Notice';
import { buttonVariants } from '@/components/ui/button';
import { TONE_BLOCK, TONE_ICON } from '@/components/ui/tones';
import { AvatarStack } from '@/components/conti/ui';
import { dDay, dayOf, diffDays, md, monthOf, nextSunday, seoulDateTime, weekLabel, weekday } from '@/components/conti/model';

interface WorshipHomeProps {
    currentSessionId?: string;
}

interface HomeRow {
    href?: string;
    icon: LucideIcon;
    title: string;
    detail: string;
}

/** 자주 쓰는 화면 바로가기 (사이드바·하단 내비와 같은 이름) */
const SHORTCUTS: HomeRow[] = [
    { href: '/dashboard/songs', icon: ListMusic, title: '콘티 구성', detail: '곡을 선택하고 순서와 다음 주 템플릿을 만듭니다.' },
    { href: '/dashboard/songs/library', icon: Music, title: '곡 보관함', detail: '곡별 BPM 프리셋과 유튜브 송폼을 등록합니다.' },
    { href: '/dashboard/team', icon: UsersRound, title: '팀원 초대·역할', detail: '카카오톡이나 링크로 초대하고 파트를 나눕니다.' },
    { href: '/dashboard/planning', icon: CalendarDays, title: '일정·인도자 요청', detail: '연습 일정을 등록하고 콘티 질문을 남깁니다.' },
];

const CHECKS: HomeRow[] = [
    { icon: PenLine, title: '악보 및 필기 확인', detail: '손필기와 버튼 표시를 마치면 팀 공유본으로 내보내 팀원에게 전달하세요.' },
    { icon: Gauge, title: 'BPM & 송폼 점검', detail: '인트로, 절, 후렴, 브릿지의 마디 수와 템포를 사전에 확인하세요.' },
    { icon: BellRing, title: '실시간 큐 수신', detail: '예배 세션에 입장해 빠름·느림·섹션 큐 알림이 정상적으로 수신되는지 확인하세요.' },
];

/** 이번 주 화면(콘티·악보)과 같은 서울 기준 날짜. 날짜로 읽을 수 없는 값은 null. */
function seoulDate(value: string | number): string | null {
    try {
        return seoulDateTime(new Date(value)).date;
    } catch {
        return null;
    }
}

const dayName = (date: string) => (weekday(date) === '일' ? '주일' : `${weekday(date)}요일`);

export default function WorshipHome({ currentSessionId }: WorshipHomeProps) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const team = useMemo(() => {
        try {
            const state = parseTeamSnapshot(raw);
            return state.teams.find((item) => item.id === state.activeTeamId);
        } catch {
            return undefined;
        }
    }, [raw]);

    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const [setlists, setSetlists] = useState<LibrarySetlist[]>([]);
    const [songs, setSongs] = useState<LibrarySong[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');
    const [openedAt] = useState(() => Date.now());

    const teamId = team?.id ?? DEMO_TEAM_ID;

    useEffect(() => {
        let active = true;
        function refresh() {
            try {
                const library = readPrototypeLibrary(teamId);
                if (active) {
                    setSetlists(library?.setlists ?? []);
                    setSongs(library?.songs ?? []);
                    setError('');
                }
            } catch {
                if (active) {
                    setError('저장된 콘티를 읽지 못했습니다. 콘티 화면에서 저장 상태를 확인해주세요.');
                }
            }
            if (active) setLoaded(true);
        }
        queueMicrotask(refresh);
        window.addEventListener('storage', refresh);
        window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
        return () => {
            active = false;
            window.removeEventListener('storage', refresh);
            window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh);
        };
    }, [teamId]);

    const today = seoulDate(openedAt) ?? '';
    const ordered = [...setlists].sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date));
    // 서울 기준 오늘 예배도 '다음 예배'로 봅니다 (콘티·악보의 이번 주 화면과 같은 기준).
    const next = ordered.find((item) => (seoulDate(item.worship_date) ?? '') >= today) ?? ordered[ordered.length - 1];
    const nextDate = next ? seoulDate(next.worship_date) : null;

    const liveHref = next
        ? `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(next.id)}&team=${encodeURIComponent(teamId)}`
        : `/session/${currentSessionId ?? DEMO_SESSION_ID}`;

    const members = team?.members ?? [];
    const memberCount = members.length;
    const hasLeader = members.some((member) => member.role === 'leader');
    const songCount = next?.song_order?.length ?? 0;
    const estimatedMinutes = songCount * 4;
    const songById = new Map(songs.map((song) => [song.id, song]));
    const nextSongs = (next?.song_order ?? []).flatMap((id) => songById.get(id) ?? []);

    const ready = isClient && loaded;
    const thisSunday = today ? nextSunday(today) : '';
    const daysLeft = nextDate && today ? diffDays(nextDate, today) : null;
    const dayStatus = nextDate && daysLeft !== null ? `${dayName(nextDate)} · ${daysLeft < 0 ? '최근 예배' : dDay(nextDate, today)}` : null;

    return (
        <div className="space-y-8">
            {ready ? (
                <PageHeader
                    eyebrow={`${team ? team.name : '기본 예배팀'}${nextDate ? ` · ${weekLabel(nextDate)}` : ''}`}
                    title={nextDate ? `${monthOf(nextDate)}월 ${dayOf(nextDate)}일` : '우리 팀의 예배 준비'}
                    badge={
                        dayStatus && (
                            <span className={cn('font-normal text-muted-foreground', daysLeft === 0 && 'font-semibold text-brand')}>{dayStatus}</span>
                        )
                    }
                    actions={
                        <Link href="/dashboard/team" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                            <UsersRound className="text-muted-foreground" aria-hidden="true" />
                            팀원 {memberCount}명
                        </Link>
                    }
                />
            ) : (
                <div aria-hidden="true" className="animate-pulse space-y-2">
                    <div className="h-3 w-36 rounded-full bg-muted" />
                    <div className="h-7 w-48 rounded-full bg-muted" />
                </div>
            )}

            {error && <Notice tone="error">{error}</Notice>}

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
                {ready ? (
                    <div className="space-y-4">
                        {next ? (
                            <section aria-label="이번 주 콘티" className={cn('relative rounded-3xl p-5 sm:p-6', TONE_BLOCK.mint)}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-muted-foreground">
                                            {nextDate && nextDate !== thisSunday ? `${md(nextDate)} ${dayName(nextDate)} 콘티` : '이번 주 콘티'}
                                        </p>
                                        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                                            <Link
                                                href="/dashboard/songs"
                                                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                                            >
                                                {next.title}
                                            </Link>
                                        </h2>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {next.theme ? `${next.theme} · ` : ''}
                                            {songCount}곡 · 약 {estimatedMinutes}분
                                        </p>
                                    </div>
                                    <ListMusic size={20} className={cn('shrink-0', TONE_ICON.mint)} aria-hidden="true" />
                                </div>

                                <ol className="mt-4 space-y-2">
                                    {nextSongs.map((song, index) => (
                                        <li key={`${song.id}:${index}`} className="flex items-center gap-3 text-[13px]">
                                            <span className="w-4 tabular-nums text-muted-foreground">{index + 1}</span>
                                            <span className="min-w-0 flex-1 truncate text-foreground">{song.title}</span>
                                            {song.original_key && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">Key {song.original_key}</span>}
                                        </li>
                                    ))}
                                    {!nextSongs.length && <li className="text-[13px] text-muted-foreground">아직 곡이 없어요</li>}
                                </ol>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-emerald-900/10 pt-3.5 dark:border-white/10">
                                    <span className="inline-flex min-w-0 items-center gap-2 text-xs text-foreground/75">
                                        {memberCount > 0 && <AvatarStack names={members.map((member) => member.name)} max={4} size="xs" />}
                                        <span className="truncate">
                                            {memberCount > 0 ? `${memberCount}명 · ${hasLeader ? '인도자 배정 완료' : '팀원 준비 중'}` : '팀원 준비 중'}
                                        </span>
                                    </span>
                                    <Link
                                        href="/dashboard/planning"
                                        className="relative z-10 inline-flex min-h-8 items-center gap-0.5 text-xs font-medium text-foreground/75 underline-offset-2 hover:text-foreground hover:underline"
                                    >
                                        출석·배치 현황
                                        <ChevronRight size={14} aria-hidden="true" />
                                    </Link>
                                </div>
                            </section>
                        ) : (
                            <section aria-label="이번 주 콘티" className="rounded-3xl border border-dashed border-input px-5 py-8 text-center">
                                <h2 className="text-[15px] font-medium text-foreground">악보와 큐를 한 화면에서 준비해요</h2>
                                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                                    샘플 예배에서 악보 필기, 시각적 BPM, 팀원에게 큐 보내기를 바로 테스트해볼 수 있습니다.
                                </p>
                            </section>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Link href={liveHref} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
                                <Radio aria-hidden="true" />
                                {next ? '이 콘티로 예배 입장' : '샘플 예배 체험'}
                            </Link>
                            <Link href="/dashboard/songs" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}>
                                <ListMusic className="text-muted-foreground" aria-hidden="true" />
                                콘티·곡 목록 관리
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div role="status" aria-label="예배 준비 정보 불러오는 중" className="animate-pulse space-y-4">
                        <div className="h-64 rounded-3xl bg-muted" />
                        <div className="h-12 rounded-full bg-muted sm:w-52" />
                    </div>
                )}

                <HomeRows title="빠른 작업" rows={SHORTCUTS} className="sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-1" />
            </div>

            <HomeRows title="예배 전 체크리스트" rows={CHECKS} className="lg:grid-cols-3 lg:gap-x-8" />

            <p className="text-xs leading-relaxed text-muted-foreground">
                * 실시간 큐와 BPM 메트로놈은 같은 브라우저의 2개 이상 탭을 열어두면 즉시 수신 테스트가 가능합니다.
            </p>
        </div>
    );
}

/** 레퍼런스의 악기 담당 행처럼: 40px 회색 아이콘 타일 + 제목 + 설명, 행 사이 가는 선 */
function HomeRows({ title, rows, className }: { title: string; rows: HomeRow[]; className?: string }) {
    return (
        <section aria-label={title} className="space-y-1">
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
            <ul className={cn('grid', className)}>
                {rows.map(({ href, icon: Icon, title: rowTitle, detail }) => {
                    const content = (
                        <>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                                <Icon size={18} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-medium text-foreground">{rowTitle}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                            </span>
                        </>
                    );
                    return (
                        <li key={rowTitle} className="border-b border-border/70">
                            {href ? (
                                <Link href={href} className="-mx-2 flex items-center gap-3.5 rounded-2xl px-2 py-3.5 transition-colors hover:bg-muted/60">
                                    {content}
                                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                                </Link>
                            ) : (
                                <div className="flex items-start gap-3.5 py-3.5">{content}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
