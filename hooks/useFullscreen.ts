'use client';

import { useCallback, useEffect, useState } from 'react';

export function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSupported] = useState(() => {
        if (typeof document === 'undefined') return false;
        return Boolean(
            document.fullscreenEnabled ||
            (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
        );
    });

    useEffect(() => {

        const handleFullscreenChange = () => {
            const currentElement =
                document.fullscreenElement ||
                (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
            setIsFullscreen(Boolean(currentElement));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const enterFullscreen = useCallback(async (element?: HTMLElement) => {
        const target = element || document.documentElement;
        try {
            if (target.requestFullscreen) {
                await target.requestFullscreen();
            } else if ((target as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
                await (target as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
            }
        } catch (err) {
            console.warn('[useFullscreen] Failed to enter fullscreen:', err);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if ((document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
                await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
            }
        } catch (err) {
            console.warn('[useFullscreen] Failed to exit fullscreen:', err);
        }
    }, []);

    const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
        if (isFullscreen) {
            await exitFullscreen();
        } else {
            await enterFullscreen(element);
        }
    }, [isFullscreen, enterFullscreen, exitFullscreen]);

    return {
        isFullscreen,
        isSupported,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
    };
}
