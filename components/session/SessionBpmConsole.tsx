"use client";

import type { ComponentType, CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { buttonVariants } from '@/components/ui/button';
import { STATUS } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import { AudioLines, Eye, EyeOff, Gauge, Music2, Zap } from 'lucide-react';

interface SessionBpmConsoleProps {
    autoBpmSync: boolean;
    bpmEnabled: boolean;
    canControlLocally: boolean;
    currentBpm: number | null;
    currentSongTitle: string | null;
    isActive: boolean;
    onAdjustBpm: (delta: number) => void;
    onApplySongPreset: () => void;
    onToggleAutoBpmSync: () => void;
    onToggleBpmEnabled: () => void;
    songPresetBpm: number | null;
}

export default function SessionBpmConsole({
    autoBpmSync,
    bpmEnabled,
    canControlLocally,
    currentBpm,
    currentSongTitle,
    isActive,
    onAdjustBpm,
    onApplySongPreset,
    onToggleAutoBpmSync,
    onToggleBpmEnabled,
    songPresetBpm,
}: SessionBpmConsoleProps) {
    const { activeBeat, blinkActive } = useVisualMetronome(bpmEnabled && isActive, currentBpm);
    const statusLabel = !isActive ? '세션 종료' : bpmEnabled && currentBpm
        ? '메트로놈 켜짐'
        : bpmEnabled
            ? 'BPM 프리셋 대기'
            : '메트로놈 꺼짐';
    const statusTone = bpmEnabled && currentBpm
        ? STATUS.ok.soft
        : bpmEnabled
            ? STATUS.warn.soft
            : STATUS.idle.soft;
    const controlHelpText = !canControlLocally
        ? '현재 인도자가 공유 BPM 콘솔을 제어 중입니다.'
        : autoBpmSync
            ? '곡이 바뀌면 저장된 BPM 프리셋을 자동으로 불러옵니다.'
            : '자동 적용이 꺼져 있습니다. 수동으로 미세 조정할 수 있습니다.';
    const displayBeat = bpmEnabled && isActive && currentBpm ? activeBeat : 0;
    const displayBlink = bpmEnabled && isActive && currentBpm ? blinkActive : false;
    const beatDots = useMemo(() => Array.from({ length: 4 }, (_, index) => index + 1), []);
    const metronomeRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!metronomeRef.current || !currentBpm) return;
        const intervalMs = 60000 / currentBpm;
        const delayMs = -(Date.now() % (intervalMs * 2));
        metronomeRef.current.style.animationDelay = `${delayMs}ms`;
    }, [currentBpm]);

    const beatDurationStyle = useMemo(() => {
        if (!currentBpm) return { '--beat-duration': '0.75s' } as CSSProperties;
        const intervalMs = 60000 / currentBpm;
        return {
            '--beat-duration': `${(intervalMs / 1000).toFixed(3)}s`,
        } as CSSProperties;
    }, [currentBpm]);
    const metronomeActive = bpmEnabled && isActive && Boolean(currentBpm);

    return (
        <GlassCard>
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <AudioLines size={18} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h2 className="text-[17px] font-semibold tracking-tight text-foreground">드럼 BPM</h2>
                    <span className={cn('inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium', statusTone)}>
                        {statusLabel}
                    </span>
                </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                밴드를 위한 시각 메트로놈입니다. 곡별 프리셋을 저장하면 예배 흐름에 따라 자동으로 불러옵니다.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-[1.05fr_0.95fr] xl:grid-cols-1">
                <div className="rounded-3xl bg-muted/50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">현재 박자</p>
                            <p
                                className={cn('mt-1 inline-block text-4xl font-semibold tabular-nums tracking-tight text-foreground', metronomeActive && 'bpm-digit-pulse')}
                                style={beatDurationStyle}
                            >
                                {currentBpm ?? '--'}
                                <span className="ml-1.5 text-base font-medium text-muted-foreground">BPM</span>
                            </p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                                {currentSongTitle ? `${currentSongTitle}` : '곡이 선택되지 않았습니다'}
                            </p>
                        </div>
                        <div ref={metronomeRef} className="flex flex-col items-center gap-3" style={beatDurationStyle}>
                            <div
                                className={cn('relative h-24 w-28 overflow-hidden rounded-2xl border border-border transition duration-150', metronomeActive ? 'bg-card' : 'bg-muted/40')}
                                aria-label="BPM 시각 메트로놈"
                                data-testid="bpm-metronome"
                            >
                                <div className="absolute inset-x-5 bottom-4 h-1 rounded-full bg-foreground/10" />
                                <div className="absolute left-1/2 top-5 h-14 w-1 -translate-x-1/2 rounded-full bg-foreground/20" />
                                <div className={cn('absolute left-1/2 top-5 h-14 w-1 -translate-x-1/2 rounded-full bg-foreground', metronomeActive ? 'bpm-metronome-arm' : 'rotate-0 opacity-40')}>
                                    <span className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-foreground" />
                                </div>
                                <div className="absolute bottom-3 left-1/2 size-4 -translate-x-1/2 rounded-full bg-foreground" />
                                {metronomeActive ? (
                                    <>
                                        <div className="bpm-beat-ring absolute bottom-1 left-1/2 size-12 -translate-x-1/2 rounded-full border border-foreground/20" />
                                        {displayBeat === 1 && displayBlink && (
                                            <div className="animate-pulse-ring absolute bottom-1 left-1/2 size-12 -translate-x-1/2 rounded-full border-2 border-brand/60" />
                                        )}
                                    </>
                                ) : null}
                                <div className={cn('absolute right-3 top-3 size-2.5 rounded-full transition duration-150', displayBlink ? 'bg-brand' : 'bg-foreground/15')} />
                            </div>
                            <div className="flex items-center gap-2">
                                {beatDots.map((beat) => {
                                    const isCurrentBeat = displayBeat === beat && displayBlink;
                                    const isDownbeat = beat === 1;

                                    return (
                                        <span
                                            key={beat}
                                            className={cn('relative flex items-center justify-center transition-all', isDownbeat ? 'size-3.5' : 'size-2.5')}
                                        >
                                            <span
                                                className={cn(
                                                    'size-full rounded-full transition-all duration-100',
                                                    isCurrentBeat
                                                        ? isDownbeat ? 'scale-125 bg-brand' : 'scale-115 bg-foreground'
                                                        : isDownbeat ? 'bg-foreground/25' : 'bg-foreground/15',
                                                )}
                                            />
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-w-0">
                    <dl className="divide-y divide-border border-y border-border">
                        <ControlMetric
                            icon={Music2}
                            label="곡 프리셋"
                            value={songPresetBpm ? `${songPresetBpm} BPM` : '미설정'}
                        />
                        <ControlMetric
                            icon={Gauge}
                            label="자동 적용"
                            value={autoBpmSync ? '켜짐' : '꺼짐'}
                        />
                    </dl>

                    <h3 className="mt-5 text-sm font-semibold text-foreground">라이브 제어</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{controlHelpText}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onToggleBpmEnabled}
                            disabled={!isActive || !canControlLocally || (!currentBpm && !bpmEnabled)}
                            aria-pressed={bpmEnabled}
                            className={cn(buttonVariants({ variant: bpmEnabled ? 'default' : 'outline', size: 'sm' }), 'h-10 px-3')}
                        >
                            {bpmEnabled ? <EyeOff size={15} /> : <Eye size={15} />}
                            {bpmEnabled ? '메트로놈 끄기' : '메트로놈 켜기'}
                        </button>
                        <button
                            type="button"
                            onClick={onToggleAutoBpmSync}
                            disabled={!isActive || !canControlLocally}
                            aria-pressed={autoBpmSync}
                            className={cn(buttonVariants({ variant: autoBpmSync ? 'default' : 'outline', size: 'sm' }), 'h-10 px-3')}
                        >
                            <Zap size={15} />
                            {autoBpmSync ? '자동 적용 켜짐' : '자동 적용 꺼짐'}
                        </button>
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-2">
                        {[-5, -1, 1, 5].map((delta) => (
                            <button
                                key={delta}
                                type="button"
                                onClick={() => onAdjustBpm(delta)}
                                disabled={!isActive || !canControlLocally}
                                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-0 tabular-nums')}
                            >
                                {delta > 0 ? `+${delta}` : delta}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={onApplySongPreset}
                        disabled={!isActive || !canControlLocally || !songPresetBpm}
                        className={cn(buttonVariants({ size: 'sm' }), 'mt-2 h-10 w-full')}
                    >
                        <AudioLines size={15} />
                        현재 곡 BPM 적용
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}

function ControlMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <Icon size={15} className="shrink-0 text-muted-foreground" />
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="ml-auto text-sm font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
    );
}

export function useVisualMetronome(enabled: boolean, bpm: number | null) {
    const [blinkActive, setBlinkActive] = useState(false);
    const [activeBeat, setActiveBeat] = useState(0);

    useEffect(() => {
        if (!enabled || !bpm || !Number.isFinite(bpm) || bpm <= 0) {
            return;
        }

        const intervalMs = 60000 / bpm;
        const pulseMs = Math.min(160, intervalMs * 0.35);
        let timer: ReturnType<typeof setTimeout>;
        // Use wall-clock phase so tabs on this device agree and background throttling
        // doesn't accumulate drift. This is a tempo guide, not a shared bar/downbeat clock.
        const tick = () => {
            const now = Date.now();
            const phase = now % intervalMs;
            setActiveBeat((Math.floor(now / intervalMs) % 4) + 1);
            setBlinkActive(phase < pulseMs && !document.hidden);
            timer = setTimeout(tick, Math.max(8, (phase < pulseMs ? pulseMs : intervalMs) - phase));
        };
        timer = setTimeout(tick, 0);
        const resume = () => { clearTimeout(timer); tick(); };
        document.addEventListener('visibilitychange', resume);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', resume);
        };
    }, [enabled, bpm]);

    return { activeBeat: enabled ? activeBeat : 0, blinkActive: enabled ? blinkActive : false };
}
