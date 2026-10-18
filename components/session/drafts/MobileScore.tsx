'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
    Activity,
    ArrowDown,
    ArrowUp,
    Check,
    ChevronLeft,
    ChevronRight,
    Ellipsis,
    Lock,
    LockOpen,
    Maximize2,
    Megaphone,
    StickyNote,
    Sun,
    UsersRound,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import BeatIndicator from '@/components/session/BeatIndicator';
import { AvatarStack, TONE_BLOCK, TONE_ICON } from '@/components/conti/ui';
import {
    CUE_GROUP_LABEL,
    DRAFT_CUES,
    DRAFT_ELAPSED,
    DRAFT_SERVICE,
    DRAFT_TEAM,
    ROLE_LABEL,
    useMockLive,
    type CueGroup,
    type CueLogEntry,
    type DraftRole,
    type MockLive,
} from './mockLive';
import type { DraftScreenProps } from './types';

/*
 * 모바일 B · 악보 우선 (무대용 어두운 화면)
 * 화면 전체가 코드 차트. 위 막대에는 곡 · 키 · 박자 점 · 악보 쪽, 아래 막대에는 넘김과 시트 버튼만 둡니다.
 * 송폼 · 콘티 순서와 큐 보내기, 기기 설정은 아래에서 올라오는 시트로 엽니다.
 */

type SheetKind = 'order' | 'cue' | 'more';
type OrderTab = 'form' | 'setlist';

const CUE_GROUPS = Object.keys(CUE_GROUP_LABEL) as CueGroup[];
/** 시트 안 큐 종류 알약은 한 줄에 들어가도록 짧게 (전체 이름은 aria-label 로) */
const CUE_GROUP_SHORT: Record<CueGroup, string> = { flow: '흐름', tempo: '템포', sound: '음향', band: '반주', media: '미디어' };
const ONLINE = DRAFT_TEAM.filter((member) => member.online);
const OFFLINE = DRAFT_TEAM.filter((member) => !member.online);

const targetLabel = (target: DraftRole | 'all') => (target === 'all' ? '전체' : ROLE_LABEL[target]);

/** 큐를 받는 사람 (접속 중인 팀원 기준) */
function recipients(target: DraftRole | 'all') {
    const members = DRAFT_TEAM.filter((member) => target === 'all' || member.role === target);
    return { online: members.filter((member) => member.online).length, offline: members.filter((member) => !member.online) };
}

const iconTile = 'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground';
/** buttonVariants 를 쓰지 않는 누름 영역(악보 섹션, 시트의 줄, 알약)에도 같은 초점 표시 */
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring';
/** 흰 알약·스위치처럼 링과 같은 색인 요소는 틈을 두고 (시트 바탕색) */
const focusRingOffset = cn(focusRing, 'focus-visible:ring-offset-2 focus-visible:ring-offset-card');

