'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from 'react';
import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    LoaderCircle,
    Maximize2,
    Megaphone,
    Minimize2,
    Pin,
    RotateCcw,
    Save,
    Send,
    Sun,
    Undo2,
    Wifi,
    WifiOff,
    X,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar } from '@/components/conti/ui';
import { DRAFT_ELAPSED, useMockLive, type MockLive } from '../mockLive';
import { useMockPulse } from './useMockPulse';
import { TOAST_TEMPLATES, type DraftToast, type ToastKind, type ToastTone } from './toastDemo';
import type { PulseDraftProps } from './types';

/*
 * 시안 2 · 원형 링 (무대용 어두운 화면)
 * 펄스: 박 수만큼 나뉜 링이 한 칸씩 켜지고(센박은 굵게, 6/8 은 3+3 묶음), 가운데 원이 박마다 숨 쉬듯 커집니다.
 *       바깥 얇은 링은 지금 섹션의 마디 진행 — 지금 마디는 박마다 차오릅니다.
 * 알림: 카드 더미. 모바일은 엄지 자리(아래 버튼) 바로 위, 데스크톱은 오른쪽 아래. 뒤 카드는 겹쳐 보이고 누르면 펼쳐집니다.
 */

type Device = PulseDraftProps['device'];

interface QuickCue {
    label: string;
    target: string;
}

/** 엄지 자리에 둘 빠른 큐 (모바일은 앞의 3개) */
export const QUICK_CUES: QuickCue[] = [
    { label: '한 번 더', target: '전체' },
    { label: '엔딩 컷', target: '전체' },
    { label: '보컬 UP', target: '음향' },
    { label: '느려요', target: '악기' },
];

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/* ───────────── 링 도형 ───────────── */

const VIEW = 400;
const CENTER = VIEW / 2;
const BEAT_RADIUS = 170;
const BAR_RADIUS = 193;
const BAR_STROKE = 4;
const BEAT_STROKE = { down: 30, secondary: 25, normal: 19 } as const;

interface Span {
    start: number;
    end: number;
}

