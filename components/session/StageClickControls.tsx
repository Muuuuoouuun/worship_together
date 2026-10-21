"use client";

import { Volume2 } from 'lucide-react';
import { useMetronome } from '@/hooks/useMetronome';
import { getCountInWord } from '@/lib/stageTempo';

interface StageClickControlsProps {
    /** The viewer's current tempo; the count-in and the click both follow it. */
    bpm: number;
}

/** 카운트인 (one bar at the current tempo) and 클릭 (continuous click), with a per-device volume. */
export default function StageClickControls({ bpm }: StageClickControlsProps) {
    const { beat, countingIn, clickOn, toggleClick, countIn, volume, setVolume } = useMetronome(bpm);

    return (
        <div className="flex flex-wrap items-center gap-1">
            <button
                type="button"
                onClick={() => countIn(1)}
                aria-label="1마디 카운트인"
                title="1마디 카운트인 (현재 BPM)"
                className={`tap-target inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] font-black transition active:scale-95 ${
                    countingIn
                        ? 'border-amber-300/60 bg-amber-400/25 text-amber-100'
                        : 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                }`}
            >
                {countingIn && beat ? getCountInWord(beat) : '카운트인'}
            </button>
            <button
                type="button"
                onClick={toggleClick}
                aria-pressed={clickOn}
                aria-label="클릭 소리 켜기/끄기"
                title={clickOn ? '클릭 소리 켜짐 (클릭 시 끔)' : '클릭 소리 꺼짐 (클릭 시 켬)'}
                className={`tap-target inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black transition active:scale-95 ${
                    clickOn
                        ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-white/50 hover:bg-white/10'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full transition-colors duration-75 ${
                        clickOn && beat === 1 ? 'bg-amber-300' : clickOn && beat ? 'bg-emerald-300' : 'bg-white/20'
                    }`}
                />
                클릭
            </button>
            <label className="inline-flex items-center gap-1 pl-0.5 text-white/60">
                <Volume2 size={12} aria-hidden="true" />
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    aria-label="클릭 음량"
                    className="h-1 w-14 accent-amber-400"
                />
            </label>
        </div>
    );
}
