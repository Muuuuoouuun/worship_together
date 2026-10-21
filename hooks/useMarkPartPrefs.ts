'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { parsePart, parsePartSelection, serializePartSelection, type SheetPart } from '@/lib/markParts';

/**
 * A device preference kept in localStorage as a string, read through useSyncExternalStore like the pedal mode
 * in useSongFormStepper: the server render and hydration see `fallback`, the stored choice applies right after,
 * and every component using it (and other tabs) follows a change.
 */
function createStringPref(storageKey: string, fallback: string) {
    const listeners = new Set<() => void>();
    /** Used when storage is blocked, so the choice still works for this visit. */
    let memory: string | null = null;

    const read = (): string => {
        try {
            const stored = window.localStorage.getItem(storageKey);
            if (stored !== null) return stored;
        } catch {
            // Private mode or blocked storage.
        }
        return memory ?? fallback;
    };
    const subscribe = (onChange: () => void) => {
        listeners.add(onChange);
        const onStorage = (event: StorageEvent) => {
            if (event.key === storageKey) onChange();
        };
        window.addEventListener('storage', onStorage);
        return () => {
            listeners.delete(onChange);
            window.removeEventListener('storage', onStorage);
        };
    };
    const write = (value: string) => {
        memory = value;
        try {
            window.localStorage.setItem(storageKey, value);
        } catch {
            // Kept in memory only.
        }
        listeners.forEach((listener) => listener());
    };
    const getServerSnapshot = () => fallback;

    return { read, subscribe, write, getServerSnapshot };
}

const viewPartsPref = createStringPref('wt_mark_view_parts', 'all');
const myPartPref = createStringPref('wt_my_part', 'all');
const overlayPref = createStringPref('wt_overlay_personal', 'off');

/** Workspace 보기 filter: which parts' marks show besides the ones for everyone (null = all parts). */
export function useMarkViewParts() {
    const raw = useSyncExternalStore(viewPartsPref.subscribe, viewPartsPref.read, viewPartsPref.getServerSnapshot);
    const visible = useMemo(() => parsePartSelection(raw), [raw]);
    return { visible, setVisible: (selection: ReadonlySet<SheetPart> | null) => viewPartsPref.write(serializePartSelection(selection)) };
}

/** Stage viewer 내 파트: this device shows its own part's marks and the ones for everyone (null = all parts). */
export function useMyPart() {
    const raw = useSyncExternalStore(myPartPref.subscribe, myPartPref.read, myPartPref.getServerSnapshot);
    const part = parsePart(raw);
    // One stable set per part, so the filtered marks keep their identity between renders.
    const visible = useMemo(() => (part ? new Set<SheetPart>([part]) : null), [part]);
    return { part, visible, setPart: (next: SheetPart | null) => myPartPref.write(next ?? 'all') };
}

/** Stage viewer 내 필기 겹치기: draw the personal draft over the team copy. */
export function useOverlayPersonal() {
    const raw = useSyncExternalStore(overlayPref.subscribe, overlayPref.read, overlayPref.getServerSnapshot);
    return { on: raw === 'on', setOn: (on: boolean) => overlayPref.write(on ? 'on' : 'off') };
}
