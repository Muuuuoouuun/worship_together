'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import {
    BellOff,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Headphones,
    Maximize2,
    Megaphone,
    Minimize2,
    Pin,
    Save,
    Send,
    Sun,
    TriangleAlert,
    UsersRound,
    Wifi,
    WifiOff,
    X,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useMockLive, type MockLive } from '../mockLive';
import { useMockPulse, type MockPulse } from './useMockPulse';
import type { DraftToast, ToastKind, ToastTone } from './toastDemo';
import type { PulseDraftProps } from './types';

/*
 * 시안 3 · 무대 플래시 (무대용 어두운 화면)
 *
 * 펄스 — 뒷줄 드럼 · 음향석에서도 보이도록 박마다 화면 가장자리가 번쩍이고(센박은 초록으로 가장 밝게),
 * 화면을 가로지르는 큰 박 칸이 하나씩 흰색으로 켜집니다. 첫 박 칸이 가장 크고, 6/8 은 3+3 으로 묶어 4박째를 중간 강박으로.
 *
 * 알림 — 두 단계.
 *  · 전체 큐(high)는 약 2초 동안 가운데를 크게 덮었다가(박 칸은 가리지 않음) 알림 레일로 접힙니다.
 *  · 나머지는 곧장 레일로. 데스크톱은 오른쪽 320px 레일, 모바일은 위쪽 한 줄 띠(가장 새 알림 + 개수) → 펼치면 목록.
 *  · 연결 끊김 · 저장 오류처럼 남아 있는 알림은 레일 맨 위에 고정하고 경고 · 위험 색으로 둡니다.
 */

type Device = PulseDraftProps['device'];
type Overlay = 'none' | 'songs' | 'notices';

/** 전체 큐가 화면을 덮는 시간 (그 뒤 레일로 접힘) */
const TAKEOVER_MS = 2200;
/** 접히는 움직임 길이 */
const FOLD_MS = 320;

const STICKY_KINDS = new Set<ToastKind>(['offline', 'error']);
const isSticky = (toast: DraftToast) => STICKY_KINDS.has(toast.kind);
const isAssertive = (toast: DraftToast) => toast.urgency === 'high' || toast.tone === 'danger';

const KIND_ICON: Record<ToastKind, LucideIcon> = {
    'cue-all': Megaphone,
    'cue-role': Headphones,
    'cue-sent': Send,
    offline: WifiOff,
    online: Wifi,
    saved: Save,
    error: TriangleAlert,
    team: UsersRound,
};

const KIND_LABEL: Record<ToastKind, string> = {
    'cue-all': '전체 큐',
    'cue-role': '내 역할 큐',
    'cue-sent': '보낸 큐',
    offline: '연결 끊김',
    online: '연결',
    saved: '저장',
    error: '오류',
    team: '팀 소식',
};

/** 아이콘 칸 — 받은 큐(확인 전)만 주황(주의), 나머지는 상태 색 */
const TONE_TILE: Record<ToastTone, string> = {
    cue: 'bg-secondary/15 text-secondary',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-destructive/15 text-destructive',
    info: 'bg-muted text-foreground',
};

const TONE_TEXT: Record<ToastTone, string> = {
    cue: 'text-secondary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
    info: 'text-foreground',
};

/** 고정 알림 바탕 (연결 끊김 · 오류) */
const TONE_PINNED: Record<ToastTone, string> = {
    cue: 'bg-secondary/10 ring-1 ring-inset ring-secondary/30',
    success: 'bg-success/10 ring-1 ring-inset ring-success/30',
    warning: 'bg-warning/10 ring-1 ring-inset ring-warning/35',
    danger: 'bg-destructive/10 ring-1 ring-inset ring-destructive/35',
    info: 'bg-muted ring-1 ring-inset ring-border',
};

interface QuickCue {
    label: string;
    target: string;
}

const QUICK_CUES: QuickCue[] = [
    { label: '다음 섹션', target: '전체' },
    { label: '한 번 더', target: '전체' },
    { label: '엔딩 컷', target: '전체' },
    { label: '빨라요', target: '악기' },
];

interface NoticeHandlers {
    onDismiss: (id: string) => void;
    onAck: (id: string) => void;
    onAction: (id: string) => void;
}

interface TakeoverState {
    toast: DraftToast | null;
    folding: boolean;
    fold: (id: string) => void;
}

interface DeviceActions {
    awake: boolean;
    fullscreen: boolean;
    toggleAwake: () => void;
    toggleFullscreen: () => void;
}

interface ScreenProps {
    framed: boolean;
    live: MockLive;
    sectionBars: number;
    overlay: Overlay;
    setOverlay: (overlay: Overlay) => void;
    /** 레일에 놓일 알림 — 고정 알림이 먼저, 나머지는 새 것부터 (덮고 있는 전체 큐는 빠짐) */
    notices: DraftToast[];
    handlers: NoticeHandlers;
    takeover: TakeoverState;
    inView: boolean;
    onSendCue: (label: string, target: string) => void;
    deviceActions: DeviceActions;
}

