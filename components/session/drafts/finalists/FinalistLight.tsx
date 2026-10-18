'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Activity, ChevronLeft, ChevronRight, Ellipsis, FileMusic, GalleryVerticalEnd, Megaphone, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { TONE_BLOCK } from '@/components/conti/ui';
import DesktopStage from '../DesktopStage';
import {
    CueSheetBody,
    FormRow,
    HoldToUnlock,
    ME,
    MoreSheetBody,
    NextUp,
    NowCard,
    OrderSheetBody,
    ScoreView,
    Sheet,
    SongStrip,
    useDeviceToggles,
    type Recipient,
    type SheetKind,
} from '../MobileNow';
import { Announcer, BeatHero, CUE_KINDS, CueIsland, DockZone, NoticeDock, SectionNow, barsOf, type IslandMode } from '../pulse/PulseCount';
import { useMockPulse } from '../pulse/useMockPulse';
import { DRAFT_CUES, DRAFT_SERVICE, DRAFT_TEAM, ROLE_LABEL, useMockLive, type DraftCue, type DraftRole, type MockLive } from '../mockLive';
import type { FinalistProps } from './types';

/*
 * 후보 A · 밝은 따라가기 — 앱 테마를 그대로 따르는 흰 화면.
 * - 모바일: '지금 카드'(MobileNow)의 곡 줄 · 지금 카드 · 송폼 · 엄지 버튼 · 시트를 그대로 쓰고,
 *   가운데만 '지금 | 악보 | 펄스' 로 바뀝니다. 펄스는 '숫자 박자'(PulseCount)의 큰 박 숫자 · 박 막대 · 마디.
 * - 데스크톱: '악보 무대'(DesktopStage) 전체를 쓰고, 펄스로 바꾸면 코드 차트 자리만 박 숫자로 바뀝니다 (오른쪽 레일 · 아래 막대는 그대로).
 * - 알림은 한 가지: 연주 큐는 위 가운데 검정 아일랜드, 앱 알림은 넘김 버튼 바로 위 흰 카드 — 두 화면 모두 같은 자리.
 *   시안들이 따로 갖던 보냄 알약 · 받은 큐 배너는 쓰지 않고, 큐를 보내면 onSendCue 로 같은 알림이 뜹니다.
 */

type Screen = 'now' | 'score' | 'pulse';

/** 펄스 화면 아래 줄의 빠른 큐 (숫자 박자 시안과 같은 네 개) */
const QUICK_CUES = ['again', 'faster', 'slower', 'ending'].map((id) => DRAFT_CUES.find((cue) => cue.id === id)!);

const MOBILE_SCREENS: SwitchOption<Screen>[] = [
    { value: 'now', label: '지금', icon: GalleryVerticalEnd },
    { value: 'score', label: '악보', icon: FileMusic },
    { value: 'pulse', label: '펄스', icon: Activity },
];

const DESKTOP_SCREENS: SwitchOption<'chart' | 'pulse'>[] = [
    { value: 'chart', label: '악보', icon: FileMusic },
    { value: 'pulse', label: '펄스', icon: Activity },
];

/** 데스크톱: 아일랜드는 위 막대가 아니라 악보·펄스 열의 맨 위 줄(높이 56px) 가운데에 섭니다 */
const DESKTOP_ISLAND: Partial<Record<IslandMode, string>> = {
    idle: 'top-7',
    compact: 'top-1.5 max-w-[min(480px,calc(100%-400px))]',
    medium: 'top-1.5 w-[min(440px,calc(100%-32px))]',
    list: 'top-1.5 w-[min(440px,calc(100%-32px))]',
    large: 'top-1.5 w-[min(480px,calc(100%-32px))]',
};

const ANYONE_OFFLINE = DRAFT_TEAM.some((member) => !member.online);

function targetLabel(target: DraftRole | 'all') {
    return target === 'all' ? '전체' : ROLE_LABEL[target];
}

function screenOf(view: FinalistProps['view']): Screen {
    return view === 'pulse' ? 'pulse' : 'now';
}

