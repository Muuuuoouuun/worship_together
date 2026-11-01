import { cn } from '@/lib/utils';

/** Keep metadata still; the pulse dial is the only moving beat indicator. */
export default function TempoBeat({ bpm, meter, desktop = false }: { bpm: number | null; meter: string; desktop?: boolean }) {
    return (
        <span role="img" aria-label={`${bpm && bpm > 0 ? `${bpm} BPM` : 'BPM 없음'}, ${meter}`} className="inline-flex shrink-0 items-baseline gap-3 text-muted-foreground">
            <span aria-hidden="true" className="inline-flex items-baseline gap-1.5">
                <span className={cn('font-medium tabular-nums text-foreground', desktop ? 'text-base' : 'text-[15px]')}>{bpm && bpm > 0 ? bpm : '—'}</span>
                <span className="text-xs">BPM</span>
            </span>
            <span aria-hidden="true" className="border-l border-border pl-3 text-xs tabular-nums">{meter}</span>
        </span>
    );
}
