import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { member } from './mockData';
import { avatarLabel, toneForName, type Tone } from './model';

/**
 * 앱 전체의 기준 디자인(흰 바탕 + 중립 회색 + 한 가지 강조색).
 * 값은 app/globals.css 의 토큰에서 오므로 다른 화면과 같은 색을 씁니다.
 */
export const ink = 'text-foreground';
export const body = 'text-foreground/75';
export const sub = 'text-muted-foreground';
export const line = 'border-border/70';
export const chip = 'bg-muted';
/** 선택된 날짜·탭·주요 버튼: 검정 알약 (다크 모드에서는 흰 알약) */
export const selected = 'bg-primary text-primary-foreground';
/** 오늘 날짜: 선택과 헷갈리지 않도록 테두리 대신 강조색 글자 */
export const todayText = 'font-semibold text-brand';
/** 카드·시트 바탕 */
export const panel = 'bg-card text-card-foreground';
/** 아바타·점 테두리 (바탕색과 같은 색의 링) */
export const ringCard = 'ring-2 ring-card';
/** 새 소식·확인할 개수 같은 주의 표시 */
export const attention = 'bg-secondary text-secondary-foreground';
export const attentionText = 'text-secondary';
/** 밑줄 탭: 선택 = 검정 글씨 + 검정 밑줄 */
export const tabOn = 'border-foreground font-semibold text-foreground';
export const tabOff = 'border-transparent text-muted-foreground hover:text-foreground';
/** 빈 상태·추가 자리의 점선 테두리 */
export const dashed = 'border border-dashed border-input';
/** 목록 구분선 */
export const divide = 'divide-y divide-border/70';

/** 상태 색 (확정·대기·불참·빈자리)은 components/ui/status.ts 한 곳에서 정합니다. */
export { STATUS } from '@/components/ui/status';

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

const TONE_AVATAR: Record<Tone, string> = {
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-400/25 dark:text-sky-100',
    mint: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-100',
    peach: 'bg-orange-100 text-orange-800 dark:bg-orange-400/25 dark:text-orange-100',
    lilac: 'bg-violet-100 text-violet-800 dark:bg-violet-400/25 dark:text-violet-100',
    sand: 'bg-amber-100 text-amber-800 dark:bg-amber-400/25 dark:text-amber-100',
};

const AVATAR_SIZE = {
    xs: 'size-5 text-[9px]',
    sm: 'size-7 text-[10px]',
    md: 'size-9 text-[11px]',
} as const;

/** 사진 대신 이름(성 제외 두 글자)으로 표시하는 아바타. 목업 팀원 id 또는 이름을 받습니다. */
export function Avatar({ id, name, size = 'sm', ring = false, className }: { id?: string | null; name?: string | null; size?: keyof typeof AVATAR_SIZE; ring?: boolean; className?: string }) {
    const person = id ? member(id) : name?.trim() ? { name: name.trim(), tone: toneForName(name.trim()) } : null;
    if (!person) return null;
    const label = avatarLabel(person.name, size === 'xs');
    return (
        <span
            title={person.name}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
                AVATAR_SIZE[size],
                TONE_AVATAR[person.tone],
                ring && ringCard,
                className,
            )}
        >
            {label}
        </span>
    );
}

export function AvatarStack({ ids = [], names = [], max = 3, size = 'sm' }: { ids?: string[]; names?: string[]; max?: number; size?: keyof typeof AVATAR_SIZE }) {
    const people = [...ids.map((id) => ({ key: `id:${id}`, id, name: null })), ...names.map((name) => ({ key: `name:${name}`, id: null, name }))];
    const shown = people.slice(0, max);
    const rest = people.length - shown.length;
    return (
        <span className={cn('flex items-center', size === 'xs' ? '-space-x-1' : '-space-x-1.5')} aria-label={`${people.length}명`}>
            {shown.map((person) => (
                <Avatar key={person.key} id={person.id} name={person.name} size={size} ring />
            ))}
            {rest > 0 && (
                <span className={cn('inline-flex items-center justify-center rounded-full font-semibold', ringCard, AVATAR_SIZE[size], selected)}>
                    {rest}+
                </span>
            )}
        </span>
    );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
    return <p className={cn('text-[11px] font-medium', sub, className)}>{children}</p>;
}

export function AddButton({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
    const className = 'inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground transition active:scale-95';
    if (href) {
        return (
            <Link href={href} aria-label={label} title={label} className={className}>
                <Plus size={18} strokeWidth={2.25} />
            </Link>
        );
    }
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
            <Plus size={18} strokeWidth={2.25} />
        </button>
    );
}

export function RoundIconButton({ label, onClick, children, disabled }: { label: string; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-30', line, ink)}
        >
            {children}
        </button>
    );
}

/** 레퍼런스의 "Today's Task ⌄" 형태 섹션 제목 */
export function SectionTitle({ title, badge, meta, action, className }: { title: string; badge?: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-center justify-between gap-3', className)}>
            <h2 className={cn('flex items-center gap-1.5 text-[17px] font-semibold tracking-tight', ink)}>
                {title}
                <ChevronDown size={16} className={sub} aria-hidden="true" />
                {badge}
            </h2>
            <div className="flex items-center gap-2">
                {meta && <span className={cn('text-xs', sub)}>{meta}</span>}
                {action}
            </div>
        </div>
    );
}

export function ScreenTitle({ eyebrow, title, trailing, aside }: { eyebrow?: ReactNode; title: ReactNode; trailing?: ReactNode; aside?: ReactNode }) {
    return (
        <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
                <h2 className={cn('mt-0.5 truncate text-[17px] font-semibold tracking-tight', ink)}>
                    {title}
                    {trailing && <span className={cn('ml-1.5 font-normal', sub)}>{trailing}</span>}
                </h2>
            </div>
            {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
        </header>
    );
}

export function KeyText({ from, to }: { from: string; to: string }) {
    if (!to) return <span>Key -</span>;
    if (!from || from === to) return <span>Key {to}</span>;
    return (
        <span>
            Key <span className="opacity-60">{from}</span>→<span className="font-semibold">{to}</span>
        </span>
    );
}

/** 아직 실제 데이터가 연결되지 않은 영역 표시 */
export function SampleChip({ className }: { className?: string }) {
    return (
        <span title="아직 실제 데이터가 연결되지 않은 샘플 화면입니다" className={cn('inline-flex h-5 items-center rounded-full px-2 align-middle text-[10px] font-medium', chip, sub, className)}>
            샘플
        </span>
    );
}
