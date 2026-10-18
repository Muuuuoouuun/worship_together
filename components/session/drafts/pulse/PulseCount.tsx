'use client';

import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from 'react';
import Link from 'next/link';
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    CircleAlert,
    Ellipsis,
    Maximize2,
    Megaphone,
    Minimize2,
    SunMedium,
    Wifi,
    WifiOff,
    X,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar } from '@/components/conti/ui';
import { DRAFT_SONGS, useMockLive, type MockLive } from '../mockLive';
import { useMockPulse } from './useMockPulse';
import type { DraftToast, ToastKind, ToastUrgency } from './toastDemo';
import type { PulseDraftProps } from './types';

/*
 * 시안 1 · 숫자 박자 (밝은 화면, 앱 테마를 따름)
 * - 펄스: 아주 큰 박 숫자 하나가 주인공. 센박(1)만 진한 잉크, 나머지 박은 회색이라 멀리서도 '1'이 보입니다.
 *   그 아래 박 막대(지금 박 = 검정 알약, 1박은 늘 테두리 + 넓게), 한 줄 메타(BPM · 박자표 · 마디 n/N), 섹션 진행 선.
 * - 알림은 자리로 종류를 나눕니다.
 *   · 연주 큐(받은 큐·보낸 큐)는 위 가운데 검정 '아일랜드' — 급한 큐는 크게 펼쳤다가 작은 알약으로 접힘, 여러 개면 +N.
 *   · 앱 알림(저장·오류·팀 소식·연결)은 아래 가운데 흰 카드 — 넘김 버튼 위 비워 둔 자리에 겹쳐 쌓임.
 */

const CUE_KINDS = new Set<ToastKind>(['cue-all', 'cue-role', 'cue-sent']);

/** 펼친 아일랜드가 다시 작은 알약으로 접히기까지 */
const EXPAND_MS: Record<ToastUrgency, number> = { high: 3200, normal: 2400, low: 2000 };

const QUICK_CUES: { label: string; target: string }[] = [
    { label: '한 번 더', target: '전체' },
    { label: '빨라요', target: '악기' },
    { label: '느려요', target: '악기' },
    { label: '엔딩 컷', target: '전체' },
];

const CUE_KIND_LABEL: Partial<Record<ToastKind, string>> = {
    'cue-all': '전체 큐',
    'cue-role': '내 역할 큐',
    'cue-sent': '보낸 큐',
};

/** 앱 알림의 아이콘·색. 끈질긴 알림(연결 끊김·오류)은 토큰 색 테두리와 아이콘으로 구분합니다. */
const NOTICE_LOOK: Partial<Record<ToastKind, { icon: LucideIcon; tile: string; ring: string }>> = {
    offline: { icon: WifiOff, tile: 'bg-warning/10 text-warning', ring: 'ring-warning/40' },
    online: { icon: Wifi, tile: 'bg-success/10 text-success', ring: 'ring-border' },
    saved: { icon: Check, tile: 'bg-muted text-foreground', ring: 'ring-border' },
    error: { icon: CircleAlert, tile: 'bg-destructive/10 text-destructive', ring: 'ring-destructive/40' },
};

const ELAPSED_START = 12 * 60 + 48;

function describe(toast: DraftToast) {
    const who = toast.kind === 'cue-sent' ? '' : toast.from && toast.target ? `${toast.from}에서 ${toast.target}에게` : toast.from ?? '';
    return [CUE_KIND_LABEL[toast.kind], toast.title, toast.body, who].filter(Boolean).join(', ');
}

function sendPath(toast: DraftToast) {
    if (toast.from && toast.target) return `${toast.from} → ${toast.target}`;
    return toast.from ?? toast.target ?? '';
}

export default function PulseCount({ device, framed = false, toasts, onDismiss, onAck, onAction, onSendCue }: PulseDraftProps) {
    const live = useMockLive();
    const screen = useScreenToggles(framed);
    const desktop = device === 'desktop';
    const cues = toasts.filter((toast) => CUE_KINDS.has(toast.kind));
    const notices = toasts.filter((toast) => !CUE_KINDS.has(toast.kind));

    const offline = notices.some((toast) => toast.kind === 'offline');
    const island = <CueIsland cues={cues} desktop={desktop} offline={offline} onAck={onAck} onDismiss={onDismiss} />;
    const dock = (
        <DockZone open={notices.length > 0} desktop={desktop}>
            <NoticeDock notices={notices} desktop={desktop} onAction={onAction} onDismiss={onDismiss} />
        </DockZone>
    );

    return (
        <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
            {desktop ? (
                <DesktopLayout live={live} screen={screen} island={island} dock={dock} onSendCue={onSendCue} />
            ) : (
                <MobileLayout live={live} screen={screen} framed={framed} island={island} dock={dock} onSendCue={onSendCue} />
            )}
            <Announcer toasts={toasts} />
        </div>
    );
}

/* ───────────── 배치: 모바일 ───────────── */

interface LayoutProps {
    live: MockLive;
    screen: ScreenToggles;
    island: ReactNode;
    dock: ReactNode;
    onSendCue: (label: string, target: string) => void;
}

