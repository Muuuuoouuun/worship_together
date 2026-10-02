'use client';

import { useEffect, useRef } from 'react';

type PageTurnerOptions = {
    onNext: () => void;
    onPrev: () => void;
    enabled?: boolean;
    throttleMs?: number;
};

/**
 * 블루투스 악보 넘김 페달(AirTurn, PageFlip 등) 및 키보드 단축키 감지 훅
 */
export function usePageTurner({
    onNext,
    onPrev,
    enabled = true,
    throttleMs = 80,
}: PageTurnerOptions) {
    const lastTriggerRef = useRef<number>(0);
    const onNextRef = useRef(onNext);
    const onPrevRef = useRef(onPrev);

    useEffect(() => {
        onNextRef.current = onNext;
        onPrevRef.current = onPrev;
    });

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 페달을 길게 밟을 때 발생하는 연속 키 반복 이벤트 차단
            if (e.repeat) return;

            // 텍스트 입력 중일 때는 악보 넘김 방지
            const activeElement = document.activeElement;
            if (
                activeElement &&
                (activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    (activeElement as HTMLElement).isContentEditable)
            ) {
                return;
            }

            const now = Date.now();
            if (now - lastTriggerRef.current < throttleMs) {
                return;
            }

            // 대표적인 블루투스 풋페달 및 키보드 키 매핑
            switch (e.key) {
                case 'PageDown':
                case 'ArrowRight':
                case 'ArrowDown':
                case ' ': // 스페이스바 (일부 페달의 기본 모드)
                    e.preventDefault();
                    lastTriggerRef.current = now;
                    onNextRef.current();
                    break;

                case 'PageUp':
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'Backspace':
                    e.preventDefault();
                    lastTriggerRef.current = now;
                    onPrevRef.current();
                    break;

                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, throttleMs]);
}
