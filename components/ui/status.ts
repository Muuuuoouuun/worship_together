/**
 * 상태 색은 앱 전체에서 여기 한 곳에서만 정합니다 (확정·대기·불참·빈자리).
 * 콘티·순서 리디자인의 초록·노랑·분홍 점과 같은 색입니다.
 */
export const STATUS = {
    ok: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    warn: { dot: 'bg-amber-400', bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-200' },
    danger: { dot: 'bg-rose-400', bar: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-400', soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
    idle: { dot: 'bg-muted-foreground/30', bar: 'bg-muted', text: 'text-muted-foreground', soft: 'bg-muted text-muted-foreground' },
} as const;

export type StatusTone = keyof typeof STATUS;
