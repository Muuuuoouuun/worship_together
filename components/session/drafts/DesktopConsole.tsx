'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronLeft,
    Ellipsis,
    Lock,
    LockOpen,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    StickyNote,
    Sun,
    UsersRound,
    Wifi,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import BeatIndicator from '@/components/session/BeatIndicator';
import { Avatar, TONE_BLOCK, TONE_ICON } from '@/components/conti/ui';
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
    type DraftCue,
    type DraftRole,
    type MockLive,
} from './mockLive';
import type { DraftScreenProps } from './types';

/*
 * 데스크톱 B · 진행 콘솔 (무대용 어두운 화면)
 * 인도자·음향석이 순서 — 지금 — 큐를 한눈에 보고 바로 신호를 보내는 3단 콘솔.
 * 왼쪽: 콘티 순서와 팀 접속 / 가운데: 지금 섹션·박자·송폼·넘김 / 오른쪽: 큐 보내기와 최근 큐.
 */

const targetLabel = (target: DraftRole | 'all') => (target === 'all' ? '전체' : ROLE_LABEL[target]);

/**
 * 큐 키보드는 두 칸씩 짝을 지어 줄 높이를 맞춥니다.
 * 위: 흐름 | 음향·볼륨 (4개씩) / 아래: 템포·박자 | 반주 + 미디어 — 한 화면에 모두 보입니다.
 */
const CUE_ROWS: [CueGroup[], CueGroup[]][] = [
    [['flow'], ['sound']],
    [['tempo'], ['band', 'media']],
];

/** 좁은 화면의 송폼 칸에 쓰는 짧은 이름 */
const SHORT_SECTION: Record<string, string> = {
    Intro: 'I',
    Verse: 'V',
    'Verse 1': 'V1',
    'Verse 2': 'V2',
    'Pre-Chorus': 'PC',
    Chorus: 'C',
    Bridge: 'B',
    Outro: 'O',
    Tag: 'T',
};

/** 아바타 색은 파트 묶음으로 (인도 · 악기 · 음향/미디어) */
const ROLE_TONE: Record<DraftRole, 'lilac' | 'sky' | 'mint'> = {
    leader: 'lilac',
    instrument: 'sky',
    sound: 'mint',
    media: 'mint',
};

const ONLINE_COUNT = DRAFT_TEAM.filter((member) => member.online).length;
const OFFLINE = DRAFT_TEAM.filter((member) => !member.online);

const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** 큐를 받은 팀원 중 확인한 사람 (목업: 접속 중이고 ack 가 있는 사람). 내가 방금 보낸 큐는 아직 '전송됨'. */
function ackOf(entry: CueLogEntry): { done: boolean; text: string } {
    if (entry.from === '나' && entry.at === '방금') return { done: false, text: '전송됨' };
    const recipients = DRAFT_TEAM.filter((member) => member.online && member.name !== entry.from && (entry.target === 'all' || member.role === entry.target));
    const acked = recipients.filter((member) => member.ack).length;
    if (recipients.length === 0) return { done: false, text: '받는 사람 없음' };
    if (acked === recipients.length) return { done: true, text: recipients.length === 1 ? '확인' : '모두 확인' };
    if (recipients.length === 1) return { done: false, text: '확인 전' };
    return { done: false, text: `확인 ${acked}/${recipients.length}` };
}

/** 가운데 칸을 바꿔 그릴 때 넘겨 주는 상태 */
export interface DesktopConsoleCenter {
    live: MockLive;
    locked: boolean;
    beatOn: boolean;
    /** 원래 가운데 칸 (지금 진행) */
    stage: ReactNode;
}

