'use client';

import { useRef, useState } from 'react';
import { Activity, ChevronLeft, Ellipsis, FileMusic, GalleryVerticalEnd } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import BeatHero, { NoPulse } from './BeatHero';
import { FollowStatus, HoldToUnlock, MobileNav, ViewSwitch, type SwitchOption } from './Controls';
import CueIsland, { type IslandMode } from './CueIsland';
import { useNavKeys, type DeviceToggles } from './hooks';
import NoticeDock, { DockZone } from './NoticeDock';
import { FadeScroller, FormRow, NextUp, NoteBlock, NowCard, SectionNow, SongStrip } from './NowParts';
import QuickCues from './QuickCues';
import ScoreStage from './ScoreStage';
import Sheet from './Sheet';
import { MoreBody, OrderList } from './SheetBodies';
import TempoBeat from './TempoBeat';
import styles from './live-stage.module.css';
import type { LivePosition } from './derive';
import type { CueDefinition, LiveScreenHandlers, LiveScreenModel, LiveToast } from './model';

/*
 * 모바일 (lg 미만) — 지금 · 악보 · 차분한 펄스.
 * 위: 나가기 · 큐 아일랜드 · 더보기 / 곡 줄(곡 · Key · 고정 BPM) / 가운데: 지금 | 악보 | 펄스
 * 아래 엄지 자리(세 화면 모두 같음): 빠른 큐 → 이전 · 다음 (따라가는 사람은 '따라가는 중') → 화면 바꾸기.
 * 악보는 뷰어의 머리줄이 곡 · Key 를 보여 주므로 곡 줄 없이 가운데를 끝까지 쓰고, 왼쪽 위가 '돌아가기' 가 됩니다.
 */

export type LiveView = 'now' | 'score' | 'pulse';

type MobileSheet = 'order' | 'more';

const MOBILE_SCREENS: SwitchOption<LiveView>[] = [
    { value: 'now', label: '지금', icon: GalleryVerticalEnd },
    { value: 'score', label: '악보', icon: FileMusic },
    { value: 'pulse', label: '펄스', icon: Activity },
];

/** 악보 화면은 왼쪽 위 '돌아가기' 가 글자 버튼이라, 접힌 아일랜드가 그만큼 좁아집니다 */
const SCORE_ISLAND: Partial<Record<IslandMode, string>> = { compact: 'max-w-[calc(100%-236px)]' };

