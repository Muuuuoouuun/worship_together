import { useEffect, useRef } from 'react';

/*
 * 시트/창이 함께 쓰는 뒤 화면 스크롤 잠금과 Esc 닫기 (일정·요청 화면의 창, 공통 Modal, 팀 일괄 등록 창).
 * 창이 겹쳐 열려도 (예: 배분표 빠른 배정 시트 위에 동의 현황 창) 스크롤 잠금은 개수로 세어
 * 마지막 창이 닫힐 때만 원래 값으로 돌리고, Esc 는 맨 위 창 하나만 닫습니다.
 */

let lockCount = 0;
let savedOverflow = '';

/** body 스크롤을 막고, 푸는 함수를 돌려줍니다. 처음 잠글 때의 값을 기억했다가 모두 풀리면 되돌립니다. */
export function lockBodyScroll(): () => void {
    if (typeof document === 'undefined') return () => {};
    if (lockCount === 0) {
        savedOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        lockCount -= 1;
        if (lockCount === 0) document.body.style.overflow = savedOverflow;
    };
}

type Overlay = { close: () => void };

/** 열린 순서대로 쌓인 창. 마지막 항목이 맨 위 창입니다. */
const overlays: Overlay[] = [];

function handleEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    const top = overlays[overlays.length - 1];
    if (!top) return;
    // 맨 위 창만 닫고, 뒤 화면(일정 패널의 Esc 처리 등)으로는 넘기지 않습니다.
    event.preventDefault();
    event.stopImmediatePropagation();
    top.close();
}

/**
 * 열려 있는 동안 뒤 화면 스크롤을 막고, Esc 로 (맨 위에 있을 때만) 닫습니다.
 * onClose 는 매 렌더 새 함수여도 괜찮습니다 — ref 로 최신 값을 불러 잠금을 다시 걸지 않습니다.
 */
export function useSheetDismiss(onClose: () => void, open = true) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return;
        const overlay: Overlay = { close: () => onCloseRef.current() };
        overlays.push(overlay);
        if (overlays.length === 1) document.addEventListener('keydown', handleEscape);
        const unlock = lockBodyScroll();
        return () => {
            const index = overlays.lastIndexOf(overlay);
            if (index !== -1) overlays.splice(index, 1);
            if (overlays.length === 0) document.removeEventListener('keydown', handleEscape);
            unlock();
        };
    }, [open]);
}
