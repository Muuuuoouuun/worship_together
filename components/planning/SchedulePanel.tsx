'use client';

import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { canManagePlanning, planningDate, scheduleTemplates, type PlanningCommand, type PlanningPanelProps, type ScheduleSlot, type ScheduleTemplateKey, type TeamSchedule, type UrgentAlert } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';
import { Bell, CalendarDays, Check, ClipboardCopy, List, MessageSquare, Music, Send, Share2, Sparkles, X } from 'lucide-react';
import CalendarView from './CalendarView';
import EventShareModal from './EventShareModal';
import MonthlySundaysModal from './MonthlySundaysModal';

const control = 'min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground`;
const disclosure = 'min-h-12 cursor-pointer rounded-lg px-2 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-ring';
const card = 'min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5';
const attendanceLabels = { pending: '응답 대기', confirmed: '참석 확정', absent: '불참' };
const alertLabels = { absence: '불참 알림', substitute: '대체 인원 요청', notice: '긴급 공지' };
type Send = PlanningPanelProps['onCommand'];
type Actions = { send: Send; disabled: boolean };

function getRelativeDateLabel(iso: string, nowMs: number) {
    const targetMs = Date.parse(iso);
    const diffHours = (targetMs - nowMs) / (1000 * 60 * 60);
    const diffDays = Math.round((targetMs - nowMs) / (1000 * 60 * 60 * 24));
    if (diffHours < -24) return { text: '종료', cls: 'bg-muted text-muted-foreground' };
    if (diffHours >= -24 && diffHours < 0) return { text: '진행 중', cls: 'bg-secondary/15 text-secondary font-bold' };
    if (diffHours >= 0 && diffHours <= 18) return { text: '오늘', cls: 'bg-primary text-primary-foreground font-bold' };
    if (diffDays === 1) return { text: '내일', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold' };
    if (diffDays > 1 && diffDays <= 7) return { text: `D-${diffDays}`, cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' };
    return { text: `D-${diffDays}`, cls: 'bg-muted text-muted-foreground' };
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

function getUpcomingSundayKST(): { startsAt: string; endsAt: string } {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstNow = new Date(utc + (9 * 3600000));
    const day = kstNow.getDay();
    let daysUntilSunday = day === 0 ? 0 : 7 - day;
    if (day === 0 && kstNow.getHours() >= 12) {
        daysUntilSunday = 7;
    }
    const targetDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + daysUntilSunday, 11, 0, 0);
    const endDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + daysUntilSunday, 12, 30, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toKstIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
    return { startsAt: toKstIso(targetDate), endsAt: toKstIso(endDate) };
}

function getUpcomingSaturdayKST(): { startsAt: string; endsAt: string } {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstNow = new Date(utc + (9 * 3600000));
    const day = kstNow.getDay();
    let daysUntilSaturday = day <= 6 ? 6 - day : 6;
    if (day === 6 && kstNow.getHours() >= 19) {
        daysUntilSaturday = 7;
    }
    const targetDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + daysUntilSaturday, 17, 0, 0);
    const endDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + daysUntilSaturday, 19, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toKstIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
    return { startsAt: toKstIso(targetDate), endsAt: toKstIso(endDate) };
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
    return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={fieldId}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id: fieldId }) : children}</div>;
}