export default function FinalistLight({ device, view = 'main', framed = false, toasts, onDismiss, onAck, onAction, onSendCue }: FinalistProps) {
    // 기본 화면과 펄스가 함께 쓰는 진행 상태 — 화면을 바꿔도 곡 · 섹션이 그대로입니다
    const live = useMockLive();
    const [screen, setScreen] = useState<Screen>(() => screenOf(view));
    const [viewProp, setViewProp] = useState(view);
    if (viewProp !== view) {
        setViewProp(view);
        setScreen(screenOf(view));
    }

    const { sendCue: logCue } = live;
    const sendCue = useCallback(
        (cue: Pick<DraftCue, 'label' | 'target'>) => {
            logCue(cue);
            onSendCue(cue.label, targetLabel(cue.target));
        },
        [logCue, onSendCue],
    );

    const desktop = device === 'desktop';
    const cues = toasts.filter((toast) => CUE_KINDS.has(toast.kind));
    const notices = toasts.filter((toast) => !CUE_KINDS.has(toast.kind));
    const offline = notices.some((toast) => toast.kind === 'offline');

    const island = <CueIsland cues={cues} desktop={desktop} offline={offline} onAck={onAck} onDismiss={onDismiss} modeClassName={desktop ? DESKTOP_ISLAND : undefined} />;
    const dock = (
        <DockZone open={notices.length > 0} desktop={desktop}>
            <NoticeDock notices={notices} desktop={desktop} onAction={onAction} onDismiss={onDismiss} />
        </DockZone>
    );

    return (
        <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
            {desktop ? (
                <DesktopLight live={live} framed={framed} screen={screen} onScreen={setScreen} island={island} dock={dock} onSendCue={onSendCue} />
            ) : (
                <MobileLight live={live} framed={framed} screen={screen} onScreen={setScreen} island={island} dock={dock} sendCue={sendCue} />
            )}
            <Announcer toasts={toasts} />
        </div>
    );
}

/* ───────────── 모바일 ───────────── */

interface MobileLightProps {
    live: MockLive;
    framed: boolean;
    screen: Screen;
    onScreen: (screen: Screen) => void;
    island: ReactNode;
    dock: ReactNode;
    sendCue: (cue: DraftCue) => void;
}

