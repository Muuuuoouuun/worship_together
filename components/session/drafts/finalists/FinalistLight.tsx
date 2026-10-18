'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Activity, Check, ChevronLeft, ChevronRight, Ellipsis, FileMusic, GalleryVerticalEnd, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarStack, TONE_BLOCK } from '@/components/conti/ui';
import DesktopStage from '../DesktopStage';
import { FormRow, HoldToUnlock, MoreSheetBody, NextUp, NowCard, OrderSheetBody, ScoreView, Sheet, SongStrip, useDeviceToggles } from '../MobileNow';
import { Announcer, BeatHero, CUE_KINDS, CueIsland, DockZone, NoticeDock, SectionNow, barsOf, type IslandMode } from '../pulse/PulseCount';
import { useMockPulse } from '../pulse/useMockPulse';
import type { DraftToast } from '../pulse/toastDemo';
import { DRAFT_CUE_LOG, DRAFT_CUES, DRAFT_SERVICE, DRAFT_TEAM, ROLE_LABEL, useMockLive, type DraftCue, type DraftRole, type MockLive } from '../mockLive';
import type { FinalistProps } from './types';

/*
 * 후보 A · 밝은 따라가기 — 앱 테마를 그대로 따르는 흰 화면.
 * - 모바일: '지금 카드'(MobileNow)의 곡 줄 · 지금 카드 · 엄지 버튼 · 시트를 그대로 쓰고,
 *   가운데만 '지금 | 악보 | 펄스' 로 바뀝니다. 펄스는 '숫자 박자'(PulseCount)의 큰 박 숫자 · 박 막대 · 마디.
 * - 데스크톱: '악보 무대'(DesktopStage) 전체를 쓰고, 펄스로 바꾸면 코드 차트 자리만 박 숫자로 바뀝니다 (오른쪽 레일 · 아래 막대는 그대로).
 * - 큐 보내기는 어디서나 같은 빠른 큐 세 개 — 누르면 바로 갑니다 (시트 · 팝업 없음). 버튼이 1.2초 '보냄' 으로 바뀌고 위 아일랜드에 보낸 큐가 뜹니다.
 * - BPM 은 곡 줄(모바일) · 위 막대(데스크톱)에 한 번만, 두 화면 모두 박 시계에 맞춰 움직입니다.
 * - 알림은 한 가지: 연주 큐는 위 가운데 검정 아일랜드, 앱 알림은 넘김 버튼 바로 위 흰 카드 — 두 화면 모두 같은 자리.
 */

type Screen = 'now' | 'score' | 'pulse';

/** 빠른 큐 — 넘김(이전 · 다음)과 겹치지 않는 흐름 큐 세 개, 모두 전체에게. 모바일 · 데스크톱 · 두 화면 모두 같은 세 개 */
const QUICK_CUES = ['again', 'ending', 'prayer'].map((id) => DRAFT_CUES.find((cue) => cue.id === id)!);

/** 보낸 뒤 버튼이 '보냄' 으로 머무는 시간 — 그동안 다시 눌러도 한 번만 갑니다 */
const SENT_MS = 1200;

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

const ONLINE = DRAFT_TEAM.filter((member) => member.online);
const ANYONE_OFFLINE = ONLINE.length < DRAFT_TEAM.length;

function targetLabel(target: DraftRole | 'all') {
    return target === 'all' ? '전체' : ROLE_LABEL[target];
}

function screenOf(view: FinalistProps['view']): Screen {
    return view === 'pulse' ? 'pulse' : 'now';
}

