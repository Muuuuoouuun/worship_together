"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    Calendar,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Clock,
    ListMusic,
    Music,
    Radio,
    Sparkles,
    UserCheck,
    UsersRound,
} from 'lucide-react';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import { getTeamSnapshot, getTeamServerSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';
import { LIBRARY_CHANGED_EVENT, readPrototypeLibrary, type LibrarySetlist } from '@/lib/libraryPrototypeStorage';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';

interface WorshipHomeProps {
    currentSessionId?: string;
}

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
    const [error, setError] = useState('');
    const [openedAt] = useState(() => Date.now());

    const teamId = team?.id ?? DEMO_TEAM_ID;

    useEffect(() => {
        let active = true;
        function refresh() {
            try {
                const data = readPrototypeLibrary(teamId)?.setlists ?? [];
                if (active) {
                    setSetlists(data);
                    setError('');
                }
            } catch {
                if (active) {
                    setError('저장된 콘티를 읽지 못했습니다. 콘티 화면에서 저장 상태를 확인해주세요.');
                }
            }
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

    const ordered = [...setlists].sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date));
    const next = ordered.find((item) => Date.parse(item.worship_date) >= openedAt) ?? ordered[ordered.length - 1];

    const liveHref = next
        ? `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(next.id)}&team=${encodeURIComponent(teamId)}`
        : `/session/${currentSessionId ?? DEMO_SESSION_ID}`;

    // D-Day 계산
    const dDayInfo = useMemo(() => {
        if (!next) return { text: '준비 중', isToday: false, variant: 'subtle' as const };
        const worshipDate = new Date(next.worship_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(worshipDate);
        target.setHours(0, 0, 0, 0);

        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return { text: 'TODAY LIVE', isToday: true, variant: 'destructive' as const };
        } else if (diffDays > 0) {
            return { text: `D-${diffDays}`, isToday: false, variant: 'secondary' as const };
        } else {
            return { text: '최근 예배', isToday: false, variant: 'subtle' as const };
        }
    }, [next]);

    const formattedDate = useMemo(() => {
        if (!next) return '';
        try {
            return new Date(next.worship_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
            });
        } catch {
            return next.worship_date;
        }
    }, [next]);

    const memberCount = team?.members.length ?? 0;
    const songCount = next?.song_order?.length ?? 0;
    const estimatedMinutes = songCount * 4;

    return (
        <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300">
            {/* 상단 웰컴 & 팀 상태 헤더 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                            함께 준비하는 예배
                        </span>
                        <Badge variant="outline" size="sm">
                            {team ? team.name : '기본 예배팀'}
                        </Badge>
                    </div>
                    <h1 className="mt-1.5 text-2xl font-serif font-black tracking-tight text-foreground sm:text-3xl">
                        {team ? `${team.name}의 준비 현황` : '우리 팀의 예배 준비'}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/team"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
                    >
                        <UsersRound size={15} className="text-secondary" />
                        <span>팀원 {memberCount}명</span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                    </Link>
                </div>
            </div>

            {/* 메인 히어로 카드 (이번 주 예배) */}
            {!isClient ? (
                <section aria-label="예배 준비 정보 불러오는 중" className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-8 min-h-[300px] animate-pulse">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="h-7 w-28 rounded-full bg-muted" />
                            <div className="h-4 w-32 rounded bg-muted" />
                        </div>
                        <div className="space-y-3">
                            <div className="h-8 w-2/3 rounded-lg bg-muted" />
                            <div className="h-4 w-5/6 rounded bg-muted" />
                        </div>
                        <div className="h-16 rounded-2xl bg-muted/60" />
                        <div className="flex gap-3">
                            <div className="h-12 w-36 rounded-2xl bg-muted" />
                            <div className="h-12 w-36 rounded-2xl bg-muted" />
                        </div>
                    </div>
                </section>
            ) : (
                <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-sm sm:p-8">
                {/* 배경 장식 원 */}
                <div className="absolute -right-12 -top-12 size-56 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-secondary/5 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-6">
                    {/* 상단 메타 바 */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <Badge variant={dDayInfo.variant} size="lg" dot pulse={dDayInfo.isToday}>
                                {dDayInfo.text}
                            </Badge>
                            {formattedDate && (
                                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <Calendar size={15} />
                                    {formattedDate}
                                </span>
                            )}
                        </div>

                        {next && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Music size={14} className="text-secondary" />
                                    {songCount}곡 편성
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    약 {estimatedMinutes}분
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 콘티 제목 및 설명 */}
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {next?.title ?? '악보와 큐를 한 화면에서 준비해요'}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {next
                                ? '곡 순서와 송폼이 정돈되어 있습니다. 예배가 시작되면 실시간 큐와 시각적 메트로놈으로 호흡을 맞춥니다.'
                                : '샘플 예배에서 악보 필기, 시각적 BPM, 팀원에게 큐 보내기를 바로 테스트해볼 수 있습니다.'}
                        </p>
                    </div>

                    {/* 팀 배치 현황 요약 (팀원이 있을 때) */}
                    {team && team.members.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4">
                            <div className="flex items-center gap-3">
                                <AvatarGroup max={5} total={team.members.length}>
                                    {team.members.map((m) => (
                                        <Avatar
                                            key={m.id}
                                            name={m.name}
                                            size="sm"
                                            roleVariant={m.role === 'leader' ? 'leader' : 'default'}
                                        />
                                    ))}
                                </AvatarGroup>
                                <div className="text-xs">
                                    <span className="font-semibold text-foreground">
                                        {team.members.filter((m) => m.role === 'leader').length > 0 ? '인도자 배정 완료' : '팀원 준비 중'}
                                    </span>
                                    <p className="text-muted-foreground">{team.members.length}명의 팀원이 함께합니다</p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/planning"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                            >
                                <UserCheck size={14} />
                                <span>출석·배치 현황</span>
                            </Link>
                        </div>
                    )}

                    {/* 액션 버튼 그룹 */}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                        <Link
                            href={liveHref}
                            className="tap-target inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
                        >
                            <Radio size={18} className="animate-pulse" />
                            <span>{next ? '이 콘티로 예배 입장' : '샘플 예배 체험'}</span>
                            <ArrowRight size={16} />
                        </Link>

                        <Link
                            href="/dashboard/songs"
                            className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                        >
                            <ListMusic size={17} className="text-secondary" />
                            <span>콘티·곡 목록 관리</span>
                        </Link>
                    </div>

                    <p className="text-xs text-muted-foreground/80">
                        * 실시간 큐와 BPM 메트로놈은 같은 브라우저의 2개 이상 탭을 열어두면 즉시 수신 테스트가 가능합니다.
                    </p>
                </div>
            </section>
            )}

            {/* 퀵 액션 카드 (4분할 그리드) */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight text-foreground">
                        빠른 작업
                    </h3>
                    <span className="text-xs text-muted-foreground">자주 쓰는 기능 바로가기</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                        href="/dashboard/songs"
                        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
                    >
                        <div className="space-y-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-transform group-hover:scale-105">
                                <ListMusic size={22} />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground group-hover:text-secondary transition-colors">
                                    콘티 구성
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    곡을 선택하고 순서와 다음 주 템플릿을 만듭니다.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs font-semibold text-secondary">
                            <span>콘티 편집</span>
                            <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                    </Link>

                    <Link
                        href="/dashboard/songs"
                        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
                    >
                        <div className="space-y-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                                <Music size={22} />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                                    곡 라이브러리
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    곡별 BPM 프리셋과 유튜브 송폼을 등록합니다.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs font-semibold text-primary">
                            <span>곡 검색·등록</span>
                            <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                    </Link>

                    <Link
                        href="/dashboard/team"
                        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
                    >
                        <div className="space-y-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-105">
                                <UsersRound size={22} />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground group-hover:text-accent transition-colors">
                                    팀원 초대·역할
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    카카오톡이나 링크로 초대하고 파트를 나눕니다.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs font-semibold text-accent">
                            <span>초대 링크 발급</span>
                            <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                    </Link>

                    <Link
                        href="/dashboard/planning"
                        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
                    >
                        <div className="space-y-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-105">
                                <CalendarDays size={22} />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    일정·인도자 요청
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    연습 일정을 등록하고 콘티 질문을 남깁니다.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <span>일정 확인</span>
                            <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                    </Link>
                </div>
            </div>

            {/* 에러 피드백 */}
            {error && (
                <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
                    {error}
                </div>
            )}

            {/* 예배 전 체크리스트 카드 */}
            <aside className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs sm:p-7">
                <div className="flex items-center gap-2 text-foreground font-bold">
                    <Sparkles size={18} className="text-secondary" />
                    <h3 className="text-base font-bold">예배 전 체크리스트</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                            <p className="text-xs font-bold text-foreground">악보 및 필기 확인</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                손필기와 버튼 표시를 마치면 팀 공유본으로 내보내 팀원에게 전달하세요.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                            <p className="text-xs font-bold text-foreground">BPM & 송폼 점검</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                인트로, 절, 후렴, 브릿지의 마디 수와 템포를 사전에 확인하세요.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                            <p className="text-xs font-bold text-foreground">실시간 큐 수신</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                예배 세션에 입장해 빠름·느림·섹션 큐 알림이 정상적으로 수신되는지 확인하세요.
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
