'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { LiveToast } from './model';

/* 예배 중 화면이 함께 쓰는 작은 훅들 — 바깥 누르면 닫기 · 화면 크기 · 기기 동작 · 알림 자동 닫기 */

/** 열린 동안 바깥을 누르거나 Esc 를 누르면 닫습니다 (어떻게 닫혔는지 함께 알려 줍니다 — Esc 일 때만 포커스를 돌려주려고) */
export function useOutsideClose<T extends HTMLElement = HTMLDivElement>(active: boolean, onClose: (reason: 'outside' | 'escape') => void) {
    const ref = useRef<T | null>(null);
    const close = useRef(onClose);
    useEffect(() => {
        close.current = onClose;
    });
    useEffect(() => {
        if (!active) return;
        const onDown = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) close.current('outside');
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close.current('escape');
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [active]);
    return ref;
}

/* ───────────── 화면 크기: lg(1024px) 이상이면 데스크톱 배치 ───────────── */

const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribeDesktop(onChange: () => void) {
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

/** 데스크톱 배치인지. 서버 · 하이드레이션 첫 그림에서는 모르므로 null */
export function useIsDesktop(): boolean | null {
    return useSyncExternalStore(
        subscribeDesktop,
        () => window.matchMedia(DESKTOP_QUERY).matches,
        () => null,
    );
}

/* ───────────── 기기 동작: 화면 꺼짐 방지 · 전체화면 · 화면 잠금 ───────────── */

function noopSubscribe() {
    return () => undefined;
}

export interface DeviceToggles {
    /** 이 브라우저가 화면 꺼짐 방지를 지원하는지 (지원하지 않으면 스위치를 숨김) */
    wakeSupported: boolean;
    fullscreenSupported: boolean;
    awake: boolean;
    fullscreen: boolean;
    locked: boolean;
    toggleAwake: () => void;
    toggleFullscreen: () => void;
    setLocked: (locked: boolean) => void;
}

/** @param active false 면(예배를 마치면) 화면 꺼짐 방지를 놓아 줍니다 */
export function useDeviceToggles(active = true): DeviceToggles {
    const wakeSupported = useSyncExternalStore(noopSubscribe, () => 'wakeLock' in navigator, () => false);
    const fullscreenSupported = useSyncExternalStore(noopSubscribe, () => Boolean(document.fullscreenEnabled), () => false);
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [locked, setLocked] = useState(false);
    const sentinel = useRef<WakeLockSentinel | null>(null);

    // 켜 둔 동안 화면 꺼짐 방지를 잡아 둡니다. 다른 앱에 다녀오면 브라우저가 풀어 버리므로 돌아올 때 다시 잡습니다.
    useEffect(() => {
        if (!awake || !wakeSupported || !active) return;
        let cancelled = false;
        const acquire = () => {
            if (document.visibilityState !== 'visible') return;
            if (sentinel.current && !sentinel.current.released) return;
            navigator.wakeLock
                .request('screen')
                .then((lock) => {
                    if (cancelled) {
                        void lock.release().catch(() => undefined);
                        return;
                    }
                    sentinel.current = lock;
                })
                .catch(() => {
                    if (!cancelled) setAwake(false);
                });
        };
        acquire();
        document.addEventListener('visibilitychange', acquire);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', acquire);
            void sentinel.current?.release().catch(() => undefined);
            sentinel.current = null;
        };
    }, [awake, wakeSupported, active]);

    useEffect(() => {
        const sync = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    return {
        wakeSupported,
        fullscreenSupported,
        awake,
        fullscreen,
        locked,
        toggleAwake: () => setAwake((value) => !value),
        toggleFullscreen: () => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        },
        setLocked,
    };
}

/* ───────────── 키보드 · 페달: 방향키 · Page Up/Down 으로 넘김 ───────────── */

/**
 * 진행할 수 있는 사람이 키보드나 블루투스 페달(Page Up/Down)로 섹션을 넘깁니다.
 * 악보 화면에서는 뷰어가 같은 키로 쪽을 넘기므로 꺼 둡니다 (enabled=false).
 */
export function useNavKeys({ enabled, onNext, onPrev }: { enabled: boolean; onNext: () => void; onPrev: () => void }) {
    const actions = useRef({ onNext, onPrev });
    useEffect(() => {
        actions.current = { onNext, onPrev };
    });
    useEffect(() => {
        if (!enabled) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.repeat) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
            if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                event.preventDefault();
                actions.current.onNext();
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault();
                actions.current.onPrev();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled]);
}

/* ───────────── 알림 자동 닫기 ───────────── */

/** 확인한 큐 알림이 '확인함' 을 보여 준 뒤 닫히기까지 */
const ACKED_LINGER_MS = 900;

/**
 * ttl 이 있는 알림은 그 시간이 지나면 handlers.dismiss 로 닫습니다. 확인한 큐는 잠깐 뒤에 닫습니다.
 * 시각은 알림의 createdAt 기준이라, 다시 그려지거나 화면이 바뀌어도 남은 시간만큼만 기다립니다.
 */
export function useToastExpiry(toasts: LiveToast[], dismiss: (id: string) => void) {
    const dismissRef = useRef(dismiss);
    const firstSeen = useRef(new Map<string, number>());
    const ackedAt = useRef(new Map<string, number>());
    const timers = useRef(new Map<string, { due: number; timer: ReturnType<typeof setTimeout> }>());

    useEffect(() => {
        dismissRef.current = dismiss;
    });

    useEffect(() => {
        const now = Date.now();
        const live = new Set(toasts.map((toast) => toast.id));
        for (const [id, entry] of timers.current) {
            if (live.has(id)) continue;
            clearTimeout(entry.timer);
            timers.current.delete(id);
        }
        for (const map of [firstSeen.current, ackedAt.current]) {
            for (const id of map.keys()) if (!live.has(id)) map.delete(id);
        }

        for (const toast of toasts) {
            if (!firstSeen.current.has(toast.id)) firstSeen.current.set(toast.id, now);
            if (toast.acked && !ackedAt.current.has(toast.id)) ackedAt.current.set(toast.id, now);
            const start = toast.createdAt > 0 ? toast.createdAt : firstSeen.current.get(toast.id)!;
            const due = toast.acked ? ackedAt.current.get(toast.id)! + ACKED_LINGER_MS : toast.ttl === null ? null : start + toast.ttl;
            const existing = timers.current.get(toast.id);
            if (existing && existing.due === due) continue;
            if (existing) {
                clearTimeout(existing.timer);
                timers.current.delete(toast.id);
            }
            if (due === null) continue;
            const id = toast.id;
            timers.current.set(id, {
                due,
                timer: setTimeout(() => {
                    timers.current.delete(id);
                    dismissRef.current(id);
                }, Math.max(0, due - now)),
            });
        }
    }, [toasts]);

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((entry) => clearTimeout(entry.timer));
            pending.clear();
        };
    }, []);
}