export default function PulseFlash({ device, framed = false, toasts, onDismiss, onAck, onAction, onSendCue }: PulseDraftProps) {
    const live = useMockLive();
    const rootRef = useRef<HTMLDivElement>(null);
    const inView = useInView(rootRef);
    const takeover = useTakeover(toasts, inView);
    const deviceActions = useDeviceActions(rootRef, framed);
    const [overlay, setOverlay] = useState<Overlay>('none');
    const { nextSectionStep, prevSectionStep } = live;

    useEffect(() => {
        if (overlay === 'none') return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOverlay('none');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [overlay]);

    // 데스크톱 한 화면: ← → (또는 발표 리모컨의 PageUp/PageDown) 으로 섹션 넘김
    useEffect(() => {
        if (device !== 'desktop' || framed) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
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
    }, [device, framed, nextSectionStep, prevSectionStep]);

    const railed = toasts.filter((toast) => toast.id !== takeover.toast?.id);
    const notices = [...railed.filter(isSticky), ...railed.filter((toast) => !isSticky(toast))];

    const screen: ScreenProps = {
        framed,
        live,
        sectionBars: live.song.chords[live.section]?.length ?? 8,
        overlay,
        setOverlay,
        notices,
        handlers: { onDismiss, onAck, onAction },
        takeover,
        inView,
        onSendCue,
        deviceActions,
    };

    return (
        <div
            ref={rootRef}
            className="dark relative h-full w-full overflow-hidden bg-background text-foreground [container-type:size]"
            data-framed={framed || undefined}
        >
            <PulseClock bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`}>
                {device === 'mobile' ? <MobileScreen {...screen} /> : <DesktopScreen {...screen} />}
                <EdgeGlow device={device} framed={framed} />
            </PulseClock>
            <Announcer toasts={toasts} />
        </div>
    );
}

/* ───────────────────────── 화면 배치 ───────────────────────── */

function MobileScreen({ framed, live, sectionBars, overlay, setOverlay, notices, handlers, takeover, inView, onSendCue, deviceActions }: ScreenProps) {
    const sheetId = useId();
    const now = useNow();
    const next = nextInfo(live);
    const sheetOpen = overlay === 'notices';

    return (
        <div className={cn('relative flex h-full flex-col px-4', framed ? 'pb-5 pt-5' : 'pb-4 pt-3')}>
            {overlay !== 'none' ? <Scrim onClose={() => setOverlay('none')} /> : null}

            <header className="relative z-50 flex h-12 shrink-0 items-center gap-2">
                <SongPicker live={live} size="mobile" open={overlay === 'songs'} onOpenChange={(open) => setOverlay(open ? 'songs' : 'none')} />
                <DeviceToggles actions={deviceActions} />
            </header>

            <div className="relative z-40 mt-2 shrink-0">
                <NoticeStrip
                    notices={notices}
                    now={now}
                    handlers={handlers}
                    open={sheetOpen}
                    sheetId={sheetId}
                    onToggle={() => setOverlay(sheetOpen ? 'none' : 'notices')}
                />
                {sheetOpen ? <NoticeSheet id={sheetId} notices={notices} now={now} handlers={handlers} onClose={() => setOverlay('none')} /> : null}
            </div>

            <div className="mt-4 h-[clamp(5.5rem,48cqh-14rem,9.5rem)] shrink-0">
                <BeatBlocks size="mobile" />
            </div>

            <div className="relative mt-3 flex min-h-0 flex-1 flex-col justify-center">
                <p className="text-xs text-muted-foreground">
                    지금 · 섹션 {live.sectionIndex + 1} / {live.song.form.length}
                </p>
                <SectionName name={live.section} device="mobile" motionKey={`${live.songIndex}-${live.sectionIndex}`} />
                <p className="mt-3 truncate text-lg text-muted-foreground">
                    {next.eyebrow} <span className="font-semibold text-foreground">{next.name}</span>
                </p>
                {takeover.toast ? (
                    <TakeoverBanner
                        device="mobile"
                        toast={takeover.toast}
                        folding={takeover.folding}
                        inView={inView}
                        onFold={takeover.fold}
                        onAck={handlers.onAck}
                        onDismiss={handlers.onDismiss}
                    />
                ) : null}
            </div>

            <div className="mt-3 grid shrink-0 grid-cols-2 border-t border-border pt-3">
                <BarCount total={sectionBars} size="mobile" className="pr-4" />
                <TempoCell bpm={live.bpm} meter={live.song.meter} className="border-l border-border pl-4" />
            </div>

            <CueButtons cues={QUICK_CUES.slice(0, 3)} layout="mobile" onSendCue={onSendCue} className="mt-3" />

            <div className="mt-2.5 flex h-14 shrink-0 gap-2">
                <button
                    type="button"
                    onClick={live.prevSectionStep}
                    disabled={live.songIndex === 0 && live.sectionIndex === 0}
                    className={cn(buttonVariants({ variant: 'outline' }), 'h-14 w-[5.5rem] shrink-0 text-[15px]')}
                >
                    <ChevronLeft aria-hidden="true" className="size-5" />
                    이전
                </button>
                <button
                    type="button"
                    onClick={live.nextSectionStep}
                    disabled={!live.nextSection && !live.nextSong}
                    aria-label={`다음 섹션: ${next.name}`}
                    className={cn(buttonVariants(), 'h-14 min-w-0 flex-1 justify-between px-5 text-[15px]')}
                >
                    <span className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0">다음 섹션</span>
                        <span className="truncate text-sm font-medium text-primary-foreground/55">{next.name}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5" />
                </button>
            </div>
        </div>
    );
}

function DesktopScreen({ live, sectionBars, overlay, setOverlay, notices, handlers, takeover, inView, onSendCue, deviceActions }: ScreenProps) {
    const now = useNow();
    const next = nextInfo(live);

    return (
        <div className="relative flex h-full">
            <section aria-label="펄스" className="relative flex min-w-0 flex-1 flex-col px-10 pb-8 pt-5 [container-type:size]">
                {overlay !== 'none' ? <Scrim onClose={() => setOverlay('none')} /> : null}

                <header className="relative z-40 flex h-14 shrink-0 items-center gap-6">
                    <SongPicker live={live} size="desktop" open={overlay === 'songs'} onOpenChange={(open) => setOverlay(open ? 'songs' : 'none')} />
                    <p className="ml-auto flex shrink-0 items-baseline gap-2">
                        <span className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums">{live.bpm}</span>
                        <span className="text-sm text-muted-foreground">BPM · {live.song.meter}</span>
                    </p>
                    <DeviceToggles actions={deviceActions} labels />
                </header>

                <div className="mt-5 h-[clamp(7rem,24cqh,12rem)] shrink-0">
                    <BeatBlocks size="desktop" />
                </div>

                <div className="relative mt-4 flex min-h-0 flex-1 flex-col justify-center">
                    <p className="text-sm text-muted-foreground">
                        지금 · 섹션 {live.sectionIndex + 1} / {live.song.form.length}
                    </p>
                    <SectionName name={live.section} device="desktop" motionKey={`${live.songIndex}-${live.sectionIndex}`} />
                    {takeover.toast ? (
                        <TakeoverBanner
                            device="desktop"
                            toast={takeover.toast}
                            folding={takeover.folding}
                            inView={inView}
                            onFold={takeover.fold}
                            onAck={handlers.onAck}
                            onDismiss={handlers.onDismiss}
                        />
                    ) : null}
                </div>

                <div className="mt-4 flex h-[clamp(5rem,15cqh,7rem)] shrink-0 items-stretch gap-3">
                    <button
                        type="button"
                        onClick={live.prevSectionStep}
                        disabled={live.songIndex === 0 && live.sectionIndex === 0}
                        aria-label="이전 섹션"
                        className={cn(buttonVariants({ variant: 'outline' }), 'aspect-square h-full rounded-3xl')}
                    >
                        <ChevronLeft aria-hidden="true" className="size-8" />
                    </button>
                    <button
                        type="button"
                        onClick={live.nextSectionStep}
                        disabled={!live.nextSection && !live.nextSong}
                        className="group flex min-w-0 flex-1 items-center justify-between gap-4 rounded-3xl bg-card px-6 text-left ring-1 ring-inset ring-border transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-40"
                    >
                        <span className="min-w-0">
                            <span className="block text-sm text-muted-foreground">{next.eyebrow === '다음' ? '다음 섹션' : next.eyebrow}</span>
                            <span className="mt-1 block truncate text-[clamp(1.75rem,5cqw,3.25rem)] font-semibold leading-none tracking-tight text-foreground/80">
                                {next.name}
                            </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="size-8 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </button>
                    <BarCount total={sectionBars} size="desktop" className="ml-5 w-[clamp(9rem,22cqw,13rem)] shrink-0" />
                </div>
            </section>

            <NoticeRail notices={notices} now={now} handlers={handlers} onSendCue={onSendCue} />
        </div>
    );
}

function nextInfo(live: MockLive) {
    if (live.nextSection) return { eyebrow: '다음', name: live.nextSection };
    if (live.nextSong) return { eyebrow: '다음 곡', name: live.nextSong.title };
    return { eyebrow: '다음', name: '마지막 섹션' };
}

function Scrim({ onClose }: { onClose: () => void }) {
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 z-30 cursor-default bg-background/70 animate-in fade-in-0 motion-reduce:animate-none"
        />
    );
}

/* ───────────────────────── 박 (펄스) ───────────────────────── */

const PulseContext = createContext<MockPulse | null>(null);

/** 박 시계 하나를 화면 전체가 나눠 씁니다. 박마다 다시 그려지는 건 박 칸 · 마디 · 가장자리 빛뿐. */
function PulseClock({ bpm, meter, resetKey, children }: { bpm: number; meter: string; resetKey: string; children: ReactNode }) {
    const pulse = useMockPulse({ bpm, meter, resetKey });
    return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

function usePulse() {
    const pulse = useContext(PulseContext);
    if (!pulse) throw new Error('usePulse 는 PulseClock 안에서 씁니다');
    return pulse;
}

/** 화면 가장자리 빛 — 센박은 초록으로 가장 밝게, 6/8 의 4박은 중간, 나머지는 옅게. 움직임 줄이기에서는 끕니다. */
function EdgeGlow({ device, framed }: { device: Device; framed: boolean }) {
    const { blink, count, downbeat, secondary, intervalMs } = usePulse();
    const on = blink && count > 0;
    const strength = downbeat ? 1 : secondary ? 0.6 : 0.32;
    const fade: CSSProperties = { transitionProperty: 'opacity', transitionDuration: on ? '0ms' : `${Math.round(intervalMs * 0.6)}ms` };
    const layer = cn('absolute inset-0 ease-out', framed && device === 'mobile' && 'rounded-[2.75rem]');
    // 또렷한 가장자리 선(멀리서 박을 읽는 신호) + 그보다 훨씬 옅은 안쪽 빛(글자를 덮지 않게)
    return (
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-[60] motion-reduce:hidden', downbeat ? 'text-brand' : 'text-primary')}>
            <div
                className={cn(layer, device === 'desktop' ? 'shadow-[inset_0_0_0_6px_currentColor]' : 'shadow-[inset_0_0_0_4px_currentColor]')}
                style={{ ...fade, opacity: on ? strength : 0 }}
            />
            <div
                className={cn(layer, device === 'desktop' ? 'shadow-[inset_0_0_120px_6px_currentColor]' : 'shadow-[inset_0_0_64px_2px_currentColor]')}
                style={{ ...fade, opacity: on ? strength * 0.42 : 0 }}
            />
        </div>
    );
}

const beatWeight = (beat: number, beatsPerBar: number) => (beat === 1 ? 1.6 : beatsPerBar === 6 && beat === 4 ? 1.25 : 1);
const beatHeight = (beat: number, beatsPerBar: number) => (beat === 1 ? 100 : beatsPerBar === 6 && beat === 4 ? 86 : 72);

/** 큰 박 칸 — 지금 박은 흰색, 지난 박은 옅게 남고, 첫 박 칸이 가장 큽니다. 6/8 은 3+3 묶음. */
function BeatBlocks({ size }: { size: Device }) {
    const { beatsPerBar, count, blink } = usePulse();
    const beats = Array.from({ length: beatsPerBar }, (_, index) => index + 1);
    const groups = beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];
    const desktop = size === 'desktop';

    return (
        <div aria-hidden="true" className={cn('flex h-full items-end', desktop ? 'gap-8' : 'gap-4')}>
            {groups.map((group) => (
                <div
                    key={group[0]}
                    className={cn('flex h-full min-w-0 items-end', desktop ? 'gap-3' : groups.length > 1 ? 'gap-1' : 'gap-1.5')}
                    style={{ flexGrow: group.reduce((sum, beat) => sum + beatWeight(beat, beatsPerBar), 0), flexBasis: 0 }}
                >
                    {group.map((beat) => {
                        const active = count === beat;
                        const passed = count > beat;
                        const down = beat === 1;
                        const mid = beatsPerBar === 6 && beat === 4;
                        return (
                            <div
                                key={beat}
                                data-beat={beat}
                                data-active={active || undefined}
                                data-blink={(active && blink) || undefined}
                                className={cn(
                                    'relative flex min-w-0 origin-bottom items-end transition-[background-color,color,scale,box-shadow] ease-out',
                                    desktop ? 'rounded-3xl p-4' : 'rounded-2xl p-2.5',
                                    active
                                        ? cn('bg-primary text-primary-foreground', blink ? 'duration-0' : 'duration-200')
                                        : passed
                                          ? 'bg-foreground/[0.16] text-foreground/70 duration-150'
                                          : 'bg-foreground/[0.06] text-muted-foreground duration-150',
                                    active && blink && 'motion-safe:scale-[1.035]',
                                    // 센박은 켜져 있는 동안 초록 테두리 — 움직임 줄이기에서도 첫 박이 구별됩니다
                                    active && down && 'ring-4 ring-brand/60',
                                    active && blink && (down ? 'motion-safe:ring-[6px] motion-safe:ring-brand/50' : 'motion-safe:ring-[6px] motion-safe:ring-primary/15'),
                                    !active && down && 'ring-1 ring-inset ring-brand/40',
                                )}
                                style={{ flexGrow: beatWeight(beat, beatsPerBar), flexBasis: 0, height: `${beatHeight(beat, beatsPerBar)}%` }}
                            >
                                <span
                                    className={cn(
                                        'font-semibold leading-none tabular-nums',
                                        desktop ? (down ? 'text-5xl' : mid ? 'text-4xl' : 'text-3xl') : down ? 'text-2xl' : mid ? 'text-lg' : 'text-base',
                                    )}
                                >
                                    {beat}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/** 마디 n / N — 섹션의 마디 수로 돌아갑니다 */
function BarCount({ total, size, className }: { total: number; size: Device; className?: string }) {
    const { bar } = usePulse();
    const current = ((bar - 1) % total) + 1;
    const desktop = size === 'desktop';
    return (
        <div className={cn('flex min-w-0 flex-col justify-end', className)}>
            <p className={cn('text-muted-foreground', desktop ? 'text-sm' : 'text-[11px]')}>마디</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-semibold leading-none tracking-tight tabular-nums">
                <span className={desktop ? 'text-[clamp(3rem,8cqw,4.75rem)]' : 'text-[2.5rem]'}>{current}</span>
                <span className={cn('text-muted-foreground', desktop ? 'text-3xl' : 'text-lg')}>/ {total}</span>
            </p>
            <div aria-hidden="true" className={cn('flex gap-1', desktop ? 'mt-3' : 'mt-2.5')}>
                {Array.from({ length: total }, (_, index) => (
                    <span
                        key={index}
                        className={cn(
                            'h-1 flex-1 rounded-full',
                            index + 1 === current ? 'bg-primary' : index + 1 < current ? 'bg-foreground/40' : 'bg-foreground/[0.12]',
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

function TempoCell({ bpm, meter, className }: { bpm: number; meter: string; className?: string }) {
    return (
        <div className={cn('flex min-w-0 flex-col justify-end', className)}>
            <p className="text-[11px] text-muted-foreground">템포</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-semibold leading-none tracking-tight">
                <span className="text-[2.5rem] tabular-nums">{bpm}</span>
                <span className="text-sm font-medium text-muted-foreground">BPM</span>
            </p>
            <p className="mt-1.5 text-xs leading-none text-muted-foreground">{meter === '6/8' ? '6/8 · 3+3 묶음' : `${meter} · 한 마디 4박`}</p>
        </div>
    );
}

function SectionName({ name, device, motionKey }: { name: string; device: Device; motionKey: string }) {
    const length = Math.max(name.length, 4);
    const fontSize =
        device === 'desktop'
            ? `min(14rem, calc((100cqw - 5rem) / ${(length * 0.6).toFixed(2)}), 30cqh)`
            : `min(5.5rem, calc((100cqw - 2rem) / ${(length * 0.62).toFixed(2)}))`;
    return (
        <p
            key={motionKey}
            className="overflow-hidden text-ellipsis whitespace-nowrap py-[0.04em] font-semibold leading-[0.92] tracking-[-0.035em] animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
            style={{ fontSize }}
        >
            {name}
        </p>
    );
}

/* ───────────────────────── 위 막대 ───────────────────────── */

function SongPicker({ live, size, open, onOpenChange }: { live: MockLive; size: Device; open: boolean; onOpenChange: (open: boolean) => void }) {
    const panelId = useId();
    const desktop = size === 'desktop';
    return (
        <div className="relative min-w-0 flex-1">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onOpenChange(!open)}
                className="flex min-w-0 max-w-full flex-col items-start rounded-2xl py-1 pr-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span className={cn('flex items-center gap-1.5 text-muted-foreground', desktop ? 'text-xs' : 'text-[11px]')}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    진행 중 · {live.songIndex + 1} / {live.songs.length}곡
                </span>
                <span className="mt-0.5 flex min-w-0 max-w-full items-center gap-1.5">
                    <span className={cn('truncate font-semibold tracking-tight', desktop ? 'text-xl' : 'text-base')}>{live.song.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">Key {live.song.key}</span>
                    <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                </span>
                <span className="sr-only">— 곡 바꾸기</span>
            </button>
            {open ? (
                <div
                    id={panelId}
                    role="group"
                    aria-label="곡 바꾸기"
                    className="absolute left-0 top-full z-50 mt-2 w-[min(21rem,calc(100cqw-2rem))] rounded-3xl bg-card p-2 shadow-2xl shadow-background ring-1 ring-border animate-in fade-in-0 slide-in-from-top-2 motion-reduce:animate-none"
                >
                    <p className="px-3 pb-1.5 pt-2 text-[11px] text-muted-foreground">곡 바꾸기 · 6/8 곡은 박 칸이 3+3 으로 바뀌어요</p>
                    <ul>
                        {live.songs.map((song, index) => {
                            const current = index === live.songIndex;
                            return (
                                <li key={song.id}>
                                    <button
                                        type="button"
                                        aria-current={current ? 'true' : undefined}
                                        onClick={() => {
                                            if (!current) live.goSong(index);
                                            onOpenChange(false);
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring',
                                            current && 'bg-muted',
                                        )}
                                    >
                                        <span className="w-4 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[15px] font-semibold">{song.title}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                Key {song.key} · {song.bpm} BPM · {song.meter}
                                            </span>
                                        </span>
                                        {current ? <Check aria-hidden="true" className="size-4 shrink-0 text-brand" /> : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function DeviceToggles({ actions, labels = false }: { actions: DeviceActions; labels?: boolean }) {
    const FullIcon = actions.fullscreen ? Minimize2 : Maximize2;
    const toggle = (pressed: boolean) =>
        cn(
            buttonVariants({ variant: pressed ? 'default' : 'outline', size: labels ? 'sm' : 'icon' }),
            // 좁은 데스크톱(1024)에서는 글자를 숨기고 동그란 아이콘 버튼으로
            labels ? '@max-3xl:size-10' : 'size-10',
        );
    return (
        <div className="flex shrink-0 items-center gap-1.5">
            <button
                type="button"
                aria-pressed={actions.awake}
                aria-label={labels ? undefined : '화면 꺼짐 방지'}
                title="화면 꺼짐 방지"
                onClick={actions.toggleAwake}
                className={toggle(actions.awake)}
            >
                <Sun aria-hidden="true" />
                {labels ? <span className="@max-3xl:sr-only">화면 꺼짐 방지</span> : null}
            </button>
            <button
                type="button"
                aria-pressed={actions.fullscreen}
                aria-label={labels ? undefined : '전체화면'}
                title="전체화면"
                onClick={actions.toggleFullscreen}
                className={toggle(actions.fullscreen)}
            >
                <FullIcon aria-hidden="true" />
                {labels ? <span className="@max-3xl:sr-only">전체화면</span> : null}
            </button>
        </div>
    );
}

function CueButtons({ cues, layout, onSendCue, className }: { cues: QuickCue[]; layout: Device; onSendCue: (label: string, target: string) => void; className?: string }) {
    const [sent, markSent] = useSentFlash();
    const desktop = layout === 'desktop';
    return (
        <div className={cn('grid shrink-0 gap-2', desktop ? 'grid-cols-2' : 'grid-cols-3', className)}>
            {cues.map((cue) => {
                const done = sent === cue.label;
                return (
                    <button
                        key={cue.label}
                        type="button"
                        aria-label={`큐 보내기: ${cue.label} → ${cue.target}`}
                        onClick={() => {
                            onSendCue(cue.label, cue.target);
                            markSent(cue.label);
                        }}
                        className={cn(
                            buttonVariants({ variant: 'secondary', size: 'sm' }),
                            desktop ? 'h-14 flex-col items-start justify-center gap-0.5 rounded-2xl px-4 text-left' : 'h-11 px-2 text-[13px]',
                            done && 'bg-success/15 text-success hover:bg-success/15',
                        )}
                    >
                        {desktop ? (
                            <>
                                <span className="flex items-center gap-1.5 text-sm font-semibold">
                                    {done ? <Check aria-hidden="true" className="size-3.5" /> : null}
                                    {done ? '보냄' : cue.label}
                                </span>
                                <span className={cn('text-[11px] font-medium', done ? 'text-success/80' : 'text-muted-foreground')}>→ {cue.target}</span>
                            </>
                        ) : (
                            <>
                                {done ? <Check aria-hidden="true" className="size-3.5" /> : <Megaphone aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                                {done ? '보냄' : cue.label}
                            </>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/* ───────────────────────── 알림: 덮기 → 레일 ───────────────────────── */

function TakeoverBanner({
    device,
    toast,
    folding,
    inView,
    onFold,
    onAck,
    onDismiss,
}: {
    device: Device;
    toast: DraftToast;
    folding: boolean;
    inView: boolean;
    onFold: (id: string) => void;
    onAck: (id: string) => void;
    onDismiss: (id: string) => void;
}) {
    const desktop = device === 'desktop';
    const sender = senderLine(toast);
    const acked = Boolean(toast.acked);
    // 흰 카드(받음) → 확인하면 초록 카드(확인함)로 바뀌어 멀리서도 '확인됐다'가 보입니다
    const soft = acked ? 'text-brand-foreground/70' : 'text-primary-foreground/65';
    const eyebrow = (
        <span className={cn('flex min-w-0 items-center gap-2.5 font-medium', soft, desktop ? 'text-base' : 'text-sm')}>
            {acked ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
            ) : (
                <span aria-hidden="true" className="relative flex size-3 shrink-0">
                    <span className="absolute inset-0 animate-ping rounded-full bg-secondary/70 motion-reduce:hidden" />
                    <span className="relative size-3 rounded-full bg-secondary" />
                </span>
            )}
            <span className="truncate">
                {KIND_LABEL[toast.kind]}
                {sender ? ` · ${sender}` : ''}
            </span>
        </span>
    );
    const ack = acked ? (
        <span
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full bg-brand-foreground/10 font-semibold animate-in zoom-in-95 motion-reduce:animate-none',
                desktop ? 'h-16 px-9 text-lg' : 'h-12 w-full text-base [@container(max-height:700px)]:h-11',
            )}
        >
            <Check aria-hidden="true" className="size-5" />
            확인함
        </span>
    ) : (
        <button
            type="button"
            onClick={() => onAck(toast.id)}
            aria-label={`확인: ${toast.title}`}
            className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-primary-foreground text-primary hover:bg-primary-foreground/90 focus-visible:ring-primary-foreground/40 focus-visible:ring-offset-primary [&_svg]:size-5',
                desktop ? 'h-16 px-10 text-lg' : 'h-12 w-full text-base [@container(max-height:700px)]:h-11',
            )}
        >
            <Check aria-hidden="true" />
            확인
        </button>
    );

    return (
        // 섹션 자리만 덮습니다 — 박 칸, 마디 · 템포 줄, 아래 큐 · 넘김 버튼은 그대로 보입니다
        <div
            className={cn(
                'absolute z-20 flex bg-background transition-colors duration-300',
                desktop ? 'inset-0 items-center' : 'inset-x-0 top-0 min-h-full flex-col',
                folding && 'bg-transparent',
            )}
        >
            <div
                className={cn(
                    // 무대 빛: 카드 둘레에 같은 색의 옅은 빛 (토큰 색 + 투명도)
                    'relative flex w-full flex-1 flex-col overflow-hidden rounded-[2rem] transition-[translate,scale,opacity,background-color,color] duration-300 ease-in',
                    acked
                        ? 'bg-brand text-brand-foreground shadow-[0_0_64px_-6px] shadow-brand/45'
                        : 'bg-primary text-primary-foreground shadow-[0_0_64px_-6px] shadow-primary/35',
                    'animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none',
                    folding && (desktop ? 'translate-x-1/3 scale-50 opacity-0' : '-translate-y-1/2 scale-75 opacity-0'),
                    folding && 'motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:scale-100',
                )}
            >
                {desktop ? (
                    <div className="flex items-center gap-10 py-9 pl-10 pr-12">
                        <button
                            type="button"
                            onClick={() => onFold(toast.id)}
                            className="min-w-0 flex-1 rounded-2xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-current/40"
                        >
                            {eyebrow}
                            <span className="mt-3 block truncate py-[0.04em] text-[clamp(3rem,9cqw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">{toast.title}</span>
                            {toast.body ? <span className={cn('mt-3 block truncate text-2xl', soft)}>{toast.body}</span> : null}
                            <span className="sr-only">, 눌러서 알림 레일로 접기</span>
                        </button>
                        <div className="shrink-0">{ack}</div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col px-5 pb-5 pt-4 [@container(max-height:700px)]:pb-4 [@container(max-height:700px)]:pt-3">
                        <div className="pr-10">{eyebrow}</div>
                        <button
                            type="button"
                            onClick={() => onFold(toast.id)}
                            className="my-auto min-w-0 rounded-2xl py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-current/40 [@container(max-height:700px)]:py-1.5"
                        >
                            <span className="block truncate py-[0.04em] text-[2.75rem] font-semibold leading-none tracking-[-0.03em] [@container(max-height:700px)]:text-[2.375rem]">
                                {toast.title}
                            </span>
                            {toast.body ? <span className={cn('mt-2 block truncate text-base [@container(max-height:700px)]:mt-1', soft)}>{toast.body}</span> : null}
                            <span className="sr-only">, 눌러서 알림 띠로 접기</span>
                        </button>
                        {ack}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    aria-label={`${toast.title} 알림 닫기`}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                        'absolute right-3 top-3 text-current opacity-60 hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-current/40 focus-visible:ring-offset-0',
                    )}
                >
                    <X aria-hidden="true" />
                </button>
                {inView && !acked && !folding ? (
                    <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-1 origin-left animate-toast-progress bg-primary-foreground/20 motion-reduce:hidden"
                        style={{ '--toast-duration': `${TAKEOVER_MS}ms` } as CSSProperties}
                    />
                ) : null}
            </div>
        </div>
    );
}

/** 모바일: 위쪽 한 줄 띠 — 가장 새 알림(확인할 큐가 있으면 그것) + 개수, 누르면 목록이 펼쳐집니다 */
function NoticeStrip({
    notices,
    now,
    handlers,
    open,
    sheetId,
    onToggle,
}: {
    notices: DraftToast[];
    now: number;
    handlers: NoticeHandlers;
    open: boolean;
    sheetId: string;
    onToggle: () => void;
}) {
    if (!notices.length) {
        return (
            // 비어 있을 때도 자리를 지켜 알림이 와도 박 칸이 밀리지 않습니다. 같은 자리에 연결 끊김이 뜨므로 지금 연결 상태를 함께 둡니다.
            <div className="flex h-[52px] items-center gap-2.5 rounded-2xl px-4 text-sm text-muted-foreground ring-1 ring-inset ring-border">
                <BellOff aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">새 알림 없음</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    연결됨
                </span>
            </div>
        );
    }

    const pinned = notices.filter(isSticky);
    const rest = notices.filter((toast) => !isSticky(toast));
    const featured = rest.find((toast) => toast.ackable) ?? rest[0] ?? pinned[0];
    const chips = pinned.filter((toast) => toast.id !== featured.id);
    const waiting = notices.some((toast) => toast.ackable && !toast.acked && toast.id !== featured.id);
    const featuredSticky = isSticky(featured);
    const Icon = featured.acked ? Check : KIND_ICON[featured.kind];
    const meta = [featuredSticky ? `${KIND_LABEL[featured.kind]} · 고정` : senderLine(featured) ?? featured.body ?? KIND_LABEL[featured.kind], timeLabel(featured, now)]
        .filter(Boolean)
        .join(' · ');

    return (
        <div
            className={cn(
                'relative flex h-[52px] items-center gap-1.5 overflow-hidden rounded-2xl px-1.5',
                featuredSticky ? TONE_PINNED[featured.tone] : 'bg-card ring-1 ring-inset ring-border',
            )}
        >
            {chips.length ? (
                // 고정 알림은 한 칸에 아이콘만 — 가장 심각한 색(오류 > 연결 끊김)으로 칠합니다
                <span
                    className={cn(
                        'flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl',
                        chips.length > 1 ? 'px-2.5' : 'w-9',
                        TONE_TILE[chips.some((chip) => chip.tone === 'danger') ? 'danger' : chips[0].tone],
                    )}
                >
                    {chips.map((chip) => {
                        const ChipIcon = KIND_ICON[chip.kind];
                        return (
                            <span key={chip.id} className={cn('flex', TONE_TEXT[chip.tone])}>
                                <ChipIcon aria-hidden="true" className="size-4" />
                                <span className="sr-only">고정 알림: {chip.title}</span>
                            </span>
                        );
                    })}
                </span>
            ) : null}
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={sheetId}
                className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl pl-0.5 pr-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span
                    key={featured.id}
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl animate-in zoom-in-90 motion-reduce:animate-none',
                        featured.acked ? TONE_TILE.success : TONE_TILE[featured.tone],
                    )}
                >
                    <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-5">{featured.title}</span>
                    <span className={cn('block truncate text-xs leading-4', featuredSticky ? TONE_TEXT[featured.tone] : 'text-muted-foreground')}>{meta}</span>
                </span>
            </button>
            <NoticeActions toast={featured} handlers={handlers} compact />
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={sheetId}
                aria-label={open ? '알림 목록 접기' : `알림 ${notices.length}개 모두 보기`}
                className="flex h-10 shrink-0 items-center gap-0.5 rounded-full pl-1.5 pr-1 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span
                    className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                        waiting ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-foreground',
                    )}
                >
                    {notices.length}
                </span>
                {open ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            </button>
            <TimeLeft key={featured.id} toast={featured} />
        </div>
    );
}

function NoticeSheet({ id, notices, now, handlers, onClose }: { id: string; notices: DraftToast[]; now: number; handlers: NoticeHandlers; onClose: () => void }) {
    return (
        <div
            id={id}
            role="region"
            aria-label="알림 목록"
            className="absolute inset-x-0 top-full z-40 mt-2 max-h-[calc(100cqh-9rem)] overflow-y-auto rounded-3xl bg-card p-2 shadow-2xl shadow-background ring-1 ring-border animate-in fade-in-0 slide-in-from-top-2 motion-reduce:animate-none"
        >
            <div className="flex items-center gap-2 pb-2 pl-3 pr-1 pt-1">
                <p className="text-[15px] font-semibold">
                    알림 <span className="tabular-nums text-muted-foreground">{notices.length}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">옆으로 밀면 지워져요</p>
                <button type="button" onClick={onClose} aria-label="알림 목록 접기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'ml-auto shrink-0 text-muted-foreground')}>
                    <ChevronUp aria-hidden="true" />
                </button>
            </div>
            {notices.length ? (
                <ul className="space-y-1.5">
                    {notices.map((toast) => (
                        <NoticeRow key={toast.id} toast={toast} now={now} handlers={handlers} swipe />
                    ))}
                </ul>
            ) : (
                <p className="px-3 pb-5 pt-3 text-center text-sm text-muted-foreground">새 알림이 없어요</p>
            )}
        </div>
    );
}

/** 데스크톱: 오른쪽 알림 레일 — 고정 알림이 맨 위, 아래에 큐 보내기 */
function NoticeRail({ notices, now, handlers, onSendCue }: { notices: DraftToast[]; now: number; handlers: NoticeHandlers; onSendCue: (label: string, target: string) => void }) {
    // 고정 알림(연결 끊김 · 오류)은 상태가 풀릴 때까지 남겨 두고, 지난 알림만 한 번에 지웁니다
    const clearable = notices.filter((toast) => !isSticky(toast));
    return (
        <aside aria-label="알림 레일" className="relative flex w-80 shrink-0 flex-col border-l border-border bg-card">
            <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-6">
                <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">받은 큐 · 연결 · 앱 알림</p>
                    <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight">
                        알림 <span className="tabular-nums text-muted-foreground">{notices.length}</span>
                    </h2>
                </div>
                {clearable.length > 1 ? (
                    <button
                        type="button"
                        onClick={() => clearable.forEach((toast) => handlers.onDismiss(toast.id))}
                        aria-label={clearable.length < notices.length ? '고정 알림 빼고 모두 지우기' : undefined}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-muted-foreground')}
                    >
                        모두 지우기
                    </button>
                ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
                {notices.length ? (
                    <ul className="space-y-2">
                        {notices.map((toast) => (
                            <NoticeRow key={toast.id} toast={toast} now={now} handlers={handlers} />
                        ))}
                    </ul>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <BellOff aria-hidden="true" className="size-[18px]" />
                        </span>
                        <p className="mt-3 text-sm font-semibold">새 알림이 없어요</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">전체 큐는 화면 가운데에 크게 떴다가 이곳으로 접혀요</p>
                    </div>
                )}
            </div>
            <div className="border-t border-border px-4 pb-5 pt-4">
                <p className="flex items-center justify-between px-1 pb-2.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">큐 보내기</span>
                    <span>누르면 바로 보내요</span>
                </p>
                <CueButtons cues={QUICK_CUES} layout="desktop" onSendCue={onSendCue} />
            </div>
        </aside>
    );
}

function NoticeRow({ toast, now, handlers, swipe = false }: { toast: DraftToast; now: number; handlers: NoticeHandlers; swipe?: boolean }) {
    const { style, bind } = useSwipeDismiss(() => handlers.onDismiss(toast.id), swipe);
    const sticky = isSticky(toast);
    const Icon = toast.acked ? Check : KIND_ICON[toast.kind];
    const sender = senderLine(toast);
    const waiting = Boolean(toast.ackable && !toast.acked);

    return (
        <li
            className={cn(
                'relative touch-pan-y overflow-hidden rounded-2xl animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none',
                sticky ? TONE_PINNED[toast.tone] : waiting && toast.urgency === 'high' ? 'bg-muted/60 ring-1 ring-inset ring-secondary/40' : 'bg-muted/60',
            )}
            style={style}
            {...bind}
        >
            <div className="flex gap-3 py-3 pl-3 pr-11">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', toast.acked ? TONE_TILE.success : TONE_TILE[toast.tone])}>
                    <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                        {waiting ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-secondary" /> : null}
                        {sticky ? <Pin aria-hidden="true" className={cn('size-3 shrink-0', TONE_TEXT[toast.tone])} /> : null}
                        <span className={cn('shrink-0 font-medium', sticky ? TONE_TEXT[toast.tone] : 'text-foreground/80')}>
                            {KIND_LABEL[toast.kind]}
                            {sticky ? ' · 고정' : ''}
                        </span>
                        {sender ? (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{sender}</span>
                            </>
                        ) : null}
                        <span className="ml-auto shrink-0 pl-1">{timeLabel(toast, now)}</span>
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold leading-5">{toast.title}</p>
                    {toast.body ? <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{toast.body}</p> : null}
                    <NoticeActions toast={toast} handlers={handlers} className="mt-2" />
                </div>
            </div>
            <button
                type="button"
                onClick={() => handlers.onDismiss(toast.id)}
                aria-label={`${toast.title} 알림 닫기`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground')}
            >
                <X aria-hidden="true" />
            </button>
            <TimeLeft toast={toast} />
        </li>
    );
}

/** 알림 버튼 — 받은 큐 '확인'(누르면 잠깐 '확인함'), 실행 취소 · 다시 시도 · 보기, 보낸 큐의 확인 현황 */
function NoticeActions({ toast, handlers, compact = false, className }: { toast: DraftToast; handlers: NoticeHandlers; compact?: boolean; className?: string }) {
    const parts: ReactNode[] = [];
    if (toast.ackable) {
        parts.push(
            toast.acked ? (
                <span key="acked" className="inline-flex h-8 shrink-0 items-center gap-1 px-1.5 text-xs font-semibold text-success animate-in zoom-in-95 motion-reduce:animate-none">
                    <Check aria-hidden="true" className="size-3.5" />
                    확인함
                </span>
            ) : (
                <button
                    key="ack"
                    type="button"
                    onClick={() => handlers.onAck(toast.id)}
                    aria-label={`확인: ${toast.title}`}
                    className={cn(buttonVariants({ size: 'xs' }), 'shrink-0 px-3.5')}
                >
                    확인
                </button>
            ),
        );
    }
    if (toast.action) {
        parts.push(
            <button
                key="action"
                type="button"
                onClick={() => handlers.onAction(toast.id)}
                aria-label={`${toast.action}: ${toast.title}`}
                className={cn(buttonVariants({ variant: toast.tone === 'danger' ? 'default' : 'outline', size: 'xs' }), 'shrink-0')}
            >
                {toast.action}
            </button>,
        );
    }
    if (toast.progress && !compact) {
        const { done, total } = toast.progress;
        parts.push(
            <span key="progress" className="flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden="true" className="h-1 w-14 overflow-hidden rounded-full bg-foreground/15">
                    <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((done / Math.max(total, 1)) * 100)}%` }} />
                </span>
                <span className="tabular-nums">
                    확인 {done}/{total}
                </span>
            </span>,
        );
    }
    if (toast.progress && compact) {
        parts.push(
            <span key="progress" className="shrink-0 px-1 text-xs font-semibold tabular-nums text-success">
                {toast.progress.done}/{toast.progress.total}
            </span>,
        );
    }
    if (!parts.length) return null;
    return <div className={cn('flex shrink-0 flex-wrap items-center gap-2', compact && 'flex-nowrap gap-1', className)}>{parts}</div>;
}

