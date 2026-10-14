'use client';

import { useId, useMemo, useState } from 'react';
import { Info, Plus, Trash2, X } from 'lucide-react';
import { type BlockedDate, type PlanningCommand } from '@/types/planning';
import { type TeamMember, worshipRoles } from '@/types/team';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/conti/ui';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';

const control = 'h-11 w-full min-w-0 rounded-2xl border border-border bg-card px-3.5 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 sm:text-sm';

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
    useSheetDismiss(onClose);

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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in sm:items-center sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-3xl sm:pb-0 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />

                {/* 헤더 */}
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">사역 불가일</p>
                        <h2 id={`${modalId}-title`} className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                            사역 불가일(휴가·시험 등) 관리
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            섬길 수 없는 날짜를 미리 등록하면 자동 배분에서 제외됩니다.
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

                {/* 본문 */}
                <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-6">
                    {/* 안내 */}
                    <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
                        <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-foreground">스마트 사역 배려 시스템</p>
                            <p className="mt-0.5">
                                등록된 불가일에는 인도자의 <strong className="font-semibold text-foreground">‘스마트 자동 배분’</strong> 및 <strong className="font-semibold text-foreground">‘지난 배정 복사’</strong> 실행 시 자동으로 배정에서 제외됩니다.
                            </p>
                        </div>
                    </div>

                    {/* 등록 */}
                    <form onSubmit={handleAdd} className="space-y-4">
                        <h3 className="text-[15px] font-semibold text-foreground">새 불가일 등록하기</h3>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor={`${modalId}-date`} className="block text-xs font-medium text-muted-foreground">
                                    불가 날짜 (필수)
                                </label>
                                <input
                                    id={`${modalId}-date`}
                                    type="date"
                                    required
                                    min={todayStr}
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className={control}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {upcomingSundays.map(s => (
                                        <Button
                                            key={s.date}
                                            type="button"
                                            size="xs"
                                            variant={date === s.date ? 'default' : 'outline'}
                                            aria-pressed={date === s.date}
                                            onClick={() => setDate(s.date)}
                                        >
                                            {s.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor={`${modalId}-reason`} className="block text-xs font-medium text-muted-foreground">
                                    사유 (선택)
                                </label>
                                <input
                                    id={`${modalId}-reason`}
                                    type="text"
                                    maxLength={50}
                                    placeholder="예: 가족 행사, 시험, 출장"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className={control}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_REASONS.map(r => (
                                        <Button
                                            key={r}
                                            type="button"
                                            size="xs"
                                            variant={reason === r ? 'default' : 'outline'}
                                            aria-pressed={reason === r}
                                            onClick={() => setReason(r)}
                                        >
                                            {r}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        <Button type="submit" size="sm" disabled={disabled || pending || !date}>
                            <Plus />
                            <span>불가일 등록</span>
                        </Button>
                    </form>

                    {/* 내 불가일 */}
                    <section className="space-y-1">
                        <h3 className="text-[15px] font-semibold text-foreground">
                            내가 등록한 불가일 <span className="font-normal tabular-nums text-muted-foreground">({myBlockedDates.length}건)</span>
                        </h3>

                        {myBlockedDates.length === 0 ? (
                            <p className="py-3 text-sm text-muted-foreground">
                                아직 등록된 사역 불가일이 없습니다.
                            </p>
                        ) : (
                            <ul>
                                {myBlockedDates.map((item) => (
                                    <li key={item.date} className="flex items-center justify-between gap-3 border-b border-border/70 py-3 last:border-b-0">
                                        <div className="min-w-0">
                                            <p className="text-[15px] font-medium tabular-nums text-foreground">
                                                {formatDisplayDate(item.date)}
                                            </p>
                                            {item.reason && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    사유: {item.reason}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={disabled || pending}
                                            onClick={() => handleRemove(item.date)}
                                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                                            title="이 불가일 삭제"
                                            aria-label="이 불가일 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* 관리자: 팀원들의 불가일 현황 */}
                    {manager && othersBlockedDates.length > 0 && (
                        <section className="space-y-1">
                            <h3 className="text-[15px] font-semibold text-foreground">
                                팀원들의 불가일 현황 <span className="font-normal tabular-nums text-muted-foreground">{othersBlockedDates.length}건</span>
                            </h3>
                            <ul className="max-h-56 overflow-y-auto">
                                {othersBlockedDates.map((item, idx) => {
                                    const m = memberMap.get(item.memberId);
                                    return (
                                        <li
                                            key={`${item.memberId}-${item.date}-${idx}`}
                                            className="flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0"
                                        >
                                            <Avatar name={m?.name ?? '팀원'} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {m?.name ?? '팀원'} <span className="text-xs font-normal text-muted-foreground">({m ? worshipRoles[m.role] : '역할'})</span>
                                                </p>
                                                <p className="text-xs tabular-nums text-muted-foreground">{formatDisplayDate(item.date)}</p>
                                            </div>
                                            {item.reason && (
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    {item.reason}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </div>

                {/* 닫기 */}
                <div className="flex shrink-0 justify-end border-t border-border/70 px-5 py-4 sm:px-6">
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>
                        확인 완료 (닫기)
                    </Button>
                </div>
            </div>
        </div>
    );
}