/** 12시 방향을 0도로, 시계 방향 각도 → SVG 좌표 */
function point(radius: number, degrees: number) {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${(CENTER + radius * Math.cos(radians)).toFixed(2)} ${(CENTER + radius * Math.sin(radians)).toFixed(2)}`;
}

function arcPath(radius: number, start: number, end: number) {
    const large = end - start > 180 ? 1 : 0;
    return `M ${point(radius, start)} A ${radius} ${radius} 0 ${large} 1 ${point(radius, end)}`;
}

/** 둥근 끝이 차지하는 각도. 칸마다 이만큼 안으로 줄여야 보이는 틈이 일정합니다 */
function capDegrees(stroke: number, radius: number) {
    return (stroke / 2 / radius) * (180 / Math.PI);
}

/** 박 칸의 각도. 6/8 은 3+3 으로 묶어 묶음 사이를 더 띄웁니다 */
function beatSpans(beats: number): Span[] {
    if (beats === 6) {
        const groupGap = 20;
        const innerGap = 6;
        const span = (180 - groupGap - innerGap * 2) / 3;
        return Array.from({ length: 6 }, (_, index) => {
            const group = Math.floor(index / 3);
            const within = index % 3;
            const start = group * 180 + groupGap / 2 + within * (span + innerGap);
            return { start, end: start + span };
        });
    }
    const gap = 8;
    const each = 360 / beats;
    return Array.from({ length: beats }, (_, index) => ({ start: index * each + gap / 2, end: (index + 1) * each - gap / 2 }));
}

function barSpans(bars: number): Span[] {
    const gap = bars > 6 ? 4 : 6;
    const each = 360 / bars;
    return Array.from({ length: bars }, (_, index) => ({ start: index * each + gap / 2, end: (index + 1) * each - gap / 2 }));
}

/**
 * 링 하나 — useMockPulse 는 박마다 두 번 다시 그리므로, 이 잎 컴포넌트 안에서만 씁니다.
 * 박 칸: 지금 박 = 흰색, 지난 박 = 옅은 흰색, 남은 박 = 아주 옅게 (센박·중간 센박은 굵게).
 * 바깥 링: 섹션의 마디. 지난 마디는 옅은 흰색, 지금 마디는 박마다 초록(진행 중)으로 차오름.
 */
export function BeatRing({
    bpm,
    meter,
    resetKey,
    bars,
    section,
    eyebrow,
    device,
}: {
    bpm: number;
    meter: string;
    resetKey: string;
    bars: number;
    section: string;
    eyebrow: string;
    device: Device;
}) {
    const pulse = useMockPulse({ bpm, meter, resetKey });
    const { count, beatsPerBar } = pulse;
    const barInSection = ((pulse.bar - 1) % bars) + 1;
    const beats = useMemo(() => beatSpans(beatsPerBar), [beatsPerBar]);
    const barArcs = useMemo(() => barSpans(bars), [bars]);
    const compound = beatsPerBar === 6;
    // 6/8 은 두 박(1·4)으로 느끼므로 그 두 박에서만 숨 쉽니다
    const felt = !compound || pulse.downbeat || pulse.secondary;
    const breathing = pulse.blink && felt;
    const scale = !breathing ? 'scale-100' : pulse.downbeat ? 'scale-[1.06]' : compound ? 'scale-[1.035]' : 'scale-[1.025]';
    const mobile = device === 'mobile';
    const perChar = 160 / Math.max(section.length, 4);
    const nameSize = mobile ? `clamp(40px, ${perChar.toFixed(1)}cqi, 56px)` : `clamp(64px, ${perChar.toFixed(1)}cqi, 96px)`;
    const barCap = capDegrees(BAR_STROKE, BAR_RADIUS);

    return (
        <div className="relative size-full">
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" className="absolute inset-0 size-full">
                {barArcs.map((span, index) => {
                    const n = index + 1;
                    const start = span.start + barCap;
                    const end = span.end - barCap;
                    const done = n < barInSection;
                    const fill = n === barInSection && count > 0 ? count / beatsPerBar : 0;
                    return (
                        <g key={`bar-${n}`}>
                            <path d={arcPath(BAR_RADIUS, start, end)} fill="none" strokeWidth={BAR_STROKE} strokeLinecap="round" className={done ? 'stroke-foreground/45' : 'stroke-foreground/12'} />
                            {fill > 0 ? (
                                <path d={arcPath(BAR_RADIUS, start, start + (end - start) * fill)} fill="none" strokeWidth={BAR_STROKE} strokeLinecap="round" className="stroke-brand" />
                            ) : null}
                        </g>
                    );
                })}
                {beats.map((span, index) => {
                    const n = index + 1;
                    const down = n === 1;
                    const second = compound && n === 4;
                    const stroke = down ? BEAT_STROKE.down : second ? BEAT_STROKE.secondary : BEAT_STROKE.normal;
                    const cap = capDegrees(stroke, BEAT_RADIUS);
                    const lit = n === count;
                    const passed = count > 0 && n < count;
                    return (
                        <path
                            key={`beat-${n}`}
                            d={arcPath(BEAT_RADIUS, span.start + cap, span.end - cap)}
                            fill="none"
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            className={lit ? 'stroke-primary' : passed ? 'stroke-foreground/30' : down || second ? 'stroke-foreground/[0.16]' : 'stroke-foreground/10'}
                        />
                    );
                })}
            </svg>

            {/* 가운데 원: 지금 섹션 + 마디. 박마다 숨 쉬듯 커짐 (센박이 가장 크게) */}
            <div
                className={cn(
                    'absolute inset-[13.5%] flex flex-col items-center justify-center rounded-full text-center ring-1 transition-[scale,background-color,box-shadow] ease-out [container-type:inline-size] motion-reduce:scale-100 motion-reduce:bg-card motion-reduce:ring-border motion-reduce:transition-none',
                    scale,
                    // 센박: 원이 가장 크게 커지고 한 톤 밝아집니다. 6/8 의 4박째는 그 절반만
                    breathing && pulse.downbeat ? 'bg-muted ring-foreground/30' : breathing && pulse.secondary ? 'bg-muted/60 ring-foreground/15' : 'bg-card ring-border',
                )}
                style={{ transitionDuration: `${breathing ? 70 : Math.round(Math.min(420, pulse.intervalMs * 0.75))}ms` }}
            >
                <p className={cn('font-medium text-muted-foreground', mobile ? 'text-xs' : 'text-sm')}>{eyebrow}</p>
                <p className="mt-1.5 max-w-[92%] whitespace-nowrap font-semibold leading-none tracking-[-0.035em]" style={{ fontSize: nameSize }}>
                    {section}
                </p>
                <p className={cn('flex items-baseline gap-1.5 tabular-nums', mobile ? 'mt-3 text-lg' : 'mt-5 text-[26px]')}>
                    <span className={cn('font-medium text-muted-foreground', mobile ? 'text-sm' : 'text-lg')}>마디</span>
                    <span className="font-semibold">{barInSection}</span>
                    <span className="text-muted-foreground">/ {bars}</span>
                </p>
            </div>
        </div>
    );
}

/* ───────────── 공통 조각 ───────────── */

/** 경과 시간은 1초마다 바뀌므로 작은 잎 컴포넌트에서만 다시 그립니다 */
function Elapsed() {
    const [seconds, setSeconds] = useState(() => {
        const [m, s] = DRAFT_ELAPSED.split(':').map(Number);
        return m * 60 + s;
    });
    useEffect(() => {
        const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <span className="tabular-nums">
            <span className="sr-only">경과 </span>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
    );
}

/** '진행 중 · 경과 · 곡 n/N' — 버튼 안에서도 쓰므로 span 으로 그릴 수 있게 */
function LiveEyebrow({ live, as: Tag = 'p', className }: { live: MockLive; as?: 'p' | 'span'; className?: string }) {
    return (
        <Tag className={cn('flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
            <span className="font-semibold text-brand">진행 중</span>
            <Elapsed />
            <span aria-hidden="true">·</span>
            <span>
                곡 {live.songIndex + 1}/{live.songs.length}
            </span>
        </Tag>
    );
}

export function KeyChip({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-foreground', className)}>{children}</span>;
}

function DeviceToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), pressed ? 'bg-muted text-foreground' : 'text-muted-foreground')}
        >
            {children}
        </button>
    );
}

export interface DeviceActions {
    awake: boolean;
    fullscreen: boolean;
    toggleAwake: () => void;
    toggleFullscreen: () => void;
}

/** 전체화면 · 화면 꺼짐 방지. 갤러리 틀 안(framed)에서는 켜짐 모양만 바꿉니다 */
export function useDeviceActions(framed: boolean): DeviceActions {
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const wakeRef = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        if (framed) return;
        const sync = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, [framed]);

    useEffect(() => {
        const sentinel = wakeRef;
        return () => {
            void sentinel.current?.release().catch(() => undefined);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (framed) {
            setFullscreen((value) => !value);
            return;
        }
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void document.documentElement.requestFullscreen().catch(() => undefined);
    }, [framed]);

    const toggleAwake = useCallback(() => {
        if (framed) {
            setAwake((value) => !value);
            return;
        }
        if (wakeRef.current) {
            void wakeRef.current.release().catch(() => undefined);
            wakeRef.current = null;
            setAwake(false);
            return;
        }
        if (!('wakeLock' in navigator)) return;
        navigator.wakeLock
            .request('screen')
            .then((sentinel) => {
                wakeRef.current = sentinel;
                setAwake(true);
                sentinel.addEventListener('release', () => {
                    if (wakeRef.current !== sentinel) return;
                    wakeRef.current = null;
                    setAwake(false);
                });
            })
            .catch(() => setAwake(false));
    }, [framed]);

    return { awake, fullscreen, toggleAwake, toggleFullscreen };
}

function DeviceToggles({ actions }: { actions: DeviceActions }) {
    return (
        <div className="flex shrink-0 items-center gap-0.5">
            <DeviceToggle label="화면 꺼짐 방지" pressed={actions.awake} onClick={actions.toggleAwake}>
                <Sun className="size-[18px]" />
            </DeviceToggle>
            <DeviceToggle label={actions.fullscreen ? '전체화면 끝내기' : '전체화면'} pressed={actions.fullscreen} onClick={actions.toggleFullscreen}>
                {actions.fullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
            </DeviceToggle>
        </div>
    );
}

/** 지금 섹션 이후로 갈 곳 — 섹션 · 다음 곡 · 끝 */
export function nextStep(live: MockLive) {
    if (live.nextSection) {
        const bars = live.song.chords[live.nextSection]?.length ?? 4;
        return { kind: 'section' as const, eyebrow: `다음 섹션 · ${live.sectionIndex + 2}/${live.song.form.length}`, name: live.nextSection, meta: `${bars}마디 · ${live.song.lyrics[live.nextSection] ?? ''}` };
    }
    if (live.nextSong) {
        const song = live.nextSong;
        return { kind: 'song' as const, eyebrow: `다음 곡 · ${live.songIndex + 2}/${live.songs.length}`, name: song.title, meta: `Key ${song.key} · ${song.bpm} BPM · ${song.meter}` };
    }
    return { kind: 'end' as const, eyebrow: '다음', name: '마지막 섹션', meta: '콘티의 끝이에요' };
}

function barsOf(live: MockLive) {
    return live.song.chords[live.section]?.length ?? 4;
}

/* ───────────── 화면 ───────────── */

export default function PulseRing({ device, framed = false, toasts, onDismiss, onAck, onAction, onSendCue }: PulseDraftProps) {
    const live = useMockLive();
    const actions = useDeviceActions(framed);
    const { nextSectionStep, prevSectionStep } = live;
    /** 접힌 알림 더미의 높이 — 모바일은 링이 그만큼 비켜 주고, 데스크톱은 오른쪽 칸 아래에 그만큼 자리를 냅니다 */
    const [footprint, setFootprint] = useState(0);

    // 한 화면으로 볼 때만: 방향키 · Page Up/Down (페달) 으로 섹션 넘김
    useEffect(() => {
        if (framed) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
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
    }, [framed, nextSectionStep, prevSectionStep]);

    const stack = (
        <ToastStack
            device={device}
            toasts={toasts}
            onDismiss={onDismiss}
            onAck={onAck}
            onAction={onAction}
            onFootprint={setFootprint}
            className={device === 'mobile' ? 'inset-x-3 bottom-2' : 'inset-x-6 bottom-6'}
        />
    );

    return (
        <div className="dark @container/pulse relative h-full w-full overflow-hidden bg-background text-foreground [color-scheme:dark]">
            {device === 'mobile' ? (
                <MobileScreen live={live} actions={actions} onSendCue={onSendCue} stack={stack} footprint={footprint} />
            ) : (
                <DesktopScreen live={live} actions={actions} onSendCue={onSendCue} stack={stack} footprint={footprint} />
            )}
            <ToastAnnouncer toasts={toasts} />
        </div>
    );
}

/* ───────────── 모바일 ───────────── */

/**
 * 링이 이보다 작아지지 않게 — 가운데 섹션 이름이 40px 로 원(링의 73%) 안에 들어가야 합니다.
 * 이름이 짧으면(Chorus) 230px 까지, 길면(Pre-Chorus) 300px 까지.
 */
function ringFloor(name: string) {
    const em = Array.from(name).reduce((sum, char) => sum + (/\s/.test(char) ? 0.28 : /[ㄱ-힝]/.test(char) ? 0.95 : 0.51), 0);
    return Math.round(Math.min(300, Math.max(230, (em * 40) / 0.92 / 0.73)));
}

export function MobileScreen({
    live,
    actions,
    onSendCue,
    stack,
    footprint,
    header,
    footer,
    tallMin = 700,
}: {
    live: MockLive;
    actions: DeviceActions;
    onSendCue: (label: string, target: string) => void;
    stack: ReactNode;
    footprint: number;
    /** 위 막대를 바꿔 끼웁니다 (null 이면 위 막대 없이). 주지 않으면 곡 메뉴 + 기기 버튼 */
    header?: ReactNode;
    /** 아래 버튼 칸을 바꿔 끼웁니다 (null 이면 없이). 주지 않으면 빠른 큐 + 섹션 넘김 */
    footer?: ReactNode;
    /** 이 높이 이상이면 송폼 알약 줄을 둡니다 */
    tallMin?: number;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const middleRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ tall: true, width: 0, height: 0, row: 0 });
    const next = nextStep(live);
    const bars = barsOf(live);
    const hasToasts = footprint > 0;
    /*
     * 알림이 뜨면 카드 더미가 엄지 버튼 바로 위 자리를 씁니다. 링은 그만큼 위로 비켜 주고(필요하면 조금 작아지고),
     * 템포 · 다음 섹션 줄은 링과 카드 사이에 그대로 남깁니다. 송폼 알약 줄만 접습니다.
     * 링이 섹션 이름을 40px 로 담을 수 없을 만큼 작아져야 할 때(가장 작은 휴대폰 + 카드 여러 장)만 템포 줄도 잠깐 숨깁니다.
     */
    const need = hasToasts ? footprint + 16 : 0;
    const floor = Math.min(box.width - 32, ringFloor(live.section));
    const keepRow = !hasToasts || Math.min(box.width - 32, box.height - box.row - need - 12) >= floor;
    const reserve = !hasToasts ? 0 : keepRow ? need : Math.min(Math.max(0, need - box.row), Math.max(0, box.height - box.row - 12 - floor));
    const showForm = box.tall && !hasToasts;

    // 크기 재기: 키가 작은 휴대폰(약 700px 미만)은 송폼 줄을 두지 않고, 가운데 칸 크기와 템포 줄 높이로 링 자리를 계산합니다
    useEffect(() => {
        const element = rootRef.current;
        const middle = middleRef.current;
        const row = rowRef.current;
        if (!element || !middle || !row) return;
        const observer = new ResizeObserver(() => {
            const measured = { tall: element.offsetHeight >= tallMin, width: middle.offsetWidth, height: middle.offsetHeight, row: row.offsetHeight };
            setBox((current) => ((Object.keys(measured) as (keyof typeof measured)[]).every((key) => current[key] === measured[key]) ? current : measured));
        });
        observer.observe(element);
        observer.observe(middle);
        observer.observe(row);
        return () => observer.disconnect();
    }, [tallMin]);

    return (
        <div ref={rootRef} className="flex h-full flex-col">
            {header === undefined ? (
                <header className="relative z-30 flex shrink-0 items-center gap-2 pb-1 pl-4 pr-3 pt-4">
                    <SongMenu live={live} />
                    <DeviceToggles actions={actions} />
                </header>
            ) : (
                header
            )}

            <div ref={middleRef} className="relative flex min-h-0 flex-1 flex-col">
                <section
                    aria-label="박자와 지금 섹션"
                    className="flex min-h-0 flex-1 items-center justify-center [container-type:size]"
                >
                    <div style={{ width: 'min(100cqw - 32px, 100cqh - 12px)', height: 'min(100cqw - 32px, 100cqh - 12px)' }}>
                        <BeatRing
                            bpm={live.bpm}
                            meter={live.song.meter}
                            resetKey={`${live.songIndex}-${live.sectionIndex}`}
                            bars={bars}
                            section={live.section}
                            // 템포 줄을 잠깐 숨길 때는 원 안 윗줄이 템포를 대신 보여 줍니다 — BPM 은 늘 화면에
                            eyebrow={keepRow ? `섹션 ${live.sectionIndex + 1}/${live.song.form.length}` : `${live.bpm} BPM · ${live.song.meter}`}
                            device="mobile"
                        />
                    </div>
                </section>

                {/* 템포 · 다음 섹션 — 한 줄. 카드가 떠도 링과 카드 사이에 남습니다 */}
                <div
                    ref={rowRef}
                    inert={keepRow ? undefined : true}
                    className={cn('grid shrink-0 grid-cols-2 items-center px-4 pb-3 pt-1 transition-opacity duration-200 motion-reduce:transition-none', !keepRow && 'opacity-0')}
                >
                    <p className="flex min-w-0 items-baseline gap-1.5">
                        <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{live.bpm}</span>
                        <span className="text-xs font-medium text-muted-foreground">BPM</span>
                        <KeyChip className="ml-1 self-center">{live.song.meter}</KeyChip>
                    </p>
                    <p className="flex min-w-0 items-baseline gap-2 border-l border-border pl-5">
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">{next.kind === 'song' ? '다음 곡' : next.kind === 'end' ? '지금' : '다음'}</span>
                        <span className="truncate text-[22px] font-semibold leading-[28px] tracking-tight">{next.name}</span>
                    </p>
                </div>

                {/* 송폼 알약 줄 — 알림이 떠 있는 동안은 접어 둡니다 */}
                {box.tall ? (
                    <div
                        inert={showForm ? undefined : true}
                        className={cn(
                            'grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
                            showForm ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                        )}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <FormStrip live={live} />
                        </div>
                    </div>
                ) : null}

                {/* 카드 더미 자리 — 링과 템포 줄이 그만큼 위로 비켜 줍니다 */}
                <div aria-hidden="true" className="shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none" style={{ height: reserve }} />

                {stack}
            </div>

            {footer === undefined ? (
                <div className="relative z-20 shrink-0 bg-background px-4 pb-5 pt-2">
                    <div role="group" aria-label="빠른 큐 보내기" className="grid grid-cols-3 gap-2">
                        {QUICK_CUES.slice(0, 3).map((cue) => (
                            <button
                                key={cue.label}
                                type="button"
                                onClick={() => onSendCue(cue.label, cue.target)}
                                aria-label={`${cue.label} 큐 보내기 · 받는 사람 ${cue.target}`}
                                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-11 gap-1.5 px-2 text-[13px]')}
                            >
                                {cue.label}
                                <span aria-hidden="true" className="text-[11px] font-medium text-muted-foreground">
                                    {cue.target}
                                </span>
                            </button>
                        ))}
                    </div>
                    <SectionNav live={live} size="mobile" className="mt-2.5" />
                </div>
            ) : (
                footer
            )}
        </div>
    );
}

/** 위 막대의 곡 이름 — 누르면 콘티 순서가 열리고 곡을 바꿀 수 있습니다 (6/8 곡 보기) */
function SongMenu({ live }: { live: MockLive }) {
    const [open, setOpen] = useState(false);
    const holderRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!holderRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={holderRef} className="min-w-0 flex-1">
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen((value) => !value)}
                className={cn('-ml-2 flex max-w-full flex-col items-start rounded-2xl px-2 py-1 text-left transition-colors hover:bg-muted/60', focusRing)}
            >
                <LiveEyebrow live={live} as="span" className="text-[11px]" />
                <span className="mt-0.5 flex max-w-full items-center gap-2">
                    <span className="truncate text-[17px] font-semibold tracking-tight">{live.song.title}</span>
                    <KeyChip>{live.song.key}</KeyChip>
                    <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                </span>
                <span className="sr-only">· 콘티 순서 열기</span>
            </button>
            {open ? (
                <div role="dialog" aria-label="콘티 순서" className="absolute inset-x-3 top-[calc(100%+4px)] rounded-3xl border border-border bg-card p-2 shadow-2xl">
                    <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">콘티 순서 · 곡을 고르면 처음 섹션부터</p>
                    <SetlistRows
                        live={live}
                        onPick={(index) => {
                            live.goSong(index);
                            setOpen(false);
                            triggerRef.current?.focus();
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}

function SetlistRows({ live, onPick, dense = false }: { live: MockLive; onPick: (index: number) => void; dense?: boolean }) {
    return (
        <ol className="divide-y divide-border">
            {live.songs.map((song, index) => {
                const current = index === live.songIndex;
                return (
                    <li key={song.id}>
                        <button
                            type="button"
                            aria-current={current ? 'true' : undefined}
                            onClick={() => onPick(index)}
                            className={cn(
                                'my-1 flex w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors',
                                dense ? 'min-h-12 py-2' : 'min-h-14 py-2.5',
                                focusRing,
                                current ? 'bg-muted' : 'hover:bg-muted/60',
                            )}
                        >
                            <span className={cn('w-4 shrink-0 text-center text-sm font-semibold tabular-nums', current ? 'text-foreground' : 'text-muted-foreground')}>{index + 1}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold tracking-tight">{song.title}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    Key {song.key} · {song.bpm} BPM · {song.meter}
                                </span>
                                {current && dense ? <FormProgress total={song.form.length} index={live.sectionIndex} /> : null}
                            </span>
                            {current ? <span className="shrink-0 text-xs font-semibold text-brand">지금</span> : null}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

function FormProgress({ total, index }: { total: number; index: number }) {
    return (
        <span aria-hidden="true" className="mt-2 flex gap-0.5">
            {Array.from({ length: total }, (_, step) => (
                <span key={step} className={cn('h-1 flex-1 rounded-full', step < index ? 'bg-foreground/45' : step === index ? 'bg-foreground' : 'bg-foreground/10')} />
            ))}
        </span>
    );
}

/** 송폼 알약 줄 — 눌러서 그 섹션으로. 지금 섹션이 늘 가운데 보이게 */
function FormStrip({ live }: { live: MockLive }) {
    const stripRef = useRef<HTMLDivElement>(null);
    const firstScroll = useRef(true);

    useEffect(() => {
        const strip = stripRef.current;
        const pill = strip?.querySelector<HTMLElement>(`[data-form="${live.sectionIndex}"]`);
        if (!strip || !pill) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        strip.scrollTo({ left: pill.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2, behavior: firstScroll.current || reduce ? 'auto' : 'smooth' });
        firstScroll.current = false;
    }, [live.song.id, live.sectionIndex]);

    return (
        <div ref={stripRef} role="group" aria-label="송폼 · 눌러서 섹션 이동" className="relative flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {live.song.form.map((name, index) => {
                const current = index === live.sectionIndex;
                return (
                    <button
                        key={`${name}-${index}`}
                        type="button"
                        data-form={index}
                        aria-current={current ? 'step' : undefined}
                        onClick={() => live.goSection(index)}
                        className={cn(
                            'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                            focusRing,
                            current ? 'bg-primary text-primary-foreground' : index < live.sectionIndex ? 'text-muted-foreground ring-1 ring-inset ring-border' : 'bg-muted text-foreground',
                        )}
                    >
                        {name}
                    </button>
                );
            })}
        </div>
    );
}

/** 이전 · 다음 섹션. 다음 버튼에 갈 곳을 함께 씁니다 */
function SectionNav({ live, size, className }: { live: MockLive; size: Device; className?: string }) {
    const next = nextStep(live);
    const prevName = live.sectionIndex > 0 ? live.song.form[live.sectionIndex - 1] : live.songIndex > 0 ? '이전 곡' : null;
    const mobile = size === 'mobile';
    return (
        <nav aria-label="섹션 이동" className={cn('flex gap-2', className)}>
            <button
                type="button"
                onClick={live.prevSectionStep}
                disabled={!prevName}
                aria-label={prevName ? `이전 섹션 · ${prevName}` : '이전 섹션 없음'}
                className={cn(buttonVariants({ variant: 'secondary' }), 'size-14 shrink-0 p-0')}
            >
                <ChevronLeft className="size-6" />
            </button>
            <button
                type="button"
                onClick={live.nextSectionStep}
                disabled={next.kind === 'end'}
                className={cn(buttonVariants({ variant: 'default' }), 'h-14 min-w-0 flex-1 justify-between gap-3 pl-6 pr-5', mobile ? 'text-base' : 'text-[17px]')}
            >
                <span className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0">{next.kind === 'song' ? '다음 곡' : '다음 섹션'}</span>
                    {next.kind !== 'end' ? <span className="truncate text-sm font-medium text-primary-foreground/55">{next.name}</span> : null}
                </span>
                <ChevronRight className="size-5" />
            </button>
        </nav>
    );
}

/* ───────────── 데스크톱 ───────────── */

function DesktopScreen({
    live,
    actions,
    onSendCue,
    stack,
    footprint,
}: {
    live: MockLive;
    actions: DeviceActions;
    onSendCue: (label: string, target: string) => void;
    stack: ReactNode;
    footprint: number;
}) {
    const next = nextStep(live);
    const bars = barsOf(live);

    return (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_380px] @min-[1300px]/pulse:grid-cols-[minmax(0,1fr)_420px]">
            {/* 왼쪽: 곡 · 링 · 템포 */}
            <section aria-label="박자와 지금 섹션" className="flex min-h-0 min-w-0 flex-col px-8 pb-6 pt-6 @min-[1300px]/pulse:px-10">
                <div className="flex shrink-0 items-start justify-between gap-6">
                    <div className="min-w-0">
                        <LiveEyebrow live={live} />
                        <h2 className="mt-1.5 flex min-w-0 items-center gap-3">
                            <span className="truncate text-[30px] font-semibold leading-tight tracking-tight">{live.song.title}</span>
                            <KeyChip className="h-7 px-3 text-sm">Key {live.song.key}</KeyChip>
                        </h2>
                    </div>
                    <DeviceToggles actions={actions} />
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center py-3 [container-type:size]">
                    <div style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}>
                        <BeatRing
                            bpm={live.bpm}
                            meter={live.song.meter}
                            resetKey={`${live.songIndex}-${live.sectionIndex}`}
                            bars={bars}
                            section={live.section}
                            eyebrow={`지금 · 섹션 ${live.sectionIndex + 1}/${live.song.form.length}`}
                            device="desktop"
                        />
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-7">
                    <p className="flex items-baseline gap-2">
                        <span className="text-[34px] font-semibold leading-none tabular-nums">{live.bpm}</span>
                        <span className="text-sm font-medium text-muted-foreground">BPM</span>
                    </p>
                    <span aria-hidden="true" className="h-8 w-px bg-border" />
                    <p className="flex items-baseline gap-2">
                        <span className="text-[34px] font-semibold leading-none tabular-nums">{live.song.meter}</span>
                        <span className="text-sm font-medium text-muted-foreground">{live.song.meter === '6/8' ? '박자 · 3+3' : '박자'}</span>
                    </p>
                </div>
            </section>

            {/* 오른쪽: 다음 · 넘김 · 큐 · 콘티 순서. 알림 카드는 이 칸 아래 자리에 쌓이고, 위 내용은 그만큼 스크롤 영역이 됩니다 */}
            <aside aria-label="다음 · 큐 · 콘티 순서" className="relative flex min-h-0 flex-col border-l border-border">
                <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-6 [scrollbar-width:thin]', footprint > 0 && 'mask-b-from-[calc(100%-2.5rem)]')}>
                    <div className="shrink-0">
                        <p className="text-xs font-medium text-muted-foreground">{next.eyebrow}</p>
                        <p className="mt-1 truncate text-[32px] font-semibold leading-tight tracking-tight">{next.name}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{next.meta}</p>
                    </div>
                    <SectionNav live={live} size="desktop" className="mt-4 shrink-0" />

                    <div className="mt-6 shrink-0 border-t border-border pt-5">
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-[15px] font-semibold tracking-tight">큐 보내기</h3>
                            <span className="text-xs text-muted-foreground">누르면 바로 보내요</span>
                        </div>
                        <div role="group" aria-label="빠른 큐 보내기" className="mt-3 grid grid-cols-2 gap-2">
                            {QUICK_CUES.map((cue) => (
                                <button
                                    key={cue.label}
                                    type="button"
                                    onClick={() => onSendCue(cue.label, cue.target)}
                                    aria-label={`${cue.label} 큐 보내기 · 받는 사람 ${cue.target}`}
                                    className={cn(buttonVariants({ variant: 'outline' }), 'h-12 justify-between bg-transparent pl-4 pr-3.5 text-[15px]')}
                                >
                                    {cue.label}
                                    <span aria-hidden="true" className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
                                        <ArrowRight className="size-3" />
                                        {cue.target}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 shrink-0 border-t border-border pt-5">
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-[15px] font-semibold tracking-tight">콘티 순서</h3>
                            <span className="text-xs text-muted-foreground">{live.songs.length}곡</span>
                        </div>
                        <div className="-mx-3 mt-1">
                            <SetlistRows live={live} onPick={live.goSong} dense />
                        </div>
                    </div>
                </div>

                <div
                    className={cn('relative shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none', footprint > 0 && 'border-t border-border')}
                    style={{ height: footprint > 0 ? footprint + 40 : 0 }}
                >
                    {stack}
                </div>
            </aside>
        </div>
    );
}

/* ───────────── 알림 카드 더미 ───────────── */

const TONE_STYLE: Record<ToastTone, { strip: string; icon: string; bar: string }> = {
    cue: { strip: 'bg-primary', icon: 'text-foreground', bar: 'bg-foreground/60' },
    success: { strip: 'bg-success', icon: 'text-success', bar: 'bg-success/80' },
    warning: { strip: 'bg-warning', icon: 'text-warning', bar: 'bg-warning/80' },
    danger: { strip: 'bg-destructive', icon: 'text-destructive', bar: 'bg-destructive/80' },
    info: { strip: 'bg-muted-foreground', icon: 'text-muted-foreground', bar: 'bg-muted-foreground/70' },
};

/** 받은 큐를 '확인'한 뒤 잠깐 — 확정은 한 가지 강조색(초록) */
const ACKED_STYLE = { strip: 'bg-brand', icon: 'text-brand', bar: 'bg-brand' };

const KIND_ICON: Record<ToastKind, LucideIcon> = {
    'cue-all': Megaphone,
    'cue-role': Megaphone,
    'cue-sent': Send,
    offline: WifiOff,
    online: Wifi,
    saved: Save,
    error: CircleAlert,
    team: Megaphone,
};

const KIND_LABEL: Record<ToastKind, string> = {
    'cue-all': '전체 큐',
    'cue-role': '내 역할 큐',
    'cue-sent': '보낸 큐',
    offline: '연결',
    online: '연결',
    saved: '저장',
    error: '오류',
    team: '팀 소식',
};

const ACTION_ICON: Record<string, LucideIcon> = {
    '실행 취소': Undo2,
    '다시 시도': RotateCcw,
    보기: ArrowRight,
};

/** 원래 사용자가 닫아야 사라지는 알림 (연결 끊김 · 오류) */
function isSticky(toast: DraftToast) {
    return TOAST_TEMPLATES[toast.kind].ttl === null;
}

function isAssertive(toast: DraftToast) {
    return toast.urgency === 'high' || toast.tone === 'danger';
}

function announcement(toast: DraftToast) {
    const who = toast.from && toast.target ? `${toast.from}님이 ${toast.target}에게` : toast.from ? `${toast.from}님` : '';
    return [KIND_LABEL[toast.kind], who, toast.title, toast.body, toast.progress ? `확인 ${toast.progress.done}/${toast.progress.total}` : '']
        .filter(Boolean)
        .join(' · ');
}

/**
 * 화면 읽기용 알림 — 보통·낮은 알림은 polite, 급한 큐와 오류는 alert(assertive).
 * 새로 들어온 알림만 읽고, 앞 알림이 닫혀 뒤 알림이 앞으로 와도 다시 읽지 않습니다.
 */
export function ToastAnnouncer({ toasts }: { toasts: DraftToast[] }) {
    const [previous, setPrevious] = useState(toasts);
    const [spoken, setSpoken] = useState<{ polite: { id: string; text: string } | null; assertive: { id: string; text: string } | null }>({ polite: null, assertive: null });

    if (previous !== toasts) {
        const fresh = toasts.filter((toast) => !previous.some((item) => item.id === toast.id));
        setPrevious(toasts);
        if (fresh.length > 0) {
            const toast = fresh[0];
            const entry = { id: toast.id, text: announcement(toast) };
            setSpoken((current) => (isAssertive(toast) ? { ...current, assertive: entry } : { ...current, polite: entry }));
        }
    }

    return (
        <>
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {spoken.polite ? <span key={spoken.polite.id}>{spoken.polite.text}</span> : null}
            </div>
            <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
                {spoken.assertive ? <span key={spoken.assertive.id}>{spoken.assertive.text}</span> : null}
            </div>
        </>
    );
}

const PEEK = 10;
const GAP = 8;

/**
 * 카드 더미. 0번(가장 새 알림)이 맨 앞 — 단, 아직 떠 있는 전체 큐(급함)는 늘 맨 앞에 둡니다.
 * 접힘: 뒤 카드는 위로 조금씩 겹쳐 보임 / 펼침: 위로 한 줄씩 (모바일은 눌러서, 데스크톱은 마우스를 올려서).
 */
export function ToastStack({
    device,
    toasts,
    onDismiss,
    onAck,
    onAction,
    onFootprint,
    className,
}: {
    device: Device;
    toasts: DraftToast[];
    onDismiss: (id: string) => void;
    onAck: (id: string) => void;
    onAction: (id: string) => void;
    /** 접힌 더미의 높이 (없으면 0) — 모바일 화면이 링 자리를 비켜 줄 때 씁니다 */
    onFootprint?: (height: number) => void;
    className?: string;
}) {
    const ordered = useMemo(() => [...toasts.filter((toast) => toast.urgency === 'high'), ...toasts.filter((toast) => toast.urgency !== 'high')], [toasts]);
    const [expandedState, setExpandedState] = useState(false);
    const [heights, setHeights] = useState<Record<string, number>>({});
    const count = ordered.length;
    if (expandedState && count <= 1) setExpandedState(false);
    const expanded = expandedState && count > 1;
    const mobile = device === 'mobile';

    const measure = useCallback((id: string, height: number) => {
        setHeights((current) => (current[id] === height ? current : { ...current, [id]: height }));
    }, []);

    useEffect(() => {
        if (!expanded) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpandedState(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [expanded]);

    const frontHeight = count > 0 ? (heights[ordered[0].id] ?? 0) : 0;
    const collapsedHeight = count > 0 && frontHeight > 0 ? frontHeight + PEEK * (count - 1) : 0;

    useEffect(() => {
        onFootprint?.(collapsedHeight);
    }, [collapsedHeight, onFootprint]);

    useEffect(() => () => onFootprint?.(0), [onFootprint]);

    if (count === 0) return null;

    const offsets: number[] = [];
    let total = 0;
    ordered.forEach((toast) => {
        offsets.push(total);
        total += (heights[toast.id] ?? 0) + GAP;
    });
    const stackHeight = expanded ? total - GAP : collapsedHeight;

    return (
        <>
            {expanded && mobile ? <div aria-hidden="true" onClick={() => setExpandedState(false)} className="absolute inset-0 z-10 bg-background/75 backdrop-blur-[2px]" /> : null}
            <section
                aria-label={`알림 ${count}개`}
                className={cn('absolute z-20', className)}
                onMouseEnter={mobile ? undefined : () => setExpandedState(true)}
                onMouseLeave={mobile ? undefined : () => setExpandedState(false)}
            >
                {/* 데스크톱에서 펼치면 뒤 화면 글자가 카드 사이로 비치지 않게 받침을 깝니다 */}
                {expanded && !mobile ? <div aria-hidden="true" className="absolute -inset-2.5 rounded-[2rem] bg-background/90 ring-1 ring-border backdrop-blur-md" /> : null}
                {expanded ? (
                    <div className="relative mb-2 flex items-center justify-between pl-2">
                        <p className="text-sm font-semibold">
                            알림 <span className="tabular-nums">{count}</span>
                        </p>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => ordered.forEach((toast) => onDismiss(toast.id))} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-muted-foreground')}>
                                모두 닫기
                            </button>
                            <button type="button" aria-expanded="true" onClick={() => setExpandedState(false)} className={buttonVariants({ variant: 'secondary', size: 'xs' })}>
                                <ChevronDown />
                                접기
                            </button>
                        </div>
                    </div>
                ) : null}
                <ol className="relative transition-[height] duration-300 ease-out motion-reduce:transition-none" style={{ height: stackHeight }}>
                    {ordered.map((toast, index) => (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            index={index}
                            count={count}
                            device={device}
                            expanded={expanded}
                            offset={offsets[index]}
                            frontHeight={frontHeight}
                            onMeasure={measure}
                            onExpand={() => setExpandedState(true)}
                            onDismiss={onDismiss}
                            onAck={onAck}
                            onAction={onAction}
                        />
                    ))}
                </ol>
            </section>
        </>
    );
}

function ToastItem({
    toast,
    index,
    count,
    device,
    expanded,
    offset,
    frontHeight,
    onMeasure,
    onExpand,
    onDismiss,
    onAck,
    onAction,
}: {
    toast: DraftToast;
    index: number;
    count: number;
    device: Device;
    expanded: boolean;
    offset: number;
    frontHeight: number;
    onMeasure: (id: string, height: number) => void;
    onExpand: () => void;
    onDismiss: (id: string) => void;
    onAck: (id: string) => void;
    onAction: (id: string) => void;
}) {
    const innerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ x: number; y: number; pointer: number; time: number; moved: boolean } | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [drag, setDrag] = useState<{ x: number; leaving: -1 | 0 | 1; active: boolean }>({ x: 0, leaving: 0, active: false });
    const { id } = toast;
    const behind = !expanded && index > 0;

    useLayoutEffect(() => {
        const element = innerRef.current;
        if (!element) return;
        onMeasure(id, element.offsetHeight);
        const observer = new ResizeObserver(() => onMeasure(id, element.offsetHeight));
        observer.observe(element);
        return () => observer.disconnect();
    }, [id, onMeasure]);

    useEffect(() => {
        const timer = leaveTimer;
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button, a')) return;
        dragRef.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId, time: event.timeStamp, moved: false };
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const start = dragRef.current;
        if (!start || start.pointer !== event.pointerId || behind) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.moved) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
            start.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDrag({ x: dx, leaving: 0, active: true });
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        const start = dragRef.current;
        dragRef.current = null;
        if (!start || start.pointer !== event.pointerId) return;
        if (!start.moved) {
            // 누르기: 접힌 더미면 펼침
            if (!expanded && count > 1) onExpand();
            return;
        }
        const dx = event.clientX - start.x;
        const speed = Math.abs(dx) / Math.max(1, event.timeStamp - start.time);
        if (Math.abs(dx) > 90 || speed > 0.6) {
            setDrag({ x: dx, leaving: dx > 0 ? 1 : -1, active: false });
            leaveTimer.current = setTimeout(() => onDismiss(id), 170);
        } else {
            setDrag({ x: 0, leaving: 0, active: false });
        }
    };
    const onPointerCancel = () => {
        dragRef.current = null;
        setDrag({ x: 0, leaving: 0, active: false });
    };

    const transform = expanded ? `translateY(${-offset}px)` : `translateY(${-PEEK * index}px) scale(${1 - 0.05 * index})`;
    const swipe = drag.leaving !== 0 ? `translateX(${drag.leaving * 110}%)` : `translateX(${drag.x}px)`;

    return (
        <li
            className="absolute inset-x-0 bottom-0 origin-top transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{
                transform,
                zIndex: count - index,
                height: behind && frontHeight > 0 ? frontHeight : undefined,
                opacity: behind ? 1 - 0.25 * (index - 1) : 1,
            }}
        >
            <article
                aria-label={`${KIND_LABEL[toast.kind]} · ${toast.title}`}
                aria-hidden={behind ? true : undefined}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onClick={behind ? onExpand : undefined}
                className={cn(
                    'relative h-full touch-pan-y select-none overflow-hidden rounded-3xl shadow-2xl duration-200 animate-in fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none',
                    behind ? 'bg-muted' : 'bg-card',
                    toast.urgency === 'high' && !toast.acked ? 'ring-2 ring-primary' : toast.acked ? 'ring-1 ring-brand/60' : 'ring-1 ring-foreground/10',
                    drag.active ? 'transition-none' : 'transition-[transform,opacity] ease-out motion-reduce:transition-none',
                    behind && 'cursor-pointer',
                )}
                style={{ transform: swipe, opacity: drag.leaving !== 0 ? 0 : 1 - Math.min(Math.abs(drag.x) / 260, 0.6) }}
            >
                <div ref={innerRef} inert={behind ? true : undefined} className={cn('transition-opacity duration-200 motion-reduce:transition-none', behind && 'opacity-0')}>
                    <ToastCard toast={toast} device={device} more={!expanded && index === 0 && count > 1 ? count - 1 : 0} onExpand={onExpand} onDismiss={onDismiss} onAck={onAck} onAction={onAction} />
                </div>
            </article>
        </li>
    );
}

function ToastCard({
    toast,
    device,
    more,
    onExpand,
    onDismiss,
    onAck,
    onAction,
}: {
    toast: DraftToast;
    device: Device;
    more: number;
    onExpand: () => void;
    onDismiss: (id: string) => void;
    onAck: (id: string) => void;
    onAction: (id: string) => void;
}) {
    const tone = toast.acked ? ACKED_STYLE : TONE_STYLE[toast.tone];
    const Icon = KIND_ICON[toast.kind];
    const high = toast.urgency === 'high';
    const low = toast.urgency === 'low';
    const sticky = isSticky(toast);
    const ActionIcon = toast.action ? ACTION_ICON[toast.action] : null;
    const timed = toast.ttl !== null && !toast.acked;

    const ack = toast.ackable ? (
        toast.acked ? (
            <span role="status" className={cn('inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand', high ? 'h-14 px-2 text-base' : 'h-9 px-1 text-sm')}>
                <Check className={high ? 'size-5' : 'size-4'} aria-hidden="true" />
                확인함
            </span>
        ) : (
            <button
                type="button"
                onClick={() => onAck(toast.id)}
                aria-label={`${toast.title} 확인`}
                className={cn(buttonVariants({ variant: 'default', size: high ? 'lg' : 'sm' }), high ? 'h-14 shrink-0 px-7 text-base' : 'shrink-0 px-4 text-[13px]')}
            >
                <Check className={high ? 'size-5' : undefined} />
                확인
            </button>
        )
    ) : null;

    const action = toast.action ? (
        <button
            type="button"
            onClick={() => onAction(toast.id)}
            className={cn(buttonVariants({ variant: toast.tone === 'danger' ? 'default' : 'secondary', size: low ? 'xs' : 'sm' }), 'shrink-0', low ? 'px-3' : 'px-4 text-[13px]')}
        >
            {ActionIcon ? <ActionIcon /> : null}
            {toast.action}
        </button>
    ) : null;

    const meta = (
        <span className="flex min-w-0 items-center gap-1.5">
            {toast.kind === 'team' && toast.from ? <Avatar name={toast.from} size="xs" /> : <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', tone.icon)} />}
            <span className={cn('shrink-0 font-semibold', high ? 'text-foreground' : 'text-foreground/80')}>{KIND_LABEL[toast.kind]}</span>
            {toast.from || toast.target ? (
                <span className="flex min-w-0 items-center gap-1 truncate">
                    <span aria-hidden="true">·</span>
                    {toast.kind === 'cue-sent' ? '나' : toast.from}
                    {toast.target ? (
                        <>
                            <span className="sr-only">에서</span>
                            <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
                            {toast.target}
                            <span className="sr-only">에게</span>
                        </>
                    ) : null}
                </span>
            ) : null}
            {sticky ? (
                <span className="ml-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                    <Pin aria-hidden="true" className="size-2.5" />
                    고정
                </span>
            ) : null}
        </span>
    );

    return (
        <div className={cn('relative', high ? 'pb-5 pl-6 pr-4 pt-4' : low ? 'pb-3.5 pl-6 pr-3 pt-3' : 'pb-4 pl-6 pr-3.5 pt-3.5')}>
            {/* 왼쪽 색 띠: 큐 = 흰색, 연결 끊김 = 노랑, 오류 = 빨강, 보냄·다시 연결 = 초록, 앱 알림 = 회색 */}
            <span aria-hidden="true" className={cn('absolute left-2.5 rounded-full', high ? 'inset-y-4 w-1.5' : 'inset-y-3.5 w-1', tone.strip)} />

            <div className={cn('flex items-center gap-2 pr-8 text-xs text-muted-foreground', high && 'text-[13px]')}>
                {meta}
                {more > 0 ? (
                    <button
                        type="button"
                        onClick={onExpand}
                        aria-label={`알림 ${more + 1}개 펼치기`}
                        aria-expanded="false"
                        className={cn('ml-auto inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/70', focusRing)}
                    >
                        +{more}
                    </button>
                ) : null}
            </div>
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={`알림 닫기 · ${toast.title}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'absolute right-1.5 top-1.5 text-muted-foreground', high && 'right-2 top-2')}
            >
                <X />
            </button>

            {high ? (
                <div className="mt-2 flex items-end gap-4">
                    <div className="min-w-0 flex-1">
                        <p className={cn('font-semibold leading-tight tracking-tight', device === 'mobile' ? 'text-2xl' : 'text-[26px]')}>{toast.title}</p>
                        {toast.body ? <p className="mt-1 text-[15px] leading-snug text-foreground/75">{toast.body}</p> : null}
                    </div>
                    {ack}
                </div>
            ) : (
                <div className="mt-1 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className={cn('font-semibold leading-snug tracking-tight', low ? 'text-sm' : 'text-base')}>{toast.title}</p>
                        {toast.body && !toast.progress ? (
                            <p className={cn('mt-0.5 leading-snug', low ? 'text-[12.5px] text-muted-foreground' : 'text-[13.5px] text-foreground/75')}>
                                {toast.kind === 'offline' ? <LoaderCircle aria-hidden="true" className="mr-1 inline size-3.5 animate-spin align-[-2px] text-warning motion-reduce:animate-none" /> : null}
                                {toast.body}
                            </p>
                        ) : null}
                        {toast.progress ? <AckProgress done={toast.progress.done} total={toast.progress.total} /> : null}
                    </div>
                    {ack}
                    {action}
                </div>
            )}

            {timed && toast.createdAt > 0 && toast.ttl ? (
                <span aria-hidden="true" className="absolute inset-x-6 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]">
                    <TimeLeft createdAt={toast.createdAt} ttl={toast.ttl} className={tone.bar} />
                </span>
            ) : null}
        </div>
    );
}