/** 자동으로 닫히는 알림의 남은 시간 (아래 얇은 선) */
function TimeLeft({ toast }: { toast: DraftToast }) {
    const ref = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element || !toast.ttl) return;
        const elapsed = toast.createdAt ? Math.max(0, Date.now() - toast.createdAt) : 0;
        element.style.setProperty('--toast-duration', `${toast.ttl}ms`);
        element.style.animationDelay = `${-Math.min(elapsed, toast.ttl)}ms`;
    }, [toast.createdAt, toast.ttl]);
    if (!toast.ttl || toast.acked) return null;
    return <span ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left animate-toast-progress bg-foreground/30 motion-reduce:hidden" />;
}

/** 화면에 보이는 알림과 별개로, 화면 읽기 프로그램에 읽어 주는 영역 — 급한 큐 · 오류는 바로(alert), 나머지는 차례로(status) */
function Announcer({ toasts }: { toasts: DraftToast[] }) {
    const ordered = [...toasts].reverse();
    const speak = (toast: DraftToast) =>
        [KIND_LABEL[toast.kind], toast.title, toast.body, senderLine(toast), toast.ackable ? '확인 버튼이 있어요' : null, toast.action ? `${toast.action} 버튼이 있어요` : null]
            .filter(Boolean)
            .join('. ');
    return (
        <>
            <div role="status" aria-live="polite" className="sr-only">
                {ordered.filter((toast) => !isAssertive(toast)).map((toast) => (
                    <p key={toast.id}>{speak(toast)}</p>
                ))}
            </div>
            <div role="alert" aria-live="assertive" className="sr-only">
                {ordered.filter(isAssertive).map((toast) => (
                    <p key={toast.id}>{speak(toast)}</p>
                ))}
            </div>
        </>
    );
}