/** 박 시계를 함께 쓰는 곳(곡 줄 · 큰 박 숫자)이 같은 순간에 다시 세도록 — 섹션 · 곡 · 화면이 바뀌면 함께 1박부터 */
function beatKey(live: MockLive) {
    return `${live.songIndex}-${live.sectionIndex}`;
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

    const history = useCueHistory(toasts);
    const { record } = history;
    const sendCue = useCallback(
        (cue: DraftCue) => {
            const target = targetLabel(cue.target);
            record(cue.label, target);
            onSendCue(cue.label, target);
        },
        [record, onSendCue],
    );

    const desktop = device === 'desktop';
    const cues = toasts.filter((toast) => CUE_KINDS.has(toast.kind));
    const notices = toasts.filter((toast) => !CUE_KINDS.has(toast.kind));
    const offline = notices.some((toast) => toast.kind === 'offline');

    const island = (
        <CueIsland cues={cues} desktop={desktop} offline={offline} onAck={onAck} onDismiss={onDismiss} modeClassName={desktop ? DESKTOP_ISLAND : undefined} continuousElapsed />
    );
    const dock = (
        <DockZone open={notices.length > 0} desktop={desktop}>
            <NoticeDock notices={notices} desktop={desktop} onAction={onAction} onDismiss={onDismiss} />
        </DockZone>
    );

    return (
        <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
            {desktop ? (
                <DesktopLight live={live} framed={framed} screen={screen} onScreen={setScreen} island={island} dock={dock} sendCue={sendCue} history={history.entries} />
            ) : (
                <MobileLight live={live} framed={framed} screen={screen} onScreen={setScreen} island={island} dock={dock} sendCue={sendCue} history={history.entries} />
            )}
            <Announcer toasts={toasts} />
        </div>
    );
}

/* ───────────── 큐 기록 (보낸 큐 + 받은 큐) ───────────── */

interface HistoryEntry {
    id: string;
    label: string;
    /** 보낸 사람 — 내가 보낸 큐는 '나' */
    from: string;
    target: string;
    at: string;
}

const MAX_HISTORY = 8;

function withNewest(entries: HistoryEntry[], fresh: HistoryEntry[]) {
    // 목업 시각: 새 큐가 오면 '방금' 이던 큐는 '1분 전' 으로
    return [...fresh, ...entries.map((entry) => (entry.at === '방금' ? { ...entry, at: '1분 전' } : entry))].slice(0, MAX_HISTORY);
}

/**
 * 최근 큐 — 시안의 큐 기록에 내가 보낸 큐와 셸에서 받은 큐(알림)를 더합니다.
 * 받은 큐는 알림이 사라져도 여기 남아서, 아일랜드를 놓친 사람도 마지막 큐를 볼 수 있습니다.
 */
function useCueHistory(toasts: DraftToast[]) {
    const [state, setState] = useState<{ seen: string; entries: HistoryEntry[] }>(() => ({
        seen: '',
        entries: DRAFT_CUE_LOG.map((entry) => ({ id: entry.id, label: entry.label, from: entry.from, target: targetLabel(entry.target), at: entry.at })),
    }));
    const seq = useRef(0);

    // 새로 들어온 받은 큐만 앞에 더합니다 (렌더 중 상태 맞추기 — 효과 대신)
    const incoming = toasts.filter((toast) => toast.kind === 'cue-all' || toast.kind === 'cue-role');
    const seen = incoming.map((toast) => toast.id).join(' ');
    if (seen !== state.seen) {
        const known = new Set(state.entries.map((entry) => entry.id));
        const fresh = incoming
            .filter((toast) => !known.has(toast.id))
            .map((toast) => ({ id: toast.id, label: toast.title, from: toast.from ?? '팀', target: toast.target ?? '전체', at: '방금' }));
        setState({ seen, entries: fresh.length > 0 ? withNewest(state.entries, fresh) : state.entries });
    }

    const record = useCallback((label: string, target: string) => {
        seq.current += 1;
        const entry = { id: `mine-${seq.current}`, label, from: '나', target, at: '방금' };
        setState((current) => ({ ...current, entries: withNewest(current.entries, [entry]) }));
    }, []);

    return { entries: state.entries, record };
}

/* ───────────── 모바일 ───────────── */

type MobileSheet = 'order' | 'more';

