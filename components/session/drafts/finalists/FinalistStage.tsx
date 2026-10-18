'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleDashed, Ellipsis, ListMusic, Lock, LockOpen, Minus, Plus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar } from '@/components/conti/ui';
import MobileScore, { ScoreChart, type MobileScoreChrome } from '../MobileScore';
import DesktopConsole, { MetaChip, ackOf } from '../DesktopConsole';
import { BeatRing, MobileScreen as RingMobileScreen, ToastAnnouncer, ToastStack, nextStep, useDeviceActions } from '../pulse/PulseRing';
import { useMockPulse } from '../pulse/useMockPulse';
import type { DraftToast } from '../pulse/toastDemo';
import { DRAFT_CUES, DRAFT_TEAM, ROLE_LABEL, useMockLive, type CueLogEntry, type DraftCue, type DraftRole, type MockLive } from '../mockLive';
import type { FinalistProps, FinalistView } from './types';

/*
 * 최종 후보 B · 어두운 무대
 * 모바일 = 악보 우선(MobileScore), 데스크톱 = 진행 콘솔(DesktopConsole), 펄스 = 원형 링(PulseRing), 알림 = 카드 더미(PulseRing).
 * - 진행 상태(useMockLive)는 여기 하나 — 기본 화면과 펄스 화면이 같은 곡 · 섹션을 봅니다.
 * - 화면 전환은 위 막대의 두 칸 스위치 (모바일 '악보 | 펄스', 데스크톱 '지금 | 펄스').
 * - 큐 보내기는 빠른 큐 3개뿐 — 시트나 메뉴 없이 누르면 바로 보냅니다. 두 화면 · 두 기기에서 같은 3개가 늘 보입니다
 *   (모바일은 아래 막대 윗줄, 데스크톱은 오른쪽 칸 맨 아래 — 가운데 이전 · 다음 버튼과 같은 바닥줄).
 * - BPM 숫자는 박마다 살짝 뛰고(첫 박이 가장 크게), BPM 이 바뀌면 위 · 아래로 넘어갑니다.
 * - 알림은 카드 더미 한 가지뿐: 모바일은 아래 버튼 바로 위, 데스크톱은 오른쪽 칸의 빠른 큐 바로 위. 카드가 뜨면 내용이 그만큼 비켜 줍니다.
 */

type Device = FinalistProps['device'];

const targetLabel = (target: DraftRole | 'all') => (target === 'all' ? '전체' : ROLE_LABEL[target]);

/** 빠른 큐 — 이전 · 다음 넘김과 겹치지 않는 '전체' 큐 3개. 모든 화면에서 같은 순서 */
const QUICK_CUES: DraftCue[] = ['again', 'ending', 'prayer'].map((id) => DRAFT_CUES.find((cue) => cue.id === id)).filter((cue): cue is DraftCue => Boolean(cue));

/** 누른 빠른 큐가 '보냄'으로 바뀌어 있는 시간 — 그동안 다시 눌러도 보내지 않습니다 */
const SENT_MS = 1200;

interface ViewOption {
    id: FinalistView;
    label: string;
    icon?: LucideIcon;
}

const MOBILE_VIEWS: ViewOption[] = [
    { id: 'main', label: '악보' },
    { id: 'pulse', label: '펄스' },
];

const DESKTOP_VIEWS: ViewOption[] = [
    { id: 'main', label: '지금', icon: ListMusic },
    { id: 'pulse', label: '펄스', icon: CircleDashed },
];

