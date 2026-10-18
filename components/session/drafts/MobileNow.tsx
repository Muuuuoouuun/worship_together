'use client';

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Ellipsis,
    FileMusic,
    ListMusic,
    Lock,
    Maximize,
    Megaphone,
    SunMedium,
    Wifi,
    X,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import BeatIndicator from '@/components/session/BeatIndicator';
import { Avatar, TONE_BLOCK } from '@/components/conti/ui';
import {
    CUE_GROUP_LABEL,
    DRAFT_CUES,
    DRAFT_ELAPSED,
    DRAFT_SERVICE,
    DRAFT_TEAM,
    ROLE_LABEL,
    useMockLive,
    type CueGroup,
    type CueLogEntry,
    type DraftCue,
    type DraftRole,
    type DraftSong,
    type MockLive,
} from './mockLive';
import type { DraftScreenProps } from './types';

/*
 * 모바일 A · 지금 카드 — 악기 팀원이 한 손으로 따라가는 화면.
 * 가운데 '지금' 카드에 현재 섹션·가사·코드, 아래 엄지 자리에 넘김과 큐.
 * 역할·동기화 같은 설정은 더보기 시트 뒤로 숨깁니다.
 */

export type SheetKind = 'cue' | 'order' | 'more';
export type Recipient = 'all' | 'instrument' | 'sound' | 'media';

export const ME = { name: '이은혜', part: '건반' };

const RECIPIENTS: { id: Recipient; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'instrument', label: '악기' },
    { id: 'sound', label: '음향' },
    { id: 'media', label: '미디어' },
];

const CUE_GROUPS = Object.keys(CUE_GROUP_LABEL) as CueGroup[];
const ROLES = Object.keys(ROLE_LABEL) as DraftRole[];

function targetName(target: DraftRole | 'all') {
    if (target === 'all') return '전체';
    if (target === 'leader') return '인도자';
    return `${ROLE_LABEL[target]}팀`;
}

function toWhom(target: DraftRole | 'all') {
    return target === 'all' ? '전체에게' : `${targetName(target)}에게`;
}

/** 악보 쪽 — mockLive 와 같은 계산 (섹션 위치를 쪽 수에 고르게 나눔) */
function pageOf(song: DraftSong, sectionIndex: number) {
    return Math.min(song.pages, Math.floor((sectionIndex / song.form.length) * song.pages) + 1);
}

