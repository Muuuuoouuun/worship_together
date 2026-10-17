import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_AVATAR, type Tone } from '@/components/ui/tones';
import { avatarLabel, toneForName } from './model';

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

/** 파스텔 분류 색은 components/ui/tones.ts 한 곳에서 정합니다. */
export { TONE_BLOCK, TONE_DOT, TONE_ICON } from '@/components/ui/tones';

const AVATAR_SIZE = {
    xs: 'size-5 text-[9px]',
    sm: 'size-7 text-[10px]',
    md: 'size-9 text-[11px]',
} as const;

/** 사진 대신 이름(성 제외 두 글자)으로 표시하는 아바타. 색은 이름에서 정하고, 필요하면 tone 으로 지정합니다. */
export function Avatar({ name, tone, size = 'sm', ring = false, className }: { name?: string | null; tone?: Tone; size?: keyof typeof AVATAR_SIZE; ring?: boolean; className?: string }) {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const label = avatarLabel(trimmed, size === 'xs');
    return (
        <span
            title={trimmed}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
                AVATAR_SIZE[size],
                TONE_AVATAR[tone ?? toneForName(trimmed)],
                ring && ringCard,
                className,
            )}
        >
            {label}
        </span>
    );
}

export function AvatarStack({ names = [], people = [], max = 3, size = 'sm' }: { names?: string[]; people?: { name?: string | null; tone?: Tone }[]; max?: number; size?: keyof typeof AVATAR_SIZE }) {
    const all = [...people, ...names.map((name) => ({ name, tone: undefined }))].filter((person): person is { name: string; tone: Tone | undefined } => Boolean(person.name?.trim()));
    const shown = all.slice(0, max);
    const rest = all.length - shown.length;
    return (
        <span className={cn('flex items-center', size === 'xs' ? '-space-x-1' : '-space-x-1.5')} aria-label={`${all.length}명`}>
            {shown.map((person, index) => (
                <Avatar key={`${person.name}:${index}`} name={person.name} tone={person.tone} size={size} ring />
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
