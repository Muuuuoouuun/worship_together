'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { mergeChartPages } from '@/lib/chordChartSheet';
import { renderChordChartPages } from '@/lib/chordChartRender';
import type { EngravedPage } from '@/lib/leadSheetRender';
import type { SheetDocument } from '@/lib/sheetAnnotations';
import type { LeadSheetKey } from '@/lib/leadSheet';

const STORAGE_KEY = 'wt_chart_lyrics_only';
const listeners = new Set<() => void>();
/** Used when storage is blocked, so the toggle still works for this visit. */
let memoryValue: boolean | null = null;

function readLyricsOnly(): boolean {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return stored === 'on';
    } catch {
        // Private mode or blocked storage.
    }
    return memoryValue ?? false;
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

/** 가사만 is a device preference: a singer's tablet can stay lyrics-only while the band sees chords. */
export function setChartLyricsOnly(on: boolean) {
    memoryValue = on;
    try {
        window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // Kept in memory only.
    }
    listeners.forEach((listener) => listener());
}

/** Drawn lyrics-only pages by chart text, title and key; a few songs deep so toggling back is instant. */
const CACHE_LIMIT = 4;
const cache = new Map<string, EngravedPage[]>();
const inflight = new Map<string, Promise<EngravedPage[]>>();

function renderLyricsOnly(cacheKey: string, source: string, key: LeadSheetKey, title: string): Promise<EngravedPage[]> {
    const cached = cache.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    let pending = inflight.get(cacheKey);
    if (!pending) {
        // Lyrics pages carry no chords, so only the key shown in the header matters.
        pending = renderChordChartPages({ source, key, originalKey: key, capo: 0, mode: 'lyrics', chordsAs: 'concert' }, title)
            .then((pages) => {
                cache.set(cacheKey, pages);
                if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
                return pages;
            })
            .finally(() => inflight.delete(cacheKey));
        inflight.set(cacheKey, pending);
    }
    return pending;
}

/**
 * Per-device "가사만" view of a chord chart on stage: re-draws the chart pages as bigger lyrics without
 * chords, locally and without saving. `pages` is what to show (the sheet's own pages unless lyrics-only is on
 * and drawn). Lyrics pages are laid out differently, so they carry no marks, and the page count can differ.
 */
export function useChartLyricsOnly(sheet: SheetDocument | null) {
    // Server render and hydration both read "off"; the stored choice applies right after.
    const preferred = useSyncExternalStore(subscribe, readLyricsOnly, () => false);
    const chart = sheet?.chart;
    const source = chart?.source;
    const key = chart?.key;
    const title = sheet?.title ?? '';
    // A chart saved as lyrics-only has nothing more to hide.
    const available = chart?.mode === 'chords';
    const wanted = preferred && available && source !== undefined ? `${title}\n${key}\n${source}` : null;
    const [done, setDone] = useState<{ key: string; pages: EngravedPage[] } | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const ready = wanted ? (cache.get(wanted) ?? (done?.key === wanted ? done.pages : null)) : null;

    useEffect(() => {
        if (!wanted || source === undefined || !key || cache.has(wanted)) return;
        let active = true;
        renderLyricsOnly(wanted, source, key, title).then(
            (pages) => {
                if (active) setDone({ key: wanted, pages });
            },
            () => {
                if (active) setFailed(wanted);
            }
        );
        return () => {
            active = false;
        };
    }, [wanted, source, key, title]);

    const pages = useMemo(() => (sheet && ready ? mergeChartPages(sheet.pages, ready, false) : sheet?.pages), [sheet, ready]);
    return {
        pages,
        /** The sheet has a chord chart with chords to hide. */
        available,
        /** Lyrics-only pages are showing. */
        lyricsOnly: Boolean(ready),
        loading: Boolean(wanted && !ready && failed !== wanted),
        failed: Boolean(wanted && failed === wanted),
        preferred,
        setLyricsOnly: setChartLyricsOnly,
    };
}