function senderLine(toast: DraftToast) {
    if (toast.from && toast.target) return `${toast.from} → ${toast.target}`;
    if (toast.from) return toast.from;
    if (toast.target) return `나 → ${toast.target}`;
    return null;
}

function timeLabel(toast: DraftToast, now: number) {
    if (!toast.createdAt || !now) return '방금';
    const seconds = Math.max(0, Math.round((now - toast.createdAt) / 1000));
    if (seconds < 60) return '방금';
    return `${Math.floor(seconds / 60)}분 전`;
}

/* ───────────────────────── 훅 ───────────────────────── */

/** 가장 새 전체 큐(high)가 화면을 덮고, 화면이 보이기 시작한 뒤 약 2초 지나면(또는 누르면) 레일로 접습니다 */
function useTakeover(toasts: DraftToast[], inView: boolean): TakeoverState {
    const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
    const [folding, setFolding] = useState<string | null>(null);
    const newestHigh = toasts.find((toast) => toast.urgency === 'high');
    const toast = newestHigh && !folded.has(newestHigh.id) ? newestHigh : null;
    const id = toast?.id ?? null;
    const acked = Boolean(toast?.acked);

    useEffect(() => {
        if (!id || !inView || acked || folding === id) return;
        const timer = setTimeout(() => setFolding(id), TAKEOVER_MS);
        return () => clearTimeout(timer);
    }, [id, inView, acked, folding]);

    useEffect(() => {
        if (!folding) return;
        const timer = setTimeout(() => {
            setFolded((current) => new Set(current).add(folding));
            setFolding(null);
        }, FOLD_MS);
        return () => clearTimeout(timer);
    }, [folding]);

    const fold = useCallback((target: string) => setFolding(target), []);
    return { toast, folding: toast !== null && folding === toast.id, fold };
}

