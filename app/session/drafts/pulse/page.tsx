import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import PulseDraftShell from '@/components/session/drafts/pulse/PulseDraftShell';
import { PULSE_DRAFTS, PULSE_DRAFT_IDS, type PulseDraftId, type PulseDraftVersion } from '@/components/session/drafts/pulse/versions';

export const metadata: Metadata = {
    title: '펄스 · 알림 디자인 시안',
};

interface PulseDraftsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PHONE = 'h-[780px] w-[375px] overflow-hidden rounded-[2.75rem] bg-card shadow-[0_40px_80px_-32px_rgba(15,23,42,0.28)] ring-1 ring-border';
const BROWSER = 'h-[720px] w-full overflow-hidden rounded-b-3xl bg-card';

export default async function PulseDraftsPage({ searchParams }: PulseDraftsPageProps) {
    const params = await searchParams;
    const requested = typeof params.v === 'string' ? params.v : '';
    const single = PULSE_DRAFT_IDS.has(requested as PulseDraftId) ? (requested as PulseDraftId) : null;
    const device = params.device === 'desktop' ? 'desktop' : 'mobile';

    if (single) return <SingleView id={single} device={device} />;

    return (
        <main className="min-h-dvh bg-muted dark:bg-background">
            {/* 휴대폰·태블릿: 1번 시안을 한 화면으로 */}
            <div className="lg:hidden">
                <SingleView id="1" device="mobile" />
            </div>

            <div className="hidden px-10 pb-24 pt-12 lg:block">
                <header className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-4">
                    <div>
                        <Link href="/session/drafts" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <ChevronLeft size={14} />
                            예배 중 화면 시안으로
                        </Link>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">펄스 · 앱 알림 리디자인</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            박자를 보여 주는 펄스 화면과, 큐 · 연결 상태 · 저장 · 팀 소식을 알리는 토스트를 한 세트로 세 가지 방향으로 그렸습니다. 박자는 실제 BPM 으로 움직이고, 틀 아래 버튼으로 알림을 직접 띄워 볼 수 있습니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/session/drafts/compare"
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-brand px-3.5 text-xs font-medium text-brand-foreground transition-opacity hover:opacity-90"
                        >
                            최종 후보 비교
                            <ArrowUpRight size={14} />
                        </Link>
                        <span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
                            목업 데이터 · 믿음으로 서리라 D · 72 BPM · 4/4
                        </span>
                    </div>
                </header>

                <div className="mx-auto mt-14 max-w-[1280px] space-y-28">
                    {PULSE_DRAFTS.map((draft) => (
                        <section key={draft.id} aria-labelledby={`pulse-draft-${draft.id}`}>
                            <DraftCaption draft={draft} />
                            <div className="mt-8 flex justify-center gap-10">
                                <figure>
                                    <PulseDraftShell draft={draft.id} device="mobile" framed initialToasts={['cue-all']} frameClassName={PHONE} />
                                    <figcaption className="mt-3 text-center text-xs text-muted-foreground">펄스 화면 · 받은 큐</figcaption>
                                </figure>
                                <figure>
                                    <PulseDraftShell draft={draft.id} device="mobile" framed initialToasts={['offline', 'cue-sent', 'cue-role']} frameClassName={PHONE} />
                                    <figcaption className="mt-3 text-center text-xs text-muted-foreground">알림 여러 개 · 연결 끊김 · 보낸 큐 · 내 역할 큐</figcaption>
                                </figure>
                            </div>
                            <figure className="mt-12">
                                <div className="overflow-hidden rounded-3xl shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-border">
                                    <BrowserBar />
                                    <PulseDraftShell draft={draft.id} device="desktop" framed initialToasts={['team', 'cue-all']} frameClassName={BROWSER} />
                                </div>
                                <figcaption className="mt-3 text-center text-xs text-muted-foreground">데스크톱 · 받은 큐와 팀 소식</figcaption>
                            </figure>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

function DraftCaption({ draft }: { draft: PulseDraftVersion }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
            <div className="max-w-3xl">
                <p className="text-xs text-muted-foreground">시안 {draft.id} · {draft.tone}</p>
                <h2 id={`pulse-draft-${draft.id}`} className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{draft.title}</h2>
                <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">펄스</dt>
                    <dd className="text-foreground">{draft.pulse}</dd>
                    <dt className="text-muted-foreground">알림</dt>
                    <dd className="text-foreground">{draft.toast}</dd>
                </dl>
                <ul className="mt-4 space-y-1.5 text-sm text-foreground">
                    {draft.points.map((point) => (
                        <li key={point} className="flex gap-2">
                            <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                            {point}
                        </li>
                    ))}
                </ul>
            </div>
            <div className="flex gap-2">
                {(['mobile', 'desktop'] as const).map((device) => (
                    <Link
                        key={device}
                        href={`/session/drafts/pulse?v=${draft.id}&device=${device}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-card"
                    >
                        {device === 'mobile' ? '모바일' : '데스크톱'} 한 화면
                        <ArrowUpRight size={15} className="text-muted-foreground" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

function BrowserBar() {
    return (
        <div aria-hidden="true" className="flex h-10 items-center gap-3 border-b border-border bg-muted/60 px-4">
            <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
            </span>
            <span className="mx-auto w-80 truncate rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted-foreground ring-1 ring-border">
                worship-together · 펄스 화면
            </span>
            <span className="w-12" />
        </div>
    );
}

/** 시안 하나를 화면 가득. 맨 위 막대에서 시안·기기를 바꾸고, 그 아래 막대에서 알림을 띄웁니다. */
function SingleView({ id, device }: { id: PulseDraftId; device: 'mobile' | 'desktop' }) {
    const draft = PULSE_DRAFTS.find((item) => item.id === id)!;
    return (
        <div className="flex h-dvh flex-col bg-background">
            <nav aria-label="펄스 · 알림 디자인 시안" className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 text-xs [scrollbar-width:none]">
                <Link href="/session/drafts/pulse" className="hidden shrink-0 rounded-full px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground lg:inline-flex">
                    전체 보기
                </Link>
                {PULSE_DRAFTS.map((item) => {
                    const active = item.id === id;
                    return (
                        <Link
                            key={item.id}
                            href={`/session/drafts/pulse?v=${item.id}&device=${device}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn('shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {item.id} · {item.title}
                        </Link>
                    );
                })}
                <Link
                    href={`/session/drafts/pulse?v=${id}&device=${device === 'mobile' ? 'desktop' : 'mobile'}`}
                    className="ml-auto shrink-0 rounded-full px-3 py-1.5 font-medium text-brand hover:underline"
                >
                    {device === 'mobile' ? '데스크톱으로' : '모바일로'}
                </Link>
            </nav>
            <h1 className="sr-only">펄스 · 알림 디자인 시안 — {draft.title}</h1>
            <div className="min-h-0 flex-1">
                <PulseDraftShell draft={id} device={device} placement="top" />
            </div>
        </div>
    );
}
