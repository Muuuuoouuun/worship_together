'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, ChevronUp, Ellipsis, History, LayoutGrid, Lock, LockOpen, Maximize2, Minimize2, MonitorCheck, StickyNote, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import BeatIndicator from '@/components/session/BeatIndicator';
import { AvatarStack, TONE_BLOCK, TONE_ICON } from '@/components/conti/ui';
import {
    CUE_GROUP_LABEL,
    DRAFT_CUES,
    DRAFT_ELAPSED,
    DRAFT_TEAM,
    ROLE_LABEL,
    useMockLive,
    type CueGroup,
    type CueLogEntry,
    type DraftCue,
    type DraftRole,
    type DraftSong,
    type MockLive,
} from './mockLive';
import type { DraftScreenProps } from './types';

/*
 * 데스크톱 A · 악보 무대 (밝은 화면)
 * 모든 팀원이 보는 화면: 가운데 큰 코드 차트, 오른쪽 진행 레일, 위 한 줄 상태, 아래 넘김과 큐.
 */

type Panel = 'more' | 'cues' | 'log' | null;
type CueScope = 'all' | 'mine';

const FLOW_CUES = DRAFT_CUES.filter((cue) => cue.group === 'flow');
const CUE_GROUPS = Object.keys(CUE_GROUP_LABEL) as CueGroup[];
const ROLES = Object.keys(ROLE_LABEL) as DraftRole[];
const ONLINE = DRAFT_TEAM.filter((member) => member.online);
const OFFLINE = DRAFT_TEAM.filter((member) => !member.online);
const BEATS = [1, 2, 3, 4];

function targetLabel(target: DraftRole | 'all') {
    return target === 'all' ? '전체' : ROLE_LABEL[target];
}

/** 섹션이 악보 몇 쪽에 있는지 (useMockLive 의 자동 쪽 넘김과 같은 계산) */
function pageOf(song: DraftSong, index: number) {
    return Math.min(song.pages, Math.floor((index / song.form.length) * song.pages) + 1);
}

/** 바깥 페이지(갤러리)까지 움직이는 scrollIntoView 대신, 주어진 스크롤 영역 안에서만 움직입니다. */
function scrollWithin(container: HTMLElement, top: number, smooth: boolean) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

function cueGroupTargets(group: CueGroup) {
    return Array.from(new Set(DRAFT_CUES.filter((cue) => cue.group === group).map((cue) => targetLabel(cue.target)))).join(' · ');
}

/** 이 화면을 다른 화면 안에 넣어 쓸 때 쓰는 선택 항목 — 모두 비우면 시안 그대로입니다 */
export interface DesktopStageProps extends DraftScreenProps {
    /** 바깥에서 같은 진행 상태를 넘겨줄 때 (없으면 이 화면의 상태) */
    live?: MockLive;
    /** 위 막대의 'BPM · 박자 점' 자리를 바꿉니다 */
    headerBeat?: ReactNode;
    /** 위 막대 오른쪽, 아이콘 버튼들 앞에 넣을 것 (예: 화면 전환) */
    headerActions?: ReactNode;
    /** '인도자 따라가는 중 · 경과 시간'을 숨깁니다 (다른 곳에서 보여 줄 때) */
    hideStatus?: boolean;
    /** 악보 열(위 막대와 아래 막대 사이, 오른쪽 레일 왼쪽) 위에 겹쳐 그릴 층. 화면을 잠가도 눌립니다 */
    stageOverlay?: ReactNode;
    /** 악보를 숨깁니다 — 자리와 스크롤 위치는 그대로 지키고, 보이지도 눌리지도 않습니다 */
    chartHidden?: boolean;
    /**
     * 큐를 보낼 때 함께 부릅니다 (받는 사람은 '전체' · '악기' 같은 이름).
     * 주면 보낸 큐·받은 큐 표시는 바깥 알림이 맡으므로, 이 화면의 보냄 표시(초록 버튼·보냄 알약)와 받은 큐 알약을 그리지 않습니다.
     */
    onSendCue?: (label: string, target: string) => void;
}

