'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * 예배 중 화면의 박 시계. 지금 BPM 과 박자표로 한 마디의 박 · 센박 · 마디 수를 셉니다.
 * - 4/4 · 3/4 …: 4분음표 = BPM, 위 숫자만큼 박
 * - 6/8 · 9/8 · 12/8 (겹박자): 점4분음표 = BPM, 8분음표를 세고 세 박씩 묶음 (묶음 첫 박이 중간 센박)
 * 박마다 두 번(박 시작 · 깜빡임 끝) 다시 그리므로, 이 훅은 박 표시만 그리는 작은 부품에서 쓰세요.
 */

export interface Meter {
    /** 한 마디 박 수 */
    beatsPerBar: number;
    /** 4분음표 하나에 세는 박 수 (겹박자는 3) */
    perQuarter: number;
    /** 박을 몇 개씩 묶어 보여 줄지 (겹박자 3, 아니면 null) */
    groupSize: number | null;
}

export function parseMeter(meter: string): Meter {
    const [top, bottom] = meter.split('/').map((part) => Number(part.trim()));
    const beats = Number.isFinite(top) && top >= 1 && top <= 16 ? Math.round(top) : 4;
    if (bottom === 8 && beats > 3 && beats % 3 === 0) return { beatsPerBar: beats, perQuarter: 3, groupSize: 3 };
    return { beatsPerBar: beats, perQuarter: 1, groupSize: null };
}

/** 박 번호(1부터)를 보여 줄 묶음으로 — 6/8 은 [[1,2,3],[4,5,6]], 4/4 는 [[1,2,3,4]] */
export function beatGroups({ beatsPerBar, groupSize }: Pick<Meter, 'beatsPerBar' | 'groupSize'>): number[][] {
    const beats = Array.from({ length: beatsPerBar }, (_, index) => index + 1);
    if (!groupSize) return [beats];
    const groups: number[][] = [];
    for (let start = 0; start < beats.length; start += groupSize) groups.push(beats.slice(start, start + groupSize));
    return groups;
}

export interface Pulse {
    /** 마디 안에서 지금 박 (1부터). 아직 시작 전이면 0 */
    count: number;
    beatsPerBar: number;
    groupSize: number | null;
    /** 첫 박 (센박) */
    downbeat: boolean;
    /** 6/8 의 4박처럼 묶음의 첫 박 */
    secondary: boolean;
    /** 박이 막 들어온 짧은 순간 (깜빡임) */
    blink: boolean;
    /** resetKey 가 바뀐 뒤 몇 번째 마디인지 (1부터) */
    bar: number;
    /** 한 박 길이 ms */
    intervalMs: number;
}

/**
 * @param resetKey 섹션 · 곡 · 화면이 바뀔 때 바꿔 주면 1박 · 1마디부터 다시 셉니다.
 */
export function usePulse({ bpm, meter, resetKey }: { bpm: number; meter: string; resetKey?: string | number }): Pulse {
    const parsed = parseMeter(meter);
    const intervalMs = 60000 / (Math.max(20, Math.min(300, bpm)) * parsed.perQuarter);
    const [state, setState] = useState({ tick: -1, blink: false });
    const startRef = useRef(0);

    useEffect(() => {
        startRef.current = Date.now();
        const pulseMs = Math.min(140, intervalMs * 0.35);
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            const elapsed = Date.now() - startRef.current;
            const index = Math.floor(elapsed / intervalMs);
            const phase = elapsed - index * intervalMs;
            // 다른 앱에 가 있는 동안은 깜빡이지 않고 박만 셉니다
            const blink = phase < pulseMs && !document.hidden;
            setState((current) => (current.tick === index && current.blink === blink ? current : { tick: index, blink }));
            timer = setTimeout(tick, Math.max(8, (blink ? pulseMs : intervalMs) - phase));
        };
        timer = setTimeout(tick, 0);
        return () => clearTimeout(timer);
    }, [intervalMs, resetKey]);

    if (state.tick < 0) {
        return { count: 0, beatsPerBar: parsed.beatsPerBar, groupSize: parsed.groupSize, downbeat: false, secondary: false, blink: false, bar: 1, intervalMs };
    }
    const count = (state.tick % parsed.beatsPerBar) + 1;
    return {
        count,
        beatsPerBar: parsed.beatsPerBar,
        groupSize: parsed.groupSize,
        downbeat: count === 1,
        secondary: parsed.groupSize !== null && count > 1 && (count - 1) % parsed.groupSize === 0,
        blink: state.blink,
        bar: Math.floor(state.tick / parsed.beatsPerBar) + 1,
        intervalMs,
    };
}
