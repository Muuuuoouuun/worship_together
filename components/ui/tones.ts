/**
 * 파스텔 분류 색 (레퍼런스의 이번 주 콘티 민트 블록, 특이사항 복숭아 블록, 아바타 색).
 * 상태 색은 status.ts, 분류 색은 여기 — 화면에서 다른 곳에 색을 새로 만들지 않습니다.
 */
export type Tone = 'sky' | 'mint' | 'peach' | 'lilac' | 'sand';

export const TONE_BLOCK: Record<Tone, string> = {
    sky: 'bg-sky-50 dark:bg-sky-400/10',
    mint: 'bg-emerald-50 dark:bg-emerald-400/10',
    peach: 'bg-orange-50 dark:bg-orange-400/10',
    lilac: 'bg-violet-50 dark:bg-violet-400/10',
    sand: 'bg-amber-50 dark:bg-amber-400/10',
};

export const TONE_DOT: Record<Tone, string> = {
    sky: 'bg-sky-500',
    mint: 'bg-emerald-500',
    peach: 'bg-orange-500',
    lilac: 'bg-violet-500',
    sand: 'bg-amber-500',
};

export const TONE_ICON: Record<Tone, string> = {
    sky: 'text-sky-600 dark:text-sky-300',
    mint: 'text-emerald-600 dark:text-emerald-300',
    peach: 'text-orange-600 dark:text-orange-300',
    lilac: 'text-violet-600 dark:text-violet-300',
    sand: 'text-amber-600 dark:text-amber-300',
};

export const TONE_AVATAR: Record<Tone, string> = {
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-400/25 dark:text-sky-100',
    mint: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-100',
    peach: 'bg-orange-100 text-orange-800 dark:bg-orange-400/25 dark:text-orange-100',
    lilac: 'bg-violet-100 text-violet-800 dark:bg-violet-400/25 dark:text-violet-100',
    sand: 'bg-amber-100 text-amber-800 dark:bg-amber-400/25 dark:text-amber-100',
};
