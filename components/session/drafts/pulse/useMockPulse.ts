'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * 펄스 시안용 박자 시계. 실제 무대의 useVisualMetronome 은 4박만 세지만,
 * 시안에서는 박자표(4/4, 6/8)에 맞춰 한 마디의 박 수와 강박, 마디 수까지 셉니다.
 * - 4/4: 4분음표 = bpm, 한 마디 4박, 강박 1
 * - 6/8: 점4분음표 = bpm, 8분음표 6개를 세고 강박 1 (중간 강박 4)
 */

export interface MockPulse {
    /** 마디 안에서 지금 박 (1부터). 꺼져 있으면 0 */
    count: number;
    /** 한 마디 박 수 (4/4 → 4, 6/8 → 6) */
    beatsPerBar: number;
    /** 첫 박 (센 박) */
    downbeat: boolean;
    /** 6/8 의 4번째처럼 중간 강박 */
    secondary: boolean;
    /** 박이 막 들어온 짧은 순간 (깜빡임) */
    blink: boolean;
    /** resetKey 가 바뀐 뒤 몇 번째 마디인지 (1부터) */
    bar: number;
    /** 한 박(센 단위) 길이 ms — CSS 애니메이션 길이에 씁니다 */
    intervalMs: number;
}

function parseMeter(meter: string) {
    const [top, bottom] = meter.split('/').map(Number);
    if (top === 6 && bottom === 8) return { beatsPerBar: 6, perQuarter: 3 };
    return { beatsPerBar: Number.isFinite(top) && top > 0 ? top : 4, perQuarter: 1 };
}

/**
 * @param resetKey 섹션·곡이 바뀔 때 바꿔 주면 마디를 1부터 다시 셉니다.
 * 박마다 두 번(박 시작·깜빡임 끝) 다시 그리므로, 이 훅은 박 표시만 그리는 작은 컴포넌트에서 쓰세요.
 */
export function useMockPulse({ bpm, meter, enabled = true, resetKey }: { bpm: number; meter: string; enabled?: boolean; resetKey?: string | number }): MockPulse {
    const { beatsPerBar, perQuarter } = parseMeter(meter);
    const intervalMs = 60000 / (Math.max(20, bpm) * perQuarter);
    const [state, setState] = useState({ tick: -1, blink: false });
    const startRef = useRef(0);

    useEffect(() => {
        if (!enabled) return;
        startRef.current = Date.now();
        const pulseMs = Math.min(140, intervalMs * 0.35);
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            const elapsed = Date.now() - startRef.current;
            const index = Math.floor(elapsed / intervalMs);
            const phase = elapsed - index * intervalMs;
            const blink = phase < pulseMs && !document.hidden;
            setState((current) => (current.tick === index && current.blink === blink ? current : { tick: index, blink }));
            timer = setTimeout(tick, Math.max(8, (blink ? pulseMs : intervalMs) - phase));
        };
        timer = setTimeout(tick, 0);
        return () => clearTimeout(timer);
    }, [enabled, intervalMs, resetKey]);

    if (!enabled || state.tick < 0) {
        return { count: 0, beatsPerBar, downbeat: false, secondary: false, blink: false, bar: 1, intervalMs };
    }
    const count = (state.tick % beatsPerBar) + 1;
    return {
        count,
        beatsPerBar,
        downbeat: count === 1,
        secondary: beatsPerBar === 6 && count === 4,
        blink: state.blink,
        bar: Math.floor(state.tick / beatsPerBar) + 1,
        intervalMs,
    };
}
