"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionFeedbackEntry, SessionFeedbackRole } from '@/types/session';
import { isCueForParticipant } from '@/types/session';
import { useSessionStore } from '@/store/sessionStore';
import { Mic2, Radio, Waves, X } from 'lucide-react';

interface SessionCueToastsProps {
    currentClientId: string | null;
    entries: SessionFeedbackEntry[];
    isActive: boolean;
}

const MAX_VISIBLE_TOASTS = 3;
const TOAST_TTL_MS = 5200;

export default function SessionCueToasts({ currentClientId, entries, isActive }: SessionCueToastsProps) {
    const selectedFeedbackRole = useSessionStore((state) => state.selectedFeedbackRole);
    const [mountedAt] = useState(() => Date.now());
    const [visibleToasts, setVisibleToasts] = useState<SessionFeedbackEntry[]>([]);
    const knownEntryIdsRef = useRef<Set<string> | null>(null);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((entryId: string) => {
        const timer = timersRef.current.get(entryId);

        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(entryId);
        }

        setVisibleToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== entryId));
    }, []);

    useEffect(() => {
        if (knownEntryIdsRef.current === null) {
            knownEntryIdsRef.current = new Set(entries.map((entry) => entry.id));
            return;
        }

        const knownEntryIds = knownEntryIdsRef.current;
        const incomingEntries = entries.filter((entry) => !knownEntryIds.has(entry.id));
        const toastEntries = incomingEntries.filter(
            (entry) => (!currentClientId || entry.clientId !== currentClientId) &&
                Boolean(entry.receivedAt && Date.parse(entry.receivedAt) >= mountedAt) &&
                isCueForParticipant(entry, currentClientId ?? '', selectedFeedbackRole)
        );

        incomingEntries.forEach((entry) => knownEntryIds.add(entry.id));
        if (knownEntryIds.size > 200) knownEntryIdsRef.current = new Set(entries.map((entry) => entry.id));

        if (!isActive || toastEntries.length === 0) {
            return;
        }

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate?.([40, 60, 40]);
            } catch {
                // Ignore vibration errors on non-supporting devices
            }
        }

        setVisibleToasts((currentToasts) => [
            ...toastEntries.slice(-MAX_VISIBLE_TOASTS).reverse(),
            ...currentToasts,
        ].slice(0, MAX_VISIBLE_TOASTS));

        toastEntries.forEach((entry) => {
            const existingTimer = timersRef.current.get(entry.id);

            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                dismissToast(entry.id);
            }, TOAST_TTL_MS);

            timersRef.current.set(entry.id, timer);
        });
    }, [currentClientId, dismissToast, entries, isActive, selectedFeedbackRole, mountedAt]);

    useEffect(() => {
        const timers = timersRef.current;

        return () => {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, []);

    if (!isActive || visibleToasts.length === 0) {
        return null;
    }

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed left-1/2 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col gap-3 sm:left-auto sm:right-6 sm:top-6 sm:w-96 sm:translate-x-0"
        >
            {visibleToasts.map((entry) => {
                const meta = getToastRoleMeta(entry.role);
                const Icon = meta.icon;

                return (
                    <div
                        key={entry.id}
                        className={`animate-toast-in relative overflow-hidden rounded-xl border px-4 py-4 shadow-2xl backdrop-blur-xl transition ${meta.containerClassName}`}
                    >
                        {/* Toast Lifetime Progress Bar */}
                        <div
                            className="animate-toast-progress absolute inset-x-0 top-0 h-1 bg-current/25 origin-left"
                            style={{ '--toast-duration': `${TOAST_TTL_MS}ms` } as React.CSSProperties}
                        />

                        <div className="flex items-start gap-3 pt-0.5">
                            <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.iconClassName}`}>
                                <span className="absolute inset-0 rounded-lg bg-current/20 animate-pulse-ring" />
                                <Icon size={17} className="relative z-10" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">
                                            Live cue | {meta.label}
                                        </p>
                                        <p className="mt-1.5 text-sm font-semibold leading-relaxed">
                                            {entry.message}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => dismissToast(entry.id)}
                                        className="tap-bounce flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card/70 text-muted-foreground transition hover:bg-card hover:text-primary active:scale-90"
                                        aria-label="라이브 큐 닫기"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <p className="mt-2.5 truncate text-xs opacity-75">
                                    {[entry.songTitle ?? 'General cue', entry.section, `Page ${entry.page}`]
                                        .filter(Boolean)
                                        .join(' | ')}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function getToastRoleMeta(role: SessionFeedbackRole) {
    switch (role) {
        case 'instrument':
            return {
                containerClassName: 'border-primary/15 bg-card/95 text-primary',
                icon: Waves,
                iconClassName: 'bg-primary/8 text-primary',
                label: 'Band',
            };
        case 'broadcast':
            return {
                containerClassName: 'border-emerald-500/25 bg-emerald-50/95 text-emerald-800',
                icon: Radio,
                iconClassName: 'bg-emerald-500/12 text-emerald-700',
                label: 'Broadcast',
            };
        case 'leader':
        default:
            return {
                containerClassName: 'border-secondary bg-card text-foreground',
                icon: Mic2,
                iconClassName: 'bg-secondary/15 text-secondary',
                label: 'Leader',
            };
    }
}
