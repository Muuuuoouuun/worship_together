import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: ReactNode;
    /** 제목 위의 작은 회색 글씨 (예: '10월 셋째 주', '팀') */
    eyebrow?: ReactNode;
    /** 제목 옆의 작은 표시 (예: 목업, 샘플) */
    badge?: ReactNode;
    description?: ReactNode;
    back?: { href: string; label: string };
    /** 오른쪽 버튼·선택 상자 */
    actions?: ReactNode;
    as?: 'h1' | 'h2';
    className?: string;
}

/**
 * 모든 화면이 같은 모양으로 쓰는 페이지 머리말.
 * 콘티·악보 리디자인의 화면 제목과 같은 규칙: 작은 회색 머리글 + 굵지 않은 산세리프 제목 + 짧은 설명.
 */
export default function PageHeader({ title, eyebrow, badge, description, back, actions, as: Heading = 'h1', className }: PageHeaderProps) {
    return (
        <header className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
            <div className="min-w-0">
                {back && (
                    <Link href={back.href} className="-ml-1 mb-1 inline-flex min-h-9 items-center gap-0.5 rounded-full pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                        <ChevronLeft size={15} aria-hidden="true" />
                        {back.label}
                    </Link>
                )}
                {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
                <Heading className={cn('flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-foreground', eyebrow && 'mt-0.5')}>
                    {title}
                    {badge}
                </Heading>
                {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

/** 제목 옆에 붙는 작은 회색 표시 */
export function PageBadge({ children }: { children: ReactNode }) {
    return <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{children}</span>;
}
