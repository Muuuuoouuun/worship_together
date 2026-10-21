'use client';

import { cloneElement, isValidElement, memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { canManagePlanning, planningDate, scheduleTemplates, type PlanningCommand, type PlanningPanelProps, type ScheduleSlot, type ScheduleTemplateKey, type TeamSchedule, type UrgentAlert } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';
import { Bell, CalendarDays, CalendarPlus, CalendarX2, Check, ChevronDown, ClipboardCopy, Copy, Download, ExternalLink, List, MessageSquare, Music, Plus, RotateCcw, Search, Send, Share2, Sparkles, Table, Users, X } from 'lucide-react';
import { downloadIcsFile, getMyGoogleCalendarUrl, generateMyScheduleShareText } from '@/lib/calendarExport';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { STATUS, type StatusTone } from '@/components/ui/status';
import { Avatar, TONE_BLOCK } from '@/components/conti/ui';
import { ROLE_ICON } from '@/components/conti/planningUi';

const viewLoading = () => <p className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</p>;
const CalendarView = dynamic(() => import('./CalendarView'), { loading: viewLoading });
const MatrixView = dynamic(() => import('./MatrixView'), { loading: viewLoading });
const EventShareModal = dynamic(() => import('./EventShareModal'), { ssr: false });
const MonthlySundaysModal = dynamic(() => import('./MonthlySundaysModal'), { ssr: false });
const BlockedDatesModal = dynamic(() => import('./BlockedDatesModal'), { ssr: false });
const ScheduleRsvpModal = dynamic(() => import('./ScheduleRsvpModal'), { ssr: false });

/** 입력칸: 모바일 16px (iOS 확대 방지), 데스크톱 14px. 포커스는 진한 테두리 + 옅은 링. */
const control = 'h-11 w-full min-w-0 rounded-2xl border border-border bg-card px-3.5 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 disabled:opacity-50 sm:text-sm';
const area = cn(control, 'h-auto min-h-24 py-2.5 leading-6');
const eyebrow = 'text-[11px] font-medium text-muted-foreground';
const subTitle = 'text-[13px] font-semibold text-foreground';
const summaryBase = 'flex cursor-pointer list-none items-center gap-2 select-none rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/15 [&::-webkit-details-marker]:hidden';
// cn 으로 한 번 더 합쳐야 xs 아이콘 크기(size-3)가 기본 크기(size-4)를 덮어씁니다.
const outlineXs = cn(buttonVariants({ variant: 'outline', size: 'xs' }));
const checkbox = 'size-4 shrink-0 rounded accent-foreground';
const iconTile = 'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground';
const attendanceLabels = { pending: '응답 대기', confirmed: '참석 확정', absent: '불참' };
const alertLabels = { absence: '불참 알림', substitute: '대체 인원 요청', notice: '긴급 공지' };
const ABSENCE_REASONS = ['개인 사정', '시험/학업', '출장/야근', '가족 행사', '건강/컨디션'];
const NO_ALERTS: UrgentAlert[] = [];
type Send = PlanningPanelProps['onCommand'];
type Actions = { send: Send; disabled: boolean };

/** 날짜까지 남은 시간. 배경 없는 글자색만 돌려줍니다 (오늘 = 강조색, 진행 중 = 주황). */
function getRelativeDateLabel(iso: string, nowMs: number) {
    const targetMs = Date.parse(iso);
    const diffHours = (targetMs - nowMs) / (1000 * 60 * 60);
    const diffDays = Math.round((targetMs - nowMs) / (1000 * 60 * 60 * 24));
    if (diffHours < -24) return { text: '종료', cls: 'text-muted-foreground/70' };
    if (diffHours >= -24 && diffHours < 0) return { text: '진행 중', cls: 'font-semibold text-secondary' };
    if (diffHours >= 0 && diffHours <= 18) return { text: '오늘', cls: 'font-semibold text-brand' };
    if (diffDays === 1) return { text: '내일', cls: 'font-semibold text-foreground' };
    return { text: `D-${diffDays}`, cls: 'tabular-nums text-muted-foreground' };
}

function shortDateTime(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function slotTone(slot: ScheduleSlot): StatusTone {
    if (!slot.memberId) return 'idle';
    return slot.attendance === 'confirmed' ? 'ok' : slot.attendance === 'absent' ? 'danger' : 'warn';
}

function generateKakaoShareText(event: TeamSchedule, names: Map<string, string>): string {
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
            list.push('미정(빈자리)');
        }
        grouped.set(slot.role, list);
    }
    for (const [roleKey, personList] of grouped.entries()) {
        roleLines.push(`• ${worshipRoles[roleKey]}: ${personList.join(', ')}`);
    }

    const setlistPart = event.setlistTitle
        ? `콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.join(', ')})` : ''}\n`
        : '';

    return `[${event.title} 섬김이 안내]
