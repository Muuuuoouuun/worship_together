'use client';

import { useCallback, useSyncExternalStore } from 'react';

/*
 * 박자 효과 설정 (이 기기에 저장).
 * - 펄스 효과: 박마다 박 숫자가 살짝 커졌다 돌아오고, 첫 박에는 링이 퍼집니다.
 * - 깜빡임: 박마다 다이얼이 짧게 빛나고, 지금 · 악보 화면의 BPM 옆 점도 박에 맞춰 깜빡입니다.
 * 둘 다 끄면 조용한 다이얼(지금 박 칸만 바뀜)입니다. 정하지 않았으면 '동작 줄이기' 를 켠 기기는 둘 다 끈 채로,
 * 그 밖에는 펄스 효과만 켠 채로 시작합니다.
 */

export interface BeatEffects {
    pulse: boolean;
    blink: boolean;
}

const KEY = 'worship:live-beat-effects:v1';
const REDUCED = '(prefers-reduced-motion: reduce)';
const OFF: BeatEffects = { pulse: false, blink: false };
const listeners = new Set<() => void>();
let cache: { raw: string; value: BeatEffects } | null = null;

function defaults(): BeatEffects {
    return window.matchMedia(REDUCED).matches ? OFF : { pulse: true, blink: false };
}

function read(): BeatEffects {
    let raw = '';
    try { raw = localStorage.getItem(KEY) ?? ''; } catch { /* 저장소를 못 쓰면 기본값 */ }
    const key = `${raw}|${window.matchMedia(REDUCED).matches}`;
    if (cache?.raw === key) return cache.value;
    let value = defaults();
    try {
        const parsed = raw ? JSON.parse(raw) as Partial<BeatEffects> : null;
        if (parsed) value = { pulse: parsed.pulse === true, blink: parsed.blink === true };
    } catch { /* 망가진 값은 기본값 */ }
    cache = { raw: key, value };
    return value;
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    const media = window.matchMedia(REDUCED);
    const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
    media.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(onChange);
        media.removeEventListener('change', onChange);
        window.removeEventListener('storage', onStorage);
    };
}

export function useBeatEffects(): [BeatEffects, (name: keyof BeatEffects, on: boolean) => void] {
    const effects = useSyncExternalStore(subscribe, read, () => OFF);
    const set = useCallback((name: keyof BeatEffects, on: boolean) => {
        const next = { ...read(), [name]: on };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 이번 화면에서만 */ }
        cache = null;
        listeners.forEach((listener) => listener());
    }, []);
    return [effects, set];
}
