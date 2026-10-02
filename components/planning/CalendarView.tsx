'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { type TeamSchedule } from '@/types/planning';
import { type TeamMember } from '@/types/team';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

export default function CalendarView({
    events,
    userId,
    manager,
    onSelectEvent,
    onOpenMonthlySundaysModal,
    onAddEventOnDate,
}: {
    events: TeamSchedule[];
    members: TeamMember[];
    names: Map<string, string>;
    userId: string;
    manager: boolean;
    onSelectEvent: (event: TeamSchedule) => void;
    onOpenMonthlySundaysModal: () => void;
    onAddEventOnDate: (dateStr: string) => void;
}) {
    const today = useMemo(() => new Date(), []);
    const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    function handlePrevMonth() {
        setCurrentDate(new Date(year, month - 2, 1));
    }

    function handleNextMonth() {
        setCurrentDate(new Date(year, month, 1));
    }

    function handleToday() {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    // Build days grid
    const { calendarDays } = useMemo(() => {
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 (Sun) ~ 6 (Sat)
        const daysInCurrentMonth = new Date(year, month, 0).getDate();
        const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

        const days: Array<{
            dateStr: string;
            dayNumber: number;
            isCurrentMonth: boolean;
            isToday: boolean;
            isSunday: boolean;
            isSaturday: boolean;
        }> = [];

        // Previous month padding
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${prevYear}-${pad(prevMonth)}-${pad(d)}`;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: false,
                isToday: false,
                isSunday: days.length % 7 === 0,
                isSaturday: days.length % 7 === 6,
            });
        }

        // Current month days
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${year}-${pad(month)}-${pad(d)}`;
            const isToday =
                today.getFullYear() === year &&
                today.getMonth() + 1 === month &&
                today.getDate() === d;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: true,
                isToday,
                isSunday: days.length % 7 === 0,
                isSaturday: days.length % 7 === 6,
            });
        }

        // Next month padding to fill grid
        const remaining = (7 - (days.length % 7)) % 7;
        for (let d = 1; d <= remaining; d++) {
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${nextYear}-${pad(nextMonth)}-${pad(d)}`;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: false,
                isToday: false,
                isSunday: days.length % 7 === 0,
                isSaturday: days.length % 7 === 6,
            });
        }

        return { calendarDays: days };
    }, [year, month, today]);

    // Map events by date (YYYY-MM-DD)
    const eventsByDate = useMemo(() => {
        const map = new Map<string, TeamSchedule[]>();
        for (const ev of events) {
            if (ev.cancelled) continue;
            // e.g. startsAt: "2026-09-27T11:00:00+09:00" -> "2026-09-27"
            const dateKey = ev.startsAt.slice(0, 10);
            const list = map.get(dateKey) ?? [];
            list.push(ev);
            map.set(dateKey, list);
        }
        return map;
    }, [events]);

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* 캘린더 네비게이션 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/70 shadow-2xs">
                <div className="flex items-center gap-2">
                    <CalendarDays size={20} className="text-primary" />
                    <h3 className="text-lg font-bold text-foreground">
                        {year}년 {month}월
                    </h3>
                    <button
                        type="button"
                        onClick={handleToday}
                        className={`${button} ml-2 text-xs py-1 h-7 rounded-lg`}
                    >
                        오늘
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {manager && (
                        <button
                            type="button"
                            onClick={onOpenMonthlySundaysModal}
                            className={`${button} bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/20 text-xs py-1.5 h-8`}
                        >
                            <Sparkles size={13} />
                            <span>이번 달 주일예배 일괄 생성</span>
                        </button>
                    )}

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className={`${button} p-1.5 h-8 w-8`}
                            aria-label="이전 달"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className={`${button} p-1.5 h-8 w-8`}
                            aria-label="다음 달"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 캘린더 그리드 */}
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xs">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 text-center text-xs font-bold py-2.5">
                    <span className="text-red-500">일</span>
                    <span>월</span>
                    <span>화</span>
                    <span>수</span>
                    <span>목</span>
                    <span>금</span>
                    <span className="text-blue-500">토</span>
                </div>

                {/* 날짜 셀 그리드 */}
                <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
                    {calendarDays.map((day) => {
                        const dayEvents = eventsByDate.get(day.dateStr) ?? [];

                        return (
                            <div
                                key={day.dateStr}
                                onClick={() => {
                                    if (dayEvents.length > 0) {
                                        onSelectEvent(dayEvents[0]);
                                    } else if (manager && day.isCurrentMonth) {
                                        onAddEventOnDate(day.dateStr);
                                    }
                                }}
                                className={`group min-h-[75px] sm:min-h-[130px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer ${
                                    day.isCurrentMonth
                                        ? 'bg-card hover:bg-muted/20'
                                        : 'bg-muted/10 opacity-40'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`inline-flex items-center justify-center size-6 text-xs rounded-full font-bold transition-transform ${
                                            day.isToday
                                                ? 'bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/25 ring-offset-1'
                                                : day.isSunday
                                                ? 'text-red-500'
                                                : day.isSaturday
                                                ? 'text-blue-500'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {day.dayNumber}
                                    </span>

                                    {manager && day.isCurrentMonth && (
                                        <button
                                            type="button"
                                            title={`${day.dateStr} 새 일정 등록`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddEventOnDate(day.dateStr);
                                            }}
                                            className="opacity-40 sm:opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* 모바일 닷 인디케이터 (sm:hidden) */}
                                <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                                    {dayEvents.map((ev) => {
                                        const isMyDuty = ev.slots.some((s) => s.memberId === userId);
                                        const vacantCount = ev.slots.filter(
                                            (s) => !s.memberId || s.attendance === 'absent'
                                        ).length;

                                        return (
                                            <button
                                                key={ev.id}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectEvent(ev);
                                                }}
                                                className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold border transition-transform active:scale-95 ${
                                                    isMyDuty
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : ev.kind === 'worship'
                                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                                        : 'border-border bg-muted/60 text-foreground'
                                                }`}
                                                title={`${ev.title} (${ev.startsAt.slice(11, 16)})`}
                                            >
                                                <span className="size-1.5 rounded-full bg-current shrink-0" />
                                                <span className="truncate max-w-[28px]">{ev.kind === 'worship' ? '예배' : '연습'}</span>
                                                {vacantCount > 0 && <span className="text-destructive font-black">!</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* 데스크톱 상세 칩 (hidden sm:block) */}
                                <div className="hidden sm:block mt-1 space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                                    {dayEvents.map((ev) => {
                                        const isMyDuty = ev.slots.some((s) => s.memberId === userId);
                                        const assignedCount = ev.slots.filter((s) => s.memberId).length;
                                        const totalCount = ev.slots.length;
                                        const vacantCount = ev.slots.filter(
                                            (s) => !s.memberId || s.attendance === 'absent'
                                        ).length;
                                        const timeStr = ev.startsAt.slice(11, 16);

                                        return (
                                            <button
                                                key={ev.id}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectEvent(ev);
                                                }}
                                                className={`w-full text-left rounded-lg p-1 text-[11px] border transition-all ${
                                                    isMyDuty
                                                        ? 'border-primary/40 bg-primary/10 text-primary font-bold hover:bg-primary/15'
                                                        : ev.kind === 'worship'
                                                        ? 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10'
                                                        : 'border-border bg-background/80 text-foreground hover:bg-muted'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1 font-bold truncate">
                                                    <span className="truncate">{ev.title}</span>
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        {timeStr}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                                                    {isMyDuty && (
                                                        <span className="font-bold text-primary">
                                                            [내 사역]
                                                        </span>
                                                    )}
                                                    {totalCount > 0 ? (
                                                        vacantCount > 0 ? (
                                                            <span className="text-destructive font-semibold">
                                                                빈자리 {vacantCount}
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                {assignedCount}/{totalCount}
                                                            </span>
                                                        )
                                                    ) : null}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
