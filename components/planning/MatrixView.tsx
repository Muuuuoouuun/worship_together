'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { planningDate, type PlanningCommand, type ScheduleSlot, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { STATUS } from '@/components/ui/status';
import { Avatar } from '@/components/conti/ui';
import { ROLE_ICON } from '@/components/conti/planningUi';

const ROLE_DISPLAY_ORDER: WorshipRole[] = [
    'leader',
    'vocal',
    'keyboard',
    'guitar',
    'bass',
    'drums',
    'sound',
    'media',
];

const KIND_FILTERS = [
    ['all', '전체'],
    ['worship', '예배만'],
    ['rehearsal', '연습만'],
] as const;

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 저장된 시각(UTC ISO)을 한국 시간 날짜(YYYY-MM-DD)·시각(HH:MM)으로 바꿉니다. */
function kst(iso: string) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    const shifted = new Date(ms + 9 * 60 * 60 * 1000).toISOString();
    return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

type Props = {
    events: TeamSchedule[];
    members: TeamMember[];
    names: Map<string, string>;
    userId: string;
    manager: boolean;
    onSelectEvent: (event: TeamSchedule) => void;
    onOpenMonthlySundaysModal: () => void;
    onCommand: (command: PlanningCommand) => Promise<boolean>;
    disabled: boolean;
};

