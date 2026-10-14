"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionFeedbackEntry, SessionFeedbackRole } from '@/types/session';
import { getCueCategory, isCueForParticipant } from '@/types/session';
import { useSessionStore } from '@/store/sessionStore';
import { playStageCueSound } from '@/lib/stageAudioCue';
import { Check, CheckCircle2, Mic2, Music2, Radio, Timer, Volume2, Waves, X, type LucideIcon } from 'lucide-react';
import { TONE_BLOCK, TONE_ICON, type Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface SessionCueToastsProps {
    currentClientId: string | null;
    entries: SessionFeedbackEntry[];
    isActive: boolean;
    /** 'stage' = 어두운 무대 화면용 (기본값), 'light' = 흰 준비 화면용 */
    appearance?: 'stage' | 'light';
}

const MAX_VISIBLE_TOASTS = 3;
const TOAST_TTL_MS = 5500;

export default function SessionCueToasts({ currentClientId, entries, isActive, appearance = 'stage' }: SessionCueToastsProps) {
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

        // Auditory In-Ear Chime for musicians
        try {
            const cueCat = getCueCategory(toastEntries[0].message);
            playStageCueSound(cueCat);
        } catch {}

        // Context-aware tactile haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                const hasUrgentCue = toastEntries.some(
                    (e) => getCueCategory(e.message) === 'tempo' || getCueCategory(e.message) === 'sound'
                );
                if (hasUrgentCue) {
                    navigator.vibrate?.([60, 40, 60, 40, 100]);
                } else {
                    navigator.vibrate?.([40, 60, 40]);
                }
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
                const meta = getToastMeta(entry.message, entry.role);
                const Icon = meta.icon;
                const acknowledge = () => {
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        navigator.vibrate?.(20);
                    }
                    dismissToast(entry.id);
                };

                if (appearance === 'light') {
                    return (
                        <div
                            key={entry.id}
                            className="animate-toast-in relative overflow-hidden rounded-3xl border border-border bg-card px-4 py-3.5 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                        >
                            <div
                                className="animate-toast-progress absolute inset-x-0 top-0 h-0.5 origin-left bg-foreground/10"
                                style={{ '--toast-duration': `${TOAST_TTL_MS}ms` } as React.CSSProperties}
                            />
                            <div className="flex items-start gap-3">
                                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', TONE_BLOCK[meta.tone], TONE_ICON[meta.tone])}>
                                    <Icon size={18} aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-muted-foreground">
                                        {meta.categoryLabel} · {meta.roleLabel}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold leading-snug">
                                        {entry.message}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                        {[entry.songTitle ?? '전체 큐', entry.section, `${entry.page}p`]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={acknowledge}
                                        className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
                                        title="수신 확인 (ACK) 및 닫기"
                                    >
                                        <Check size={12} />
                                        <span>확인</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dismissToast(entry.id)}
                                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                        aria-label="라이브 큐 닫기"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div
                        key={entry.id}
                        className={`animate-toast-in relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-2xl transition ${meta.containerClassName}`}
                    >
                        {/* Toast Lifetime Progress Bar */}
                        <div
                            className="animate-toast-progress absolute inset-x-0 top-0 h-1 bg-current/30 origin-left"
                            style={{ '--toast-duration': `${TOAST_TTL_MS}ms` } as React.CSSProperties}
                        />

                        <div className="flex items-start gap-3 pt-0.5">
                            <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClassName}`}>
                                <span className="absolute inset-0 rounded-xl bg-current/20 animate-pulse-ring" />
                                <Icon size={18} className="relative z-10" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="rounded-md bg-current/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]">
                                                {meta.categoryLabel}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">
                                                {meta.roleLabel}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm font-black leading-snug">
                                            {entry.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={acknowledge}
                                            className="tap-target inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-black text-current hover:bg-white/25 active:scale-95 transition"
                                            title="수신 확인 (ACK) 및 닫기"
                                        >
                                            <Check size={12} />
                                            <span>확인</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => dismissToast(entry.id)}
                                            className="tap-bounce flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-current transition hover:bg-white/20 active:scale-90"
                                            aria-label="라이브 큐 닫기"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                                <p className="mt-2 truncate text-[11px] opacity-75">
                                    {[entry.songTitle ?? '전체 큐', entry.section, `${entry.page}p`]
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

type ToastMeta = {
    containerClassName: string;
    icon: LucideIcon;
    iconClassName: string;
    categoryLabel: string;
    roleLabel: string;
    /** 흰 준비 화면에서 쓰는 파스텔 분류 색 */
    tone: Tone;
};

function getToastMeta(message: string, role: SessionFeedbackRole): ToastMeta {
    const category = getCueCategory(message);

    switch (category) {
        case 'tempo':
            return {
                containerClassName: 'border-amber-400/50 bg-[#1f1609]/95 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.25)]',
                icon: Timer,
                iconClassName: 'bg-amber-400/20 text-amber-300',
                categoryLabel: '템포 / 박자',
                tone: 'sand',
                roleLabel: role === 'leader' ? '인도자' : role === 'instrument' ? '악기장' : '미디어',
            };
        case 'sound':
            return {
                containerClassName: 'border-rose-400/50 bg-[#210913]/95 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.25)]',
                icon: Volume2,
                iconClassName: 'bg-rose-400/20 text-rose-300',
                categoryLabel: '음향 / 볼륨',
                tone: 'peach',
                roleLabel: role === 'broadcast' ? '음향' : role === 'leader' ? '인도자' : '악기',
            };
        case 'system':
            return {
                containerClassName: 'border-sky-400/50 bg-[#091b26]/95 text-sky-200 shadow-[0_0_30px_rgba(56,189,248,0.25)]',
                icon: CheckCircle2,
                iconClassName: 'bg-sky-400/20 text-sky-300',
                categoryLabel: '상태 점검',
                tone: 'sky',
                roleLabel: '시스템',
            };
        case 'band':
            return {
                containerClassName: 'border-teal-400/50 bg-[#081f1b]/95 text-teal-200 shadow-[0_0_30px_rgba(45,212,191,0.25)]',
                icon: Waves,
                iconClassName: 'bg-teal-400/20 text-teal-300',
                categoryLabel: '밴드 / 편곡',
                tone: 'mint',
                roleLabel: '악기',
            };
        case 'media':
            return {
                containerClassName: 'border-violet-400/50 bg-[#160b24]/95 text-violet-200 shadow-[0_0_30px_rgba(167,139,250,0.25)]',
                icon: Radio,
                iconClassName: 'bg-violet-400/20 text-violet-300',
                categoryLabel: '방송 / 자막',
                tone: 'lilac',
                roleLabel: '미디어',
            };
        case 'flow':
        default:
            return {
                containerClassName: 'border-emerald-400/50 bg-[#091f14]/95 text-emerald-200 shadow-[0_0_30px_rgba(52,211,153,0.25)]',
                icon: role === 'leader' ? Mic2 : Music2,
                iconClassName: 'bg-emerald-400/20 text-emerald-300',
                categoryLabel: '예배 흐름',
                tone: 'mint',
                roleLabel: role === 'leader' ? '인도자' : role === 'instrument' ? '악기' : '미디어',
            };
    }
}