function MobileLight({ live, framed, screen, onScreen, island, dock, sendCue }: MobileLightProps) {
    const [sheet, setSheet] = useState<SheetKind | null>(null);
    const [recipient, setRecipient] = useState<Recipient>('all');
    const [myRole, setMyRole] = useState<DraftRole>('instrument');
    const toggles = useDeviceToggles(framed);
    const returnFocus = useRef<HTMLElement | null>(null);
    const locked = toggles.locked;
    const pulse = screen === 'pulse';
    const atEnd = live.nextSection === null && live.nextSong === null;
    const atStart = live.sectionIndex === 0 && live.songIndex === 0;
    const online = DRAFT_TEAM.filter((member) => member.online).length;

    function openSheet(kind: SheetKind) {
        // 시트가 열리면 뒤 화면이 inert 가 되어 포커스가 풀리므로, 연 버튼을 미리 기억해 둡니다.
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSheet(kind);
    }

    function closeSheet() {
        setSheet(null);
        const target = returnFocus.current;
        returnFocus.current = null;
        if (target) requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }

    return (
        // group/screen: 아일랜드가 펼쳐진 동안 곡 줄이 잠시 물러납니다 · container: 지금 카드가 화면 높이에 맞춰 글자 크기를 고릅니다
        <div className="group/screen relative flex h-full w-full flex-col [container-type:size]">
            <div inert={sheet !== null} className="flex min-h-0 flex-1 flex-col">
                {/* 위: 나가기 · 큐 아일랜드 · 더보기 — 두 화면 모두 같은 막대 */}
                <header className={cn('relative z-30 shrink-0 px-2', framed ? 'pt-4' : 'pt-[max(env(safe-area-inset-top),0.375rem)]')}>
                    <div className="relative flex h-12 items-center justify-between">
                        <Link href="/dashboard" inert={locked} aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                            <ChevronLeft className="size-[22px]" aria-hidden="true" />
                        </Link>
                        {/* 화면을 잠가도 큐는 확인할 수 있게 아일랜드는 잠그지 않습니다 */}
                        {island}
                        <button
                            type="button"
                            inert={locked}
                            onClick={() => openSheet('more')}
                            aria-label={`더보기, 팀 ${DRAFT_TEAM.length}명 중 ${online}명 접속`}
                            aria-haspopup="dialog"
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative text-muted-foreground')}
                        >
                            <Ellipsis className="size-5" aria-hidden="true" />
                            {ANYONE_OFFLINE ? (
                                <span aria-hidden="true" className="absolute right-2 top-2.5 size-2 rounded-full bg-secondary ring-2 ring-background transition-opacity group-has-[[data-island-open]]/screen:opacity-0" />
                            ) : null}
                        </button>
                    </div>
                </header>

                <div inert={locked} className="flex min-h-0 flex-1 flex-col">
                    <div className="shrink-0 transition-opacity duration-200 group-has-[[data-island-open]]/screen:pointer-events-none group-has-[[data-island-open]]/screen:opacity-0 motion-reduce:transition-none">
                        <SongStrip live={live} onOrder={() => openSheet('order')} beat={<MiniBeat live={live} off={pulse} />} />
                    </div>

                    {pulse ? (
                        <>
                            <div className="flex min-h-0 flex-1 flex-col px-5 pt-1">
                                <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} bars={barsOf(live)} />
                            </div>
                            <SectionNow live={live} />
                        </>
                    ) : (
                        // 가운데: 지금 카드 또는 악보 — 자랄 수 있는 유일한 스크롤 영역
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3 pt-0.5 [scrollbar-width:none]">
                            {screen === 'now' ? (
                                <>
                                    <NowCard live={live} />
                                    {live.song.note ? (
                                        <p className={cn('hidden shrink-0 truncate rounded-2xl px-4 py-2.5 text-sm leading-snug [@container(min-height:760px)]:block', TONE_BLOCK.peach)}>
                                            <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
                                            {live.song.note}
                                        </p>
                                    ) : null}
                                    <NextUp live={live} />
                                </>
                            ) : (
                                <ScoreView live={live} />
                            )}
                        </div>
                    )}
                </div>

                {/* 앱 알림 — 넘김 버튼 바로 위. 알림이 오면 이 줄이 열리고 가운데가 그만큼 비켜 줍니다 (버튼은 가리지 않음) */}
                {dock}

                {/* 엄지 자리: (송폼 | 빠른 큐) → 이전 · 다음 · 큐 → 화면 바꾸기 */}
                <div className={cn('shrink-0 bg-background pt-2', framed ? 'pb-5' : 'pb-[max(env(safe-area-inset-bottom),0.5rem)]')}>
                    <div inert={locked} className={cn('transition-opacity', locked && 'opacity-40')}>
                        {pulse ? <QuickCues onSend={sendCue} /> : <FormRow live={live} />}
                    </div>
                    {locked ? (
                        <div className="px-4 pt-2.5">
                            <HoldToUnlock onUnlock={() => toggles.setLocked(false)} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 px-4 pt-2.5">
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
                            <button
                                type="button"
                                onClick={() => openSheet('cue')}
                                aria-haspopup="dialog"
                                aria-label="큐 보내기"
                                className={cn(buttonVariants({ variant: 'secondary' }), 'size-14 shrink-0 flex-col gap-0.5 px-0 text-[11px] font-medium has-[>svg]:px-0')}
                            >
                                <Megaphone className="size-5" aria-hidden="true" />
                                큐
                            </button>
                        </div>
                    )}
                    <div inert={locked} className={cn('px-4 pt-2.5 transition-opacity', locked && 'opacity-40')}>
                        <ViewSwitch label="화면" value={screen} options={MOBILE_SCREENS} onChange={onScreen} className="w-full" />
                    </div>
                </div>
            </div>

            {sheet === 'cue' ? (
                <Sheet eyebrow={`${ME.name} · ${ME.part}`} title="큐 보내기" tall focusOnOpen onClose={closeSheet}>
                    <CueSheetBody
                        log={live.log}
                        recipient={recipient}
                        onRecipient={setRecipient}
                        onSend={(cue) => {
                            sendCue(cue);
                            closeSheet();
                        }}
                    />
                </Sheet>
            ) : null}
            {sheet === 'order' ? (
                <Sheet eyebrow={`${DRAFT_SERVICE.theme} · ${live.songs.length}곡`} title="순서" focusOnOpen onClose={closeSheet}>
                    <OrderSheetBody
                        live={live}
                        onPick={(index) => {
                            if (index !== live.songIndex) live.goSong(index);
                            closeSheet();
                        }}
                    />
                </Sheet>
            ) : null}
            {sheet === 'more' ? (
                <Sheet eyebrow="화면 · 연결" title="더보기" focusOnOpen onClose={closeSheet}>
                    <MoreSheetBody
                        device={toggles}
                        framed={framed}
                        myRole={myRole}
                        onRole={setMyRole}
                        online={online}
                        onLock={() => {
                            toggles.setLocked(true);
                            returnFocus.current = null;
                            setSheet(null);
                        }}
                    />
                </Sheet>
            ) : null}
        </div>
    );
}