export default function MobileScore({ framed = false, alt = false }: DraftScreenProps) {
    const live = useMockLive();
    const rootRef = useRef<HTMLDivElement>(null);
    const [sheet, setSheet] = useState<SheetKind | null>(alt ? 'order' : null);
    /** 사용자가 직접 연 시트에만 초점을 옮깁니다 (처음부터 열린 alt 화면은 페이지를 움직이지 않도록). */
    const [sheetFocus, setSheetFocus] = useState(false);
    const [orderTab, setOrderTab] = useState<OrderTab>('form');
    const [locked, setLocked] = useState(false);
    const [awake, setAwake] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [beatOn, setBeatOn] = useState(true);
    const [myRole, setMyRole] = useState<DraftRole>('instrument');
    const [dismissedCue, setDismissedCue] = useState<string | null>(null);

    const { nextSectionStep, prevSectionStep } = live;

    /* 시트를 연 버튼을 기억했다가 닫으면 초점을 돌려줍니다 (시트가 열리면 뒤 화면이 inert 가 되어 초점이 풀리므로 미리 저장) */
    const openerRef = useRef<HTMLElement | null>(null);
    const openSheet = (kind: SheetKind) => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSheetFocus(true);
        setSheet(kind);
    };
    const closeSheet = useCallback(() => {
        setSheet(null);
        const opener = openerRef.current;
        openerRef.current = null;
        if (opener) requestAnimationFrame(() => opener.isConnected && opener.focus({ preventScroll: true }));
    }, []);

    /* 기기 동작: 갤러리 틀 안(framed)에서는 화면 상태만 바꾸고, 단독 화면에서만 실제 브라우저 기능을 씁니다. */
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    const toggleFullscreen = useCallback(() => {
        if (framed || typeof document === 'undefined' || !document.fullscreenEnabled) {
            setFullscreen((value) => !value);
            return;
        }
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void rootRef.current?.requestFullscreen().catch(() => undefined);
    }, [framed]);

    useEffect(() => {
        if (framed) return;
        const sync = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, [framed]);

    useEffect(() => {
        if (framed || !awake || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
        let cancelled = false;
        navigator.wakeLock
            .request('screen')
            .then((sentinel) => {
                if (cancelled) void sentinel.release();
                else wakeLock.current = sentinel;
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
            void wakeLock.current?.release().catch(() => undefined);
            wakeLock.current = null;
        };
    }, [awake, framed]);

    /* 단독 화면: ← → 키와 페달(PageUp/PageDown)로 섹션 넘김 */
    useEffect(() => {
        if (framed) return;
        const onKey = (event: KeyboardEvent) => {
            if (locked || sheet || event.altKey || event.metaKey || event.ctrlKey) return;
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
    }, [framed, locked, sheet, nextSectionStep, prevSectionStep]);

    const latest = live.log[0] ?? null;
    const incoming = latest && latest.from !== '나' && latest.id !== dismissedCue ? latest : null;

    return (
        <div ref={rootRef} className="dark relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground [color-scheme:dark]">
            {/* 시트가 열려 있으면 뒤의 악보는 어둡게 보이기만 하고 누를 수 없습니다 */}
            <div className="flex min-h-0 flex-1 flex-col" inert={sheet !== null}>
                <TopBar live={live} beatOn={beatOn} locked={locked} onMore={() => openSheet('more')} />

                {incoming && !live.flash ? <IncomingCue entry={incoming} onDismiss={() => setDismissedCue(incoming.id)} /> : null}

                <ScoreChart live={live} locked={locked} />

                <BottomBar live={live} locked={locked} onOrder={() => openSheet('order')} onCue={() => openSheet('cue')} onUnlock={() => setLocked(false)} />
            </div>

            <SentFlash flash={live.flash} />

            {sheet === 'order' ? (
                <Sheet title="송폼 · 순서" hideTitle focusOnOpen={sheetFocus} onClose={closeSheet}>
                    {(titleId) => <OrderSheet titleId={titleId} live={live} tab={orderTab} onTab={setOrderTab} onDone={closeSheet} />}
                </Sheet>
            ) : null}

            {sheet === 'cue' ? (
                <Sheet title="큐 보내기" eyebrow={`${live.song.title} · ${live.section}`} tall focusOnOpen={sheetFocus} onClose={closeSheet}>
                    {() => <CueSheet live={live} onSent={closeSheet} />}
                </Sheet>
            ) : null}

            {sheet === 'more' ? (
                <Sheet
                    title="더보기"
                    eyebrow={
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                            {DRAFT_SERVICE.title} · {DRAFT_ELAPSED} 진행 중
                        </span>
                    }
                    tall
                    focusOnOpen={sheetFocus}
                    onClose={closeSheet}
                >
                    {() => (
                        <MoreSheet
                            awake={awake}
                            onAwake={() => setAwake((value) => !value)}
                            fullscreen={fullscreen}
                            onFullscreen={toggleFullscreen}
                            beatOn={beatOn}
                            onBeat={() => setBeatOn((value) => !value)}
                            myRole={myRole}
                            onRole={setMyRole}
                            onLock={() => {
                                setLocked(true);
                                closeSheet();
                            }}
                        />
                    )}
                </Sheet>
            ) : null}
        </div>
    );
}

/* ───────────── 위 막대 ───────────── */

function TopBar({ live, beatOn, locked, onMore }: { live: MockLive; beatOn: boolean; locked: boolean; onMore: () => void }) {
    const { song } = live;
    return (
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border pl-1 pr-1">
            <Link href="/session/drafts" aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                <ChevronLeft className="size-5" />
            </Link>

            <div className="flex min-w-0 flex-1 items-center gap-2">
                <h2 className="truncate text-[18px] font-semibold tracking-tight">{song.title}</h2>
                <span aria-label={`키 ${song.key}`} className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold">
                    {song.key}
                </span>
            </div>

            <BeatIndicator bpm={live.bpm} enabled={beatOn}>
                {(activeBeat, blink) => (
                    <span className="flex shrink-0 items-center gap-1.5 pl-1" aria-label={`템포 ${live.bpm} BPM`}>
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-2.5 rounded-full transition-colors duration-75',
                                !beatOn && 'bg-muted',
                                beatOn && blink && activeBeat === 1 && 'bg-brand',
                                beatOn && blink && activeBeat !== 1 && 'bg-foreground',
                                beatOn && !blink && 'bg-foreground/15',
                            )}
                        />
                        {/* 단위는 숫자 아래 작은 줄로 — 옆에 붙이면 360px 에서 곡 제목이 잘립니다 */}
                        <span aria-hidden="true" className="flex flex-col items-center">
                            <span className="text-[15px] font-semibold leading-none tabular-nums">{live.bpm}</span>
                            <span className="mt-1 text-[10px] font-semibold leading-none tracking-wide text-muted-foreground">BPM</span>
                        </span>
                    </span>
                )}
            </BeatIndicator>

            <span className="shrink-0 pl-2 text-[13px] tabular-nums text-muted-foreground" aria-label={`악보 ${live.page}/${song.pages}쪽`}>
                {live.page}/{song.pages}쪽
            </span>

            {locked ? (
                <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground" role="img" aria-label="화면 잠김">
                    <Lock className="size-[18px]" />
                </span>
            ) : (
                <button type="button" aria-label="더보기" onClick={onMore} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                    <Ellipsis className="size-5" />
                </button>
            )}
        </header>
    );
}

/* ───────────── 받은 큐 · 보낸 큐 확인 ───────────── */

function IncomingCue({ entry, onDismiss }: { entry: CueLogEntry; onDismiss: () => void }) {
    return (
        <div className="shrink-0 px-3 pt-2">
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-card py-1 pl-4 pr-1 ring-1 ring-border">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" />
                <p className="min-w-0 flex-1 truncate text-[15px]">
                    <span className="font-semibold">{entry.label}</span>
                    <span className="text-muted-foreground">
                        {' '}
                        · {entry.from} → {targetLabel(entry.target)} · {entry.at}
                    </span>
                </p>
                <button type="button" aria-label="받은 큐 닫기" onClick={onDismiss} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                    <X className="size-[18px]" />
                </button>
            </div>
        </div>
    );
}

/** 방금 보낸 큐를 2초 동안 보여 주는 확인 (아래 막대 바로 위에 뜹니다) */
function SentFlash({ flash }: { flash: CueLogEntry | null }) {
    const people = flash ? recipients(flash.target) : null;
    return (
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[calc(4.5rem+max(0.75rem,env(safe-area-inset-bottom)))] z-10 flex justify-center px-4">
            {flash && people ? (
                <p className="flex max-w-full items-center gap-2.5 rounded-full bg-primary py-2 pl-2 pr-4 text-[15px] text-primary-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                        <Check className="size-4" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 truncate">
                        <span className="font-semibold">{flash.label}</span> {targetLabel(flash.target)} {people.online}명에게 보냈어요
                    </span>
                </p>
            ) : null}
        </div>
    );
}

/* ───────────── 코드 차트 ───────────── */

function ScoreChart({ live, locked }: { live: MockLive; locked: boolean }) {
    const { song, songIndex, sectionIndex, nextSong, goSection, goSong } = live;
    const scrollRef = useRef<HTMLDivElement>(null);
    const firstScroll = useRef(true);
    /** 화면이 스스로 스크롤하는 동안에는 '지금 섹션으로' 알약을 띄우지 않습니다 */
    const autoUntil = useRef(0);
    /** 손으로 악보를 넘겨 보다가 지금 섹션이 화면 밖으로 나갔을 때 그 방향 */
    const [away, setAway] = useState<'up' | 'down' | null>(null);
    const isLastSection = sectionIndex === song.form.length - 1;

    const currentBlock = useCallback(() => scrollRef.current?.querySelector<HTMLElement>(`[data-section="${sectionIndex}"]`) ?? null, [sectionIndex]);

    /* 현재 섹션을 화면 위쪽으로 (다음 섹션이 아래에 보이도록) */
    const scrollToCurrent = useCallback(
        (smooth: boolean) => {
            const container = scrollRef.current;
            const target = currentBlock();
            if (!container || !target) return;
            const top = sectionIndex === 0 ? 0 : target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
            autoUntil.current = performance.now() + (smooth ? 700 : 50);
            container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
        },
        [currentBlock, sectionIndex],
    );

    const measure = useCallback(() => {
        const container = scrollRef.current;
        const target = currentBlock();
        if (!container || !target) return;
        if (performance.now() < autoUntil.current) {
            setAway(null);
            return;
        }
        const box = container.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        /* 섹션이 거의 다 가려졌을 때만 (한 줄 남짓 보이는 정도) */
        setAway(rect.bottom < box.top + 72 ? 'up' : rect.top > box.bottom - 72 ? 'down' : null);
    }, [currentBlock]);

    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrollToCurrent(!firstScroll.current && !reduce);
        firstScroll.current = false;
        const settle = window.setTimeout(measure, 760);
        return () => window.clearTimeout(settle);
    }, [songIndex, sectionIndex, scrollToCurrent, measure]);

    const showJump = away !== null && !live.flash;
    const JumpIcon = away === 'up' ? ArrowUp : ArrowDown;

    return (
        <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} role="region" aria-label={`${song.title} 코드 악보`} onScroll={measure} className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain">
                <div className="px-3 pb-28 pt-3">
                    <div className="px-3 pb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                            {songIndex + 1} / {live.songs.length}곡 · {song.meter} · 송폼 {song.form.length}
                        </p>
                        {song.note ? (
                            <p className={cn('mt-2.5 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug', TONE_BLOCK.peach)}>
                                <StickyNote aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', TONE_ICON.peach)} />
                                {song.note}
                            </p>
                        ) : null}
                    </div>

                    <ol className="space-y-1">
                        {song.form.map((name, index) => {
                            const current = index === sectionIndex;
                            const next = index === sectionIndex + 1;
                            const past = index < sectionIndex;
                            const chords = song.chords[name] ?? [];
                            return (
                                <li key={`${name}-${index}`} data-section={index}>
                                    <button
                                        type="button"
                                        disabled={locked}
                                        aria-current={current ? 'step' : undefined}
                                        onClick={() => goSection(index)}
                                        className={cn(
                                            'block w-full rounded-3xl px-3 py-4 text-left transition-colors disabled:cursor-default',
                                            focusRing,
                                            current ? 'bg-muted/60 ring-1 ring-border' : 'hover:bg-muted/30',
                                        )}
                                    >
                                        <span className="flex min-h-8 items-center gap-2">
                                            {current ? (
                                                <span className="inline-flex h-[52px] items-center rounded-full bg-primary px-5 text-[36px] font-semibold leading-none tracking-tight text-primary-foreground">
                                                    {name}
                                                </span>
                                            ) : (
                                                <span className={cn('text-[17px] font-semibold tracking-tight', past ? 'text-foreground/45' : 'text-foreground/75')}>{name}</span>
                                            )}
                                            {next ? <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-foreground">다음</span> : null}
                                            <span className="ml-auto pr-1 text-xs tabular-nums text-muted-foreground">
                                                {index + 1}/{song.form.length}
                                            </span>
                                        </span>
                                        {song.lyrics[name] ? (
                                            <span
                                                className={cn(
                                                    'mt-2 block truncate',
                                                    current ? 'text-[16px] text-foreground/85' : 'text-[14px] text-muted-foreground',
                                                    past && 'opacity-70',
                                                )}
                                            >
                                                {song.lyrics[name]}
                                            </span>
                                        ) : null}
                                        <ChordBars chords={chords} current={current} past={past} />
                                    </button>
                                </li>
                            );
                        })}
                    </ol>

                    <div className="mx-3 mt-5 border-t border-border pt-2">
                        {nextSong ? (
                            <button
                                type="button"
                                disabled={locked}
                                aria-label={`다음 곡으로: ${nextSong.title}, Key ${nextSong.key} · ${nextSong.bpm} BPM`}
                                onClick={() => goSong(songIndex + 1)}
                                className={cn('-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/30 disabled:cursor-default', focusRing)}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-muted-foreground">다음 곡</span>
                                    <span className={cn('mt-1 block truncate text-[17px] font-semibold tracking-tight', isLastSection ? 'text-foreground' : 'text-foreground/75')}>{nextSong.title}</span>
                                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                                        Key {nextSong.key} · {nextSong.bpm} BPM · {nextSong.meter}
                                    </span>
                                </span>
                                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                            </button>
                        ) : (
                            <p className="py-2.5 text-[13px] text-muted-foreground">마지막 곡이에요</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 손으로 넘겨 보다가 지금 섹션을 놓쳤을 때만 나타나는 되돌아가기 */}
            {showJump ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[5] flex justify-center px-4">
                    <button
                        type="button"
                        onClick={() => {
                            scrollToCurrent(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
                            /* 알약이 사라지므로 초점은 지금 섹션으로 */
                            currentBlock()?.querySelector('button')?.focus({ preventScroll: true });
                        }}
                        className={cn(buttonVariants({ variant: 'outline' }), 'pointer-events-auto h-11 gap-1.5 pl-3.5 pr-4 text-[15px] shadow-lg animate-in fade-in duration-150')}
                    >
                        <JumpIcon className="size-[18px] text-muted-foreground" />
                        지금 {live.section}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

/** 한 줄에 네 마디. 마디 안에 코드가 둘이면 나란히 (좁으면 두 줄로) */
function ChordBars({ chords, current, past }: { chords: string[]; current: boolean; past: boolean }) {
    if (chords.length === 0) return null;
    return (
        <span className="mt-3 grid grid-cols-4 gap-y-2">
            {chords.map((bar, index) => (
                <span
                    key={index}
                    className={cn(
                        'flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 border-l py-1 pl-2.5 text-[22px] font-semibold leading-tight tracking-tight',
                        index % 4 === 3 && 'border-r',
                        current ? 'border-foreground/25 text-foreground' : 'border-border',
                        !current && (past ? 'text-foreground/40' : 'text-foreground/65'),
                    )}
                >
                    {/* 마디 안 두 번째 코드는 오른쪽으로 — 좁아서 줄이 바뀌면 나눈 마디처럼 오른쪽 아래에 */}
                    {bar.split(' ').map((chord, chordIndex) => (
                        <span key={chordIndex} className={cn(chordIndex > 0 && 'ml-auto pr-2')}>
                            {chord}
                        </span>
                    ))}
                </span>
            ))}
        </span>
    );
}

/* ───────────── 아래 막대 ───────────── */

function BottomBar({ live, locked, onOrder, onCue, onUnlock }: { live: MockLive; locked: boolean; onOrder: () => void; onCue: () => void; onUnlock: () => void }) {
    const { song, songIndex, sectionIndex, nextSection, nextSong } = live;
    const atStart = songIndex === 0 && sectionIndex === 0;
    const atEnd = !nextSection && !nextSong;
    const nextLabel = nextSection ? `다음 섹션: ${nextSection}` : nextSong ? `다음 곡: ${nextSong.title}` : '마지막 섹션';
    const prevLabel = sectionIndex > 0 ? `이전 섹션: ${song.form[sectionIndex - 1]}` : '이전 곡의 마지막 섹션';

    return (
        <nav aria-label="악보 넘김" className="shrink-0 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {locked ? (
                <button type="button" onClick={onUnlock} className={cn(buttonVariants({ variant: 'outline' }), 'h-14 w-full text-[15px]')}>
                    <LockOpen className="size-[18px]" />
                    잠금 해제
                </button>
            ) : (
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem_minmax(0,1.15fr)] gap-2">
                    <button
                        type="button"
                        aria-label={prevLabel}
                        disabled={atStart}
                        onClick={live.prevSectionStep}
                        className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'size-14')}
                    >
                        <ChevronLeft className="size-6" />
                    </button>
                    <button type="button" aria-haspopup="dialog" onClick={onOrder} className={cn(buttonVariants({ variant: 'secondary' }), 'h-14 min-w-0 px-3 text-[15px]')}>
                        송폼 · 순서
                    </button>
                    <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label="큐 보내기"
                        onClick={onCue}
                        className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'size-14 gap-1 text-[15px]')}
                    >
                        <Megaphone className="size-[17px]" />
                        큐
                    </button>
                    <button
                        type="button"
                        aria-label={nextLabel}
                        disabled={atEnd}
                        onClick={live.nextSectionStep}
                        className={cn(buttonVariants({ variant: 'default' }), 'h-14 min-w-0 gap-1 pl-5 pr-4 text-[16px]')}
                    >
                        {nextSection || atEnd ? '다음' : '다음 곡'}
                        <ChevronRight className="size-6" />
                    </button>
                </div>
            )}
        </nav>
    );
}

