'use client';

import { useId, useMemo, useState } from 'react';
import {
    Check,
    CheckCircle2,
    ClipboardCopy,
    Clock,
    Send,
    UserX,
    X,
    XCircle,
    Calendar,
    MapPin,
    Music,
    AlertCircle,
    Sparkles,
} from 'lucide-react';
import { planningDate, type PlanningCommand, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type TeamMember } from '@/types/team';

const button = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98] shadow-2xs focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-xs font-bold`;

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
            <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                {/* 모바일 바텀시트 핸들 바 */}
                <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden shrink-0" />

                {/* 모달 헤더 */}
                <div className="flex items-start justify-between border-b border-border p-4 sm:p-5 bg-muted/20">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold">
                                {event.kind === 'rehearsal' ? '연습' : '예배'}
                            </span>
                            {event.cancelled && (
                                <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-bold">
                                    취소됨
                                </span>
                            )}
                            <h2 id={`${modalId}-title`} className="text-lg font-bold text-foreground">
                                {event.title} 동의 내역
                            </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar size={13} className="text-primary" />
                                {planningDate(event.startsAt)}
                            </span>
                            {event.location && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={13} className="text-muted-foreground" />
                                    {event.location}
                                </span>
                            )}
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

                {/* 모달 본문 */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* 상단 통계 카드 & 프로그레스 바 */}
                    <div className="rounded-2xl border border-border/80 bg-background p-4 sm:p-5 space-y-3.5 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">전체 사역 동의율</span>
                                <span className="text-xl font-extrabold text-primary">
                                    {consentRate}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    ({confirmedSlots.length}/{assignedSlots.length}명 확정)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleCopyKakaoRsvp()}
                                className={`${button} text-xs py-1 px-2.5 min-h-8 text-primary font-bold border-primary/30 flex items-center gap-1.5`}
                                title="카카오톡 단톡방 공유용 동의 현황 텍스트 복사"
                            >
                                {copiedKakao ? (
                                    <>
                                        <Check size={13} className="text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">복사 완료!</span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCopy size={13} />
                                        <span>단톡 공유용 복사</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 진행 바 */}
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                            {confirmedSlots.length > 0 && (
                                <div
                                    style={{ width: `${(confirmedSlots.length / totalSlots) * 100}%` }}
                                    className="bg-emerald-500 transition-all duration-300"
                                    title={`동의 완료: ${confirmedSlots.length}명`}
                                />
                            )}
                            {pendingSlots.length > 0 && (
                                <div
                                    style={{ width: `${(pendingSlots.length / totalSlots) * 100}%` }}
                                    className="bg-amber-400 transition-all duration-300"
                                    title={`응답 대기: ${pendingSlots.length}명`}
                                />
                            )}
                            {absentSlots.length > 0 && (
                                <div
                                    style={{ width: `${(absentSlots.length / totalSlots) * 100}%` }}
                                    className="bg-rose-500 transition-all duration-300"
                                    title={`불참: ${absentSlots.length}명`}
                                />
                            )}
                        </div>

                        {/* 현황 칩 그리드 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-muted-foreground font-medium">동의 완료</p>
                                    <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                        {confirmedSlots.length}명
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-center gap-2">
                                <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-muted-foreground font-medium">응답 대기</p>
                                    <p className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                                        {pendingSlots.length}명
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 flex items-center gap-2">
                                <XCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-muted-foreground font-medium">불참 / 사유</p>
                                    <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                                        {absentSlots.length}명
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-muted/30 p-2.5 flex items-center gap-2">
                                <UserX size={16} className="text-muted-foreground shrink-0" />
                                <div>
                                    <p className="text-[11px] text-muted-foreground font-medium">미배정</p>
                                    <p className="font-bold text-foreground text-sm">
                                        {unassignedSlots.length}자리
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 콘티 정보 배너 (등록되어 있을 때) */}
                    {event.setlistTitle && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-xs">
                            <Music size={15} className="text-primary shrink-0" />
                            <span className="font-bold text-foreground">{event.setlistTitle}</span>
                            {event.setlistSongs?.length ? (
                                <span className="text-muted-foreground">
                                    ({event.setlistSongs.length}곡: {event.setlistSongs.join(', ')})
                                </span>
                            ) : null}
                        </div>
                    )}

                    {/* 관리자 초대 일괄 발송 바 */}
                    {manager && !event.cancelled && pendingSlots.length > 0 && (
                        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                    <Sparkles size={14} />
                                    <span>미응답자 일괄 초대 알림 ({pendingSlots.length}명)</span>
                                </h3>
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="전달할 초대 메모 (선택: 예: 10시까지 본당 도착 부탁드립니다)"
                                    value={customNote}
                                    onChange={(e) => setCustomNote(e.target.value)}
                                    className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleSendBatchInvites()}
                                    disabled={disabled || batchSending}
                                    className={`${primary} w-full text-xs py-2`}
                                >
                                    <Send size={13} />
                                    <span>
                                        {batchSending ? '발송 중…' : `응답 대기 중인 ${pendingSlots.length}명 모두에게 초대 알림 발송`}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 슬롯별 동의 상세 명단 */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-foreground flex items-center justify-between">
                            <span>파트별 동의 현황 및 이력 ({event.slots.length}명)</span>
                        </h3>

                        {event.slots.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                등록된 역할이 없습니다.
                            </div>
                        ) : (
                            <ul className="space-y-2.5">
                                {event.slots.map((slot) => {
                                    const member = slot.memberId ? memberMap.get(slot.memberId) : null;
                                    const isMe = slot.memberId === userId;
                                    const isPending = slot.attendance === 'pending';
                                    const isConfirmed = slot.attendance === 'confirmed';
                                    const isAbsent = slot.attendance === 'absent';
                                    const hasMember = Boolean(slot.memberId);

                                    return (
                                        <li
                                            key={slot.id}
                                            className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 transition-colors ${
                                                isMe
                                                    ? 'border-primary/40 bg-primary/5'
                                                    : 'border-border/80 bg-background'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-lg bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
                                                        {worshipRoles[slot.role]}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-sm text-foreground">
                                                            {hasMember ? member?.name ?? '이전 팀원' : '미배정 (빈자리)'}
                                                        </span>
                                                        {isMe && (
                                                            <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.2 text-[10px] font-extrabold">
                                                                나
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* 상태 뱃지 */}
                                                    {isConfirmed && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                            <CheckCircle2 size={13} />
                                                            <span>동의 완료</span>
                                                        </span>
                                                    )}
                                                    {isPending && hasMember && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                                                            <Clock size={13} />
                                                            <span>응답 대기</span>
                                                        </span>
                                                    )}
                                                    {isAbsent && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                                                            <XCircle size={13} />
                                                            <span>불참</span>
                                                        </span>
                                                    )}
                                                    {!hasMember && (
                                                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                                            미배정
                                                        </span>
                                                    )}

                                                    {/* 관리자: 개별 초대 발송/재발송 버튼 */}
                                                    {manager && !event.cancelled && hasMember && isPending && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSendDirectInvite(slot.id)}
                                                            disabled={disabled || sendingSlotId === slot.id}
                                                            className={`${button} text-[11px] py-1 px-2.5 min-h-7 border-border hover:border-primary/40 text-primary font-bold`}
                                                            title="해당 팀원에게 사역 초대 알림을 발송합니다"
                                                        >
                                                            <Send size={11} />
                                                            <span>
                                                                {sendingSlotId === slot.id
                                                                    ? '발송 중…'
                                                                    : slot.invitedAt
                                                                    ? '초대 재발송'
                                                                    : '초대 알림'}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 동의/초대 상세 타임스탬프 & 불참 사유 */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5 border-t border-border/40">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {slot.invitedAt ? (
                                                        <span className="flex items-center gap-1">
                                                            <Send size={11} className="text-primary/70" />
                                                            <span>초대 발송: {formatShortDateTime(slot.invitedAt)}</span>
                                                        </span>
                                                    ) : hasMember && isPending ? (
                                                        <span className="text-muted-foreground/70">초대 미발송</span>
                                                    ) : null}

                                                    {slot.respondedAt && (
                                                        <span className="flex items-center gap-1 font-medium text-foreground">
                                                            <Check size={11} className={isConfirmed ? 'text-emerald-600' : 'text-rose-500'} />
                                                            <span>
                                                                {isConfirmed ? '수락' : '응답'}: {formatShortDateTime(slot.respondedAt)}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 불참 사유 */}
                                                {isAbsent && slot.declineReason && (
                                                    <div className="w-full rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-1.5">
                                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold">불참 사유: </span>
                                                            <span>{slot.declineReason}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 본인 슬롯인 경우 1탭 빠른 응답 액션 */}
                                            {isMe && !event.cancelled && (
                                                <div className="rounded-xl border border-primary/20 bg-card p-3 space-y-2 mt-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                                                            <Sparkles size={13} /> 내 사역 참석 여부 응답
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {slot.attendance !== 'confirmed' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleAttendanceResponse(slot.id, 'confirmed')}
                                                                    disabled={disabled || respondingSlotId === slot.id}
                                                                    className={`${primary} text-xs py-1 px-3 min-h-8`}
                                                                >
                                                                    <Check size={13} />
                                                                    <span>{respondingSlotId === slot.id ? '처리 중…' : '사역 동의 / 참석 확정'}</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowDeclineInputSlotId(
                                                                        showDeclineInputSlotId === slot.id ? null : slot.id
                                                                    );
                                                                }}
                                                                disabled={disabled || respondingSlotId === slot.id}
                                                                className={`${button} text-xs py-1 px-2.5 min-h-8 text-destructive`}
                                                            >
                                                                {showDeclineInputSlotId === slot.id ? '닫기' : '불참 사유 입력'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {showDeclineInputSlotId === slot.id && (
                                                        <div className="space-y-2 pt-1 border-t border-border/60">
                                                            <input
                                                                type="text"
                                                                placeholder="불참 사유를 적어주세요 (예: 출장, 시험 등)"
                                                                value={declineReasonText}
                                                                onChange={(e) => setDeclineReasonText(e.target.value)}
                                                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-hidden focus:ring-2 focus:ring-destructive"
                                                            />
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowDeclineInputSlotId(null)}
                                                                    className={`${button} text-xs py-1 px-2.5 min-h-7`}
                                                                >
                                                                    취소
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void handleAttendanceResponse(
                                                                            slot.id,
                                                                            'absent',
                                                                            declineReasonText.trim() || '불참'
                                                                        )
                                                                    }
                                                                    disabled={disabled || respondingSlotId === slot.id}
                                                                    className={`${button} text-xs py-1 px-3 min-h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-transparent font-bold`}
                                                                >
                                                                    불참으로 변경 등록
                                                                </button>
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
                    </div>
                </div>

                {/* 모달 하단 푸터 */}
                <div className="border-t border-border p-4 sm:p-5 bg-muted/20 flex flex-wrap items-center justify-between gap-2.5">
                    <p className="text-xs text-muted-foreground">
                        동의 완료된 일정은 자동으로 팀원 및 인도자 캘린더에 연동됩니다.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`${button} text-xs py-2 px-5 font-bold`}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
