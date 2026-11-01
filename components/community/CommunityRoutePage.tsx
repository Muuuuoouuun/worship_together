import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import PageHeader, { PageBadge } from '@/components/ui/PageHeader';
import { TONE_BLOCK, type Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface NowLink {
    href: string;
    icon: LucideIcon;
    label: string;
    detail: string;
}

interface CommunityRoutePageProps {
    /** 메뉴 이름과 같은 짧은 제목 (예: '섬김') */
    title: string;
    /** 제목 아래 한 줄 설명 */
    description: string;
    /** 이 공간이 무엇이 될지 (준비 중) */
    plan: string;
    /** 준비 중인 것들 — 숫자나 예시 데이터 없이 이름만 */
    planned: string[];
    /** 지금 이 일을 할 수 있는 실제 화면 */
    now: NowLink[];
    /** 요약 블록 색 (분류 색, components/ui/tones.ts) */
    tone?: Tone;
}

/**
 * /community · /care · /serve · /groups 가 함께 쓰는 '준비 중' 화면.
 * 아직 실제 데이터가 없으므로 예시 숫자를 보여 주지 않고, 무엇을 준비하는지와 지금 같은 일을 할 수 있는 실제 화면을 잇습니다.
 */
export default function CommunityRoutePage({ title, description, plan, planned, now, tone = 'mint' }: CommunityRoutePageProps) {
    return (
        <div className="space-y-7">
            <PageHeader title={title} badge={<PageBadge>준비 중</PageBadge>} description={description} />

            <section aria-label="준비 중인 기능" className={cn('rounded-3xl p-5 sm:p-6', TONE_BLOCK[tone])}>
                <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">{plan}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5 border-t border-foreground/10 pt-4">
                    {planned.map((item) => (
                        <li key={item} className="inline-flex h-8 items-center rounded-full bg-card/70 px-3 text-xs font-medium text-foreground/80">{item}</li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="community-now">
                <h2 id="community-now" className="text-[17px] font-semibold tracking-tight text-foreground">지금은 여기서 할 수 있어요</h2>
                <ul className="mt-2 grid md:grid-cols-2 md:gap-x-10">
                    {now.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.href + item.label} className="border-b border-border/70">
                                <Link href={item.href} className="-mx-2 flex items-start gap-3.5 rounded-2xl px-2 py-4 transition-colors hover:bg-muted/60">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                                        <Icon size={18} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-medium text-foreground">{item.label}</span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                                    </span>
                                    <ChevronRight size={16} className="mt-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