export default function MobileNow({ framed = false, alt = false }: DraftScreenProps) {
    const live = useMockLive();
    const [sheet, setSheet] = useState<SheetKind | null>(alt ? 'cue' : null);
    const [sheetByUser, setSheetByUser] = useState(false);
    const [view, setView] = useState<'now' | 'score'>('now');
    const [acked, setAcked] = useState<string[]>([]);
    const [recipient, setRecipient] = useState<Recipient>('all');
    const [myRole, setMyRole] = useState<DraftRole>('instrument');
    const device = useDeviceToggles(framed);
    const returnFocus = useRef<HTMLElement | null>(null);

    const latest = live.log[0];
    const received = latest && latest.from !== '나' && !acked.includes(latest.id) ? latest : null;
    const online = DRAFT_TEAM.filter((member) => member.online).length;
    const anyOffline = online < DRAFT_TEAM.length;
    const atEnd = live.nextSection === null && live.nextSong === null;
    const atStart = live.sectionIndex === 0 && live.songIndex === 0;
    const locked = device.locked;

    function openSheet(kind: SheetKind) {
        // 시트가 열리면 뒤 화면이 inert 가 되어 포커스가 풀리므로, 연 버튼을 미리 기억해 둡니다.
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSheetByUser(true);
        setSheet(kind);
    }

    function closeSheet() {
        setSheet(null);
        const target = returnFocus.current;
        returnFocus.current = null;
        if (target) requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }

    function sendCue(cue: DraftCue) {
        live.sendCue(cue);
        closeSheet();
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground [container-type:size]">
            <div inert={sheet !== null} className="flex min-h-0 flex-1 flex-col">
                {/* 잠금 중에는 위·가운데·송폼이 눌리지 않고, 아래 잠금 풀기만 남습니다 */}
                <div inert={locked} className="flex min-h-0 flex-1 flex-col">
                    <Header framed={framed} online={online} anyOffline={anyOffline} onMore={() => openSheet('more')} />
                    <SongStrip live={live} onOrder={() => openSheet('order')} />

                    {/* 가운데: 받은 큐 + 지금 카드 (또는 악보) — 자랄 수 있는 유일한 스크롤 영역 */}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3 pt-0.5 [scrollbar-width:none]">
                            <div aria-live="polite" className="shrink-0 empty:hidden">
                                {received ? <ReceivedBanner entry={received} onAck={() => setAcked((ids) => [...ids, received.id])} /> : null}
                            </div>
                            {view === 'now' ? (
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
                        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
                            {live.flash ? <SentToast entry={live.flash} /> : null}
                        </div>
                    </div>
                </div>

                {/* 엄지 자리: 송폼 → 넘김·큐 → 악보·순서 (음악 앱의 재생 화면처럼) */}
                <div className={cn('shrink-0 bg-background pt-1', framed ? 'pb-5' : 'pb-[max(env(safe-area-inset-bottom),0.5rem)]')}>
                    <div inert={locked}>
                        <FormRow live={live} />
                    </div>
                    {locked ? (
                        <div className="px-4 pt-2.5">
                            <HoldToUnlock onUnlock={() => device.setLocked(false)} />
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
                                    <span className="max-w-full truncate text-xs font-medium text-primary-foreground/60">
                                        {live.nextSection ?? live.nextSong?.title ?? '예배 마무리'}
                                    </span>
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
                    <div inert={locked} className={cn('flex items-center justify-between px-4 pt-1 transition-opacity', locked && 'opacity-40')}>
                        <button
                            type="button"
                            aria-pressed={view === 'score'}
                            onClick={() => setView((current) => (current === 'score' ? 'now' : 'score'))}
                            className={cn(
                                buttonVariants({ variant: 'ghost', size: 'sm' }),
                                '-ml-3 h-10 px-3 text-[13px] font-medium has-[>svg]:px-3',
                                view === 'score' ? 'bg-muted text-foreground' : 'text-muted-foreground',
                            )}
                        >
                            <FileMusic className="size-[18px]" aria-hidden="true" />
                            악보
                        </button>
                        <button
                            type="button"
                            onClick={() => openSheet('order')}
                            aria-haspopup="dialog"
                            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-mr-3 h-10 px-3 text-[13px] font-medium text-muted-foreground has-[>svg]:px-3')}
                        >
                            순서
                            <ListMusic className="size-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 보낸 큐 알림 — 뒤 화면이 inert 일 때도 읽히도록 바깥에 둔 스크린리더용 영역 (보이는 알약은 위에) */}
            <p role="status" aria-live="polite" className="sr-only">
                {live.flash ? `${live.flash.label} 큐를 ${toWhom(live.flash.target)} 보냈어요` : ''}
            </p>

            {sheet === 'cue' ? (
                <Sheet eyebrow={`${ME.name} · ${ME.part}`} title="큐 보내기" tall focusOnOpen={sheetByUser} onClose={closeSheet}>
                    <CueSheetBody log={live.log} recipient={recipient} onRecipient={setRecipient} onSend={sendCue} />
                </Sheet>
            ) : null}
            {sheet === 'order' ? (
                <Sheet eyebrow={`${DRAFT_SERVICE.theme} · ${live.songs.length}곡`} title="순서" focusOnOpen={sheetByUser} onClose={closeSheet}>
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
                <Sheet eyebrow="화면 · 연결" title="더보기" focusOnOpen={sheetByUser} onClose={closeSheet}>
                    <MoreSheetBody
                        device={device}
                        framed={framed}
                        myRole={myRole}
                        onRole={setMyRole}
                        online={online}
                        onLock={() => {
                            device.setLocked(true);
                            returnFocus.current = null;
                            setSheet(null);
                        }}
                    />
                </Sheet>
            ) : null}
        </div>
    );
}

/* ───────────── 위: 예배 · 곡 ───────────── */

function Header({ framed, online, anyOffline, onMore }: { framed: boolean; online: number; anyOffline: boolean; onMore: () => void }) {
    return (
        <header className={cn('flex shrink-0 items-center gap-1.5 px-2.5', framed ? 'pt-5' : 'pt-[max(env(safe-area-inset-top),0.25rem)]')}>
            <Link href="/session/drafts" aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                <ChevronLeft className="size-[22px]" aria-hidden="true" />
            </Link>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">{DRAFT_SERVICE.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="relative flex size-1.5" aria-hidden="true">
                        <span className="absolute inset-0 rounded-full bg-brand motion-safe:animate-ping motion-safe:opacity-60" />
                        <span className="relative size-1.5 rounded-full bg-brand" />
                    </span>
                    <span className="font-medium text-brand">진행 중</span>
                    <span aria-hidden="true">·</span>
                    <Elapsed />
                </p>
            </div>
            <button
                type="button"
                onClick={onMore}
                aria-label={`동기화됨, 팀 ${DRAFT_TEAM.length}명 중 ${online}명 접속`}
                className="relative inline-flex h-11 shrink-0 items-center rounded-full px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset ring-border">
                    <Wifi className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="tabular-nums">
                        {online}/{DRAFT_TEAM.length}
                    </span>
                </span>
                {anyOffline ? <span aria-hidden="true" className="absolute right-1 top-1.5 size-2 rounded-full bg-secondary ring-2 ring-background" /> : null}
            </button>
            <button type="button" onClick={onMore} aria-label="더보기" aria-haspopup="dialog" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                <Ellipsis className="size-5" aria-hidden="true" />
            </button>
        </header>
    );
}

function Elapsed() {
    const [seconds, setSeconds] = useState(() => {
        const [m, s] = DRAFT_ELAPSED.split(':').map(Number);
        return m * 60 + s;
    });
    useEffect(() => {
        const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return (
        <span className="tabular-nums" aria-label={`경과 ${text}`}>
            {text}
        </span>
    );
}

/** @param beat 박자 점 · BPM · 박자표 자리를 통째로 바꿉니다 (없으면 4박 점 · BPM · 박자표) */
export function SongStrip({ live, onOrder, beat }: { live: MockLive; onOrder: () => void; beat?: ReactNode }) {
    const { song } = live;
    return (
        <section aria-label="지금 곡" className="shrink-0 px-5 pb-3 pt-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 truncate text-[23px] font-semibold leading-tight tracking-tight">{song.title}</h2>
                <button
                    type="button"
                    onClick={onOrder}
                    aria-haspopup="dialog"
                    className="relative -mr-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-2 pr-1 text-[13px] text-muted-foreground outline-none after:absolute after:-inset-y-1.5 after:inset-x-0 focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    <span className="sr-only">순서 </span>
                    <span className="tabular-nums">
                        {live.songIndex + 1}/{live.songs.length}곡
                    </span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[13px]">
                <span className="inline-flex h-7 items-center rounded-full bg-muted px-3 text-[15px] font-semibold">
                    <span className="mr-1 text-xs font-medium text-muted-foreground">Key</span>
                    {song.key}
                </span>
                {beat ?? <BeatIndicator bpm={live.bpm} enabled>
                    {(activeBeat, blink) => (
                        <span className="inline-flex items-center gap-2.5">
                            <span aria-hidden="true" className="flex items-center gap-1.5">
                                {[1, 2, 3, 4].map((beat) => (
                                    <span
                                        key={beat}
                                        className={cn(
                                            'size-2.5 rounded-full transition-transform duration-100',
                                            beat === activeBeat ? (beat === 1 ? 'bg-brand' : 'bg-foreground') : 'bg-foreground/15',
                                            beat === activeBeat && blink && 'scale-125',
                                        )}
                                    />
                                ))}
                            </span>
                            <span>
                                <span className="text-[15px] font-semibold tabular-nums">{live.bpm}</span>
                                <span className="ml-1 text-muted-foreground">BPM</span>
                            </span>
                        </span>
                    )}
                </BeatIndicator>}
                {beat ? null : <span className="text-muted-foreground">{song.meter}</span>}
            </div>
        </section>
    );
}

/* ───────────── 가운데: 지금 카드 · 악보 ───────────── */

function ReceivedBanner({ entry, onAck }: { entry: CueLogEntry; onAck: () => void }) {
    return (
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-card pl-4 pr-1 [@container(max-height:740px)]:h-11">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" />
            <p className="min-w-0 flex-1 truncate text-[15px]">
                <span className="sr-only">받은 큐: </span>
                <span className="font-semibold">{entry.label}</span>
                <span className="text-muted-foreground">
                    {' '}
                    · {entry.from} · {entry.at}
                </span>
            </p>
            <button type="button" onClick={onAck} aria-label={`${entry.label} 큐 확인`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-10 px-3.5 text-[13px]')}>
                확인
            </button>
        </div>
    );
}

export function NowCard({ live }: { live: MockLive }) {
    const { song, section } = live;
    const chords = song.chords[section] ?? [];

    return (
        // 남는 높이는 카드가 차지하고 내용은 세로 가운데 — 코드가 4개뿐이거나 받은 큐가 없어도 빈 구멍이 생기지 않습니다.
        <article
            aria-label="지금 섹션"
            className={cn('flex shrink-0 grow flex-col rounded-3xl px-5 pb-5 pt-4 [@container(max-height:740px)]:pb-4 [@container(max-height:740px)]:pt-3', TONE_BLOCK.mint)}
        >
            {/* 시각적 가운데: 위 2 : 아래 3 으로 남는 높이를 나눠 내용이 살짝 위에 앉습니다 */}
            <span aria-hidden="true" className="grow-[2]" />
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <p className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    지금
                </p>
                <p className="tabular-nums">
                    {live.sectionIndex + 1} / {song.form.length}
                </p>
            </div>
            <p className="mt-1.5 truncate text-[46px] font-semibold leading-[1.08] tracking-tight [@container(max-height:740px)]:mt-1 [@container(max-height:740px)]:text-[42px] [@container(min-height:770px)]:text-[52px]">
                {section}
            </p>
            <p className="mt-1.5 text-[17px] leading-snug text-foreground/80">{song.lyrics[section] ?? ''}</p>

            {chords.length > 0 ? (
                <ol aria-label={`${section} 코드`} className="mt-4 grid grid-cols-4 gap-1.5 [@container(max-height:740px)]:mt-3">
                    {chords.map((chord, index) => (
                        <li key={`${chord}-${index}`} className="flex h-11 min-w-0 items-center justify-center rounded-2xl bg-card px-1 text-[17px] font-semibold tracking-tight [@container(max-height:740px)]:h-10 [@container(min-height:770px)]:h-12 [@container(min-height:770px)]:text-lg">
                            <span className="truncate">{chord}</span>
                        </li>
                    ))}
                </ol>
            ) : null}
            <span aria-hidden="true" className="grow-[3]" />
        </article>
    );
}

/** 다음 섹션 (곡의 끝이면 다음 곡) — 넘김 버튼 바로 위에 둡니다 */
export function NextUp({ live }: { live: MockLive }) {
    const { song, nextSection, nextSong } = live;
    const nextLyric = nextSection ? song.lyrics[nextSection] : null;
    const name = nextSection ?? nextSong?.title ?? '예배 마무리';
    const detail = nextSection ? nextLyric : nextSong ? `Key ${nextSong.key} · ${nextSong.bpm} BPM · ${nextSong.meter}` : '인도자 신호를 기다려요';

    return (
        <section aria-label="다음" className="shrink-0 border-t border-border px-1 pt-3.5">
            <div className="flex items-baseline gap-3">
                <p className="w-11 shrink-0 text-xs font-medium text-muted-foreground">{nextSection || !nextSong ? '다음' : '다음 곡'}</p>
                <p className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground/50">{name}</p>
            </div>
            {detail ? <p className="mt-0.5 truncate pl-14 text-[15px] text-muted-foreground [@container(max-height:660px)]:hidden">{detail}</p> : null}
        </section>
    );
}

export function ScoreView({ live }: { live: MockLive }) {
    const { song } = live;
    const sections = song.form.map((name, index) => ({ name, index })).filter(({ index }) => pageOf(song, index) === live.page);
    const articleRef = useRef<HTMLElement | null>(null);

    // 지금 섹션이 가려져 있으면 가운데 스크롤 영역만 움직여 보이게 합니다 (페이지 전체는 건드리지 않음).
    useEffect(() => {
        const article = articleRef.current;
        const scroller = article?.parentElement;
        const current = article?.querySelector<HTMLElement>('[aria-current="step"]');
        if (!scroller || !current) return;
        const box = scroller.getBoundingClientRect();
        const item = current.getBoundingClientRect();
        if (item.top >= box.top && item.bottom <= box.bottom) return;
        scroller.scrollTo({ top: scroller.scrollTop + item.top - box.top - 12, behavior: 'smooth' });
    }, [live.sectionIndex, live.page, live.songIndex]);

    return (
        <article ref={articleRef} aria-label="악보" className="flex shrink-0 flex-col rounded-3xl border border-border bg-card px-4 pb-4 pt-3.5">
            <div className="flex items-center justify-between gap-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">코드 차트</p>
                <div role="group" aria-label="악보 쪽" className="flex rounded-full bg-muted p-0.5">
                    {Array.from({ length: song.pages }, (_, index) => index + 1).map((page) => (
                        <button
                            key={page}
                            type="button"
                            aria-pressed={page === live.page}
                            onClick={() => live.setPage(page)}
                            className={cn(
                                'h-8 min-w-10 rounded-full px-2.5 text-[13px] font-medium tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                page === live.page ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                            )}
                        >
                            {page}쪽
                        </button>
                    ))}
                </div>
            </div>
            {song.note ? (
                <p className={cn('mt-3 rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', TONE_BLOCK.peach)}>
                    <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
                    {song.note}
                </p>
            ) : null}
            <ol className="mt-2 divide-y divide-border">
                {sections.map(({ name, index }) => {
                    const current = index === live.sectionIndex;
                    return (
                        <li key={`${name}-${index}`}>
                            <button
                                type="button"
                                aria-current={current ? 'step' : undefined}
                                onClick={() => live.goSection(index)}
                                className={cn('-mx-1 my-1 block w-[calc(100%+0.5rem)] rounded-2xl px-2 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring', current ? 'bg-muted' : 'hover:bg-muted/60')}
                            >
                                <span className="flex items-center gap-2">
                                    <span className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold', current ? 'bg-primary text-primary-foreground' : 'text-foreground ring-1 ring-inset ring-border')}>
                                        {name}
                                    </span>
                                    {current ? <span className="text-xs font-medium text-brand">지금</span> : null}
                                </span>
                                <span className="mt-2 grid grid-cols-4 gap-x-1 gap-y-1 px-1 text-[17px] font-semibold tracking-tight">
                                    {(song.chords[name] ?? []).map((chord, chordIndex) => (
                                        <span key={`${chord}-${chordIndex}`} className="truncate">
                                            {chord}
                                        </span>
                                    ))}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </article>
    );
}

function SentToast({ entry }: { entry: CueLogEntry }) {
    return (
        <p className="inline-flex h-11 max-w-full items-center gap-2 rounded-full bg-primary pl-2 pr-4 text-sm font-semibold text-primary-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                <Check className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate">
                {entry.label}
                <span className="font-normal text-primary-foreground/70"> · {toWhom(entry.target)} 보냈어요</span>
            </span>
        </p>
    );
}

/* ───────────── 아래: 송폼 · 잠금 ───────────── */

export function FormRow({ live }: { live: MockLive }) {
    const scroller = useRef<HTMLOListElement | null>(null);
    const first = useRef(true);

    useEffect(() => {
        const list = scroller.current;
        const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
        if (!list || !current) return;
        const left = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, left), behavior: first.current ? 'auto' : 'smooth' });
        first.current = false;
    }, [live.sectionIndex, live.songIndex]);

    return (
        <nav aria-label={`${live.song.title} 송폼`}>
            <ol ref={scroller} className="relative flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {live.song.form.map((name, index) => {
                    const current = index === live.sectionIndex;
                    const done = index < live.sectionIndex;
                    return (
                        <li key={`${name}-${index}`} className="shrink-0">
                            <button
                                type="button"
                                aria-current={current ? 'step' : undefined}
                                onClick={() => live.goSection(index)}
                                className={cn(
                                    'h-11 rounded-full px-4 text-[15px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                    current
                                        ? 'bg-primary font-semibold text-primary-foreground'
                                        : done
                                          ? 'font-medium text-muted-foreground hover:text-foreground'
                                          : 'font-medium text-foreground ring-1 ring-inset ring-border hover:bg-muted',
                                )}
                            >
                                {name}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export function HoldToUnlock({ onUnlock }: { onUnlock: () => void }) {
    const [holding, setHolding] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    function start(event: ReactPointerEvent<HTMLButtonElement>) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setHolding(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            setHolding(false);
            onUnlock();
        }, 700);
    }

    function cancel() {
        setHolding(false);
        if (timer.current) clearTimeout(timer.current);
    }

    return (
        <button
            type="button"
            onPointerDown={start}
            onPointerUp={cancel}
            onPointerCancel={cancel}
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => {
                // 키보드(Enter·Space)는 바로 풀고, 손가락은 길게 눌러야 풉니다.
                if (event.detail === 0) onUnlock();
            }}
            className={cn(buttonVariants({ variant: 'outline' }), 'relative h-14 w-full select-none overflow-hidden text-[15px] [-webkit-touch-callout:none]')}
        >
            <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 bg-muted ease-linear', holding ? 'w-full transition-[width] duration-700' : 'w-0 transition-[width] duration-150')} />
            <span className="relative inline-flex items-center gap-2">
                <Lock className="size-[18px]" aria-hidden="true" />
                길게 눌러 잠금 풀기
            </span>
        </button>
    );
}

/* ───────────── 시트 ───────────── */

export function Sheet({
    eyebrow,
    title,
    tall = false,
    focusOnOpen,
    onClose,
    children,
}: {
    eyebrow: string;
    title: string;
    /** 내용이 바뀌어도 (받는 사람 필터 등) 높이가 출렁이지 않게 고정 높이로 엽니다 */
    tall?: boolean;
    focusOnOpen: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    const titleId = useId();
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const drag = useRef<{ start: number; pointer: number } | null>(null);
    const [dragY, setDragY] = useState(0);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        if (focusOnOpen) closeRef.current?.focus({ preventScroll: true });
    }, [focusOnOpen]);

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if ((event.target as HTMLElement).closest('button')) return;
        drag.current = { start: event.clientY, pointer: event.pointerId };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!drag.current || drag.current.pointer !== event.pointerId) return;
        setDragY(Math.max(0, event.clientY - drag.current.start));
    }

    function onPointerUp() {
        if (!drag.current) return;
        drag.current = null;
        if (dragY > 90) onClose();
        else setDragY(0);
    }

    return (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
            <button type="button" tabIndex={-1} aria-label="시트 닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/35 animate-in fade-in duration-200 dark:bg-background/70" />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
                className={cn(
                    'relative flex min-h-0 flex-col rounded-t-3xl bg-card text-card-foreground shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.25)] animate-in slide-in-from-bottom duration-300 motion-reduce:animate-none dark:ring-1 dark:ring-border',
                    tall ? 'h-[80%]' : 'max-h-[80%]',
                    !dragY && 'transition-transform',
                )}
            >
                <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={cn('shrink-0 touch-none select-none border-b transition-colors', scrolled ? 'border-border' : 'border-transparent')}
                >
                    <div className="flex justify-center pb-1 pt-2.5">
                        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-foreground/15" />
                    </div>
                    <header className="flex items-start justify-between gap-3 pb-3 pl-5 pr-3 pt-1.5">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-muted-foreground">{eyebrow}</p>
                            <h2 id={titleId} className="mt-0.5 text-lg font-semibold tracking-tight">
                                {title}
                            </h2>
                        </div>
                        <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-muted-foreground')}>
                            <X className="size-5" aria-hidden="true" />
                        </button>
                    </header>
                </div>
                <div onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 2)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
                    {children}
                </div>
            </section>
        </div>
    );
}

export function CueSheetBody({ log, recipient, onRecipient, onSend }: { log: CueLogEntry[]; recipient: Recipient; onRecipient: (value: Recipient) => void; onSend: (cue: DraftCue) => void }) {
    const cues = recipient === 'all' ? DRAFT_CUES : DRAFT_CUES.filter((cue) => cue.target === recipient);
    const groups = CUE_GROUPS.map((group) => ({ group, cues: cues.filter((cue) => cue.group === group) })).filter((entry) => entry.cues.length > 0);

    return (
        <div className="space-y-6">
            <div>
                <p className="text-xs font-medium text-muted-foreground">받는 사람</p>
                <div role="radiogroup" aria-label="받는 사람" className="mt-2 grid grid-cols-4 rounded-full bg-muted p-1">
                    {RECIPIENTS.map((option) => {
                        const active = option.id === recipient;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onRecipient(option.id)}
                                className={cn(
                                    'h-10 rounded-full text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                    active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {groups.map(({ group, cues: groupCues }) => (
                <section key={group} aria-label={CUE_GROUP_LABEL[group]}>
                    <h3 className="text-xs font-medium text-muted-foreground">{CUE_GROUP_LABEL[group]}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {groupCues.map((cue) => (
                            <button
                                key={cue.id}
                                type="button"
                                onClick={() => onSend(cue)}
                                className="flex h-16 min-w-0 flex-col items-start justify-center rounded-2xl bg-muted px-4 text-left outline-none transition active:scale-[0.97] hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transform-none"
                            >
                                <span className="max-w-full truncate text-base font-semibold tracking-tight">{cue.label}</span>
                                <span className="mt-0.5 text-xs text-muted-foreground">{targetName(cue.target)}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}

            <section aria-label="최근 큐">
                <h3 className="text-xs font-medium text-muted-foreground">최근 큐</h3>
                <ul className="mt-1 divide-y divide-border">
                    {log.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 py-3">
                            <Avatar name={entry.from === '나' ? '나' : entry.from} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold tracking-tight">{entry.label}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {entry.from === '나' ? '내가' : entry.from} → {targetName(entry.target)}
                                </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{entry.at}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

export function OrderSheetBody({ live, onPick }: { live: MockLive; onPick: (index: number) => void }) {
    return (
        <ol className="divide-y divide-border">
            {live.songs.map((song, index) => {
                const current = index === live.songIndex;
                const done = index < live.songIndex;
                return (
                    <li key={song.id} className="py-1.5">
                        <button
                            type="button"
                            aria-current={current ? 'true' : undefined}
                            onClick={() => onPick(index)}
                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                        >
                            <span className={cn('w-6 shrink-0 text-sm tabular-nums', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{String(index + 1).padStart(2, '0')}</span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-[17px] font-semibold tracking-tight', done && 'text-muted-foreground')}>{song.title}</span>
                                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                                    {song.bpm} BPM · {song.meter} · {song.form.length}섹션
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-[13px] font-semibold">Key {song.key}</span>
                                {current ? <span className="text-xs font-medium text-brand">지금</span> : done ? <span className="text-xs text-muted-foreground">마침</span> : null}
                            </span>
                        </button>
                        {song.note ? (
                            <p className={cn('mb-1.5 ml-[2.375rem] mt-0.5 rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', TONE_BLOCK.peach)}>
                                <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
                                {song.note}
                            </p>
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}

export function MoreSheetBody({
    device,
    framed,
    myRole,
    onRole,
    online,
    onLock,
}: {
    device: DeviceToggles;
    framed: boolean;
    myRole: DraftRole;
    onRole: (role: DraftRole) => void;
    online: number;
    onLock: () => void;
}) {
    return (
        <div className="space-y-7">
            <section aria-label="이 기기">
                <h3 className="text-xs font-medium text-muted-foreground">이 기기{framed ? ' · 시안에서는 표시만 바뀌어요' : ''}</h3>
                <ul className="mt-1 divide-y divide-border">
                    <ToggleRow icon={SunMedium} label="화면 꺼짐 방지" hint="예배 중 화면이 꺼지지 않아요" on={device.awake} onToggle={device.toggleAwake} />
                    <ToggleRow icon={Maximize} label="전체화면" hint="주소창과 상태 막대를 숨겨요" on={device.fullscreen} onToggle={device.toggleFullscreen} />
                    <li className="flex items-center gap-3 py-3">
                        <RowIcon icon={Lock} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold tracking-tight">화면 잠금</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">연주 중 잘못 눌리지 않게 잠가요</p>
                        </div>
                        <button type="button" onClick={onLock} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-4')}>
                            잠그기
                        </button>
                    </li>
                </ul>
            </section>

            <section aria-label="내 역할">
                <h3 className="text-xs font-medium text-muted-foreground">내 역할 · 받을 큐</h3>
                <div role="radiogroup" aria-label="내 역할" className="mt-2 grid grid-cols-4 rounded-full bg-muted p-1">
                    {ROLES.map((role) => {
                        const active = role === myRole;
                        return (
                            <button
                                key={role}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onRole(role)}
                                className={cn(
                                    'h-10 rounded-full text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
                                    active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {ROLE_LABEL[role]}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{ROLE_LABEL[myRole]} 큐와 전체 큐를 받아요</p>
            </section>

            <section aria-label="팀 접속">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground">팀 접속</h3>
                    <p className="text-xs tabular-nums text-muted-foreground">
                        {DRAFT_TEAM.length}명 중 {online}명
                    </p>
                </div>
                <ul className="mt-1 divide-y divide-border">
                    {DRAFT_TEAM.map((member) => (
                        <li key={member.name} className="flex items-center gap-3 py-3">
                            <Avatar name={member.name} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold tracking-tight">
                                    {member.name}
                                    {member.name === ME.name ? <span className="ml-1.5 text-xs font-medium text-muted-foreground">나</span> : null}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.part}</p>
                            </div>
                            {member.online ? (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                                    {member.ack ? `접속 · 큐 ${member.ack}` : '접속'}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-secondary" />
                                    오프라인
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">인도자 김하늘 화면과 함께 넘어가요</p>
            </section>
        </div>
    );
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
            <Icon className="size-[18px]" aria-hidden="true" />
        </span>
    );
}

function ToggleRow({ icon, label, hint, on, onToggle }: { icon: LucideIcon; label: string; hint: string; on: boolean; onToggle: () => void }) {
    const labelId = useId();
    return (
        <li className="flex items-center gap-3 py-3">
            <RowIcon icon={icon} />
            <div className="min-w-0 flex-1">
                <p id={labelId} className="text-[15px] font-semibold tracking-tight">
                    {label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                onClick={onToggle}
                className="flex h-11 shrink-0 items-center rounded-full px-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span className={cn('flex h-7 w-12 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-input')}>
                    <span className={cn('size-6 rounded-full bg-card shadow-sm transition-transform', on && 'translate-x-5')} />
                </span>
            </button>
        </li>
    );
}

/* ───────────── 기기 동작 (시안 틀 안에서는 표시만) ───────────── */

export interface DeviceToggles {
    awake: boolean;
    fullscreen: boolean;
    locked: boolean;
    toggleAwake: () => void;
    toggleFullscreen: () => void;
    setLocked: (locked: boolean) => void;
}

export function useDeviceToggles(framed: boolean): DeviceToggles {
    const [awake, setAwake] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [locked, setLocked] = useState(false);
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

    return { awake, fullscreen, locked, toggleAwake, toggleFullscreen, setLocked };
}