/** 펄스 화면에서 송폼 대신 엄지 위에 두는 빠른 큐 */
function QuickCues({ onSend }: { onSend: (cue: DraftCue) => void }) {
    return (
        <div role="group" aria-label="빠른 큐" className="flex items-center gap-1.5 px-4">
            <Megaphone className="mx-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {QUICK_CUES.map((cue) => (
                <button
                    key={cue.id}
                    type="button"
                    onClick={() => onSend(cue)}
                    aria-label={`${cue.label} 큐를 ${targetLabel(cue.target)}에게 보내기`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-11 min-w-0 flex-1 px-1 text-[13px]')}
                >
                    {cue.label}
                </button>
            ))}
        </div>
    );
}

/* ───────────── 데스크톱 ───────────── */

interface DesktopLightProps {
    live: MockLive;
    framed: boolean;
    screen: Screen;
    onScreen: (screen: Screen) => void;
    island: ReactNode;
    dock: ReactNode;
    onSendCue: (label: string, target: string) => void;
}

function DesktopLight({ live, framed, screen, onScreen, island, dock, onSendCue }: DesktopLightProps) {
    const pulse = screen === 'pulse';
    return (
        <DesktopStage
            framed={framed}
            live={live}
            hideStatus
            headerBeat={<MiniBeat live={live} off={pulse} desktop />}
            headerActions={
                <ViewSwitch
                    label="화면"
                    value={pulse ? 'pulse' : 'chart'}
                    options={DESKTOP_SCREENS}
                    onChange={(value) => onScreen(value === 'pulse' ? 'pulse' : 'now')}
                    className="mr-2"
                />
            }
            chartHidden={pulse}
            onSendCue={onSendCue}
            stageOverlay={
                // 악보 열 위의 층: 펄스(펄스일 때) · 앱 알림 자리 · 큐 아일랜드. 악보일 때는 빈 곳을 눌러도 악보가 눌립니다.
                <div className="pointer-events-none flex h-full flex-col">
                    {pulse ? <DesktopPulse live={live} /> : <div className="min-h-0 flex-1" />}
                    <div className="pointer-events-auto">{dock}</div>
                    <div className="pointer-events-auto">{island}</div>
                </div>
            }
        />
    );
}