interface MobileLightProps {
    live: MockLive;
    framed: boolean;
    screen: Screen;
    onScreen: (screen: Screen) => void;
    island: ReactNode;
    dock: ReactNode;
    sendCue: (cue: DraftCue) => void;
    history: HistoryEntry[];
}

function MobileLight({ live, framed, screen, onScreen, island, dock, sendCue, history }: MobileLightProps) {
    const [sheet, setSheet] = useState<MobileSheet | null>(null);
    const [myRole, setMyRole] = useState<DraftRole>('instrument');
    const toggles = useDeviceToggles(framed);
    const returnFocus = useRef<HTMLElement | null>(null);
    const locked = toggles.locked;
    const pulse = screen === 'pulse';
    const atEnd = live.nextSection === null && live.nextSong === null;
    const atStart = live.sectionIndex === 0 && live.songIndex === 0;

    function openSheet(kind: MobileSheet) {
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
        // group/screen: 아일랜드가 펼쳐진 동안 곡 줄이 잠시 물러납니다 · container: 화면 높이에 맞춰 지금 카드 · 송폼을 고릅니다
        <div className="group/screen relative flex h-full w-full flex-col [container-type:size]">
            <div inert={sheet !== null} className="flex min-h-0 flex-1 flex-col">
                {/* 위: 나가기 · 큐 아일랜드 · 더보기 — 세 화면 모두 같은 막대 */}
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
                            aria-label={`더보기, 팀 ${DRAFT_TEAM.length}명 중 ${ONLINE.length}명 접속 · 최근 큐`}
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
                    {/* 곡 줄: 곡 · Key · 박에 맞춰 뛰는 BPM — 세 화면 모두 같은 자리, 같은 박 시계 */}
                    <div className="shrink-0 transition-opacity duration-200 group-has-[[data-island-open]]/screen:pointer-events-none group-has-[[data-island-open]]/screen:opacity-0 motion-reduce:transition-none">
                        <SongStrip
                            live={live}
                            onOrder={() => openSheet('order')}
                            beat={<TempoBeat bpm={live.bpm} meter={live.song.meter} resetKey={`${beatKey(live)}-${pulse ? 'pulse' : 'main'}`} />}
                        />
                    </div>

                    {pulse ? (
                        <>
                            <div className="flex min-h-0 flex-1 flex-col px-5 pt-1">
                                <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={beatKey(live)} bars={barsOf(live)} tempo={false} />
                            </div>
                            <SectionNow live={live} />
                        </>
                    ) : (
                        // 가운데: 지금 카드 또는 악보 — 자랄 수 있는 유일한 스크롤 영역
                        <FadeScroller>
                            {screen === 'now' ? (
                                <>
                                    <NowCard live={live} />
                                    {live.song.note ? (
                                        <p className={cn('hidden shrink-0 truncate rounded-2xl px-4 py-2.5 text-sm leading-snug [@container(min-height:760px)]:block', TONE_BLOCK.peach)}>
                                            <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
                                            {live.song.note}
                                        </p>
                                    ) : null}
                                    {/* 송폼은 화면이 넉넉할 때만 — 지금 카드 바로 아래, 빠른 큐와 떨어진 자리 (작은 화면은 악보 화면에서 섹션을 고릅니다) */}
                                    <div className="-mx-4 shrink-0 pb-1 [@container(max-height:719px)]:hidden">
                                        <FormRow live={live} />
                                    </div>
                                    <NextUp live={live} />
                                </>
                            ) : (
                                <ScoreView live={live} />
                            )}
                        </FadeScroller>
                    )}
                </div>

                {/* 앱 알림 — 넘김 버튼 바로 위. 알림이 오면 이 줄이 열리고 가운데가 그만큼 비켜 줍니다 (버튼은 가리지 않음) */}
                {dock}

                {/* 엄지 자리 (세 화면 모두 같음): 빠른 큐 → 이전 · 다음 → 화면 바꾸기 */}
                <div className={cn('shrink-0 bg-background pt-2.5', framed ? 'pb-5' : 'pb-[max(env(safe-area-inset-bottom),0.5rem)]')}>
                    <div inert={locked} className={cn('px-4 transition-opacity', locked && 'opacity-40')}>
                        <QuickCues onSend={sendCue} />
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
                        </div>
                    )}
                    <div inert={locked} className={cn('px-4 pt-2.5 transition-opacity', locked && 'opacity-40')}>
                        <ViewSwitch label="화면" value={screen} options={MOBILE_SCREENS} onChange={onScreen} className="w-full" />
                    </div>
                </div>
            </div>

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
                <Sheet eyebrow="화면 · 연결 · 큐" title="더보기" focusOnOpen onClose={closeSheet}>
                    <div className="space-y-7">
                        <MoreSheetBody
                            device={toggles}
                            framed={framed}
                            myRole={myRole}
                            onRole={setMyRole}
                            online={ONLINE.length}
                            onLock={() => {
                                toggles.setLocked(true);
                                returnFocus.current = null;
                                setSheet(null);
                            }}
                        />
                        <RecentCueList entries={history} />
                    </div>
                </Sheet>
            ) : null}
        </div>
    );
}