export default function FinalistStage({ device, view = 'main', framed = false, toasts, onDismiss, onAck, onAction, onSendCue }: FinalistProps) {
    const base = useMockLive();
    const [mode, setMode] = useState<FinalistView>(view);
    /* view 는 처음 화면 — 바깥에서 바꾸면 따라가고, 그 밖에는 안에서 고른 화면을 지킵니다 */
    const [initialView, setInitialView] = useState(view);
    if (view !== initialView) {
        setInitialView(view);
        setMode(view);
    }
    /** 접힌 카드 더미의 높이 — 화면이 그만큼 비켜 줍니다 */
    const [footprint, setFootprint] = useState(0);

    /* 큐는 어디서 보내든 최근 큐에 남기고, 보낸 큐 알림을 띄웁니다 */
    const live: MockLive = {
        ...base,
        sendCue: (cue) => {
            base.sendCue(cue);
            onSendCue(cue.label, targetLabel(cue.target));
        },
    };

    return (
        <div className="dark relative h-full w-full overflow-hidden bg-background text-foreground [color-scheme:dark]">
            {device === 'mobile' ? (
                <MobileScore
                    framed={framed}
                    live={live}
                    hideOwnCues
                    renderTopBar={(chrome) => <StageTopBar chrome={chrome} mode={mode} onMode={setMode} />}
                    renderBody={(chrome) => (
                        <MobileBody
                            chrome={chrome}
                            mode={mode}
                            footprint={footprint}
                            stack={<Stack device="mobile" toasts={toasts} onDismiss={onDismiss} onAck={onAck} onAction={onAction} onFootprint={setFootprint} />}
                        />
                    )}
                    renderBottomBar={(chrome) => <StageBottomBar chrome={chrome} />}
                />
            ) : (
                <DesktopConsole
                    framed={framed}
                    live={live}
                    hideOwnCues
                    // 낮은 창에서는 팀 목록이 칸 아래로 이어지므로 끝을 흐리게 (스크롤로 이어 봄)
                    orderClassName="mask-b-from-[calc(100%-1.5rem)]"
                    headerSlot={({ locked }) => <ViewSwitch device="desktop" options={DESKTOP_VIEWS} value={mode} onChange={setMode} disabled={locked} />}
                    renderTempo={(state) => <ConsoleTempo live={state.live} locked={state.locked} beatOn={state.beatOn} />}
                    renderCenter={(center) => (mode === 'pulse' ? <PulseCenter live={center.live} locked={center.locked} /> : center.stage)}
                    renderCueColumn={(state) => (
                        <CueColumn
                            live={state.live}
                            locked={state.locked}
                            footprint={footprint}
                            stack={<Stack device="desktop" toasts={toasts} onDismiss={onDismiss} onAck={onAck} onAction={onAction} onFootprint={setFootprint} />}
                        />
                    )}
                />
            )}
            <ToastAnnouncer toasts={toasts} />
        </div>
    );
}

/** 알림 카드 더미 — 하나뿐. 화면을 바꿔도 같은 자리에서 그대로 이어집니다 */
function Stack({
    device,
    toasts,
    onDismiss,
    onAck,
    onAction,
    onFootprint,
}: {
    device: Device;
    toasts: DraftToast[];
    onDismiss: (id: string) => void;
    onAck: (id: string) => void;
    onAction: (id: string) => void;
    onFootprint: (height: number) => void;
}) {
    return (
        <ToastStack
            device={device}
            toasts={toasts}
            onDismiss={onDismiss}
            onAck={onAck}
            onAction={onAction}
            onFootprint={onFootprint}
            className={device === 'mobile' ? 'inset-x-3 bottom-2' : 'inset-x-4 bottom-3'}
        />
    );
}

/* ───────────── 공통: 화면 스위치 · 빠른 큐 · BPM ───────────── */

