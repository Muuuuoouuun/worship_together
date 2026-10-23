'use client';

import { cn } from '@/lib/utils';
import { usePulse } from './usePulse';
import styles from './live-stage.module.css';

/** A quiet dial adapted from the earlier PulseRing prototype.
 * The clock stays in this leaf. Section length is unknown, so no progress is invented.
 */
export default function BeatHero({ bpm, meter, resetKey, desktop = false }: { bpm: number; meter: string; resetKey: string; desktop?: boolean }) {
    const pulse = usePulse({ bpm, meter, resetKey });
    const count = pulse.count || 1;
    const circumference = 2 * Math.PI * 88;
    const step = circumference / pulse.beatsPerBar;

    return (
        <section aria-label={`펄스 · ${bpm} BPM · ${meter}`} className="flex min-h-0 flex-1 flex-col">
            <p className="sr-only">첫 박은 굵은 선으로 표시해요. 기기의 참고 박자이며 실제 연주와 자동으로 맞춰지지는 않아요.</p>
            <div className={styles.dialSpace} aria-hidden="true">
                <div className={styles.dial}>
                    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible" fill="none">
                        {Array.from({ length: pulse.beatsPerBar }, (_, index) => {
                            const active = index + 1 === count;
                            const groupStart = pulse.groupSize !== null && index % pulse.groupSize === 0;
                            const gap = groupStart ? 10 : 6;
                            return (
                                <circle
                                    key={index}
                                    data-beat={index + 1}
                                    data-active={active}
                                    cx="100" cy="100" r="88"
                                    strokeDasharray={`${step - gap} ${circumference - step + gap}`}
                                    strokeDashoffset={-index * step - gap / 2}
                                    transform="rotate(-90 100 100)"
                                    strokeLinecap="round"
                                    strokeWidth={index === 0 ? 5 : groupStart ? 3.5 : 2.5}
                                    className={active ? styles.activeBeat : styles.restBeat}
                                />
                            );
                        })}
                    </svg>
                    <div className={styles.dialFace}>
                        <span className={styles.beatNumber} data-pulse-count>{count}</span>
                        <span className={styles.beatLabel}>/ {pulse.beatsPerBar} 박</span>
                    </div>
                </div>
            </div>
            <p aria-hidden="true" className={cn(styles.pulseCaption, desktop && styles.desktopCaption)}>
                <span>첫 박은 굵게</span>
                <span className="tabular-nums">참고 박자 · {pulse.bar}마디째</span>
            </p>
        </section>
    );
}

export function NoPulse({ desktop = false }: { desktop?: boolean }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-5 text-center">
            <span aria-hidden="true" className="mb-5 size-12 rounded-full border border-border" />
            <p className={cn('font-medium tracking-tight', desktop ? 'text-xl' : 'text-[17px]')}>박자가 지정되지 않은 곡이에요</p>
            <p className="mt-2 max-w-64 text-sm leading-relaxed text-muted-foreground">지금과 다음 순서를 보며 함께해 주세요.</p>
        </div>
    );
}
