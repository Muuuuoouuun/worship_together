'use client';

import { useMemo, useState } from 'react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    UserCheck,
    CheckCircle2,
    Clock,
    XCircle,
} from 'lucide-react';
import { planningDate, type PlanningCommand, type ScheduleSlot, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

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

    // Filter events for the current month
    const monthEvents = useMemo(() => {
        return events
            .filter((e) => !e.cancelled && e.startsAt.startsWith(monthPrefix))
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
        <div className="space-y-4">
            {/* 상단 툴바: 월 이동 및 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        aria-label="이전 달"
                        className={`${button} size-9 p-0`}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <h3 className="min-w-28 text-center text-base font-bold text-foreground">
                        {year}년 {month}월
                    </h3>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        aria-label="다음 달"
                        className={`${button} size-9 p-0`}
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={handleToday}
                        className={`${button} ml-1 text-xs`}
                    >
                        오늘
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl border border-border bg-card p-0.5 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setFilterKind('all')}
                            className={`rounded-lg px-2.5 py-1 transition-colors ${
                                filterKind === 'all'
                                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            전체
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterKind('worship')}
                            className={`rounded-lg px-2.5 py-1 transition-colors ${
                                filterKind === 'worship'
                                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            예배만
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterKind('rehearsal')}
                            className={`rounded-lg px-2.5 py-1 transition-colors ${
                                filterKind === 'rehearsal'
                                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            연습만
                        </button>
                    </div>

                    {manager && (
                        <button
                            type="button"
                            onClick={onOpenMonthlySundaysModal}
                            className={`${button} border-primary/40 text-primary hover:bg-primary/10 font-bold`}
                        >
                            <Sparkles size={13} />
                            <span>이번 달 주일 일괄 생성</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 사역 배분 매트릭스 테이블 */}
            {monthEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/50 p-10 text-center space-y-3">
                    <CalendarDays size={36} className="text-muted-foreground/60" />
                    <p className="font-bold text-foreground text-sm">
                        {year}년 {month}월에 등록된 일정이 없습니다.
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                        주일 예배 일괄 생성을 이용하면 4~5주치 주일 예배와 표준 밴드 슬롯을 1초 만에 자동 생성할 수 있습니다.
                    </p>
                    {manager && (
                        <button
                            type="button"
                            onClick={onOpenMonthlySundaysModal}
                            className={`${button} bg-primary text-primary-foreground border-transparent font-bold`}
                        >
                            <Sparkles size={14} />
                            <span>{month}월 주일 예배 자동 생성하기</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-border/60 bg-muted/40">
                                    <th className="sticky left-0 z-10 w-24 min-w-24 border-r border-border/60 bg-muted/60 px-3 py-3 font-bold text-foreground backdrop-blur-xs">
                                        파트 / 일정
                                    </th>
                                    {monthEvents.map((ev) => {
                                        const dateObj = new Date(ev.startsAt);
                                        const monthNum = dateObj.getMonth() + 1;
                                        const dayNum = dateObj.getDate();
                                        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                        const dayName = dayNames[dateObj.getDay()];
                                        const isSunday = dateObj.getDay() === 0;
                                        const timeStr = ev.startsAt.slice(11, 16);
                                        const assignedCount = ev.slots.filter((s) => s.memberId).length;
                                        const totalCount = ev.slots.length;
                                        const vacantCount = ev.slots.filter((s) => !s.memberId || s.attendance === 'absent').length;

                                        return (
                                            <th
                                                key={ev.id}
                                                className="min-w-36 border-r border-border/40 p-2.5 text-center last:border-r-0 hover:bg-muted/30 transition-colors"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectEvent(ev)}
                                                    className="w-full text-center group cursor-pointer focus:outline-hidden"
                                                    title={`${ev.title} 상세 보기`}
                                                >
                                                    <div className="flex items-center justify-center gap-1 font-bold">
                                                        <span className={isSunday ? 'text-red-500' : 'text-foreground'}>
                                                            {monthNum}.{dayNum} ({dayName})
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-normal">
                                                            {timeStr}
                                                        </span>
                                                    </div>
                                                    <div className="truncate text-xs font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                                                        {ev.title}
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px]">
                                                        {totalCount > 0 ? (
                                                            vacantCount > 0 ? (
                                                                <span className="rounded-full bg-destructive/10 px-1.5 py-0.2 text-[10px] font-bold text-destructive">
                                                                    빈자리 {vacantCount}
                                                                </span>
                                                            ) : (
                                                                <span className="rounded-full bg-emerald-600/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                    완료 ({assignedCount}/{totalCount})
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-muted-foreground">슬롯 없음</span>
                                                        )}
                                                    </div>
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {ROLE_DISPLAY_ORDER.map((roleKey) => {
                                    return (
                                        <tr key={roleKey} className="hover:bg-muted/20 transition-colors">
                                            {/* 왼쪽 고정 파트 헤더 */}
                                            <td className="sticky left-0 z-10 border-r border-border/60 bg-card px-3 py-2.5 font-bold text-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="size-2 rounded-full bg-primary/40 shrink-0" />
                                                    <span className="truncate">{worshipRoles[roleKey]}</span>
                                                </div>
                                            </td>

                                            {/* 각 일정의 해당 파트 슬롯 셀 */}
                                            {monthEvents.map((ev) => {
                                                const matchingSlots = slotsByEventAndRole.get(`${ev.id}:${roleKey}`) ?? [];

                                                if (matchingSlots.length === 0) {
                                                    return (
                                                        <td
                                                            key={ev.id}
                                                            className="border-r border-border/40 p-2 text-center text-muted-foreground/40 last:border-r-0"
                                                        >
                                                            -
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td
                                                        key={ev.id}
                                                        className="border-r border-border/40 p-1.5 align-middle last:border-r-0"
                                                    >
                                                        <div className="flex flex-col gap-1">
                                                            {matchingSlots.map((slot) => {
                                                                const memberName = slot.memberId ? names.get(slot.memberId) ?? '팀원' : null;
                                                                const isMe = slot.memberId === userId;
                                                                const isVacant = !slot.memberId;
                                                                const isAbsent = slot.attendance === 'absent';

                                                                return (
                                                                    <div
                                                                        key={slot.id}
                                                                        className={`relative flex items-center justify-between rounded-lg border px-2 py-1 transition-all ${
                                                                            isVacant
                                                                                ? 'border-dashed border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
                                                                                : isAbsent
                                                                                ? 'border-destructive/30 bg-destructive/10 text-destructive line-through'
                                                                                : isMe
                                                                                ? 'border-primary/50 bg-primary/10 text-foreground font-bold shadow-2xs'
                                                                                : 'border-border/70 bg-background/80 text-foreground hover:border-border'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            {/* 상태 인디케이터 점 */}
                                                                            {isVacant ? (
                                                                                <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                                                                            ) : slot.attendance === 'confirmed' ? (
                                                                                <CheckCircle2
                                                                                    size={11}
                                                                                    className="text-emerald-600 dark:text-emerald-400 shrink-0"
                                                                                />
                                                                            ) : isAbsent ? (
                                                                                <XCircle size={11} className="text-destructive shrink-0" />
                                                                            ) : (
                                                                                <Clock
                                                                                    size={11}
                                                                                    className="text-amber-500 shrink-0"
                                                                                    aria-label="응답 대기"
                                                                                />
                                                                            )}

                                                                            <span className="truncate">
                                                                                {memberName ?? '미배정'}
                                                                            </span>
                                                                        </div>

                                                                        {/* 관리자 배정 변경 버튼 */}
                                                                        {manager && !ev.cancelled && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setAssigningSlot({ event: ev, slot })}
                                                                                className="ml-1 rounded px-1 py-0.2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
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
                </div>
            )}

            {/* 이번 달 사역자별 섬김 횟수 (Workload Balance) 패널 */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <UserCheck size={14} className="text-primary" />
                        {month}월 팀원별 섬김 횟수 현황
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
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
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition-colors ${
                                    isHigh
                                        ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                                        : isZero
                                        ? 'border-border/60 bg-muted/40 text-muted-foreground'
                                        : 'border-border bg-background text-foreground'
                                }`}
                            >
                                <span className="font-medium">{member.name}</span>
                                <span
                                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                        isHigh
                                            ? 'bg-primary text-primary-foreground'
                                            : isZero
                                            ? 'bg-muted text-muted-foreground'
                                            : 'bg-muted/80 text-foreground'
                                    }`}
                                >
                                    {count}회
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 인라인 빠른 배정 모달 */}
            {assigningSlot && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setAssigningSlot(null);
                    }}
                >
                    <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        {/* 모바일 바텀시트 핸들 바 */}
                        <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden shrink-0" />

                        <div className="flex items-center justify-between border-b border-border/60 p-4 sm:p-5 bg-muted/30 shrink-0">
                            <div>
                                <h3 className="font-bold text-sm sm:text-base text-foreground">
                                    {assigningSlot.event.title} · {worshipRoles[assigningSlot.slot.role]}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {planningDate(assigningSlot.event.startsAt)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAssigningSlot(null)}
                                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
                            <button
                                type="button"
                                className={`w-full rounded-xl border p-2.5 text-left text-xs font-semibold transition-all ${
                                    !assigningSlot.slot.memberId
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border hover:bg-muted'
                                }`}
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
                                미배정 (빈자리로 두기)
                            </button>

                            {members.map((member) => {
                                const isCurrent = assigningSlot.slot.memberId === member.userId;
                                const workload = monthlyWorkload.get(member.userId) ?? 0;
                                const roleMatches =
                                    member.role === assigningSlot.slot.role ||
                                    (assigningSlot.slot.role === 'vocal' && member.role === 'leader') ||
                                    member.role === 'member';

                                return (
                                    <button
                                        key={member.userId}
                                        type="button"
                                        className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-xs transition-all ${
                                            isCurrent
                                                ? 'border-primary bg-primary/10 text-primary font-bold'
                                                : 'border-border hover:bg-muted'
                                        }`}
                                        disabled={disabled}
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
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{member.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                ({worshipRoles[member.role]})
                                            </span>
                                            {roleMatches && (
                                                <span className="rounded bg-primary/10 text-primary px-1 text-[9px] font-bold">
                                                    파트 일치
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-muted-foreground">
                                            이번 달 {workload}회
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
