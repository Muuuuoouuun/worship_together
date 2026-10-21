'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { SheetMark } from '@/lib/sheetAnnotations';
import { songFormRoute, type SongFormStop } from '@/lib/songFormRoute';

const STORAGE_KEY = 'wt_pedal_mode';
const listeners = new Set<() => void>();
/** Used when storage is blocked, so the toggle still works for this visit. */
let memoryMode: boolean | null = null;

function readSectionMode(): boolean {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return stored === 'section';
    } catch {
        // Private mode or blocked storage.
    }
    return memoryMode ?? false;
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onStorage);
    };
}

/** Pedal mode is a device preference shared by the annotation workspace and the stage viewer. */
export function setPedalSectionMode(on: boolean) {
    memoryMode = on;
    try {
        window.localStorage.setItem(STORAGE_KEY, on ? 'section' : 'page');
    } catch {
        // Kept in memory only.
    }
    listeners.forEach((listener) => listener());
}

type Options = {
    pages: ReadonlyArray<{ marks: readonly SheetMark[] }> | undefined;
    /** 1-based page on screen. */
    page: number;
    canTurnPage: boolean;
    onPageChange: (page: number) => void;
    /** The walk starts over when this changes (another song). */
    resetKey: string;
};

/**
 * Pedal "섹션 이동": next/previous walk the song form band instead of pages, turning to the page where
 * each section's marker sits. `step` returns null when it does not apply (mode off, no band, no page
 * control, or past either end) so the caller falls back to turning pages.
 */
export function useSongFormStepper({ pages, page, canTurnPage, onPageChange, resetKey }: Options) {
    // Server render and hydration both read "page mode"; the stored choice applies right after.
    const sectionMode = useSyncExternalStore(subscribe, readSectionMode, () => false);
    const [position, setPosition] = useState<{ key: string; index: number } | null>(null);
    const route = useMemo(() => (pages ? songFormRoute(pages) : null), [pages]);
    const stops = route?.stops ?? [];
    const index = position && position.key === resetKey && position.index < stops.length ? position.index : null;
    const active = sectionMode && canTurnPage && stops.length > 0;

    function step(direction: 1 | -1): SongFormStop | null {
        if (!active) return null;
        const next = index === null ? (direction > 0 ? 0 : -1) : index + direction;
        if (next < 0 || next >= stops.length) return null;
        setPosition({ key: resetKey, index: next });
        const stop = stops[next];
        if (stop.page !== null && stop.page !== page) onPageChange(stop.page);
        return stop;
    }

    return {
        /** The sheet has a song form band to walk. */
        available: stops.length > 0,
        sectionMode,
        setSectionMode: setPedalSectionMode,
        active,
        route,
        index,
        stop: index === null ? null : stops[index],
        total: stops.length,
        step,
    };
}
