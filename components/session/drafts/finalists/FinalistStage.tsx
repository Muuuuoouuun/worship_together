'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, CircleDashed, Ellipsis, ListMusic, Lock, Minus, Plus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import MobileScore, { ScoreChart, type MobileScoreChrome } from '../MobileScore';
import DesktopConsole, { MetaChip } from '../DesktopConsole';
import { BeatRing, MobileScreen as RingMobileScreen, QUICK_CUES, ToastAnnouncer, ToastStack, nextStep, useDeviceActions } from '../pulse/PulseRing';
import { useMockPulse } from '../pulse/useMockPulse';
import { DRAFT_CUES, ROLE_LABEL, useMockLive, type DraftCue, type DraftRole, type MockLive } from '../mockLive';
import type { FinalistProps, FinalistView } from './types';

/*
 * 최종 후보 B · 어두운 무대
 * 모바일 = 악보 우선(MobileScore), 데스크톱 = 진행 콘솔(DesktopConsole), 펄스 = 원형 링(PulseRing), 알림 = 카드 더미(PulseRing).
 * - 진행 상태(useMockLive)는 여기 하나 — 기본 화면과 펄스 화면이 같은 곡 · 섹션을 봅니다.
 * - 화면 전환은 위 막대의 두 칸 스위치 (모바일 '악보 | 펄스', 데스크톱 '지금 | 펄스'). 위 · 아래 막대와 알림은 두 화면이 같습니다.
 * - 알림은 카드 더미 한 가지뿐: 모바일은 아래 버튼 바로 위, 데스크톱은 오른쪽 칸(큐 보내기) 아래. 카드가 뜨면 내용이 그만큼 비켜 줘서 버튼과 박자를 가리지 않습니다.
 */

type Device = FinalistProps['device'];

const targetLabel = (target: DraftRole | 'all') => (target === 'all' ? '전체' : ROLE_LABEL[target]);

/** 빠른 큐 이름 → 큐 목록의 같은 큐 (받는 역할을 알아야 최근 큐에 남길 수 있습니다) */
function cueFor(label: string): Pick<DraftCue, 'label' | 'target'> {
    return DRAFT_CUES.find((cue) => cue.label === label) ?? { label, target: 'all' };
}

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

    // 알림 카드 더미는 하나 — 화면을 바꿔도 같은 자리에서 그대로 이어집니다
    const stack = (
        <ToastStack
            device={device}
            toasts={toasts}
            onDismiss={onDismiss}
            onAck={onAck}
            onAction={onAction}
            onFootprint={setFootprint}
            className={device === 'mobile' ? 'inset-x-3 bottom-2' : 'inset-x-4 bottom-3'}
        />
    );

    return (
        <div className="dark relative h-full w-full overflow-hidden bg-background text-foreground [color-scheme:dark]">
            {device === 'mobile' ? (
                <MobileScore
                    framed={framed}
                    live={live}
                    hideOwnCues
                    renderTopBar={(chrome) => <StageTopBar chrome={chrome} mode={mode} onMode={setMode} />}
                    renderBody={(chrome) => <MobileBody chrome={chrome} mode={mode} footprint={footprint} stack={stack} />}
                />
            ) : (
                <DesktopConsole
                    framed={framed}
                    live={live}
                    hideOwnCues
                    denseCues
                    // 낮은 창에서는 팀 목록이 칸 아래로 이어지므로 끝을 흐리게 (스크롤로 이어 봄)
                    orderClassName="mask-b-from-[calc(100%-1.5rem)]"
                    headerSlot={({ locked }) => <ViewSwitch device="desktop" options={DESKTOP_VIEWS} value={mode} onChange={setMode} disabled={locked} />}
                    renderBeat={(state) => <MeterBeats live={state.live} beatOn={state.beatOn} />}
                    renderCenter={(center) => (mode === 'pulse' ? <PulseCenter live={center.live} locked={center.locked} /> : center.stage)}
                    cueDock={
                        <div
                            className={cn('relative shrink-0 transition-[height] duration-300 ease-out motion-reduce:transition-none', footprint > 0 && 'border-t border-border')}
                            style={{ height: footprint > 0 ? footprint + 24 : 0 }}
                        >
                            {stack}
                        </div>
                    }
                    cueDockOpen={toasts.length > 0}
                />
            )}
            <ToastAnnouncer toasts={toasts} />
        </div>
    );
}

