"use client";

import { useEffect, useRef } from 'react';
import { getBeatIntervalMs, isUsableBpm } from '@/lib/stageTempo';

/**
 * Aligns the CSS pulse animations under the returned element to the same wall-clock beat
 * phase that useVisualMetronome uses, so ripples land on the lit beat. This is a tempo
 * guide on this device, not a shared clock between devices.
 */
export function useStageBeatPhase<T extends HTMLElement>(bpm: number | null) {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || !isUsableBpm(bpm)) return;
        const interval = getBeatIntervalMs(bpm);
        const align = () => {
            const now = Date.now();
            node.style.setProperty('--stage-beat-delay', `${-(now % interval)}ms`);
            node.style.setProperty('--stage-bar-delay', `${-(now % (interval * 4))}ms`);
        };
        align();
        const handleVisibility = () => {
            if (!document.hidden) align();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [bpm]);

    return ref;
}

export function getStageBeatDurationStyle(bpm: number | null): Record<`--${string}`, string> {
    return isUsableBpm(bpm) ? { '--stage-beat-duration': `${(60 / bpm).toFixed(3)}s` } : {};
}
