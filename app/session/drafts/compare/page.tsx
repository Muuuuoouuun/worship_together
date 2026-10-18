import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinalistShell from '@/components/session/drafts/finalists/FinalistShell';
import { COMPARE_ROWS, FINALISTS, RECOMMENDATION } from '@/components/session/drafts/finalists/versions';
import type { FinalistId, FinalistView } from '@/components/session/drafts/finalists/types';

export const metadata: Metadata = {
    title: '예배 중 화면 최종 후보 비교',
};

interface ComparePageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PHONE = 'h-[780px] w-[375px] overflow-hidden rounded-[2.75rem] bg-card shadow-[0_40px_80px_-32px_rgba(15,23,42,0.28)] ring-1 ring-border';
const BROWSER = 'h-[720px] w-full overflow-hidden rounded-3xl bg-card shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-border';

const MOBILE_ROWS: { view: FinalistView; caption: string; toasts: ('cue-all' | 'cue-role' | 'cue-sent' | 'offline' | 'team')[] }[] = [
    { view: 'main', caption: '기본 화면 · 받은 큐', toasts: ['cue-all'] },
    { view: 'pulse', caption: '펄스 화면 · 내 역할 큐', toasts: ['cue-role'] },
    { view: 'main', caption: '알림 여러 개 · 연결 끊김 · 보낸 큐', toasts: ['offline', 'cue-sent', 'cue-role'] },
];