/** 보낸 큐의 확인 현황 4/6 */
function AckProgress({ done, total }: { done: number; total: number }) {
    return (
        <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span aria-hidden="true" className="flex gap-1">
                {Array.from({ length: total }, (_, index) => (
                    <span key={index} className={cn('size-1.5 rounded-full', index < done ? 'bg-success' : 'bg-foreground/15')} />
                ))}
            </span>
            <span>
                확인 <span className="font-semibold tabular-nums text-foreground">{done}</span>/{total}
            </span>
        </p>
    );
}

/** 남은 시간 막대 — 렌더 대신 Web Animations 로 줄어들게 합니다 */
function TimeLeft({ createdAt, ttl, className }: { createdAt: number; ttl: number; className?: string }) {
    const barRef = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const bar = barRef.current;
        if (!bar || typeof bar.animate !== 'function') return;
        const remaining = Math.max(0, ttl - (Date.now() - createdAt));
        const animation = bar.animate([{ transform: `scaleX(${remaining / ttl})` }, { transform: 'scaleX(0)' }], { duration: remaining, easing: 'linear', fill: 'forwards' });
        return () => animation.cancel();
    }, [createdAt, ttl]);
    return <span ref={barRef} className={cn('block h-full origin-left rounded-full', className)} />;
}