/** 모두 선택 사항 — 주지 않으면 시안 그대로 그립니다 */
export interface DesktopConsoleSlots {
    /** 바깥에서 만든 진행 상태를 함께 씁니다 (주지 않으면 이 화면의 목업 상태) */
    live?: MockLive;
    /** 가운데 맨 위 받은 큐 줄과 큐 버튼의 보냄 표시를 그리지 않습니다 (알림을 바깥에서 한 가지로 그릴 때) */
    hideOwnCues?: boolean;
    /** 머리줄 가운데에 끼울 내용 */
    headerSlot?: ReactNode | ((state: { locked: boolean }) => ReactNode);
    /** 가운데 칸을 바꿔 그립니다 */
    renderCenter?: (center: DesktopConsoleCenter) => ReactNode;
    /** 가운데 칸의 박자 칸(1 2 3 4)을 바꿔 그립니다 */
    renderBeat?: (state: { live: MockLive; beatOn: boolean }) => ReactNode;
    /** 오른쪽 칸 맨 아래에 붙는 자리. 주면 큐 버튼 칸은 남는 높이 안에서 스크롤됩니다 */
    cueDock?: ReactNode;
    /** cueDock 이 무언가 보여 주는 동안 최근 큐 목록을 접습니다 */
    cueDockOpen?: boolean;
    /** 큐 버튼을 조금 낮게 (cueDock 자리를 넉넉히) */
    denseCues?: boolean;
    /** 왼쪽 칸(콘티 순서 · 팀 접속)에 더할 클래스 */
    orderClassName?: string;
}

export default function DesktopConsole({
    framed = false,
    live: liveProp,
    hideOwnCues = false,
    headerSlot,
    renderCenter,
    renderBeat,
    cueDock,
    cueDockOpen = false,
    denseCues = false,
    orderClassName,
}: DraftScreenProps & DesktopConsoleSlots) {
    const ownLive = useMockLive();
    const live = liveProp ?? ownLive;
    const rootRef = useRef<HTMLDivElement>(null);
    const [locked, setLocked] = useState(false);
    const [awake, setAwake] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [beatOn, setBeatOn] = useState(true);
    const [myRole, setMyRole] = useState<DraftRole>('leader');
    const [moreOpen, setMoreOpen] = useState(false);
    const [seenCueId, setSeenCueId] = useState<string | null>(null);

    const { nextSectionStep, prevSectionStep } = live;

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
            if (locked || moreOpen || event.altKey || event.metaKey || event.ctrlKey) return;
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
    }, [framed, locked, moreOpen, nextSectionStep, prevSectionStep]);

    const latest = live.log[0] ?? null;
    const incoming = latest && latest.from !== '나' && latest.id !== seenCueId ? latest : null;
    const stage = (
        <StageColumn
            live={live}
            locked={locked}
            beatOn={beatOn}
            latest={latest}
            incoming={incoming}
            onSeen={setSeenCueId}
            hideSignal={hideOwnCues}
            beat={renderBeat ? renderBeat({ live, beatOn }) : undefined}
        />
    );

    return (
        <div ref={rootRef} className="dark flex h-full w-full flex-col overflow-hidden bg-background text-foreground [color-scheme:dark]">
            <ConsoleHeader
                fullscreen={fullscreen}
                awake={awake}
                locked={locked}
                moreOpen={moreOpen}
                onFullscreen={toggleFullscreen}
                onAwake={() => setAwake((value) => !value)}
                onLock={() => setLocked((value) => !value)}
                onMore={setMoreOpen}
                more={<MoreSheet myRole={myRole} onRole={setMyRole} beatOn={beatOn} onBeat={setBeatOn} />}
                slot={typeof headerSlot === 'function' ? headerSlot({ locked }) : headerSlot}
            />

            <div className="@container/console min-h-0 flex-1">
                <div className="grid h-full grid-cols-[232px_minmax(0,1fr)_300px] @min-[1200px]/console:grid-cols-[280px_minmax(0,1fr)_352px] @min-[1400px]/console:grid-cols-[300px_minmax(0,1fr)_380px]">
                    <OrderColumn live={live} locked={locked} className={orderClassName} />
                    {renderCenter ? renderCenter({ live, locked, beatOn, stage }) : stage}
                    <CueColumn live={live} locked={locked} hideFlash={hideOwnCues} dense={denseCues} dock={cueDock} dockOpen={cueDockOpen} />
                </div>
            </div>
        </div>
    );
}

/* ───────────── 머리줄 ───────────── */