/**
 * 가운데 스크롤 영역. 내용이 넘칠 때만(앱 알림 줄이 열렸거나 화면이 낮을 때) 아래 끝을 흐리게 해서,
 * 다음 섹션 가사나 송폼 칩이 반쯤 잘린 채로 보이지 않고 '아래에 더 있음' 으로 읽히게 합니다. 끝까지 내리면 흐림이 사라집니다.
 */
function FadeScroller({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            // 아래 여백(pb-3)만 넘치는 건 잘린 게 아니므로 흐리지 않습니다
            const padding = parseFloat(getComputedStyle(el).paddingBottom) || 0;
            setFade(el.scrollHeight - el.clientHeight - el.scrollTop > padding + 1);
        };
        const resize = new ResizeObserver(update);
        // 지금 ↔ 악보로 바뀌면 안의 내용이 통째로 바뀌므로 다시 지켜봅니다
        const watch = () => {
            resize.disconnect();
            resize.observe(el);
            for (const child of Array.from(el.children)) resize.observe(child);
            update();
        };
        const mutation = new MutationObserver(watch);
        mutation.observe(el, { childList: true });
        watch();
        el.addEventListener('scroll', update, { passive: true });
        return () => {
            resize.disconnect();
            mutation.disconnect();
            el.removeEventListener('scroll', update);
        };
    }, []);

    return (
        <div
            ref={ref}
            className={cn(
                'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3 pt-0.5 [scrollbar-width:none]',
                fade && 'mask-b-from-[calc(100%-2rem)]',
            )}
        >
            {children}
        </div>
    );
}

