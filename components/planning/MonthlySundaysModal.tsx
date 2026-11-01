'use client';

import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { scheduleTemplates, type PlanningCommand, type ScheduleTemplateKey } from '@/types/planning';
import { Button } from '@/components/ui/button';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';

const control = 'mt-1.5 h-11 w-full min-w-0 rounded-2xl border border-border bg-card px-3.5 text-base font-normal text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 sm:text-sm';
const fieldLabel = 'block text-xs font-medium text-muted-foreground';

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
    const dialogRef = useSheetDismiss(onClose);

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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalId}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in sm:items-center sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-3xl sm:pb-0 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />

                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">일괄 생성</p>
                        <h3 id={modalId} className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                            이번 달 주일예배 일괄 등록 (4~5주)
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            선택한 연도/월의 모든 주일(일요일) 일정을 역할 템플릿과 함께 클릭 한 번으로 일괄 생성합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="grid grid-cols-2 gap-3">
                            <label className={fieldLabel}>
                                연도
                                <select className={control} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                                    {[year - 1, year, year + 1].map((y) => (
                                        <option key={y} value={y}>
                                            {y}년
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={fieldLabel}>
                                월
                                <select className={control} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {m}월
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className={fieldLabel}>
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
                            <label className={fieldLabel}>
                                시작 시간
                                <input type="time" className={control} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                            </label>
                            <label className={fieldLabel}>
                                종료 시간
                                <input type="time" className={control} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className={fieldLabel}>
                                역할 템플릿
                                <select className={control} value={templateKey} onChange={(e) => setTemplateKey(e.target.value as ScheduleTemplateKey)}>
                                    {Object.entries(scheduleTemplates).map(([k, t]) => (
                                        <option key={k} value={k}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={fieldLabel}>
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
                        <div className="space-y-2.5 rounded-2xl bg-muted/60 p-4">
                            <p className="text-[13px] font-semibold text-foreground">
                                {year}년 {month}월 생성 대상: 총 {sundays.length}회 예배
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {sundays.map((sun, idx) => (
                                    <span key={idx} className="inline-flex h-7 items-center rounded-full bg-card px-3 text-xs font-medium tabular-nums text-foreground">
                                        {sun.getMonth() + 1}월 {sun.getDate()}일 (주일)
                                    </span>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                각 예배마다 &apos;{scheduleTemplates[templateKey].name}&apos; 배정 슬롯이 자동으로 구성됩니다.
                            </p>
                        </div>

                        {error && (
                            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
                        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                            취소
                        </Button>
                        <Button type="submit" size="sm" disabled={disabled || pending || !title.trim()}>
                            {pending ? '일정 생성 중…' : `${sundays.length}개 주일예배 일괄 등록`}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