function MobileLayout({ live, screen, framed, island, dock, onSendCue }: LayoutProps & { framed: boolean }) {
    const atStart = live.sectionIndex === 0 && live.songIndex === 0;
    const atEnd = live.nextSection === null && live.nextSong === null;

    return (
        <div className="group/screen flex h-full flex-col">
            {/* 위: 뒤로 · 아일랜드 · 화면 — 아일랜드는 이 줄 가운데에 살고, 펼치면 아래로 겹칩니다 */}
            <header className={cn('relative z-30 shrink-0 px-2', framed ? 'pt-4' : 'pt-[max(env(safe-area-inset-top),0.375rem)]')}>
                <div className="relative flex h-12 items-center justify-between">
                    <Link href="/session/drafts" aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                        <ChevronLeft className="size-[22px]" aria-hidden="true" />
                    </Link>
                    {island}
                    <ScreenMenu screen={screen} />
                </div>
            </header>

            <SongSwitch live={live} />

            <div className="flex min-h-0 flex-1 flex-col px-5 pt-1">
                <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} bars={barsOf(live)} />
            </div>

            <SectionNow live={live} />

            {/* 앱 알림 자리 — 알림이 오면 이 줄이 열리고 박 숫자가 그만큼 비켜 줍니다. 넘김·큐 버튼은 가리지 않습니다 */}
            {dock}

            <div className={cn('shrink-0 px-4 pt-4', framed ? 'pb-6' : 'pb-[max(env(safe-area-inset-bottom),0.875rem)]')}>
                <div role="group" aria-label="큐 보내기" className="flex items-center gap-1.5">
                    <Megaphone className="mx-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {QUICK_CUES.map((cue) => (
                        <button
                            key={cue.label}
                            type="button"
                            onClick={() => onSendCue(cue.label, cue.target)}
                            aria-label={`${cue.label} 큐를 ${cue.target}에게 보내기`}
                            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-11 min-w-0 flex-1 px-1 text-[13px]')}
                        >
                            {cue.label}
                        </button>
                    ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={live.prevSectionStep}
                        disabled={atStart}
                        aria-label="이전 섹션"
                        className={cn(buttonVariants({ variant: 'outline' }), 'size-14 shrink-0 flex-col gap-0 px-0 text-[11px] font-medium has-[>svg]:px-0')}
                    >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                        이전
                    </button>
                    <button
                        type="button"
                        onClick={live.nextSectionStep}
                        disabled={atEnd}
                        className={cn(buttonVariants({ size: 'lg' }), 'h-14 min-w-0 flex-1 justify-between gap-3 pl-6 pr-4 text-[17px] has-[>svg]:pr-4')}
                    >
                        <span className="flex min-w-0 flex-col items-start leading-tight">
                            <span>{live.nextSection ? '다음 섹션' : live.nextSong ? '다음 곡' : '마지막 섹션'}</span>
                            <span className="max-w-full truncate text-xs font-medium text-primary-foreground/60">{live.nextSection ?? live.nextSong?.title ?? '예배 마무리'}</span>
                        </span>
                        <ChevronRight className="size-6" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function SectionNow({ live }: { live: MockLive }) {
    const next = live.nextSection ?? live.nextSong?.title ?? null;
    return (
        // 두 줄 격자: 눈썹(지금 · 다음)끼리, 이름(Chorus · Verse 2)끼리 같은 기준선에 섭니다
        <section aria-label="섹션" className="grid shrink-0 grid-cols-[minmax(0,auto)_minmax(0,auto)] items-baseline justify-between gap-x-4 px-5 pt-5">
            <p className="text-xs font-medium text-muted-foreground">
                지금 <span className="tabular-nums">· {live.sectionIndex + 1}/{live.song.form.length}</span>
            </p>
            <p className="text-right text-xs font-medium text-muted-foreground">{live.nextSection ? '다음' : live.nextSong ? '다음 곡' : '끝'}</p>
            <h2 className="mt-1 truncate text-[44px] font-semibold leading-[1.05] tracking-tight [@media(max-height:700px)]:text-[40px]">{live.section}</h2>
            <p className="mt-1 truncate text-right text-xl font-semibold tracking-tight text-muted-foreground">{next ?? '예배 마무리'}</p>
        </section>
    );
}

/* ───────────── 배치: 데스크톱 (무대 모니터) ───────────── */

function DesktopLayout({ live, screen, island, dock, onSendCue }: LayoutProps) {
    const atStart = live.sectionIndex === 0 && live.songIndex === 0;
    const atEnd = live.nextSection === null && live.nextSong === null;
    const next = live.nextSection ?? live.nextSong?.title ?? null;
    const lyric = live.song.lyrics[live.section];

    return (
        <div className="flex h-full flex-col">
            <header className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
                <Link href="/session/drafts" aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                    <ChevronLeft className="size-5" aria-hidden="true" />
                </Link>
                <SongSwitch live={live} desktop />
                {island}
                <div className="ml-auto flex items-center gap-1">
                    <IconToggle label="화면 꺼짐 방지" pressed={screen.awake} onClick={screen.toggleAwake}>
                        <SunMedium className="size-[18px]" aria-hidden="true" />
                    </IconToggle>
                    <IconToggle label="전체화면" pressed={screen.fullscreen} onClick={screen.toggleFullscreen}>
                        {screen.fullscreen ? <Minimize2 className="size-[18px]" aria-hidden="true" /> : <Maximize2 className="size-[18px]" aria-hidden="true" />}
                    </IconToggle>
                </div>
            </header>

            <main className="grid min-h-0 flex-1 grid-cols-2 gap-x-16 px-12 pb-8 pt-6">
                <div className="flex min-h-0 flex-col">
                    <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} bars={barsOf(live)} desktop />
                </div>

                <section aria-label="섹션" className="flex min-h-0 min-w-0 flex-col justify-center [container-type:inline-size]">
                    <p className="text-sm font-medium text-muted-foreground">
                        지금 <span className="tabular-nums">· 섹션 {live.sectionIndex + 1} / {live.song.form.length}</span>
                    </p>
                    <h2 className="mt-2 truncate text-[length:min(17cqi,128px)] font-semibold leading-none tracking-tight">{live.section}</h2>
                    {lyric ? <p className="mt-4 truncate text-xl text-muted-foreground">{lyric}</p> : null}
                    <div className="mt-8 flex items-baseline gap-4 border-t border-border pt-6">
                        <span className="w-12 shrink-0 text-sm font-medium text-muted-foreground">{live.nextSection ? '다음' : live.nextSong ? '다음 곡' : '끝'}</span>
                        <span className="min-w-0 truncate text-4xl font-semibold tracking-tight text-muted-foreground">{next ?? '예배 마무리'}</span>
                    </div>
                    <ol aria-label="송폼" className="mt-6 flex flex-wrap gap-1">
                        {live.song.form.map((name, index) => {
                            const current = index === live.sectionIndex;
                            return (
                                <li key={`${name}-${index}`}>
                                    <button
                                        type="button"
                                        aria-current={current ? 'step' : undefined}
                                        onClick={() => live.goSection(index)}
                                        className={cn(
                                            'h-9 rounded-full px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                            current ? 'bg-primary text-primary-foreground' : index < live.sectionIndex ? 'text-muted-foreground hover:bg-muted' : 'text-foreground ring-1 ring-inset ring-border hover:bg-muted',
                                        )}
                                    >
                                        {name}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            </main>

            {/* 앱 알림 — 아래 가운데, 넘김 줄 바로 위. 알림이 오면 이 줄이 열립니다 */}
            {dock}

            <footer className="flex h-[88px] shrink-0 items-center gap-3 border-t border-border px-6">
                <button
                    type="button"
                    onClick={live.prevSectionStep}
                    disabled={atStart}
                    className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 pl-4 pr-5 has-[>svg]:pl-4')}
                >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                    이전 섹션
                </button>
                <button
                    type="button"
                    onClick={live.nextSectionStep}
                    disabled={atEnd}
                    className={cn(buttonVariants({ size: 'lg' }), 'h-14 min-w-[232px] justify-between gap-6 pl-6 pr-4 has-[>svg]:pr-4')}
                >
                    <span className="flex flex-col items-start leading-tight">
                        <span>{live.nextSection ? '다음 섹션' : live.nextSong ? '다음 곡' : '마지막 섹션'}</span>
                        <span className="text-xs font-medium text-primary-foreground/60">{next ?? '예배 마무리'}</span>
                    </span>
                    <ChevronRight className="size-5" aria-hidden="true" />
                </button>
                <div role="group" aria-label="큐 보내기" className="ml-auto flex items-center gap-2">
                    <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Megaphone className="size-4" aria-hidden="true" />
                        큐
                    </span>
                    {QUICK_CUES.map((cue) => (
                        <button
                            key={cue.label}
                            type="button"
                            onClick={() => onSendCue(cue.label, cue.target)}
                            aria-label={`${cue.label} 큐를 ${cue.target}에게 보내기`}
                            className={cn(buttonVariants({ variant: 'outline' }), 'h-12 flex-col gap-0 px-4 leading-tight')}
                        >
                            <span>{cue.label}</span>
                            <span className="text-[11px] font-medium text-muted-foreground">{cue.target}</span>
                        </button>
                    ))}
                </div>
            </footer>
        </div>
    );
}

function barsOf(live: MockLive) {
    return Math.max(1, live.song.chords[live.section]?.length ?? 8);
}

/* ───────────── 펄스: 큰 박 숫자 · 박 막대 · 마디 ───────────── */

/** 박마다 두 번 다시 그려지는 유일한 부분 — 숫자·막대·마디만 여기서 그립니다 */
function BeatHero({ bpm, meter, resetKey, bars, desktop = false }: { bpm: number; meter: string; resetKey: string; bars: number; desktop?: boolean }) {
    const pulse = useMockPulse({ bpm, meter, resetKey });
    const count = pulse.count || 1;
    const started = pulse.count > 0;
    const bar = ((pulse.bar - 1) % bars) + 1;
    const loop = Math.floor((pulse.bar - 1) / bars);
    const progress = started ? ((bar - 1) * pulse.beatsPerBar + count) / (bars * pulse.beatsPerBar) : 0;
    const strength = pulse.downbeat || !started ? 'strong' : pulse.secondary ? 'mid' : 'weak';

    return (
        <>
            <p className="sr-only">
                박자 {bpm} BPM, {meter}, 이 섹션 {bars}마디
            </p>
            <div aria-hidden="true" className="pointer-events-none relative flex min-h-0 flex-1 select-none items-center justify-center [container-type:size]">
                <span
                    className={cn(
                        'block font-semibold leading-[0.76] tracking-tighter tabular-nums transition-[transform,color] duration-150 ease-out motion-reduce:transition-none',
                        desktop ? 'text-[length:min(128cqh,100cqw)]' : 'text-[length:min(112cqh,124cqw)]',
                        strength === 'strong' ? 'text-foreground' : strength === 'mid' ? 'text-foreground/70' : 'text-muted-foreground',
                        pulse.blink && (pulse.downbeat ? 'motion-safe:scale-[1.06]' : 'motion-safe:scale-[1.025]'),
                    )}
                >
                    {count}
                </span>
            </div>

            <BeatSegments count={started ? count : 0} beatsPerBar={pulse.beatsPerBar} blink={pulse.blink} desktop={desktop} />

            <div className={cn('flex items-baseline justify-between gap-4 text-muted-foreground', desktop ? 'mt-6 text-lg' : 'mt-4 text-sm')}>
                <p>
                    <span className="font-semibold tabular-nums text-foreground">{bpm}</span> BPM
                    <span className="mx-2 text-border" aria-hidden="true">
                        |
                    </span>
                    <span className="font-medium text-foreground">{meter}</span>
                </p>
                <p aria-hidden="true">
                    마디 <span className="font-semibold tabular-nums text-foreground">{bar}</span>
                    <span className="tabular-nums"> / {bars}</span>
                </p>
            </div>
            <div aria-hidden="true" className={cn('relative h-0.5 shrink-0 overflow-hidden rounded-full bg-border', desktop ? 'mt-3' : 'mt-2.5')}>
                <span
                    key={`${resetKey}-${loop}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] ease-linear motion-reduce:transition-none"
                    style={{ width: `${progress * 100}%`, transitionDuration: `${pulse.intervalMs}ms` }}
                />
            </div>
        </>
    );
}

/** 한 마디의 박 막대. 4/4 → 4칸, 6/8 → 3+3 으로 묶은 6칸. 1박은 넓고 늘 테두리, 6/8 의 4박은 옅은 테두리 */
function BeatSegments({ count, beatsPerBar, blink, desktop }: { count: number; beatsPerBar: number; blink: boolean; desktop: boolean }) {
    const beats = Array.from({ length: beatsPerBar }, (_, index) => index + 1);
    const groups = beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];

    return (
        <div aria-hidden="true" className={cn('flex shrink-0 items-center', beatsPerBar === 6 ? (desktop ? 'gap-6' : 'gap-4') : '', desktop ? 'mt-6' : 'mt-3')}>
            {groups.map((group) => (
                <div key={group[0]} className={cn('flex min-w-0 flex-1 items-center', desktop ? 'gap-2' : 'gap-1.5')}>
                    {group.map((beat) => {
                        const on = beat === count;
                        const down = beat === 1;
                        const mid = beatsPerBar === 6 && beat === 4;
                        return (
                            <span
                                key={beat}
                                className={cn(
                                    'block rounded-full transition-[transform,background-color] duration-100 motion-reduce:transition-none',
                                    desktop ? (beatsPerBar === 6 ? 'h-4' : 'h-5') : beatsPerBar === 6 ? 'h-2.5' : 'h-3',
                                    down ? 'flex-[1.7]' : mid ? 'flex-[1.3]' : 'flex-1',
                                    on ? 'bg-primary' : down ? 'ring-2 ring-inset ring-foreground' : mid ? 'ring-[1.5px] ring-inset ring-foreground/45' : 'bg-foreground/10',
                                    on && blink && 'motion-safe:scale-y-[1.35]',
                                )}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/* ───────────── 곡 바꾸기 ───────────── */

function SongSwitch({ live, desktop = false }: { live: MockLive; desktop?: boolean }) {
    const [open, setOpen] = useState(false);
    const wrap = useOutsideClose(open, () => setOpen(false));
    const { song } = live;

    return (
        <div
            ref={wrap}
            className={cn(
                'relative min-w-0',
                desktop
                    ? 'flex items-center gap-3'
                    : // 아일랜드가 펼쳐진 동안에는 곡 줄이 잠시 물러납니다 (펼친 알약이 글자 반을 가리지 않게)
                      'shrink-0 px-5 pt-1 transition-opacity duration-200 group-has-[[data-island-open]]/screen:pointer-events-none group-has-[[data-island-open]]/screen:opacity-0 motion-reduce:transition-none',
            )}
        >
            <div className={cn('flex min-w-0 items-center', desktop ? 'gap-3' : 'justify-between gap-3')}>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => setOpen((value) => !value)}
                    className={cn(
                        '-ml-2 inline-flex min-w-0 items-center gap-1 rounded-full px-2 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring',
                        desktop ? 'h-11' : 'h-10',
                    )}
                >
                    <span className="sr-only">곡 바꾸기, 지금 곡 </span>
                    <span className={cn('truncate font-semibold tracking-tight', desktop ? 'text-xl' : 'text-[19px]')}>{song.title}</span>
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>
                <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-sm font-semibold text-foreground">
                        <span className="mr-1 text-[11px] font-medium text-muted-foreground">Key</span>
                        {song.key}
                    </span>
                    <span className="tabular-nums">
                        {live.songIndex + 1}/{live.songs.length}곡
                    </span>
                </span>
            </div>

            {open ? (
                <div
                    role="listbox"
                    aria-label="곡 바꾸기"
                    className={cn(
                        'absolute top-full z-50 mt-2 w-[min(320px,calc(100vw-24px))] rounded-3xl bg-card p-2 text-card-foreground shadow-xl shadow-foreground/10 ring-1 ring-border animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none',
                        desktop ? '-left-2 origin-top-left' : 'left-3 origin-top-left',
                    )}
                >
                    <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">곡 바꾸기</p>
                    {DRAFT_SONGS.map((item, index) => {
                        const current = index === live.songIndex;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="option"
                                aria-selected={current}
                                onClick={() => {
                                    if (!current) live.goSong(index);
                                    setOpen(false);
                                }}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                    current ? 'bg-muted' : 'hover:bg-muted/60',
                                )}
                            >
                                <span className="w-4 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold">{item.title}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        Key {item.key} · {item.bpm} BPM · <span className={cn(item.meter !== '4/4' && 'font-semibold text-foreground')}>{item.meter}</span>
                                    </span>
                                </span>
                                {current ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

/* ───────────── 화면 동작 (전체화면 · 화면 꺼짐 방지) ───────────── */

interface ScreenToggles {
    awake: boolean;
    fullscreen: boolean;
    toggleAwake: () => void;
    toggleFullscreen: () => void;
}

/** 갤러리 틀(framed) 안에서는 상태만 바꾸고, 한 화면 보기에서는 실제 기기 기능을 씁니다 */
function useScreenToggles(framed: boolean): ScreenToggles {
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        if (framed) return;
        const sync = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => {
            document.removeEventListener('fullscreenchange', sync);
            wakeLock.current?.release().catch(() => undefined);
            wakeLock.current = null;
        };
    }, [framed]);

    function toggleAwake() {
        const next = !awake;
        setAwake(next);
        if (framed) return;
        if (next) {
            navigator.wakeLock
                ?.request('screen')
                .then((sentinel) => {
                    wakeLock.current = sentinel;
                })
                .catch(() => setAwake(false));
        } else {
            wakeLock.current?.release().catch(() => undefined);
            wakeLock.current = null;
        }
    }

    function toggleFullscreen() {
        if (framed) {
            setFullscreen((value) => !value);
            return;
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
        else document.documentElement.requestFullscreen?.().catch(() => undefined);
    }

    return { awake, fullscreen, toggleAwake, toggleFullscreen };
}

function IconToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cn(buttonVariants({ variant: pressed ? 'default' : 'ghost', size: 'icon' }), !pressed && 'text-muted-foreground')}
        >
            {children}
        </button>
    );
}

/** 모바일: 위 오른쪽 더보기 → 화면 동작 두 개 */
function ScreenMenu({ screen }: { screen: ScreenToggles }) {
    const [open, setOpen] = useState(false);
    const wrap = useOutsideClose(open, () => setOpen(false));
    const on = screen.awake || screen.fullscreen;
    const rows: { label: string; hint: string; icon: LucideIcon; pressed: boolean; onClick: () => void }[] = [
        { label: '화면 꺼짐 방지', hint: '예배 중 화면을 켜 둡니다', icon: SunMedium, pressed: screen.awake, onClick: screen.toggleAwake },
        { label: '전체화면', hint: '주소창을 숨깁니다', icon: screen.fullscreen ? Minimize2 : Maximize2, pressed: screen.fullscreen, onClick: screen.toggleFullscreen },
    ];

    return (
        <div ref={wrap} className="relative">
            <button
                type="button"
                aria-label="화면 설정"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative text-muted-foreground')}
            >
                <Ellipsis className="size-5" aria-hidden="true" />
                {on ? <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-brand" /> : null}
            </button>
            {open ? (
                <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-3xl bg-card p-2 text-card-foreground shadow-xl shadow-foreground/10 ring-1 ring-border animate-in fade-in zoom-in-95 duration-150 origin-top-right motion-reduce:animate-none">
                    <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">화면</p>
                    {rows.map((row) => (
                        <button
                            key={row.label}
                            type="button"
                            role="switch"
                            aria-checked={row.pressed}
                            onClick={row.onClick}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                <row.icon className="size-[18px]" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{row.label}</span>
                                <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>
                            </span>
                            <span aria-hidden="true" className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', row.pressed ? 'bg-primary' : 'bg-foreground/15')}>
                                <span className={cn('absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-[left]', row.pressed ? 'left-[18px]' : 'left-0.5')} />
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/* ───────────── 알림 ①: 위 가운데 큐 아일랜드 ───────────── */

type IslandMode = 'idle' | 'compact' | 'medium' | 'large' | 'list';

function CueIsland({ cues, desktop, offline, onAck, onDismiss }: { cues: DraftToast[]; desktop: boolean; offline: boolean; onAck: (id: string) => void; onDismiss: (id: string) => void }) {
    const [known, setKnown] = useState('');
    const [focusId, setFocusId] = useState<string | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const swipeStart = useRef<number | null>(null);

    // 새로 온 받은 큐는 크게 펼칩니다 (렌더 중 상태 맞추기 — 효과 대신)
    const idsKey = cues.map((cue) => cue.id).join(' ');
    if (idsKey !== known) {
        const before = new Set(known.split(' '));
        const fresh = cues.find((cue) => !before.has(cue.id) && cue.urgency !== 'low' && cue.ackable && !cue.acked);
        setKnown(idsKey);
        if (fresh) {
            setFocusId(fresh.id);
            setListOpen(false);
        }
        if (cues.length < 2) setListOpen(false);
    }

    const focused = focusId ? cues.find((cue) => cue.id === focusId) ?? null : null;
    const mode: IslandMode = cues.length === 0 ? 'idle' : listOpen && cues.length > 1 ? 'list' : focused ? (focused.urgency === 'high' ? 'large' : 'medium') : 'compact';
    const focusedUrgency = focused?.urgency;
    const wrap = useOutsideClose(mode === 'list', () => setListOpen(false));

    // 펼친 큐는 잠시 뒤 작은 알약으로 접힙니다. 마우스가 올라가 있거나 키보드 포커스가 안에 있으면 그동안만 기다립니다.
    // (접을 때마다 지금 상태를 확인 — 터치 뒤 남은 hover·포커스 때문에 큰 카드가 박자를 계속 가리지 않게)
    useEffect(() => {
        if (!focusId || !focusedUrgency) return;
        let timer: ReturnType<typeof setTimeout>;
        const fold = () => {
            const node = wrap.current;
            const hovered = node !== null && window.matchMedia('(hover: hover)').matches && node.matches(':hover');
            const keyboard = node !== null && node.querySelector(':focus-visible') !== null;
            if (hovered || keyboard) timer = setTimeout(fold, 600);
            else setFocusId(null);
        };
        timer = setTimeout(fold, EXPAND_MS[focusedUrgency]);
        return () => clearTimeout(timer);
    }, [focusId, focusedUrgency, wrap]);

    useEffect(() => {
        if (mode !== 'list' && mode !== 'large' && mode !== 'medium') return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setListOpen(false);
            setFocusId(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mode]);

    function collapse() {
        setListOpen(false);
        setFocusId(null);
    }

    // 펼친 아일랜드를 위로 밀면 접힙니다
    const swipe = {
        onPointerDown: (event: ReactPointerEvent) => {
            swipeStart.current = event.clientY;
        },
        onPointerUp: (event: ReactPointerEvent) => {
            if (swipeStart.current !== null && event.clientY - swipeStart.current < -28) collapse();
            swipeStart.current = null;
        },
        onPointerCancel: () => {
            swipeStart.current = null;
        },
    };

    // 접힌 알약의 얼굴: 아직 확인 안 한 받은 큐(급한 것 먼저)가 있으면 그 큐 — 바로 '확인'을 누를 수 있게. 없으면 가장 새 큐.
    const pending = cues.filter((cue) => cue.ackable && !cue.acked);
    const face = pending.find((cue) => cue.urgency === 'high') ?? pending[0] ?? cues[0];
    const more = cues.length - 1;
    const hiddenUnacked = pending.some((cue) => cue !== face);

    return (
        <div
            ref={wrap}
            data-island={mode}
            data-island-open={mode === 'medium' || mode === 'large' || mode === 'list' ? '' : undefined}
            className={cn(
                'absolute left-1/2 top-1.5 z-10 -translate-x-1/2',
                mode === 'idle' && 'top-1/2 -translate-y-1/2',
                mode === 'compact' && (desktop ? 'top-3 max-w-[min(480px,calc(100%-720px))]' : 'max-w-[calc(100%-112px)]'),
                (mode === 'medium' || mode === 'list') && (desktop ? 'top-3 w-[440px]' : 'w-[calc(100%-8px)] max-w-[400px]'),
                mode === 'large' && (desktop ? 'top-3 w-[480px]' : 'w-[calc(100%-8px)] max-w-[400px]'),
            )}
        >
            {mode === 'idle' ? <IdleStatus offline={offline} /> : null}

            {mode === 'compact' && face ? (
                <div
                    key={face.id}
                    className={cn(
                        'flex items-center gap-1 rounded-full bg-primary p-1 text-primary-foreground shadow-lg shadow-foreground/15 animate-in fade-in zoom-in-90 duration-200 motion-reduce:animate-none',
                        desktop ? 'h-11' : 'h-10',
                    )}
                >
                    <button
                        type="button"
                        aria-expanded={false}
                        aria-label={more > 0 ? `큐 ${cues.length}개 모두 보기 — ${face.title}` : `${face.title} 큐 펼치기`}
                        onClick={() => (more > 0 ? setListOpen(true) : setFocusId(face.id))}
                        className="flex h-full min-w-0 items-center gap-2 rounded-full pl-2.5 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                    >
                        <CueLead cue={face} />
                        <span className={cn('min-w-0 max-w-40 shrink-0 truncate font-semibold', desktop ? 'text-sm' : 'text-[13px]')}>{face.title}</span>
                        {face.progress ? (
                            <span className="shrink-0 text-xs tabular-nums text-primary-foreground/60">
                                {face.progress.done}/{face.progress.total}
                            </span>
                        ) : face.from && (desktop || more === 0 || !face.ackable || face.acked) ? (
                            <span className={cn('shrink-0 text-primary-foreground/60', desktop ? 'text-sm' : 'text-[13px]')}>{face.from}</span>
                        ) : null}
                        {more > 0 ? (
                            <span className="relative ml-0.5 inline-flex h-5 shrink-0 items-center rounded-full bg-primary-foreground/15 px-1.5 text-[11px] font-semibold tabular-nums">
                                +{more}
                                {hiddenUnacked ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-secondary ring-2 ring-primary" /> : null}
                            </span>
                        ) : null}
                    </button>
                    {face.ackable ? <AckButton cue={face} onAck={onAck} size="xs" /> : null}
                </div>
            ) : null}

            {mode === 'medium' && focused ? (
                <div
                    key={focused.id}
                    {...swipe}
                    className="relative flex h-16 items-center gap-3 overflow-hidden rounded-full bg-primary pl-5 pr-2 text-primary-foreground shadow-xl shadow-foreground/20 animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-300 motion-reduce:animate-none"
                >
                    <CueLead cue={focused} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold leading-tight">{focused.title}</p>
                        <p className="truncate text-xs text-primary-foreground/60">
                            {CUE_KIND_LABEL[focused.kind]} · {sendPath(focused)}
                        </p>
                    </div>
                    {focused.ackable ? <AckButton cue={focused} onAck={onAck} size="sm" /> : <SentProgress cue={focused} />}
                    <IslandClose cue={focused} onDismiss={onDismiss} />
                    <TimeLeft toast={focused} className="inset-x-8 bottom-1 bg-primary-foreground/25" />
                </div>
            ) : null}

            {mode === 'large' && focused ? (
                <div
                    key={focused.id}
                    {...swipe}
                    className="relative overflow-hidden rounded-[28px] bg-primary px-5 pb-5 pt-3 text-primary-foreground shadow-2xl shadow-foreground/25 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 motion-reduce:animate-none"
                >
                    <div className="flex items-center gap-2 text-[13px] text-primary-foreground/65">
                        {!focused.acked ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" /> : null}
                        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
                        <span className="font-medium text-primary-foreground">{CUE_KIND_LABEL[focused.kind]}</span>
                        <span className="truncate">{sendPath(focused)}</span>
                        <IslandClose cue={focused} onDismiss={onDismiss} className="-mr-2 ml-auto" />
                    </div>
                    <div className="mt-1 flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className={cn('truncate font-semibold leading-tight tracking-tight', desktop ? 'text-[40px]' : 'text-[32px]')}>{focused.title}</p>
                            {focused.body ? <p className="mt-0.5 truncate text-[15px] text-primary-foreground/70">{focused.body}</p> : null}
                        </div>
                        <AckButton cue={focused} onAck={onAck} size="lg" />
                    </div>
                    <TimeLeft toast={focused} className="inset-x-6 bottom-2 bg-primary-foreground/25" />
                </div>
            ) : null}

            {mode === 'list' ? (
                <div
                    {...swipe}
                    className="rounded-[28px] bg-primary p-2 text-primary-foreground shadow-2xl shadow-foreground/25 animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
                >
                    <div className="flex items-center justify-between pl-3">
                        <p className="text-[13px] font-medium text-primary-foreground/65">
                            큐 <span className="tabular-nums">{cues.length}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setListOpen(false)}
                            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-primary-foreground/80 outline-none hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                        >
                            접기
                            <ChevronUp className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <ul className="divide-y divide-primary-foreground/10">
                        {cues.map((cue) => (
                            <li key={cue.id} className="flex min-h-16 items-center gap-3 py-2 pl-3">
                                <CueLead cue={cue} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-semibold leading-snug">{cue.title}</p>
                                    <p className="truncate text-xs text-primary-foreground/60">
                                        {CUE_KIND_LABEL[cue.kind]} · {sendPath(cue)}
                                    </p>
                                </div>
                                {cue.ackable ? <AckButton cue={cue} onAck={onAck} size="sm" /> : <SentProgress cue={cue} />}
                                <IslandClose cue={cue} onDismiss={onDismiss} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

/** 아일랜드 앞 표시: 확인 안 한 받은 큐 = 주황 점, 확인함·보낸 큐 = 체크 */
function CueLead({ cue }: { cue: DraftToast }) {
    if (cue.ackable && !cue.acked) {
        return (
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <span className="relative flex size-2">
                    {cue.urgency === 'high' ? <span className="absolute inset-0 rounded-full bg-secondary opacity-60 motion-safe:animate-ping" /> : null}
                    <span className="relative size-2 rounded-full bg-secondary" />
                </span>
            </span>
        );
    }
    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
            <Check className="size-3" strokeWidth={3} />
        </span>
    );
}

function AckButton({ cue, onAck, size }: { cue: DraftToast; onAck: (id: string) => void; size: 'xs' | 'sm' | 'lg' }) {
    const box = size === 'lg' ? 'h-14 min-w-24 px-6 text-base' : size === 'sm' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs';
    if (cue.acked) {
        return (
            <span className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary-foreground/15 font-semibold text-primary-foreground animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none', box)}>
                <Check className={size === 'lg' ? 'size-5' : 'size-3.5'} aria-hidden="true" />
                확인함
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={() => onAck(cue.id)}
            aria-label={`${cue.title} 큐 확인`}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-foreground font-semibold text-primary outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary motion-reduce:transform-none',
                box,
            )}
        >
            확인
        </button>
    );
}

/** 보낸 큐: 몇 명이 확인했는지 작은 원 + 숫자 */
function SentProgress({ cue }: { cue: DraftToast }) {
    if (!cue.progress) return null;
    const { done, total } = cue.progress;
    const ratio = total > 0 ? done / total : 0;
    return (
        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs tabular-nums text-primary-foreground/70" aria-label={`${total}명 중 ${done}명 확인`}>
            <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-primary-foreground/20" />
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray={`${ratio * 100} 100`} className="stroke-primary-foreground" />
            </svg>
            {done}/{total}
        </span>
    );
}

function IslandClose({ cue, onDismiss, className }: { cue: DraftToast; onDismiss: (id: string) => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={() => onDismiss(cue.id)}
            aria-label={`${cue.title} 알림 닫기`}
            className={cn(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground/60 outline-none transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/70',
                className,
            )}
        >
            <X className="size-4" aria-hidden="true" />
        </button>
    );
}

/** 알림이 없을 때 아일랜드 자리: 조용한 '진행 중' 표시 (연결이 끊기면 '다시 연결 중') */
function IdleStatus({ offline }: { offline: boolean }) {
    const [seconds, setSeconds] = useState(ELAPSED_START);
    useEffect(() => {
        const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return (
        <p className="flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-xs text-muted-foreground animate-in fade-in duration-300 motion-reduce:animate-none">
            <span className="relative flex size-1.5" aria-hidden="true">
                <span className={cn('absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping', offline ? 'bg-warning' : 'bg-brand')} />
                <span className={cn('relative size-1.5 rounded-full', offline ? 'bg-warning' : 'bg-brand')} />
            </span>
            <span className={cn('font-medium', offline ? 'text-warning' : 'text-brand')}>{offline ? '다시 연결 중' : '진행 중'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{text}</span>
        </p>
    );
}

/* ───────────── 알림 ②: 아래 가운데 앱 알림 카드 ───────────── */

function NoticeDock({ notices, desktop, onAction, onDismiss }: { notices: DraftToast[]; desktop: boolean; onAction: (id: string) => void; onDismiss: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const many = notices.length > 1;
    const expanded = open && many;
    const wrap = useOutsideClose(expanded && !desktop, () => setOpen(false));

    if (notices.length === 0) return null;

    const hover = desktop
        ? {
              onPointerEnter: () => setOpen(true),
              onPointerLeave: () => setOpen(false),
          }
        : {};

    const front = notices[0];
    return (
        <div ref={wrap} {...hover}>
            {/* 접힌 더미: 가장 새 알림이 앞, 뒤 알림은 위로 살짝 보이는 판. 펼친 동안에도 자리를 지켜 숫자가 흔들리지 않습니다 */}
            <div key={front.id} inert={expanded} className={cn('relative', notices.length > 2 ? 'mt-3' : many ? 'mt-1.5' : '', expanded && 'invisible')}>
                {notices.slice(1, 3).map((notice, index) => (
                    <span
                        key={notice.id}
                        aria-hidden="true"
                        className={cn(
                            'absolute rounded-2xl bg-card shadow-md shadow-foreground/5 ring-1',
                            NOTICE_LOOK[notice.kind]?.ring ?? 'ring-border',
                            index === 0 ? 'inset-x-3 -top-1.5 bottom-1.5' : 'inset-x-6 -top-3 bottom-3',
                        )}
                    />
                ))}
                <NoticeCard notice={front} count={notices.length} onExpand={many ? () => setOpen(true) : undefined} onAction={onAction} onDismiss={onDismiss} />
            </div>

            {expanded ? (
                // 펼치면 한 장의 판 위로 늘어납니다 (아일랜드 목록과 같은 머리줄). 가장 새 알림은 처음 뜬 자리(맨 아래)에 그대로 남습니다.
                <div className="absolute -inset-x-1.5 -bottom-1.5 rounded-[28px] bg-background p-1.5 shadow-2xl shadow-foreground/15 ring-1 ring-border animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
                    <div className="flex items-center justify-between pl-3">
                        <p className="text-[13px] font-medium text-muted-foreground">
                            앱 알림 <span className="tabular-nums">{notices.length}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 px-3 text-[13px] text-muted-foreground')}
                        >
                            접기
                            <ChevronDown className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-1.5">
                        {[...notices].reverse().map((notice) => (
                            <NoticeCard key={notice.id} notice={notice} flat onAction={onAction} onDismiss={onDismiss} />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NoticeCard({
    notice,
    count = 1,
    flat = false,
    onExpand,
    onAction,
    onDismiss,
}: {
    notice: DraftToast;
    count?: number;
    /** 펼친 판 안에서는 그림자 없이 */
    flat?: boolean;
    onExpand?: () => void;
    onAction: (id: string) => void;
    onDismiss: (id: string) => void;
}) {
    const swipe = useSwipeDismiss(() => onDismiss(notice.id));
    const look = NOTICE_LOOK[notice.kind];
    const sticky = notice.ttl === null;
    const Icon = look?.icon;

    const text = (
        <>
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{notice.title}</span>
            {notice.body ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notice.body}</span> : null}
        </>
    );

    return (
        <div
            {...swipe.bind}
            style={swipe.style}
            className={cn(
                'relative flex min-h-16 touch-pan-y select-none items-center gap-3 rounded-2xl bg-card py-2.5 pl-3 pr-1.5 text-card-foreground ring-1 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none',
                !flat && 'shadow-lg shadow-foreground/10',
                look?.ring ?? 'ring-border',
            )}
        >
            <span className="relative shrink-0">
                {notice.kind === 'team' && notice.from ? (
                    <Avatar name={notice.from} size="md" />
                ) : Icon ? (
                    <span className={cn('flex size-9 items-center justify-center rounded-full', look.tile)}>
                        <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                ) : null}
                {count > 1 ? (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-card">
                        +{count - 1}
                    </span>
                ) : null}
            </span>

            {onExpand ? (
                <button
                    type="button"
                    onClick={onExpand}
                    aria-label={`앱 알림 ${count}개 모두 보기 — ${notice.title}`}
                    className="min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    {text}
                </button>
            ) : (
                <p className="min-w-0 flex-1">{text}</p>
            )}

            {notice.action ? (
                <button
                    type="button"
                    data-no-swipe
                    onClick={() => onAction(notice.id)}
                    className={cn(buttonVariants({ variant: notice.kind === 'error' ? 'default' : 'secondary', size: 'sm' }), 'h-10 shrink-0 px-3.5 text-[13px]')}
                >
                    {notice.action}
                </button>
            ) : null}
            <button
                type="button"
                data-no-swipe
                onClick={() => onDismiss(notice.id)}
                aria-label={`${notice.title} 알림 닫기`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0 text-muted-foreground')}
            >
                <X className="size-4" aria-hidden="true" />
            </button>
            {sticky ? null : <TimeLeft toast={notice} className="inset-x-5 bottom-0 bg-foreground/20" />}
        </div>
    );
}

/** 앱 알림 줄. 알림이 있을 때만 열리고(높이 0 → 내용), 그동안 위의 박 숫자가 조금 작아집니다. */
function DockZone({ open, desktop, children }: { open: boolean; desktop: boolean; children: ReactNode }) {
    return (
        <div className={cn('relative z-20 grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="flex min-h-0 flex-col justify-end">
                <div className={cn(desktop ? 'mx-auto w-full max-w-[460px] px-6 pb-3' : 'px-3 pt-3')}>
                    <div className="relative">{children}</div>
                </div>
            </div>
        </div>
    );
}

/* ───────────── 공통 ───────────── */

/** 자동으로 사라지는 알림의 남은 시간 — 얇은 선이 줄어듭니다. 펼침·접힘으로 다시 그려져도 남은 만큼부터 */
function TimeLeft({ toast, className }: { toast: DraftToast; className?: string }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node || !toast.createdAt) return;
        node.style.animationDelay = `${-(Date.now() - toast.createdAt)}ms`;
    }, [toast.createdAt]);
    if (!toast.ttl || toast.acked) return null;
    return (
        <span
            ref={ref}
            aria-hidden="true"
            className={cn('pointer-events-none absolute h-0.5 origin-left rounded-full animate-toast-progress', className)}
            style={{ '--toast-duration': `${toast.ttl}ms` } as CSSProperties}
        />
    );
}

/** 옆으로 밀어 닫기 (터치·마우스). 버튼 위에서 시작하면 밀기를 시작하지 않습니다. */
function useSwipeDismiss(onDismiss: () => void) {
    const [offset, setOffset] = useState(0);
    const origin = useRef<number | null>(null);
    const moved = useRef(false);

    function end() {
        origin.current = null;
        if (Math.abs(offset) > 84) onDismiss();
        else setOffset(0);
    }

    return {
        style: offset ? ({ transform: `translateX(${offset}px)`, opacity: Math.max(0.2, 1 - Math.abs(offset) / 220) } as CSSProperties) : undefined,
        bind: {
            onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('[data-no-swipe]')) return;
                origin.current = event.clientX;
                moved.current = false;
            },
            onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
                if (origin.current === null) return;
                const delta = event.clientX - origin.current;
                if (Math.abs(delta) > 6) moved.current = true;
                if (moved.current) setOffset(delta);
            },
            onPointerUp: end,
            onPointerLeave: () => {
                if (origin.current !== null) end();
            },
            onPointerCancel: () => {
                origin.current = null;
                setOffset(0);
            },
            onClickCapture: (event: ReactMouseEvent) => {
                if (!moved.current) return;
                moved.current = false;
                event.preventDefault();
                event.stopPropagation();
            },
        },
    };
}

/** 열린 동안 바깥을 누르면 닫습니다 */
function useOutsideClose(active: boolean, onClose: () => void) {
    const ref = useRef<HTMLDivElement | null>(null);
    const close = useRef(onClose);
    useEffect(() => {
        close.current = onClose;
    });
    useEffect(() => {
        if (!active) return;
        const onDown = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) close.current();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close.current();
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [active]);
    return ref;
}

/**
 * 스크린리더 알림: 급한 큐와 오류는 role="alert", 나머지는 polite.
 * 새로 들어온 알림만 한 번 읽습니다 (닫혀서 다음 알림이 앞으로 올 때는 다시 읽지 않음).
 */
function Announcer({ toasts }: { toasts: DraftToast[] }) {
    const [known, setKnown] = useState<string>('');
    const [message, setMessage] = useState({ alert: '', polite: '' });
    const key = toasts.map((toast) => `${toast.id}${toast.acked ? '+' : ''}`).join(' ');
    if (key !== known) {
        const before = new Set(known.split(' '));
        const fresh = toasts.filter((toast) => !before.has(`${toast.id}${toast.acked ? '+' : ''}`));
        const urgent = fresh.find((toast) => !toast.acked && (toast.urgency === 'high' || toast.tone === 'danger'));
        const calm = fresh.find((toast) => toast.acked || !(toast.urgency === 'high' || toast.tone === 'danger'));
        setKnown(key);
        if (urgent || calm) {
            setMessage((current) => ({
                alert: urgent ? describe(urgent) : current.alert,
                polite: calm ? (calm.acked ? `${calm.title} 큐 확인함` : describe(calm)) : current.polite,
            }));
        }
    }
    return (
        <>
            <div role="alert" className="sr-only">
                {message.alert}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
                {message.polite}
            </div>
        </>
    );
}
