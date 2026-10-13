"use client";

import { useEffect, useEffectEvent, useState, type CSSProperties } from 'react';
import { Radio, SkipForward, X } from 'lucide-react';
import { getStageBeatDurationStyle } from '@/hooks/useStageBeatPhase';
import {
    COUNT_IN_BEATS,
    FALLBACK_COUNT_IN_BPM,
    getBeatIntervalMs,
    getCountInWord,
    isUsableBpm,
} from '@/lib/stageTempo';

interface WorshipCountInProps {
    setlistTitle: string;
    songTitle: string | null;
    songKey: string | null;
    bpm: number | null;
    /** Delivery status of the start cue; null when no cue was sent. */
    signalLabel: string | null;
    onCancel: () => void;
    onComplete: () => void;
}

const RING_RADIUS = 140;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SEGMENT = RING_CIRCUMFERENCE / COUNT_IN_BEATS;
const SEGMENT_GAP = 16;

function vibrateBeat(beat: number) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(beat === 1 ? 45 : 20);
    }
}

export default function WorshipCountIn({
    setlistTitle,
    songTitle,
    songKey,
    bpm,
    signalLabel,
    onCancel,
    onComplete,
}: WorshipCountInProps) {
    const hasBpm = isUsableBpm(bpm);
    const countBpm = hasBpm ? bpm : FALLBACK_COUNT_IN_BPM;
    const [beat, setBeat] = useState(1);
    const finish = useEffectEvent(onComplete);

    // The count starts when this screen opens (the tap), not on the shared wall-clock grid.
    useEffect(() => {
        let current = 1;
        vibrateBeat(current);
        const timer = window.setInterval(() => {
            current += 1;
            if (current > COUNT_IN_BEATS) {
                window.clearInterval(timer);
                finish();
                return;
            }
            setBeat(current);
            vibrateBeat(current);
        }, getBeatIntervalMs(countBpm));
        return () => window.clearInterval(timer);
    }, [countBpm]);

    const word = getCountInWord(beat);

    return (
        <div
            className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
            style={getStageBeatDurationStyle(countBpm) as CSSProperties}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-20 top-14 h-[32rem] w-[calc(100%+10rem)] transition-opacity duration-150"
                style={{ background: `radial-gradient(circle at 50% 45%, rgb(var(--stage-accent-rgb) / ${beat === 1 ? 0.24 : 0.14}) 0%, transparent 60%)` }}
            />

            <header className="relative flex h-12 items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="카운트인 취소"
                    className="tap-target inline-flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#FFF7E8] transition hover:bg-white/10"
                >
                    <X size={20} aria-hidden="true" />
                </button>
                <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                    <h1 className="text-[17px] font-semibold tracking-[-0.02em]">카운트인</h1>
                    <p className="max-w-[14rem] truncate text-xs text-white/70">{setlistTitle}</p>
                </div>
                <div aria-hidden="true" className="size-11" />
            </header>

            <p className="relative mt-3.5 truncate text-center text-xs font-semibold tracking-[0.08em] text-(--stage-accent)">
                시작 곡 · {songTitle ?? '곡 대기'}
            </p>

            <div className="relative mx-auto mt-5 aspect-square w-full max-w-[18.75rem] shrink-0">
                <div aria-hidden="true" className="stage-pulse-ripple absolute inset-0 rounded-full border-2 border-(--stage-accent)" />
                <svg aria-hidden="true" viewBox="0 0 300 300" className="absolute inset-0 size-full overflow-visible">
                    <g transform="rotate(-90 150 150)">
                        {Array.from({ length: COUNT_IN_BEATS }, (_, index) => {
                            const lit = index < beat;
                            return (
                                <circle
                                    key={index}
                                    cx={150}
                                    cy={150}
                                    r={RING_RADIUS}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeWidth={index === beat - 1 ? 8 : 5}
                                    strokeDasharray={`${(SEGMENT - SEGMENT_GAP).toFixed(2)} ${(RING_CIRCUMFERENCE - SEGMENT + SEGMENT_GAP).toFixed(2)}`}
                                    strokeDashoffset={(-(index * SEGMENT + SEGMENT_GAP / 2)).toFixed(2)}
                                    style={{ stroke: lit ? 'var(--stage-accent)' : 'rgba(255,247,232,0.12)', transition: 'stroke 120ms ease, stroke-width 120ms ease' }}
                                />
                            );
                        })}
                    </g>
                    <circle cx={150} cy={150} r={112} fill="none" strokeWidth={1} style={{ stroke: 'rgb(var(--stage-accent-rgb) / 0.24)' }} />
                </svg>
                <div
                    role="status"
                    aria-live="assertive"
                    className="stage-pulse-disc absolute inset-[20%] flex flex-col items-center justify-center gap-0.5 rounded-full border-[1.5px] border-(--stage-accent)/35"
                    style={{ background: 'radial-gradient(circle at 50% 40%, rgb(var(--stage-accent-rgb) / 0.18) 0%, rgba(7,13,12,0.6) 72%)' }}
                >
                    <span className="sr-only">카운트 {word}</span>
                    <span
                        key={beat}
                        aria-hidden="true"
                        className={`stage-count-pop text-[6.5rem] font-extralight leading-none tracking-[-0.04em] tabular-nums ${beat === 1 ? 'text-(--stage-accent)' : 'text-[#FFF7E8]'}`}
                    >
                        {beat}
                    </span>
                    <span aria-hidden="true" className="text-base font-medium text-white/75">{word}</span>
                </div>
            </div>

            <p className="relative mt-4 text-center text-[13px] tabular-nums text-white/70">
                {hasBpm
                    ? `${songKey ? `${songKey} · ` : ''}${countBpm} BPM · ${COUNT_IN_BEATS}/4`
                    : `BPM 미설정 · ${FALLBACK_COUNT_IN_BPM} BPM으로 셉니다`}
            </p>

            <ol aria-hidden="true" className="relative mt-4 flex justify-center gap-3.5">
                {Array.from({ length: COUNT_IN_BEATS }, (_, index) => {
                    const n = index + 1;
                    const current = n === beat;
                    const passed = n < beat;
                    return (
                        <li
                            key={n}
                            className={`flex size-12 items-center justify-center rounded-full border-[1.5px] text-base font-semibold tabular-nums transition ${current ? 'border-(--stage-accent) bg-(--stage-accent) text-(--stage-accent-ink)' : passed ? 'border-(--stage-accent) text-(--stage-accent)' : 'border-white/16 text-white/60'}`}
                        >
                            {n}
                        </li>
                    );
                })}
            </ol>

            <div className="relative mt-5 flex items-center gap-3 rounded-[1.125rem] border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--stage-accent)/18">
                    <Radio size={18} aria-hidden="true" className="text-(--stage-accent)" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                        {signalLabel ? '팀 화면에 시작 신호를 보냈어요' : '이 기기에서만 카운트해요'}
                    </span>
                    <span className="truncate text-xs text-white/70">
                        {signalLabel ?? '시작 신호를 보내지 않았어요'}
                    </span>
                </div>
            </div>

            <div className="relative mt-auto grid grid-cols-[1fr_2fr] gap-2.5 pt-5">
                <button
                    type="button"
                    onClick={onCancel}
                    className="min-h-14 rounded-full border border-white/18 bg-white/[0.04] text-[15px] font-semibold text-[#FFF7E8] transition hover:bg-white/[0.08]"
                >
                    취소
                </button>
                <button
                    type="button"
                    onClick={onComplete}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-(--stage-accent) text-base font-bold text-(--stage-accent-ink) shadow-[0_12px_32px_rgb(var(--stage-accent-rgb)/0.35)] transition active:scale-[0.98]"
                >
                    바로 시작
                    <SkipForward size={18} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
