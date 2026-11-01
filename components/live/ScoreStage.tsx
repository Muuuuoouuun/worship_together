'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FileMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sectionIndexOf, type LivePosition } from './derive';
import type { LiveScreenHandlers, LiveScreenModel } from './model';

/*
 * '악보' — 이 기기에 받아 둔 팀 악보(LiveStageScoreViewer)를 지금 곡에 맞춰 엽니다.
 * - 쪽 · 곡 · 섹션 넘김은 진행할 수 있는 사람만 (따라가는 사람은 진행자의 쪽을 그대로 봅니다)
 * - 큐는 예배 중 화면의 빠른 큐 · 아일랜드가 맡으므로 뷰어 안의 큐 도구는 숨깁니다 (cueTools={false})
 * - BPM 은 곡 줄 · 위 막대에서 한 번만 보여 주므로 뷰어의 BPM 막대는 끕니다
 * 뷰어는 무거우므로 악보 화면을 처음 열 때 불러옵니다.
 */

const LiveStageScoreViewer = dynamic(() => import('@/components/session/LiveStageScoreViewer'), {
    ssr: false,
    loading: () => (
        <div className="flex min-h-[20rem] flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-muted text-sm text-muted-foreground">
            <FileMusic className="size-6 motion-safe:animate-pulse" aria-hidden="true" />
            악보를 여는 중…
        </div>
    ),
});

export default function ScoreStage({
    model,
    handlers,
    pos,
    locked,
    onPulse,
    className,
}: {
    model: LiveScreenModel;
    handlers: LiveScreenHandlers;
    pos: LivePosition;
    locked: boolean;
    /** 악보가 없을 때 · 설정에서 '펄스로' 를 고르면 */
    onPulse: () => void;
    className?: string;
}) {
    const { song, songIndex } = pos;
    const control = model.canControl;
    // 뷰어의 곡 목록은 곡 행 모양을 받으므로 LiveSong 에서 필요한 칸만 만듭니다
    const songs = useMemo(() => model.songs.map((item) => ({ id: item.id, title: item.title, original_key: item.key, default_bpm: item.bpm })), [model.songs]);
    const online = model.members.filter((member) => member.online).length;

    return (
        // 뷰어의 맨 바깥(section)이 남는 높이를 채우게 하고, 화면이 낮으면 이 칸 안에서만 스크롤합니다
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [&>section]:flex-1', className)}>
            <LiveStageScoreViewer
                teamId={model.teamId}
                songId={song.id}
                title={song.title}
                originalKey={song.key}
                targetKey={song.key}
                directionNotes={song.note ? [song.note] : []}
                transitionNote={song.transitionNote}
                nextSongKey={pos.nextSong?.key ?? null}
                currentBpm={model.bpm}
                bpmEnabled={false}
                isActive={!model.ended}
                currentSection={pos.section}
                nextSection={pos.nextSection}
                page={Math.max(1, model.page)}
                onPageChange={handlers.setPage}
                canTurnPage={control && !locked}
                stageLocked={locked}
                onSwitchToBpmMode={onPulse}
                onPrevSong={control ? () => handlers.goSong(songIndex - 1) : undefined}
                onNextSong={control ? () => handlers.goSong(songIndex + 1) : undefined}
                hasPrevSong={control && pos.prevSong !== null}
                hasNextSong={control && pos.nextSong !== null}
                nextSongTitle={pos.nextSong?.title ?? null}
                prevSongTitle={pos.prevSong?.title ?? null}
                songs={songs}
                onSelectSong={
                    control
                        ? (id) => {
                              // 같은 곡이 콘티에 두 번 있으면 지금 곡에서 가까운 쪽으로
                              const after = model.songs.findIndex((item, index) => index > songIndex && item.id === id);
                              const index = after >= 0 ? after : model.songs.findIndex((item) => item.id === id);
                              if (index >= 0 && index !== songIndex) handlers.goSong(index);
                          }
                        : undefined
                }
                onSelectSection={
                    control
                        ? (name) => {
                              const index = sectionIndexOf(song.sections, name, pos.sectionIndex);
                              if (index >= 0) handlers.goSection(index);
                          }
                        : undefined
                }
                participantCount={online}
                realtimeStatus={model.connection === 'online' ? 'connected' : model.connection}
                cueTools={false}
            />
        </div>
    );
}