/** 더보기 시트 맨 아래: 최근 큐 (보내기는 엄지 자리의 빠른 큐가 맡고, 여기는 보기만) */
function RecentCueList({ entries }: { entries: HistoryEntry[] }) {
    return (
        <section aria-label="최근 큐">
            <h3 className="text-xs font-medium text-muted-foreground">최근 큐</h3>
            <ul className="mt-1 divide-y divide-border">
                {entries.map((entry) => {
                    const mine = entry.from === '나';
                    return (
                        <li key={entry.id} className="flex items-center gap-3 py-3">
                            <Avatar name={entry.from} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold tracking-tight">{entry.label}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {mine ? '내가 보냄' : entry.from} → {entry.target}
                                </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{entry.at}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
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
    sendCue: (cue: DraftCue) => void;
    history: HistoryEntry[];
}

function DesktopLight({ live, framed, screen, onScreen, island, dock, sendCue, history }: DesktopLightProps) {
    const pulse = screen === 'pulse';
    return (
        <DesktopStage
            framed={framed}
            live={live}
            hideStatus
            headerBeat={<TempoBeat bpm={live.bpm} meter={live.song.meter} resetKey={`${beatKey(live)}-${pulse ? 'pulse' : 'main'}`} desktop />}
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
            footerCues={<QuickCues onSend={sendCue} desktop />}
            footerEnd={<FooterStatus entries={history} />}
            // 큐 기록을 '최근 큐' 로 바꿨으므로 그 기록을 거르던 '큐 받을 대상' 설정은 뺍니다 (모바일 더보기와 같은 '내 역할' 만)
            cueScopeSetting={false}
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

/** 코드 차트 자리에 들어가는 펄스 — BPM 은 위 막대, 지금 · 다음 섹션과 송폼은 오른쪽 레일이 그대로 보여 줍니다 */
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
                <BeatHero bpm={live.bpm} meter={live.song.meter} resetKey={beatKey(live)} bars={bars} desktop tempo={false} />
            </div>
        </section>
    );
}

/** 아래 막대 오른쪽: 최근 큐 (보내기 묶음이 작아져 생긴 자리) · 넓으면 팀 접속 */
function FooterStatus({ entries }: { entries: HistoryEntry[] }) {
    const shown = entries.slice(0, 2);
    return (
        <div className="flex min-w-0 items-center gap-5">
            <section aria-label="최근 큐" className="flex min-w-0 items-center gap-4">
                <p className="shrink-0 text-xs font-medium text-muted-foreground">최근 큐</p>
                <ol className="flex min-w-0 items-center gap-4">
                    {shown.map((entry, index) => {
                        const mine = entry.from === '나';
                        return (
                            <li
                                key={entry.id}
                                className={cn(
                                    'flex min-w-0 items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none',
                                    index > 0 && 'hidden border-l border-border pl-4 opacity-60 @min-[1360px]:flex',
                                )}
                            >
                                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', mine ? 'bg-brand' : index === 0 && entry.at === '방금' ? 'bg-secondary' : 'bg-muted-foreground/40')} />
                                <span className="min-w-0">
                                    <span className="block max-w-56 truncate text-sm font-semibold leading-tight">{entry.label}</span>
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                        {mine ? '내가 보냄' : entry.from} → {entry.target} · {entry.at}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </section>
            <p
                aria-label={`팀 ${DRAFT_TEAM.length}명 중 ${ONLINE.length}명 접속`}
                className="hidden shrink-0 items-center gap-2 border-l border-border pl-5 text-xs text-muted-foreground @min-[1200px]:flex"
            >
                <AvatarStack names={ONLINE.map((member) => member.name)} max={3} size="xs" />
                <span className="tabular-nums" aria-hidden="true">
                    <span className="font-semibold text-foreground">{ONLINE.length}</span>/{DRAFT_TEAM.length} 접속
                </span>
                {ANYONE_OFFLINE ? <span aria-hidden="true" className="size-1.5 rounded-full bg-secondary" /> : null}
            </p>
        </div>
    );
}

/* ───────────── 공통: 빠른 큐 ───────────── */

/** 큐 보내기 = 늘 보이는 버튼 세 개. 한 번 누르면 바로 갑니다 (시트 · 팝업 · 받는 사람 고르기 없음) */
function QuickCues({ onSend, desktop = false }: { onSend: (cue: DraftCue) => void; desktop?: boolean }) {
    return (
        <div role="group" aria-label="큐 바로 보내기" className={cn('flex items-center', desktop ? 'shrink-0 gap-2' : 'gap-2')}>
            {desktop ? (
                <span aria-hidden="true" className="mr-1.5 flex shrink-0 flex-col text-xs leading-tight">
                    <span className="font-semibold">큐 보내기</span>
                    <span className="text-muted-foreground">누르면 바로</span>
                </span>
            ) : null}
            {QUICK_CUES.map((cue) => (
                <QuickCueButton key={cue.id} cue={cue} onSend={onSend} desktop={desktop} />
            ))}
        </div>
    );
}

function QuickCueButton({ cue, onSend, desktop }: { cue: DraftCue; onSend: (cue: DraftCue) => void; desktop: boolean }) {
    const [sent, setSent] = useState(false);
    const busy = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const target = targetLabel(cue.target);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    function send() {
        // 보낸 뒤 1.2초 동안은 다시 눌러도 한 번만 갑니다 (두 번 눌림 방지)
        if (busy.current) return;
        busy.current = true;
        setSent(true);
        onSend(cue);
        timer.current = setTimeout(() => {
            busy.current = false;
            setSent(false);
        }, SENT_MS);
    }

    return (
        <button
            type="button"
            onClick={send}
            aria-label={`${cue.label} 큐를 ${target}에게 바로 보내기`}
            aria-disabled={sent || undefined}
            className={cn(
                buttonVariants({ variant: sent ? 'brand' : 'secondary' }),
                'h-12 flex-col gap-0 leading-tight',
                desktop ? 'w-28 shrink-0 px-3' : 'min-w-0 flex-1 px-2',
                sent && 'hover:bg-brand',
            )}
        >
            {sent ? (
                <>
                    <span className="inline-flex items-center gap-1 text-[15px] font-semibold animate-success-bounce">
                        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                        보냄
                    </span>
                    <span className="text-[11px] font-medium text-brand-foreground/75">{target}에게</span>
                </>
            ) : (
                <>
                    <span className="max-w-full truncate text-[15px] font-semibold">{cue.label}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{target}</span>
                </>
            )}
        </button>
    );
}

/* ───────────── 공통: 화면 바꾸기 ───────────── */

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
                            // 보이는 칩은 36px, 누르는 자리는 트랙 여백까지 44px (after: 로 위아래 4px 넓힘)
                            'relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm outline-none transition-colors after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-[3px] focus-visible:ring-ring',
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

/* ───────────── 공통: 박에 맞춰 뛰는 BPM ───────────── */

type BeatHit = 'down' | 'beat' | null;

/**
 * 곡 줄(모바일) · 위 막대(데스크톱)의 BPM — 두 화면 모두 박 시계(useMockPulse)에 맞춰 움직입니다.
 * - 점: 한 마디의 박이 차례로 켜집니다. 4/4 는 4개, 6/8 은 3+3 으로 묶은 6개. 1박은 초록.
 * - 숫자: BPM 이 세는 박(4/4 는 매 박, 6/8 은 1 · 4박)마다 살짝 뛰고, 센박(1)에서 가장 크게 · 초록으로.
 * 박마다 두 번 다시 그려지므로 박 시계는 이 작은 부품 안에만 둡니다.
 * 동작 줄이기: 크기 · 색 깜빡임 없이 켜진 점만 옮겨 갑니다.
 */
function TempoBeat({ bpm, meter, resetKey, desktop = false }: { bpm: number; meter: string; resetKey: string; desktop?: boolean }) {
    const pulse = useMockPulse({ bpm, meter, resetKey });
    const beats = Array.from({ length: pulse.beatsPerBar }, (_, index) => index + 1);
    const groups = pulse.beatsPerBar === 6 ? [beats.slice(0, 3), beats.slice(3)] : [beats];
    const countsBpm = pulse.beatsPerBar !== 6 || pulse.downbeat || pulse.secondary;
    const hit: BeatHit = pulse.count > 0 && pulse.blink && countsBpm ? (pulse.downbeat ? 'down' : 'beat') : null;

    return (
        <span role="img" aria-label={`${bpm} BPM, ${meter}`} className={cn('inline-flex shrink-0 items-center', desktop ? 'gap-3' : 'gap-2.5')}>
            <BpmNumber bpm={bpm} hit={hit} desktop={desktop} />
            {/* 6/8 은 3+3 — 묶음 사이를 박 사이보다 두 배 넘게 띄웁니다 */}
            <span aria-hidden="true" className={cn('flex items-center', desktop ? 'gap-3' : 'gap-3.5')}>
                {groups.map((group) => (
                    <span key={group[0]} className="flex items-center gap-1.5">
                        {group.map((beat) => {
                            const on = beat === pulse.count;
                            return (
                                <span
                                    key={beat}
                                    className={cn(
                                        'rounded-full transition-[scale,background-color] duration-100 motion-reduce:transition-none',
                                        // 1박은 짧은 막대 — 펄스의 넓은 첫 박 막대와 같은 모양이라, 밝은 화면에서도(초록이 검정과 비슷해도) 어디가 1인지 바로 보입니다
                                        desktop ? cn('h-2', beat === 1 ? 'w-3.5' : 'w-2') : cn('h-2.5', beat === 1 ? 'w-[18px]' : 'w-2.5'),
                                        on ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
                                        on && pulse.blink && (beat === 1 ? 'motion-safe:scale-140' : 'motion-safe:scale-125'),
                                    )}
                                />
                            );
                        })}
                    </span>
                ))}
            </span>
            {/* 박자표: 모바일 곡 줄에만 (데스크톱은 악보 · 펄스 열 맨 위 줄이 보여 줍니다) */}
            {desktop ? null : (
                <span aria-hidden="true" className="text-muted-foreground">
                    {meter}
                </span>
            )}
        </span>
    );
}

/**
 * BPM 숫자. 박에 맞춰 살짝 뛰고(hit), 값이 바뀌면(곡 바꿈) 이전 숫자가 위 · 아래로 빠지며 새 숫자가 들어와 잠깐 초록으로 남습니다.
 */
function BpmNumber({ bpm, hit, desktop }: { bpm: number; hit: BeatHit; desktop: boolean }) {
    const [shown, setShown] = useState<{ bpm: number; prev: number | null; seq: number }>({ bpm, prev: null, seq: 0 });
    if (shown.bpm !== bpm) setShown({ bpm, prev: shown.bpm, seq: shown.seq + 1 });
    // 바뀐 숫자는 1.2초 동안 초록으로 — 타이머가 끝나면 '확인함' 으로 표시
    const [settled, setSettled] = useState(0);
    useEffect(() => {
        if (shown.seq === 0) return;
        const timer = setTimeout(() => setSettled(shown.seq), 1200);
        return () => clearTimeout(timer);
    }, [shown.seq]);
    const fresh = shown.seq > 0 && settled !== shown.seq;
    const up = shown.prev !== null && shown.bpm > shown.prev;

    return (
        <span aria-hidden="true" className="inline-flex items-baseline gap-1.5">
            <span
                className={cn(
                    'relative inline-flex origin-bottom overflow-hidden font-semibold tabular-nums transition-[scale,color] duration-100 ease-out motion-reduce:transition-none',
                    desktop ? 'text-[17px]' : 'text-[15px]',
                    hit === 'down' && 'motion-safe:scale-[1.16] motion-safe:text-brand',
                    hit === 'beat' && 'motion-safe:scale-[1.08]',
                )}
            >
                {shown.prev !== null ? (
                    <span
                        key={`out-${shown.seq}`}
                        className={cn('absolute inset-0 animate-out fade-out fill-mode-forwards duration-300 ease-in motion-reduce:hidden', up ? 'slide-out-to-top-full' : 'slide-out-to-bottom-full')}
                    >
                        {shown.prev}
                    </span>
                ) : null}
                <span
                    key={`in-${shown.seq}`}
                    className={cn(
                        'transition-colors duration-700',
                        shown.prev !== null && ['animate-in fade-in animation-duration-300 motion-reduce:animate-none', up ? 'slide-in-from-bottom-full' : 'slide-in-from-top-full'],
                        fresh && 'motion-safe:text-brand',
                    )}
                >
                    {shown.bpm}
                </span>
            </span>
            <span className={cn('font-medium text-muted-foreground', desktop ? 'text-xs' : 'text-[13px]')}>BPM</span>
        </span>
    );
}
