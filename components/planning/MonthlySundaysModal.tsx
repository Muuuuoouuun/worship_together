'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarDays, Sparkles, X } from 'lucide-react';
import { scheduleTemplates, type PlanningCommand, type ScheduleTemplateKey } from '@/types/planning';

const control = 'min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90 font-bold`;

export default function MonthlySundaysModal({
    onClose,
    onSend,
    disabled,
}: {
    onClose: () => void;
    onSend: (command: PlanningCommand) => Promise<boolean>;
    disabled: boolean;
}) {
    const modalId = useId();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [title, setTitle] = useState('주일 예배');
    const [templateKey, setTemplateKey] = useState<ScheduleTemplateKey>('standard');
    const [startTime, setStartTime] = useState('11:00');
    const [endTime, setEndTime] = useState('12:30');
    const [location, setLocation] = useState('본당 2층');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');

    // Calculate sundays in selected month
    const sundays = useMemo(() => {
        const dates: Date[] = [];
        const d = new Date(year, month - 1, 1);
        while (d.getMonth() === month - 1) {
            if (d.getDay() === 0) {
                dates.push(new Date(d));
            }
            d.setDate(d.getDate() + 1);
        }
        return dates;
    }, [year, month]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (disabled || pending) return;
        setError('');

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        if (Number.isNaN(startHour) || Number.isNaN(endHour)) {
            setError('시작 및 종료 시간을 확인해주세요.');
            return;
        }

        setPending(true);
        try {
            const ok = await onSend({
                type: 'event.createMonthlySundays',
                year,
                month,
                startHour,
                startMinute,
                endHour,
                endMinute,
                title: title.trim(),
                location: location.trim(),
                templateKey,
            });
            if (ok) {
                onClose();
            } else {
                setError('일정을 일괄 생성하지 못했습니다. 다시 시도해주세요.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setPending(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalId}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="text-primary" size={20} />
                        <h3 id={modalId} className="text-base sm:text-lg font-bold text-foreground">
                            이번 달 주일예배 일괄 등록 (4~5주)
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                    선택한 연도/월의 모든 주일(일요일) 일정을 역할 템플릿과 함께 클릭 한 번으로 일괄 생성합니다.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-foreground">
                            연도
                            <select
                                className={control}
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                            >
                                {[year - 1, year, year + 1].map((y) => (
                                    <option key={y} value={y}>
                                        {y}년
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-foreground">
                            월
                            <select
                                className={control}
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>
                                        {m}월
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block text-xs font-semibold text-foreground">
                        예배 명칭
                        <input
                            className={control}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="예: 주일 2부예배"
                            maxLength={80}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-foreground">
                            시작 시간
                            <input
                                type="time"
                                className={control}
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                            />
                        </label>
                        <label className="text-xs font-semibold text-foreground">
                            종료 시간
                            <input
                                type="time"
                                className={control}
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                required
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-foreground">
                            역할 템플릿
                            <select
                                className={control}
                                value={templateKey}
                                onChange={(e) => setTemplateKey(e.target.value as ScheduleTemplateKey)}
                            >
                                {Object.entries(scheduleTemplates).map(([k, t]) => (
                                    <option key={k} value={k}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-foreground">
                            장소
                            <input
                                className={control}
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="예: 대예배실"
                                maxLength={120}
                            />
                        </label>
                    </div>

                    {/* 생성 대상 주일 미리보기 */}
                    <div className="rounded-2xl border border-border/80 bg-muted/40 p-3.5 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <Sparkles size={14} className="text-primary" />
                            <span>
                                {year}년 {month}월 생성 대상: 총 {sundays.length}회 예배
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {sundays.map((sun, idx) => (
                                <span
                                    key={idx}
                                    className="rounded-lg bg-card border border-border px-2.5 py-1 text-xs font-semibold text-foreground"
                                >
                                    {sun.getMonth() + 1}월 {sun.getDate()}일 (주일)
                                </span>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            각 예배마다 &apos;{scheduleTemplates[templateKey].name}&apos; 배정 슬롯이 자동으로 구성됩니다.
                        </p>
                    </div>

                    {error && (
                        <p role="alert" className="text-xs font-semibold text-destructive">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        <button type="button" onClick={onClose} className={`${button} text-xs py-2`}>
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={disabled || pending || !title.trim()}
                            className={`${primary} text-xs py-2`}
                        >
                            {pending ? '일정 생성 중…' : `${sundays.length}개 주일예배 일괄 등록`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
