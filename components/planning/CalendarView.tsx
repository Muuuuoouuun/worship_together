'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { type TeamSchedule } from '@/types/planning';
import { type TeamMember } from '@/types/team';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TONE_BLOCK, TONE_DOT } from '@/components/conti/ui';

const WEEK_HEAD = ['일', '월', '화', '수', '목', '금', '토'];

/** 저장된 시각(UTC ISO)을 한국 시간 날짜(YYYY-MM-DD)·시각(HH:MM)으로 바꿉니다. */
function kst(iso: string) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    const shifted = new Date(ms + 9 * 60 * 60 * 1000).toISOString();
    return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** 일정 점 색: 빈자리 = 주황(주의), 내 사역 = 검정, 그 외 예배 = 하늘, 연습 = 민트 */
function dotClass(event: TeamSchedule, userId: string) {
    if (event.slots.some((s) => !s.memberId || s.attendance === 'absent')) return 'bg-secondary';
    if (event.slots.some((s) => s.memberId === userId)) return 'bg-foreground';
    return event.kind === 'worship' ? TONE_DOT.sky : TONE_DOT.mint;
}

/** 'YYYY-MM-DD' → '10월 18일 (토)' */
function dayLabel(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}월 ${d}일 (${WEEK_HEAD[new Date(y, m - 1, d).getDay()]})`;
}

/** 모바일 점 표시 개수. 넘치면 '+N' 으로 나머지 개수를 보여 줍니다. */
const MAX_DOTS = 3;

export default function CalendarView({
    events,
    userId,
    manager,
    selectedDate,
    selectedEventId,
    onSelectEvent,
    onOpenMonthlySundaysModal,
    onAddEventOnDate,
}: {
    events: TeamSchedule[];
    members: TeamMember[];
    names: Map<string, string>;
    userId: string;
    manager: boolean;
    /** 선택된 일정의 날짜 (YYYY-MM-DD) — 검정 원으로 표시 */
    selectedDate?: string;
    /** 선택된 일정 id — 모바일 '이 날 일정' 목록에서 표시 */
    selectedEventId?: string | null;
    onSelectEvent: (event: TeamSchedule) => void;
    onOpenMonthlySundaysModal: () => void;
    onAddEventOnDate: (dateStr: string) => void;
}) {
    const today = useMemo(() => new Date(), []);
    const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    // 마지막으로 누른 날짜. 모바일에서는 이 날의 일정을 달력 아래에 모두 보여 줍니다.
    const [pickedDate, setPickedDate] = useState<string | null>(null);

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
        const pad = (n: number) => String(n).padStart(2, '0');

        const days: Array<{
            dateStr: string;
            dayNumber: number;
            isCurrentMonth: boolean;
            isToday: boolean;
        }> = [];

        // Previous month padding
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            days.push({ dateStr: `${prevYear}-${pad(prevMonth)}-${pad(d)}`, dayNumber: d, isCurrentMonth: false, isToday: false });
        }

        // Current month days
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const isToday =
                today.getFullYear() === year &&
                today.getMonth() + 1 === month &&
                today.getDate() === d;
            days.push({ dateStr: `${year}-${pad(month)}-${pad(d)}`, dayNumber: d, isCurrentMonth: true, isToday });
        }

        // Next month padding to fill grid
        const remaining = (7 - (days.length % 7)) % 7;
        for (let d = 1; d <= remaining; d++) {
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            days.push({ dateStr: `${nextYear}-${pad(nextMonth)}-${pad(d)}`, dayNumber: d, isCurrentMonth: false, isToday: false });
        }

        return { calendarDays: days };
    }, [year, month, today]);

    // Map events by date (YYYY-MM-DD)
    const eventsByDate = useMemo(() => {
        const map = new Map<string, TeamSchedule[]>();
        for (const ev of events) {
            if (ev.cancelled) continue;
            // 한국 시간 기준 날짜로 묶습니다 (저장값은 UTC ISO).
            const dateKey = kst(ev.startsAt).date;
            const list = map.get(dateKey) ?? [];
            list.push(ev);
            map.set(dateKey, list);
        }
        // 하루 안에서는 시작 시각 순서로 (점·칩·목록이 같은 순서)
        for (const list of map.values()) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
        return map;
    }, [events]);

    /** 날짜를 고릅니다. 일정이 있으면 (이미 그 날 일정을 보고 있지 않은 한) 첫 일정을 열고, 비어 있으면 관리자는 새 일정을 등록합니다. */
    function openDay(dateStr: string, dayEvents: TeamSchedule[], isCurrentMonth: boolean) {
        setPickedDate(dateStr);
        if (dayEvents.length > 0) {
            if (selectedDate !== dateStr) onSelectEvent(dayEvents[0]);
        } else if (manager && isCurrentMonth) {
            onAddEventOnDate(dateStr);
        }
    }

    function pickEvent(dateStr: string, event: TeamSchedule) {
        setPickedDate(dateStr);
        onSelectEvent(event);
    }

    const focusDate = pickedDate ?? selectedDate;
    const focusVisible = focusDate ? calendarDays.some((day) => day.dateStr === focusDate) : false;
    const focusEvents = focusDate && focusVisible ? (eventsByDate.get(focusDate) ?? []) : [];

    return (
        <section aria-label={`${year}년 ${month}월 일정 달력`} className="space-y-3 animate-in fade-in duration-200">
            {/* 달 이동 */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] font-semibold tabular-nums text-foreground">
                        {year}년 {month}월
                    </h3>
                    <Button type="button" variant="outline" size="xs" onClick={handleToday}>
                        오늘
                    </Button>
                </div>

                <div className="flex items-center gap-1">
                    {manager && (
                        <Button type="button" variant="outline" size="xs" className="mr-1 hidden sm:inline-flex" onClick={onOpenMonthlySundaysModal}>
                            <CalendarDays className="text-muted-foreground" />
                            <span>이번 달 주일예배 일괄 생성</span>
                        </Button>
                    )}
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="이전 달"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="다음 달"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* 달력 */}
            <div className="grid grid-cols-7 text-center">
                {WEEK_HEAD.map((label) => (
                    <span key={label} className="pb-2 text-xs text-muted-foreground sm:pl-2.5 sm:text-left">
                        {label}
                    </span>
                ))}

                {calendarDays.map((day) => {
                    const dayEvents = eventsByDate.get(day.dateStr) ?? [];
                    const isSelected = focusDate === day.dateStr;
                    const overflow = dayEvents.length > MAX_DOTS ? dayEvents.length - MAX_DOTS : 0;

                    return (
                        <div
                            key={day.dateStr}
                            onClick={() => openDay(day.dateStr, dayEvents, day.isCurrentMonth)}
                            className={cn(
                                'group flex min-w-0 cursor-pointer flex-col items-center gap-1 py-1 transition-colors',
                                'sm:min-h-[7.5rem] sm:items-stretch sm:gap-1.5 sm:border-t sm:border-border/70 sm:px-1 sm:py-2 sm:hover:bg-muted/40',
                                !day.isCurrentMonth && 'opacity-40',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        'flex size-9 items-center justify-center rounded-full text-[15px] tabular-nums sm:size-7 sm:text-[13px]',
                                        isSelected
                                            ? 'bg-primary font-semibold text-primary-foreground'
                                            : day.isToday
                                            ? 'font-semibold text-brand'
                                            : day.isCurrentMonth
                                            ? 'text-foreground/75'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {day.dayNumber}
                                </span>

                                {manager && day.isCurrentMonth && (
                                    <button
                                        type="button"
                                        title={`${day.dateStr} 새 일정 등록`}
                                        aria-label={`${day.dateStr} 새 일정 등록`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPickedDate(day.dateStr);
                                            onAddEventOnDate(day.dateStr);
                                        }}
                                        className="hidden size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted hover:text-brand focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                            </div>

                            {/* 모바일: 날짜 아래 점 (넘치면 +N — 누르면 아래 목록에 이 날 일정이 모두 나옵니다) */}
                            <div className="flex h-3 items-center justify-center gap-0.5 sm:hidden">
                                {dayEvents.slice(0, MAX_DOTS).map((ev) => (
                                    <button
                                        key={ev.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pickEvent(day.dateStr, ev);
                                        }}
                                        className="flex h-3 w-2.5 items-center justify-center"
                                        title={`${ev.title} (${kst(ev.startsAt).time})`}
                                        aria-label={`${ev.title} (${kst(ev.startsAt).time})`}
                                    >
                                        <span className={cn('size-1.5 rounded-full', dotClass(ev, userId))} />
                                    </button>
                                ))}
                                {overflow > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openDay(day.dateStr, dayEvents, day.isCurrentMonth);
                                        }}
                                        className="flex h-3 items-center text-[9px] font-semibold leading-none tabular-nums text-muted-foreground"
                                        aria-label={`${dayLabel(day.dateStr)} 일정 ${dayEvents.length}개 모두 보기`}
                                    >
                                        +{overflow}
                                    </button>
                                )}
                            </div>

                            {/* 데스크톱: 일정 칩 */}
                            <div className="hidden max-h-[5.5rem] flex-1 space-y-1 overflow-y-auto sm:block">
                                {dayEvents.map((ev) => {
                                    const isMyDuty = ev.slots.some((s) => s.memberId === userId);
                                    const assignedCount = ev.slots.filter((s) => s.memberId).length;
                                    const totalCount = ev.slots.length;
                                    const vacantCount = ev.slots.filter((s) => !s.memberId || s.attendance === 'absent').length;
                                    const timeStr = kst(ev.startsAt).time;

                                    return (
                                        <button
                                            key={ev.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                pickEvent(day.dateStr, ev);
                                            }}
                                            className={cn(
                                                'w-full rounded-lg px-1.5 py-1 text-left text-[11px] text-foreground transition hover:brightness-95 dark:hover:brightness-125',
                                                TONE_BLOCK[ev.kind === 'worship' ? 'sky' : 'mint'],
                                                isMyDuty && 'ring-1 ring-foreground/70',
                                            )}
                                        >
                                            <span className="flex items-center justify-between gap-1">
                                                <span className="truncate font-medium">{ev.title}</span>
                                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeStr}</span>
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[10px]">
                                                {isMyDuty && <span className="font-semibold text-foreground">내 사역</span>}
                                                {totalCount > 0 ? (
                                                    vacantCount > 0 ? (
                                                        <span className="font-semibold text-secondary">빈자리 {vacantCount}</span>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">{assignedCount}/{totalCount}</span>
                                                    )
                                                ) : null}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 점 범례 */}
            <p className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground sm:hidden">
                <span className="inline-flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', TONE_DOT.sky)} aria-hidden="true" />예배</span>
                <span className="inline-flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', TONE_DOT.mint)} aria-hidden="true" />연습</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />내 사역</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />빈자리</span>
            </p>

            {/* 모바일: 고른 날의 일정 전부 + 이 날 일정 추가 (데스크톱은 칸 안 칩과 '+' 로 충분) */}
            {focusDate && focusEvents.length > 0 && (
                <section aria-label={`${dayLabel(focusDate)} 일정`} className="border-t border-border/70 pt-3 sm:hidden">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] font-semibold text-foreground">
                            {dayLabel(focusDate)}
                            <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">일정 {focusEvents.length}개</span>
                        </p>
                        {manager && (
                            <Button type="button" size="xs" onClick={() => onAddEventOnDate(focusDate)}>
                                <Plus />
                                <span>이 날 일정 추가</span>
                            </Button>
                        )}
                    </div>
                    <ul className="mt-1">
                        {focusEvents.map((ev) => {
                            const isCurrent = ev.id === selectedEventId;
                            const isMyDuty = ev.slots.some((s) => s.memberId === userId);
                            const vacantCount = ev.slots.filter((s) => !s.memberId || s.attendance === 'absent').length;
                            return (
                                <li key={ev.id} className="border-b border-border/70 last:border-b-0">
                                    <button
                                        type="button"
                                        aria-current={isCurrent ? 'true' : undefined}
                                        onClick={() => pickEvent(focusDate, ev)}
                                        className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                                    >
                                        <span className={cn('size-2 shrink-0 rounded-full', dotClass(ev, userId))} aria-hidden="true" />
                                        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">{kst(ev.startsAt).time}</span>
                                        <span className={cn('min-w-0 flex-1 truncate text-[15px] text-foreground', isCurrent ? 'font-semibold' : 'font-medium')}>{ev.title}</span>
                                        {vacantCount > 0 ? (
                                            <span className="shrink-0 text-xs font-semibold text-secondary">빈자리 {vacantCount}</span>
                                        ) : isMyDuty ? (
                                            <span className="shrink-0 text-xs font-semibold text-foreground">내 사역</span>
                                        ) : null}
                                        {isCurrent && <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </section>
    );
}
