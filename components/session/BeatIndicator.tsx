"use client";

import type { ReactNode } from 'react';
import { useVisualMetronome } from '@/components/session/SessionBpmConsole';

interface BeatIndicatorProps {
    bpm: number | null;
    enabled: boolean;
    /** Receives the lit beat (1–4, 0 when off) and whether the short blink is on. */
    children: (activeBeat: number, blinkActive: boolean) => ReactNode;
}

/**
 * Runs the visual metronome in a small leaf so only the beat markup re-renders on each tick
 * (twice per beat), not the stage tree around it. The metronome keeps wall-clock phase, so
 * several indicators on one screen light the same beat at the same time.
 */
export default function BeatIndicator({ bpm, enabled, children }: BeatIndicatorProps) {
    const { activeBeat, blinkActive } = useVisualMetronome(enabled, bpm);
    return <>{children(activeBeat, blinkActive)}</>;
}
