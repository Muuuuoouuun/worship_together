"use client";

import type { ComponentType, CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import GlassCard from '@/components/ui/GlassCard';
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
        ? 'bg-emerald-500/10 text-emerald-700'
        : bpmEnabled
            ? 'bg-amber-500/10 text-amber-700'
            : 'bg-primary/5 text-muted-foreground';
    const controlHelpText = !canControlLocally
        ? '현재 인도자가 공유 BPM 콘솔을 제어 중입니다.'
        : autoBpmSync
            ? '곡이 바뀌면 저장된 BPM 프리셋을 자동으로 불러옵니다.'
            : '자동 적용이 꺼져 있습니다. 수동으로 미세 조정할 수 있습니다.';
    const displayBeat = bpmEnabled && isActive && currentBpm ? activeBeat : 0;
    const displayBlink = bpmEnabled && isActive && currentBpm ? blinkActive : false;
    const beatDots = useMemo(() => Array.from({ length: 4 }, (_, index) => index + 1), []);
    const beatDurationStyle = useMemo(() => ({
        '--beat-duration': `${currentBpm ? (60 / currentBpm).toFixed(3) : '0.75'}s`,
    }) as CSSProperties, [currentBpm]);
    const metronomeActive = bpmEnabled && isActive && Boolean(currentBpm);

    return (
        <GlassCard className="border-primary/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${displayBlink ? 'bg-secondary/20 text-secondary shadow-[0_0_22px_rgba(198,106,69,0.25)]' : 'bg-secondary/10 text-secondary'} transition duration-150`}>
                        <AudioLines size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">드럼 BPM</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            밴드를 위한 시각 메트로놈입니다. 곡별 프리셋을 저장하면 예배 흐름에 따라 자동으로 불러옵니다.
                        </p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusTone}`}>
                    {statusLabel}
                </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.18),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.62))] p-5 dark:bg-[radial-gradient(circle_at_center,_rgba(226,182,141,0.18),_transparent_54%),linear-gradient(180deg,rgba(22,33,31,0.92),rgba(22,33,31,0.70))]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">현재 박자</p>
                            <p
                                className={`mt-2 inline-block text-4xl font-serif font-black text-primary ${metronomeActive ? 'bpm-digit-pulse' : ''}`}
                                style={beatDurationStyle}
                            >
                                {currentBpm ?? '--'}
                                <span className="ml-2 text-base font-semibold text-muted-foreground">BPM</span>
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {currentSongTitle ? `${currentSongTitle}` : '곡이 선택되지 않았습니다'}
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3" style={beatDurationStyle}>
                            <div
                                className={`relative h-24 w-28 overflow-hidden rounded-[1.25rem] border ${metronomeActive ? 'border-secondary/30 bg-secondary/10 shadow-[0_0_36px_rgba(198,106,69,0.22)]' : 'border-primary/10 bg-card/70'} transition duration-150`}
                                aria-label="BPM 시각 메트로놈"
                                data-testid="bpm-metronome"
                            >
                                <div className="absolute inset-x-5 bottom-4 h-1 rounded-full bg-primary/10" />
                                <div className="absolute left-1/2 top-5 h-14 w-1 -translate-x-1/2 rounded-full bg-secondary/35" />
                                <div className={`absolute left-1/2 top-5 h-14 w-1 -translate-x-1/2 rounded-full bg-secondary ${metronomeActive ? 'bpm-metronome-arm' : 'rotate-0 opacity-40'}`}>
                                    <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-secondary shadow-[0_0_18px_rgba(198,106,69,0.45)]" />
                                </div>
                                <div className="absolute bottom-3 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-secondary" />
                                {metronomeActive ? (
                                    <div className="bpm-beat-ring absolute bottom-1 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full border border-secondary/40" />
                                ) : null}
                                <div className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${displayBlink ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]' : 'bg-primary/20'} transition duration-150`} />
                            </div>
                            <div className="flex items-center gap-2">
                                {beatDots.map((beat) => (
                                    <span
                                        key={beat}
                                        className={`h-2.5 w-2.5 rounded-full transition-all ${displayBeat === beat && displayBlink ? 'scale-125 bg-secondary' : 'bg-primary/15'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    </div>

                    <div className="rounded-3xl border border-primary/10 bg-card/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">라이브 제어</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{controlHelpText}</p>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={onToggleBpmEnabled}
                                disabled={!isActive || !canControlLocally || (!currentBpm && !bpmEnabled)}
                                className={`tap-target inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${bpmEnabled ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-primary/10 bg-background/80 text-primary hover:border-primary/20 hover:bg-card'} disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                                {bpmEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                                {bpmEnabled ? '메트로놈 끄기' : '메트로놈 켜기'}
                            </button>
                            <button
                                type="button"
                                onClick={onToggleAutoBpmSync}
                                disabled={!isActive || !canControlLocally}
                                className={`tap-target inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${autoBpmSync ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-primary/10 bg-background/80 text-primary hover:border-primary/20 hover:bg-card'} disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                                <Zap size={16} />
                                {autoBpmSync ? '자동 적용 켜짐' : '자동 적용 꺼짐'}
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[-5, -1, 1, 5].map((delta) => (
                                <button
                                    key={delta}
                                    type="button"
                                    onClick={() => onAdjustBpm(delta)}
                                    disabled={!isActive || !canControlLocally}
                                    className="tap-target rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {delta > 0 ? `+${delta}` : delta}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={onApplySongPreset}
                            disabled={!isActive || !canControlLocally || !songPresetBpm}
                            className="tap-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-surface transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <AudioLines size={16} />
                            현재 곡 BPM 적용
                        </button>
                    </div>
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
    icon: ComponentType<{ size?: number }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-primary/10 bg-card/70 p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-muted-foreground">
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{value}</p>
                </div>
            </div>
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
