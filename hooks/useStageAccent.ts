"use client";

import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_STAGE_ACCENT, normalizeHexColor, STAGE_ACCENT_STORAGE_KEY } from '@/lib/stageAccent';

const listeners = new Set<() => void>();
// Fallback when storage is blocked, so the picker still works for this page view.
let memoryAccent: string | null = null;

function readStoredAccent(): string | null {
    try {
        return window.localStorage.getItem(STAGE_ACCENT_STORAGE_KEY);
    } catch {
        return memoryAccent;
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const handleStorage = (event: StorageEvent) => {
        if (event.key === STAGE_ACCENT_STORAGE_KEY) listener();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}

/** The stage accent is a per-device preference shared by every stage screen and tab. */
export function useStageAccent() {
    const stored = useSyncExternalStore(subscribe, readStoredAccent, () => null);
    const custom = normalizeHexColor(stored);

    const setAccent = useCallback((value: string | null) => {
        const next = value === null ? null : normalizeHexColor(value);
        if (value !== null && !next) return;
        memoryAccent = next;
        try {
            if (next) window.localStorage.setItem(STAGE_ACCENT_STORAGE_KEY, next);
            else window.localStorage.removeItem(STAGE_ACCENT_STORAGE_KEY);
        } catch {
            // Keep the in-memory value; it lasts until the page is closed.
        }
        listeners.forEach((listener) => listener());
    }, []);

    return { accent: custom ?? DEFAULT_STAGE_ACCENT, isDefault: custom === null, setAccent };
}
