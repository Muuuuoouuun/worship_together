'use client';

import { useId, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Send, X } from 'lucide-react';
import { planningDate, type PlanningCommand, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type TeamMember } from '@/types/team';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { STATUS, type StatusTone } from '@/components/ui/status';
import { Avatar } from '@/components/conti/ui';
import { ROLE_ICON } from '@/components/conti/planningUi';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';

const control = 'h-11 w-full min-w-0 rounded-2xl border border-border bg-card px-3.5 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 sm:text-sm';

function LegendDot({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', className)} aria-hidden="true" />
            {label}
        </span>
    );
}

function formatShortDateTime(iso?: string) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        return '';
    }
}

export default function ScheduleRsvpModal({
    event,
    members,
    userId,
    manager,
    disabled,
    onClose,
    onSend,
}: {
    event: TeamSchedule;
    members: TeamMember[];
    userId: string;
    manager: boolean;
    disabled: boolean;
    onClose: () => void;
    onSend: (command: PlanningCommand) => Promise<boolean>;
}) {
    const modalId = useId();
    const [sendingSlotId, setSendingSlotId] = useState<string | null>(null);
    const [batchSending, setBatchSending] = useState(false);
    const [customNote, setCustomNote] = useState('');
    const [copiedKakao, setCopiedKakao] = useState(false);
    const [respondingSlotId, setRespondingSlotId] = useState<string | null>(null);
    const [declineReasonText, setDeclineReasonText] = useState('');
    const [showDeclineInputSlotId, setShowDeclineInputSlotId] = useState<string | null>(null);
    const dialogRef = useSheetDismiss(onClose);

    const memberMap = useMemo(() => new Map(members.map(m => [m.userId, m])), [members]);

    const {
        totalSlots,
        assignedSlots,
        confirmedSlots,
        pendingSlots,
        absentSlots,
        unassignedSlots,
        consentRate,
    } = useMemo(() => {
        const total = event.slots.length;
        const assigned = event.slots.filter(s => s.memberId !== null);
        const confirmed = assigned.filter(s => s.attendance === 'confirmed');
        const pending = assigned.filter(s => s.attendance === 'pending');
        const absent = assigned.filter(s => s.attendance === 'absent');
        const unassigned = event.slots.filter(s => s.memberId === null);
        const rate = assigned.length > 0 ? Math.round((confirmed.length / assigned.length) * 100) : 0;
        return {
            totalSlots: total,
            assignedSlots: assigned,
            confirmedSlots: confirmed,
            pendingSlots: pending,
            absentSlots: absent,
            unassignedSlots: unassigned,
            consentRate: rate,
        };
    }, [event.slots]);

    const handleSendDirectInvite = async (slotId: string) => {
        if (disabled || sendingSlotId) return;
        setSendingSlotId(slotId);
        try {
            await onSend({
                type: 'slot.sendInvite',
                eventId: event.id,
                slotId,
                customNote: customNote.trim() || undefined,
            });
        } finally {
            setSendingSlotId(null);
        }
    };

    const handleSendBatchInvites = async () => {
        if (disabled || batchSending || pendingSlots.length === 0) return;
        setBatchSending(true);
        try {
            await onSend({
                type: 'schedule.sendInvites',
                eventId: event.id,
                target: 'pending',
                customNote: customNote.trim() || undefined,
            });
        } finally {
            setBatchSending(false);
        }
    };

    const handleAttendanceResponse = async (slotId: string, attendance: 'confirmed' | 'absent', reason?: string) => {
        if (disabled || respondingSlotId) return;
        setRespondingSlotId(slotId);
        try {
            await onSend({
                type: 'attendance.set',
                eventId: event.id,
                slotId,
                attendance,
                reason: reason ?? '',
                autoRequestSubstitute: attendance === 'absent',
            });
            setShowDeclineInputSlotId(null);
            setDeclineReasonText('');
        } finally {
            setRespondingSlotId(null);
        }
    };

    const generateRsvpSummaryText = () => {
        const dateStr = planningDate(event.startsAt);
        const lines: string[] = [
            `[⛪ 찬양팀 사역 동의 현황]`,
            `일정: ${event.title}`,
            `일시: ${dateStr}`,
            `장소: ${event.location || '미정'}`,
            `동의율: ${confirmedSlots.length}/${assignedSlots.length}명 (${consentRate}%)`,
            '',
        ];

        if (confirmedSlots.length > 0) {
            lines.push(`✅ 동의 완료 (${confirmedSlots.length}명)`);
            for (const s of confirmedSlots) {
                const name = memberMap.get(s.memberId!)?.name ?? '팀원';
                const time = s.respondedAt ? ` (${formatShortDateTime(s.respondedAt)} 확인)` : '';
                lines.push(`• ${worshipRoles[s.role]}: ${name}${time}`);
            }
            lines.push('');
        }

        if (pendingSlots.length > 0) {
            lines.push(`⏳ 응답 대기 (${pendingSlots.length}명)`);
            for (const s of pendingSlots) {
                const name = memberMap.get(s.memberId!)?.name ?? '팀원';
                const inviteStatus = s.invitedAt ? ' [초대 발송됨]' : ' [초대 대기]';
                lines.push(`• ${worshipRoles[s.role]}: ${name}${inviteStatus}`);
            }
            lines.push('');
        }

        if (absentSlots.length > 0) {
            lines.push(`❌ 불참 (${absentSlots.length}명)`);
            for (const s of absentSlots) {
                const name = memberMap.get(s.memberId!)?.name ?? '팀원';
                const reason = s.declineReason ? ` (사유: ${s.declineReason})` : '';
                lines.push(`• ${worshipRoles[s.role]}: ${name}${reason}`);
            }
            lines.push('');
        }

        if (unassignedSlots.length > 0) {
            lines.push(`⚪ 미배정 파트 (${unassignedSlots.length}개):`);
            lines.push(`• ${unassignedSlots.map(s => worshipRoles[s.role]).join(', ')}`);
            lines.push('');
        }

        lines.push('※ 일정 확인 후 참석 여부를 앱에서 응답해 주세요 🙏');
        return lines.join('\n');
    };

    const handleCopyKakaoRsvp = async () => {
        const text = generateRsvpSummaryText();
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                window.prompt('아래 텍스트를 복사하여 카카오톡 단톡방에 붙여넣으세요:', text);
            }
            setCopiedKakao(true);
            setTimeout(() => setCopiedKakao(false), 2000);
        } catch {
            window.prompt('아래 텍스트를 복사하여 카카오톡 단톡방에 붙여넣으세요:', text);
        }
    };

    const toneOf = (slot: TeamSchedule['slots'][number]): StatusTone =>
        !slot.memberId ? 'idle' : slot.attendance === 'confirmed' ? 'ok' : slot.attendance === 'absent' ? 'danger' : 'warn';

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in sm:items-center sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-3xl sm:pb-0 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />

                {/* 헤더 */}
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">
                            {event.kind === 'rehearsal' ? '연습' : '예배'}
                            {event.cancelled && <span className="font-semibold text-destructive"> · 취소됨</span>}
                        </p>
                        <h2 id={`${modalId}-title`} className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                            {event.title} 동의 내역
                        </h2>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {planningDate(event.startsAt)}
                            {event.location && ` · ${event.location}`}
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
                    {/* 배치 현황 */}
                    <section aria-label="전체 사역 동의율" className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[15px] text-foreground">
                                    <span className="font-semibold tabular-nums">{totalSlots}자리</span> 중 <span className="font-semibold tabular-nums">{confirmedSlots.length}명</span> 확정
                                </p>
                                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                    전체 사역 동의율 {consentRate}% ({confirmedSlots.length}/{assignedSlots.length}명 확정)
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="shrink-0"
                                onClick={() => void handleCopyKakaoRsvp()}
                                title="카카오톡 단톡방 공유용 동의 현황 텍스트 복사"
                            >
                                {copiedKakao ? (
                                    <>
                                        <Check className="text-brand" />
                                        <span className="text-brand">복사 완료!</span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCopy className="text-muted-foreground" />
                                        <span>단톡 공유용 복사</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {totalSlots > 0 && (
                            <div
                                className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
                                role="img"
                                aria-label={`동의 완료 ${confirmedSlots.length}, 응답 대기 ${pendingSlots.length}, 불참 ${absentSlots.length}, 미배정 ${unassignedSlots.length}`}
                            >
                                {event.slots.map((slot) => (
                                    <span key={slot.id} className={cn('flex-1', STATUS[toneOf(slot)].bar)} />
                                ))}
                            </div>
                        )}
                        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
                            <LegendDot className={STATUS.ok.dot} label={`동의 완료 ${confirmedSlots.length}명`} />
                            <LegendDot className={STATUS.warn.dot} label={`응답 대기 ${pendingSlots.length}명`} />
                            <LegendDot className={STATUS.danger.dot} label={`불참 / 사유 ${absentSlots.length}명`} />
                            <LegendDot className={STATUS.idle.dot} label={`미배정 ${unassignedSlots.length}자리`} />
                        </p>
                    </section>

                    {/* 콘티 */}
                    {event.setlistTitle && (
                        <div className="rounded-2xl bg-muted/60 px-4 py-3.5">
                            <p className="text-[11px] font-medium text-muted-foreground">콘티{event.setlistSongs?.length ? ` · ${event.setlistSongs.length}곡` : ''}</p>
                            <p className="mt-0.5 text-[15px] font-medium text-foreground">{event.setlistTitle}</p>
                            {event.setlistSongs?.length ? (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.setlistSongs.join(' · ')}</p>
                            ) : null}
                        </div>
                    )}

                    {/* 관리자: 미응답자 일괄 초대 */}
                    {manager && !event.cancelled && pendingSlots.length > 0 && (
                        <section aria-label="미응답자 일괄 초대 알림" className="space-y-2.5">
                            <h3 className="text-[15px] font-semibold text-foreground">
                                미응답자 일괄 초대 알림 <span className="font-normal tabular-nums text-muted-foreground">({pendingSlots.length}명)</span>
                            </h3>
                            <input
                                type="text"
                                placeholder="전달할 초대 메모 (선택: 예: 10시까지 본당 도착 부탁드립니다)"
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                className={control}
                            />
                            <Button
                                type="button"
                                size="sm"
                                className="w-full"
                                onClick={() => void handleSendBatchInvites()}
                                disabled={disabled || batchSending}
                            >
                                <Send />
                                <span>
                                    {batchSending ? '발송 중…' : `응답 대기 중인 ${pendingSlots.length}명 모두에게 초대 알림 발송`}
                                </span>
                            </Button>
                        </section>
                    )}

                    {/* 파트별 동의 명단 */}
                    <section aria-label="파트별 동의 현황">
                        <h3 className="text-[15px] font-semibold text-foreground">
                            파트별 동의 현황 및 이력 <span className="font-normal tabular-nums text-muted-foreground">({event.slots.length}명)</span>
                        </h3>

                        {event.slots.length === 0 ? (
                            <p className="py-4 text-sm text-muted-foreground">등록된 역할이 없습니다.</p>
                        ) : (
                            <ul className="mt-1">
                                {event.slots.map((slot) => {
                                    const member = slot.memberId ? memberMap.get(slot.memberId) : null;
                                    const isMe = slot.memberId === userId;
                                    const isPending = slot.attendance === 'pending';
                                    const isConfirmed = slot.attendance === 'confirmed';
                                    const isAbsent = slot.attendance === 'absent';
                                    const hasMember = Boolean(slot.memberId);
                                    const Icon = ROLE_ICON[slot.role];
                                    const tone = toneOf(slot);
                                    const statusLabel = !hasMember ? '미배정' : isConfirmed ? '동의 완료' : isAbsent ? '불참' : '응답 대기';
                                    const name = hasMember ? member?.name ?? '이전 팀원' : null;

                                    return (
                                        <li key={slot.id} className="border-b border-border/70 py-4 last:border-b-0">
                                            <div className="flex items-center gap-3.5">
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                                                    <Icon size={18} aria-hidden="true" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[15px] font-medium text-foreground">
                                                        {worshipRoles[slot.role]}
                                                        {isMe && <span className="ml-1.5 text-[11px] font-semibold text-brand">나</span>}
                                                    </p>
                                                    <p className="mt-0.5 text-xs leading-5">
                                                        <span className={STATUS[tone].text}>{statusLabel}</span>
                                                        {slot.invitedAt ? (
                                                            <span className="text-muted-foreground"> · 초대 발송: {formatShortDateTime(slot.invitedAt)}</span>
                                                        ) : hasMember && isPending ? (
                                                            <span className="text-muted-foreground/70"> · 초대 미발송</span>
                                                        ) : null}
                                                        {slot.respondedAt && (
                                                            <span className="text-muted-foreground"> · {isConfirmed ? '수락' : '응답'}: {formatShortDateTime(slot.respondedAt)}</span>
                                                        )}
                                                    </p>
                                                </div>
                                                {name ? (
                                                    <span className={cn('inline-flex shrink-0 items-center gap-1.5', isAbsent && 'opacity-50')}>
                                                        <Avatar name={name} size="sm" />
                                                        <span className={cn('text-[13px] text-foreground', isAbsent && 'line-through')}>{name}</span>
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 text-xs text-muted-foreground">미배정 (빈자리)</span>
                                                )}
                                            </div>

                                            {isAbsent && slot.declineReason && (
                                                <p className="mt-2 pl-[3.375rem] text-xs text-destructive">
                                                    <span className="font-semibold">불참 사유: </span>
                                                    <span>{slot.declineReason}</span>
                                                </p>
                                            )}

                                            {/* 관리자: 개별 초대 발송/재발송 */}
                                            {manager && !event.cancelled && hasMember && isPending && (
                                                <div className="mt-2.5 pl-[3.375rem]">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => void handleSendDirectInvite(slot.id)}
                                                        disabled={disabled || sendingSlotId === slot.id}
                                                        title="해당 팀원에게 사역 초대 알림을 발송합니다"
                                                    >
                                                        <Send className="text-muted-foreground" />
                                                        <span>
                                                            {sendingSlotId === slot.id
                                                                ? '발송 중…'
                                                                : slot.invitedAt
                                                                ? '초대 재발송'
                                                                : '초대 알림'}
                                                        </span>
                                                    </Button>
                                                </div>
                                            )}

                                            {/* 본인 슬롯: 1탭 빠른 응답 */}
                                            {isMe && !event.cancelled && (
                                                <div className="mt-3 space-y-2 pl-[3.375rem]">
                                                    <p className="text-[11px] font-medium text-muted-foreground">내 사역 참석 여부 응답</p>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {slot.attendance !== 'confirmed' && (
                                                            <Button
                                                                type="button"
                                                                size="xs"
                                                                onClick={() => void handleAttendanceResponse(slot.id, 'confirmed')}
                                                                disabled={disabled || respondingSlotId === slot.id}
                                                            >
                                                                <Check />
                                                                <span>{respondingSlotId === slot.id ? '처리 중…' : '사역 동의 / 참석 확정'}</span>
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="xs"
                                                            onClick={() => {
                                                                setShowDeclineInputSlotId(
                                                                    showDeclineInputSlotId === slot.id ? null : slot.id
                                                                );
                                                            }}
                                                            disabled={disabled || respondingSlotId === slot.id}
                                                        >
                                                            {showDeclineInputSlotId === slot.id ? '닫기' : '불참 사유 입력'}
                                                        </Button>
                                                    </div>

                                                    {showDeclineInputSlotId === slot.id && (
                                                        <div className="space-y-2.5 rounded-2xl bg-muted/60 p-3.5">
                                                            <input
                                                                type="text"
                                                                placeholder="불참 사유를 적어주세요 (예: 출장, 시험 등)"
                                                                value={declineReasonText}
                                                                onChange={(e) => setDeclineReasonText(e.target.value)}
                                                                className={control}
                                                            />
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button type="button" variant="ghost" size="xs" onClick={() => setShowDeclineInputSlotId(null)}>
                                                                    취소
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="xs"
                                                                    onClick={() =>
                                                                        void handleAttendanceResponse(
                                                                            slot.id,
                                                                            'absent',
                                                                            declineReasonText.trim() || '불참'
                                                                        )
                                                                    }
                                                                    disabled={disabled || respondingSlotId === slot.id}
                                                                >
                                                                    불참으로 변경 등록
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>

                {/* 하단 */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-6">
                    <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
                        동의 완료된 일정은 자동으로 팀원 및 인도자 캘린더에 연동됩니다.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>
                        닫기
                    </Button>
                </div>
            </div>
        </div>
    );
}