export default function DesktopStage({ framed = false, live: sharedLive, headerBeat, headerActions, hideStatus = false, stageOverlay, chartHidden = false, onSendCue }: DesktopStageProps) {
    const ownLive = useMockLive();
    const live = sharedLive ?? ownLive;
    const { song, songs, songIndex, sectionIndex, section, nextSection, nextSong, log, goSection, goSong, nextSectionStep, prevSectionStep, sendCue } = live;
    // 바깥 알림이 보낸 큐를 보여 줄 때는 이 화면의 보냄 표시를 끕니다
    const flash = onSendCue ? null : live.flash;

    const [panel, setPanel] = useState<Panel>(null);
    const [role, setRole] = useState<DraftRole>('instrument');
    const [cueScope, setCueScope] = useState<CueScope>('all');
    const [seenId, setSeenId] = useState<string | null>(null);
    const [freshId, setFreshId] = useState<string | null>(null);
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [locked, setLocked] = useState(false);
    const [railScrolled, setRailScrolled] = useState(false);

    const chartRef = useRef<HTMLDivElement>(null);
    const railRef = useRef<HTMLElement>(null);
    const nowRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLDivElement>(null);
    const cuesRef = useRef<HTMLDivElement>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const wakeRef = useRef<WakeLockSentinel | null>(null);
    const scrolledOnce = useRef(false);
    const pageSync = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** 화면이 스스로 스크롤하는 동안에는 쪽 표시를 스크롤 위치로 덮어쓰지 않게 */
    const syncPausedUntil = useRef(0);

    // 섹션이 바뀌면 악보와 레일을 그 섹션으로 (처음 한 번은 애니메이션 없이)
    useEffect(() => {
        const smooth = scrolledOnce.current;
        scrolledOnce.current = true;
        const chart = chartRef.current;
        const block = chart?.querySelector<HTMLElement>(`[data-section="${sectionIndex}"]`);
        // 쪽의 첫 섹션이면 쪽 구분선까지 함께 보이게
        const group = block?.parentElement;
        const anchor = group && group.firstElementChild !== block && block === group.querySelector('[data-section]') ? group : block;
        if (chart && anchor) {
            syncPausedUntil.current = performance.now() + 700;
            scrollWithin(chart, anchor.offsetTop - (anchor === block ? 12 : 4), smooth);
        }
        const rail = railRef.current;
        const row = rail?.querySelector<HTMLElement>(`[data-form-row="${sectionIndex}"]`);
        if (rail && row) {
            // 위에 붙어 있는 '지금' 블록에 가리지 않게
            const covered = nowRef.current?.offsetHeight ?? 0;
            const top = row.offsetTop;
            const bottom = top + row.offsetHeight;
            if (top < rail.scrollTop + covered || bottom > rail.scrollTop + rail.clientHeight) {
                scrollWithin(rail, top - covered - (rail.clientHeight - covered) / 2, smooth);
            }
        }
    }, [song.id, sectionIndex]);

    // 열린 창 닫기: 바깥 누르기 · Esc
    useEffect(() => {
        if (!panel) return;
        const holder = panel === 'more' ? moreRef : panel === 'cues' ? cuesRef : logRef;
        const onPointer = (event: PointerEvent) => {
            if (!holder.current?.contains(event.target as Node)) setPanel(null);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setPanel(null);
            holder.current?.querySelector<HTMLElement>('[data-trigger]')?.focus();
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [panel]);

    // 한 화면으로 볼 때만: 방향키 · Page Up/Down (페달) 으로 섹션 넘김
    useEffect(() => {
        if (framed) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || panel) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                event.preventDefault();
                nextSectionStep();
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault();
                prevSectionStep();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [framed, panel, nextSectionStep, prevSectionStep]);

    // 실제 전체화면 상태와 맞추기 (갤러리 틀 안에서는 흉내만)
    useEffect(() => {
        if (framed) return;
        const sync = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, [framed]);

    useEffect(() => {
        const sentinel = wakeRef;
        const sync = pageSync;
        return () => {
            void sentinel.current?.release().catch(() => undefined);
            if (sync.current) clearTimeout(sync.current);
        };
    }, []);

    const toggleFullscreen = () => {
        if (framed) {
            setFullscreen((value) => !value);
            return;
        }
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void document.documentElement.requestFullscreen().catch(() => undefined);
    };

    const toggleAwake = async () => {
        if (framed) {
            setAwake((value) => !value);
            return;
        }
        if (awake) {
            await wakeRef.current?.release().catch(() => undefined);
            wakeRef.current = null;
            setAwake(false);
            return;
        }
        try {
            const sentinel = await navigator.wakeLock.request('screen');
            wakeRef.current = sentinel;
            setAwake(true);
            sentinel.addEventListener('release', () => {
                if (wakeRef.current !== sentinel) return;
                wakeRef.current = null;
                setAwake(false);
            });
        } catch {
            setAwake(false);
        }
    };

    const visibleLog = log.filter((entry) => cueScope === 'all' || entry.from === '나' || entry.target === 'all' || entry.target === role);
    const received = visibleLog.find((entry) => entry.from !== '나') ?? null;
    const receivedIsNew = Boolean(received && received.id !== seenId);

    const togglePanel = (next: Exclude<Panel, null>) => {
        setPanel((current) => (current === next ? null : next));
        if (next === 'log' && panel !== 'log') {
            setFreshId(receivedIsNew && received ? received.id : null);
            if (received) setSeenId(received.id);
        }
    };

    const send = (cue: Pick<DraftCue, 'label' | 'target'>) => {
        sendCue(cue);
        onSendCue?.(cue.label, targetLabel(cue.target));
        setPanel(null);
    };

    const goPage = (page: number) => {
        const target = Math.max(1, Math.min(page, song.pages));
        live.setPage(target);
        const chart = chartRef.current;
        const group = chart?.querySelector<HTMLElement>(`[data-page="${target}"]`);
        if (chart && group) {
            syncPausedUntil.current = performance.now() + 700;
            scrollWithin(chart, group.offsetTop - 4, true);
        }
    };

    // 손으로 악보를 스크롤해도 '악보 n / m쪽' 이 화면 맨 위의 쪽을 따라가게
    const onChartScroll = () => {
        if (pageSync.current) return;
        const wait = Math.max(16, syncPausedUntil.current - performance.now());
        pageSync.current = setTimeout(() => {
            pageSync.current = null;
            const chart = chartRef.current;
            if (!chart) return;
            let top = 1;
            chart.querySelectorAll<HTMLElement>('[data-page]').forEach((group) => {
                if (group.offsetTop <= chart.scrollTop + 48) top = Number(group.dataset.page);
            });
            if (top !== live.page) live.setPage(top);
        }, wait);
    };

    const pages = Array.from({ length: song.pages }, (_, index) => index + 1);
    const atStart = songIndex === 0 && sectionIndex === 0;
    const atEnd = !nextSection && !nextSong;

    return (
        <div className="@container relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground" data-framed={framed || undefined}>
            {/* ── 위: 한 줄 상태 ── */}
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border pl-3 pr-4 @min-[1200px]:gap-4 @min-[1200px]:pr-5">
                <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-11 shrink-0 gap-0.5 px-3 text-sm font-medium text-muted-foreground hover:text-foreground has-[>svg]:px-2.5')}>
                    <ChevronLeft className="size-[18px]" />
                    오늘
                </Link>
                <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />

                <div className="flex min-w-0 items-center gap-3">
                    <h2 className="min-w-0 truncate text-[22px] font-semibold tracking-tight">{song.title}</h2>
                    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-2.5 text-sm font-semibold">Key {song.key}</span>
                    {headerBeat ?? <BeatIndicator bpm={live.bpm} enabled>
                        {(activeBeat) => (
                            <span role="img" className="flex shrink-0 items-center gap-2.5" aria-label={`${live.bpm} BPM, ${song.meter}`}>
                                <span className="flex items-baseline gap-1" aria-hidden="true">
                                    <span className="text-[17px] font-semibold tabular-nums">{live.bpm}</span>
                                    <span className="text-xs font-medium text-muted-foreground">BPM</span>
                                </span>
                                <span className="flex items-center gap-1.5" aria-hidden="true">
                                    {BEATS.map((beat) => (
                                        <span
                                            key={beat}
                                            className={cn(
                                                'size-2 rounded-full',
                                                activeBeat === beat ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
                                            )}
                                        />
                                    ))}
                                </span>
                            </span>
                        )}
                    </BeatIndicator>}
                </div>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {songIndex + 1} / {songs.length}곡
                </span>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                    {hideStatus ? null : (
                        <>
                            <span className="mr-2 inline-flex items-center gap-2 text-sm font-medium">
                                <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
                                {role === 'leader' ? '내가 진행 중' : '인도자 따라가는 중'}
                            </span>
                            <span className="mr-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground" title="예배 경과 시간">
                                <Timer className="size-4" aria-hidden="true" />
                                <span className="sr-only">경과 시간</span>
                                <ElapsedClock />
                            </span>
                        </>
                    )}
                    {headerActions}
                    <IconToggle label="화면 꺼짐 방지" pressed={awake} onClick={() => void toggleAwake()}>
                        <MonitorCheck className="size-5" />
                    </IconToggle>
                    <IconToggle label="전체화면" pressed={fullscreen} onClick={toggleFullscreen}>
                        {fullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
                    </IconToggle>
                    <div ref={moreRef} className="relative">
                        <button
                            type="button"
                            data-trigger
                            aria-label="더보기"
                            title="더보기"
                            aria-haspopup="dialog"
                            aria-expanded={panel === 'more'}
                            onClick={() => togglePanel('more')}
                            className={cn(buttonVariants({ variant: panel === 'more' ? 'secondary' : 'ghost', size: 'icon' }), 'relative text-muted-foreground hover:text-foreground')}
                        >
                            <Ellipsis className="size-5" />
                            {OFFLINE.length > 0 ? <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-secondary ring-2 ring-background" /> : null}
                        </button>
                        {panel === 'more' ? (
                            <MorePanel
                                role={role}
                                onRole={setRole}
                                cueScope={cueScope}
                                onCueScope={setCueScope}
                                onLock={() => {
                                    setLocked(true);
                                    setPanel(null);
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            </header>

            <div className="flex min-h-0 flex-1" inert={locked}>
                {/* ── 가운데: 악보 (코드 차트) ── */}
                <section aria-label="악보" className="flex min-w-0 flex-1 flex-col">
                    <div className={cn('flex h-14 shrink-0 items-center justify-between gap-3 pl-9 pr-5 @min-[1200px]:pl-12 @min-[1200px]:pr-7', chartHidden && 'invisible')}>
                        <p className="truncate text-xs font-medium text-muted-foreground">
                            코드 차트 · {song.form.length}섹션 · {song.meter}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                aria-label="이전 쪽"
                                disabled={live.page <= 1}
                                onClick={() => goPage(live.page - 1)}
                                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground hover:text-foreground')}
                            >
                                <ChevronLeft className="size-5" />
                            </button>
                            <span className="min-w-[5.5rem] text-center text-sm font-semibold tabular-nums">
                                악보 {live.page} <span className="font-normal text-muted-foreground">/ {song.pages}쪽</span>
                            </span>
                            <button
                                type="button"
                                aria-label="다음 쪽"
                                disabled={live.page >= song.pages}
                                onClick={() => goPage(live.page + 1)}
                                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground hover:text-foreground')}
                            >
                                <ChevronRight className="size-5" />
                            </button>
                        </div>
                    </div>

                    <div ref={chartRef} onScroll={onChartScroll} className={cn('relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 @min-[1200px]:px-6', chartHidden && 'invisible')}>
                        {pages.map((page) => (
                            <div key={`${song.id}-${page}`} data-page={page}>
                                {page > 1 ? (
                                    <div className="flex items-center gap-3 px-5 pb-2 pt-4 @min-[1200px]:px-6">
                                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{page}쪽</span>
                                        <span aria-hidden="true" className="h-px flex-1 bg-border" />
                                    </div>
                                ) : null}
                                {song.form.map((name, index) =>
                                    pageOf(song, index) === page ? (
                                        <SectionBlock
                                            key={`${song.id}-${index}`}
                                            index={index}
                                            name={name}
                                            lyric={song.lyrics[name]}
                                            chords={song.chords[name] ?? []}
                                            state={index < sectionIndex ? 'past' : index === sectionIndex ? 'current' : index === sectionIndex + 1 ? 'next' : 'later'}
                                            onSelect={() => goSection(index)}
                                        />
                                    ) : null,
                                )}
                            </div>
                        ))}
                        <div className="mx-5 mt-4 flex items-center gap-4 border-t border-border pt-5 @min-[1200px]:mx-6">
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">곡 끝</span>
                            {nextSong ? (
                                <button type="button" onClick={() => goSong(songIndex + 1)} className={cn(buttonVariants({ variant: 'outline' }), 'min-w-0 gap-2 pl-5 pr-3.5')}>
                                    <span className="truncate">다음 곡 · {nextSong.title}</span>
                                    <span className="shrink-0 font-normal text-muted-foreground">
                                        Key {nextSong.key} · {nextSong.bpm}
                                    </span>
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                </button>
                            ) : (
                                <span className="text-sm text-muted-foreground">콘티의 마지막 곡이에요</span>
                            )}
                        </div>
                        {/* 마지막 섹션도 다른 섹션처럼 맨 위 같은 자리까지 올라오게 */}
                        <div aria-hidden="true" className="h-[calc(100%-7rem)]" />
                    </div>
                </section>

                {/* ── 오른쪽: 진행 레일 ── */}
                <aside
                    ref={railRef}
                    aria-label="진행"
                    onScroll={(event) => setRailScrolled(event.currentTarget.scrollTop > 4)}
                    className="relative w-[300px] shrink-0 overflow-y-auto overscroll-contain border-l border-border @min-[1200px]:w-80"
                >
                    <div ref={nowRef} className={cn('sticky top-0 z-10 border-b bg-background px-6 pb-5 pt-6 transition-colors', railScrolled ? 'border-border' : 'border-transparent')}>
                        <p className="text-xs font-medium text-muted-foreground">지금</p>
                        <p
                            className={cn(
                                'mt-2 break-words text-5xl font-semibold leading-[1.02]',
                                // 긴 이름(Pre-Chorus)은 48px 로 한 줄에, 짧은 이름은 넓은 레일에서 56px
                                section.length > 7 ? 'tracking-[-0.035em]' : 'tracking-tight @min-[1200px]:text-[56px]',
                            )}
                        >
                            {section}
                        </p>
                        <p className="mt-2.5 text-sm text-muted-foreground tabular-nums">
                            {sectionIndex + 1} / {song.form.length} 섹션 · {(song.chords[section] ?? []).length}마디
                        </p>
                        <div className="mt-5 flex items-baseline gap-2.5 border-t border-border pt-4">
                            {atEnd ? (
                                <span className="text-sm text-muted-foreground">콘티의 마지막 섹션이에요</span>
                            ) : (
                                <>
                                    <span className="shrink-0 text-sm text-muted-foreground">{nextSection ? '다음' : '다음 곡'}</span>
                                    <span className="min-w-0 truncate text-xl font-semibold tracking-tight">{nextSection ?? nextSong?.title}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {song.note ? (
                        <div className={cn('mx-3 mt-1 rounded-2xl px-3 py-3.5', TONE_BLOCK.peach)}>
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                                <StickyNote className={cn('size-3.5', TONE_ICON.peach)} aria-hidden="true" />
                                곡 메모
                            </p>
                            <p className="mt-1.5 text-[15px] font-medium leading-snug">{song.note}</p>
                        </div>
                    ) : null}

                    <section aria-labelledby="stage-form" className="px-6 pt-7">
                        <div className="flex items-baseline justify-between">
                            <h3 id="stage-form" className="text-[15px] font-semibold tracking-tight">
                                송폼
                            </h3>
                            <span className="text-xs text-muted-foreground">눌러서 이동</span>
                        </div>
                        <ol className="mt-1.5 divide-y divide-border">
                            {song.form.map((name, index) => {
                                const current = index === sectionIndex;
                                const past = index < sectionIndex;
                                return (
                                    <li key={`${song.id}-row-${index}`}>
                                        <button
                                            type="button"
                                            data-form-row={index}
                                            aria-current={current ? 'step' : undefined}
                                            onClick={() => goSection(index)}
                                            className="-mx-2 flex h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left text-[15px] outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                                        >
                                            <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                            <span className={cn('min-w-0 flex-1 truncate', current ? 'font-semibold' : 'font-medium', past && 'text-muted-foreground')}>{name}</span>
                                            {current ? (
                                                <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">지금</span>
                                            ) : index === sectionIndex + 1 ? (
                                                <span className="text-xs font-semibold text-foreground">다음</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground tabular-nums">{(song.chords[name] ?? []).length}마디</span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>

                    <section aria-labelledby="stage-setlist" className="px-6 pb-8 pt-7">
                        <div className="flex items-baseline justify-between">
                            <h3 id="stage-setlist" className="text-[15px] font-semibold tracking-tight">
                                콘티 순서
                            </h3>
                            <span className="text-xs text-muted-foreground">{songs.length}곡</span>
                        </div>
                        <ol className="mt-1.5 divide-y divide-border">
                            {songs.map((item, index) => {
                                const current = index === songIndex;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            aria-current={current ? 'true' : undefined}
                                            onClick={() => goSong(index)}
                                            className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                                        >
                                            <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className={cn('block truncate text-[15px] font-semibold', index < songIndex && 'text-muted-foreground')}>{item.title}</span>
                                                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                                                    Key {item.key} · {item.bpm} BPM · {item.meter}
                                                </span>
                                            </span>
                                            {current ? (
                                                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand">
                                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                                                    진행 중
                                                </span>
                                            ) : index < songIndex ? (
                                                <span className="shrink-0 text-xs text-muted-foreground">마침</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                </aside>
            </div>

            {/* ── 아래: 넘김과 큐 (잠그면 잠금 해제만, 받은 큐는 계속 보임) ── */}
            <footer className="flex h-[76px] shrink-0 items-center gap-2 border-t border-border px-4 @min-[1200px]:gap-3 @min-[1200px]:px-5">
                {locked ? (
                    <div className="flex min-w-0 items-center gap-4">
                        <button type="button" autoFocus onClick={() => setLocked(false)} className={cn(buttonVariants({ size: 'lg' }), 'h-12 shrink-0 px-6')}>
                            <LockOpen className="size-4" />
                            잠금 해제
                        </button>
                        <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="shrink-0 font-semibold">화면 잠김</span>
                            <span className="truncate text-muted-foreground">실수로 눌러도 넘어가지 않아요</span>
                        </span>
                    </div>
                ) : (
                    <>
                        <button type="button" onClick={prevSectionStep} disabled={atStart} aria-label="이전 섹션" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 shrink-0 px-3.5 @min-[1200px]:px-5')}>
                            <ChevronLeft className="size-5" />
                            <span className="hidden @min-[1200px]:inline">이전 섹션</span>
                        </button>
                        <button
                            type="button"
                            onClick={nextSectionStep}
                            disabled={atEnd}
                            className={cn(buttonVariants({ size: 'lg' }), 'h-12 min-w-36 max-w-60 shrink-0 gap-2 has-[>svg]:pl-6 has-[>svg]:pr-4')}
                        >
                            {atEnd ? (
                                <span className="flex-1 text-left">콘티 끝</span>
                            ) : (
                                <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                                    <span className="shrink-0 text-sm font-medium opacity-60">{nextSection ? '다음' : '다음 곡'}</span>
                                    <span className="truncate">{nextSection ?? nextSong?.title}</span>
                                </span>
                            )}
                            <ChevronRight className="size-5" />
                        </button>

                        <span aria-hidden="true" className="mx-1.5 h-8 w-px shrink-0 bg-border" />

                        <div ref={cuesRef} className="relative flex shrink-0 items-center gap-2">
                            <span className="mr-1 flex shrink-0 flex-col text-xs leading-tight">
                                <span className="font-semibold">큐 보내기</span>
                                <span className="text-muted-foreground">전체에게</span>
                            </span>
                            {FLOW_CUES.map((cue) => {
                                const justSent = flash?.label === cue.label && flash.target === cue.target;
                                return (
                                    <button
                                        key={cue.id}
                                        type="button"
                                        onClick={() => send(cue)}
                                        className={cn(buttonVariants({ variant: justSent ? 'brand' : 'outline' }), 'shrink-0 px-4 has-[>svg]:px-3.5')}
                                    >
                                        {justSent ? <Check className="size-4" /> : null}
                                        {cue.label}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                data-trigger
                                aria-haspopup="dialog"
                                aria-expanded={panel === 'cues'}
                                onClick={() => togglePanel('cues')}
                                className={cn(buttonVariants({ variant: panel === 'cues' ? 'default' : 'secondary' }), 'shrink-0 px-4 has-[>svg]:px-3.5')}
                            >
                                <LayoutGrid className="size-4" />
                                큐 더보기
                            </button>
                            {panel === 'cues' ? <CuePanel flash={flash} onSend={send} onClose={() => setPanel(null)} /> : null}
                        </div>
                    </>
                )}

                <div ref={logRef} className="relative ml-auto flex min-w-0 justify-end">
                    <p className="sr-only" aria-live="polite">
                        {flash ? `보냄: ${flash.label}, ${targetLabel(flash.target)}에게` : ''}
                    </p>
                    {flash ? (
                        <span className="inline-flex h-11 min-w-0 items-center gap-2 rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand">
                            <Check className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                                보냄 <span className="hidden @min-[1200px]:inline">· {flash.label} </span>→ {targetLabel(flash.target)}
                            </span>
                        </span>
                    ) : received && !onSendCue ? (
                        <button
                            type="button"
                            data-trigger
                            aria-haspopup="dialog"
                            aria-expanded={panel === 'log'}
                            aria-label={`${receivedIsNew ? '새 큐' : '받은 큐'} ${received.label}, ${received.from}, ${received.at}. 큐 기록 보기`}
                            onClick={() => togglePanel('log')}
                            className={cn(
                                'inline-flex h-11 min-w-0 max-w-[22rem] items-center @min-[1360px]:max-w-[28rem] gap-2.5 rounded-full bg-muted pl-4 pr-3.5 text-[15px] outline-none transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring',
                                panel === 'log' && 'ring-1 ring-border',
                            )}
                        >
                            <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', receivedIsNew ? 'bg-secondary' : 'bg-muted-foreground/40')} />
                            <span className="min-w-0 truncate font-semibold">{received.label}</span>
                            <span className="hidden shrink-0 text-sm text-muted-foreground @min-[1200px]:inline">
                                · {received.from} · {received.at}
                            </span>
                            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                    ) : visibleLog.length > 0 ? (
                        <button
                            type="button"
                            data-trigger
                            aria-haspopup="dialog"
                            aria-expanded={panel === 'log'}
                            onClick={() => togglePanel('log')}
                            className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground hover:text-foreground')}
                        >
                            <History className="size-4" />
                            큐 기록
                        </button>
                    ) : null}
                    {panel === 'log' ? <LogPanel entries={visibleLog} freshId={freshId} /> : null}
                </div>
            </footer>

            {stageOverlay ? <div className="absolute bottom-[76px] left-0 right-[300px] top-16 z-20 @min-[1200px]:right-80">{stageOverlay}</div> : null}
        </div>
    );
}

/* ───────────────────────── 악보 블록 ───────────────────────── */

type SectionState = 'past' | 'current' | 'next' | 'later';

function SectionBlock({ index, name, lyric, chords, state, onSelect }: { index: number; name: string; lyric?: string; chords: string[]; state: SectionState; onSelect: () => void }) {
    const current = state === 'current';
    return (
        <button
            type="button"
            data-section={index}
            aria-current={current ? 'step' : undefined}
            onClick={onSelect}
            className={cn(
                'flex w-full items-start gap-6 rounded-3xl px-5 py-4 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring @min-[1200px]:gap-8 @min-[1200px]:px-6',
                current ? 'bg-muted' : 'hover:bg-muted/50',
            )}
        >
            <span className="block w-36 shrink-0 pt-3 @min-[1200px]:w-52 @min-[1360px]:w-60">
                <span className="flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            'inline-flex h-8 items-center rounded-full px-3.5 text-[15px] font-semibold',
                            current ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                            state === 'past' && 'text-muted-foreground',
                        )}
                    >
                        {name}
                    </span>
                    {state === 'next' ? <span className="inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ring-1 ring-border ring-inset">다음</span> : null}
                </span>
                {lyric ? <span className={cn('mt-2 block text-balance break-keep text-sm leading-snug', current ? 'text-foreground/75' : 'text-muted-foreground')}>{lyric}</span> : null}
            </span>
            <span
                className={cn(
                    'grid min-w-0 flex-1 grid-cols-4 gap-y-2 text-[26px] font-semibold tracking-tight @min-[1200px]:text-[28px] @min-[1360px]:text-[32px]',
                    state === 'past' ? 'text-muted-foreground' : current ? 'text-foreground' : 'text-foreground/80',
                )}
            >
                {chords.map((chord, bar) => (
                    <span key={bar} className={cn('flex h-14 min-w-0 items-center gap-2.5 border-r border-foreground/15 px-3 @min-[1200px]:px-4', bar % 4 === 0 && 'border-l')}>
                        {chord.split(' ').map((symbol, part) => (
                            <ChordSymbol key={part} symbol={symbol} />
                        ))}
                    </span>
                ))}
            </span>
        </button>
    );
}

/** 근음은 크게, 올림·내림표는 작게 위로, 성질(m7, sus4)과 베이스음(/C#)은 작게 */
function ChordSymbol({ symbol }: { symbol: string }) {
    const match = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
    if (!match) return <span>{symbol}</span>;
    const [, root, accidental, quality, bass] = match;
    return (
        <span className="whitespace-nowrap leading-none">
            {root}
            {accidental ? <span className="relative -top-[0.42em] ml-[0.04em] text-[0.58em]">{accidental}</span> : null}
            {quality ? <span className="text-[0.64em]">{quality}</span> : null}
            {bass ? <span className="text-[0.64em] opacity-70">/{bass}</span> : null}
        </span>
    );
}

/* ───────────────────────── 작은 부품 ───────────────────────── */

function IconToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(buttonVariants({ variant: pressed ? 'default' : 'ghost', size: 'icon' }), !pressed && 'text-muted-foreground hover:text-foreground')}
        >
            {children}
        </button>
    );
}

function toSeconds(value: string) {
    const [minutes, seconds] = value.split(':').map(Number);
    return minutes * 60 + seconds;
}

/** 예배 경과 시간 — 1초마다 이 작은 부분만 다시 그립니다. */
function ElapsedClock() {
    const [seconds, setSeconds] = useState(() => toSeconds(DRAFT_ELAPSED));
    useEffect(() => {
        const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const minutes = Math.floor(seconds / 60);
    return (
        <span className="tabular-nums">
            {minutes}:{String(seconds % 60).padStart(2, '0')}
        </span>
    );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
    return (
        <div role="radiogroup" aria-label={label} className="mt-2 flex rounded-full bg-muted p-1">
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'h-9 min-w-0 flex-1 truncate rounded-full px-2 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                            active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

const popover = 'absolute z-40 rounded-3xl bg-card text-left text-card-foreground shadow-xl ring-1 ring-border';

function MorePanel({ role, onRole, cueScope, onCueScope, onLock }: { role: DraftRole; onRole: (role: DraftRole) => void; cueScope: CueScope; onCueScope: (scope: CueScope) => void; onLock: () => void }) {
    return (
        <div role="dialog" aria-label="더보기" className={cn(popover, 'right-0 top-full mt-2.5 w-80 p-5')}>
            <p className="text-xs font-medium text-muted-foreground">내 역할</p>
            <Segmented label="내 역할" value={role} options={ROLES.map((item) => ({ value: item, label: ROLE_LABEL[item] }))} onChange={onRole} />

            <p className="mt-5 text-xs font-medium text-muted-foreground">큐 받을 대상</p>
            <Segmented
                label="큐 받을 대상"
                value={cueScope}
                options={[
                    { value: 'all', label: '모든 큐' },
                    { value: 'mine', label: '내 역할 큐만' },
                ]}
                onChange={onCueScope}
            />
            <p className="mt-2 text-xs text-muted-foreground">{cueScope === 'all' ? '모든 역할에게 간 큐를 함께 봐요' : `${ROLE_LABEL[role]} 큐와 전체 큐만 알려요`}</p>

            <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                        팀 접속 <span className="font-normal text-muted-foreground tabular-nums">{ONLINE.length}/{DRAFT_TEAM.length}</span>
                    </p>
                    <AvatarStack names={ONLINE.map((member) => member.name)} max={4} size="xs" />
                </div>
                {OFFLINE.map((member) => (
                    <p key={member.name} className="mt-2.5 flex items-center gap-2 text-sm">
                        <span aria-hidden="true" className="size-2 rounded-full bg-secondary" />
                        <span className="font-medium">{member.name}</span>
                        <span className="text-muted-foreground">
                            {member.part} · 연결 끊김
                        </span>
                    </p>
                ))}
            </div>

            <div className="mt-4 border-t border-border pt-2">
                <button
                    type="button"
                    onClick={onLock}
                    className="-mx-2 flex h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    <Lock className="size-[18px] text-muted-foreground" aria-hidden="true" />
                    화면 잠금
                    <span className="ml-auto text-xs font-normal text-muted-foreground">잘못 누르지 않게</span>
                </button>
            </div>
        </div>
    );
}

function CuePanel({ flash, onSend, onClose }: { flash: CueLogEntry | null; onSend: (cue: DraftCue) => void; onClose: () => void }) {
    return (
        <div role="dialog" aria-label="큐 보내기" className={cn(popover, 'bottom-full left-0 mb-4 w-[34rem] p-5')}>
            <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold tracking-tight">큐 보내기</p>
                <button type="button" aria-label="닫기" onClick={onClose} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-muted-foreground')}>
                    <X className="size-4" />
                </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-5">
                {CUE_GROUPS.map((group) => (
                    <div key={group}>
                        <p className="text-xs font-medium text-muted-foreground">
                            {CUE_GROUP_LABEL[group]} <span className="text-muted-foreground/70">→ {cueGroupTargets(group)}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {DRAFT_CUES.filter((cue) => cue.group === group).map((cue) => {
                                const justSent = flash?.label === cue.label;
                                return (
                                    <button key={cue.id} type="button" onClick={() => onSend(cue)} className={cn(buttonVariants({ variant: justSent ? 'brand' : 'outline', size: 'sm' }), 'h-10 px-4 text-sm')}>
                                        {cue.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LogPanel({ entries, freshId }: { entries: CueLogEntry[]; freshId: string | null }) {
    return (
        <div role="dialog" aria-label="큐 기록" className={cn(popover, 'bottom-full right-0 mb-4 w-80 px-5 pb-3 pt-5')}>
            <p className="text-[15px] font-semibold tracking-tight">큐 기록</p>
            <ol className="mt-2 divide-y divide-border">
                {entries.map((entry) => {
                    const mine = entry.from === '나';
                    return (
                        <li key={entry.id} className="flex items-start gap-3 py-3">
                            <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', mine ? 'bg-brand' : entry.id === freshId ? 'bg-secondary' : 'bg-muted-foreground/40')} />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-snug">{entry.label}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {mine ? '내가 보냄' : entry.from} → {targetLabel(entry.target)}
                                </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{entry.at}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