/** 코드 차트 자리에 들어가는 펄스 — 지금 · 다음 섹션과 송폼은 오른쪽 레일이 그대로 보여 줍니다 */
function DesktopPulse({ live }: { live: MockLive }) {
    const bars = barsOf(live);
    return (
        <section aria-label="펄스" className="pointer-events-auto flex min-h-0 flex-1 flex-col bg-background">
            {/* 악보의 맨 위 줄과 같은 높이 · 같은 글자 — 가운데에 아일랜드가 섭니다 */}
            <div className="flex h-14 shrink-0 items-center pl-9 pr-5 @min-[1200px]:pl-12 @min-[1200px]:pr-7">
                <p className="truncate text-xs font-medium text-muted-foreground">
                    펄스 · {bars}마디 · {live.song.meter}
                </p>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col px-9 pb-7 pt-2 @min-[1200px]:px-12">
                <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={`${live.songIndex}-${live.sectionIndex}`} bars={bars} desktop />
            </div>
        </section>
    );
}

/* ───────────── 공통 ───────────── */

interface SwitchOption<T extends string> {
    value: T;
    label: string;
    icon: LucideIcon;
}

/** 화면 바꾸기 — 회색 트랙 위 흰 칩 (모바일은 맨 아래, 데스크톱은 위 막대 오른쪽) */
function ViewSwitch<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: SwitchOption<T>[]; onChange: (value: T) => void; className?: string }) {
    return (
        <div role="group" aria-label={label} className={cn('grid shrink-0 auto-cols-fr grid-flow-col rounded-full bg-muted p-1', className)}>
            {options.map((option) => {
                const active = option.value === value;
                const Icon = option.icon;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                            active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * 곡 줄 · 위 막대의 작은 박 표시 — 4/4 는 점 4개, 6/8 은 3+3 으로 묶은 6개 (펄스와 같은 박 시계).
 * 펄스 화면(off)에서는 큰 박 숫자가 BPM · 박자표를 보여 주므로 여기서는 비웁니다.
 */
function MiniBeat({ live, off = false, desktop = false }: { live: MockLive; off?: boolean; desktop?: boolean }) {
    const pulse = useMockPulse({ bpm: live.bpm, meter: live.song.meter, enabled: !off, resetKey: `${live.songIndex}-${live.sectionIndex}` });
    if (off) return null;
    const beats = Array.from({ length: pulse.beatsPerBar }, (_, index) => index + 1);
    const groups = pulse.beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];

    const dots = (
        <span aria-hidden="true" className="flex items-center gap-2.5">
            {groups.map((group) => (
                <span key={group[0]} className="flex items-center gap-1.5">
                    {group.map((beat) => {
                        const on = beat === pulse.count;
                        return (
                            <span
                                key={beat}
                                className={cn(
                                    'rounded-full transition-transform duration-100 motion-reduce:transition-none',
                                    desktop ? 'size-2' : 'size-2.5',
                                    on ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
                                    on && pulse.blink && 'motion-safe:scale-125',
                                )}
                            />
                        );
                    })}
                </span>
            ))}
        </span>
    );

    const bpm = desktop ? (
        <span className="flex items-baseline gap-1" aria-hidden="true">
            <span className="text-[17px] font-semibold tabular-nums">{live.bpm}</span>
            <span className="text-xs font-medium text-muted-foreground">BPM</span>
        </span>
    ) : (
        <span aria-hidden="true">
            <span className="text-[15px] font-semibold tabular-nums">{live.bpm}</span>
            <span className="ml-1 text-muted-foreground">BPM</span>
        </span>
    );

    if (desktop) {
        return (
            <span role="img" aria-label={`${live.bpm} BPM, ${live.song.meter}`} className="flex shrink-0 items-center gap-2.5">
                {bpm}
                {dots}
            </span>
        );
    }
    // 모바일 곡 줄: 점 · BPM · 박자표 (지금 카드 시안과 같은 순서)
    return (
        <>
            <span role="img" aria-label={`${live.bpm} BPM, ${live.song.meter}`} className="inline-flex items-center gap-2.5">
                {dots}
                {bpm}
            </span>
            <span className="text-muted-foreground" aria-hidden="true">
                {live.song.meter}
            </span>
        </>
    );
}