function ConsoleHeader({
    fullscreen,
    awake,
    locked,
    moreOpen,
    onFullscreen,
    onAwake,
    onLock,
    onMore,
    more,
    slot,
}: {
    fullscreen: boolean;
    awake: boolean;
    locked: boolean;
    moreOpen: boolean;
    onFullscreen: () => void;
    onAwake: () => void;
    onLock: () => void;
    onMore: (open: boolean) => void;
    more: ReactNode;
    /** 진행 중 표시와 오른쪽 버튼 사이 가운데 자리 */
    slot?: ReactNode;
}) {
    const moreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!moreOpen) return;
        const onPointer = (event: PointerEvent) => {
            if (!moreRef.current?.contains(event.target as Node)) onMore(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onMore(false);
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [moreOpen, onMore]);

    return (
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-4">
            <button type="button" aria-label="예배 중 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                <ChevronLeft className="size-5" />
            </button>
            <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold tracking-tight">{DRAFT_SERVICE.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {DRAFT_SERVICE.dateLabel} · {DRAFT_SERVICE.theme}
                </p>
            </div>
            <span className="ml-2 inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border pl-3 pr-3.5 text-sm">
                <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
                <span className="font-semibold text-brand">진행 중</span>
                <span aria-hidden="true" className="h-3.5 w-px bg-border" />
                <Elapsed />
            </span>

            {slot === undefined ? null : <div className="flex flex-1 justify-center">{slot}</div>}

            <div className="ml-auto flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
                    <UsersRound className="size-4" aria-hidden="true" />
                    <span>
                        접속 <span className="font-semibold tabular-nums text-foreground">{ONLINE_COUNT}/{DRAFT_TEAM.length}</span>
                    </span>
                    {OFFLINE.length > 0 ? <span role="img" aria-label={`${OFFLINE.length}명 미접속`} className="size-1.5 rounded-full bg-secondary" /> : null}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
                    <Wifi className="size-4" aria-hidden="true" />
                    동기화됨
                </span>
                <span aria-hidden="true" className="mx-2 h-6 w-px bg-border" />
                <DeviceToggle label="화면 꺼짐 방지" pressed={awake} onClick={onAwake}>
                    <Sun className="size-[18px]" />
                </DeviceToggle>
                <DeviceToggle label={fullscreen ? '전체화면 끝내기' : '전체화면'} pressed={fullscreen} onClick={onFullscreen}>
                    {fullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
                </DeviceToggle>
                {locked ? (
                    /* 잠긴 동안에는 글자로 보여 줘서 왜 버튼이 안 눌리는지, 어떻게 푸는지 바로 알 수 있게 합니다. */
                    <button type="button" aria-label="화면 잠금 풀기" aria-pressed="true" onClick={onLock} className={cn(buttonVariants({ variant: 'secondary', size: 'default' }), 'px-4')}>
                        <Lock className="size-4" aria-hidden="true" />
                        잠금 중
                    </button>
                ) : (
                    <DeviceToggle label="화면 잠금" pressed={false} onClick={onLock}>
                        <LockOpen className="size-[18px]" />
                    </DeviceToggle>
                )}
                <div ref={moreRef} className="relative">
                    <DeviceToggle label="더보기" pressed={moreOpen} onClick={() => onMore(!moreOpen)} expanded={moreOpen}>
                        <Ellipsis className="size-[18px]" />
                    </DeviceToggle>
                    {moreOpen ? (
                        <div role="dialog" aria-label="화면 설정" className="absolute right-0 top-[calc(100%+8px)] z-30 w-80 rounded-3xl border border-border bg-card p-5 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <p className="text-[15px] font-semibold">화면 설정</p>
                                <button type="button" aria-label="닫기" onClick={() => onMore(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-muted-foreground')}>
                                    <X className="size-4" />
                                </button>
                            </div>
                            {more}
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}

function DeviceToggle({ label, pressed, onClick, children, expanded }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode; expanded?: boolean }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={expanded === undefined ? pressed : undefined}
            aria-expanded={expanded}
            onClick={onClick}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), pressed ? 'bg-muted text-foreground' : 'text-muted-foreground')}
        >
            {children}
        </button>
    );
}

/** 경과 시간은 1초마다 바뀌므로 작은 잎 컴포넌트에서만 다시 그립니다. */
function Elapsed() {
    const [seconds, setSeconds] = useState(() => {
        const [m, s] = DRAFT_ELAPSED.split(':').map(Number);
        return m * 60 + s;
    });
    useEffect(() => {
        const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return (
        <span className="font-semibold tabular-nums text-foreground">
            <span className="sr-only">경과 </span>
            {text}
        </span>
    );
}

function MoreSheet({ myRole, onRole, beatOn, onBeat }: { myRole: DraftRole; onRole: (role: DraftRole) => void; beatOn: boolean; onBeat: (on: boolean) => void }) {
    return (
        <div className="mt-4 space-y-5">
            <div>
                <p className="text-xs font-medium text-muted-foreground">내 역할</p>
                <div role="radiogroup" aria-label="내 역할" className="mt-2 flex gap-1 rounded-full bg-muted p-1">
                    {(Object.keys(ROLE_LABEL) as DraftRole[]).map((role) => (
                        <button
                            key={role}
                            type="button"
                            role="radio"
                            aria-checked={myRole === role}
                            onClick={() => onRole(role)}
                            className={cn('h-8 flex-1 rounded-full text-xs font-semibold transition-colors', focusRing, myRole === role ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {ROLE_LABEL[role]}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">역할에 맞는 큐만 알림으로 받아요.</p>
            </div>
            <div className="divide-y divide-border border-y border-border">
                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm">
                    박자 표시
                    <input type="checkbox" checked={beatOn} onChange={(event) => onBeat(event.target.checked)} className="peer sr-only" />
                    <span aria-hidden="true" className={cn('relative h-6 w-10 rounded-full transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring', beatOn ? 'bg-primary' : 'bg-muted')}>
                        <span className={cn('absolute top-1 size-4 rounded-full transition-all', beatOn ? 'left-5 bg-primary-foreground' : 'left-1 bg-muted-foreground')} />
                    </span>
                </label>
                <div className="flex min-h-12 items-center justify-between gap-3 text-sm">
                    동기화
                    <span className="text-xs text-muted-foreground">연결됨 · 기기 {ONLINE_COUNT}대 · 지연 40ms</span>
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 text-sm">
                    섹션 넘김
                    <span className="text-xs text-muted-foreground">← → 키 · 페달</span>
                </div>
            </div>
        </div>
    );
}

/* ───────────── 왼쪽: 콘티 순서 · 팀 접속 ───────────── */

function OrderColumn({ live, locked, className }: { live: MockLive; locked: boolean; className?: string }) {
    return (
        <aside aria-label="콘티 순서와 팀 접속" className={cn('flex min-h-0 flex-col overflow-y-auto border-r border-border px-4 pb-4 pt-4 [scrollbar-width:thin]', className)}>
            {/* 세 칸의 머리줄은 모두 같은 48px 띠(가운데의 큐 줄과 같은 높이)에 맞춥니다. */}
            <div className="flex h-12 shrink-0 items-center justify-between px-2">
                <h2 className="text-[17px] font-semibold tracking-tight">콘티 순서</h2>
                <span className="text-xs text-muted-foreground">{live.songs.length}곡</span>
            </div>
            <ol className="divide-y divide-border">
                {live.songs.map((song, index) => {
                    const current = index === live.songIndex;
                    const done = index < live.songIndex;
                    return (
                        <li key={song.id}>
                            <button
                                type="button"
                                disabled={locked}
                                aria-current={current ? 'true' : undefined}
                                onClick={() => live.goSong(index)}
                                className={cn(
                                    'my-1 flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors disabled:cursor-not-allowed @min-[1200px]/console:py-3',
                                    focusRing,
                                    current ? 'bg-muted' : 'hover:bg-muted/60 disabled:opacity-50 disabled:hover:bg-transparent',
                                )}
                            >
                                <span className={cn('mt-0.5 flex w-5 shrink-0 justify-center text-sm font-semibold tabular-nums', current ? 'text-foreground' : 'text-muted-foreground')}>
                                    {done ? <Check className="mt-0.5 size-4" aria-label="끝난 곡" /> : index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={cn('block truncate text-base font-semibold tracking-tight', done && 'text-muted-foreground')}>{song.title}</span>
                                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                                        Key {song.key} · {song.bpm} BPM · {song.meter}
                                    </span>
                                    {current ? <FormProgress total={song.form.length} index={live.sectionIndex} /> : null}
                                    {current && song.note ? (
                                        <span className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-foreground/80 @min-[1200px]/console:hidden">
                                            <StickyNote className={cn('mt-px size-3.5 shrink-0', TONE_ICON.sky)} aria-hidden="true" />
                                            {song.note}
                                        </span>
                                    ) : null}
                                </span>
                                {current ? <span className="mt-0.5 hidden shrink-0 text-xs font-semibold text-brand @min-[1200px]/console:inline">지금</span> : null}
                            </button>
                        </li>
                    );
                })}
            </ol>

            <div className="mt-4 flex items-baseline justify-between px-2 @min-[1200px]/console:mt-6">
                <h2 className="text-[17px] font-semibold tracking-tight">팀 접속</h2>
                <span className="text-xs text-muted-foreground">
                    {ONLINE_COUNT}/{DRAFT_TEAM.length}
                </span>
            </div>
            <ul className="mt-2 px-2">
                {DRAFT_TEAM.map((member) => (
                    <li key={member.name} className="relative flex h-9 items-center gap-2.5 @min-[1200px]/console:h-10">
                        <span className="relative shrink-0">
                            <Avatar name={member.name} tone={ROLE_TONE[member.role]} size="sm" className={cn(!member.online && 'opacity-50')} />
                            <span
                                aria-hidden="true"
                                className={cn('absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background', member.online ? 'bg-brand' : 'bg-secondary')}
                            />
                        </span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                            <span className={cn('shrink-0 text-sm font-medium', !member.online && 'text-muted-foreground')}>{member.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{member.part}</span>
                        </span>
                        {member.online ? <span className="sr-only">접속 중</span> : <span className="shrink-0 text-xs font-medium text-secondary">미접속</span>}
                    </li>
                ))}
            </ul>
        </aside>
    );
}

function FormProgress({ total, index }: { total: number; index: number }) {
    return (
        <span className="mt-2.5 flex items-center gap-2">
            <span aria-hidden="true" className="flex flex-1 gap-0.5">
                {Array.from({ length: total }, (_, step) => (
                    <span key={step} className={cn('h-1 flex-1 rounded-full', step < index ? 'bg-foreground/45' : step === index ? 'bg-foreground' : 'bg-foreground/10')} />
                ))}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {index + 1}/{total}
            </span>
        </span>
    );
}

/* ───────────── 가운데: 지금 ───────────── */

function StageColumn({
    live,
    locked,
    beatOn,
    latest,
    incoming,
    onSeen,
    hideSignal = false,
    beat,
}: {
    live: MockLive;
    locked: boolean;
    beatOn: boolean;
    latest: CueLogEntry | null;
    incoming: CueLogEntry | null;
    onSeen: (id: string) => void;
    /** 맨 위 신호 줄을 그리지 않습니다 */
    hideSignal?: boolean;
    /** 박자 칸 대신 그릴 내용 */
    beat?: ReactNode;
}) {
    const { song, sectionIndex, section, nextSection, nextSong } = live;
    const lastOfSong = nextSection === null;
    const atEnd = lastOfSong && nextSong === null;
    const prevSection = sectionIndex > 0 ? song.form[sectionIndex - 1] : null;
    const changed = live.bpm !== song.bpm;

    return (
        <main aria-label="지금 진행" className="@container/stage flex min-h-0 min-w-0 flex-col justify-between gap-4 overflow-y-auto px-8 pb-5 pt-4 [scrollbar-width:none] @min-[1200px]/console:px-10 @min-[1200px]/console:pb-6">
            {/* 받은 큐 + 곡 + 지금 섹션 */}
            <div className="shrink-0">
                {hideSignal ? null : <SignalLine latest={latest} incoming={incoming} onSeen={onSeen} />}

                <p className="mt-4 text-xs font-medium text-muted-foreground @min-[1200px]/console:mt-5">
                    지금 부르는 곡 · {live.songIndex + 1}/{live.songs.length}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="text-[28px] font-semibold leading-tight tracking-tight @min-[1200px]/console:text-[32px]">{song.title}</h2>
                    <span className="flex items-center gap-1.5">
                        <MetaChip>Key {song.key}</MetaChip>
                        <MetaChip>{song.meter}</MetaChip>
                    </span>
                </div>

                <p className="mt-[clamp(16px,4cqi,28px)] text-xs font-medium text-muted-foreground">
                    섹션 {sectionIndex + 1}/{song.form.length}
                </p>
                <p className="mt-1 truncate text-[length:clamp(72px,16cqi,96px)] font-semibold leading-[1.02] tracking-[-0.03em]">{section}</p>
                <p className="mt-2 truncate text-xl text-foreground/70">{song.lyrics[section] ?? ''}</p>
            </div>

            {/* 박자 · BPM */}
            <div className="flex shrink-0 items-center gap-4">
                {beat ?? (
                    <BeatIndicator bpm={live.bpm} enabled={beatOn}>
                        {(activeBeat) => (
                            <div aria-hidden="true" className="flex flex-1 gap-2">
                                {[1, 2, 3, 4].map((beat) => (
                                    <span
                                        key={beat}
                                        className={cn(
                                            'flex h-14 flex-1 items-center justify-center rounded-2xl text-sm font-semibold tabular-nums transition-colors duration-75',
                                            activeBeat === beat ? (beat === 1 ? 'bg-brand text-brand-foreground' : 'bg-primary text-primary-foreground') : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {beat}
                                    </span>
                                ))}
                            </div>
                        )}
                    </BeatIndicator>
                )}
                <div className="flex shrink-0 items-center gap-1" role="group" aria-label="BPM 조절">
                    <button type="button" aria-label="BPM 1 내리기" disabled={locked} onClick={() => live.nudgeBpm(-1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'size-10 bg-transparent text-muted-foreground')}>
                        <Minus />
                    </button>
                    <div className="w-[72px] text-center" aria-live="polite">
                        <p className="text-[28px] font-semibold leading-none tabular-nums">{live.bpm}</p>
                        <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">{changed ? `BPM · 원래 ${song.bpm}` : 'BPM'}</p>
                    </div>
                    <button type="button" aria-label="BPM 1 올리기" disabled={locked} onClick={() => live.nudgeBpm(1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'size-10 bg-transparent text-muted-foreground')}>
                        <Plus />
                    </button>
                </div>
            </div>

            {/* 다음 · 곡 메모 */}
            <div className={cn('grid shrink-0 gap-3', song.note && '@min-[1200px]/console:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]')}>
                <div className="min-w-0 rounded-3xl bg-muted/60 px-5 py-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                        {lastOfSong ? (nextSong ? '다음 곡' : '다음') : '다음 섹션'}
                    </p>
                    <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{lastOfSong ? (nextSong ? nextSong.title : '콘티 끝') : nextSection}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {lastOfSong
                            ? nextSong
                                ? `Key ${nextSong.key} · ${nextSong.bpm} BPM · ${nextSong.meter} · ${nextSong.form[0]}부터`
                                : '마지막 섹션입니다'
                            : (song.lyrics[nextSection] ?? '')}
                    </p>
                </div>
                {song.note ? (
                    <div className={cn('hidden min-w-0 rounded-3xl px-5 py-4 @min-[1200px]/console:block', TONE_BLOCK.sky)}>
                        <p className={cn('flex items-center gap-1.5 text-xs font-medium', TONE_ICON.sky)}>
                            <StickyNote className="size-3.5" aria-hidden="true" />
                            곡 메모
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug">{song.note}</p>
                    </div>
                ) : null}
            </div>

            {/* 송폼 타임라인 + 넘김 */}
            <div className="shrink-0">
                <div className="flex items-baseline justify-between">
                    <p className="text-xs font-medium text-muted-foreground">송폼</p>
                    <p className="text-xs text-muted-foreground">눌러서 바로 이동</p>
                </div>
                <ol aria-label="송폼" className="mt-2 flex gap-1.5">
                    {song.form.map((name, index) => {
                        const current = index === sectionIndex;
                        const done = index < sectionIndex;
                        return (
                            <li key={`${name}-${index}`} className={cn('min-w-0', current ? 'flex-[1.6]' : 'flex-1')}>
                                <button
                                    type="button"
                                    disabled={locked}
                                    aria-current={current ? 'true' : undefined}
                                    aria-label={`${index + 1}번째 섹션 ${name}${current ? ' (지금)' : ''}`}
                                    title={name}
                                    onClick={() => live.goSection(index)}
                                    className={cn(
                                        'flex h-11 w-full items-center justify-center rounded-full px-1 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed',
                                        focusRing,
                                        current
                                            ? 'bg-primary text-primary-foreground'
                                            : done
                                              ? 'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-muted-foreground disabled:opacity-50 disabled:hover:bg-muted/50'
                                              : 'border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent',
                                    )}
                                >
                                    {current ? (
                                        <span className="truncate">{name}</span>
                                    ) : (
                                        <>
                                            <span className="hidden truncate @min-[520px]/stage:inline">{name.length > 7 ? (SHORT_SECTION[name] ?? name) : name}</span>
                                            <span className="truncate @min-[520px]/stage:hidden">{SHORT_SECTION[name] ?? name}</span>
                                        </>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className="mt-4 flex gap-3">
                    <button
                        type="button"
                        disabled={locked || (sectionIndex === 0 && live.songIndex === 0)}
                        onClick={live.prevSectionStep}
                        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 min-w-0 flex-1 bg-transparent text-base @min-[1200px]/console:h-16')}
                    >
                        <ArrowLeft className="size-5" aria-hidden="true" />
                        이전
                        {prevSection ? <span className="hidden truncate font-medium text-muted-foreground @min-[520px]/stage:inline">{prevSection}</span> : null}
                    </button>
                    <button
                        type="button"
                        disabled={locked || atEnd}
                        onClick={live.nextSectionStep}
                        className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'h-14 min-w-0 flex-[2] justify-between px-6 text-lg @min-[1200px]/console:h-16 @min-[1200px]/console:px-7')}
                    >
                        <span className="flex min-w-0 items-baseline gap-2">
                            {lastOfSong ? '다음 곡' : '다음 섹션'}
                            <span className="truncate text-base font-medium opacity-60">{lastOfSong ? (nextSong?.title ?? '') : nextSection}</span>
                        </span>
                        <ArrowRight className="size-5" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </main>
    );
}

/**
 * 가운데 맨 위 신호 줄. 자리는 항상 같아 큰 섹션 글씨가 움직이지 않습니다.
 * 다른 사람이 보낸 큐가 막 들어오면 주황 점으로 조용히 알리고, 확인하면 마지막 큐만 흐리게 남깁니다.
 */
function SignalLine({ latest, incoming, onSeen }: { latest: CueLogEntry | null; incoming: CueLogEntry | null; onSeen: (id: string) => void }) {
    const lineRef = useRef<HTMLDivElement>(null);
    const acknowledge = (id: string) => {
        onSeen(id);
        /* 확인 버튼이 사라져도 키보드 초점이 길을 잃지 않게 같은 자리로 옮깁니다. */
        requestAnimationFrame(() => lineRef.current?.focus());
    };

    return (
        <div ref={lineRef} tabIndex={-1} className="rounded-2xl outline-none">
            {incoming ? (
                <div className="flex h-12 items-center gap-3 rounded-2xl bg-muted pl-4 pr-1">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" />
                    <p className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="shrink-0 text-xs font-semibold text-secondary">받은 큐</span>
                        <span className="shrink-0 text-[15px] font-semibold">{incoming.label}</span>
                        <span className="truncate text-[13px] text-muted-foreground">
                            {incoming.from} → {targetLabel(incoming.target)} · {incoming.at}
                        </span>
                    </p>
                    <button type="button" aria-label={`받은 큐 ${incoming.label} 확인`} onClick={() => acknowledge(incoming.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-10 px-4 hover:bg-background')}>
                        <Check className="size-4" aria-hidden="true" />
                        확인
                    </button>
                </div>
            ) : (
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-border px-4 text-muted-foreground">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                    {latest ? (
                        <p className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span className="shrink-0 text-xs font-medium">마지막 큐</span>
                            <span className="shrink-0 text-sm font-medium text-foreground/80">{latest.label}</span>
                            <span className="truncate text-[13px]">
                                {latest.from} → {targetLabel(latest.target)} · {latest.at}
                            </span>
                        </p>
                    ) : (
                        <p className="text-sm">받은 큐 없음</p>
                    )}
                </div>
            )}
        </div>
    );
}

export function MetaChip({ children }: { children: ReactNode }) {
    return <span className="inline-flex h-7 items-center rounded-full bg-muted px-3 text-[13px] font-semibold tabular-nums">{children}</span>;
}

/* ───────────── 오른쪽: 큐 보내기 · 최근 큐 ───────────── */

function CueColumn({
    live,
    locked,
    hideFlash = false,
    dense = false,
    dock,
    dockOpen = false,
}: {
    live: MockLive;
    locked: boolean;
    /** 보낸 큐 확인 알약과 버튼의 보냄 표시를 그리지 않습니다 */
    hideFlash?: boolean;
    /** 큐 버튼을 조금 낮게 */
    dense?: boolean;
    /** 칸 맨 아래 자리. 주면 위 내용(큐 버튼 · 최근 큐)이 남는 높이 안에서 스크롤됩니다 */
    dock?: ReactNode;
    /** dock 이 무언가 보여 주는 동안 최근 큐 목록을 접습니다 */
    dockOpen?: boolean;
}) {
    const flash = hideFlash ? null : live.flash;
    const keyboard = (
        <div className="shrink-0 px-4 pt-4">
            <div className="flex h-12 items-center justify-between gap-2 px-1">
                <h2 className="shrink-0 text-[17px] font-semibold tracking-tight">큐 보내기</h2>
                <div aria-live="polite" aria-atomic="true" className="min-w-0">
                    {flash ? (
                        <span key={flash.id} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-muted pl-2.5 pr-3 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
                            <Check className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                            <span className="truncate">
                                {flash.label} → {targetLabel(flash.target)}에게 보냄
                            </span>
                        </span>
                    ) : null}
                </div>
                {flash ? null : <span className="text-xs text-muted-foreground">{locked ? '잠금 중' : '누르면 바로 보내요'}</span>}
            </div>

            <div className={cn('mt-1 space-y-4', dense && 'space-y-3')}>
                {CUE_ROWS.map((pair) => (
                    <div key={pair.flat().join()} className="grid grid-cols-2 items-start gap-x-2">
                        {pair.map((groups) => (
                            <div key={groups.join()} className="space-y-3">
                                {groups.map((group) => (
                                    <CueGroupBlock key={group} group={group} cues={DRAFT_CUES.filter((cue) => cue.group === group)} flash={flash} locked={locked} onSend={live.sendCue} dense={dense} />
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );

    const recent = (
        <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-border px-5 pt-3.5">
            <div className="flex shrink-0 items-baseline justify-between">
                <h2 className="text-[17px] font-semibold tracking-tight">최근 큐</h2>
                <span className="text-xs text-muted-foreground">받은 사람 확인</span>
            </div>
            <ul className="mt-1 min-h-0 flex-1 divide-y divide-border overflow-y-auto pb-2 [scrollbar-width:thin]">
                {live.log.map((entry) => {
                    const ack = ackOf(entry);
                    return (
                        <li key={entry.id} className="flex h-10 items-center gap-2">
                            <p className="flex min-w-0 flex-1 items-baseline gap-2">
                                <span className="truncate text-sm font-semibold">{entry.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {entry.from} → {targetLabel(entry.target)} · {entry.at}
                                </span>
                            </p>
                            <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', ack.done ? 'font-medium text-brand' : 'text-muted-foreground')}>
                                {ack.done ? <Check className="size-3.5" aria-hidden="true" /> : null}
                                {ack.text}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    if (dock === undefined) {
        return (
            <aside aria-label="큐 보내기와 최근 큐" className="flex min-h-0 flex-col overflow-hidden border-l border-border">
                {keyboard}
                {recent}
            </aside>
        );
    }

    return (
        <aside aria-label="큐 보내기와 최근 큐" className="flex min-h-0 flex-col overflow-hidden border-l border-border">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none]">
                {keyboard}
                {dockOpen ? null : recent}
            </div>
            {dock}
        </aside>
    );
}

function CueGroupBlock({
    group,
    cues,
    flash,
    locked,
    onSend,
    dense = false,
}: {
    group: CueGroup;
    cues: DraftCue[];
    flash: CueLogEntry | null;
    locked: boolean;
    onSend: MockLive['sendCue'];
    dense?: boolean;
}) {
    const target = cues[0]?.target ?? 'all';
    const headingId = `cue-group-${group}`;
    return (
        <section aria-labelledby={headingId}>
            <div className="flex h-5 items-center justify-between px-1">
                <h3 id={headingId} className="text-xs font-medium text-muted-foreground">
                    {CUE_GROUP_LABEL[group]}
                </h3>
                <span className="text-[11px] text-muted-foreground">→ {targetLabel(target)}</span>
            </div>
            <div className={cn('mt-1.5 space-y-2', dense && 'space-y-1.5')}>
                {cues.map((cue) => {
                    const sent = flash !== null && flash.label === cue.label && flash.target === cue.target;
                    return (
                        <button
                            key={cue.id}
                            type="button"
                            disabled={locked}
                            aria-label={`${cue.label} 큐를 ${targetLabel(cue.target)}에게 보내기`}
                            onClick={() => onSend(cue)}
                            className={cn(
                                'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border px-3.5 text-left text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none @min-[1400px]/console:h-12',
                                focusRing,
                                sent ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
                                dense && 'h-10 @min-[1400px]/console:h-11',
                            )}
                        >
                            <span className="truncate">{cue.label}</span>
                            {sent ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
