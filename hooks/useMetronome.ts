"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
    clampClickVolume,
    clickBpm,
    clickPeakGain,
    countInClickCount,
    DEFAULT_CLICK_VOLUME,
    parseStoredClickVolume,
    takeClicksBefore,
    type ClickEvent,
    type ClickRun,
} from '@/lib/metronome';
import { getStageAudioContext } from '@/lib/stageAudioCue';
import { COUNT_IN_BEATS } from '@/lib/stageTempo';

const CLICK_VOLUME_KEY = 'wt_stage_click_volume';
const COUNT_IN_SOUND_KEY = 'wt_count_in_sound';
const PREFERENCE_KEYS = new Set([CLICK_VOLUME_KEY, COUNT_IN_SOUND_KEY]);

/** How often the scheduler runs. */
const TICK_MS = 25;
/** How far ahead clicks are queued on the AudioContext clock. */
const LOOKAHEAD_S = 0.1;
/** Leaves the first click time to be queued before it plays. */
const START_DELAY_S = 0.05;

const listeners = new Set<() => void>();
/** Used when storage is blocked, so the settings still work for this visit. */
const memoryValues = new Map<string, string>();

function readValue(key: string): string | null {
    try {
        return window.localStorage.getItem(key) ?? memoryValues.get(key) ?? null;
    } catch {
        return memoryValues.get(key) ?? null;
    }
}

function writeValue(key: string, value: string) {
    memoryValues.set(key, value);
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Kept in memory only.
    }
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== null && PREFERENCE_KEYS.has(event.key)) listener();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}

/** A per-device preference. The server render and hydration both read `fallback`; the stored value applies after. */
function usePreference<T>(key: string, parse: (raw: string | null) => T, fallback: T): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, () => parse(readValue(key)), () => fallback);
    const update = useCallback((next: T) => writeValue(key, String(next)), [key]);
    return [value, update];
}

const parseOn = (raw: string | null) => raw === 'true';

/** Whether the count-in screen plays its beats as clicks. Off until the musician turns it on. */
export function useCountInSoundSetting() {
    return usePreference(COUNT_IN_SOUND_KEY, parseOn, false);
}

interface ClickJob extends ClickRun {
    kind: 'click' | 'count';
    /** A count-in hands over to the continuous click on the same grid when it ends, if the click is still on. */
    resumeClick: boolean;
}

