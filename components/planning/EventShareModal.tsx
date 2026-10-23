'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarPlus, Check, Copy, Download, ExternalLink, Share2, X } from 'lucide-react';
import { planningDate, type TeamSchedule } from '@/types/planning';
import { worshipRoles, type WorshipRole } from '@/types/team';
import { downloadIcsFile, getGoogleCalendarUrl } from '@/lib/calendarExport';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';

const checkbox = 'size-4 shrink-0 rounded accent-foreground';

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
    const dialogRef = useSheetDismiss(onClose);

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

    const options: [boolean, (value: boolean) => void, string][] = [
        [includeSetlist, setIncludeSetlist, '콘티 및 곡 목록 포함'],
        [includeDetails, setIncludeDetails, '장소 및 안내 메모 포함'],
        [highlightVacant, setHighlightVacant, '빈자리(미정) 강조'],
        [includeGreeting, setIncludeGreeting, '안내 및 축복 멘트 포함'],
    ];

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
                        <p className="text-[11px] font-medium text-muted-foreground">{event.title}</p>
                        <h3 id={modalId} className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                            일정 & 섬김 명단 공유
                        </h3>
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

                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                    {/* 포함할 내용 */}
                    <fieldset className="space-y-1">
                        <legend className="text-[11px] font-medium text-muted-foreground">포함할 내용</legend>
                        <div className="grid gap-x-4 sm:grid-cols-2">
                            {options.map(([checked, set, label]) => (
                                <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-border/70 text-sm text-foreground">
                                    <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className={checkbox} />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* 미리보기 */}
                    <div className="space-y-2">
                        <span className="block text-[11px] font-medium text-muted-foreground">공유 텍스트 미리보기</span>
                        <pre className="max-h-52 select-all overflow-y-auto whitespace-pre-wrap rounded-2xl bg-muted/60 px-4 py-3.5 font-sans text-[13px] leading-6 text-foreground">
                            {shareText}
                        </pre>
                    </div>

                    {/* 캘린더 등록 */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">내 캘린더에 일정 등록</p>
                            <p className="text-xs text-muted-foreground">스마트폰 캘린더나 구글 캘린더에 추가하세요</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => downloadIcsFile(event, teamName, names)}
                                title="아이폰/맥 캘린더, 아웃룩용 .ics 파일 다운로드"
                            >
                                <Download className="text-muted-foreground" />
                                <span>.ics 다운로드</span>
                            </Button>
                            <a
                                href={getGoogleCalendarUrl(event, teamName, names)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(buttonVariants({ variant: 'outline', size: 'xs' }))}
                            >
                                <CalendarPlus className="text-muted-foreground" />
                                <span>구글 캘린더</span>
                                <ExternalLink className="text-muted-foreground" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} className="mr-auto">
                        닫기
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                            <>
                                <Check className="text-brand" />
                                <span className="text-brand">복사 완료!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="text-muted-foreground" />
                                <span>클립보드 복사</span>
                            </>
                        )}
                    </Button>
                    <Button type="button" size="sm" onClick={handleNativeShare}>
                        <Share2 />
                        <span>카톡 · 공유하기</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
