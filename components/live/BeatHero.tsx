'use client';

import { cn } from '@/lib/utils';
import { beatGroups, usePulse } from './usePulse';

/*
 * 펄스 — 아주 큰 박 숫자 하나가 주인공. 센박(1)만 진한 잉크, 나머지 박은 회색이라 멀리서도 '1' 이 보입니다.
 * 그 아래 박 막대(지금 박 = 검정 알약, 1박은 늘 테두리 + 넓게)와 이 섹션에서 몇 번째 마디인지.
 * 섹션 길이(마디 수)는 모델에 없으므로 전체 마디 수 대신 섹션이 시작된 뒤 센 마디만 보여 줍니다.
 */

/**
 * 박마다 두 번 다시 그려지는 유일한 부분 — 숫자 · 막대 · 마디만 여기서 그립니다
 * @param tempo false 면 아래 줄에서 BPM · 박자표를 빼고 마디만 (BPM 을 같은 화면의 다른 곳에서 보여 줄 때)
 */
export default function BeatHero({ bpm, meter, resetKey, desktop = false, tempo = true }: { bpm: number; meter: string; resetKey: string; desktop?: boolean; tempo?: boolean }) {
    const pulse = usePulse({ bpm, meter, resetKey });
    const count = pulse.count || 1;
    const started = pulse.count > 0;
    const strength = pulse.downbeat || !started ? 'strong' : pulse.secondary ? 'mid' : 'weak';

    return (
        <>
            <p className="sr-only">
                박자 {bpm} BPM, {meter}
            </p>
            <div aria-hidden="true" className="pointer-events-none relative flex min-h-0 flex-1 select-none items-center justify-center [container-type:size]">
                <span
                    className={cn(
                        'block font-semibold leading-[0.76] tracking-tighter tabular-nums transition-[transform,color] duration-150 ease-out motion-reduce:transition-none',
                        desktop ? 'text-[length:min(128cqh,100cqw)]' : 'text-[length:min(112cqh,124cqw)]',
                        strength === 'strong' ? 'text-foreground' : strength === 'mid' ? 'text-foreground/70' : 'text-muted-foreground',
                        pulse.blink && (pulse.downbeat ? 'motion-safe:scale-[1.06]' : 'motion-safe:scale-[1.025]'),
                    )}
                >
                    {count}
                </span>
            </div>

            <BeatSegments count={started ? count : 0} groups={beatGroups(pulse)} blink={pulse.blink} desktop={desktop} />

            <div aria-hidden="true" className={cn('flex items-baseline justify-between gap-4 text-muted-foreground', desktop ? 'mt-6 text-lg' : 'mt-4 text-sm')}>
                {tempo ? (
                    <p>
                        <span className="font-semibold tabular-nums text-foreground">{bpm}</span> BPM
                        <span className="mx-2 text-border">|</span>
                        <span className="font-medium text-foreground">{meter}</span>
                    </p>
                ) : null}
                <p>
                    마디 <span className="font-semibold tabular-nums text-foreground">{pulse.bar}</span>
                </p>
            </div>
            <div aria-hidden="true" className={cn('h-px shrink-0 bg-border', desktop ? 'mt-3' : 'mt-2.5')} />
        </>
    );
}

/** 한 마디의 박 막대. 4/4 → 4칸, 6/8 → 3+3 으로 묶은 6칸. 1박은 넓고 늘 테두리, 묶음의 첫 박은 옅은 테두리 */
function BeatSegments({ count, groups, blink, desktop }: { count: number; groups: number[][]; blink: boolean; desktop: boolean }) {
    const grouped = groups.length > 1;
    return (
        <div aria-hidden="true" className={cn('flex shrink-0 items-center', grouped ? (desktop ? 'gap-6' : 'gap-4') : '', desktop ? 'mt-6' : 'mt-3')}>
            {groups.map((group) => (
                <div key={group[0]} className={cn('flex min-w-0 flex-1 items-center', desktop ? 'gap-2' : 'gap-1.5')}>
                    {group.map((beat, index) => {
                        const on = beat === count;
                        const down = beat === 1;
                        const mid = grouped && index === 0 && !down;
                        return (
                            <span
                                key={beat}
                                className={cn(
                                    'block rounded-full transition-[transform,background-color] duration-100 motion-reduce:transition-none',
                                    desktop ? (grouped ? 'h-4' : 'h-5') : grouped ? 'h-2.5' : 'h-3',
                                    down ? 'flex-[1.7]' : mid ? 'flex-[1.3]' : 'flex-1',
                                    on ? 'bg-primary' : down ? 'ring-2 ring-inset ring-foreground' : mid ? 'ring-[1.5px] ring-inset ring-foreground/45' : 'bg-foreground/10',
                                    on && blink && 'motion-safe:scale-y-[1.35]',
                                )}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/** BPM 이 없는 곡의 펄스 자리 — 박을 지어내지 않고 조용히 알려 줍니다 */
export function NoPulse({ desktop = false }: { desktop?: boolean }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <p aria-hidden="true" className={cn('font-semibold leading-none tracking-tighter text-foreground/15', desktop ? 'text-[160px]' : 'text-[120px]')}>
                —
            </p>
            <p className={cn('mt-4 font-semibold tracking-tight', desktop ? 'text-xl' : 'text-[17px]')}>이 곡은 BPM 이 없어요</p>
            <p className={cn('mt-1 text-muted-foreground', desktop ? 'text-base' : 'text-sm')}>콘티에서 BPM 을 정하면 박을 함께 셀 수 있어요</p>
        </div>
    );
}