일시: ${dateStr}
장소: ${event.location || '미정'}
${setlistPart}${event.notes ? `메모: ${event.notes}\n` : ''}
<섬김 명단>
${roleLines.length ? roleLines.join('\n') : '• 아직 배정된 인원이 없습니다.'}`;
}

function getUpcomingDayKST(targetDay: number, startHour: number, startMinute: number, durationMinutes: number): { startsAt: string; endsAt: string } {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstNow = new Date(utc + (9 * 3600000));
    const day = kstNow.getDay();
    let daysUntil = (targetDay - day + 7) % 7;
    if (daysUntil === 0 && (kstNow.getHours() > startHour || (kstNow.getHours() === startHour && kstNow.getMinutes() >= startMinute))) {
        daysUntil = 7;
    }
    const targetDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + daysUntil, startHour, startMinute, 0);
    const endDate = new Date(targetDate.getTime() + durationMinutes * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toKstIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
    return { startsAt: toKstIso(targetDate), endsAt: toKstIso(endDate) };
}

function getUpcomingSundayKST(): { startsAt: string; endsAt: string } {
    return getUpcomingDayKST(0, 11, 0, 90);
}

function getUpcomingSaturdayKST(): { startsAt: string; endsAt: string } {
    return getUpcomingDayKST(6, 17, 0, 120);
}

function getUpcomingFridayKST(): { startsAt: string; endsAt: string } {
    return getUpcomingDayKST(5, 20, 0, 90);
}

function getUpcomingWednesdayKST(): { startsAt: string; endsAt: string } {
    return getUpcomingDayKST(3, 19, 30, 90);
}

function generateMonthlyKakaoShareText(events: TeamSchedule[], names: Map<string, string>): string {
    const upcoming = events.filter(e => !e.cancelled).slice(0, 8);
    if (!upcoming.length) return '등록된 다가오는 일정이 없습니다.';
    
    const lines: string[] = ['[⛪ 이번 달 찬양팀 섬김 명단 안내]\n'];
    for (const event of upcoming) {
        const dateStr = planningDate(event.startsAt);
        lines.push(`■ ${event.title} (${dateStr})`);
        if (event.setlistTitle) {
            lines.push(`• 콘티: ${event.setlistTitle}${event.setlistSongs?.length ? ` (${event.setlistSongs.length}곡)` : ''}`);
        }
        if (event.slots.length === 0) {
            lines.push('• 등록된 역할이 없습니다.');
        } else {
            const grouped = new Map<WorshipRole, string[]>();
            for (const slot of event.slots) {
                const list = grouped.get(slot.role) ?? [];
                if (slot.memberId) {
                    const name = names.get(slot.memberId) ?? '팀원';
                    list.push(slot.attendance === 'confirmed' ? `${name}(확정)` : `${name}(미정)`);
                } else {
                    list.push('미정(빈자리)');
                }
                grouped.set(slot.role, list);
            }
            for (const [r, pList] of grouped.entries()) {
                lines.push(`• ${worshipRoles[r]}: ${pList.join(', ')}`);
            }
        }
        lines.push('');
    }
    lines.push('※ 변경이나 참석이 어려우신 분은 미리 말씀해 주세요! 모두 축복합니다 🙏');
    return lines.join('\n');
}

function generatePersonalReminderText(event: TeamSchedule, slot: ScheduleSlot, memberName: string): string {
    const dateStr = planningDate(event.startsAt);
    return `${memberName}님, ${dateStr} [${event.title}]에서 [${worshipRoles[slot.role]}] 섬김으로 배정되어 있습니다! 참석 가능하신지 확인 부탁드려요 🙏`;
}

function kstInput(iso: string) {
    const milliseconds = Date.parse(iso);
    return Number.isFinite(milliseconds) ? new Date(milliseconds + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
}

function text(data: FormData, name: string) {
    return String(data.get(name) ?? '').trim();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    const fieldId = useId();
    return <div className="grid min-w-0 gap-1.5"><label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id: fieldId }) : children}</div>;
}

/**
 * 펼치기/접기. 처음 펼칠 때 내용을 만들고, 그 뒤로는 닫아도 입력 중인 내용을 유지합니다.
 * defaultOpen 이 바뀌면 (필터 변경 등) 그 값으로 다시 맞춥니다.
 */
function Disclosure({ summary, children, defaultOpen = false, className, summaryClassName, chevron = 'end' }: {
    summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; summaryClassName?: string; chevron?: 'end' | 'inline' | 'none';
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [mounted, setMounted] = useState(defaultOpen);
    const [lastDefault, setLastDefault] = useState(defaultOpen);
    if (lastDefault !== defaultOpen) {
        setLastDefault(defaultOpen);
        setOpen(defaultOpen);
        if (defaultOpen) setMounted(true);
    }
    return <details open={open} onToggle={event => {
        const next = event.currentTarget.open;
        setOpen(next);
        if (next) setMounted(true);
    }} className={className}>
        <summary className={cn(summaryBase, summaryClassName)}>
            {summary}
            {chevron !== 'none' ? <ChevronDown size={15} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform', chevron === 'end' && 'ml-auto', open && 'rotate-180')} /> : null}
        </summary>
        {mounted ? children : null}
    </details>;
}

function CommandForm({ children, build, send, disabled, submitLabel, reset = true }: Actions & {
    children: ReactNode; build: (data: FormData) => PlanningCommand; submitLabel: string; reset?: boolean;
}) {
    const [error, setError] = useState('');
    return <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (disabled) return;
        const form = event.currentTarget;
        setError('');
        try {
            const command = build(new FormData(form));
            if (await send(command)) {
                if (reset) form.reset();
            } else {
                setError('처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.');
            }
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : '처리하지 못했습니다. 다시 시도해 주세요.');
        }
    }}>
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
            {children}
            <Button size="sm" type="submit">{submitLabel}</Button>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>;
}

function EventForm({ event, defaultDate, ...actions }: Actions & { event?: TeamSchedule; defaultDate?: string }) {
    const [weeks, setWeeks] = useState(1);
    const defaultStart = event ? kstInput(event.startsAt) : defaultDate ? `${defaultDate}T11:00` : '';
    const defaultEnd = event ? kstInput(event.endsAt) : defaultDate ? `${defaultDate}T12:30` : '';
    return <CommandForm {...actions} reset={!event} submitLabel={event ? '일정 변경 저장' : weeks > 1 ? `${weeks}주 정기 일정 등록` : '일정 만들기'} build={data => {
        // datetime-local carries no zone: always interpret the entered wall time as KST.
        const startsAt = `${text(data, 'startsAt')}:00+09:00`;
        const endsAt = `${text(data, 'endsAt')}:00+09:00`;
        if (!text(data, 'title')) throw new Error('일정 제목을 입력해 주세요.');
        if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) {
            throw new Error('종료 시간을 시작 시간보다 늦게 입력해 주세요.');
        }
        const input = {
            title: text(data, 'title'), kind: text(data, 'kind') as TeamSchedule['kind'], startsAt, endsAt,
            location: text(data, 'location'), notes: text(data, 'notes'),
        };
        if (!event && weeks > 1) {
            return { type: 'event.createRecurring', input, weeksCount: weeks };
        }
        return { type: 'event.save', eventId: event?.id, input };
    }}>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Field label="일정 종류"><select name="kind" defaultValue={event?.kind ?? 'rehearsal'} className={control}>
                <option value="rehearsal">연습</option><option value="worship">예배</option>
            </select></Field>
            <Field label="제목 (필수)"><input name="title" required defaultValue={event?.title ?? ''} className={control} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
            {/* key: 달력에서 다른 날을 고르면 날짜 칸만 새 날짜로 다시 채우고, 제목·장소 등 입력 중인 내용은 그대로 둡니다. */}
            <Field label="시작 (필수)"><input key={defaultStart} type="datetime-local" step="60" name="startsAt" required defaultValue={defaultStart} className={control} /></Field>
            <Field label="종료 (필수)"><input key={defaultEnd} type="datetime-local" step="60" name="endsAt" required defaultValue={defaultEnd} className={control} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">모든 시간은 한국 시간(KST, UTC+09:00)입니다.</p>
        {!event ? (
            <Field label="정기 반복 생성 (선택)">
                <select className={control} value={weeks} onChange={e => setWeeks(Number(e.target.value))}>
                    <option value={1}>1회 (단일 일정)</option>
                    <option value={2}>2주 연속 (매주 같은 요일/시간)</option>
                    <option value={4}>4주 연속 (1개월 정기 일정)</option>
                    <option value={8}>8주 연속 (2개월 정기 일정)</option>
                    <option value={12}>12주 연속 (3개월 정기 일정)</option>
                </select>
            </Field>
        ) : null}
        <Field label="장소"><input name="location" defaultValue={event?.location ?? ''} className={control} /></Field>
        <Field label="안내 사항"><textarea name="notes" rows={3} defaultValue={event?.notes ?? ''} className={area} /></Field>
    </CommandForm>;
}

function TemplateForm({ eventId, ...actions }: Actions & { eventId: string }) {
    const [selectedKey, setSelectedKey] = useState<ScheduleTemplateKey>('standard');
    return <CommandForm {...actions} submitLabel="템플릿 역할 추가" build={() => ({ type: 'slots.applyTemplate', eventId, templateKey: selectedKey })}>
        <Field label="역할 템플릿 선택">
            <select className={control} value={selectedKey} onChange={e => setSelectedKey(e.target.value as ScheduleTemplateKey)}>
                {Object.entries(scheduleTemplates).map(([key, t]) => (
                    <option key={key} value={key}>{t.name} ({t.roles.map(r => worshipRoles[r]).join(', ')})</option>
                ))}
            </select>
        </Field>
    </CommandForm>;
}

function CopyRosterForm({ eventId, otherEvents, ...actions }: Actions & { eventId: string; otherEvents: TeamSchedule[] }) {
    const validOthers = otherEvents.filter(e => e.id !== eventId && !e.cancelled && e.slots.length > 0);
    const [sourceId, setSourceId] = useState(validOthers[0]?.id ?? '');
    const selectedSourceId = validOthers.some(event => event.id === sourceId) ? sourceId : validOthers[0]?.id ?? '';
    if (validOthers.length === 0) return <p className="text-sm text-muted-foreground">배정을 복사해올 수 있는 이전 일정이 없습니다.</p>;
    return <CommandForm {...actions} submitLabel="이전 배정 복사해오기" build={() => {
        if (!selectedSourceId) throw new Error('복사할 원본 일정을 선택해 주세요.');
        return { type: 'slots.copyFromEvent', targetEventId: eventId, sourceEventId: selectedSourceId };
    }}>
        <Field label="복사해올 원본 일정">
            <select className={control} value={selectedSourceId} onChange={e => setSourceId(e.target.value)}>
                {validOthers.map(e => (
                    <option key={e.id} value={e.id}>{e.title} · {planningDate(e.startsAt)} ({e.slots.length}명 구성)</option>
                ))}
            </select>
        </Field>
    </CommandForm>;
}

function SlotForm({ eventId, slot, members, ...actions }: Actions & { eventId: string; slot?: ScheduleSlot; members: TeamMember[] }) {
    return <CommandForm {...actions} reset={!slot} submitLabel={slot ? '배정 변경 저장' : '역할 추가'} build={data => ({
        type: 'slot.save', eventId, slotId: slot?.id, role: text(data, 'role') as WorshipRole, memberId: text(data, 'memberId') || null,
    })}>
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label="역할"><select name="role" defaultValue={slot?.role ?? 'vocal'} className={control}>
                {Object.entries(worshipRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></Field>
            <Field label="담당자"><select name="memberId" defaultValue={slot?.memberId ?? ''} className={control}>
                <option value="">미배정 (빈자리)</option>
                {slot?.memberId && !members.some(member => member.userId === slot.memberId) ? <option value={slot.memberId}>이전 팀원 (배정 변경 필요)</option> : null}
                {members.map(member => <option key={member.userId} value={member.userId}>{member.name} · {worshipRoles[member.role]}</option>)}
            </select></Field>
        </div>
    </CommandForm>;
}

function AlertForm({ eventId, slotId, ...actions }: Actions & { eventId: string; slotId: string | null }) {
    return <CommandForm {...actions} submitLabel={slotId ? '대체 인원 요청 등록' : '긴급 공지 등록'} build={data => {
        const body = text(data, 'body');
        if (!body) throw new Error('알림 내용을 입력해 주세요.');
        return { type: 'alert.create', eventId, slotId, kind: slotId ? 'substitute' : 'notice', body };
    }}>
        <Field label={slotId ? '빈자리 또는 대체 요청 내용 (필수)' : '일정 전체 공지 내용 (필수)'}>
            <textarea name="body" required rows={3} className={area} />
        </Field>
    </CommandForm>;
}

function DutyNoticeForm({ event, members, ...actions }: Actions & { event: TeamSchedule; members: TeamMember[] }) {
    const dutyMemberIds = useMemo(() => event.slots.map(s => s.memberId).filter((mid): mid is string => Boolean(mid)), [event.slots]);
    const dutyMembers = useMemo(() => members.filter(m => dutyMemberIds.includes(m.userId)), [members, dutyMemberIds]);
    const [targetAudience, setTargetAudience] = useState<'duty' | 'all'>(dutyMemberIds.length > 0 ? 'duty' : 'all');
    const [body, setBody] = useState('');
    const [urgent, setUrgent] = useState(false);

    const presets = [
        { label: '콘티 확인 요청', text: '이번 주 콘티가 등록되었습니다! 곡 순서와 송폼을 미리 확인해 주세요 🙏' },
        { label: '콘티 변경 안내', text: '이번 주 콘티 및 진행 순서에 변경 사항이 있습니다. 확인 부탁드립니다!' },
        { label: '리허설 시간 안내', text: '예배 시작 30분 전까지 본당으로 모여 리허설을 진행합니다. 시간 엄수 부탁드려요!' },
        { label: '함께 기도로 준비', text: '이번 주 예배를 위해 각자의 자리에서 기도로 함께 준비해요.' },
    ];
    const audience = (value: 'duty' | 'all', label: string) => (
        <label className={cn(
            'flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/15',
            targetAudience === value ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
        )}>
            <input
                type="radio"
                name={`targetAudience-${event.id}`}
                checked={targetAudience === value}
                onChange={() => setTargetAudience(value)}
                className="accent-foreground"
            />
            <span>{label}</span>
        </label>
    );

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = body.trim();
            if (!trimmed) return;
            const success = await actions.send({
                type: 'alert.create',
                eventId: event.id,
                slotId: null,
                kind: 'notice',
                body: urgent ? `[긴급] ${trimmed}` : trimmed,
                targetAudience,
            });
            if (success) setBody('');
        }} className="space-y-5">
            <div className="space-y-2">
                <span className={cn(eyebrow, 'block')}>수신 대상 선택</span>
                <div className="flex flex-wrap gap-2">
                    {audience('duty', `해당 주 섬김이/당번 (${dutyMembers.length}명)`)}
                    {audience('all', `찬양팀 전체 (${members.length}명)`)}
                </div>
                {targetAudience === 'duty' && (
                    <div className="pt-1 text-xs text-muted-foreground">
                        {dutyMembers.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span>수신 대상자:</span>
                                {dutyMembers.map(m => (
                                    <span key={m.userId} className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                        {m.name} ({worshipRoles[m.role]})
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className={cn('font-medium', STATUS.warn.text)}>※ 아직 배정된 섬김이가 없습니다. 발송 시 전체 팀원에게 안내됩니다.</span>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <span className={cn(eyebrow, 'block')}>1초 퀵 멘트 선택</span>
                <div className="flex flex-wrap gap-1.5">
                    {presets.map((preset) => (
                        <button key={preset.label} type="button" className={outlineXs} onClick={() => setBody(preset.text)}>
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <Field label="공지/알림 내용">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={3}
                    placeholder="팀원들에게 전할 안내 사항을 입력해 주세요."
                    className={area}
                />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className={checkbox} />
                    <span className="font-semibold text-secondary">긴급 확인 요청</span>
                </label>
                <Button type="submit" size="sm" disabled={actions.disabled || !body.trim()}>
                    <Send />
                    <span>{targetAudience === 'duty' ? `당번 ${dutyMembers.length}명에게 알림 발송` : '팀 전체 알림 발송'}</span>
                </Button>
            </div>
        </form>
    );
}

function SetlistForm({ event, ...actions }: Actions & { event: TeamSchedule }) {
    const [title, setTitle] = useState(event.setlistTitle ?? '');
    const [songsText, setSongsText] = useState((event.setlistSongs ?? []).join('\n'));
    const [notifyDuty, setNotifyDuty] = useState(true);

    const titlePresets = ['주일 1부 예배', '주일 2부 예배', '청년부 예배', '수요/금요 기도회'];
    const dutyCount = event.slots.filter(s => s.memberId).length;

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            const trimmedTitle = title.trim();
            if (!trimmedTitle) return;
            const songs = songsText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            await actions.send({
                type: 'event.updateSetlist',
                eventId: event.id,
                setlistTitle: trimmedTitle,
                setlistSongs: songs,
                notifyDuty,
            });
        }} className="space-y-5">
            <div className="space-y-2">
                <span className={cn(eyebrow, 'block')}>콘티 제목 퀵 선택</span>
                <div className="flex flex-wrap gap-1.5">
                    {titlePresets.map(preset => (
                        <button key={preset} type="button" className={outlineXs} onClick={() => setTitle(`${preset} 콘티`)}>
                            {preset}
                        </button>
                    ))}
                </div>
            </div>

            <Field label="콘티 제목 (필수)">
                <input
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 주일 2부 예배 콘티"
                    className={control}
                />
            </Field>

            <Field label="수록곡 목록 (줄바꿈 또는 쉼표로 구분)">
                <textarea
                    rows={3}
                    value={songsText}
                    onChange={(e) => setSongsText(e.target.value)}
                    placeholder="예:&#10;꽃들도&#10;은혜&#10;주는 완전합니다"
                    className={area}
                />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={notifyDuty} onChange={(e) => setNotifyDuty(e.target.checked)} className={checkbox} />
                    <span>이번 주 배정된 섬김이/당번({dutyCount}명)에게 콘티 알림 발송</span>
                </label>
                <Button type="submit" size="sm" disabled={actions.disabled || !title.trim()}>
                    <Check />
                    <span>콘티 저장 및 알림</span>
                </Button>
            </div>
        </form>
    );
}

function ConfirmAction({ label, explanation, command, send, disabled }: Actions & { label: string; explanation: string; command: PlanningCommand }) {
    const [confirming, setConfirming] = useState(false);
    return confirming ? <div className="w-full space-y-3 rounded-2xl bg-destructive/10 p-4">
        <p className="text-sm text-foreground">{explanation}</p>
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" size="xs" disabled={disabled} onClick={async () => {
                if (await send(command)) setConfirming(false);
            }}>{label} 확정</Button>
            <Button type="button" variant="outline" size="xs" disabled={disabled} onClick={() => setConfirming(false)}>돌아가기</Button>
        </div>
    </div> : <Button type="button" variant="ghost" size="xs" className="text-destructive hover:bg-destructive/10" disabled={disabled} onClick={() => setConfirming(true)}>{label}</Button>;
}

function AlertCard({ alert, event, names, manager, className, ...actions }: Actions & {
    alert: UrgentAlert; event?: TeamSchedule; names: Map<string, string>; manager: boolean; className?: string;
}) {
    const slot = event?.slots.find(item => item.id === alert.slotId);
    return <li className={cn('space-y-1.5 border-b border-border/70 py-4 first:pt-2 last:border-b-0 last:pb-0', className)}>
        <p className="text-xs">
            <span className="font-semibold text-foreground">{alert.kind === 'notice' ? '인도자 공지' : alertLabels[alert.kind]}</span>
            <span className={alert.resolvedAt ? 'text-muted-foreground' : 'font-medium text-destructive'}> · {alert.resolvedAt ? '해결됨' : '미해결'}</span>
            {event?.cancelled ? <span className="text-destructive"> · 취소된 일정</span> : null}
        </p>
        <p className="text-[15px] font-medium leading-snug text-foreground">{event?.title ?? '삭제되었거나 확인할 수 없는 일정'}{slot ? ` · ${worshipRoles[slot.role]}` : alert.slotId ? ' · 이전 배정' : ' · 당번/팀원 알림'}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/75">{alert.body}</p>
        <p className="text-xs text-muted-foreground">작성: {names.get(alert.authorId) ?? '이전 팀원'} · <time dateTime={alert.createdAt}>{planningDate(alert.createdAt)}</time></p>
        {alert.resolvedAt ? <p className="text-xs text-muted-foreground">해결: <time dateTime={alert.resolvedAt}>{planningDate(alert.resolvedAt)}</time></p> : null}
        {manager && event && !event.cancelled && !alert.resolvedAt ? <div className="pt-1.5"><Button type="button" variant="outline" size="xs" disabled={actions.disabled} onClick={() => void actions.send({ type: 'alert.resolve', alertId: alert.id })}><Check className="text-muted-foreground" />해결 완료 처리</Button></div> : null}
    </li>;
}

/** 1클릭 불참 사유 칩 */
function ReasonChips({ disabled, onPick, titleSuffix = '사유로 1클릭 불참 응답' }: { disabled: boolean; onPick: (reason: string) => void; titleSuffix?: string }) {
    return <div className="flex flex-wrap gap-1.5">
        {ABSENCE_REASONS.map(reason => (
            <button key={reason} type="button" disabled={disabled} className={outlineXs} title={`‘${reason}’ ${titleSuffix}`} onClick={() => onPick(reason)}>
                {reason}
            </button>
        ))}
    </div>;
}

/** 구글 캘린더 · .ics 버튼 한 쌍 */
function CalendarLinks({ event, role, names, long = false }: { event: TeamSchedule; role: WorshipRole; names: Map<string, string>; long?: boolean }) {
    return <>
        <a href={getMyGoogleCalendarUrl(event, role)} target="_blank" rel="noopener noreferrer" className={outlineXs} title="내 구글 캘린더에 1클릭 추가">
            <CalendarPlus className="text-muted-foreground" />
            <span>{long ? '구글 캘린더 등록' : '구글 등록'}</span>
        </a>
        <button type="button" className={outlineXs} title="애플/스마트폰 캘린더(.ics) 1클릭 다운로드" onClick={() => downloadIcsFile(event, '예배팀', names)}>
            <Download className="text-muted-foreground" />
            <span>{long ? '애플/모바일 .ics' : '.ics'}</span>
        </button>
    </>;
}

function LegendDot({ className, label }: { className: string; label: string }) {
    return <span className="inline-flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', className)} aria-hidden="true" />
        {label}
    </span>;
}

/** 콘티·순서 리디자인의 배치 현황: "N자리 중 M명 확정" + 자리별 막대 + 범례 */
function SlotSummary({ slots, className }: { slots: ScheduleSlot[]; className?: string }) {
    const confirmed = slots.filter(slot => slot.memberId && slot.attendance === 'confirmed').length;
    const pending = slots.filter(slot => slot.memberId && slot.attendance === 'pending').length;
    const declined = slots.filter(slot => slot.memberId && slot.attendance === 'absent').length;
    const vacant = slots.filter(slot => !slot.memberId).length;
    if (!slots.length) return <p className={cn('text-xs text-muted-foreground', className)}>아직 등록된 역할이 없습니다.</p>;
    return <div className={cn('space-y-2.5', className)}>
        <p className="text-[15px] text-foreground">
            <span className="font-semibold tabular-nums">{slots.length}자리</span> 중 <span className="font-semibold tabular-nums">{confirmed}명</span> 확정
        </p>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`확정 ${confirmed}, 대기 ${pending}, 불참 ${declined}, 빈자리 ${vacant}`}>
            {slots.map(slot => <span key={slot.id} className={cn('flex-1', STATUS[slotTone(slot)].bar)} />)}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
            <LegendDot className={STATUS.ok.dot} label={`확정 ${confirmed}`} />
            <LegendDot className={STATUS.warn.dot} label={`대기 ${pending}`} />
            <LegendDot className={STATUS.danger.dot} label={`불참 ${declined}`} />
            <LegendDot className={STATUS.idle.dot} label={`빈자리 ${vacant}`} />
        </p>
    </div>;
}

const SlotCard = memo(function SlotCard({ slot, event, alerts, members, names, userId, manager, allEvents, workloadMap, ...actions }: Actions & {
    slot: ScheduleSlot; event: TeamSchedule; alerts: UrgentAlert[]; members: TeamMember[];
    names: Map<string, string>; userId: string; manager: boolean;
    allEvents: TeamSchedule[]; workloadMap: Map<string, number>;
}) {
    const assigned = slot.memberId === userId;
    const isVacantOrAbsent = !slot.memberId || slot.attendance === 'absent';
    const needsHelp = isVacantOrAbsent || alerts.some(alert => alert.slotId === slot.id && alert.kind === 'substitute' && !alert.resolvedAt);
    const volunteered = slot.volunteers.includes(userId);
    const [showingAbsentForm, setShowingAbsentForm] = useState(false);
    const [copiedPersonal, setCopiedPersonal] = useState(false);
    const [sendingInvite, setSendingInvite] = useState(false);
    /** 겹치는 시간에 이 자리 말고 다른 자리(같은 일정의 다른 역할 포함)에 이미 배치된 사람 — lib/planning 의 available 과 같은 규칙이라 배정·지원·확정이 실패합니다. */
    const placedElsewhere = useCallback((memberId: string) => allEvents.some(other =>
        !other.cancelled &&
        Date.parse(other.startsAt) < Date.parse(event.endsAt) &&
        Date.parse(event.startsAt) < Date.parse(other.endsAt) &&
        other.slots.some(s => s.id !== slot.id && s.memberId === memberId && s.attendance !== 'absent')
    ), [allEvents, event, slot.id]);

    const recommendedCandidates = useMemo(() => {
        if (!isVacantOrAbsent || !manager || event.cancelled) return [];
        const candidates = members.filter(m => {
            if (m.userId === slot.memberId) return false;
            const roleMatches = m.role === slot.role || (slot.role === 'vocal' && m.role === 'leader') || m.role === 'member';
            if (!roleMatches) return false;
            return !placedElsewhere(m.userId);
        });
        return candidates.map(m => ({
            userId: m.userId,
            name: m.name,
            count: workloadMap.get(m.userId) ?? 0,
        })).sort((a, b) => a.count - b.count);
    }, [isVacantOrAbsent, manager, event, members, slot, placedElsewhere, workloadMap]);

    const handleCopyPersonal = async () => {
        if (!slot.memberId) return;
        const memberName = names.get(slot.memberId) ?? '팀원';
        const personalText = generatePersonalReminderText(event, slot, memberName);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(personalText);
            } else {
                window.prompt('아래 멘트를 복사하여 카카오톡에 붙여넣으세요:', personalText);
            }
            setCopiedPersonal(true);
            setTimeout(() => setCopiedPersonal(false), 2000);
        } catch {
            window.prompt('아래 멘트를 복사하여 카카오톡에 붙여넣으세요:', personalText);
        }
    };

    const Icon = ROLE_ICON[slot.role];
    const tone = slotTone(slot);
    const memberName = slot.memberId ? names.get(slot.memberId) ?? '이전 팀원' : null;
    const live = !event.cancelled;
    const pendingMember = Boolean(slot.memberId) && slot.attendance === 'pending';
    const showInvite = manager && pendingMember && live;
    const showPersonal = manager && pendingMember;
    const showRequest = live && (manager || assigned);
    const showVolunteer = live && !assigned && needsHelp && members.some(m => m.userId === userId) && (volunteered || !placedElsewhere(userId));
    const showTools = showInvite || showPersonal || showRequest;
    const showMine = live && assigned;
    const hasBody = showTools || recommendedCandidates.length > 0 || showMine || showVolunteer || slot.volunteers.length > 0;

    const editable = manager && live;
    return <li className="border-b border-border/70 py-4 last:border-b-0">
        <div className={cn('grid items-center gap-x-3.5 gap-y-2', editable ? 'grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto]' : 'grid-cols-[2.5rem_minmax(0,1fr)_auto]')}>
            <span className={cn(iconTile, 'col-start-1 row-start-1')}><Icon size={18} aria-hidden="true" /></span>
            <div className="col-start-2 row-start-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground">
                    {worshipRoles[slot.role]}
                    {assigned ? <span className="ml-1.5 text-[11px] font-semibold text-brand">나</span> : null}
                </p>
                <p className="mt-0.5 text-xs leading-5">
                    <span className={STATUS[tone].text}>{slot.memberId ? attendanceLabels[slot.attendance] : '빈자리'}</span>
                    {slot.invitedAt ? <span className="text-muted-foreground"> · 초대 발송: {shortDateTime(slot.invitedAt)}</span> : null}
                    {slot.respondedAt ? <span className="text-muted-foreground"> · {slot.attendance === 'confirmed' ? '동의 완료' : '응답'}: {shortDateTime(slot.respondedAt)}</span> : null}
                </p>
            </div>
            {editable ? (
                <>
                    <select
                        aria-label={`${worshipRoles[slot.role]} 담당자 선택`}
                        className="col-span-2 col-start-2 row-start-2 h-9 w-full max-w-64 min-w-0 truncate justify-self-start rounded-full border border-border bg-card pl-3 pr-2 text-base text-foreground focus-visible:border-foreground/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-44 sm:text-xs"
                        value={slot.memberId ?? ''}
                        disabled={actions.disabled}
                        onChange={e => {
                            const newMemberId = e.target.value || null;
                            void actions.send({ type: 'slot.save', eventId: event.id, slotId: slot.id, role: slot.role, memberId: newMemberId });
                        }}
                    >
                        <option value="">미배정 (빈자리)</option>
                        {slot.memberId && !members.some(m => m.userId === slot.memberId) ? <option value={slot.memberId}>이전 팀원</option> : null}
                        {members.map(m => (
                            <option key={m.userId} value={m.userId}>{m.name} ({worshipRoles[m.role]})</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="col-start-3 row-start-1 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 sm:col-start-4"
                        title="이 역할 슬롯 삭제"
                        aria-label="이 역할 슬롯 삭제"
                        disabled={actions.disabled}
                        onClick={() => {
                            if (window.confirm('이 역할 배정 슬롯을 삭제하시겠습니까?')) {
                                void actions.send({ type: 'slot.remove', eventId: event.id, slotId: slot.id });
                            }
                        }}
                    >
                        <X size={15} />
                    </button>
                </>
            ) : memberName ? (
                <span className={cn('col-start-3 row-start-1 inline-flex items-center gap-1.5', slot.attendance === 'absent' && 'opacity-50')}>
                    <Avatar name={memberName} size="sm" />
                    <span className={cn('text-[13px] text-foreground', slot.attendance === 'absent' && 'line-through')}>{memberName}</span>
                </span>
            ) : (
                <span className="col-start-3 row-start-1 text-xs text-muted-foreground">미배정 (빈자리)</span>
            )}
        </div>

        {slot.attendance === 'absent' && slot.declineReason ? (
            <p className="mt-2 pl-[3.375rem] text-xs text-destructive">불참 사유: {slot.declineReason}</p>
        ) : null}

        {hasBody ? <div className="mt-3 space-y-3 pl-[3.375rem]">
            {/* 초대 알림 · 갠톡 멘트 · 대체 요청 */}
            {showTools ? <div className="flex flex-wrap items-center gap-1.5">
                {showInvite ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        title="팀원에게 앱 사역 초대 알림을 전송합니다"
                        disabled={actions.disabled || sendingInvite}
                        onClick={async () => {
                            setSendingInvite(true);
                            try {
                                await actions.send({ type: 'slot.sendInvite', eventId: event.id, slotId: slot.id });
                            } finally {
                                setSendingInvite(false);
                            }
                        }}
                    >
                        <Send className="text-muted-foreground" />
                        <span>{sendingInvite ? '발송 중…' : slot.invitedAt ? '초대 재발송' : '초대 알림'}</span>
                    </Button>
                ) : null}
                {showPersonal ? (
                    <Button type="button" variant="outline" size="xs" title="해당 팀원에게 카카오톡 갠톡으로 보낼 확인 멘트를 복사합니다" onClick={() => void handleCopyPersonal()}>
                        {copiedPersonal ? <><Check className="text-brand" /><span className="text-brand">멘트 복사됨!</span></> : <><MessageSquare className="text-muted-foreground" /><span>갠톡 멘트</span></>}
                    </Button>
                ) : null}
                {showRequest ? (
                    <Disclosure className="open:basis-full" chevron="inline" summaryClassName={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'px-2 font-medium text-muted-foreground hover:text-foreground')} summary={slot.memberId ? '대체 인원 요청 보내기' : '빈자리 충원 요청 보내기'}>
                        <div className="mt-3 rounded-2xl bg-muted/60 p-4"><AlertForm {...actions} eventId={event.id} slotId={slot.id} /></div>
                    </Disclosure>
                ) : null}
            </div> : null}

            {/* 스마트 빈자리 추천 */}
            {recommendedCandidates.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(eyebrow, 'mr-0.5 inline-flex items-center gap-1')}><Sparkles size={12} aria-hidden="true" />빈자리 추천</span>
                    {recommendedCandidates.slice(0, 2).map(c => (
                        <Button
                            key={c.userId}
                            type="button"
                            variant="outline"
                            size="xs"
                            title={`${c.name}님을 이 역할에 바로 배정합니다 (누적 사역 ${c.count}회)`}
                            disabled={actions.disabled}
                            onClick={() => void actions.send({ type: 'slot.save', eventId: event.id, slotId: slot.id, role: slot.role, memberId: c.userId })}
                        >
                            <Plus className="text-brand" />
                            {c.name} <span className="font-normal tabular-nums text-muted-foreground">({c.count}회)</span>
                        </Button>
                    ))}
                </div>
            ) : null}

            {/* 내 참석 응답 */}
            {showMine ? (
                <div className="space-y-2">
                    <p className={eyebrow}>내 섬김 참석 여부</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {slot.attendance !== 'confirmed' ? (
                            <Button
                                type="button"
                                size="xs"
                                disabled={actions.disabled}
                                onClick={() => void actions.send({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' })}
                            >
                                <Check /> 참석 확정
                            </Button>
                        ) : (
                            <span className={cn('inline-flex h-8 items-center gap-1 pr-1 text-xs font-semibold', STATUS.ok.text)}>
                                <Check size={13} aria-hidden="true" /> 참석 확정됨
                            </span>
                        )}
                        <Button type="button" variant="outline" size="xs" disabled={actions.disabled} onClick={() => setShowingAbsentForm(!showingAbsentForm)}>
                            불참 사유 {showingAbsentForm ? '닫기' : '입력'}
                        </Button>
                        <CalendarLinks event={event} role={slot.role} names={names} />
                    </div>
                    {showingAbsentForm ? (
                        <div className="space-y-4 rounded-2xl bg-muted/60 p-4">
                            <div className="space-y-2">
                                <p className={eyebrow}>1클릭 불참 사유 선택</p>
                                <ReasonChips disabled={actions.disabled} onPick={r => void actions.send({
                                    type: 'attendance.set',
                                    eventId: event.id,
                                    slotId: slot.id,
                                    attendance: 'absent',
                                    reason: r,
                                    autoRequestSubstitute: true,
                                })} />
                            </div>
                            <CommandForm
                                {...actions}
                                submitLabel="직접 입력한 사유로 저장"
                                build={data => ({
                                    type: 'attendance.set',
                                    eventId: event.id,
                                    slotId: slot.id,
                                    attendance: 'absent',
                                    reason: text(data, 'reason'),
                                    autoRequestSubstitute: data.get('autoRequestSubstitute') === 'on',
                                })}
                            >
                                <Field label="기타 불참 사유 직접 입력">
                                    <textarea name="reason" rows={2} placeholder="직접 사유를 입력하세요 (선택)" className={cn(area, 'min-h-20')} />
                                </Field>
                                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                                    <input type="checkbox" name="autoRequestSubstitute" defaultChecked className={checkbox} />
                                    <span>인도자에게 대체 인원 자동 추천 알림 발송</span>
                                </label>
                            </CommandForm>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* 지원하기 */}
            {showVolunteer ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">대체/충원이 필요한 빈자리입니다.</span>
                    {volunteered ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="text-destructive"
                            disabled={actions.disabled}
                            title="지원 신청을 취소합니다"
                            onClick={() => void actions.send({ type: 'slot.unvolunteer', eventId: event.id, slotId: slot.id })}
                        >
                            지원 취소
                        </Button>
                    ) : (
                        <Button type="button" size="xs" disabled={actions.disabled} onClick={() => void actions.send({ type: 'slot.volunteer', eventId: event.id, slotId: slot.id })}>
                            이 역할에 지원하기
                        </Button>
                    )}
                </div>
            ) : null}

            {/* 지원자 명단 */}
            {slot.volunteers.length > 0 ? (
                <div className="space-y-2">
                    <p className={eyebrow}>대체 지원자 {slot.volunteers.length}명</p>
                    <ul className="space-y-1.5">
                        {slot.volunteers.map(mid => (
                            <li key={mid} className="flex items-center gap-2">
                                <Avatar name={names.get(mid) ?? '이전 팀원'} size="xs" />
                                <span className="text-[13px] text-foreground">{names.get(mid) ?? '이전 팀원'}{mid === userId ? ' (나)' : ''}</span>
                                {manager && live ? (
                                    <Button
                                        type="button"
                                        size="xs"
                                        className="ml-auto"
                                        disabled={actions.disabled || !names.has(mid) || placedElsewhere(mid)}
                                        title={!names.has(mid) ? '팀을 나간 사람은 확정할 수 없습니다' : placedElsewhere(mid) ? '같은 시간대 다른 자리에 이미 배치되어 있습니다' : undefined}
                                        onClick={() => void actions.send({ type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: mid })}
                                    >
                                        담당자로 확정
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div> : null}
    </li>;
});

/** 캘린더·배분표에서 고른 일정의 빠른 상세 & 배정 패널 */
function SelectedEventPanel({ event, variant, manager, copied, alerts, members, names, userId, allEvents, workloadMap, onClose, onRsvp, onShare, onCopy, ...actions }: Actions & {
    event: TeamSchedule; variant: 'calendar' | 'matrix'; manager: boolean; copied: boolean; alerts: UrgentAlert[];
    members: TeamMember[]; names: Map<string, string>; userId: string; allEvents: TeamSchedule[]; workloadMap: Map<string, number>;
    onClose: () => void; onRsvp: () => void; onShare: () => void; onCopy: () => void;
}) {
    const hasVacant = event.slots.some(s => s.memberId === null);
    const hasPending = event.slots.some(s => s.memberId && s.attendance === 'pending');
    const showAutoAssign = variant === 'matrix' || hasVacant;
    const showReminder = variant === 'matrix' || hasPending;
    return <section aria-label="선택된 일정" className="space-y-5 rounded-3xl border border-border bg-card p-5 animate-in fade-in sm:p-6">
        <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className={eyebrow}>선택된 일정 · {event.kind === 'rehearsal' ? '연습' : '예배'}{event.cancelled ? <span className="text-destructive"> · 취소됨</span> : null}</p>
                <h3 className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">{event.title}</h3>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    <time dateTime={event.startsAt}>{planningDate(event.startsAt)}</time>
                    <span> ~ </span>
                    <time dateTime={event.endsAt}>{planningDate(event.endsAt)}</time>
                    {event.location ? ` · 장소: ${event.location}` : ''}
                </p>
            </div>
            <button type="button" onClick={onClose} title="닫기" aria-label="닫기" className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X size={18} />
            </button>
        </header>

        <SlotSummary slots={event.slots} />

        <div className="flex flex-wrap gap-1.5">
            {manager && !event.cancelled && showAutoAssign ? (
                <Button
                    type="button"
                    size="xs"
                    variant={hasVacant ? 'default' : 'outline'}
                    disabled={actions.disabled}
                    title={variant === 'matrix' ? '파트가 일치하고 최근 사역 횟수가 적은 팀원을 우선하여 빈자리를 스마트하게 배분합니다' : undefined}
                    onClick={() => void actions.send({ type: 'slots.autoAssign', eventId: event.id })}
                >
                    <Sparkles className={hasVacant ? undefined : 'text-muted-foreground'} />
                    <span>스마트 자동 배분</span>
                </Button>
            ) : null}
            <Button type="button" variant="outline" size="xs" title="팀원 사역 동의 현황 및 상세 이력 확인" onClick={onRsvp}>
                <Users className="text-muted-foreground" />
                <span>동의 현황</span>
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={onShare}>
                <Share2 className="text-muted-foreground" />
                <span>공유 & 캘린더</span>
            </Button>
            {manager && !event.cancelled ? <>
                {(event.slots.length === 0 || hasVacant) ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={actions.disabled}
                        title="가장 최근 같은 종류(예배/연습) 일정의 파트 및 배정 인원을 그대로 복사해옵니다"
                        onClick={() => void actions.send({ type: 'slots.autoFillFromRecent', eventId: event.id })}
                    >
                        <Copy className="text-muted-foreground" />
                        <span>지난 배정 복사</span>
                    </Button>
                ) : null}
                {showReminder ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={actions.disabled}
                        title={variant === 'matrix' ? '배정되었으나 아직 응답하지 않은 팀원들에게 카카오톡 복사용 개별 멘트를 전송하거나 알림을 발송합니다' : undefined}
                        onClick={() => void actions.send({ type: 'schedule.sendDutyReminder', eventId: event.id })}
                    >
                        <Bell className="text-muted-foreground" />
                        <span>출석 리마인드 알람</span>
                    </Button>
                ) : null}
                <Button type="button" variant="outline" size="xs" onClick={onCopy}>
                    {copied ? <><Check className="text-brand" /><span className="text-brand">복사됨!</span></> : <><ClipboardCopy className="text-muted-foreground" /><span>카톡 복사</span></>}
                </Button>
            </> : null}
        </div>

        <div>
            <h4 className={subTitle}>
                배정 인원 ({event.slots.filter(s => s.memberId).length}/{event.slots.length}명)
            </h4>
            {event.slots.length ? (
                <ul className="mt-1">
                    {event.slots.map(slot => (
                        <SlotCard
                            key={slot.id}
                            {...actions}
                            slot={slot}
                            event={event}
                            alerts={alerts}
                            members={members}
                            names={names}
                            userId={userId}
                            manager={manager}
                            allEvents={allEvents}
                            workloadMap={workloadMap}
                        />
                    ))}
                </ul>
            ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-input px-4 py-6 text-center text-xs text-muted-foreground">
                    {variant === 'calendar' ? '아직 배정된 역할이 없습니다. 상단 \'지난 배정 복사\'를 누르면 1초 만에 배정됩니다.' : '아직 배정된 역할이 없습니다. 상단 \'지난 배정 복사\'를 누르면 배정됩니다.'}
                </p>
            )}
        </div>
    </section>;
}

/** 목록 보기의 일정 한 건 (구분선으로 나뉜 행) */
function EventItem({ event, defaultOpen, now, alerts, manager, members, names, userId, allEvents, workloadMap, copied, onRsvp, onShare, onCopy, ...actions }: Actions & {
    event: TeamSchedule; defaultOpen: boolean; now: number; alerts: UrgentAlert[]; manager: boolean;
    members: TeamMember[]; names: Map<string, string>; userId: string; allEvents: TeamSchedule[]; workloadMap: Map<string, number>;
    copied: boolean; onRsvp: () => void; onShare: () => void; onCopy: () => void;
}) {
    const assignedCount = event.slots.filter(slot => slot.memberId).length;
    const confirmedCount = event.slots.filter(slot => slot.attendance === 'confirmed').length;
    const totalSlots = event.slots.length;
    const isUserAssigned = event.slots.some(slot => slot.memberId === userId);
    const hasVacant = event.slots.some(s => s.memberId === null);
    const relDate = getRelativeDateLabel(event.startsAt, now);
    const phase = Date.parse(event.endsAt) < now ? '종료됨' : Date.parse(event.startsAt) <= now ? '진행 중' : '예정';
    const live = !event.cancelled;

    return <article aria-label={event.title}>
        <header>
            <p className={eyebrow}>
                <span className={relDate.cls}>{relDate.text}</span>
                <span> · {event.kind === 'rehearsal' ? '연습' : '예배'}</span>
                {event.cancelled ? <span className="font-semibold text-destructive"> · 취소됨</span> : phase !== relDate.text && !(relDate.text === '종료' && phase === '종료됨') ? <span> · {phase}</span> : null}
                {isUserAssigned ? <span className="font-semibold text-brand"> · 내 사역</span> : null}
            </p>
            <h3 className="mt-0.5 break-words text-[17px] font-semibold tracking-tight text-foreground">{event.title}</h3>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground"><time dateTime={event.startsAt}>{planningDate(event.startsAt)}</time><span> ~ </span><time dateTime={event.endsAt}>{planningDate(event.endsAt)}</time> (KST)</p>
            <p className="break-words text-xs text-muted-foreground">장소: {event.location || '미정'}</p>
        </header>

        <SlotSummary slots={event.slots} className="mt-4" />

        <div className="mt-4 flex flex-wrap gap-1.5">
            {manager && live && hasVacant ? (
                <Button
                    type="button"
                    size="xs"
                    disabled={actions.disabled}
                    title="파트 일치 및 공평 밸런스(사역 적은 인원 우선)로 빈자리를 스마트하게 자동 배정합니다"
                    onClick={() => void actions.send({ type: 'slots.autoAssign', eventId: event.id })}
                >
                    <Sparkles />
                    <span>스마트 자동 배분</span>
                </Button>
            ) : null}
            {totalSlots > 0 && assignedCount > 0 ? (
                <Button type="button" variant="outline" size="xs" title="팀원 사역 동의 현황 및 응답 이력 확인 / 일괄 초대 알림" onClick={onRsvp}>
                    <Users className="text-muted-foreground" />
                    <span>동의 현황 <span className="tabular-nums">({confirmedCount}/{assignedCount}명)</span></span>
                </Button>
            ) : null}
            <Button type="button" variant="outline" size="xs" title="일정 및 섬김 명단 공유 / 캘린더 등록 (.ics)" onClick={onShare}>
                <Share2 className="text-muted-foreground" />
                <span>공유 & 캘린더</span>
            </Button>
            <Button type="button" variant="outline" size="xs" title="카카오톡 공유용 명단 빠른 복사" onClick={onCopy}>
                {copied ? <><Check className="text-brand" /><span className="text-brand">복사됨!</span></> : <><ClipboardCopy className="text-muted-foreground" /><span>빠른 복사</span></>}
            </Button>
            {manager && live ? <>
                {(event.slots.length === 0 || hasVacant) ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={actions.disabled}
                        title="가장 최근 같은 종류(예배/연습) 일정의 파트 및 배정 인원을 그대로 복사해옵니다"
                        onClick={() => void actions.send({ type: 'slots.autoFillFromRecent', eventId: event.id })}
                    >
                        <Copy className="text-muted-foreground" />
                        <span>지난 배정 복사</span>
                    </Button>
                ) : null}
                {event.slots.some(s => s.memberId && s.attendance === 'pending') ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={actions.disabled}
                        title="참석 여부를 아직 확인하지 않은 팀원들에게 긴급 리마인드 알림을 보냅니다"
                        onClick={() => void actions.send({ type: 'schedule.sendDutyReminder', eventId: event.id })}
                    >
                        <Bell className="text-muted-foreground" />
                        <span>출석 리마인드 알람</span>
                    </Button>
                ) : null}
                {event.slots.some(s => s.memberId !== null) ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={actions.disabled}
                        title="모든 슬롯의 배정을 비우고 빈자리로 초기화합니다"
                        onClick={() => {
                            if (window.confirm('이 일정의 모든 인원 배정을 초기화(빈자리)하시겠습니까?')) {
                                void actions.send({ type: 'slots.clear', eventId: event.id });
                            }
                        }}
                    >
                        배분 초기화
                    </Button>
                ) : null}
            </> : null}
        </div>

        {/* 콘티 안내 및 당번 알림 */}
        {event.setlistTitle ? (
            <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Music size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className={eyebrow}>콘티{event.setlistSongs?.length ? ` · ${event.setlistSongs.length}곡` : ''}</p>
                            <p className="truncate text-[15px] font-medium text-foreground">{event.setlistTitle}</p>
                        </div>
                    </div>
                    {manager && live ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={actions.disabled}
                            title="배정된 섬김이들에게 콘티 확인 리마인더 알림 재전송"
                            onClick={() => void actions.send({
                                type: 'event.updateSetlist',
                                eventId: event.id,
                                setlistTitle: event.setlistTitle!,
                                setlistSongs: event.setlistSongs ?? undefined,
                                setlistId: event.setlistId ?? undefined,
                                notifyDuty: true,
                            })}
                        >
                            <Bell className="text-muted-foreground" />
                            <span>당번에게 콘티 알림</span>
                        </Button>
                    ) : null}
                </div>
                {event.setlistSongs?.length ? (
                    <ol className="mt-3 space-y-1 pl-[1.625rem] text-[13px] text-foreground/75">
                        {event.setlistSongs.map((song, sIdx) => (
                            <li key={sIdx} className="flex gap-2.5">
                                <span className="w-4 shrink-0 tabular-nums text-muted-foreground">{sIdx + 1}</span>
                                <span className="min-w-0 break-words">{song}</span>
                            </li>
                        ))}
                    </ol>
                ) : null}
            </div>
        ) : manager && live ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-input px-4 py-2.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Music size={14} aria-hidden="true" /> 아직 등록된 콘티가 없습니다.
                </span>
                <Disclosure className="open:basis-full" chevron="none" summaryClassName={outlineXs} summary={<><Plus className="text-brand" />콘티 등록/연결</>}>
                    <div className="pb-2 pt-4"><SetlistForm {...actions} event={event} /></div>
                </Disclosure>
            </div>
        ) : null}

        <Disclosure
            defaultOpen={defaultOpen}
            className="mt-4 border-t border-border/70"
            summaryClassName="min-h-12 text-sm font-medium text-foreground"
            summary={<span>일정 상세·참석·배정 보기{alerts.some(alert => !alert.resolvedAt) ? <span className="text-secondary"> · 긴급 알림 있음</span> : ''}</span>}
        >
            <div className="space-y-7 pt-2">
                {event.cancelled ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm font-medium">취소된 일정입니다. 배정과 알림은 기록으로만 확인할 수 있습니다.</p> : null}

                {/* 인도자 알림 · 당번 공지 발송 (인도자 전용) */}
                {manager && live ? (
                    <Disclosure
                        className="rounded-2xl bg-muted/60 px-4"
                        chevron="inline"
                        summaryClassName="min-h-12 text-sm font-semibold text-foreground"
                        summary={<><Send size={15} className="text-muted-foreground" aria-hidden="true" /><span>인도자 알림 · 당번 공지 보내기</span><span className="ml-auto text-xs font-normal text-muted-foreground">펼치기</span></>}
                    >
                        <div className="pb-4 pt-1"><DutyNoticeForm {...actions} event={event} members={members} /></div>
                    </Disclosure>
                ) : null}

                <section aria-label="일정 안내" className="space-y-1.5"><h4 className={subTitle}>안내 사항</h4><p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/75">{event.notes || '등록된 안내 사항이 없습니다.'}</p></section>
                <section aria-label="일정별 긴급 알림">
                    <h4 className={subTitle}>이 일정의 알림 · 해결 기록</h4>
                    {alerts.length ? <ul>{alerts.map(alert => <AlertCard key={alert.id} {...actions} alert={alert} event={event} names={names} manager={manager} />)}</ul> : <p className="mt-1.5 text-sm text-muted-foreground">등록된 알림이 없습니다.</p>}
                </section>
                <section aria-label="역할 배정과 참석">
                    <h4 className={subTitle}>역할 배정·참석</h4>
                    {event.slots.length ? <ul className="mt-1">{event.slots.map(slot => <SlotCard key={slot.id} {...actions} slot={slot} event={event} alerts={alerts} members={members} names={names} userId={userId} manager={manager} allEvents={allEvents} workloadMap={workloadMap} />)}</ul> : <p className="mt-1.5 text-sm text-muted-foreground">아직 등록된 역할이 없습니다.</p>}
                </section>
                {manager ? <Disclosure
                    className="border-t border-border/70"
                    summaryClassName="min-h-12 text-sm font-medium text-foreground"
                    summary={<span>일정 관리 (역할 템플릿 · 배정 복사 · 삭제)</span>}
                >
                    <div className="pb-1">
                        {!event.cancelled && (
                            <>
                                {([
                                    ['콘티 정보 수정 및 당번 알림', <SetlistForm key="setlist" {...actions} event={event} />],
                                    ['일정 수정', <EventForm key={JSON.stringify([event.title, event.kind, event.startsAt, event.endsAt, event.location, event.notes])} {...actions} event={event} />],
                                    ['역할·담당자 1명 추가', <SlotForm key="slot" {...actions} eventId={event.id} members={members} />],
                                    ['역할 템플릿 일괄 추가 (표준 밴드, 풀 세션 등)', <TemplateForm key="template" {...actions} eventId={event.id} />],
                                    ['이전 일정에서 배정 복사해오기', <CopyRosterForm key="copy" {...actions} eventId={event.id} otherEvents={allEvents} />],
                                    ['일정 전체 긴급 공지', <AlertForm key="notice" {...actions} eventId={event.id} slotId={null} />],
                                ] as const).map(([label, form]) => (
                                    <Disclosure key={label} className="border-b border-border/70 pl-3" summaryClassName="min-h-11 text-[13px] text-foreground/80" summary={<span>{label}</span>}>
                                        <div className="pb-5 pt-1">{form}</div>
                                    </Disclosure>
                                ))}
                            </>
                        )}
                        <div className="flex flex-wrap gap-2 pl-1 pt-3">
                            {!event.cancelled && <ConfirmAction {...actions} label="일정 취소" explanation="이 일정을 취소하면 참석 응답, 배정 변경, 지원 및 알림 처리를 할 수 없습니다. 취소하시겠습니까?" command={{ type: 'event.cancel', eventId: event.id }} />}
                            <ConfirmAction {...actions} label="일정 영구 삭제" explanation="이 일정을 목록에서 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다. 삭제하시겠습니까?" command={{ type: 'event.delete', eventId: event.id }} />
                        </div>
                    </div>
                </Disclosure> : null}
            </div>
        </Disclosure>
    </article>;
}

const VIEW_MODES = [
    ['list', '목록', List],
    ['calendar', '캘린더', CalendarDays],
    ['matrix', '사역 배분표', Table],
] as const;

const PERIOD_FILTERS = [
    ['upcoming', '예정·진행 중'],
    ['my', '내 배정 일정'],
    ['vacant', '빈자리 필요'],
    ['past', '지난 일정'],
    ['all', '전체'],
] as const;

const PART_FILTERS = [
    ['all', '전체'],
    ['leader', '인도자'],
    ['vocal', '싱어'],
    ['keyboard', '건반'],
    ['guitar', '기타'],
    ['bass', '베이스'],
    ['drums', '드럼'],
    ['sound', '음향'],
    ['media', '미디어'],
] as const;

const TEMPLATE_PRESETS = [
    { label: '이번 주 주일 예배', time: '11:00', when: getUpcomingSundayKST, command: (times: { startsAt: string; endsAt: string }): PlanningCommand => ({
        type: 'event.createWithTemplate',
        input: { title: '주일 2부 예배', kind: 'worship', startsAt: times.startsAt, endsAt: times.endsAt, location: '본당 3층 대예배실', notes: '10:00 음향/악기 리허설 시작' },
        templateKey: 'standard',
        weeksCount: 1,
    }) },
    { label: '이번 주 토요 연습', time: '17:00', when: getUpcomingSaturdayKST, command: (times: { startsAt: string; endsAt: string }): PlanningCommand => ({
        type: 'event.save',
        input: { title: '찬양팀 토요 연습', kind: 'rehearsal', startsAt: times.startsAt, endsAt: times.endsAt, location: '찬양팀 연습실', notes: '콘티 사전 숙지 후 모입니다.' },
    }) },
    { label: '이번 주 금요 기도회', time: '20:00', when: getUpcomingFridayKST, command: (times: { startsAt: string; endsAt: string }): PlanningCommand => ({
        type: 'event.createWithTemplate',
        input: { title: '금요 기도회', kind: 'worship', startsAt: times.startsAt, endsAt: times.endsAt, location: '본당 3층 대예배실', notes: '뜨겁게 찬양과 기도로 준비합니다.' },
        templateKey: 'acoustic',
        weeksCount: 1,
    }) },
    { label: '이번 주 수요 예배', time: '19:30', when: getUpcomingWednesdayKST, command: (times: { startsAt: string; endsAt: string }): PlanningCommand => ({
        type: 'event.save',
        input: { title: '수요 예배', kind: 'worship', startsAt: times.startsAt, endsAt: times.endsAt, location: '본당 3층 대예배실', notes: '수요 예배 찬양 섬김' },
    }) },
];

export default function SchedulePanel({ state, members, userId, busy, onCommand }: PlanningPanelProps) {
    const headingId = useId();
    const createFormId = useId();
    const [filter, setFilter] = useState<'upcoming' | 'my' | 'vacant' | 'past' | 'all'>('upcoming');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [now, setNow] = useState(() => Date.now());
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
    const lock = useRef(false);
    // Keep date filters current even if the parent has no new planning data.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const manager = canManagePlanning(members, userId);
    const names = useMemo(() => new Map(members.map(member => [member.userId, member.name])), [members]);
    const eventMap = useMemo(() => new Map(state.events.map(event => [event.id, event])), [state.events]);
    const { alertsByEvent, openAlerts } = useMemo(() => {
        const byEvent = new Map<string, UrgentAlert[]>();
        const sortedAlerts = [...state.alerts].sort((a, b) => Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
        for (const alert of sortedAlerts) {
            const group = byEvent.get(alert.eventId) ?? [];
            group.push(alert);
            byEvent.set(alert.eventId, group);
        }
        return { alertsByEvent: byEvent, openAlerts: sortedAlerts.filter(alert => !alert.resolvedAt) };
    }, [state.alerts]);

    const workloadMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const m of members) map.set(m.userId, 0);
        for (const ev of state.events) {
            if (ev.cancelled) continue;
            for (const s of ev.slots) {
                if (s.memberId && map.has(s.memberId)) {
                    map.set(s.memberId, map.get(s.memberId)! + 1);
                }
            }
        }
        return map;
    }, [members, state.events]);

    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const events = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return state.events.filter(event => {
            if (filter === 'past') {
                if (Date.parse(event.endsAt) >= now) return false;
            } else if (filter === 'my') {
                if (Date.parse(event.endsAt) < now || !event.slots.some(s => s.memberId === userId)) return false;
            } else if (filter === 'vacant') {
                if (Date.parse(event.endsAt) < now || (event.slots.length > 0 && !event.slots.some(s => !s.memberId || s.attendance === 'absent'))) return false;
            } else if (filter === 'upcoming') {
                if (Date.parse(event.endsAt) < now) return false;
            }
            if (roleFilter !== 'all') {
                if (!event.slots.some(s => s.role === roleFilter)) return false;
            }
            if (query) {
                const matchTitle = event.title.toLowerCase().includes(query);
                const matchLocation = event.location?.toLowerCase().includes(query);
                const matchNotes = event.notes?.toLowerCase().includes(query);
                const matchSetlistTitle = event.setlistTitle?.toLowerCase().includes(query);
                const matchSongs = event.setlistSongs?.some(song => song.toLowerCase().includes(query));
                const matchMembers = event.slots.some(s => {
                    if (!s.memberId) return false;
                    const name = names.get(s.memberId)?.toLowerCase() ?? '';
                    return name.includes(query);
                });
                const matchRoles = event.slots.some(s => worshipRoles[s.role]?.toLowerCase().includes(query));
                if (!matchTitle && !matchLocation && !matchNotes && !matchSetlistTitle && !matchSongs && !matchMembers && !matchRoles) {
                    return false;
                }
            }
            return true;
        }).sort((a, b) => filter === 'past' ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }, [state.events, filter, now, userId, roleFilter, searchQuery, names]);
    const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
    const [copiedMonthly, setCopiedMonthly] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'matrix'>('list');
    const [shareModalEvent, setShareModalEvent] = useState<TeamSchedule | null>(null);
    const [rsvpModalEvent, setRsvpModalEvent] = useState<TeamSchedule | null>(null);
    const [monthlySundaysModalOpen, setMonthlySundaysModalOpen] = useState(false);
    const [blockedDatesModalOpen, setBlockedDatesModalOpen] = useState(false);
    const [selectedCalendarEventId, setSelectedCalendarEventId] = useState<string | null>(null);
    const [createEventDate, setCreateEventDate] = useState<string | null>(null);
    const [createFormOpen, setCreateFormOpen] = useState(false);
    // 처음 펼칠 때 폼을 만들고, 접어도 입력 중인 내용을 유지합니다 (Disclosure 와 같은 방식).
    const [createFormMounted, setCreateFormMounted] = useState(false);
    // 달력에서 날짜를 골라 연 새 일정 폼. 모바일에서는 달력 아래(하단 탭 뒤)에 열리므로 화면 안으로 끌어옵니다.
    const dateFormRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (createEventDate) dateFormRef.current?.scrollIntoView({ block: 'nearest' });
    }, [createEventDate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isEditing = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            );

            if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !isEditing) {
                e.preventDefault();
                if (viewMode !== 'list') setViewMode('list');
                setTimeout(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                }, 20);
                return;
            }

            if (e.key === 'Escape') {
                if (searchQuery) {
                    setSearchQuery('');
                    searchInputRef.current?.blur();
                } else if (selectedCalendarEventId) {
                    setSelectedCalendarEventId(null);
                } else if (createEventDate) {
                    setCreateEventDate(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, searchQuery, selectedCalendarEventId, createEventDate]);

    const activeRsvpEvent = useMemo(() => {
        if (!rsvpModalEvent) return null;
        return state.events.find(e => e.id === rsvpModalEvent.id) ?? rsvpModalEvent;
    }, [state.events, rsvpModalEvent]);

    const myBlockedCount = useMemo(() => {
        return (state.blockedDates ?? []).filter(b => b.memberId === userId).length;
    }, [state.blockedDates, userId]);

    const selectedCalendarEvent = useMemo(() => {
        return state.events.find(e => e.id === selectedCalendarEventId) ?? null;
    }, [state.events, selectedCalendarEventId]);

    const myUpcomingSlots = useMemo(() => {
        const list: Array<{ event: TeamSchedule; slot: ScheduleSlot }> = [];
        for (const event of state.events) {
            if (event.cancelled || Date.parse(event.endsAt) < now) continue;
            for (const slot of event.slots) {
                if (slot.memberId === userId) {
                    list.push({ event, slot });
                }
            }
        }
        return list.sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
    }, [state.events, userId, now]);

    const myPendingSlots = useMemo(() => {
        return myUpcomingSlots.filter(item => item.slot.attendance === 'pending');
    }, [myUpcomingSlots]);

    const handleCopyKakao = async (event: TeamSchedule) => {
        const shareText = generateKakaoShareText(event, names);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareText);
            } else {
                window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', shareText);
            }
            setCopiedEventId(event.id);
            setTimeout(() => {
                setCopiedEventId(prev => prev === event.id ? null : prev);
            }, 2000);
        } catch {
            window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', shareText);
        }
    };

    const handleCopyMonthly = async () => {
        const text = generateMonthlyKakaoShareText(state.events.filter(e => !e.cancelled && Date.parse(e.endsAt) >= now), names);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', text);
            }
            setCopiedMonthly(true);
            setTimeout(() => setCopiedMonthly(false), 2000);
        } catch {
            window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', text);
        }
    };

    const [copiedMySchedule, setCopiedMySchedule] = useState(false);
    const [previewSetlistEventId, setPreviewSetlistEventId] = useState<string | null>(null);
    const [showAllMyDuties, setShowAllMyDuties] = useState(false);
    const [activeDeclineSlotId, setActiveDeclineSlotId] = useState<string | null>(null);

    const vacantHelpEvents = useMemo(() => {
        return state.events.filter(e =>
            !e.cancelled &&
            Date.parse(e.endsAt) >= now &&
            e.slots.some(s => (!s.memberId || s.attendance === 'absent') && s.memberId !== userId)
        );
    }, [state.events, now, userId]);

    const handleCopyMySchedule = async () => {
        const myName = names.get(userId) ?? '나';
        const items = myUpcomingSlots.map(({ event, slot }) => ({ event, role: slot.role }));
        const text = generateMyScheduleShareText(items, myName);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', text);
            }
            setCopiedMySchedule(true);
            setTimeout(() => setCopiedMySchedule(false), 2000);
        } catch {
            window.prompt('아래 텍스트를 복사하여 카카오톡에 붙여넣으세요:', text);
        }
    };

    const send = useCallback<Send>(async command => {
        if (busy || lock.current) return false;
        lock.current = true;
        setPending(true);
        setFeedback(null);
        try {
            const success = await onCommand(command);
            setFeedback({ error: !success, text: success ? '변경 사항을 저장했습니다.' : '저장하지 못했습니다. 입력 내용과 현재 상태를 확인하고 다시 시도해 주세요.' });
            return success;
        } catch {
            setFeedback({ error: true, text: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
            return false;
        } finally {
            lock.current = false;
            setPending(false);
        }
    }, [busy, onCommand]);
    const actions = useMemo(() => ({ send, disabled: busy || pending }), [send, busy, pending]);

    const searchParams = useSearchParams();
    const linkSetlistTitle = searchParams.get('linkSetlistTitle');
    const linkSetlistSongs = searchParams.get('linkSetlistSongs');
    const linkSetlistId = searchParams.get('linkSetlistId');
    const linkTarget = state.events.find(e => !e.cancelled);
    const nextDuty = myUpcomingSlots[0];

    const panelProps = (event: TeamSchedule) => ({
        ...actions,
        event,
        manager,
        members,
        names,
        userId,
        allEvents: state.events,
        workloadMap,
        alerts: alertsByEvent.get(event.id) ?? NO_ALERTS,
        copied: copiedEventId === event.id,
        onRsvp: () => setRsvpModalEvent(event),
        onShare: () => setShareModalEvent(event),
        onCopy: () => void handleCopyKakao(event),
    });

    return <section aria-labelledby={headingId} className="min-w-0 space-y-8">
        <header className="space-y-1">
            <h2 id={headingId} className="text-[17px] font-semibold tracking-tight text-foreground">연습·예배 일정</h2>
            <p className="text-xs leading-5 text-muted-foreground">일정을 펼쳐 배정과 참석 여부를 확인하세요. 시간은 모두 한국 시간입니다.</p>
            <div role="status" aria-live="polite" aria-atomic="true" className={cn('text-xs font-medium', busy || pending ? 'text-muted-foreground' : 'text-brand')}>
                {busy || pending ? '처리 중…' : feedback && !feedback.error ? feedback.text : ''}
            </div>
            {feedback?.error ? <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{feedback.text}</p> : null}
        </header>

        {/* 라이브러리에서 전달된 콘티 빠른 연결 */}
        {linkSetlistTitle && (
            <div className={cn('flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5', TONE_BLOCK.mint)}>
                <div className="flex min-w-0 items-start gap-3">
                    <Music size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">라이브러리에서 전달된 콘티: {linkSetlistTitle}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">가장 가까운 주일 일정에 연결하고 배정된 섬김이(당번)들에게 알림을 보낼 수 있습니다.</p>
                    </div>
                </div>
                {linkTarget ? (
                    <Button
                        type="button"
                        size="sm"
                        className="h-auto min-h-9 whitespace-normal py-2 text-left"
                        disabled={actions.disabled}
                        onClick={() => {
                            const target = state.events.find(e => !e.cancelled);
                            if (target) {
                                const songs = linkSetlistSongs ? linkSetlistSongs.split('||').map(s => s.trim()).filter(Boolean) : undefined;
                                void actions.send({
                                    type: 'event.updateSetlist',
                                    eventId: target.id,
                                    setlistTitle: linkSetlistTitle,
                                    setlistSongs: songs,
                                    setlistId: linkSetlistId ?? undefined,
                                    notifyDuty: true,
                                });
                            }
                        }}
                    >
                        다가오는 {linkTarget.title}에 연결 & 당번 알림 발송
                    </Button>
                ) : null}
            </div>
        )}

        {/* 나의 다가오는 섬김 & 1초 빠른 응답 */}
        <section aria-label="나의 다가오는 섬김과 참석 응답" className={cn('space-y-4 rounded-3xl p-5 sm:p-6', TONE_BLOCK.mint)}>
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                    나의 다가오는 섬김 <span className="font-normal tabular-nums text-muted-foreground">({myUpcomingSlots.length}건)</span>
                </h3>
                {myPendingSlots.length > 0 ? (
                    <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-secondary">
                        <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
                        응답 필요 {myPendingSlots.length}건
                    </span>
                ) : myUpcomingSlots.length > 0 ? (
                    <span className="mt-1 shrink-0 text-xs font-semibold text-brand">모두 확정됨</span>
                ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {myPendingSlots.length > 1 ? (
                    <Button
                        type="button"
                        size="xs"
                        disabled={actions.disabled}
                        onClick={() => void actions.send({
                            type: 'attendance.batchConfirm',
                            items: myPendingSlots.map(p => ({ eventId: p.event.id, slotId: p.slot.id }))
                        })}
                    >
                        <Check /> 내 사역 {myPendingSlots.length}건 모두 참석 확정
                    </Button>
                ) : null}
                {myUpcomingSlots.length > 0 && (
                    <Button type="button" variant="outline" size="xs" onClick={() => void handleCopyMySchedule()} title="내 이번 달 사역 일정을 카카오톡용으로 원클릭 복사합니다">
                        {copiedMySchedule ? (
                            <><Check className="text-brand" /><span className="text-brand">내 사역 복사됨!</span></>
                        ) : (
                            <><ClipboardCopy className="text-muted-foreground" /><span>내 일정 카톡 복사</span></>
                        )}
                    </Button>
                )}
                <Button type="button" variant="outline" size="xs" onClick={() => setBlockedDatesModalOpen(true)} title="섬길 수 없는 날짜를 미리 등록해 두면 자동 배분에서 제외됩니다">
                    <CalendarX2 className="text-muted-foreground" />
                    <span>사역 불가일 등록</span>
                    {myBlockedCount > 0 ? <span className="font-semibold tabular-nums text-destructive">{myBlockedCount}</span> : null}
                </Button>
            </div>

            {myUpcomingSlots.length === 0 ? (
                <div className="space-y-0.5 text-xs leading-5 text-muted-foreground">
                    <p className="text-foreground/75">현재 배정된 다가오는 사역 일정이 없습니다.</p>
                    <p>휴가나 시험 등 일정이 있으시면 미리 사역 불가일을 등록해 주세요.</p>
                </div>
            ) : myPendingSlots.length > 0 ? (
                <div>
                    <p className="text-xs leading-5 text-muted-foreground">참석 여부 응답이 필요한 사역입니다. 버튼 1번으로 확정하거나 사유를 선택하세요.</p>
                    <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
                        {myPendingSlots.map(({ event, slot }) => {
                            const rel = getRelativeDateLabel(event.startsAt, now);
                            const isDeclineOpen = activeDeclineSlotId === slot.id;
                            const isSetlistPreviewOpen = previewSetlistEventId === event.id;

                            return (
                                <li key={slot.id} className="py-4 last:pb-0">
                                    <p className={eyebrow}><span className={rel.cls}>{rel.text}</span> · {worshipRoles[slot.role]}</p>
                                    <p className="mt-0.5 text-[15px] font-medium text-foreground">{event.title}</p>
                                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{planningDate(event.startsAt)}</p>

                                    {event.setlistTitle ? (
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                aria-expanded={isSetlistPreviewOpen}
                                                onClick={() => setPreviewSetlistEventId(prev => prev === event.id ? null : event.id)}
                                                className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-foreground"
                                            >
                                                <Music size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                                                <span>콘티: {event.setlistTitle} {event.setlistSongs?.length ? `(${event.setlistSongs.length}곡)` : ''}</span>
                                                <ChevronDown size={13} aria-hidden="true" className={cn('text-muted-foreground transition-transform', isSetlistPreviewOpen && 'rotate-180')} />
                                            </button>
                                            {isSetlistPreviewOpen && event.setlistSongs?.length ? (
                                                <ol className="mt-1 space-y-1 rounded-2xl bg-card/80 px-4 py-3 text-[13px] text-foreground/80">
                                                    {event.setlistSongs.map((song, idx) => (
                                                        <li key={idx} className="flex gap-2.5"><span className="w-4 shrink-0 tabular-nums text-muted-foreground">{idx + 1}</span>{song}</li>
                                                    ))}
                                                </ol>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {slot.invitedAt ? (
                                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Send size={10} className="shrink-0" aria-hidden="true" />
                                            <span>초대장 수신 ({shortDateTime(slot.invitedAt)})</span>
                                        </p>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="xs"
                                            disabled={actions.disabled}
                                            onClick={() => void actions.send({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' })}
                                        >
                                            <Check /> 참석 확정 (1클릭)
                                        </Button>
                                        <Button type="button" variant="outline" size="xs" disabled={actions.disabled} onClick={() => setActiveDeclineSlotId(prev => prev === slot.id ? null : slot.id)}>
                                            불참 사유 {isDeclineOpen ? '닫기' : '선택'}
                                        </Button>
                                        <Button type="button" variant="outline" size="icon-xs" title="이 일정의 전체 사역 동의 현황 확인" aria-label="이 일정의 전체 사역 동의 현황 확인" onClick={() => setRsvpModalEvent(event)}>
                                            <Users className="text-muted-foreground" />
                                        </Button>
                                        <CalendarLinks event={event} role={slot.role} names={names} />
                                    </div>

                                    {isDeclineOpen && (
                                        <div className="mt-3 space-y-2 rounded-2xl bg-card/80 p-3.5">
                                            <p className={eyebrow}>1클릭 불참 사유 선택</p>
                                            <ReasonChips disabled={actions.disabled} onPick={r => void actions.send({
                                                type: 'attendance.set',
                                                eventId: event.id,
                                                slotId: slot.id,
                                                attendance: 'absent',
                                                reason: r,
                                                autoRequestSubstitute: true,
                                            })} />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : nextDuty ? (
                <div>
                    {/* 확정된 가장 가까운 사역 */}
                    <div className="border-t border-black/5 pt-4 dark:border-white/10">
                        <p className={eyebrow}><span className={cn('font-semibold', STATUS.ok.text)}>확정됨</span> · {worshipRoles[nextDuty.slot.role]}</p>
                        <p className="mt-0.5 text-[15px] font-medium text-foreground">{nextDuty.event.title}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{planningDate(nextDuty.event.startsAt)}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <CalendarLinks event={nextDuty.event} role={nextDuty.slot.role} names={names} long />
                            {nextDuty.event.setlistTitle ? (
                                <Button type="button" variant="outline" size="xs" aria-expanded={previewSetlistEventId === nextDuty.event.id} onClick={() => setPreviewSetlistEventId(prev => prev === nextDuty.event.id ? null : nextDuty.event.id)}>
                                    <Music className="text-muted-foreground" />
                                    <span>콘티 곡 순서 {previewSetlistEventId === nextDuty.event.id ? '닫기' : '보기'}</span>
                                    <ChevronDown className={cn('text-muted-foreground transition-transform', previewSetlistEventId === nextDuty.event.id && 'rotate-180')} />
                                </Button>
                            ) : null}
                            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => setActiveDeclineSlotId(prev => prev === nextDuty.slot.id ? null : nextDuty.slot.id)}>
                                참석 상태 변경
                            </Button>
                        </div>

                        {/* 콘티 곡 순서 인라인 프리뷰 */}
                        {previewSetlistEventId === nextDuty.event.id && nextDuty.event.setlistSongs?.length ? (
                            <div className="mt-3 space-y-2.5 rounded-2xl bg-card/80 p-4">
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-[13px] font-semibold text-foreground">콘티: {nextDuty.event.setlistTitle}</p>
                                    <span className="text-[11px] tabular-nums text-muted-foreground">{nextDuty.event.setlistSongs.length}곡</span>
                                </div>
                                <ol className="space-y-1 text-[13px] text-foreground/80">
                                    {nextDuty.event.setlistSongs.map((song, idx) => (
                                        <li key={idx} className="flex gap-2.5"><span className="w-4 shrink-0 tabular-nums text-muted-foreground">{idx + 1}</span>{song}</li>
                                    ))}
                                </ol>
                                {nextDuty.event.setlistId && (
                                    <a
                                        href={`/dashboard/songs/library?team=${nextDuty.event.setlistId}`}
                                        className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-brand underline-offset-4 hover:underline"
                                    >
                                        <span>악보 보관함에서 열기</span>
                                        <ExternalLink size={12} aria-hidden="true" />
                                    </a>
                                )}
                            </div>
                        ) : null}

                        {/* 확정 후 부득이한 불참 */}
                        {activeDeclineSlotId === nextDuty.slot.id && (
                            <div className="mt-3 space-y-2 rounded-2xl bg-card/80 p-3.5">
                                <p className={eyebrow}>부득이한 사정으로 불참하게 되셨나요? 1클릭 사유 선택</p>
                                <ReasonChips disabled={actions.disabled} titleSuffix="사유로 불참 변경" onPick={r => {
                                    void actions.send({
                                        type: 'attendance.set',
                                        eventId: nextDuty.event.id,
                                        slotId: nextDuty.slot.id,
                                        attendance: 'absent',
                                        reason: r,
                                        autoRequestSubstitute: true,
                                    });
                                    setActiveDeclineSlotId(null);
                                }} />
                            </div>
                        )}
                    </div>

                    {/* 이후 다가오는 사역 */}
                    {myUpcomingSlots.length > 1 && (
                        <div className="mt-3">
                            <button
                                type="button"
                                aria-expanded={showAllMyDuties}
                                onClick={() => setShowAllMyDuties(!showAllMyDuties)}
                                className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-foreground"
                            >
                                <span>{showAllMyDuties ? '이후 다가오는 사역 접기' : `이후 다가오는 사역 (${myUpcomingSlots.length - 1}건 더보기)`}</span>
                                <ChevronDown size={13} aria-hidden="true" className={cn('text-muted-foreground transition-transform', showAllMyDuties && 'rotate-180')} />
                            </button>

                            {showAllMyDuties && (
                                <ul className="divide-y divide-black/5 dark:divide-white/10">
                                    {myUpcomingSlots.slice(1).map(({ event, slot }) => (
                                        <li key={slot.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                                            <div className="min-w-0">
                                                <p className={eyebrow}>{worshipRoles[slot.role]}</p>
                                                <p className="text-sm font-medium text-foreground">{event.title} <span className="font-normal tabular-nums text-muted-foreground">({planningDate(event.startsAt)})</span></p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <CalendarLinks event={event} role={slot.role} names={names} />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            ) : null}

            {/* 빈자리 충원 지원 유도 (팀에 빈자리/결석이 있을 때) */}
            {vacantHelpEvents.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-black/5 pt-4 dark:border-white/10">
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <span className="size-1.5 shrink-0 rounded-full bg-secondary" aria-hidden="true" />
                        <span>찬양팀에 대체/충원이 필요한 빈자리가 {vacantHelpEvents.length}건 있습니다.</span>
                    </span>
                    <Button type="button" variant="outline" size="xs" onClick={() => { setFilter('vacant'); setViewMode('list'); }}>
                        빈자리 보고 1클릭 지원하기
                    </Button>
                </div>
            )}
        </section>

        {/* 미해결 긴급 알림 (있을 때만) */}
        {openAlerts.length > 0 ? (
            <section aria-label="미해결 긴급 알림" className={cn('rounded-3xl p-5 sm:p-6', TONE_BLOCK.peach)}>
                <h3 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-foreground">
                    긴급 알림 <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold tabular-nums text-secondary-foreground">{openAlerts.length}</span>
                </h3>
                <ul className="mt-1">{openAlerts.map(alert => <AlertCard key={alert.id} {...actions} className="border-black/5 dark:border-white/10" alert={alert} event={eventMap.get(alert.eventId)} names={names} manager={manager} />)}</ul>
            </section>
        ) : null}

        <div className="space-y-5">
            {/* 일정 만들기 도구 (관리자) */}
            {manager ? (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" aria-expanded={createFormOpen} aria-controls={createFormMounted ? createFormId : undefined} onClick={() => { setCreateFormMounted(true); setCreateFormOpen(open => !open); }}>
                            <Plus strokeWidth={2.25} />
                            <span>직접 일정 만들기</span>
                        </Button>
                        <Disclosure className="relative" chevron="inline" summaryClassName={buttonVariants({ variant: 'outline', size: 'sm' })} summary={<><Sparkles className="text-muted-foreground" /><span>빠른 일정 템플릿</span></>}>
                            <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-border bg-card p-1.5 shadow-lg">
                                {TEMPLATE_PRESETS.map(preset => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                        disabled={actions.disabled}
                                        onClick={async (e) => {
                                            (e.currentTarget.closest('details') as HTMLDetailsElement)?.removeAttribute('open');
                                            await actions.send(preset.command(preset.when()));
                                        }}
                                    >
                                        <span>{preset.label}</span>
                                        <span className="text-xs tabular-nums text-muted-foreground">{preset.time}</span>
                                    </button>
                                ))}
                            </div>
                        </Disclosure>
                        <Button type="button" variant="outline" size="sm" onClick={() => setMonthlySundaysModalOpen(true)}>
                            <CalendarDays className="text-muted-foreground" />
                            <span>이번 달 주일 일괄 생성</span>
                        </Button>
                    </div>
                    {createFormMounted ? (
                        <div id={createFormId} hidden={!createFormOpen} className="rounded-3xl border border-border p-5 sm:max-w-xl sm:p-6">
                            <p className={eyebrow}>새 일정</p>
                            <h3 className="mb-4 mt-0.5 text-[17px] font-semibold tracking-tight">직접 일정 만들기</h3>
                            <EventForm {...actions} />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* 보기 방식 (목록 ↔ 캘린더 ↔ 사역 배분표) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="보기 방식" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
                    {VIEW_MODES.map(([value, label, Icon]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={viewMode === value}
                            className={cn(
                                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                                viewMode === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                            )}
                            onClick={() => setViewMode(value)}
                        >
                            <Icon size={14} aria-hidden="true" /> {label}
                        </button>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="max-sm:w-9 max-sm:px-0" title="이번 달 다가오는 모든 예배/연습 섬김 명단을 카카오톡 단톡방용으로 전체 복사합니다" onClick={() => void handleCopyMonthly()}>
                    {copiedMonthly ? (
                        <><Check className="text-brand" /><span className="max-sm:sr-only text-brand">사역표 복사됨!</span></>
                    ) : (
                        <><ClipboardCopy className="text-muted-foreground" /><span className="max-sm:sr-only">카톡 전체 복사</span></>
                    )}
                </Button>
            </div>

            {viewMode === 'list' ? (
                <div className="space-y-3">
                    {/* 빠른 검색 (일정 제목, 곡명, 팀원 이름, 장소 등) */}
                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="일정 제목, 찬양곡, 팀원 이름, 장소 검색..."
                            className={cn(control, 'bg-muted/60 pl-10 focus-visible:bg-card', searchQuery ? 'pr-24' : 'pr-4 sm:pr-20')}
                        />
                        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                            {searchQuery ? (
                                <>
                                    <span className="text-xs tabular-nums text-muted-foreground">{events.length}건</span>
                                    <button
                                        type="button"
                                        onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="검색어 지우기 (Esc)"
                                        aria-label="검색어 지우기"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            ) : (
                                <kbd className="mr-1.5 hidden select-none items-center rounded-md border border-border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:inline-flex">
                                    / 검색
                                </kbd>
                            )}
                        </div>
                    </div>

                    <div role="group" aria-label="일정 기간 필터" className="no-scrollbar flex gap-5 overflow-x-auto border-b border-border/70">
                        {PERIOD_FILTERS.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={filter === value}
                                className={cn(
                                    '-mb-px flex h-11 shrink-0 items-center border-b-2 text-sm transition-colors',
                                    filter === value ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => { setFilter(value); setNow(Date.now()); }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 파트별 빠른 필터 */}
                    <div role="group" aria-label="파트별 필터" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 pt-1">
                        {PART_FILTERS.map(([val, lbl]) => (
                            <button
                                key={val}
                                type="button"
                                aria-pressed={roleFilter === val}
                                className={cn(
                                    'inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors',
                                    roleFilter === val ? 'bg-primary font-semibold text-primary-foreground' : 'border border-border text-foreground/75 hover:bg-muted',
                                )}
                                onClick={() => setRoleFilter(val)}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>

        {viewMode === 'calendar' ? (
            <div className="space-y-6">
                <CalendarView
                    events={state.events}
                    members={members}
                    names={names}
                    userId={userId}
                    manager={manager}
                    selectedDate={selectedCalendarEvent ? kstInput(selectedCalendarEvent.startsAt).slice(0, 10) : undefined}
                    selectedEventId={selectedCalendarEvent?.id}
                    onSelectEvent={(event) => setSelectedCalendarEventId(event.id)}
                    onOpenMonthlySundaysModal={() => setMonthlySundaysModalOpen(true)}
                    onAddEventOnDate={(dateStr) => {
                        setCreateEventDate(dateStr);
                    }}
                />

                {/* 캘린더에서 날짜 '+' 클릭 시 빠른 일정 생성 */}
                {createEventDate && (
                    <section ref={dateFormRef} aria-label="새 일정 등록" className="scroll-mb-36 scroll-mt-[calc(var(--app-header-h,0px)+1rem)] space-y-4 rounded-3xl border border-border bg-card p-5 animate-in fade-in sm:p-6 lg:scroll-mb-6">
                        <header className="flex items-start justify-between gap-3">
                            <div>
                                <p className={eyebrow}>새 일정</p>
                                <h3 className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">{createEventDate} 새 일정 등록</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCreateEventDate(null)}
                                aria-label="닫기"
                                className="-mr-2 -mt-1 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </header>
                        <EventForm {...actions} defaultDate={createEventDate} />
                    </section>
                )}

                {selectedCalendarEvent && (
                    <SelectedEventPanel {...panelProps(selectedCalendarEvent)} variant="calendar" onClose={() => setSelectedCalendarEventId(null)} />
                )}
            </div>
        ) : viewMode === 'matrix' ? (
            <div className="space-y-6">
                <MatrixView
                    events={state.events}
                    members={members}
                    names={names}
                    userId={userId}
                    manager={manager}
                    onSelectEvent={(event) => setSelectedCalendarEventId(event.id)}
                    onOpenMonthlySundaysModal={() => setMonthlySundaysModalOpen(true)}
                    onCommand={actions.send}
                    disabled={actions.disabled}
                />

                {selectedCalendarEvent && (
                    <SelectedEventPanel {...panelProps(selectedCalendarEvent)} variant="matrix" onClose={() => setSelectedCalendarEventId(null)} />
                )}
            </div>
        ) : (
            <div>
                <p className="text-xs text-muted-foreground">{events.length}개 일정 · {filter === 'past' ? '최근 일정부터' : '시작 시간순'}</p>
                {events.length === 0 ? (
                    <div className="mt-4 space-y-3 rounded-3xl border border-dashed border-input px-5 py-10 text-center">
                        <CalendarDays size={28} className="mx-auto text-muted-foreground/60" aria-hidden="true" />
                        <p className="text-[15px] font-medium text-foreground">
                            {searchQuery ? `'${searchQuery}'에 일치하는 일정이 없습니다.` : '이 조건에 해당하는 일정이 없습니다.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {searchQuery ? '검색어를 변경하거나 필터를 초기화해 보세요.' : '새 일정을 등록하거나 필터 조건을 변경해 보세요.'}
                        </p>
                        {(searchQuery || filter !== 'upcoming' || roleFilter !== 'all') ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery('');
                                    setFilter('upcoming');
                                    setRoleFilter('all');
                                }}
                            >
                                <RotateCcw className="text-muted-foreground" />
                                <span>검색 및 필터 초기화</span>
                            </Button>
                        ) : null}
                    </div>
                ) : (
                    <ul>
                        {events.map((event, idx) => (
                            <li key={event.id} className="border-b border-border/70 py-6 first:pt-5 last:border-b-0">
                                <EventItem {...panelProps(event)} defaultOpen={idx === 0 && (filter === 'upcoming' || filter === 'my')} now={now} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )}

        {/* 일정 공유 및 캘린더 등록 */}
        {shareModalEvent && (
            <EventShareModal
                event={shareModalEvent}
                names={names}
                onClose={() => setShareModalEvent(null)}
            />
        )}

        {/* 일정 사역 동의 현황 및 초대 관리 */}
        {activeRsvpEvent && (
            <ScheduleRsvpModal
                event={activeRsvpEvent}
                members={members}
                userId={userId}
                manager={manager}
                disabled={actions.disabled}
                onSend={actions.send}
                onClose={() => setRsvpModalEvent(null)}
            />
        )}

        {/* 이번 달 주일예배 일괄 생성 */}
        {monthlySundaysModalOpen && (
            <MonthlySundaysModal
                disabled={actions.disabled}
                onSend={actions.send}
                onClose={() => setMonthlySundaysModalOpen(false)}
            />
        )}

        {/* 사역 불가일(휴가·시험 등) 관리 */}
        {blockedDatesModalOpen && (
            <BlockedDatesModal
                disabled={actions.disabled}
                onSend={actions.send}
                blockedDates={state.blockedDates ?? []}
                userId={userId}
                members={members}
                manager={manager}
                onClose={() => setBlockedDatesModalOpen(false)}
            />
        )}
    </section>;
}