/* ───────────── 화면 스위치 (두 화면 · 두 기기 공통) ───────────── */

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

/* ───────────── 모바일 ───────────── */

/** 위 막대 — 악보와 펄스에서 똑같이. 곡 · 키 / 박자 점 · BPM · 박자표 · 곡 순서, 그리고 화면 스위치 */
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
                    {/* 화면을 바꾸면 펄스 링과 같은 순간부터 다시 셉니다 */}
                    <BeatDot live={live} enabled={beatOn} phaseKey={mode} />
                    <span className="truncate tabular-nums">
                        <span className="font-semibold text-foreground">{live.bpm}</span> BPM · {song.meter} · 곡 {live.songIndex + 1}/{live.songs.length}
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

/** 위 막대의 박자 점 — 박자표를 따라 (6/8 은 1 · 4박에만), 첫 박은 초록 */
function BeatDot({ live, enabled, phaseKey }: { live: MockLive; enabled: boolean; phaseKey: string }) {
    const pulse = useMockPulse({ bpm: live.bpm, meter: live.song.meter, enabled, resetKey: `${live.songIndex}-${live.sectionIndex}-${phaseKey}` });
    const felt = pulse.beatsPerBar !== 6 || pulse.downbeat || pulse.secondary;
    const lit = enabled && pulse.blink && felt;
    return (
        <span
            aria-hidden="true"
            className={cn(
                'size-2 shrink-0 rounded-full transition-colors duration-75 motion-reduce:transition-none',
                !enabled ? 'bg-muted-foreground/30' : lit ? (pulse.downbeat ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
            )}
        />
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

    return (
        <div className="flex min-h-0 flex-1 flex-col">
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
                            onSendCue={(label) => live.sendCue(cueFor(label))}
                            stack={null}
                            footprint={footprint}
                            header={null}
                            footer={null}
                            tallMin={520}
                        />
                    </div>
                )}
                {stack}
            </div>

            {mode === 'pulse' ? <QuickCues live={live} locked={locked} /> : null}
        </div>
    );
}

/** 펄스 화면의 빠른 큐 — 아래 막대 바로 위 엄지 자리 */
function QuickCues({ live, locked }: { live: MockLive; locked: boolean }) {
    return (
        <div role="group" aria-label="빠른 큐 보내기" className="grid shrink-0 grid-cols-3 gap-2 px-4 pb-2.5 pt-1">
            {QUICK_CUES.slice(0, 3).map((quick) => (
                <button
                    key={quick.label}
                    type="button"
                    disabled={locked}
                    onClick={() => live.sendCue(cueFor(quick.label))}
                    aria-label={`${quick.label} 큐 보내기 · 받는 사람 ${quick.target}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-11 gap-1.5 px-2 text-[13px]')}
                >
                    {quick.label}
                    <span aria-hidden="true" className="text-[11px] font-medium text-muted-foreground">
                        {quick.target}
                    </span>
                </button>
            ))}
        </div>
    );
}

/* ───────────── 데스크톱 ───────────── */

/** 콘솔 가운데 박자 칸 — 박자표를 따라 4/4 는 네 칸, 6/8 은 3+3 두 묶음 */
function MeterBeats({ live, beatOn }: { live: MockLive; beatOn: boolean }) {
    const pulse = useMockPulse({ bpm: live.bpm, meter: live.song.meter, enabled: beatOn, resetKey: `${live.songIndex}-${live.sectionIndex}` });
    const beats = Array.from({ length: pulse.beatsPerBar }, (_, index) => index + 1);
    const groups = pulse.beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];
    return (
        <div aria-hidden="true" className="flex flex-1 gap-4">
            {groups.map((group) => (
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

/**
 * 콘솔 가운데 칸의 펄스 화면. 곡 줄과 이전 · 다음 버튼은 '지금' 화면과 같은 자리 · 같은 모양이고,
 * 그 사이를 원형 링(박 · 마디)과 템포 줄이 채웁니다.
 */
function PulseCenter({ live, locked }: { live: MockLive; locked: boolean }) {
    const { song, sectionIndex, nextSection, nextSong } = live;
    const lastOfSong = nextSection === null;
    const atEnd = lastOfSong && nextSong === null;
    const prevSection = sectionIndex > 0 ? song.form[sectionIndex - 1] : null;
    const bars = song.chords[live.section]?.length ?? 4;
    const changed = live.bpm !== song.bpm;
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