function CommandForm({ children, build, send, disabled, submitLabel, reset = true }: Actions & {
    children: ReactNode; build: (data: FormData) => PlanningCommand; submitLabel: string; reset?: boolean;
}) {
    const [error, setError] = useState('');
    return <form className="space-y-3" onSubmit={async event => {
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
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
            {children}
            <button className={primary} type="submit">{submitLabel}</button>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>;
}

function EventForm({ event, ...actions }: Actions & { event?: TeamSchedule }) {
    const [weeks, setWeeks] = useState(1);
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
        <Field label="일정 종류"><select name="kind" defaultValue={event?.kind ?? 'rehearsal'} className={control}>
            <option value="rehearsal">연습</option><option value="worship">예배</option>
        </select></Field>
        <Field label="제목 (필수)"><input name="title" required defaultValue={event?.title ?? ''} className={control} /></Field>
        <p className="text-sm text-muted-foreground">모든 시간은 한국 시간(KST, UTC+09:00)입니다.</p>
        <div className="grid gap-3 md:grid-cols-2">
            <Field label="시작 (필수)"><input type="datetime-local" step="60" name="startsAt" required defaultValue={event ? kstInput(event.startsAt) : ''} className={control} /></Field>
            <Field label="종료 (필수)"><input type="datetime-local" step="60" name="endsAt" required defaultValue={event ? kstInput(event.endsAt) : ''} className={control} /></Field>
        </div>
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
        <Field label="안내 사항"><textarea name="notes" rows={3} defaultValue={event?.notes ?? ''} className={control} /></Field>
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
        <div className="grid gap-3 md:grid-cols-2">
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
            <textarea name="body" required rows={3} className={control} />
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
        { label: '🎵 콘티 확인 요청', text: '이번 주 콘티가 등록되었습니다! 곡 순서와 송폼을 미리 확인해 주세요 🙏' },
        { label: '🔄 콘티 변경 안내', text: '이번 주 콘티 및 진행 순서에 변경 사항이 있습니다. 확인 부탁드립니다!' },
        { label: '⏰ 리허설 시간 안내', text: '예배 시작 30분 전까지 본당으로 모여 리허설을 진행합니다. 시간 엄수 부탁드려요!' },
        { label: '🙏 함께 기도로 준비', text: '이번 주 예배를 위해 각자의 자리에서 기도로 함께 준비해요.' },
    ];

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
        }} className="space-y-4 rounded-xl border border-secondary/30 bg-background p-4">
            <div className="space-y-2">
                <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">수신 대상 선택</span>
                <div className="flex flex-wrap gap-2">
                    <label className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer transition ${targetAudience === 'duty' ? 'border-secondary bg-secondary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                        <input
                            type="radio"
                            name={`targetAudience-${event.id}`}
                            checked={targetAudience === 'duty'}
                            onChange={() => setTargetAudience('duty')}
                            className="accent-secondary"
                        />
                        <span>해당 주 섬김이/당번 ({dutyMembers.length}명)</span>
                    </label>
                    <label className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer transition ${targetAudience === 'all' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                        <input
                            type="radio"
                            name={`targetAudience-${event.id}`}
                            checked={targetAudience === 'all'}
                            onChange={() => setTargetAudience('all')}
                            className="accent-primary"
                        />
                        <span>찬양팀 전체 ({members.length}명)</span>
                    </label>
                </div>
                {targetAudience === 'duty' && (
                    <div className="text-xs text-muted-foreground pt-1">
                        {dutyMembers.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span>수신 대상자:</span>
                                {dutyMembers.map(m => (
                                    <span key={m.userId} className="rounded-md bg-muted px-1.5 py-0.5 text-foreground font-medium">
                                        {m.name} ({worshipRoles[m.role]})
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">※ 아직 배정된 섬김이가 없습니다. 발송 시 전체 팀원에게 안내됩니다.</span>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">1초 퀵 멘트 선택</span>
                <div className="flex flex-wrap gap-1.5">
                    {presets.map((preset, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/15 hover:border-secondary/40 transition"
                            onClick={() => setBody(preset.text)}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">공지/알림 내용</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={3}
                    placeholder="팀원들에게 전할 안내 사항을 입력해 주세요."
                    className={control}
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                        type="checkbox"
                        checked={urgent}
                        onChange={(e) => setUrgent(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-secondary font-bold">긴급 확인 요청</span>
                </label>
                <button
                    type="submit"
                    disabled={actions.disabled || !body.trim()}
                    className={`${primary} text-xs py-2 px-4 min-h-9 flex items-center gap-1.5`}
                >
                    <Send size={13} />
                    <span>{targetAudience === 'duty' ? `당번 ${dutyMembers.length}명에게 알림 발송` : '팀 전체 알림 발송'}</span>
                </button>
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
        }} className="space-y-4 rounded-xl border border-primary/20 bg-background p-4">
            <div className="space-y-1.5">
                <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">콘티 제목 퀵 선택</span>
                <div className="flex flex-wrap gap-1.5">
                    {titlePresets.map(preset => (
                        <button
                            key={preset}
                            type="button"
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-primary/15 hover:border-primary/40 transition"
                            onClick={() => setTitle(`${preset} 콘티`)}
                        >
                            {preset}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">콘티 제목 (필수)</label>
                <input
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 주일 2부 예배 콘티"
                    className={control}
                />
            </div>

            <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                    수록곡 목록 <span className="text-muted-foreground font-normal">(줄바꿈 또는 쉼표로 구분)</span>
                </label>
                <textarea
                    rows={3}
                    value={songsText}
                    onChange={(e) => setSongsText(e.target.value)}
                    placeholder="예:&#10;꽃들도&#10;은혜&#10;주는 완전합니다"
                    className={control}
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                        type="checkbox"
                        checked={notifyDuty}
                        onChange={(e) => setNotifyDuty(e.target.checked)}
                        className="rounded"
                    />
                    <span>이번 주 배정된 섬김이/당번({dutyCount}명)에게 콘티 알림 발송</span>
                </label>
                <button
                    type="submit"
                    disabled={actions.disabled || !title.trim()}
                    className={`${primary} text-xs py-2 px-4 min-h-9 flex items-center gap-1.5`}
                >
                    <Check size={13} />
                    <span>콘티 저장 및 알림</span>
                </button>
            </div>
        </form>
    );
}

function ConfirmAction({ label, explanation, command, send, disabled }: Actions & { label: string; explanation: string; command: PlanningCommand }) {
    const [confirming, setConfirming] = useState(false);
    return confirming ? <div className="space-y-3 rounded-xl border border-destructive p-3">
        <p className="text-sm">{explanation}</p>
        <div className="flex flex-wrap gap-2">
            <button type="button" className={`${button} text-destructive`} disabled={disabled} onClick={async () => {
                if (await send(command)) setConfirming(false);
            }}>{label} 확정</button>
            <button type="button" className={button} disabled={disabled} onClick={() => setConfirming(false)}>돌아가기</button>
        </div>
    </div> : <button type="button" className={`${button} text-destructive`} disabled={disabled} onClick={() => setConfirming(true)}>{label}</button>;
}

function AlertCard({ alert, event, names, manager, ...actions }: Actions & {
    alert: UrgentAlert; event?: TeamSchedule; names: Map<string, string>; manager: boolean;
}) {
    const slot = event?.slots.find(item => item.id === alert.slotId);
    return <li className="space-y-2 rounded-xl border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className={alert.kind === 'notice' ? 'text-secondary font-bold' : ''}>
                {alert.kind === 'notice' ? '📢 인도자 공지' : alertLabels[alert.kind]}
            </span>
            <span className={alert.resolvedAt ? 'text-muted-foreground' : 'text-destructive'}>{alert.resolvedAt ? '해결됨' : '미해결'}</span>
            {event?.cancelled ? <span className="text-destructive">취소된 일정</span> : null}
        </div>
        <p className="text-sm font-medium">{event?.title ?? '삭제되었거나 확인할 수 없는 일정'}{slot ? ` · ${worshipRoles[slot.role]}` : alert.slotId ? ' · 이전 배정' : ' · 당번/팀원 알림'}</p>
        <p className="whitespace-pre-wrap break-words">{alert.body}</p>
        <p className="text-sm text-muted-foreground">작성: {names.get(alert.authorId) ?? '이전 팀원'} · <time dateTime={alert.createdAt}>{planningDate(alert.createdAt)}</time></p>
        {alert.resolvedAt ? <p className="text-sm text-muted-foreground">해결: <time dateTime={alert.resolvedAt}>{planningDate(alert.resolvedAt)}</time></p> : null}
        {manager && event && !event.cancelled && !alert.resolvedAt ? <button type="button" className={button} disabled={actions.disabled} onClick={() => void actions.send({ type: 'alert.resolve', alertId: alert.id })}>해결 완료 처리</button> : null}
    </li>;
}

function SlotCard({ slot, event, alerts, members, names, userId, manager, allEvents, workloadMap, ...actions }: Actions & {
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

    const recommendedCandidates = useMemo(() => {
        if (!isVacantOrAbsent || !manager || event.cancelled) return [];
        const candidates = members.filter(m => {
            if (m.userId === slot.memberId) return false;
            const roleMatches = m.role === slot.role || (slot.role === 'vocal' && m.role === 'leader') || m.role === 'member';
            if (!roleMatches) return false;
            const hasClash = allEvents.some(other =>
                other.id !== event.id &&
                !other.cancelled &&
                Date.parse(other.startsAt) < Date.parse(event.endsAt) &&
                Date.parse(event.startsAt) < Date.parse(other.endsAt) &&
                other.slots.some(s => s.memberId === m.userId && s.attendance !== 'absent')
            );
            return !hasClash;
        });
        return candidates.map(m => ({
            userId: m.userId,
            name: m.name,
            count: workloadMap.get(m.userId) ?? 0,
        })).sort((a, b) => a.count - b.count);
    }, [isVacantOrAbsent, manager, event, members, slot, allEvents, workloadMap]);

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

    return <li className="space-y-3 rounded-xl border border-border p-3 sm:p-4 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-secondary/15 px-2 py-0.5 text-xs font-bold text-secondary">
                    {worshipRoles[slot.role]}
                </span>
                {manager && !event.cancelled ? (
                    <select
                        aria-label={`${worshipRoles[slot.role]} 담당자 선택`}
                        className="text-sm font-semibold rounded-lg border border-input bg-card px-2 py-1 focus:ring-2 focus:ring-primary"
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
                ) : (
                    <span className="font-semibold text-sm">
                        {slot.memberId ? names.get(slot.memberId) ?? '이전 팀원' : '미배정 (빈자리)'}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-1.5">
                {manager && slot.memberId && slot.attendance === 'pending' ? (
                    <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 inline-flex items-center gap-1 border border-border"
                        title="해당 팀원에게 카카오톡 갠톡으로 보낼 확인 멘트를 복사합니다"
                        onClick={() => void handleCopyPersonal()}
                    >
                        {copiedPersonal ? (
                            <span className="text-emerald-600 font-bold text-[11px]">멘트 복사됨!</span>
                        ) : (
                            <>
                                <MessageSquare size={12} />
                                <span>갠톡 멘트</span>
                            </>
                        )}
                    </button>
                ) : null}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    slot.attendance === 'confirmed' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                    slot.attendance === 'absent' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                    {attendanceLabels[slot.attendance]}
                </span>
                {manager && !event.cancelled ? (
                    <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-destructive rounded"
                        title="이 역할 슬롯 삭제"
                        disabled={actions.disabled}
                        onClick={() => {
                            if (window.confirm('이 역할 배정 슬롯을 삭제하시겠습니까?')) {
                                void actions.send({ type: 'slot.remove', eventId: event.id, slotId: slot.id });
                            }
                        }}
                    >
                        <X size={14} />
                    </button>
                ) : null}
            </div>
        </div>

        {/* 💡 스마트 빈자리 추천 칩 */}
        {recommendedCandidates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                    <Sparkles size={12} className="text-amber-500" /> 빈자리 추천:
                </span>
                {recommendedCandidates.slice(0, 2).map(c => (
                    <button
                        key={c.userId}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-bold text-primary hover:bg-primary/20 text-[11px]"
                        title={`${c.name}님을 이 역할에 바로 배정합니다 (누적 사역 ${c.count}회)`}
                        disabled={actions.disabled}
                        onClick={() => void actions.send({ type: 'slot.save', eventId: event.id, slotId: slot.id, role: slot.role, memberId: c.userId })}
                    >
                        + {c.name} ({c.count}회)
                    </button>
                ))}
            </div>
        ) : null}

        {/* 내 참석 응답: 1초 빠른 액션 버튼 */}
        {!event.cancelled && assigned ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <Sparkles size={13} /> 내 섬김 참석 여부
                    </span>
                    <div className="flex items-center gap-2">
                        {slot.attendance !== 'confirmed' ? (
                            <button
                                type="button"
                                className={`${primary} text-xs py-1.5 px-3 min-h-9`}
                                disabled={actions.disabled}
                                onClick={() => void actions.send({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' })}
                            >
                                <Check size={14} /> 1탭 참석 확정
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <Check size={14} /> 참석 확정됨
                            </span>
                        )}
                        <button
                            type="button"
                            className={`${button} text-xs py-1 px-2.5 min-h-9 text-destructive`}
                            disabled={actions.disabled}
                            onClick={() => setShowingAbsentForm(!showingAbsentForm)}
                        >
                            불참 사유 {showingAbsentForm ? '닫기' : '입력'}
                        </button>
                    </div>
                </div>

                {showingAbsentForm ? (
                    <CommandForm
                        {...actions}
                        submitLabel="불참으로 변경 저장"
                        build={data => ({
                            type: 'attendance.set',
                            eventId: event.id,
                            slotId: slot.id,
                            attendance: 'absent',
                            reason: text(data, 'reason'),
                        })}
                    >
                        <Field label="불참 사유 (선택)">
                            <textarea name="reason" rows={2} placeholder="예: 출장, 시험 등" className={control} />
                        </Field>
                        <p className="text-xs text-muted-foreground">불참으로 변경하면 대체 인원 요청이 자동 등록됩니다.</p>
                    </CommandForm>
                ) : null}
            </div>
        ) : null}

        {/* 빈자리 또는 대체 지원 요청 폼 */}
        {!event.cancelled && (manager || assigned) ? (
            <details>
                <summary className={disclosure}>{slot.memberId ? '대체 인원 요청 보내기' : '빈자리 충원 요청 보내기'}</summary>
                <div className="pt-2"><AlertForm {...actions} eventId={event.id} slotId={slot.id} /></div>
            </details>
        ) : null}

        {/* 지원하기 버튼 */}
        {!event.cancelled && !assigned && needsHelp && members.some(m => m.userId === userId) ? (
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-muted-foreground">대체/충원이 필요한 빈자리입니다.</span>
                <button
                    type="button"
                    className={`${primary} text-xs py-1 px-3 min-h-8`}
                    disabled={actions.disabled || volunteered}
                    onClick={() => void actions.send({ type: 'slot.volunteer', eventId: event.id, slotId: slot.id })}
                >
                    {volunteered ? '지원 완료 · 확정 대기' : '이 역할에 지원하기'}
                </button>
            </div>
        ) : null}

        {/* 지원자 명단 */}
        {slot.volunteers.length > 0 ? (
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 text-xs">
                <p className="font-semibold text-secondary">대체 지원자 {slot.volunteers.length}명</p>
                <ul className="space-y-1.5">
                    {slot.volunteers.map(mid => (
                        <li key={mid} className="flex items-center justify-between gap-2">
                            <span>{names.get(mid) ?? '이전 팀원'}{mid === userId ? ' (나)' : ''}</span>
                            {manager && !event.cancelled ? (
                                <button
                                    type="button"
                                    className={`${primary} text-xs py-0.5 px-2 min-h-7`}
                                    disabled={actions.disabled || !names.has(mid)}
                                    onClick={() => void actions.send({ type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId: mid })}
                                >
                                    담당자로 확정
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </div>
        ) : null}
    </li>;
}

export default function SchedulePanel({ state, members, userId, busy, onCommand }: PlanningPanelProps) {
    const headingId = useId();
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
    const names = new Map(members.map(member => [member.userId, member.name]));
    const eventMap = new Map(state.events.map(event => [event.id, event]));
    const alertsByEvent = new Map<string, UrgentAlert[]>();
    const sortedAlerts = [...state.alerts].sort((a, b) => Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    for (const alert of sortedAlerts) {
        const group = alertsByEvent.get(alert.eventId) ?? [];
        group.push(alert);
        alertsByEvent.set(alert.eventId, group);
    }
    const openAlerts = sortedAlerts.filter(alert => !alert.resolvedAt);

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

    const events = state.events.filter(event => {
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
        return true;
    }).sort((a, b) => filter === 'past' ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
    const [copiedMonthly, setCopiedMonthly] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [shareModalEvent, setShareModalEvent] = useState<TeamSchedule | null>(null);
    const [monthlySundaysModalOpen, setMonthlySundaysModalOpen] = useState(false);

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

    const send: Send = async command => {
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
    };
    const actions = { send, disabled: busy || pending };

    const searchParams = useSearchParams();
    const linkSetlistTitle = searchParams.get('linkSetlistTitle');
    const linkSetlistSongs = searchParams.get('linkSetlistSongs');
    const linkSetlistId = searchParams.get('linkSetlistId');

    return <section aria-labelledby={headingId} className="min-w-0 space-y-5">
        <header className="space-y-1">
            <h2 id={headingId} className="text-xl font-bold">연습·예배 일정</h2>
            <p className="text-sm text-muted-foreground">일정을 펼쳐 배정과 참석 여부를 확인하세요. 시간은 모두 한국 시간입니다.</p>
        </header>
        <div role="status" aria-live="polite" aria-atomic="true" className="text-sm">
            {busy || pending ? '처리 중…' : feedback && !feedback.error ? feedback.text : ''}
        </div>
        {feedback?.error ? <p role="alert" className="text-sm text-destructive">{feedback.text}</p> : null}

        {/* 라이브러리 연동 콘티 빠른 연결 배너 */}
        {linkSetlistTitle && (
            <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Music size={18} className="text-primary" />
                        <div>
                            <p className="font-bold text-sm text-foreground">라이브러리에서 전달된 콘티: {linkSetlistTitle}</p>
                            <p className="text-xs text-muted-foreground">가장 가까운 주일 일정에 연결하고 배정된 섬김이(당번)들에게 알림을 보낼 수 있습니다.</p>
                        </div>
                    </div>
                    {state.events.filter(e => !e.cancelled).length > 0 ? (
                        <button
                            type="button"
                            className={`${primary} text-xs py-1.5 px-3 min-h-8`}
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
                            다가오는 {state.events.find(e => !e.cancelled)?.title}에 연결 & 당번 알림 발송
                        </button>
                    ) : null}
                </div>
            </div>
        )}

        {/* 나의 다가오는 섬김 & 1초 빠른 응답 배너 */}
        {myUpcomingSlots.length > 0 ? (
            <section aria-label="나의 다가오는 섬김과 참석 응답" className={`${card} border-primary/40 bg-primary/5 space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                        <Sparkles size={18} className="text-primary" />
                        나의 다가오는 섬김 ({myUpcomingSlots.length}건)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        {myPendingSlots.length > 1 ? (
                            <button
                                type="button"
                                className={`${button} text-xs py-1 px-3 min-h-8 font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1 shadow-xs`}
                                disabled={actions.disabled}
                                onClick={() => void actions.send({
                                    type: 'attendance.batchConfirm',
                                    items: myPendingSlots.map(p => ({ eventId: p.event.id, slotId: p.slot.id }))
                                })}
                            >
                                <Check size={13} /> 내 사역 {myPendingSlots.length}건 모두 참석 확정
                            </button>
                        ) : null}
                        {myPendingSlots.length > 0 ? (
                            <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-xs font-bold">
                                응답 필요 {myPendingSlots.length}건
                            </span>
                        ) : (
                            <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold">
                                모두 확정됨 ✓
                            </span>
                        )}
                    </div>
                </div>

                {myPendingSlots.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">아직 참석 여부를 응답하지 않은 일정이 있습니다. 1초 만에 확인해 주세요!</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {myPendingSlots.map(({ event, slot }) => {
                                const rel = getRelativeDateLabel(event.startsAt, now);
                                return (
                                    <div key={slot.id} className="flex flex-col justify-between rounded-xl border border-primary/20 bg-background p-3 space-y-2">
                                        <div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`rounded-full px-2 py-0.5 font-bold ${rel.cls}`}>{rel.text}</span>
                                                <span className="font-semibold text-secondary">{worshipRoles[slot.role]}</span>
                                            </div>
                                            <p className="font-bold mt-1 text-sm">{event.title}</p>
                                            <p className="text-xs text-muted-foreground">{planningDate(event.startsAt)}</p>
                                            {event.setlistTitle ? (
                                                <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                                                    <Music size={13} className="shrink-0" />
                                                    <span className="truncate">콘티: {event.setlistTitle}{event.setlistSongs?.length ? ` (${event.setlistSongs.length}곡)` : ''}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                type="button"
                                                className={`${primary} text-xs py-1.5 px-3 flex-1 min-h-9`}
                                                disabled={actions.disabled}
                                                onClick={() => void actions.send({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'confirmed', reason: '' })}
                                            >
                                                <Check size={14} /> 1탭 참석 확정
                                            </button>
                                            <button
                                                type="button"
                                                className={`${button} text-xs py-1.5 px-2.5 min-h-9 text-destructive`}
                                                disabled={actions.disabled}
                                                onClick={() => void actions.send({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: 'absent', reason: '불참' })}
                                            >
                                                불참
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <div>
                            <p>
                                다음 섬김: <strong className="text-foreground">{myUpcomingSlots[0].event.title}</strong> ({planningDate(myUpcomingSlots[0].event.startsAt)} · {worshipRoles[myUpcomingSlots[0].slot.role]})
                            </p>
                            {myUpcomingSlots[0].event.setlistTitle ? (
                                <p className="mt-0.5 text-xs font-semibold text-primary flex items-center gap-1">
                                    <Music size={12} className="shrink-0" /> 이번 주 콘티: {myUpcomingSlots[0].event.setlistTitle}{myUpcomingSlots[0].event.setlistSongs?.length ? ` (${myUpcomingSlots[0].event.setlistSongs.length}곡: ${myUpcomingSlots[0].event.setlistSongs.join(', ')})` : ''}
                                </p>
                            ) : null}
                        </div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            참석 응답 완료 🙌
                        </span>
                    </div>
                )}
            </section>
        ) : null}

        <section aria-label="미해결 긴급 알림" className={`${card} space-y-3 border-destructive/50`}>
            <h3 className="font-bold">긴급 알림 <span className="text-destructive">{openAlerts.length}</span></h3>
            {openAlerts.length ? <ul className="space-y-3">{openAlerts.map(alert => <AlertCard key={alert.id} {...actions} alert={alert} event={eventMap.get(alert.eventId)} names={names} manager={manager} />)}</ul> : <p className="text-sm text-muted-foreground">미해결 긴급 알림이 없습니다.</p>}
        </section>

        {/* 1초 원클릭 스마트 프리셋 바 */}
        {manager ? (
            <section aria-label="1초 빠른 일정 생성 프리셋" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                        <Sparkles size={16} className="text-primary" />
                        1초 빠른 일정 생성 프리셋
                    </h3>
                    <span className="text-xs text-muted-foreground">날짜/시간 자동 계산 & 표준 밴드(7명) 슬롯 자동 탑재</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className={`${button} text-xs py-1.5 px-3 min-h-9 font-semibold bg-background hover:border-primary`}
                        disabled={actions.disabled}
                        onClick={async () => {
                            const times = getUpcomingSundayKST();
                            await actions.send({
                                type: 'event.createWithTemplate',
                                input: {
                                    title: '주일 2부 예배',
                                    kind: 'worship',
                                    startsAt: times.startsAt,
                                    endsAt: times.endsAt,
                                    location: '본당 3층 대예배실',
                                    notes: '10:00 음향/악기 리허설 시작',
                                },
                                templateKey: 'standard',
                                weeksCount: 1,
                            });
                        }}
                    >
                        ⛪ 이번 주 주일 예배 (11:00)
                    </button>
                    <button
                        type="button"
                        className={`${button} text-xs py-1.5 px-3 min-h-9 font-semibold bg-background hover:border-primary`}
                        disabled={actions.disabled}
                        onClick={async () => {
                            const times = getUpcomingSaturdayKST();
                            await actions.send({
                                type: 'event.save',
                                input: {
                                    title: '찬양팀 토요 연습',
                                    kind: 'rehearsal',
                                    startsAt: times.startsAt,
                                    endsAt: times.endsAt,
                                    location: '찬양팀 연습실',
                                    notes: '콘티 사전 숙지 후 모입니다.',
                                },
                            });
                        }}
                    >
                        🎵 이번 주 토요 연습 (17:00)
                    </button>
                    <button
                        type="button"
                        className={`${button} text-xs py-1.5 px-3 min-h-9 font-semibold bg-background hover:border-primary text-secondary`}
                        disabled={actions.disabled}
                        onClick={async () => {
                            if (window.confirm('이번 주부터 4주간의 주일 예배를 표준 밴드 세션(7명) 슬롯과 함께 한 번에 생성하시겠습니까?')) {
                                const times = getUpcomingSundayKST();
                                await actions.send({
                                    type: 'event.createWithTemplate',
                                    input: {
                                        title: '주일 예배',
                                        kind: 'worship',
                                        startsAt: times.startsAt,
                                        endsAt: times.endsAt,
                                        location: '본당 3층 대예배실',
                                        notes: '주일 찬양 섬김',
                                    },
                                    templateKey: 'standard',
                                    weeksCount: 4,
                                });
                            }
                        }}
                    >
                        📅 주일 예배 4주치 일괄 생성
                    </button>
                    <button
                        type="button"
                        className={`${button} text-xs py-1.5 px-3 min-h-9 font-semibold bg-background hover:border-primary text-primary`}
                        disabled={actions.disabled}
                        onClick={() => setMonthlySundaysModalOpen(true)}
                    >
                        ✨ 이번 달 주일예배 일괄 등록 (4~5주)
                    </button>
                </div>
            </section>
        ) : null}

        {manager ? <details className={card}>
            <summary className={disclosure}>새 일정 직접 만들기 (정기 반복 지원)</summary>
            <div className="pt-3"><EventForm {...actions} /></div>
        </details> : null}

        {/* 보기 모드 전환 (목록 보기 ↔ 월간 달력) 및 필터 */}
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center rounded-xl border border-border bg-card p-0.5 shadow-2xs">
                    <button
                        type="button"
                        aria-pressed={viewMode === 'list'}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            viewMode === 'list'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setViewMode('list')}
                    >
                        <List size={14} /> 목록 보기
                    </button>
                    <button
                        type="button"
                        aria-pressed={viewMode === 'calendar'}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            viewMode === 'calendar'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setViewMode('calendar')}
                    >
                        <CalendarDays size={14} /> 캘린더 보기
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {manager && (
                        <button
                            type="button"
                            onClick={() => setMonthlySundaysModalOpen(true)}
                            className={`${button} text-xs py-1.5 px-3 min-h-9 font-bold border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1.5`}
                        >
                            <Sparkles size={13} />
                            <span>이번 달 주일 일괄 생성</span>
                        </button>
                    )}

                    <button
                        type="button"
                        className={`${button} text-xs py-1.5 px-3 min-h-9 flex items-center gap-1.5 font-bold border-secondary/40 text-secondary hover:bg-secondary/10`}
                        title="이번 달 다가오는 모든 예배/연습 섬김 명단을 카카오톡 단톡방용으로 전체 복사합니다"
                        onClick={() => void handleCopyMonthly()}
                    >
                        {copiedMonthly ? (
                            <>
                                <Check size={14} className="text-emerald-600" />
                                <span className="text-emerald-600 font-bold">전체 사역표 복사됨!</span>
                            </>
                        ) : (
                            <>
                                <ClipboardCopy size={14} />
                                <span>📋 이번 달 사역표 카톡 전체 복사</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <>
                    <div role="group" aria-label="일정 기간 필터" className="flex flex-wrap gap-2">
                        {([
                            ['upcoming', '예정·진행 중'],
                            ['my', '내 배정 일정'],
                            ['vacant', '빈자리 필요'],
                            ['past', '지난 일정'],
                            ['all', '전체']
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={filter === value}
                                className={filter === value ? primary : button}
                                onClick={() => { setFilter(value); setNow(Date.now()); }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 파트별 빠른 필터 칩 바 */}
                    <div role="group" aria-label="파트별 필터" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
                        <span className="text-muted-foreground font-semibold shrink-0">파트 필터:</span>
                        {([
                            ['all', '전체'],
                            ['leader', '인도자'],
                            ['vocal', '싱어'],
                            ['keyboard', '건반'],
                            ['guitar', '기타'],
                            ['bass', '베이스'],
                            ['drums', '드럼'],
                            ['sound', '음향'],
                            ['media', '미디어']
                        ] as const).map(([val, lbl]) => (
                            <button
                                key={val}
                                type="button"
                                className={`rounded-full px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                                    roleFilter === val
                                        ? 'bg-secondary text-secondary-foreground font-bold shadow-xs'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                                onClick={() => setRoleFilter(val)}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
        {viewMode === 'calendar' ? (
            <CalendarView
                events={state.events}
                members={members}
                names={names}
                userId={userId}
                manager={manager}
                onSelectEvent={(event) => setShareModalEvent(event)}
                onOpenMonthlySundaysModal={() => setMonthlySundaysModalOpen(true)}
                onAddEventOnDate={() => {
                    const detailsEl = document.querySelector('details summary');
                    if (detailsEl instanceof HTMLElement) {
                        detailsEl.click();
                    }
                }}
            />
        ) : (
            <>
                <p className="text-sm text-muted-foreground">{events.length}개 일정 · {filter === 'past' ? '최근 일정부터' : '시작 시간순'}</p>
                {events.length === 0 ? <p className={card}>이 조건에 해당하는 일정이 없습니다.</p> : null}
                <div className="space-y-4">{events.map((event, idx) => {
            const alerts = alertsByEvent.get(event.id) ?? [];
            const assignedCount = event.slots.filter(slot => slot.memberId).length;
            const vacantCount = event.slots.filter(slot => !slot.memberId || slot.attendance === 'absent').length;
            const confirmedCount = event.slots.filter(slot => slot.attendance === 'confirmed').length;
            const totalSlots = event.slots.length;
            const isUserAssigned = event.slots.some(slot => slot.memberId === userId);
            const relDate = getRelativeDateLabel(event.startsAt, now);

            return <article key={event.id} className={card} aria-label={event.title}>
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${relDate.cls}`}>
                                {relDate.text}
                            </span>
                            <span>{event.kind === 'rehearsal' ? '연습' : '예배'}</span>
                            {event.cancelled ? <span className="text-destructive">취소됨</span> : <span className="text-muted-foreground">{Date.parse(event.endsAt) < now ? '종료됨' : Date.parse(event.startsAt) <= now ? '진행 중' : '예정'}</span>}
                            {isUserAssigned ? <span className="rounded-full bg-secondary/15 text-secondary px-2 py-0.5 text-xs font-bold">내 사역</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className={`${button} text-xs py-1 px-2.5 min-h-8 flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-bold`}
                                title="일정 및 섬김 명단 공유 / 캘린더 등록 (.ics)"
                                onClick={() => setShareModalEvent(event)}
                            >
                                <Share2 size={13} />
                                <span>공유 & 캘린더</span>
                            </button>

                            <button
                                type="button"
                                className={`${button} text-xs py-1 px-2 min-h-8 flex items-center gap-1 text-muted-foreground`}
                                title="카카오톡 공유용 명단 빠른 복사"
                                onClick={() => void handleCopyKakao(event)}
                            >
                                {copiedEventId === event.id ? (
                                    <>
                                        <Check size={12} className="text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">복사됨!</span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCopy size={12} />
                                        <span>빠른 복사</span>
                                    </>
                                )}
                            </button>
                            {totalSlots > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-bold">
                                        배정 {assignedCount}/{totalSlots}명
                                    </span>
                                    {vacantCount > 0 ? (
                                        <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-bold">
                                            빈자리 {vacantCount}
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 font-bold">
                                            완료
                                        </span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <h3 className="break-words text-lg font-bold">{event.title}</h3>
                    <p className="text-sm"><time dateTime={event.startsAt}>{planningDate(event.startsAt)}</time><span> ~ </span><time dateTime={event.endsAt}>{planningDate(event.endsAt)}</time> (KST)</p>
                    <p className="break-words text-sm text-muted-foreground">장소: {event.location || '미정'}</p>
                    <p className="text-sm text-muted-foreground">배정 {assignedCount}/{totalSlots} · 참석 확정 {confirmedCount} · 불참 {event.slots.filter(s => s.attendance === 'absent').length}</p>

                    {/* 스마트 배분 / 리마인드 알람 / 초기화 빠른 바 */}
                    {manager && !event.cancelled && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/60">
                            {event.slots.some(s => s.memberId === null) && (
                                <button
                                    type="button"
                                    className={`${button} text-xs py-1 px-2.5 min-h-8 flex items-center gap-1 font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20`}
                                    disabled={actions.disabled}
                                    title="파트 일치 및 공평 밸런스(사역 적은 인원 우선)로 빈자리를 스마트하게 자동 배정합니다"
                                    onClick={() => void actions.send({ type: 'slots.autoAssign', eventId: event.id })}
                                >
                                    <Sparkles size={13} />
                                    <span>스마트 자동 배분</span>
                                </button>
                            )}

                            {event.slots.some(s => s.memberId && s.attendance === 'pending') && (
                                <button
                                    type="button"
                                    className={`${button} text-xs py-1 px-2.5 min-h-8 flex items-center gap-1 font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/20`}
                                    disabled={actions.disabled}
                                    title="참석 여부를 아직 확인하지 않은 팀원들에게 긴급 리마인드 알림을 보냅니다"
                                    onClick={() => void actions.send({ type: 'schedule.sendDutyReminder', eventId: event.id })}
                                >
                                    <Bell size={13} />
                                    <span>출석 리마인드 알람</span>
                                </button>
                            )}

                            {event.slots.some(s => s.memberId !== null) && (
                                <button
                                    type="button"
                                    className={`${button} text-xs py-1 px-2 min-h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
                                    disabled={actions.disabled}
                                    title="모든 슬롯의 배정을 비우고 빈자리로 초기화합니다"
                                    onClick={() => {
                                        if (window.confirm('이 일정의 모든 인원 배정을 초기화(빈자리)하시겠습니까?')) {
                                            void actions.send({ type: 'slots.clear', eventId: event.id });
                                        }
                                    }}
                                >
                                    배분 초기화
                                </button>
                            )}
                        </div>
                    )}
                </header>

                {/* 콘티 안내 및 당번 알림 블록 */}
                {event.setlistTitle ? (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Music size={16} className="text-primary shrink-0" />
                                <span className="font-bold text-sm text-foreground">{event.setlistTitle}</span>
                                {event.setlistSongs?.length ? (
                                    <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-semibold">
                                        {event.setlistSongs.length}곡
                                    </span>
                                ) : null}
                            </div>
                            {manager && !event.cancelled ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        className={`${button} text-xs py-1 px-2.5 min-h-7 bg-background shadow-2xs hover:bg-secondary/15`}
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
                                        <Bell size={12} className="text-secondary" />
                                        <span>당번에게 콘티 알림</span>
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        {event.setlistSongs?.length ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {event.setlistSongs.map((song, sIdx) => (
                                    <span key={sIdx} className="rounded-md border border-border/80 bg-background px-2 py-0.5 text-xs text-foreground font-medium">
                                        {sIdx + 1}. {song}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : manager && !event.cancelled ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Music size={14} /> 아직 등록된 콘티가 없습니다.
                        </span>
                        <details className="inline-block">
                            <summary className={`${button} text-xs py-1 px-2.5 min-h-7 cursor-pointer list-none font-semibold text-primary`}>
                                + 콘티 등록/연결
                            </summary>
                            <div className="mt-2 text-left">
                                <SetlistForm {...actions} event={event} />
                            </div>
                        </details>
                    </div>
                ) : null}

                <details className="mt-3" open={idx === 0 && (filter === 'upcoming' || filter === 'my')}>
                    <summary className={disclosure}>일정 상세·참석·배정 보기{alerts.some(alert => !alert.resolvedAt) ? ' · 긴급 알림 있음' : ''}</summary>
                    <div className="space-y-5 pt-3">
                        {event.cancelled ? <p className="rounded-xl bg-muted p-3 text-sm font-semibold">취소된 일정입니다. 배정과 알림은 기록으로만 확인할 수 있습니다.</p> : null}

                        {/* 인도자 알림 · 당번 공지 발송 블록 (인도자 전용) */}
                        {manager && !event.cancelled ? (
                            <details className="rounded-xl border border-secondary/40 bg-secondary/5 p-3.5">
                                <summary className={`${disclosure} flex items-center justify-between text-secondary font-bold text-sm`}>
                                    <span className="flex items-center gap-2">
                                        <Send size={15} /> 인도자 알림 · 당번 공지 보내기
                                    </span>
                                    <span className="text-xs font-normal text-muted-foreground">펼치기</span>
                                </summary>
                                <div className="pt-2">
                                    <DutyNoticeForm {...actions} event={event} members={members} />
                                </div>
                            </details>
                        ) : null}

                        <section aria-label="일정 안내" className="space-y-2"><h4 className="font-semibold">안내 사항</h4><p className="whitespace-pre-wrap break-words text-sm">{event.notes || '등록된 안내 사항이 없습니다.'}</p></section>
                        <section aria-label="일정별 긴급 알림" className="space-y-3">
                            <h4 className="font-semibold">이 일정의 알림 · 해결 기록</h4>
                            {alerts.length ? <ul className="space-y-3">{alerts.map(alert => <AlertCard key={alert.id} {...actions} alert={alert} event={event} names={names} manager={manager} />)}</ul> : <p className="text-sm text-muted-foreground">등록된 알림이 없습니다.</p>}
                        </section>
                        <section aria-label="역할 배정과 참석" className="space-y-3">
                            <h4 className="font-semibold">역할 배정·참석</h4>
                            {event.slots.length ? <ul className="space-y-3">{event.slots.map(slot => <SlotCard key={slot.id} {...actions} slot={slot} event={event} alerts={alerts} members={members} names={names} userId={userId} manager={manager} allEvents={state.events} workloadMap={workloadMap} />)}</ul> : <p className="text-sm text-muted-foreground">아직 등록된 역할이 없습니다.</p>}
                        </section>
                        {manager ? <details className="rounded-xl border border-border p-3">
                            <summary className={disclosure}>일정 관리 (역할 템플릿 · 배정 복사 · 삭제)</summary>
                            <div className="space-y-4 pt-3">
                                {!event.cancelled && (
                                    <>
                                        <details><summary className={disclosure}>콘티 정보 수정 및 당번 알림</summary><SetlistForm {...actions} event={event} /></details>
                                        <details><summary className={disclosure}>일정 수정</summary><EventForm key={JSON.stringify([event.title,event.kind,event.startsAt,event.endsAt,event.location,event.notes])} {...actions} event={event} /></details>
                                        <details><summary className={disclosure}>역할·담당자 1명 추가</summary><SlotForm {...actions} eventId={event.id} members={members} /></details>
                                        <details><summary className={disclosure}>역할 템플릿 일괄 추가 (표준 밴드, 풀 세션 등)</summary><TemplateForm {...actions} eventId={event.id} /></details>
                                        <details><summary className={disclosure}>이전 일정에서 배정 복사해오기</summary><CopyRosterForm {...actions} eventId={event.id} otherEvents={state.events} /></details>
                                        <details><summary className={disclosure}>일정 전체 긴급 공지</summary><AlertForm {...actions} eventId={event.id} slotId={null} /></details>
                                        <ConfirmAction {...actions} label="일정 취소" explanation="이 일정을 취소하면 참석 응답, 배정 변경, 지원 및 알림 처리를 할 수 없습니다. 취소하시겠습니까?" command={{ type: 'event.cancel', eventId: event.id }} />
                                    </>
                                )}
                                <ConfirmAction {...actions} label="일정 영구 삭제" explanation="이 일정을 목록에서 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다. 삭제하시겠습니까?" command={{ type: 'event.delete', eventId: event.id }} />
                            </div>
                        </details> : null}
                    </div>
                </details>
            </article>;
        })}</div>
            </>
        )}

        {/* 일정 공유 및 캘린더 등록 모달 */}
        {shareModalEvent && (
            <EventShareModal
                event={shareModalEvent}
                names={names}
                onClose={() => setShareModalEvent(null)}
            />
        )}

        {/* 이번 달 주일예배 일괄 생성 모달 */}
        {monthlySundaysModalOpen && (
            <MonthlySundaysModal
                disabled={actions.disabled}
                onSend={actions.send}
                onClose={() => setMonthlySundaysModalOpen(false)}
            />
        )}
    </section>;
}