/* ───────────── 시트 ───────────── */

function Sheet({
    title,
    eyebrow,
    hideTitle = false,
    tall = false,
    focusOnOpen,
    onClose,
    children,
}: {
    title: string;
    eyebrow?: ReactNode;
    hideTitle?: boolean;
    /** 큐 · 더보기처럼 내용이 긴 시트는 더 높이 (송폼 · 순서는 위의 악보가 보이도록 낮게) */
    tall?: boolean;
    focusOnOpen: boolean;
    onClose: () => void;
    children: (titleId: string) => ReactNode;
}) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    /* 직접 연 시트에만 초점을 옮깁니다 (닫힐 때는 MobileScore 가 연 버튼으로 돌려줍니다) */
    useEffect(() => {
        if (focusOnOpen) panelRef.current?.focus({ preventScroll: true });
    }, [focusOnOpen]);

    const onKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
        }
    };

    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-end" onKeyDown={onKeyDown}>
            <button type="button" tabIndex={-1} aria-label="시트 닫기" onClick={onClose} className="absolute inset-0 bg-background/70 animate-in fade-in duration-200" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    'relative flex flex-col rounded-t-3xl border-t border-border bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl outline-none animate-in slide-in-from-bottom-6 duration-200',
                    tall ? 'max-h-[86%]' : 'max-h-[68%]',
                )}
            >
                <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-input" />
                <div className={cn('flex shrink-0 items-start justify-between gap-3 pl-5 pr-2', hideTitle ? 'sr-only' : 'pt-3')}>
                    <div className="min-w-0 pt-1">
                        {eyebrow ? <p className="truncate text-xs font-medium text-muted-foreground">{eyebrow}</p> : null}
                        <h2 id={titleId} className="mt-0.5 text-[19px] font-semibold tracking-tight">
                            {title}
                        </h2>
                    </div>
                    {hideTitle ? null : <CloseButton onClose={onClose} />}
                </div>
                {children(titleId)}
            </div>
        </div>
    );
}