export default function MatrixView({
    events,
    members,
    names,
    userId,
    manager,
    onSelectEvent,
    onOpenMonthlySundaysModal,
    onCommand,
    disabled,
}: Props) {
    const today = useMemo(() => new Date(), []);
    const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [assigningSlot, setAssigningSlot] = useState<{ event: TeamSchedule; slot: ScheduleSlot } | null>(null);
    const [filterKind, setFilterKind] = useState<'all' | 'worship' | 'rehearsal'>('all');
    const sheetTitleId = useId();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

    function handlePrevMonth() {
        setCurrentDate(new Date(year, month - 2, 1));
    }

    function handleNextMonth() {
        setCurrentDate(new Date(year, month, 1));
    }

    function handleToday() {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    // 빠른 배정 시트: Esc 로 닫고, 열려 있는 동안 뒤 화면 스크롤을 막습니다.
    const sheetOpen = Boolean(assigningSlot);
    useEffect(() => {
        if (!sheetOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            setAssigningSlot(null);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [sheetOpen]);

    // Filter events for the current month
    const monthEvents = useMemo(() => {
        return events
            .filter((e) => !e.cancelled && kst(e.startsAt).date.startsWith(monthPrefix))
            .filter((e) => filterKind === 'all' || e.kind === filterKind)
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }, [events, monthPrefix, filterKind]);

    // Calculate monthly workload per member
    const monthlyWorkload = useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of members) {
            counts.set(m.userId, 0);
        }
        for (const ev of monthEvents) {
            for (const slot of ev.slots) {
                if (slot.memberId && counts.has(slot.memberId)) {
                    counts.set(slot.memberId, (counts.get(slot.memberId) ?? 0) + 1);
                }
            }
        }
        return counts;
    }, [members, monthEvents]);

    // Pre-index slots by event and role for O(1) cell lookup
    const slotsByEventAndRole = useMemo(() => {
        const map = new Map<string, ScheduleSlot[]>();
        for (const ev of monthEvents) {
            for (const slot of ev.slots) {
                const key = `${ev.id}:${slot.role}`;
                const list = map.get(key) ?? [];
                list.push(slot);
                map.set(key, list);
            }
        }
        return map;
    }, [monthEvents]);

    return (
        <div className="space-y-7">
            {/* 월 이동 및 종류 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        aria-label="이전 달"
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="min-w-24 text-center text-[15px] font-semibold tabular-nums text-foreground">
                        {year}년 {month}월
                    </h3>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        aria-label="다음 달"
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <Button type="button" variant="outline" size="xs" className="ml-1.5" onClick={handleToday}>
                        오늘
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div role="group" aria-label="일정 종류" className="inline-flex gap-1 rounded-full bg-muted p-1">
                        {KIND_FILTERS.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={filterKind === value}
                                onClick={() => setFilterKind(value)}
                                className={cn(
                                    'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
                                    filterKind === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {manager && (
                        <Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={onOpenMonthlySundaysModal}>
                            <CalendarDays className="text-muted-foreground" />
                            <span>이번 달 주일 일괄 생성</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* 사역 배분표 */}
            {monthEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-3 rounded-3xl border border-dashed border-input px-5 py-10 text-center">
                    <CalendarDays size={28} className="text-muted-foreground/60" aria-hidden="true" />
                    <p className="text-[15px] font-medium text-foreground">
                        {year}년 {month}월에 등록된 일정이 없습니다.
                    </p>
                    <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                        주일 예배 일괄 생성을 이용하면 4~5주치 주일 예배와 표준 밴드 슬롯을 1초 만에 자동 생성할 수 있습니다.
                    </p>
                    {manager && (
                        <Button type="button" size="sm" onClick={onOpenMonthlySundaysModal}>
                            <Sparkles />
                            <span>{month}월 주일 예배 자동 생성하기</span>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-separate border-spacing-0 text-left text-xs">
                        <thead>
                            <tr>
                                <th scope="col" className="sticky left-0 z-10 w-24 min-w-24 border-b border-border/70 bg-background pb-3 pr-3 align-bottom text-[11px] font-medium text-muted-foreground">
                                    파트 / 일정
                                </th>
                                {monthEvents.map((ev) => {
                                    const local = kst(ev.startsAt);
                                    const [y, m, d] = local.date.split('-').map(Number);
                                    const monthNum = m;
                                    const dayNum = d;
                                    const dayName = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
                                    const timeStr = local.time;
                                    const assignedCount = ev.slots.filter((s) => s.memberId).length;
                                    const totalCount = ev.slots.length;
                                    const vacantCount = ev.slots.filter((s) => !s.memberId || s.attendance === 'absent').length;

                                    return (
                                        <th key={ev.id} scope="col" className="min-w-36 border-b border-border/70 px-1 pb-3 align-bottom font-normal">
                                            <button
                                                type="button"
                                                onClick={() => onSelectEvent(ev)}
                                                className="group w-full rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted"
                                                title={`${ev.title} 상세 보기`}
                                            >
                                                <span className="flex items-baseline gap-1.5">
                                                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                                                        {monthNum}.{dayNum} ({dayName})
                                                    </span>
                                                    <span className="text-[10px] tabular-nums text-muted-foreground">{timeStr}</span>
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-foreground/75">{ev.title}</span>
                                                <span className="mt-1 block text-[11px] font-medium">
                                                    {totalCount > 0 ? (
                                                        vacantCount > 0 ? (
                                                            <span className="text-secondary">빈자리 {vacantCount}</span>
                                                        ) : (
                                                            <span className={STATUS.ok.text}>완료 ({assignedCount}/{totalCount})</span>
                                                        )
                                                    ) : (
                                                        <span className="font-normal text-muted-foreground">슬롯 없음</span>
                                                    )}
                                                </span>
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {ROLE_DISPLAY_ORDER.map((roleKey) => {
                                const Icon = ROLE_ICON[roleKey];
                                return (
                                    <tr key={roleKey}>
                                        {/* 왼쪽 고정 파트 */}
                                        <th scope="row" className="sticky left-0 z-10 border-b border-border/70 bg-background py-2.5 pr-3 text-left font-medium text-foreground">
                                            <span className="flex items-center gap-2">
                                                <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                                                <span className="truncate text-[13px]">{worshipRoles[roleKey]}</span>
                                            </span>
                                        </th>

                                        {/* 각 일정의 해당 파트 */}
                                        {monthEvents.map((ev) => {
                                            const matchingSlots = slotsByEventAndRole.get(`${ev.id}:${roleKey}`) ?? [];

                                            if (matchingSlots.length === 0) {
                                                return (
                                                    <td key={ev.id} className="border-b border-border/70 px-3 py-2.5 text-muted-foreground/40">
                                                        -
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={ev.id} className="border-b border-border/70 px-1 py-1.5 align-middle">
                                                    <div className="flex flex-col gap-1">
                                                        {matchingSlots.map((slot) => {
                                                            const memberName = slot.memberId ? names.get(slot.memberId) ?? '팀원' : null;
                                                            const isMe = slot.memberId === userId;
                                                            const isVacant = !slot.memberId;
                                                            const isAbsent = slot.attendance === 'absent';
                                                            const tone = isVacant ? null : slot.attendance === 'confirmed' ? STATUS.ok : isAbsent ? STATUS.danger : STATUS.warn;
                                                            const statusLabel = isVacant ? '빈자리' : slot.attendance === 'confirmed' ? '참석 확정' : isAbsent ? '불참' : '응답 대기';

                                                            return (
                                                                <div
                                                                    key={slot.id}
                                                                    className={cn(
                                                                        'flex min-h-8 items-center justify-between gap-1 rounded-xl px-2 py-1',
                                                                        isVacant
                                                                            ? 'border border-dashed border-input text-muted-foreground'
                                                                            : isAbsent
                                                                            ? cn(STATUS.danger.soft, 'line-through')
                                                                            : isMe
                                                                            ? 'bg-muted font-semibold text-foreground'
                                                                            : 'text-foreground',
                                                                    )}
                                                                >
                                                                    <span className="flex min-w-0 items-center gap-1.5">
                                                                        <span className={cn('size-1.5 shrink-0 rounded-full', tone ? tone.dot : 'bg-secondary')} aria-hidden="true" />
                                                                        <span className="sr-only">{statusLabel}</span>
                                                                        <span className="truncate">{memberName ?? '미배정'}</span>
                                                                        {isMe && <span className="shrink-0 text-[10px] font-semibold text-brand no-underline">나</span>}
                                                                    </span>

                                                                    {/* 관리자 배정 변경 */}
                                                                    {manager && !ev.cancelled && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setAssigningSlot({ event: ev, slot })}
                                                                            className="h-6 shrink-0 rounded-full px-1.5 text-[11px] font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
                                                                            title="배정 인원 변경"
                                                                        >
                                                                            {isVacant ? '+배정' : '변경'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 이번 달 팀원별 섬김 횟수 */}
            <section aria-label="팀원별 섬김 횟수" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-[15px] font-semibold tracking-tight text-foreground">
                        {month}월 팀원별 섬김 횟수 현황
                    </h4>
                    <span className="text-xs text-muted-foreground">
                        {monthEvents.length}개 일정 기준 누적 배정
                    </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {members.map((member) => {
                        const count = monthlyWorkload.get(member.userId) ?? 0;
                        const isHigh = count >= 4;
                        const isZero = count === 0;

                        return (
                            <div
                                key={member.userId}
                                className={cn(
                                    'inline-flex h-9 items-center gap-2 rounded-full border border-border/70 pl-1.5 pr-3 text-xs',
                                    isZero && 'text-muted-foreground',
                                )}
                            >
                                <Avatar name={member.name} size="xs" className={cn(isZero && 'opacity-60')} />
                                <span className={cn('font-medium', !isZero && 'text-foreground')}>{member.name}</span>
                                <span className={cn('font-semibold tabular-nums', isHigh ? STATUS.warn.text : isZero ? 'text-muted-foreground' : 'text-foreground')}>
                                    {count}회
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 빠른 배정 시트 */}
            {assigningSlot && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={sheetTitleId}
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in sm:items-center sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setAssigningSlot(null);
                    }}
                >
                    <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-3xl sm:pb-0 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />

                        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-muted-foreground">배정 변경</p>
                                <h3 id={sheetTitleId} className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                                    {assigningSlot.event.title} · {worshipRoles[assigningSlot.slot.role]}
                                </h3>
                                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                    {planningDate(assigningSlot.event.startsAt)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAssigningSlot(null)}
                                aria-label="닫기"
                                className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <ul className="flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
                            <li className="border-b border-border/70">
                                <button
                                    type="button"
                                    className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-sm disabled:opacity-40"
                                    disabled={disabled}
                                    onClick={async () => {
                                        await onCommand({
                                            type: 'slot.save',
                                            eventId: assigningSlot.event.id,
                                            slotId: assigningSlot.slot.id,
                                            role: assigningSlot.slot.role,
                                            memberId: null,
                                        });
                                        setAssigningSlot(null);
                                    }}
                                >
                                    <span className={cn(!assigningSlot.slot.memberId ? 'font-semibold text-foreground' : 'text-foreground/75')}>미배정 (빈자리로 두기)</span>
                                    {!assigningSlot.slot.memberId && <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />}
                                </button>
                            </li>

                            {members.map((member) => {
                                const isCurrent = assigningSlot.slot.memberId === member.userId;
                                const workload = monthlyWorkload.get(member.userId) ?? 0;
                                const roleMatches =
                                    member.role === assigningSlot.slot.role ||
                                    (assigningSlot.slot.role === 'vocal' && member.role === 'leader') ||
                                    member.role === 'member';

                                return (
                                    <li key={member.userId} className="border-b border-border/70 last:border-b-0">
                                        <button
                                            type="button"
                                            className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-sm disabled:opacity-40"
                                            disabled={disabled}
                                            aria-current={isCurrent ? 'true' : undefined}
                                            onClick={async () => {
                                                await onCommand({
                                                    type: 'slot.save',
                                                    eventId: assigningSlot.event.id,
                                                    slotId: assigningSlot.slot.id,
                                                    role: assigningSlot.slot.role,
                                                    memberId: member.userId,
                                                });
                                                setAssigningSlot(null);
                                            }}
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <Avatar name={member.name} size="sm" />
                                                <span className="min-w-0">
                                                    <span className={cn('block truncate text-[15px]', isCurrent ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>{member.name}</span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {worshipRoles[member.role]}
                                                        {roleMatches && <span className="text-brand"> · 파트 일치</span>}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 items-center gap-2">
                                                <span className="text-xs tabular-nums text-muted-foreground">이번 달 {workload}회</span>
                                                {isCurrent && <Check size={16} className="text-brand" aria-hidden="true" />}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