export default async function ComparePage({ searchParams }: ComparePageProps) {
    const params = await searchParams;
    const v = params.v === 'a' || params.v === 'b' ? (params.v as FinalistId) : null;
    const device = params.device === 'desktop' ? 'desktop' : 'mobile';
    const view: FinalistView = params.view === 'pulse' ? 'pulse' : 'main';

    if (v) return <SingleView id={v} device={device} view={view} />;

    return (
        <main className="min-h-dvh bg-muted dark:bg-background">
            <div className="lg:hidden">
                <SingleView id="a" device="mobile" view="main" />
            </div>

            <div className="hidden px-10 pb-24 pt-12 lg:block">
                <header className="mx-auto max-w-[1280px]">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <Link href="/session/drafts" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <ChevronLeft size={14} />
                            예배 중 화면 시안
                        </Link>
                        <Link href="/session/drafts/pulse" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <ChevronLeft size={14} />
                            펄스 · 알림 시안
                        </Link>
                    </div>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">예배 중 화면 최종 후보 비교</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        지금까지의 시안을 두 가지 완성형으로 합쳤습니다. 같은 줄의 두 화면에는 같은 알림이 함께 뜹니다 — 틀 아래 버튼으로 알림을 보내 두 후보가 어떻게 다르게 보여 주는지 비교해 보세요.
                    </p>

                    <div className="mt-8 grid grid-cols-2 gap-6">
                        {FINALISTS.map((finalist) => (
                            <section key={finalist.id} aria-labelledby={`finalist-${finalist.id}`} className="rounded-3xl bg-card p-6 ring-1 ring-border">
                                <p className="text-xs text-muted-foreground">후보 {finalist.letter} · {finalist.tone}</p>
                                <h2 id={`finalist-${finalist.id}`} className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{finalist.title}</h2>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{finalist.summary}</p>
                                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-5 text-sm">
                                    {finalist.parts.map((part) => (
                                        <div key={part.label} className="flex items-baseline justify-between gap-3">
                                            <dt className="text-muted-foreground">{part.label}</dt>
                                            <dd className="font-medium text-foreground">{part.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <div className="mt-5 flex flex-wrap gap-2">
                                    {(['mobile', 'desktop'] as const).map((d) => (
                                        <Link
                                            key={d}
                                            href={`/session/drafts/compare?v=${finalist.id}&device=${d}`}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
                                        >
                                            {d === 'mobile' ? '모바일' : '데스크톱'} 한 화면
                                            <ArrowUpRight size={15} className="text-muted-foreground" />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </header>

                <section aria-labelledby="compare-mobile" className="mx-auto mt-20 max-w-[1280px]">
                    <h2 id="compare-mobile" className="text-lg font-semibold tracking-tight text-foreground">모바일</h2>
                    <div className="mt-8 space-y-20">
                        {MOBILE_ROWS.map((row) => (
                            <FinalistShell
                                key={`${row.view}-${row.toasts.join('-')}`}
                                ids={['a', 'b']}
                                device="mobile"
                                view={row.view}
                                framed
                                initialToasts={row.toasts}
                                layout="row"
                                frameClassName={PHONE}
                                caption={row.caption}
                            />
                        ))}
                    </div>
                </section>

                <section aria-labelledby="compare-desktop" className="mx-auto mt-24 max-w-[1280px]">
                    <h2 id="compare-desktop" className="text-lg font-semibold tracking-tight text-foreground">데스크톱</h2>
                    <div className="mt-8 space-y-20">
                        <FinalistShell ids={['a', 'b']} device="desktop" view="main" framed initialToasts={['team', 'cue-all']} layout="stack" frameClassName={BROWSER} caption="기본 화면 · 받은 큐와 팀 소식" />
                        <FinalistShell ids={['a', 'b']} device="desktop" view="pulse" framed initialToasts={['cue-role']} layout="stack" frameClassName={BROWSER} caption="펄스 화면 · 내 역할 큐" />
                    </div>
                </section>

                {COMPARE_ROWS.length > 0 ? (
                    <section aria-labelledby="compare-table" className="mx-auto mt-24 max-w-[1280px]">
                        <h2 id="compare-table" className="text-lg font-semibold tracking-tight text-foreground">한눈에 비교</h2>
                        <div className="mt-6 overflow-hidden rounded-3xl bg-card ring-1 ring-border">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                        <th scope="col" className="w-48 px-6 py-3.5 font-medium">기준</th>
                                        <th scope="col" className="px-6 py-3.5 font-medium">A · 밝은 따라가기</th>
                                        <th scope="col" className="px-6 py-3.5 font-medium">B · 어두운 무대</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARE_ROWS.map((row) => (
                                        <tr key={row.criterion} className="border-b border-border/70 last:border-b-0 align-top">
                                            <th scope="row" className="px-6 py-4 font-semibold text-foreground">{row.criterion}</th>
                                            {(['a', 'b'] as const).map((id) => (
                                                <td key={id} className={cn('px-6 py-4 leading-relaxed', row.better === id ? 'text-foreground' : 'text-muted-foreground')}>
                                                    {row.better === id ? <Check size={15} className="mr-1.5 inline -translate-y-px text-brand" aria-label="더 나음" /> : null}
                                                    {id === 'a' ? row.a : row.b}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {RECOMMENDATION.pick ? (
                            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground">
                                <span className="mr-2 inline-flex rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                                    추천 {RECOMMENDATION.pick === 'a' ? 'A' : 'B'}
                                </span>
                                {RECOMMENDATION.reason}
                            </p>
                        ) : null}
                    </section>
                ) : null}
            </div>
        </main>
    );
}

/** 후보 하나를 화면 가득. 위 막대에서 후보 · 기기 · 화면을 바꿉니다. */
function SingleView({ id, device, view }: { id: FinalistId; device: 'mobile' | 'desktop'; view: FinalistView }) {
    const finalist = FINALISTS.find((item) => item.id === id)!;
    const href = (next: { id?: FinalistId; device?: string; view?: FinalistView }) =>
        `/session/drafts/compare?v=${next.id ?? id}&device=${next.device ?? device}&view=${next.view ?? view}`;
    return (
        <div className="flex h-dvh flex-col bg-background">
            <nav aria-label="최종 후보" className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 text-xs [scrollbar-width:none]">
                <Link href="/session/drafts/compare" className="hidden shrink-0 rounded-full px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground lg:inline-flex">
                    비교 보기
                </Link>
                {FINALISTS.map((item) => (
                    <Link
                        key={item.id}
                        href={href({ id: item.id })}
                        aria-current={item.id === id ? 'page' : undefined}
                        className={cn('shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors', item.id === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                        {item.letter} · {item.title}
                    </Link>
                ))}
                <Link href={href({ device: device === 'mobile' ? 'desktop' : 'mobile' })} className="ml-auto shrink-0 rounded-full px-3 py-1.5 font-medium text-brand hover:underline">
                    {device === 'mobile' ? '데스크톱으로' : '모바일로'}
                </Link>
            </nav>
            <h1 className="sr-only">예배 중 화면 최종 후보 — {finalist.title}</h1>
            <div className="min-h-0 flex-1">
                <FinalistShell ids={[id]} device={device} view={view} layout="single" />
            </div>
        </div>
    );
}
