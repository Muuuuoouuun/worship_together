"use client";

import type { ComponentType } from 'react';
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
    const { activeBeat, blinkActive } = useBlinkMetronome(bpmEnabled && isActive, currentBpm);
    const statusLabel = bpmEnabled && currentBpm
        ? 'BPM 블링크 켜짐'
        : bpmEnabled
            ? 'BPM 프리셋 대기'
            : 'BPM 블링크 꺼짐';
    const statusTone = bpmEnabled && currentBpm
        ? 'bg-emerald-500/10 text-emerald-700'
        : bpmEnabled
            ? 'bg-amber-500/10 text-amber-700'
            : 'bg-primary/5 text-primary/50';
    const controlHelpText = !canControlLocally
        ? '현재 인도자가 공유 BPM 콘솔을 제어 중입니다.'
        : autoBpmSync
            ? '곡이 바뀌면 저장된 BPM 프리셋을 자동으로 불러옵니다.'
            : '자동 적용이 꺼져 있습니다. 수동으로 미세 조정할 수 있습니다.';
    const displayBeat = bpmEnabled && isActive && currentBpm ? activeBeat : 0;
    const displayBlink = bpmEnabled && isActive && currentBpm ? blinkActive : false;
    const beatDots = useMemo(() => Array.from({ length: 4 }, (_, index) => index + 1), []);

    return (
        <GlassCard className="border-primary/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${displayBlink ? 'bg-secondary/20 text-secondary' : 'bg-secondary/10 text-secondary'}`}>
                        <AudioLines size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">드럼 BPM</p>
                        <p className="mt-2 text-sm leading-relaxed text-primary/55">
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
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/35">현재 박자</p>
                            <p className="mt-2 text-4xl font-serif font-black text-primary">
                                {currentBpm ?? '--'}
                                <span className="ml-2 text-base font-semibold text-primary/40">BPM</span>
                            </p>
                            <p className="mt-2 text-sm text-primary/50">
                                {currentSongTitle ? `${currentSongTitle}` : '곡이 선택되지 않았습니다'}
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className={`relative flex h-20 w-20 items-center justify-center rounded-full border ${displayBlink ? 'border-secondary/40 bg-secondary/25 shadow-[0_0_40px_rgba(212,175,55,0.35)]' : 'border-primary/10 bg-card/70'} transition-all duration-150`}>
                                <div className={`h-8 w-8 rounded-full ${displayBlink ? 'bg-secondary' : 'bg-primary/15'} transition-all duration-150`} />
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
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/35">라이브 제어</p>
                        <p className="mt-2 text-sm leading-relaxed text-primary/50">{controlHelpText}</p>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={onToggleBpmEnabled}
                                disabled={!canControlLocally || (!currentBpm && !bpmEnabled)}
                                className={`tap-target inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${bpmEnabled ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-primary/10 bg-background/80 text-primary hover:border-primary/20 hover:bg-card'} disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                                {bpmEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                                {bpmEnabled ? '블링크 끄기' : '블링크 켜기'}
                            </button>
                            <button
                                type="button"
                                onClick={onToggleAutoBpmSync}
                                disabled={!canControlLocally}
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
                                    disabled={!canControlLocally}
                                    className="tap-target rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {delta > 0 ? `+${delta}` : delta}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={onApplySongPreset}
                            disabled={!canControlLocally || !songPresetBpm}
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary/60">
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{value}</p>
                </div>
            </div>
        </div>
    );
}

function useBlinkMetronome(enabled: boolean, bpm: number | null) {
    const [blinkActive, setBlinkActive] = useState(false);
    const [activeBeat, setActiveBeat] = useState(0);

    useEffect(() => {
        if (!enabled || !bpm) {
            return;
        }

        const intervalMs = Math.max(240, Math.floor(60000 / bpm));
        const pulseMs = Math.min(180, Math.floor(intervalMs * 0.5));
        let beat = 0;
        let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

        const triggerBeat = () => {
            beat = (beat % 4) + 1;
            setActiveBeat(beat);
            setBlinkActive(true);

            if (pulseTimeout) {
                clearTimeout(pulseTimeout);
            }

            pulseTimeout = setTimeout(() => {
                setBlinkActive(false);
            }, pulseMs);
        };

        triggerBeat();
        const interval = setInterval(triggerBeat, intervalMs);

        return () => {
            clearInterval(interval);

            if (pulseTimeout) {
                clearTimeout(pulseTimeout);
            }
        };
    }, [enabled, bpm]);

    return { activeBeat, blinkActive };
}
