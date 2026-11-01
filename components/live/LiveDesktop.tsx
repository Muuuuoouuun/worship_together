'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowRightLeft, ChevronLeft, ChevronRight, Ellipsis, FileMusic, Lock, LockOpen, Maximize2, Minimize2, MonitorCheck, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { AvatarStack } from '@/components/conti/ui';
import BeatHero, { NoPulse } from './BeatHero';
import { FollowStatus, IconToggle, ViewSwitch, type SwitchOption } from './Controls';
import CueIsland, { type IslandMode } from './CueIsland';
import { useNavKeys, useOutsideClose, type DeviceToggles } from './hooks';
import NoticeDock, { DockZone } from './NoticeDock';
import QuickCues from './QuickCues';
import ScoreStage from './ScoreStage';
import { MemberList, MoreBody } from './SheetBodies';
import TempoBeat from './TempoBeat';
import { sectionLabel } from './sectionLabel';
import { keyText, type LivePosition } from './derive';
import type { LiveView } from './LiveMobile';
import type { CueDefinition, LiveScreenHandlers, LiveScreenModel, LiveToast } from './model';
import { isFresh, relativeTime, useNow } from './time';

/*
 * 데스크톱 (lg 이상) — 악보와 차분한 펄스.
 * 위 막대: 나가기 · 곡 · Key · 박에 맞춰 뛰는 BPM · 악보 | 펄스 · 기기 동작 · 더보기
 * 가운데: 악보(이 기기에 받은 팀 악보) 또는 펄스 — 맨 위 줄 가운데에 큐 아일랜드
 * 오른쪽 레일: 지금 · 다음 · 메모 · 송폼 · 콘티 순서 · 팀 접속
 * 아래 막대: 이전 · 다음(따라가는 사람은 '따라가는 중') · 빠른 큐 · 최근 큐 · 접속 수
 */

const DESKTOP_SCREENS: SwitchOption<'score' | 'pulse'>[] = [
    { value: 'score', label: '악보', icon: FileMusic },
    { value: 'pulse', label: '펄스', icon: Activity },
];

/** 아일랜드는 위 막대가 아니라 악보 · 펄스 열의 맨 위 줄(높이 56px) 가운데에 섭니다 */
const DESKTOP_ISLAND: Partial<Record<IslandMode, string>> = {
    idle: 'top-7',
    compact: 'top-1.5 max-w-[min(480px,calc(100%-400px))]',
    medium: 'top-1.5 w-[min(440px,calc(100%-32px))]',
    list: 'top-1.5 w-[min(440px,calc(100%-32px))]',
    large: 'top-1.5 w-[min(480px,calc(100%-32px))]',
};

/** 바깥 페이지까지 움직이는 scrollIntoView 대신, 주어진 스크롤 영역 안에서만 움직입니다 */
function scrollWithin(container: HTMLElement, top: number, smooth: boolean) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

