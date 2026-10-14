/**
 * metronome.ts
 *
 * Pure click timing for the stage click and count-in sounds. The Web Audio player in
 * hooks/useMetronome.ts schedules from these times on AudioContext.currentTime.
 * BPM validity and beat length come from stageTempo so the audible and visual counts agree.
 */

import { COUNT_IN_BEATS, FALLBACK_COUNT_IN_BPM, getBeatIntervalMs, isUsableBpm } from './stageTempo';

export const DEFAULT_CLICK_VOLUME = 0.6;

export interface ClickEvent {
    /** AudioContext time in seconds. */
    time: number;
    /** 1-based position within the bar. */
    beat: number;
    accent: boolean;
}

/** Whole beats per bar, 1 to 12; anything else reads as the count-in default. */
function normalizeBeats(beatsPerBar: number): number {
    return Number.isFinite(beatsPerBar) ? Math.min(12, Math.max(1, Math.floor(beatsPerBar))) : COUNT_IN_BEATS;
}

/** A missing or unusable BPM counts at the same fallback as the count-in screen. */
export function clickBpm(bpm: number | null | undefined): number {
    return isUsableBpm(bpm) ? bpm : FALLBACK_COUNT_IN_BPM;
}

/** The click at `index` counted from `startTime`. Computed from the index, so the grid never drifts. */
export function clickAt(bpm: number | null | undefined, beatsPerBar: number, startTime: number, index: number): ClickEvent {
    const beats = normalizeBeats(beatsPerBar);
    const position = Math.max(0, Math.floor(index));
    const beat = (position % beats) + 1;
    return {
        time: startTime + position * (getBeatIntervalMs(clickBpm(bpm)) / 1000),
        beat,
        accent: beat === 1,
    };
}

export function clickSchedule(
    bpm: number | null | undefined,
    beatsPerBar: number,
    startTime: number,
    count: number
): ClickEvent[] {
    const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    return Array.from({ length: total }, (_, index) => clickAt(bpm, beatsPerBar, startTime, index));
}

/** A run of clicks on one grid. The player advances `index` as it queues clicks. */
export interface ClickRun {
    /** AudioContext time of click 0. */
    origin: number;
    bpm: number;
    beatsPerBar: number;
    /** Next click to queue. */
    index: number;
    /** Exclusive end; Infinity for a continuous click. */
    total: number;
}

/** Queues the clicks of `run` that fall before `horizon` and advances the run past them. */
export function takeClicksBefore(run: ClickRun, horizon: number): ClickEvent[] {
    const clicks: ClickEvent[] = [];
    while (run.index < run.total) {
        const click = clickAt(run.bpm, run.beatsPerBar, run.origin, run.index);
        if (click.time >= horizon) break;
        clicks.push(click);
        run.index += 1;
    }
    return clicks;
}

/** Clicks in a count-in of whole bars. Bars are clamped to 1 to 8. */
export function countInClickCount(beatsPerBar: number, bars = 1): number {
    const wholeBars = Number.isFinite(bars) ? Math.min(8, Math.max(1, Math.floor(bars))) : 1;
    return normalizeBeats(beatsPerBar) * wholeBars;
}

export function clampClickVolume(volume: number): number {
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_CLICK_VOLUME;
}

export function parseStoredClickVolume(raw: string | null): number {
    return raw === null ? DEFAULT_CLICK_VOLUME : clampClickVolume(Number.parseFloat(raw));
}

/** Peak gain for one click. The downbeat is louder so the start of the bar is easy to find in ear monitors. */
export function clickPeakGain(volume: number, accent: boolean): number {
    return clampClickVolume(volume) * (accent ? 0.9 : 0.45);
}
