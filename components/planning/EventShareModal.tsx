'use client';

import { useId, useMemo, useState } from 'react';
import { Calendar, Check, Copy, ExternalLink, Share2, X } from 'lucide-react';
import { planningDate, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type WorshipRole } from '@/types/team';
import { downloadIcsFile, getGoogleCalendarUrl } from '@/lib/calendarExport';

const button = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90`;

export default function EventShareModal({
    event,
    teamName = '예배팀',
    names,
    onClose,
}: {
    event: TeamSchedule;
    teamName?: string;
    names: Map<string, string>;
    onClose: () => void;
}) {
    const modalId = useId();
    const [includeSetlist, setIncludeSetlist] = useState(true);
    const [includeDetails, setIncludeDetails] = useState(true);
    const [highlightVacant, setHighlightVacant] = useState(true);
    const [includeGreeting, setIncludeGreeting] = useState(true);
    const [copied, setCopied] = useState(false);

    const shareText = useMemo(() => {
        const dateStr = planningDate(event.startsAt);
        const roleLines: string[] = [];
        const grouped = new Map<WorshipRole, string[]>();

        for (const slot of event.slots) {
            const list = grouped.get(slot.role) ?? [];
            if (slot.memberId) {
                const memberName = names.get(slot.memberId) ?? '팀원';
                const att = slot.attendance === 'confirmed' ? '(확정)' : slot.attendance === 'absent' ? '(불참)' : '(미정)';
                list.push(`${memberName}${att}`);
            } else {
                list.push(highlightVacant ? '🚨 미정(빈자리)' : '미정');
            }
            grouped.set(slot.role, list);
        }

        for (const [roleKey, personList] of grouped.entries()) {
            roleLines.push(`• ${worshipRoles[roleKey]}: ${personList.join(', ')}`);
        }

        const lines: string[] = [`[${teamName} · ${event.title} 섬김 안내]`];
        lines.push(`일시: ${dateStr}`);
        if (includeDetails && event.location) {
            lines.push(`장소: ${event.location}`);
        }
        if (includeSetlist && event.setlistTitle) {
            const songList = event.setlistSongs?.length ? ` (${event.setlistSongs.join(', ')})` : '';
            lines.push(`콘티: ${event.setlistTitle}${songList}`);
        }
        if (includeDetails && event.notes) {
            lines.push(`메모: ${event.notes}`);
        }

        lines.push('\n<섬김 명단>');
        if (roleLines.length > 0) {
            lines.push(...roleLines);
        } else {
            lines.push('• 아직 등록된 역할이 없습니다.');
        }

        if (includeGreeting) {
            lines.push('\n※ 변동 사항이나 참석이 어려우신 분은 미리 말씀해 주세요.');
            lines.push('은혜로운 예배를 함께 준비해요! 축복합니다 🙏');
        }

        return lines.join('\n');
    }, [event, teamName, names, includeSetlist, includeDetails, highlightVacant, includeGreeting]);

    async function handleCopy() {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareText);
            } else {
                window.prompt('아래 텍스트를 복사하세요:', shareText);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            window.prompt('아래 텍스트를 복사하세요:', shareText);
        }
    }

    async function handleNativeShare() {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: `[${teamName}] ${event.title}`,
                    text: shareText,
                });
                return;
            } catch {
                // Ignore cancel or error; fallback to copy
            }
        }
        await handleCopy();
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalId}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                {/* 모바일 바텀시트 핸들 바 */}
                <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden shrink-0" />

                <div className="flex items-center justify-between border-b border-border/60 p-4 sm:p-5 bg-muted/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <Share2 className="text-primary" size={20} />
                        <h3 id={modalId} className="text-base sm:text-lg font-bold text-foreground">
                            일정 & 섬김 명단 공유
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

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

                {/* 옵션 선택 체크박스 */}
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-foreground bg-muted/40 p-3 rounded-2xl border border-border/60">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeSetlist}
                            onChange={(e) => setIncludeSetlist(e.target.checked)}
                            className="rounded"
                        />
                        <span>콘티 및 곡 목록 포함</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeDetails}
                            onChange={(e) => setIncludeDetails(e.target.checked)}
                            className="rounded"
                        />
                        <span>장소 및 안내 메모 포함</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={highlightVacant}
                            onChange={(e) => setHighlightVacant(e.target.checked)}
                            className="rounded"
                        />
                        <span>🚨 빈자리(미정) 강조</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeGreeting}
                            onChange={(e) => setIncludeGreeting(e.target.checked)}
                            className="rounded"
                        />
                        <span>안내 및 축복 멘트 포함</span>
                    </label>
                </div>

                {/* 텍스트 실시간 미리보기 */}
                <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">공유 텍스트 미리보기</span>
                    <pre className="rounded-2xl border border-border bg-background p-3 text-xs text-foreground font-mono whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed select-all">
                        {shareText}
                    </pre>
                </div>

                {/* 캘린더 연동 영역 */}
                <div className="rounded-2xl border border-border/80 bg-background/50 p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                        <Calendar size={16} className="text-secondary" />
                        <div>
                            <p className="font-bold text-foreground">내 캘린더에 일정 등록</p>
                            <p className="text-[11px] text-muted-foreground">스마트폰 캘린더나 구글 캘린더에 추가하세요</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => downloadIcsFile(event, teamName, names)}
                            className={`${button} text-xs py-1.5 h-8`}
                            title="아이폰/맥 캘린더, 아웃룩용 .ics 파일 다운로드"
                        >
                            <span>.ics 다운로드</span>
                        </button>
                        <a
                            href={getGoogleCalendarUrl(event, teamName, names)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${button} text-xs py-1.5 h-8 text-primary`}
                        >
                            <span>구글 캘린더</span>
                            <ExternalLink size={12} />
                        </a>
                    </div>
                </div>

                {/* 모달 하단 버튼 */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
                    <button type="button" onClick={onClose} className={`${button} text-xs py-2`}>
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`${button} text-xs py-2 font-bold`}
                    >
                        {copied ? (
                            <>
                                <Check size={14} className="text-emerald-600" />
                                <span className="text-emerald-600">복사 완료!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                <span>클립보드 복사</span>
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleNativeShare}
                        className={`${primary} text-xs py-2 font-bold`}
                    >
                        <Share2 size={14} />
                        <span>카톡 · 공유하기</span>
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
}
