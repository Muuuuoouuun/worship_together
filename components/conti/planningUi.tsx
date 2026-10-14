'use client';

import { CalendarDays, Captions, CircleDashed, Drum, Guitar, Mic, MicVocal, Piano, SlidersVertical, UsersRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanningCommand, TeamSchedule } from '@/types/planning';
import type { WorshipRole } from '@/types/team';
import type { Tone } from './model';
import { useConti } from './context';
import { ABSENCE_REASONS } from './planningBridge';
import { ink, line, selected, sub } from './ui';

export const ROLE_ICON: Record<WorshipRole, LucideIcon> = {
    leader: Mic,
    vocal: MicVocal,
    keyboard: Piano,
    guitar: Guitar,
    bass: Guitar,
    drums: Drum,
    sound: SlidersVertical,
    media: Captions,
    member: UsersRound,
};

export const EVENT_KIND: Record<TeamSchedule['kind'], { label: string; tone: Tone; icon: LucideIcon }> = {
    rehearsal: { label: '연습', tone: 'mint', icon: CircleDashed },
    worship: { label: '예배', tone: 'sky', icon: CalendarDays },
};

export const pill = cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition active:scale-95 disabled:opacity-40', line, ink);
export const pillOn = cn('inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40', selected);

/** 일정·요청 명령을 보냅니다. 연결된 저장소가 없으면 아무 일도 하지 않습니다. */
export function useDispatch() {
    const { planning } = useConti();
    return {
        send: (command: PlanningCommand) => planning.actions?.dispatch(command) ?? Promise.resolve(false),
        busy: planning.busy || !planning.actions,
    };
}

export function PlanningError() {
    const { planning } = useConti();
    if (!planning.error) return null;
    return (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
            {planning.error}
        </p>
    );
}

/** 일정·요청 화면과 같은 1클릭 불참 사유 칩 */
export function AbsenceReasons({ onPick, onCancel, busy }: { onPick: (reason: string) => void; onCancel: () => void; busy: boolean }) {
    return (
        <div className="space-y-2">
            <p className={cn('text-[11px] font-medium', sub)}>불참 사유를 고르면 바로 등록되고 인도자에게 대체 인원 추천이 전달돼요</p>
            <div className="flex flex-wrap gap-1.5">
                {ABSENCE_REASONS.map((reason) => (
                    <button key={reason} type="button" disabled={busy} onClick={() => onPick(reason)} className={pill}>
                        {reason}
                    </button>
                ))}
                <button type="button" onClick={onCancel} className={cn('h-8 px-2 text-xs', sub)}>
                    취소
                </button>
            </div>
        </div>
    );
}