export default function LiveDesktop({
    model,
    handlers,
    pos,
    view,
    onView,
    device,
    cues,
    notices,
    onSendCue,
}: {
    model: LiveScreenModel;
    handlers: LiveScreenHandlers;
    pos: LivePosition;
    view: LiveView;
    onView: (view: LiveView) => void;
    device: DeviceToggles;
    cues: LiveToast[];
    notices: LiveToast[];
    onSendCue: (cue: CueDefinition) => Promise<boolean>;
}) {
    const pulse = view === 'pulse';
    const locked = device.locked;
    const { song } = pos;
    const [moreOpen, setMoreOpen] = useState(false);
    const moreTrigger = useRef<HTMLButtonElement | null>(null);
    // Esc 로 닫으면 더보기 버튼으로 포커스를 돌려주고, 바깥을 눌러 닫으면 누른 곳에 그대로 둡니다
    const closeMore = (restoreFocus: boolean) => {
        setMoreOpen(false);
        if (restoreFocus) moreTrigger.current?.focus({ preventScroll: true });
    };
    const moreRef = useOutsideClose(moreOpen, (reason) => closeMore(reason === 'escape'));

    // 악보 화면에서는 뷰어가 같은 키 · 페달로 쪽을 넘기므로, 키보드 넘김은 펄스 화면에서만
    useNavKeys({ enabled: model.canControl && !locked && !moreOpen && pulse, onNext: handlers.next, onPrev: handlers.prev });

    return (
        <div className="@container relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
            {/* ── 위: 한 줄 상태 ── */}
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border pl-3 pr-4 @min-[1200px]:gap-4 @min-[1200px]:pr-5">
                <button
                    type="button"
                    inert={locked}
                    onClick={handlers.leave}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-11 shrink-0 gap-0.5 px-3 text-sm font-medium text-muted-foreground hover:text-foreground has-[>svg]:px-2.5')}
                >
                    <ChevronLeft className="size-[18px]" aria-hidden="true" />
                    나가기
                </button>
                <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />

                <div className="flex min-w-0 items-center gap-3">
                    <h2 className="min-w-0 truncate text-[22px] font-semibold tracking-tight">{song.title}</h2>
                    <span className="inline-flex h-7 shrink-0 items-center border-l border-border pl-3 text-sm font-semibold">Key {keyText(song.key)}</span>
                    <TempoBeat bpm={model.bpm} meter={song.meter} desktop />
                </div>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {pos.songIndex + 1} / {model.songs.length}곡
                </span>

                <div inert={locked} className="ml-auto flex shrink-0 items-center gap-1">
                    <ViewSwitch label="화면" value={pulse ? 'pulse' : 'score'} options={DESKTOP_SCREENS} onChange={(value) => onView(value)} className="mr-2 border-0 pt-0" />
                    {device.wakeSupported ? (
                        <IconToggle label="화면 꺼짐 방지" pressed={device.awake} onClick={device.toggleAwake}>
                            <MonitorCheck className="size-5" aria-hidden="true" />
                        </IconToggle>
                    ) : null}
                    {device.fullscreenSupported ? (
                        <IconToggle label="전체화면" pressed={device.fullscreen} onClick={device.toggleFullscreen}>
                            {device.fullscreen ? <Minimize2 className="size-[18px]" aria-hidden="true" /> : <Maximize2 className="size-[18px]" aria-hidden="true" />}
                        </IconToggle>
                    ) : null}
                    <div ref={moreRef} className="relative">
                        <button
                            ref={moreTrigger}
                            type="button"
                            aria-label={`더보기, 팀 ${model.members.length}명 중 ${model.members.filter((member) => member.online).length}명 접속`}
                            title="더보기"
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen((open) => !open)}
                            className={cn(buttonVariants({ variant: moreOpen ? 'secondary' : 'ghost', size: 'icon' }), 'text-muted-foreground hover:text-foreground')}
                        >
                            <Ellipsis className="size-5" aria-hidden="true" />
                        </button>
                        {moreOpen ? (
                            <div
                                role="dialog"
                                aria-label="더보기"
                                className="absolute right-0 top-full z-40 mt-2.5 max-h-[calc(100dvh-6rem)] w-[22rem] overflow-y-auto overscroll-contain rounded-3xl bg-card p-5 text-left text-card-foreground shadow-xl ring-1 ring-border animate-in fade-in zoom-in-95 duration-150 origin-top-right motion-reduce:animate-none"
                            >
                                <MoreBody
                                    model={model}
                                    handlers={handlers}
                                    device={device}
                                    onLock={() => {
                                        device.setLocked(true);
                                        closeMore(false);
                                    }}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            </header>

            <div className="flex min-h-0 flex-1" inert={locked}>
                {/* ── 가운데: 악보 (펄스는 위 층에 그립니다) ── */}
                <section aria-label={pulse ? '펄스' : '악보'} className="flex min-w-0 flex-1 flex-col">
                    {pulse ? null : (
                        <>
                            <div className="flex h-14 shrink-0 items-center pl-9 pr-5 @min-[1200px]:pl-12 @min-[1200px]:pr-7">
                                <p className="truncate text-xs font-medium text-muted-foreground">
                                    악보 · {pos.hasForm ? `${song.sections.length}섹션` : '송폼 없음'} · {song.meter}
                                </p>
                            </div>
                            <ScoreStage model={model} handlers={handlers} pos={pos} locked={locked} onPulse={() => onView('pulse')} className="px-4 pb-4 @min-[1200px]:px-6" />
                        </>
                    )}
                </section>

                <Rail model={model} handlers={handlers} pos={pos} />
            </div>

            {/* ── 아래: 넘김과 큐 (잠그면 잠금 해제만, 받은 큐는 위 아일랜드에서 계속 확인) ── */}
            <footer className="flex h-[76px] shrink-0 items-center gap-2 border-t border-border px-4 @min-[1200px]:gap-3 @min-[1200px]:px-5">
                {locked ? (
                    <div className="flex min-w-0 items-center gap-4">
                        <button type="button" autoFocus onClick={() => device.setLocked(false)} className={cn(buttonVariants({ size: 'lg' }), 'h-12 shrink-0 px-6')}>
                            <LockOpen className="size-4" aria-hidden="true" />
                            잠금 해제
                        </button>
                        <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="shrink-0 font-semibold">화면 잠김</span>
                            <span className="truncate text-muted-foreground">실수로 눌러도 넘어가지 않아요</span>
                        </span>
                    </div>
                ) : (
                    <>
                        {model.canControl ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handlers.prev}
                                    disabled={pos.atStart}
                                    aria-label={pos.hasForm ? '이전 섹션' : '이전 곡'}
                                    className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 rounded-xl shrink-0 px-3.5 @min-[1200px]:px-5')}
                                >
                                    <ChevronLeft className="size-5" aria-hidden="true" />
                                    <span className="hidden @min-[1200px]:inline">{pos.hasForm ? '이전 섹션' : '이전 곡'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlers.next}
                                    disabled={pos.atEnd}
                                    className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-xl min-w-36 max-w-60 shrink-0 gap-2 has-[>svg]:pl-6 has-[>svg]:pr-4')}
                                >
                                    {pos.atEnd ? (
                                        <span className="flex-1 text-left">콘티 끝</span>
                                    ) : (
                                        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                                            <span className="shrink-0 text-sm font-medium opacity-80">{pos.nextKind === 'section' ? '다음' : '다음 곡'}</span>
                                            <span className="truncate">{pos.nextKind === 'section' ? sectionLabel(pos.nextName) : pos.nextName}</span>
                                        </span>
                                    )}
                                    <ChevronRight className="size-5" aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <FollowStatus controllerNames={model.controllerNames} desktop />
                        )}
                        {model.quickCues.length > 0 ? (
                            <>
                                <span aria-hidden="true" className="mx-1.5 h-8 w-px shrink-0 bg-border" />
                                <QuickCues cues={model.quickCues} onSend={onSendCue} desktop />
                            </>
                        ) : null}
                    </>
                )}

                <div className="ml-auto flex min-w-0 items-center justify-end">
                    <FooterStatus model={model} />
                </div>
            </footer>

            {/* 악보 열 위의 층: 펄스(펄스일 때) · 앱 알림 자리 · 큐 아일랜드. 잠가도 눌리고, 빈 곳은 아래 악보로 흘려보냅니다 */}
            <div className="pointer-events-none absolute bottom-[76px] left-0 right-[300px] top-16 z-20 @min-[1200px]:right-80">
                <div className="flex h-full flex-col">
                    {pulse ? <DesktopPulse model={model} pos={pos} /> : <div className="min-h-0 flex-1" />}
                    <div className="pointer-events-auto">
                        <DockZone open={notices.length > 0} desktop>
                            <NoticeDock notices={notices} desktop onAction={handlers.action} onDismiss={handlers.dismiss} />
                        </DockZone>
                    </div>
                    <div className="pointer-events-auto">
                        <CueIsland
                            cues={cues}
                            desktop
                            connection={model.connection}
                            startedAt={model.startedAt}
                            onAck={handlers.ack}
                            onDismiss={handlers.dismiss}
                            modeClassName={DESKTOP_ISLAND}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** 악보 자리에 들어가는 펄스 — BPM 은 위 막대, 지금 · 다음 섹션과 송폼은 오른쪽 레일이 그대로 보여 줍니다 */
function DesktopPulse({ model, pos }: { model: LiveScreenModel; pos: LivePosition }) {
    return (
        <section aria-label="펄스" className="pointer-events-auto flex min-h-0 flex-1 flex-col bg-background">
            {/* 악보의 맨 위 줄과 같은 높이 · 같은 글자 — 가운데에 아일랜드가 섭니다 */}
            <div className="flex h-14 shrink-0 items-center pl-9 pr-5 @min-[1200px]:pl-12 @min-[1200px]:pr-7">
                <p className="truncate text-xs font-medium text-muted-foreground">펄스 · {pos.song.meter}</p>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col px-9 pb-7 pt-2 @min-[1200px]:px-12">
                {model.bpm ? <BeatHero bpm={model.bpm} meter={pos.song.meter} resetKey={pos.beatKey} desktop /> : <NoPulse desktop />}
            </div>
        </section>
    );
}

/* ───────────── 오른쪽 레일 ───────────── */

function Rail({ model, handlers, pos }: { model: LiveScreenModel; handlers: LiveScreenHandlers; pos: LivePosition }) {
    const { song } = pos;
    const control = model.canControl;
    const railRef = useRef<HTMLElement | null>(null);
    const nowRef = useRef<HTMLDivElement | null>(null);
    const scrolledOnce = useRef(false);
    const [railScrolled, setRailScrolled] = useState(false);
    const formId = useId();
    const orderId = useId();
    const teamId = useId();
    const online = model.members.filter((member) => member.online).length;

    // 섹션이 바뀌면 송폼의 그 줄이 보이게 (위에 붙은 '지금' 블록에 가리지 않게, 처음 한 번은 애니메이션 없이)
    useEffect(() => {
        const smooth = scrolledOnce.current;
        scrolledOnce.current = true;
        const rail = railRef.current;
        const row = rail?.querySelector<HTMLElement>(`[data-form-row="${pos.sectionIndex}"]`);
        if (!rail || !row) return;
        const covered = nowRef.current?.offsetHeight ?? 0;
        const top = row.offsetTop;
        const bottom = top + row.offsetHeight;
        if (top < rail.scrollTop + covered || bottom > rail.scrollTop + rail.clientHeight) {
            scrollWithin(rail, top - covered - (rail.clientHeight - covered) / 2, smooth);
        }
    }, [song.id, pos.sectionIndex]);

    return (
        <aside
            ref={railRef}
            aria-label="진행"
            tabIndex={0}
            onScroll={(event) => setRailScrolled(event.currentTarget.scrollTop > 4)}
            className="relative w-[300px] shrink-0 overflow-y-auto overscroll-contain border-l border-border outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @min-[1200px]:w-80"
        >
            <div ref={nowRef} className={cn('sticky top-0 z-10 border-b bg-background px-6 pb-5 pt-6 transition-colors', railScrolled ? 'border-border' : 'border-transparent')}>
                <p className="text-xs font-medium text-muted-foreground">지금</p>
                {pos.hasForm ? (
                    <p
                        data-current-section
                        className={cn(
                            'mt-2 break-words text-[40px] font-medium leading-[1.02]',
                            // 긴 이름(Pre-Chorus)은 48px 로 한 줄에, 짧은 이름은 넓은 레일에서 56px
                            (pos.section ?? '').length > 7 ? 'tracking-[-0.035em]' : 'tracking-tight @min-[1200px]:text-[48px]',
                        )}
                    >
                        {sectionLabel(pos.section ?? '')}
                    </p>
                ) : (
                    <p data-current-section className="mt-2 line-clamp-3 break-words text-3xl font-semibold leading-tight tracking-tight">{song.title}</p>
                )}
                <p className="mt-2.5 text-sm text-muted-foreground tabular-nums">
                    {pos.hasForm ? `${pos.sectionIndex + 1} / ${song.sections.length} 섹션` : '송폼 없음 · 곡 단위로 넘어가요'}
                    {song.lead ? ` · 리드 ${song.lead}` : ''}
                </p>
                {model.lastMovedBy ? <p className="mt-1 truncate text-xs text-muted-foreground">{model.lastMovedBy}님이 넘겼어요</p> : null}
                <div className="mt-5 flex items-baseline gap-2.5 border-t border-border pt-4">
                    {pos.atEnd ? (
                        <span className="text-sm text-muted-foreground">콘티의 마지막이에요</span>
                    ) : (
                        <>
                            <span className="shrink-0 text-sm text-muted-foreground">{pos.nextKind === 'section' ? '다음' : '다음 곡'}</span>
                            <span className="min-w-0 truncate text-xl font-semibold tracking-tight">{pos.nextKind === 'section' ? sectionLabel(pos.nextName) : pos.nextName}</span>
                        </>
                    )}
                </div>
            </div>

            {song.note ? (
                <div className="mx-6 mt-2 border-l-2 border-border py-2 pl-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                        <StickyNote className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        곡 메모
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{song.note}</p>
                </div>
            ) : null}
            {song.transitionNote && pos.nextSong ? (
                <div className="mx-6 mt-3 border-l-2 border-border py-2 pl-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                        <ArrowRightLeft className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        다음 곡으로 넘어갈 때
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{song.transitionNote}</p>
                </div>
            ) : null}

            <section aria-labelledby={formId} className="px-6 pt-7">
                <div className="flex items-baseline justify-between">
                    <h3 id={formId} className="text-[15px] font-semibold tracking-tight">
                        곡 진행 순서
                    </h3>
                    <span className="text-xs text-muted-foreground">{pos.hasForm ? (control ? '눌러서 이동' : `${song.sections.length}섹션`) : ''}</span>
                </div>
                {pos.hasForm ? (
                    <ol className="mt-1.5 divide-y divide-border">
                        {song.sections.map((name, index) => {
                            const current = index === pos.sectionIndex;
                            const past = index < pos.sectionIndex;
                            const body = (
                                <>
                                    <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                    <span className={cn('min-w-0 flex-1 truncate', current ? 'font-semibold' : 'font-medium', past && 'text-muted-foreground')}>{sectionLabel(name)}</span>
                                    {current ? (
                                        <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">지금</span>
                                    ) : index === pos.sectionIndex + 1 ? (
                                        <span className="text-xs font-semibold text-foreground">다음</span>
                                    ) : null}
                                </>
                            );
                            const row = '-mx-2 flex h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left text-[15px]';
                            return (
                                <li key={`${song.id}-row-${index}`}>
                                    {control ? (
                                        <button
                                            type="button"
                                            data-form-row={index}
                                            aria-current={current ? 'step' : undefined}
                                            onClick={() => handlers.goSection(index)}
                                            className={cn(row, 'outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring')}
                                        >
                                            {body}
                                        </button>
                                    ) : (
                                        <div data-form-row={index} aria-current={current ? 'step' : undefined} className={row}>
                                            {body}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground">송폼이 없는 곡이에요</p>
                )}
            </section>

            <section aria-labelledby={orderId} className="px-6 pt-7">
                <div className="flex items-baseline justify-between">
                    <h3 id={orderId} className="text-[15px] font-semibold tracking-tight">
                        콘티 순서
                    </h3>
                    <span className="text-xs text-muted-foreground">{model.songs.length}곡</span>
                </div>
                <ol className="mt-1.5 divide-y divide-border">
                    {model.songs.map((item, index) => {
                        const current = index === pos.songIndex;
                        const body = (
                            <>
                                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                <span className="min-w-0 flex-1">
                                    <span className={cn('block truncate text-[15px] font-semibold', index < pos.songIndex && 'text-muted-foreground')}>{item.title}</span>
                                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                                        Key {keyText(item.key)} · {item.bpm ?? '—'} BPM · {item.meter}
                                    </span>
                                </span>
                                {current ? (
                                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand">
                                        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                                        진행 중
                                    </span>
                                ) : index < pos.songIndex ? (
                                    <span className="shrink-0 text-xs text-muted-foreground">마침</span>
                                ) : null}
                            </>
                        );
                        const row = '-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left';
                        return (
                            <li key={`${item.id}-${index}`}>
                                {control ? (
                                    <button
                                        type="button"
                                        aria-current={current ? 'true' : undefined}
                                        onClick={() => {
                                            if (!current) handlers.goSong(index);
                                        }}
                                        className={cn(row, 'outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring')}
                                    >
                                        {body}
                                    </button>
                                ) : (
                                    <div aria-current={current ? 'true' : undefined} className={row}>
                                        {body}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </section>

            <section aria-labelledby={teamId} className="px-6 pb-8 pt-7">
                <div className="flex items-baseline justify-between">
                    <h3 id={teamId} className="text-[15px] font-semibold tracking-tight">
                        팀 접속
                    </h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                        {online}/{model.members.length}
                    </span>
                </div>
                <MemberList members={model.members} compact />
            </section>
        </aside>
    );
}

/* ───────────── 아래 막대 오른쪽: 최근 큐 · 접속 ───────────── */

function FooterStatus({ model }: { model: LiveScreenModel }) {
    const now = useNow(30_000);
    const shown = model.cues.slice(0, 2);
    const online = model.members.filter((member) => member.online);
    return (
        <div className="flex min-w-0 items-center gap-5">
            <section aria-label="최근 큐" className="flex min-w-0 items-center gap-4">
                <p className="shrink-0 text-xs font-medium text-muted-foreground">최근 큐</p>
                {shown.length === 0 ? (
                    <p className="truncate text-xs text-muted-foreground">아직 없어요</p>
                ) : (
                    <ol className="flex min-w-0 items-center gap-4">
                        {shown.map((cue, index) => (
                            <li
                                key={cue.id}
                                className={cn(
                                    'flex min-w-0 items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none',
                                    index > 0 && 'hidden border-l border-border pl-4 @min-[1360px]:flex',
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn('size-2 shrink-0 rounded-full', cue.fromMe ? 'bg-brand' : index === 0 && isFresh(cue.createdAt, now) ? 'bg-secondary' : 'bg-muted-foreground/40')}
                                />
                                <span className="min-w-0">
                                    <span className="block max-w-56 truncate text-sm font-semibold leading-tight">{cue.label}</span>
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                        {cue.fromMe ? '내가 보냄' : cue.fromName} → {cue.targetLabel}
                                        {now !== null ? ` · ${relativeTime(cue.createdAt, now)}` : ''}
                                        {cue.recipients > 0 ? ` · 확인 ${cue.acks.length}/${cue.recipients}` : ''}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
            <p
                aria-label={`팀 ${model.members.length}명 중 ${online.length}명 접속`}
                className="hidden shrink-0 items-center gap-2 border-l border-border pl-5 text-xs text-muted-foreground @min-[1200px]:flex"
            >
                <AvatarStack names={online.map((member) => member.name)} max={3} size="xs" />
                <span className="tabular-nums" aria-hidden="true">
                    <span className="font-semibold text-foreground">{online.length}</span>/{model.members.length} 접속
                </span>
            </p>
        </div>
    );
}