function CloseButton({ onClose }: { onClose: () => void }) {
    return (
        <button type="button" aria-label="닫기" onClick={onClose} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0 text-muted-foreground')}>
            <X className="size-5" />
        </button>
    );
}

/* 송폼 · 콘티 순서 */

function OrderSheet({ titleId, live, tab, onTab, onDone }: { titleId: string; live: MockLive; tab: OrderTab; onTab: (tab: OrderTab) => void; onDone: () => void }) {
    const baseId = useId();
    const tabs: { id: OrderTab; label: string }[] = [
        { id: 'form', label: '송폼' },
        { id: 'setlist', label: '콘티 순서' },
    ];
    const { song, sectionIndex, songIndex } = live;
    const panelRef = useRef<HTMLDivElement>(null);

    /* 지금 줄이 목록 아래에 가려져 있으면 보이도록 (시트 안 목록만 움직입니다) */
    useEffect(() => {
        const panel = panelRef.current;
        const row = panel?.querySelector<HTMLElement>('[aria-current]');
        if (!panel || !row) return;
        const rowTop = row.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
        if (rowTop + row.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = rowTop - panel.clientHeight / 3;
    }, [tab]);

    return (
        <>
            <div className="mx-5 flex shrink-0 items-center gap-2 border-b border-border pt-1">
                <div role="tablist" aria-labelledby={titleId} className="flex flex-1 gap-6">
                    {tabs.map((item) => {
                        const active = item.id === tab;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                id={`${baseId}-tab-${item.id}`}
                                aria-selected={active}
                                aria-controls={`${baseId}-panel-${item.id}`}
                                onClick={() => onTab(item.id)}
                                className={cn(
                                    '-mb-px flex h-12 items-center border-b-2 text-[16px] transition-colors',
                                    focusRing,
                                    active ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
                <div className="-mr-3">
                    <CloseButton onClose={onDone} />
                </div>
            </div>

            <div ref={panelRef} id={`${baseId}-panel-${tab}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
                {tab === 'form' ? (
                    <>
                        <p className="pb-1 pt-4 text-xs font-medium text-muted-foreground">
                            {song.title} · Key {song.key} · {song.meter}
                        </p>
                        <ol className="divide-y divide-border">
                            {song.form.map((name, index) => {
                                const current = index === sectionIndex;
                                const next = index === sectionIndex + 1;
                                return (
                                    <li key={`${name}-${index}`}>
                                        <button
                                            type="button"
                                            aria-current={current ? 'step' : undefined}
                                            onClick={() => {
                                                live.goSection(index);
                                                onDone();
                                            }}
                                            className={cn('flex min-h-14 w-full items-center gap-3 rounded-xl py-2 text-left', focusRing)}
                                        >
                                            <span className="w-6 shrink-0 text-[13px] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className={cn('block text-[17px] tracking-tight', current ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>{name}</span>
                                                {song.lyrics[name] ? <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{song.lyrics[name]}</span> : null}
                                            </span>
                                            {current ? (
                                                <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">지금</span>
                                            ) : next ? (
                                                <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-3 text-xs font-semibold">다음</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                ) : (
                    <>
                        <p className="pb-1 pt-4 text-xs font-medium text-muted-foreground">
                            {DRAFT_SERVICE.title} · {DRAFT_SERVICE.theme}
                        </p>
                        <ol className="divide-y divide-border">
                            {live.songs.map((item, index) => {
                                const current = index === songIndex;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            aria-current={current ? 'true' : undefined}
                                            onClick={() => {
                                                if (!current) live.goSong(index);
                                                onDone();
                                            }}
                                            className={cn('flex min-h-[68px] w-full items-center gap-3 rounded-xl py-3 text-left', focusRing)}
                                        >
                                            <span className="w-6 shrink-0 text-[13px] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className={cn('block truncate text-[17px] tracking-tight', current ? 'font-semibold' : 'font-medium text-foreground/80')}>{item.title}</span>
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
                                            ) : (
                                                <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-muted-foreground" />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}
            </div>
        </>
    );
}

/* 큐 보내기 */

function CueSheet({ live, onSent }: { live: MockLive; onSent: () => void }) {
    const [group, setGroup] = useState<CueGroup>('flow');
    const cues = DRAFT_CUES.filter((cue) => cue.group === group);
    const target = cues[0]?.target ?? 'all';
    const people = recipients(target);

    return (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {/* 다섯 종류가 360px 에서도 한 줄에 다 보이도록 같은 너비로 나눕니다 */}
            <div role="group" aria-label="큐 종류" className="mt-3 grid grid-cols-5 gap-1.5 px-5">
                {CUE_GROUPS.map((item) => {
                    const active = item === group;
                    return (
                        <button
                            key={item}
                            type="button"
                            aria-pressed={active}
                            aria-label={CUE_GROUP_LABEL[item]}
                            onClick={() => setGroup(item)}
                            className={cn(
                                'inline-flex h-11 min-w-0 items-center justify-center rounded-full px-1 text-sm transition-colors',
                                focusRingOffset,
                                active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted font-medium text-foreground/80 hover:text-foreground',
                            )}
                        >
                            {CUE_GROUP_SHORT[item]}
                        </button>
                    );
                })}
            </div>

            <p className="mt-4 flex items-center gap-1.5 px-5 text-[13px] text-muted-foreground">
                <span>
                    <span className="font-medium text-foreground">{targetLabel(target)}에게</span> · 접속 {people.online}명
                </span>
                {people.offline.length > 0 ? (
                    <>
                        <span aria-hidden="true" className="ml-1 size-1.5 rounded-full bg-secondary" />
                        <span className="text-secondary">{people.offline.map((member) => member.name).join(', ')} 오프라인</span>
                    </>
                ) : null}
            </p>

            <div className="mt-2.5 grid grid-cols-2 gap-2 px-5">
                {cues.map((cue) => (
                    <button
                        key={cue.id}
                        type="button"
                        onClick={() => {
                            live.sendCue(cue);
                            onSent();
                        }}
                        className={cn('flex h-14 min-w-0 items-center rounded-2xl bg-muted px-4 text-left text-[16px] font-semibold transition hover:bg-muted/70 active:scale-[0.98]', focusRing)}
                    >
                        <span className="truncate">{cue.label}</span>
                    </button>
                ))}
            </div>

            <div className="mt-6 px-5">
                <p className="text-xs font-medium text-muted-foreground">최근 큐</p>
                <ul className="mt-1 divide-y divide-border">
                    {live.log.slice(0, 3).map((entry) => {
                        const mine = entry.from === '나';
                        return (
                            <li key={entry.id} className="flex min-h-12 items-center gap-3 py-2">
                                <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', mine ? 'bg-brand' : 'bg-muted-foreground/50')} />
                                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{entry.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {mine ? '나' : entry.from} → {targetLabel(entry.target)} · {entry.at}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

/* 더보기: 기기 설정 · 내 파트 · 팀 접속 */

function MoreSheet({
    awake,
    onAwake,
    fullscreen,
    onFullscreen,
    beatOn,
    onBeat,
    myRole,
    onRole,
    onLock,
}: {
    awake: boolean;
    onAwake: () => void;
    fullscreen: boolean;
    onFullscreen: () => void;
    beatOn: boolean;
    onBeat: () => void;
    myRole: DraftRole;
    onRole: (role: DraftRole) => void;
    onLock: () => void;
}) {
    const roles = Object.keys(ROLE_LABEL) as DraftRole[];
    return (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
            <ul className="mt-2 divide-y divide-border">
                <SettingRow icon={<Sun className="size-[18px]" />} label="화면 꺼짐 방지" hint="예배 중 화면이 꺼지지 않아요">
                    <Switch label="화면 꺼짐 방지" on={awake} onToggle={onAwake} />
                </SettingRow>
                <SettingRow icon={<Maximize2 className="size-[18px]" />} label="전체화면">
                    <Switch label="전체화면" on={fullscreen} onToggle={onFullscreen} />
                </SettingRow>
                <SettingRow icon={<Activity className="size-[18px]" />} label="박자 점" hint="위 막대의 점이 박자마다 깜빡여요">
                    <Switch label="박자 점" on={beatOn} onToggle={onBeat} />
                </SettingRow>
                <SettingRow icon={<Lock className="size-[18px]" />} label="화면 잠금" hint="악보를 잘못 눌러 넘기지 않도록">
                    <button type="button" onClick={onLock} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-11 px-4')}>
                        잠그기
                    </button>
                </SettingRow>
            </ul>

            <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground">내 파트 · 받을 큐</p>
                <div role="radiogroup" aria-label="내 파트" className="mt-2 flex flex-wrap gap-1.5">
                    {roles.map((role) => {
                        const active = role === myRole;
                        return (
                            <button
                                key={role}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onRole(role)}
                                className={cn(
                                    'inline-flex h-11 items-center rounded-full px-4 text-sm transition-colors',
                                    focusRingOffset,
                                    active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted font-medium text-foreground/80',
                                )}
                            >
                                {ROLE_LABEL[role]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className={iconTile} aria-hidden="true">
                    <UsersRound className="size-[18px] text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                        팀 접속 {ONLINE.length}/{DRAFT_TEAM.length}
                    </p>
                    {OFFLINE.length > 0 ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-secondary">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-secondary" />
                            {OFFLINE.map((member) => member.name).join(', ')} 오프라인
                        </p>
                    ) : null}
                </div>
                <AvatarStack names={ONLINE.map((member) => member.name)} max={3} size="md" />
            </div>
        </div>
    );
}

function SettingRow({ icon, label, hint, children }: { icon: ReactNode; label: string; hint?: string; children: ReactNode }) {
    return (
        <li className="flex min-h-16 items-center gap-3 py-2.5">
            <span className={cn(iconTile, 'text-muted-foreground')} aria-hidden="true">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{label}</span>
                {hint ? <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{hint}</span> : null}
            </span>
            {children}
        </li>
    );
}

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} className={cn('flex h-11 shrink-0 items-center rounded-full px-1', focusRingOffset)}>
            <span className={cn('flex h-7 w-12 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-muted ring-1 ring-input')}>
                <span className={cn('size-6 rounded-full transition-transform', on ? 'translate-x-5 bg-primary-foreground' : 'translate-x-0 bg-foreground/70')} />
            </span>
        </button>
    );
}
