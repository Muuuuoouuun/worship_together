'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarX2, Info, Plus, Trash2, X } from 'lucide-react';
import { type BlockedDate, type PlanningCommand } from '@/types/planning';
import { type TeamMember, worshipRoles } from '@/types/team';

const control = 'min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90 font-bold`;

export default function BlockedDatesModal({
    onClose,
    onSend,
    blockedDates = [],
    userId,
    members,
    manager,
    disabled,
}: {
    onClose: () => void;
    onSend: (command: PlanningCommand) => Promise<boolean>;
    blockedDates?: BlockedDate[];
    userId: string;
    members: TeamMember[];
    manager: boolean;
    disabled: boolean;
}) {
    const modalId = useId();
    const todayStr = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    const upcomingSundays = useMemo(() => {
        const sundays: Array<{ date: string; label: string }> = [];
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kst = new Date(utc + (9 * 3600000));
        kst.setHours(0, 0, 0, 0);

        const daysUntilSunday = (0 - kst.getDay() + 7) % 7;
        const labels = ['이번 주 주일', '다음 주 주일', '다다음 주 주일'];
        for (let i = 0; i < 3; i++) {
            const target = new Date(kst.getFullYear(), kst.getMonth(), kst.getDate() + daysUntilSunday + (i * 7));
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const d = String(target.getDate()).padStart(2, '0');
            const dStr = `${y}-${m}-${d}`;
            sundays.push({
                date: dStr,
                label: `${labels[i]} (${target.getMonth() + 1}/${target.getDate()})`,
            });
        }
        return sundays;
    }, []);

    const QUICK_REASONS = ['시험 기간', '개인 사정', '가족 행사', '출장/근무', '여행/휴가', '건강/휴식'];

    const [date, setDate] = useState(todayStr);
    const [reason, setReason] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');

    const memberMap = useMemo(() => new Map(members.map(m => [m.userId, m])), [members]);

    const myBlockedDates = useMemo(() => {
        return blockedDates
            .filter(b => b.memberId === userId)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [blockedDates, userId]);

    const othersBlockedDates = useMemo(() => {
        if (!manager) return [];
        return blockedDates
            .filter(b => b.memberId !== userId)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [blockedDates, userId, manager]);

    const formatDisplayDate = (dStr: string) => {
        try {
            const [y, m, d] = dStr.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            return `${y}년 ${m}월 ${d}일 (${dayNames[dt.getDay()]})`;
        } catch {
            return dStr;
        }
    };

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (disabled || pending) return;
        setError('');

        if (!date) {
            setError('날짜를 선택해주세요.');
            return;
        }

        if (myBlockedDates.some(b => b.date === date)) {
            setError('이미 등록된 불가일입니다.');
            return;
        }

        setPending(true);
        try {
            const ok = await onSend({
                type: 'member.blockDate',
                date,
                reason: reason.trim() || undefined,
            });
            if (ok) {
                setReason('');
            } else {
                setError('불가일 등록에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '요청 처리 중 오류가 발생했습니다.');
        } finally {
            setPending(false);
        }
    }

    async function handleRemove(dateToRemove: string) {
        if (disabled || pending) return;
        setError('');
        setPending(true);
        try {
            const ok = await onSend({
                type: 'member.unblockDate',
                date: dateToRemove,
            });
            if (!ok) {
                setError('불가일 삭제에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '요청 처리 중 오류가 발생했습니다.');
        } finally {
            setPending(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                {/* 모바일 바텀시트 핸들 바 */}
                <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden shrink-0" />

                {/* 헤더 */}
                <div className="flex items-center justify-between border-b border-border p-4 sm:p-5 bg-muted/30">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                            <CalendarX2 size={20} />
                        </div>
                        <div>
                            <h2 id={`${modalId}-title`} className="text-base font-bold text-foreground">
                                사역 불가일(휴가·시험 등) 관리
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                섬길 수 없는 날짜를 미리 등록하면 자동 배분에서 제외됩니다.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 안내 팁 배너 */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
                        <Info size={16} className="text-primary shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-foreground">스마트 사역 배려 시스템</p>
                            <p className="mt-0.5 leading-relaxed">
                                등록된 불가일에는 인도자의 <strong className="text-primary font-bold">‘스마트 자동 배분’</strong> 및 <strong className="text-primary font-bold">‘지난 배정 복사’</strong> 실행 시 자동으로 배정에서 제외됩니다.
                            </p>
                        </div>
                    </div>

                    {/* 등록 폼 */}
                    <form onSubmit={handleAdd} className="space-y-3 rounded-2xl border border-border p-4 bg-muted/20">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            새 불가일 등록하기
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1">
                                    불가 날짜 (필수)
                                </label>
                                <input
                                    type="date"
                                    required
                                    min={todayStr}
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className={control}
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {upcomingSundays.map(s => (
                                        <button
                                            key={s.date}
                                            type="button"
                                            className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all ${
                                                date === s.date
                                                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                                                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                            onClick={() => setDate(s.date)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1">
                                    사유 (선택)
                                </label>
                                <input
                                    type="text"
                                    maxLength={50}
                                    placeholder="예: 가족 행사, 시험, 출장"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className={control}
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {QUICK_REASONS.map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all ${
                                                reason === r
                                                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                                                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                            onClick={() => setReason(r)}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className="text-xs text-destructive font-medium">
                                {error}
                            </p>
                        )}

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={disabled || pending || !date}
                                className={`${primary} text-xs py-2 px-3.5 min-h-9 flex items-center gap-1.5`}
                            >
                                <Plus size={14} />
                                <span>불가일 등록</span>
                            </button>
                        </div>
                    </form>

                    {/* 내 불가일 목록 */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground">
                                내가 등록한 불가일 ({myBlockedDates.length}건)
                            </h3>
                        </div>

                        {myBlockedDates.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                                아직 등록된 사역 불가일이 없습니다.
                            </div>
                        ) : (
                            <ul className="space-y-1.5">
                                {myBlockedDates.map((item) => (
                                    <li
                                        key={item.date}
                                        className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs"
                                    >
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-foreground">
                                                {formatDisplayDate(item.date)}
                                            </p>
                                            {item.reason && (
                                                <p className="text-muted-foreground">
                                                    사유: {item.reason}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={disabled || pending}
                                            onClick={() => handleRemove(item.date)}
                                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                                            title="이 불가일 삭제"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* 관리자 뷰: 팀원들의 불가일 현황 */}
                    {manager && othersBlockedDates.length > 0 && (
                        <div className="space-y-2.5 pt-2 border-t border-border">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <span>팀원들의 불가일 현황</span>
                                <span className="rounded-full bg-secondary/15 text-secondary px-2 py-0.5 text-xs font-semibold">
                                    {othersBlockedDates.length}건
                                </span>
                            </h3>
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                                {othersBlockedDates.map((item, idx) => {
                                    const m = memberMap.get(item.memberId);
                                    return (
                                        <li
                                            key={`${item.memberId}-${item.date}-${idx}`}
                                            className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-foreground">
                                                    {m?.name ?? '팀원'} ({m ? worshipRoles[m.role] : '역할'})
                                                </span>
                                                <span className="text-muted-foreground">
                                                    · {formatDisplayDate(item.date)}
                                                </span>
                                            </div>
                                            {item.reason && (
                                                <span className="text-muted-foreground italic">
                                                    {item.reason}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                {/* 닫기 푸터 */}
                <div className="flex justify-end border-t border-border p-4 bg-muted/10">
                    <button type="button" onClick={onClose} className={button}>
                        확인 완료 (닫기)
                    </button>
                </div>
            </div>
        </div>
    );
}
