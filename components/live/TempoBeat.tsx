'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { beatGroups, parseMeter, usePulse } from './usePulse';

/*
 * 곡 줄(모바일) · 위 막대(데스크톱)의 BPM — 박 시계에 맞춰 움직입니다.
 * - 점: 한 마디의 박이 차례로 켜집니다. 4/4 는 4개, 6/8 은 3+3 으로 묶은 6개. 1박은 짧은 초록 막대.
 * - 숫자: BPM 이 세는 박(4/4 는 매 박, 6/8 은 1 · 4박)마다 살짝 뛰고, 센박(1)에서 가장 크게 · 초록으로.
 * 박마다 두 번 다시 그려지므로 박 시계는 이 작은 부품 안에만 둡니다.
 * 동작 줄이기: 크기 · 색 깜빡임 없이 켜진 점만 옮겨 갑니다. BPM 이 없으면 '— BPM' 만 조용히 보여 줍니다.
 */

type BeatHit = 'down' | 'beat' | null;

export default function TempoBeat({ bpm, meter, resetKey, desktop = false }: { bpm: number | null; meter: string; resetKey: string; desktop?: boolean }) {
    if (bpm === null || bpm <= 0) return <NoTempo meter={meter} desktop={desktop} />;
    return <RunningTempo bpm={bpm} meter={meter} resetKey={resetKey} desktop={desktop} />;
}

function RunningTempo({ bpm, meter, resetKey, desktop }: { bpm: number; meter: string; resetKey: string; desktop: boolean }) {
    const pulse = usePulse({ bpm, meter, resetKey });
    const groups = beatGroups(parseMeter(meter));
    const countsBpm = pulse.groupSize === null || pulse.downbeat || pulse.secondary;
    const hit: BeatHit = pulse.count > 0 && pulse.blink && countsBpm ? (pulse.downbeat ? 'down' : 'beat') : null;

    return (
        <span role="img" aria-label={`${bpm} BPM, ${meter}`} className={cn('inline-flex min-w-0 shrink-0 items-center', desktop ? 'gap-3' : 'gap-2.5')}>
            <BpmNumber bpm={bpm} hit={hit} desktop={desktop} />
            {/* 겹박자는 묶음 사이를 박 사이보다 두 배 넘게 띄웁니다 */}
            <span aria-hidden="true" className={cn('flex items-center', desktop ? 'gap-3' : 'gap-3.5')}>
                {groups.map((group) => (
                    <span key={group[0]} className="flex items-center gap-1.5">
                        {group.map((beat) => {
                            const on = beat === pulse.count;
                            return (
                                <span
                                    key={beat}
                                    className={cn(
                                        'rounded-full transition-[scale,background-color] duration-100 motion-reduce:transition-none',
                                        // 1박은 짧은 막대 — 펄스의 넓은 첫 박 막대와 같은 모양이라 어디가 1인지 바로 보입니다
                                        desktop ? cn('h-2', beat === 1 ? 'w-3.5' : 'w-2') : cn('h-2.5', beat === 1 ? 'w-[18px]' : 'w-2.5'),
                                        on ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
                                        on && pulse.blink && (beat === 1 ? 'motion-safe:scale-140' : 'motion-safe:scale-125'),
                                    )}
                                />
                            );
                        })}
                    </span>
                ))}
            </span>
            {/* 박자표: 모바일 곡 줄에만 (데스크톱은 악보 · 펄스 열 맨 위 줄이 보여 줍니다) */}
            {desktop ? null : (
                <span aria-hidden="true" className="text-muted-foreground">
                    {meter}
                </span>
            )}
        </span>
    );
}

function NoTempo({ meter, desktop }: { meter: string; desktop: boolean }) {
    return (
        <span role="img" aria-label={`BPM 없음, ${meter}`} className={cn('inline-flex shrink-0 items-baseline gap-1.5', desktop ? 'gap-3' : 'gap-2.5')}>
            <span aria-hidden="true" className="inline-flex items-baseline gap-1.5">
                <span className={cn('font-semibold text-muted-foreground', desktop ? 'text-[17px]' : 'text-[15px]')}>—</span>
                <span className={cn('font-medium text-muted-foreground', desktop ? 'text-xs' : 'text-[13px]')}>BPM</span>
            </span>
            {desktop ? null : (
                <span aria-hidden="true" className="text-muted-foreground">
                    {meter}
                </span>
            )}
        </span>
    );
}

/**
 * BPM 숫자. 박에 맞춰 살짝 뛰고(hit), 값이 바뀌면(곡 바꿈 · 템포 조정) 이전 숫자가 위 · 아래로 빠지며 새 숫자가 들어와 잠깐 초록으로 남습니다.
 */
function BpmNumber({ bpm, hit, desktop }: { bpm: number; hit: BeatHit; desktop: boolean }) {
    const [shown, setShown] = useState<{ bpm: number; prev: number | null; seq: number }>({ bpm, prev: null, seq: 0 });
    if (shown.bpm !== bpm) setShown({ bpm, prev: shown.bpm, seq: shown.seq + 1 });
    // 바뀐 숫자는 1.2초 동안 초록으로 — 타이머가 끝나면 '확인함' 으로 표시
    const [settled, setSettled] = useState(0);
    useEffect(() => {
        if (shown.seq === 0) return;
        const timer = setTimeout(() => setSettled(shown.seq), 1200);
        return () => clearTimeout(timer);
    }, [shown.seq]);
    const fresh = shown.seq > 0 && settled !== shown.seq;
    const up = shown.prev !== null && shown.bpm > shown.prev;

    return (
        <span aria-hidden="true" className="inline-flex items-baseline gap-1.5">
            <span
                className={cn(
                    'relative inline-flex origin-bottom overflow-hidden font-semibold tabular-nums transition-[scale,color] duration-100 ease-out motion-reduce:transition-none',
                    desktop ? 'text-[17px]' : 'text-[15px]',
                    hit === 'down' && 'motion-safe:scale-[1.16] motion-safe:text-brand',
                    hit === 'beat' && 'motion-safe:scale-[1.08]',
                )}
            >
                {shown.prev !== null ? (
                    <span
                        key={`out-${shown.seq}`}
                        className={cn('absolute inset-0 animate-out fade-out fill-mode-forwards duration-300 ease-in motion-reduce:hidden', up ? 'slide-out-to-top-full' : 'slide-out-to-bottom-full')}
                    >
                        {shown.prev}
                    </span>
                ) : null}
                <span
                    key={`in-${shown.seq}`}
                    className={cn(
                        'transition-colors duration-700',
                        shown.prev !== null && ['animate-in fade-in animation-duration-300 motion-reduce:animate-none', up ? 'slide-in-from-bottom-full' : 'slide-in-from-top-full'],
                        fresh && 'motion-safe:text-brand',
                    )}
                >
                    {shown.bpm}
                </span>
            </span>
            <span className={cn('font-medium text-muted-foreground', desktop ? 'text-xs' : 'text-[13px]')}>BPM</span>
        </span>
    );
}