export default function LiveMobile({
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
    const [sheet, setSheet] = useState<MobileSheet | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const locked = device.locked;
    const score = view === 'score';
    const pulse = view === 'pulse';
    const { song } = pos;
    const online = model.members.filter((member) => member.online).length;
    const anyOffline = online < model.members.length;

    useNavKeys({ enabled: model.canControl && !locked && sheet === null && !score, onNext: handlers.next, onPrev: handlers.prev });

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

    function backToNow() {
        onView('now');
        // '돌아가기' 가 사라지므로 포커스는 아래 '지금' 칩으로
        requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[data-view="now"]')?.focus({ preventScroll: true }));
    }

    return (
        // group/screen: 아일랜드가 펼쳐진 동안 곡 줄이 잠시 물러납니다 · container: 화면 높이에 맞춰 지금 카드 · 송폼을 고릅니다
        <div ref={rootRef} className="group/screen relative flex h-full w-full flex-col [container-type:size]">
            <div inert={sheet !== null} className="flex min-h-0 flex-1 flex-col">
                {/* 위: 나가기(악보에서는 돌아가기) · 큐 아일랜드 · 더보기 */}
                <header className="relative z-30 shrink-0 px-2 pt-[max(env(safe-area-inset-top),0.375rem)]">
                    <div className="relative flex h-12 items-center justify-between">
                        {score ? (
                            <button
                                type="button"
                                inert={locked}
                                onClick={backToNow}
                                className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-0.5 pl-2 pr-3.5 text-[15px] font-semibold has-[>svg]:pl-2')}
                            >
                                <ChevronLeft className="size-5" aria-hidden="true" />
                                돌아가기
                            </button>
                        ) : (
                            <button type="button" inert={locked} onClick={handlers.leave} aria-label="예배 화면 나가기" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-foreground')}>
                                <ChevronLeft className="size-[22px]" aria-hidden="true" />
                            </button>
                        )}
                        {/* 화면을 잠가도 큐는 확인할 수 있게 아일랜드는 잠그지 않습니다 */}
                        <CueIsland
                            cues={cues}
                            desktop={false}
                            connection={model.connection}
                            startedAt={model.startedAt}
                            onAck={handlers.ack}
                            onDismiss={handlers.dismiss}
                            modeClassName={score ? SCORE_ISLAND : undefined}
                        />
                        <button
                            type="button"
                            inert={locked}
                            onClick={() => openSheet('more')}
                            aria-label={`더보기, 팀 ${model.members.length}명 중 ${online}명 접속 · 최근 큐`}
                            aria-haspopup="dialog"
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative text-muted-foreground')}
                        >
                            <Ellipsis className="size-5" aria-hidden="true" />
                            {anyOffline ? (
                                <span aria-hidden="true" className="absolute right-2 top-2.5 size-2 rounded-full bg-secondary ring-2 ring-background transition-opacity group-has-[[data-island-open]]/screen:opacity-0" />
                            ) : null}
                        </button>
                    </div>
                </header>

                <div inert={locked} className="flex min-h-0 flex-1 flex-col">
                    {score ? (
                        <ScoreStage model={model} handlers={handlers} pos={pos} locked={locked} onPulse={() => onView('pulse')} className="px-2 pb-1 pt-1" />
                    ) : (
                        <>
                            {/* 곡 줄: 곡 · Key · 고정 BPM — 지금 · 펄스 모두 같은 자리에서 표시 */}
                            <div className="shrink-0 transition-opacity duration-200 group-has-[[data-island-open]]/screen:pointer-events-none group-has-[[data-island-open]]/screen:opacity-0 motion-reduce:transition-none">
                                <SongStrip
                                    model={model}
                                    pos={pos}
                                    onOrder={() => openSheet('order')}
                                    beat={<TempoBeat bpm={model.bpm} meter={song.meter} resetKey={pos.beatKey} showBlink={!pulse} />}
                                />
                            </div>

                            {pulse ? (
                                <div className={styles.pulseBody}>
                                    <div className={styles.pulseVisual}>
                                        {model.bpm ? <BeatHero bpm={model.bpm} meter={song.meter} resetKey={pos.beatKey} /> : <NoPulse />}
                                    </div>
                                    <SectionNow pos={pos} />
                                </div>
                            ) : (
                                // 가운데: 지금 카드 — 자랄 수 있는 유일한 스크롤 영역
                                <FadeScroller>
                                    <NowCard pos={pos} />
                                    {song.note ? <NoteBlock note={song.note} className="line-clamp-2 [@container(max-height:599px)]:hidden" /> : null}
                                    {/* 송폼은 화면이 넉넉할 때만 — 지금 카드 바로 아래, 빠른 큐와 떨어진 자리 */}
                                    {pos.hasForm ? (
                                        <div className="-mx-4 shrink-0 pb-1 [@container(max-height:639px)]:hidden">
                                            <FormRow pos={pos} canControl={model.canControl} onPick={handlers.goSection} />
                                        </div>
                                    ) : null}
                                    <NextUp pos={pos} />
                                </FadeScroller>
                            )}
                        </>
                    )}
                </div>

                {/* 앱 알림 — 넘김 버튼 바로 위. 알림이 오면 이 줄이 열리고 가운데가 그만큼 비켜 줍니다 (버튼은 가리지 않음) */}
                <DockZone open={notices.length > 0} desktop={false}>
                    <NoticeDock notices={notices} desktop={false} onAction={handlers.action} onDismiss={handlers.dismiss} />
                </DockZone>

                {/* 엄지 자리 (세 화면 모두 같음): 빠른 큐 → 이전 · 다음 → 화면 바꾸기 */}
                <div className={cn(styles.mobileFooter, 'shrink-0 bg-background pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2.5')}>
                    {model.quickCues.length > 0 ? (
                        <div inert={locked} className={cn('px-4 pb-2.5 transition-opacity', locked && 'opacity-40')}>
                            <QuickCues cues={model.quickCues} onSend={onSendCue} />
                        </div>
                    ) : null}
                    {/* 낮은 화면의 악보에서는 넘김 줄을 접어 악보 자리를 넓힙니다 (뷰어 아래에 쪽 · 곡 넘김이 있음). 잠금 풀기는 늘 보임 */}
                    <div className={cn('px-4', score && !locked && '[@container(max-height:719px)]:hidden')}>
                        {locked ? (
                            <HoldToUnlock onUnlock={() => device.setLocked(false)} />
                        ) : model.canControl ? (
                            <MobileNav pos={pos} onPrev={handlers.prev} onNext={handlers.next} />
                        ) : (
                            <FollowStatus controllerNames={model.controllerNames} />
                        )}
                    </div>
                    <div inert={locked} className={cn('px-4 pt-2.5 transition-opacity', locked && 'opacity-40')}>
                        <ViewSwitch label="화면" value={view} options={MOBILE_SCREENS} onChange={onView} className="w-full" />
                    </div>
                </div>
            </div>

            {sheet === 'order' ? (
                <Sheet eyebrow={`${model.theme ?? model.title} · ${model.songs.length}곡`} title="순서" onClose={closeSheet}>
                    <OrderList
                        model={model}
                        pos={pos}
                        onPick={
                            model.canControl
                                ? (index) => {
                                      if (index !== pos.songIndex) handlers.goSong(index);
                                      closeSheet();
                                  }
                                : undefined
                        }
                    />
                </Sheet>
            ) : null}
            {sheet === 'more' ? (
                <Sheet eyebrow={model.teamName} title="더보기" onClose={closeSheet}>
                    <MoreBody
                        model={model}
                        handlers={handlers}
                        device={device}
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