function ViewSwitch({
    device,
    options,
    value,
    onChange,
    disabled = false,
}: {
    device: Device;
    options: ViewOption[];
    value: FinalistView;
    onChange: (view: FinalistView) => void;
    disabled?: boolean;
}) {
    const mobile = device === 'mobile';
    return (
        <div role="group" aria-label="화면 보기" className="flex h-10 shrink-0 items-center rounded-full bg-muted p-1">
            {options.map((option) => {
                const active = option.id === value;
                const Icon = option.icon;
                return (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            'relative inline-flex h-8 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors',
                            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted disabled:cursor-not-allowed disabled:opacity-40',
                            // 모바일: 손가락 자리는 위아래로 넓게 (보이는 칩은 그대로)
                            mobile ? 'px-2.5 text-[13px] after:absolute after:inset-x-0 after:-inset-y-2' : 'px-3.5 text-sm',
                            active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

/** 빠른 큐 3개 — 누르면 바로 보냅니다. 모바일은 아래 막대 위 줄, 데스크톱은 오른쪽 칸 맨 아래 */
function QuickCues({ live, locked, device }: { live: MockLive; locked: boolean; device: Device }) {
    return (
        <div role="group" aria-label="빠른 큐 · 누르면 바로 보내요" className="grid grid-cols-3 gap-2">
            {QUICK_CUES.map((cue) => (
                <QuickCueButton key={cue.id} cue={cue} device={device} disabled={locked} onSend={live.sendCue} />
            ))}
        </div>
    );
}

/**
 * 빠른 큐 버튼 하나. 누르면 곧바로 보내고, 버튼이 1.2초 동안 '보냄'으로 바뀝니다 (그동안 다시 눌러도 한 번만).
 * 보낸 큐 알림은 바깥(쉘)이 띄웁니다.
 */
function QuickCueButton({ cue, device, disabled, onSend }: { cue: DraftCue; device: Device; disabled: boolean; onSend: MockLive['sendCue'] }) {
    const [sent, setSent] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const target = targetLabel(cue.target);

    useEffect(() => {
        const pending = timer;
        return () => {
            if (pending.current) clearTimeout(pending.current);
        };
    }, []);

    const send = () => {
        if (sent) return;
        onSend(cue);
        setSent(true);
        timer.current = setTimeout(() => setSent(false), SENT_MS);
    };

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={send}
            aria-label={sent ? `${cue.label} 큐를 ${target}에게 보냈어요` : `${cue.label} 큐 바로 보내기 · 받는 사람 ${target}`}
            className={cn(
                buttonVariants({ variant: 'secondary' }),
                'min-w-0 flex-col gap-0.5 px-2 leading-none',
                device === 'mobile' ? 'h-12' : 'h-14 @min-[1200px]/console:h-16',
                sent && 'bg-primary text-primary-foreground hover:bg-primary',
            )}
        >
            <span className={cn('flex max-w-full items-center gap-1 truncate font-semibold', device === 'mobile' ? 'text-[15px]' : 'text-sm @min-[1200px]/console:text-base')}>
                {sent ? <Check aria-hidden="true" className="size-4 animate-in zoom-in-50 duration-200 motion-reduce:animate-none" strokeWidth={2.75} /> : null}
                {sent ? '보냄' : cue.label}
            </span>
            <span className={cn('max-w-full truncate text-[11px] font-medium', sent ? 'text-primary-foreground/60' : 'text-muted-foreground')}>{sent ? `${cue.label} → ${target}` : target}</span>
        </button>
    );
}

/** 박자표 → 한 마디의 박 묶음 (4/4 = 1 2 3 4, 6/8 = 1 2 3 · 4 5 6) */
function beatGroups(beatsPerBar: number) {
    const beats = Array.from({ length: beatsPerBar }, (_, index) => index + 1);
    return beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];
}

const PULSE_SCALE = {
    sm: { down: 'scale-[1.24]', secondary: 'scale-[1.14]', beat: 'scale-[1.1]' },
    lg: { down: 'scale-[1.13]', secondary: 'scale-[1.08]', beat: 'scale-[1.05]' },
} as const;

/**
 * 박자에 맞춰 움직이는 BPM 숫자 (useMockPulse 는 박마다 두 번 다시 그리므로 이 잎 컴포넌트 안에서만).
 * - 박마다 숫자가 살짝 커졌다 돌아오고, 첫 박은 가장 크게 + 초록으로 한 번 반짝 (6/8 은 느끼는 두 박 1 · 4 에서만)
 * - dots: 숫자 앞 박자 점이 박마다 한 칸씩 켜짐 (6/8 은 3+3 묶음)
 * - BPM 이 바뀌면 숫자가 오를 때는 아래에서, 내릴 때는 위에서 들어옵니다
 * - 동작 줄이기: 커짐 · 반짝임 · 넘김 없이 켜진 점만 한 칸씩
 */
function BpmPulse({
    bpm,
    meter,
    resetKey,
    enabled = true,
    dots = false,
    size,
    className,
}: {
    bpm: number;
    meter: string;
    resetKey: string;
    enabled?: boolean;
    dots?: boolean;
    size: 'sm' | 'lg';
    className?: string;
}) {
    const pulse = useMockPulse({ bpm, meter, enabled, resetKey });
    const [shown, setShown] = useState({ bpm, dir: 0 as -1 | 0 | 1 });
    if (shown.bpm !== bpm) setShown({ bpm, dir: bpm > shown.bpm ? 1 : -1 });

    const compound = pulse.beatsPerBar === 6;
    const felt = !compound || pulse.downbeat || pulse.secondary;
    const hit = enabled && pulse.blink && felt;
    const scale = PULSE_SCALE[size];
    const fade = `${hit ? 70 : Math.round(Math.min(320, pulse.intervalMs * 0.6))}ms`;

    return (
        <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center', size === 'sm' ? 'gap-1.5' : 'gap-2.5', className)}>
            {dots ? (
                <span className={cn('flex items-center', size === 'sm' ? 'gap-1.5' : 'gap-2')}>
                    {beatGroups(pulse.beatsPerBar).map((group) => (
                        <span key={group[0]} className={cn('flex items-center', size === 'sm' ? 'gap-[3px]' : 'gap-1')}>
                            {group.map((beat) => {
                                const lit = enabled && pulse.count === beat;
                                const strong = beat === 1 || (compound && beat === 4);
                                return (
                                    <span
                                        key={beat}
                                        className={cn(
                                            'rounded-full transition-[background-color,scale] duration-75 motion-reduce:scale-100 motion-reduce:transition-none',
                                            size === 'sm' ? 'size-1.5' : 'size-2',
                                            lit && pulse.blink && 'scale-[1.35]',
                                            !enabled ? 'bg-muted-foreground/25' : lit ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : strong ? 'bg-foreground/30' : 'bg-foreground/15',
                                        )}
                                    />
                                );
                            })}
                        </span>
                    ))}
                </span>
            ) : null}
            <span
                className={cn(
                    'inline-block origin-center font-semibold tabular-nums transition-[scale,color] ease-out motion-reduce:scale-100 motion-reduce:text-foreground motion-reduce:transition-none',
                    size === 'sm' ? 'text-[13px] leading-4' : 'text-[28px] leading-none tracking-tight',
                    !hit ? 'scale-100' : pulse.downbeat ? cn(scale.down, 'text-brand') : pulse.secondary ? scale.secondary : scale.beat,
                )}
                style={{ transitionDuration: fade }}
            >
                <span
                    key={bpm}
                    className={cn(
                        'inline-block',
                        shown.dir !== 0 && 'duration-300 ease-out animate-in fade-in motion-reduce:animate-none',
                        shown.dir > 0 && 'slide-in-from-bottom-[70%]',
                        shown.dir < 0 && 'slide-in-from-top-[70%]',
                    )}
                >
                    {bpm}
                </span>
            </span>
        </span>
    );
}

/* ───────────── 모바일 ───────────── */

/** 위 막대 — 악보와 펄스에서 똑같이. 곡 · 키 / 박자 점 · BPM · 박자표, 그리고 화면 스위치 */
function StageTopBar({ chrome, mode, onMode }: { chrome: MobileScoreChrome; mode: FinalistView; onMode: (view: FinalistView) => void }) {
    const { live, locked, beatOn, onMore } = chrome;
    const { song } = live;
    return (
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border pl-1 pr-1">
            <button type="button" aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                <ChevronLeft className="size-5" />
            </button>

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <h2 className="truncate text-[17px] font-semibold leading-snug tracking-tight">{song.title}</h2>
                    <span aria-label={`키 ${song.key}`} className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold">
                        {song.key}
                    </span>
                </div>
                <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                    <span className="sr-only">
                        템포 {live.bpm} BPM · {song.meter} 박자
                    </span>
                    {/* 화면을 바꾸면 펄스 링과 같은 순간부터 다시 셉니다 */}
                    <BpmPulse bpm={live.bpm} meter={song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}-${mode}`} enabled={beatOn} dots size="sm" className="text-foreground" />
                    <span aria-hidden="true" className="truncate tabular-nums">
                        BPM · {song.meter}
                    </span>
                </p>
            </div>

            <ViewSwitch device="mobile" options={MOBILE_VIEWS} value={mode} onChange={onMode} disabled={locked} />

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

/**
 * 위 · 아래 막대 사이. 악보 또는 링, 그리고 그 아래쪽에 카드 더미.
 * 카드가 뜨면 악보 · 링이 카드 높이만큼 위로 비켜 줍니다 (아래 버튼과 박자를 가리지 않도록).
 */
function MobileBody({ chrome, mode, footprint, stack }: { chrome: MobileScoreChrome; mode: FinalistView; footprint: number; stack: ReactNode }) {
    const { live, locked } = chrome;
    const actions = useDeviceActions(true);
    const reserve = footprint > 0 ? footprint + 16 : 0;
    const resetKey = `${live.songIndex}-${live.sectionIndex}`;

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            {mode === 'main' ? (
                <div key="score" className="flex min-h-0 flex-1 flex-col">
                    <ScoreChart live={live} locked={locked} />
                    <div aria-hidden="true" className="shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none" style={{ height: reserve }} />
                </div>
            ) : (
                <div key="pulse" className="min-h-0 flex-1" inert={locked ? true : undefined}>
                    <RingMobileScreen
                        live={live}
                        actions={actions}
                        onSendCue={(label) => live.sendCue(QUICK_CUES.find((cue) => cue.label === label) ?? { label, target: 'all' })}
                        stack={null}
                        footprint={footprint}
                        header={null}
                        footer={null}
                        tallMin={520}
                        bpm={<BpmPulse bpm={live.bpm} meter={live.song.meter} resetKey={resetKey} size="lg" />}
                    />
                </div>
            )}
            {stack}
        </div>
    );
}

/**
 * 아래 막대 — 악보와 펄스에서 똑같이.
 * 윗줄: 빠른 큐 3개 (누르면 바로 보냄) / 아랫줄: 이전 · 송폼 · 순서 · 다음. 잠그면 잠금 해제 버튼 하나만.
 */
function StageBottomBar({ chrome }: { chrome: MobileScoreChrome }) {
    const { live, locked, onOrder, onUnlock } = chrome;
    const { song, songIndex, sectionIndex, nextSection, nextSong } = live;
    const atStart = songIndex === 0 && sectionIndex === 0;
    const atEnd = !nextSection && !nextSong;
    const nextName = nextSection ?? nextSong?.title ?? null;
    const nextLabel = nextSection ? `다음 섹션: ${nextSection}` : nextSong ? `다음 곡: ${nextSong.title}` : '마지막 섹션';
    const prevLabel = sectionIndex > 0 ? `이전 섹션: ${song.form[sectionIndex - 1]}` : '이전 곡의 마지막 섹션';

    if (locked) {
        return (
            <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                <button type="button" onClick={onUnlock} className={cn(buttonVariants({ variant: 'outline' }), 'h-14 w-full text-[15px]')}>
                    <LockOpen className="size-[18px]" />
                    잠금 해제
                </button>
            </div>
        );
    }

    return (
        <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
            <QuickCues live={live} locked={locked} device="mobile" />
            <nav aria-label="악보 넘김" className="mt-2 grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                <button type="button" aria-label={prevLabel} disabled={atStart} onClick={live.prevSectionStep} className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'size-14')}>
                    <ChevronLeft className="size-6" />
                </button>
                <button type="button" aria-haspopup="dialog" onClick={onOrder} className={cn(buttonVariants({ variant: 'secondary' }), 'h-14 min-w-0 px-3 text-[15px]')}>
                    송폼 · 순서
                </button>
                <button
                    type="button"
                    aria-label={nextLabel}
                    disabled={atEnd}
                    onClick={live.nextSectionStep}
                    className={cn(buttonVariants({ variant: 'default' }), 'h-14 min-w-0 justify-between gap-1 pl-5 pr-3.5 text-[16px]')}
                >
                    <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="shrink-0">{nextSection || atEnd ? '다음' : '다음 곡'}</span>
                        {nextName ? <span className="truncate text-[13px] font-medium text-primary-foreground/55">{nextName}</span> : null}
                    </span>
                    <ChevronRight className="size-6" />
                </button>
            </nav>
        </div>
    );
}

/* ───────────── 데스크톱 ───────────── */

/** 콘솔 가운데 박자 · BPM 줄 — 박자표를 따라 4/4 는 네 칸, 6/8 은 3+3 두 묶음. BPM 숫자도 같은 박에 맞춰 뜁니다 */
function ConsoleTempo({ live, locked, beatOn }: { live: MockLive; locked: boolean; beatOn: boolean }) {
    return (
        <div className="flex shrink-0 items-center gap-4">
            <BeatCells bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} enabled={beatOn} />
            <BpmControl live={live} locked={locked} beatOn={beatOn} />
        </div>
    );
}

/** 박자 칸 (박마다 두 번 다시 그리는 잎 컴포넌트 — 옆의 BPM 버튼은 박마다 다시 그리지 않도록 따로) */
function BeatCells({ bpm, meter, resetKey, enabled }: { bpm: number; meter: string; resetKey: string; enabled: boolean }) {
    const pulse = useMockPulse({ bpm, meter, enabled, resetKey });
    return (
        <div aria-hidden="true" className="flex flex-1 gap-4">
            {beatGroups(pulse.beatsPerBar).map((group) => (
                <div key={group[0]} className="flex flex-1 gap-2">
                    {group.map((beat) => (
                        <span
                            key={beat}
                            className={cn(
                                'flex h-14 flex-1 items-center justify-center rounded-2xl text-sm font-semibold tabular-nums transition-colors duration-75 motion-reduce:transition-none',
                                pulse.count === beat ? (beat === 1 ? 'bg-brand text-brand-foreground' : 'bg-primary text-primary-foreground') : 'bg-muted text-muted-foreground',
                            )}
                        >
                            {beat}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** − BPM + — 두 화면(지금 · 펄스)에서 같은 모양. 숫자는 박에 맞춰 뛰고, 바꾸면 위 · 아래로 넘어갑니다 */
function BpmControl({ live, locked, beatOn = true }: { live: MockLive; locked: boolean; beatOn?: boolean }) {
    const { song } = live;
    const changed = live.bpm !== song.bpm;
    return (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="BPM 조절">
            <button type="button" aria-label="BPM 1 내리기" disabled={locked} onClick={() => live.nudgeBpm(-1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'size-10 bg-transparent text-muted-foreground')}>
                <Minus />
            </button>
            <div className="flex w-[84px] flex-col items-center">
                <p className="sr-only" aria-live="polite">
                    {live.bpm} BPM{changed ? ` · 원래 ${song.bpm}` : ''}
                </p>
                <BpmPulse bpm={live.bpm} meter={song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} enabled={beatOn} size="lg" />
                <p aria-hidden="true" className={cn('mt-1 whitespace-nowrap text-[11px]', changed ? 'font-medium text-brand' : 'text-muted-foreground')}>
                    {changed ? `BPM · 원래 ${song.bpm}` : 'BPM'}
                </p>
            </div>
            <button type="button" aria-label="BPM 1 올리기" disabled={locked} onClick={() => live.nudgeBpm(1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'size-10 bg-transparent text-muted-foreground')}>
                <Plus />
            </button>
        </div>
    );
}

/**
 * 콘솔 가운데 칸의 펄스 화면. 곡 줄과 BPM · 이전 · 다음 버튼은 '지금' 화면과 같은 자리 · 같은 모양이고,
 * 그 사이를 원형 링(박 · 마디)이 채웁니다.
 */
function PulseCenter({ live, locked }: { live: MockLive; locked: boolean }) {
    const { song, sectionIndex, nextSection, nextSong } = live;
    const lastOfSong = nextSection === null;
    const atEnd = lastOfSong && nextSong === null;
    const prevSection = sectionIndex > 0 ? song.form[sectionIndex - 1] : null;
    const bars = song.chords[live.section]?.length ?? 4;
    const next = nextStep(live);
    const ringRef = useRef<HTMLDivElement>(null);
    /** 링이 충분히 크면 섹션 이름도 크게 (작은 링에서는 긴 이름이 원 안에 들어가도록) */
    const [large, setLarge] = useState(false);

    useEffect(() => {
        const element = ringRef.current;
        if (!element) return;
        const observer = new ResizeObserver(() => setLarge(element.offsetWidth >= 500));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <main aria-label="펄스 · 박자와 지금 섹션" className="@container/stage flex min-h-0 min-w-0 flex-col px-8 pb-5 pt-4 @min-[1200px]/console:px-10 @min-[1200px]/console:pb-6">
            <div className="shrink-0">
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
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center py-4 [container-type:size]">
                <div ref={ringRef} style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}>
                    <BeatRing
                        bpm={live.bpm}
                        meter={song.meter}
                        resetKey={`${live.songIndex}-${sectionIndex}`}
                        bars={bars}
                        section={live.section}
                        eyebrow={`지금 · 섹션 ${sectionIndex + 1}/${song.form.length}`}
                        device={large ? 'desktop' : 'mobile'}
                    />
                </div>
            </div>

            {/* 박자표 · 다음 · BPM */}
            <div className="flex shrink-0 items-center gap-5">
                <p className="flex shrink-0 items-baseline gap-2">
                    <span className="text-[28px] font-semibold leading-none tabular-nums">{song.meter}</span>
                    <span className="text-sm font-medium text-muted-foreground">{song.meter === '6/8' ? '박자 · 3+3' : '박자'}</span>
                </p>
                <span aria-hidden="true" className="h-8 w-px shrink-0 bg-border" />
                <p className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">{next.kind === 'song' ? '다음 곡' : next.kind === 'end' ? '지금' : '다음'}</span>
                    <span className="truncate text-xl font-semibold tracking-tight">{next.name}</span>
                </p>
                <BpmControl live={live} locked={locked} />
            </div>

            {/* 이전 · 다음 — '지금' 화면과 같은 버튼 */}
            <div className="mt-4 flex shrink-0 gap-3">
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
        </main>
    );
}

/** 아바타 색은 파트 묶음으로 (인도 · 악기 · 음향/미디어) — 콘솔 왼쪽 팀 목록과 같게 */
const ROLE_TONE: Record<DraftRole, 'lilac' | 'sky' | 'mint'> = { leader: 'lilac', instrument: 'sky', sound: 'mint', media: 'mint' };

/** 방금 보낸 큐에서 받은 사람이 하나씩 확인하는 간격 (목업) */
const ACK_FIRST_MS = 600;
const ACK_STEP_MS = 380;

/** 받은 사람 확인 문구 — ackOf 와 같은 말 */
function ackText(acked: number, total: number): { done: boolean; text: string } {
    if (total === 0) return { done: false, text: '받는 사람 없음' };
    if (acked === total) return { done: true, text: total === 1 ? '확인' : '모두 확인' };
    if (acked === 0) return { done: false, text: '전송됨' };
    return { done: false, text: `확인 ${acked}/${total}` };
}

/**
 * 최근 큐 한 줄 — 무엇을 누가 누구에게, 그리고 받은 사람 얼굴 (확인한 사람은 또렷하게 + 초록 점).
 * 내가 방금 보낸 큐는 '전송됨'에서 시작해 받은 사람이 하나씩 확인합니다 (목업: 인도자 + 확인 표시가 있는 팀원 — 보낸 큐 알림의 확인 수와 같게).
 */
function RecentCue({ entry }: { entry: CueLogEntry }) {
    const mine = entry.from === '나';
    const fresh = mine && entry.at === '방금';
    const people = DRAFT_TEAM.filter((member) => member.online && member.name !== entry.from && (entry.target === 'all' || member.role === entry.target));
    const ackers = people.filter((member) => Boolean(member.ack) || (fresh && member.role === 'leader'));
    const [revealed, setRevealed] = useState(fresh ? 0 : ackers.length);
    const ackedNames = new Set(ackers.slice(0, revealed).map((member) => member.name));
    const ack = fresh ? ackText(revealed, people.length) : ackOf(entry);

    useEffect(() => {
        if (revealed >= ackers.length) return;
        const timer = setTimeout(() => setRevealed((count) => count + 1), revealed === 0 ? ACK_FIRST_MS : ACK_STEP_MS);
        return () => clearTimeout(timer);
    }, [revealed, ackers.length]);
    return (
        <li className="flex gap-3 py-3 duration-300 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
            <span aria-hidden="true" className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', mine ? 'bg-brand' : 'bg-muted-foreground/50')} />
            <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">{entry.label}</span>
                    <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', ack.done ? 'font-medium text-brand' : 'text-muted-foreground')}>
                        {ack.done ? <Check className="size-3.5 self-center" aria-hidden="true" /> : null}
                        {ack.text}
                    </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {mine ? '나' : entry.from} → {targetLabel(entry.target)} · {entry.at}
                </p>
                {people.length > 0 ? (
                    <ul aria-label="받은 사람" className="mt-2 flex flex-wrap gap-1.5">
                        {people.map((member) => {
                            const acked = ackedNames.has(member.name);
                            return (
                                <li key={member.name} className="relative">
                                    <Avatar name={member.name} tone={ROLE_TONE[member.role]} size="xs" className={cn('transition-opacity duration-300 motion-reduce:transition-none', !acked && 'opacity-40')} />
                                    {acked ? <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-background duration-200 animate-in zoom-in-50 motion-reduce:animate-none" /> : null}
                                    <span className="sr-only">{acked ? ' 확인' : ' 확인 전'}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </div>
        </li>
    );
}

/**
 * 오른쪽 칸 — 위: 최근 큐 (누가 누구에게, 받은 사람 확인) / 가운데: 알림 카드 더미 / 아래: 빠른 큐 3개.
 * 빠른 큐는 가운데 칸의 이전 · 다음 버튼과 같은 높이 · 같은 바닥줄. 카드는 늘 빠른 큐 위에 쌓이고, 펼쳐도 위로만 자랍니다.
 */
function CueColumn({ live, locked, footprint, stack }: { live: MockLive; locked: boolean; footprint: number; stack: ReactNode }) {
    return (
        <aside aria-label="최근 큐와 빠른 큐" className="relative flex min-h-0 flex-col border-l border-border">
            <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
                {/* 세 칸의 머리줄은 같은 48px 띠에 맞춥니다 */}
                <div className="flex h-12 shrink-0 items-center justify-between px-1">
                    <h2 className="text-[17px] font-semibold tracking-tight">최근 큐</h2>
                    <span className="text-xs text-muted-foreground">받은 사람 확인</span>
                </div>
                <ol aria-label="최근 큐" className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-1 mask-b-from-[calc(100%-1.5rem)] [scrollbar-width:none]">
                    {live.log.map((entry) => (
                        <RecentCue key={entry.id} entry={entry} />
                    ))}
                </ol>
            </div>

            {/* 카드 더미 자리 — 카드가 뜨면 최근 큐가 그만큼 비켜 줍니다 */}
            <div className="relative shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none" style={{ height: footprint > 0 ? footprint + 24 : 0 }}>
                {stack}
            </div>

            <div className="shrink-0 border-t border-border px-4 pb-5 pt-3 @min-[1200px]/console:pb-6">
                <div className="mb-2.5 flex items-baseline justify-between px-1">
                    <h2 className="text-[15px] font-semibold tracking-tight">빠른 큐</h2>
                    <span className="text-xs text-muted-foreground">{locked ? '잠금 중' : '누르면 바로 보내요'}</span>
                </div>
                <QuickCues live={live} locked={locked} device="desktop" />
            </div>
        </aside>
    );
}