/** 화면(틀)이 실제로 보이는지 — 갤러리 아래쪽 틀은 스크롤해서 볼 때부터 전체 큐 시간을 셉니다 */
function useInView(ref: RefObject<HTMLElement | null>) {
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        if (typeof IntersectionObserver === 'undefined') {
            const timer = setTimeout(() => setInView(true), 0);
            return () => clearTimeout(timer);
        }
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return inView;
}

/** '방금 · n분 전' 용 시계 (15초마다) */
function useNow(stepMs = 15000) {
    const [now, setNow] = useState(0);
    useEffect(() => {
        const update = () => setNow(Date.now());
        const first = setTimeout(update, 0);
        const timer = setInterval(update, stepMs);
        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };
    }, [stepMs]);
    return now;
}

/** 큐 버튼을 누른 뒤 잠깐 '보냄' 표시 */
function useSentFlash() {
    const [sent, setSent] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const pending = timer;
        return () => {
            if (pending.current) clearTimeout(pending.current);
        };
    }, []);
    const mark = useCallback((label: string) => {
        setSent(label);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setSent(null), 1400);
    }, []);
    return [sent, mark] as const;
}

/** 터치로 옆으로 밀어 지우기. 탭은 그대로 안쪽 버튼에 갑니다(10px 넘게 옆으로 움직였을 때만 잡음). */
function useSwipeDismiss(onDismiss: () => void, enabled: boolean) {
    const [dx, setDx] = useState(0);
    const [dragging, setDragging] = useState(false);
    const start = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null);

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (!enabled || event.pointerType === 'mouse') return;
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, active: false };
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const drag = start.current;
        if (!drag || drag.id !== event.pointerId) return;
        const moveX = event.clientX - drag.x;
        const moveY = event.clientY - drag.y;
        if (!drag.active) {
            if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) {
                start.current = null;
                return;
            }
            if (Math.abs(moveX) < 10) return;
            drag.active = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
        }
        setDx(moveX);
    };
    const onPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
        const drag = start.current;
        start.current = null;
        if (!drag?.active) return;
        setDragging(false);
        if (Math.abs(event.clientX - drag.x) > 80) onDismiss();
        else setDx(0);
    };

    const style: CSSProperties | undefined = enabled
        ? {
              translate: dx ? `${dx}px 0` : undefined,
              opacity: dx ? Math.max(0.25, 1 - Math.abs(dx) / 220) : undefined,
              transition: dragging ? 'none' : 'translate 200ms ease-out, opacity 200ms ease-out',
          }
        : undefined;

    return {
        style,
        bind: enabled ? { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd } : {},
    };
}

/** 전체화면 · 화면 꺼짐 방지. 갤러리 틀 안(framed)에서는 표시만 바꿉니다. */
function useDeviceActions(rootRef: RefObject<HTMLDivElement | null>, framed: boolean): DeviceActions {
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        if (framed) return;
        const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, [framed, rootRef]);

    useEffect(() => {
        const lock = wakeLock;
        return () => {
            void lock.current?.release().catch(() => undefined);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        const root = rootRef.current;
        if (framed || !root || !document.fullscreenEnabled) {
            setFullscreen((current) => !current);
            return;
        }
        const request = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
        request.catch(() => setFullscreen((current) => !current));
    }, [framed, rootRef]);

    const toggleAwake = useCallback(() => {
        const next = !awake;
        setAwake(next);
        if (framed || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
        if (next) {
            navigator.wakeLock
                .request('screen')
                .then((sentinel) => {
                    wakeLock.current = sentinel;
                    sentinel.addEventListener('release', () => setAwake(false));
                })
                .catch(() => undefined);
        } else {
            void wakeLock.current?.release().catch(() => undefined);
            wakeLock.current = null;
        }
    }, [awake, framed]);

    return { awake, fullscreen, toggleAwake, toggleFullscreen };
}
