'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockSentinelLike = {
    released: boolean;
    release: () => Promise<void>;
    addEventListener: (type: 'release', listener: () => void) => void;
    removeEventListener: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

export type WakeLockStatus = 'idle' | 'active' | 'unsupported' | 'error';

export function useScreenWakeLock(initialEnabled = true) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [status, setStatus] = useState<WakeLockStatus>('idle');
    const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

    const isSupported =
        typeof navigator !== 'undefined' &&
        'wakeLock' in navigator &&
        Boolean((navigator as NavigatorWithWakeLock).wakeLock);

    const releaseLock = useCallback(async () => {
        if (sentinelRef.current) {
            try {
                await sentinelRef.current.release();
            } catch {
                // Ignore release errors
            } finally {
                sentinelRef.current = null;
                setStatus('idle');
            }
        }
    }, []);

    const requestLock = useCallback(async () => {
        if (!isSupported) {
            setStatus('unsupported');
            return;
        }

        try {
            const nav = navigator as NavigatorWithWakeLock;
            if (!nav.wakeLock) return;

            // 이미 활성 상태라면 재요청하지 않음
            if (sentinelRef.current && !sentinelRef.current.released) {
                setStatus('active');
                return;
            }

            const lock = await nav.wakeLock.request('screen');
            sentinelRef.current = lock;
            setStatus('active');

            lock.addEventListener('release', () => {
                sentinelRef.current = null;
                setStatus('idle');
            });
        } catch (err) {
            console.warn('[useScreenWakeLock] Failed to acquire screen wake lock:', err);
            setStatus('error');
        }
    }, [isSupported]);

    useEffect(() => {
        if (!isSupported) {
            setStatus('unsupported');
            return;
        }

        if (enabled) {
            void requestLock();
        } else {
            void releaseLock();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && enabled) {
                void requestLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            void releaseLock();
        };
    }, [enabled, isSupported, requestLock, releaseLock]);

    const enable = useCallback(() => setEnabled(true), []);
    const disable = useCallback(() => setEnabled(false), []);
    const toggle = useCallback(() => setEnabled((prev) => !prev), []);

    return {
        isSupported,
        isActive: status === 'active',
        status,
        enabled,
        enable,
        disable,
        toggle,
    };
}
