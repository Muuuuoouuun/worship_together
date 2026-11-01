'use client';

import { cn } from '@/lib/utils';
import { useBeatEffects } from './beatEffects';
import { usePulse } from './usePulse';
import styles from './live-stage.module.css';

/**
 * 곡 줄(모바일) · 위 막대(데스크톱)의 BPM · 박자표. 기본은 가만히 있고,
 * '깜빡임' 을 켜면 BPM 옆 점이 박에 맞춰 깜빡입니다 (펄스 다이얼이 보이는 화면에서는 다이얼만).
 */
export default function TempoBeat({ bpm, meter, desktop = false, resetKey, showBlink = true }: { bpm: number | null; meter: string; desktop?: boolean; resetKey?: string; showBlink?: boolean }) {
    const [effects] = useBeatEffects();
    const blink = showBlink && effects.blink && Boolean(bpm && bpm > 0);
    return (
        <span role="img" aria-label={`${bpm && bpm > 0 ? `${bpm} BPM` : 'BPM 없음'}, ${meter}`} className="inline-flex shrink-0 items-baseline gap-3 text-muted-foreground">
            <span aria-hidden="true" className="inline-flex items-baseline gap-1.5">
                {blink ? <BlinkDot bpm={bpm!} meter={meter} resetKey={resetKey} /> : null}
                <span className={cn('font-medium tabular-nums text-foreground', desktop ? 'text-base' : 'text-[15px]')}>{bpm && bpm > 0 ? bpm : '—'}</span>
                <span className="text-xs">BPM</span>
            </span>
            <span aria-hidden="true" className="border-l border-border pl-3 text-xs tabular-nums">{meter}</span>
        </span>
    );
}

/** 박마다 한 번 빛나는 점 — 첫 박은 강조색. 박 시계는 이 점 안에만 둡니다. */
function BlinkDot({ bpm, meter, resetKey }: { bpm: number; meter: string; resetKey?: string }) {
    const pulse = usePulse({ bpm, meter, resetKey });
    return (
        <span className="relative mr-0.5 inline-flex size-2.5 self-center">
            <span className="absolute inset-0 rounded-full bg-foreground/15" />
            {pulse.count > 0 ? (
                <span
                    key={`${pulse.bar}-${pulse.count}`}
                    data-blink-dot={pulse.downbeat ? 'down' : 'beat'}
                    className={cn('absolute inset-0 rounded-full', pulse.downbeat ? 'bg-brand' : 'bg-foreground', styles.dotFlash)}
                />
            ) : null}
        </span>
    );
}
