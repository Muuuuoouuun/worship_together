import Link from 'next/link';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react';
import PageHeader, { PageBadge } from '@/components/ui/PageHeader';
import { buttonVariants } from '@/components/ui/button';
import { TONE_BLOCK, type Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface RouteAction {
    href: string;
    label: string;
}

interface RouteMetric {
    detail: string;
    label: string;
    value: string;
}

interface RouteSection {
    actionLabel?: string;
    description: string;
    href?: string;
    icon: LucideIcon;
    items: string[];
    title: string;
}

interface CommunityRoutePageProps {
    /** 메뉴 이름과 같은 짧은 제목 (예: '섬김') */
    title: string;
    /** 제목 아래 한 줄 설명 */
    description: string;
    /** 파스텔 요약 블록의 설명 문장 */
    summary: string;
    /** 요약 블록 색 (분류 색, components/ui/tones.ts) */
    tone?: Tone;
    metrics: RouteMetric[];
    primaryAction: RouteAction;
    secondaryAction?: RouteAction;
    sections: RouteSection[];
}

/**
 * /community · /care · /serve · /groups 가 함께 쓰는 화면.
 * 페이지 머리말 + 파스텔 요약 블록 하나 + 가는 선으로 나눈 행 목록 (콘티·순서 리디자인의 악기 담당 행과 같은 모양).
 * 아직 실제 데이터가 연결되지 않아 숫자는 모두 샘플입니다.
 */
export default function CommunityRoutePage({
    title,
    description,
    summary,
    tone = 'mint',
    metrics,
    primaryAction,
    secondaryAction,
    sections,
}: CommunityRoutePageProps) {
    return (
        <div className="space-y-7">
            <PageHeader
                title={title}
                badge={<PageBadge>샘플</PageBadge>}
                description={description}
                actions={
                    <>
                        {secondaryAction ? (
                            <Link href={secondaryAction.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                {secondaryAction.label}
                            </Link>
                        ) : null}
                        <Link href={primaryAction.href} className={buttonVariants({ size: 'sm' })}>
                            {primaryAction.label}
                            <ArrowRight aria-hidden="true" />
                        </Link>
                    </>
                }
            />

            <section aria-label="한눈에 보기" className={cn('rounded-3xl p-5 sm:p-6', TONE_BLOCK[tone])}>
                <p className="max-w-2xl text-sm leading-relaxed text-foreground/75">{summary}</p>
                <dl className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-3 sm:gap-6">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 sm:block">
                            <dt className="pt-0.5 text-xs font-medium text-muted-foreground sm:pt-0">{metric.label}</dt>
                            <dd className="min-w-0">
                                <span className="block text-[15px] font-semibold tabular-nums tracking-tight text-foreground sm:mt-0.5 sm:text-lg">{metric.value}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{metric.detail}</span>
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            <ul className="grid md:grid-cols-2 md:gap-x-10">
                {sections.map((section) => {
                    const Icon = section.icon;
                    const row = (
                        <div className="flex items-start gap-3.5 py-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                                <Icon size={18} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-[15px] font-medium text-foreground">{section.title}</h2>
                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                                <p className="mt-1.5 text-xs leading-relaxed text-foreground/75">{section.items.join(' · ')}</p>
                            </div>
                            {section.href && section.actionLabel ? (
                                <span className="mt-2.5 inline-flex shrink-0 items-center text-xs font-medium text-muted-foreground">
                                    <span className="sr-only sm:not-sr-only">{section.actionLabel}</span>
                                    <ChevronRight size={16} aria-hidden="true" />
                                </span>
                            ) : null}
                        </div>
                    );

                    return (
                        <li key={section.title} className="border-b border-border/70">
                            {section.href ? (
                                <Link href={section.href} className="-mx-2 block rounded-2xl px-2 transition-colors hover:bg-muted/60">
                                    {row}
                                </Link>
                            ) : (
                                row
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
