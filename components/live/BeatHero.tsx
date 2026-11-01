'use client';

import { Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBeatEffects, type BeatEffects } from './beatEffects';
import { usePulse } from './usePulse';
import styles from './live-stage.module.css';

/** A quiet dial adapted from the earlier PulseRing prototype.
 * The clock stays in this leaf. Section length is unknown, so no progress is invented.
 * 펄스 효과 · 깜빡임(beatEffects)을 켜면 박마다 숫자가 살짝 커지고 · 첫 박에 링이 퍼지고 · 다이얼이 짧게 빛납니다. 둘 다 끄면 지금 박 칸만 바뀝니다.
 */
export default function BeatHero({ bpm, meter, resetKey, desktop = false }: { bpm: number; meter: string; resetKey: string; desktop?: boolean }) {
    const pulse = usePulse({ bpm, meter, resetKey });
    const [effects, setEffect] = useBeatEffects();
    const count = pulse.count || 1;
    const circumference = 2 * Math.PI * 88;
    const step = circumference / pulse.beatsPerBar;
    // 박마다 바뀌는 열쇠 — 효과 요소를 새로 그려 애니메이션을 처음부터 다시 돌립니다.
    const tick = pulse.count > 0 ? `${pulse.bar}-${pulse.count}` : null;
    const accent = pulse.downbeat || pulse.secondary;

    return (
        <section aria-label={`펄스 · ${bpm} BPM · ${meter}`} className="flex min-h-0 flex-1 flex-col">
            <p className="sr-only">첫 박은 굵은 선으로 표시해요. 기기의 참고 박자이며 실제 연주와 자동으로 맞춰지지는 않아요.</p>
            <div className={styles.dialSpace} aria-hidden="true">
                <div className={styles.dial} data-pulse-effect={effects.pulse} data-blink={effects.blink}>
                    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible" fill="none">
                        {effects.blink && tick ? (
                            <circle key={`flash-${tick}`} data-beat-flash cx="100" cy="100" r="84" className={pulse.downbeat ? styles.flashDown : styles.flash} />
                        ) : null}
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
                                    className={active ? cn(styles.activeBeat, effects.blink && styles.segBlink) : styles.restBeat}
                                />
                            );
                        })}
                        {effects.pulse && tick && accent ? (
                            <circle key={`ripple-${tick}`} data-beat-ripple cx="100" cy="100" r="88" strokeWidth={pulse.downbeat ? 3 : 2} className={pulse.downbeat ? styles.ripple : styles.rippleSoft} />
                        ) : null}
                    </svg>
                    <div className={styles.dialFace}>
                        <span
                            key={effects.pulse && tick ? `count-${tick}` : 'count'}
                            className={cn(styles.beatNumber, effects.pulse && tick && (pulse.downbeat ? styles.popDown : styles.pop))}
                            data-pulse-count
                        >
                            {count}
                        </span>
                        <span className={styles.beatLabel}>/ {pulse.beatsPerBar} 박</span>
                    </div>
                </div>
            </div>
            <div className={cn(styles.pulseCaption, desktop && styles.desktopCaption)}>
                <BeatEffectToggles effects={effects} onChange={setEffect} />
                <span aria-hidden="true" className="tabular-nums">참고 박자 · {pulse.bar}마디째</span>
            </div>
        </section>
    );
}

/** 펄스 화면 아래의 효과 스위치 두 개 — 더보기의 '이 기기' 스위치와 같은 설정입니다. */
export function BeatEffectToggles({ effects, onChange }: { effects: BeatEffects; onChange: (name: keyof BeatEffects, on: boolean) => void }) {
    const items = [
        { name: 'pulse' as const, label: '펄스 효과', icon: Activity },
        { name: 'blink' as const, label: '깜빡임', icon: Zap },
    ];
    return (
        <div role="group" aria-label="박자 효과" className="flex items-center gap-1.5">
            {items.map(({ name, label, icon: Icon }) => {
                const on = effects[name];
                return (
                    <button
                        key={name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(name, !on)}
                        className={cn(
                            // 보이는 알약은 32px, 누르는 자리는 위아래로 넓혀 44px
                            'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium outline-none transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none',
                            on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground ring-1 ring-border hover:text-foreground',
                        )}
                    >
                        <Icon className="size-3.5" aria-hidden="true" />
                        {label}
                        <span className="sr-only">{on ? ' 켜짐' : ' 꺼짐'}</span>
                    </button>
                );
            })}
        </div>
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