function scheduleBlip(ctx: AudioContext, click: ClickEvent, volume: number, sounds: Set<OscillatorNode>) {
    const peak = clickPeakGain(volume, click.accent);
    if (peak <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = click.accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, click.time);
    gain.gain.exponentialRampToValueAtTime(peak, click.time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, click.time + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    sounds.add(osc);
    osc.onended = () => {
        sounds.delete(osc);
        osc.disconnect();
        gain.disconnect();
    };
    osc.start(click.time);
    osc.stop(click.time + 0.05);
}

/**
 * Stage click and count-in. Clicks are queued a little ahead on the AudioContext clock by a short
 * interval, not one timer per beat, so the tempo does not drift. The AudioContext is created or
 * resumed only inside a tap or key press. The click always starts off, so a page turn after a reload
 * never sets it going.
 */
export function useMetronome(bpm: number, options: { beatsPerBar?: number } = {}) {
    const { beatsPerBar = COUNT_IN_BEATS } = options;
    const [volume, setStoredVolume] = usePreference(CLICK_VOLUME_KEY, parseStoredClickVolume, DEFAULT_CLICK_VOLUME);
    const [clickOn, setClickOn] = useState(false);
    const setVolume = useCallback((next: number) => setStoredVolume(clampClickVolume(next)), [setStoredVolume]);

    const [beat, setBeat] = useState(0);
    const [countingIn, setCountingIn] = useState(false);

    const ctxRef = useRef<AudioContext | null>(null);
    const jobRef = useRef<ClickJob | null>(null);
    const queueRef = useRef<ClickEvent[]>([]);
    const timerRef = useRef<number | null>(null);
    const soundsRef = useRef(new Set<OscillatorNode>());
    const volumeRef = useRef(volume);
    const clickOnRef = useRef(clickOn);
    const countingRef = useRef(false);

    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    useEffect(() => {
        clickOnRef.current = clickOn;
    }, [clickOn]);

    const stopTimer = useCallback(() => {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const cancelSounds = useCallback(() => {
        const sounds = Array.from(soundsRef.current);
        soundsRef.current.clear();
        sounds.forEach((osc) => {
            try {
                osc.stop();
            } catch {
                // Already ended.
            }
        });
    }, []);

    // Queues clicks inside the lookahead window and flushes the beat display as each one sounds.
    const tick = useCallback(() => {
        const ctx = ctxRef.current;
        const job = jobRef.current;
        if (ctx && job) {
            for (const click of takeClicksBefore(job, ctx.currentTime + LOOKAHEAD_S)) {
                try {
                    scheduleBlip(ctx, click, volumeRef.current, soundsRef.current);
                } catch {
                    // A failed click must not stop the visual count.
                }
                queueRef.current.push(click);
            }
            if (job.index >= job.total) {
                jobRef.current = job.resumeClick && clickOnRef.current
                    ? { kind: 'click', origin: job.origin, bpm: job.bpm, beatsPerBar: job.beatsPerBar, index: job.total, total: Infinity, resumeClick: false }
                    : null;
            }
        }

        const counting = jobRef.current?.kind === 'count';
        if (counting !== countingRef.current) {
            countingRef.current = counting;
            setCountingIn(counting);
        }

        const now = ctx ? ctx.currentTime : Infinity;
        const queue = queueRef.current;
        let shown: number | null = null;
        for (let next = queue[0]; next && next.time <= now; next = queue[0]) {
            queue.shift();
            shown = next.beat;
        }
        if (shown !== null) setBeat(shown);
        if (!jobRef.current && queue.length === 0) {
            stopTimer();
            setBeat(0);
        }
    }, [stopTimer]);

    const startTimer = useCallback(() => {
        if (timerRef.current === null) timerRef.current = window.setInterval(tick, TICK_MS);
    }, [tick]);

    const cancelAll = useCallback(() => {
        jobRef.current = null;
        queueRef.current = [];
        cancelSounds();
        stopTimer();
        countingRef.current = false;
        setCountingIn(false);
        setBeat(0);
    }, [cancelSounds, stopTimer]);

    // Continuous click. Restarts on every BPM or meter change; toggleClick has unlocked the context in its tap.
    useEffect(() => {
        const ctx = ctxRef.current;
        if (!clickOn || !ctx) return undefined;
        // A count-in that started on this same tap owns the grid; it resumes the click when it ends.
        if (jobRef.current?.kind === 'count') return undefined;
        cancelSounds();
        jobRef.current = {
            kind: 'click',
            origin: ctx.currentTime + START_DELAY_S,
            bpm: clickBpm(bpm),
            beatsPerBar,
            index: 0,
            total: Infinity,
            resumeClick: false,
        };
        startTimer();
        return () => {
            if (jobRef.current?.kind === 'click') jobRef.current = null;
        };
    }, [clickOn, bpm, beatsPerBar, cancelSounds, startTimer]);

    /** Plays `bars` bars of clicks at the current BPM, then stops. A continuous click that is on carries on afterwards. */
    const countIn = useCallback((bars = 1) => {
        const ctx = getStageAudioContext();
        if (!ctx) return;
        ctxRef.current = ctx;
        cancelSounds();
        queueRef.current = [];
        jobRef.current = {
            kind: 'count',
            origin: ctx.currentTime + START_DELAY_S,
            bpm: clickBpm(bpm),
            beatsPerBar,
            index: 0,
            total: countInClickCount(beatsPerBar, bars),
            resumeClick: clickOnRef.current,
        };
        startTimer();
    }, [bpm, beatsPerBar, cancelSounds, startTimer]);

    /** One click now, for a screen that drives its own beats (the count-in visuals). */
    const playBeat = useCallback((accent: boolean) => {
        const ctx = getStageAudioContext();
        if (!ctx) return;
        try {
            scheduleBlip(ctx, { time: ctx.currentTime, beat: accent ? 1 : 2, accent }, volumeRef.current, soundsRef.current);
        } catch {
            // Audio failure must not break the count-in.
        }
    }, []);

    const toggleClick = useCallback(() => {
        if (clickOn) {
            cancelAll();
            setClickOn(false);
            return;
        }
        // Created inside the tap, so iOS and Safari allow the sound.
        const ctx = getStageAudioContext();
        if (!ctx) return;
        ctxRef.current = ctx;
        setClickOn(true);
    }, [clickOn, cancelAll, setClickOn]);

    // Stop the scheduler and any queued clicks when the screen unmounts.
    useEffect(() => cancelAll, [cancelAll]);

    return { beat, countingIn, clickOn, toggleClick, countIn, playBeat, volume, setVolume };
}
