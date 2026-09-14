'use client';

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { canManagePlanning, planningDate, scheduleTemplates, type PlanningCommand, type PlanningPanelProps, type ScheduleSlot, type ScheduleTemplateKey, type TeamSchedule, type UrgentAlert } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';

const control = 'min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground`;
const disclosure = 'min-h-12 cursor-pointer rounded-lg px-2 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-ring';
const card = 'min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5';
const attendanceLabels = { pending: '응답 대기', confirmed: '참석 확정', absent: '불참' };
const alertLabels = { absence: '불참 알림', substitute: '대체 인원 요청', notice: '긴급 공지' };
type Send = PlanningPanelProps['onCommand'];
type Actions = { send: Send; disabled: boolean };

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
    const validOthers = otherEvents.filter(e => e.id !== eventId && e.slots.length > 0);
    const [sourceId, setSourceId] = useState(validOthers[0]?.id ?? '');
    if (validOthers.length === 0) return <p className="text-sm text-muted-foreground">배정을 복사해올 수 있는 이전 일정이 없습니다.</p>;
    return <CommandForm {...actions} submitLabel="이전 배정 복사해오기" build={() => {
        if (!sourceId) throw new Error('복사할 원본 일정을 선택해 주세요.');
        return { type: 'slots.copyFromEvent', targetEventId: eventId, sourceEventId: sourceId };
    }}>
        <Field label="복사해올 원본 일정">
            <select className={control} value={sourceId} onChange={e => setSourceId(e.target.value)}>
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
            <span>{alertLabels[alert.kind]}</span>
            <span className={alert.resolvedAt ? 'text-muted-foreground' : 'text-destructive'}>{alert.resolvedAt ? '해결됨' : '미해결'}</span>
            {event?.cancelled ? <span className="text-destructive">취소된 일정</span> : null}
        </div>
        <p className="text-sm font-medium">{event?.title ?? '삭제되었거나 확인할 수 없는 일정'}{slot ? ` · ${worshipRoles[slot.role]}` : alert.slotId ? ' · 이전 배정' : ' · 일정 전체'}</p>
        <p className="whitespace-pre-wrap break-words">{alert.body}</p>
        <p className="text-sm text-muted-foreground">작성: {names.get(alert.authorId) ?? '이전 팀원'} · <time dateTime={alert.createdAt}>{planningDate(alert.createdAt)}</time></p>
        {alert.resolvedAt ? <p className="text-sm text-muted-foreground">해결: <time dateTime={alert.resolvedAt}>{planningDate(alert.resolvedAt)}</time></p> : null}
        {manager && event && !event.cancelled && !alert.resolvedAt ? <button type="button" className={button} disabled={actions.disabled} onClick={() => void actions.send({ type: 'alert.resolve', alertId: alert.id })}>해결 완료 처리</button> : null}
    </li>;
}

function SlotCard({ slot, event, alerts, members, names, userId, manager, ...actions }: Actions & {
    slot: ScheduleSlot; event: TeamSchedule; alerts: UrgentAlert[]; members: TeamMember[];
    names: Map<string, string>; userId: string; manager: boolean;
}) {
    const assigned = slot.memberId === userId;
    const needsHelp = !slot.memberId || slot.attendance === 'absent' || alerts.some(alert => alert.slotId === slot.id && alert.kind === 'substitute' && !alert.resolvedAt);
    const volunteered = slot.volunteers.includes(userId);
    return <li className="space-y-3 rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">{worshipRoles[slot.role]} · {slot.memberId ? names.get(slot.memberId) ?? '이전 팀원' : '미배정 (빈자리)'}</h4>
            <span className={`rounded-full bg-muted px-3 py-1 text-sm ${slot.attendance === 'absent' ? 'text-destructive' : 'text-muted-foreground'}`}>{attendanceLabels[slot.attendance]}</span>
        </div>
        {!event.cancelled && assigned ? <details>
            <summary className={disclosure}>내 참석 응답</summary>
            <CommandForm {...actions} submitLabel="참석 응답 저장" build={data => ({ type: 'attendance.set', eventId: event.id, slotId: slot.id, attendance: text(data, 'attendance') as 'confirmed' | 'absent', reason: text(data, 'reason') })}>
                <Field label="참석 여부 (필수)"><select name="attendance" required defaultValue="" className={control}>
                    <option value="" disabled>선택해 주세요</option><option value="confirmed">참석 확정</option><option value="absent">불참</option>
                </select></Field>
                <Field label="사유 (선택)"><textarea name="reason" rows={2} className={control} /></Field>
                <p className="text-sm text-muted-foreground">불참으로 저장하면 긴급 알림이 자동으로 등록됩니다.</p>
            </CommandForm>
        </details> : null}
        {!event.cancelled && (manager || assigned) ? <details>
            <summary className={disclosure}>{slot.memberId ? '대체 인원 요청' : '빈자리 충원 요청'}</summary>
            <AlertForm {...actions} eventId={event.id} slotId={slot.id} />
        </details> : null}
        {!event.cancelled && !assigned && needsHelp && members.some(member => member.userId === userId) ? <div className="space-y-2">
            <p className="text-sm text-muted-foreground">지원 후 관리자가 담당자를 확정합니다.</p>
            <button type="button" className={button} disabled={actions.disabled || volunteered} onClick={() => void actions.send({ type: 'slot.volunteer', eventId: event.id, slotId: slot.id })}>{volunteered ? '지원 완료 · 확정 대기' : '이 역할에 지원하기'}</button>
        </div> : null}
        {slot.volunteers.length > 0 ? <div className="space-y-2">
            <p className="text-sm font-semibold">지원자 {slot.volunteers.length}명</p>
            <ul className="space-y-2">{slot.volunteers.map(memberId => <li key={memberId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{names.get(memberId) ?? '이전 팀원'}{memberId === userId ? ' (나)' : ''}</span>
                {manager && !event.cancelled ? <button type="button" className={button} disabled={actions.disabled || !names.has(memberId)} aria-label={`${names.get(memberId) ?? '이전 팀원'} 님을 ${worshipRoles[slot.role]} 담당자로 확정`} onClick={() => void actions.send({ type: 'slot.accept', eventId: event.id, slotId: slot.id, memberId })}>담당자로 확정</button> : null}
            </li>)}</ul>
        </div> : null}
        {manager && !event.cancelled ? <details>
            <summary className={disclosure}>배정 관리</summary>
            <div className="space-y-4">
                <SlotForm key={`${slot.memberId ?? 'vacant'}:${slot.role}`} {...actions} eventId={event.id} slot={slot} members={members} />
                <ConfirmAction {...actions} label="배정 삭제" explanation="이 역할의 배정과 참석 응답을 삭제합니다." command={{ type: 'slot.remove', eventId: event.id, slotId: slot.id }} />
            </div>
        </details> : null}
    </li>;
}

export default function SchedulePanel({ state, members, userId, busy, onCommand }: PlanningPanelProps) {
    const headingId = useId();
    const [filter, setFilter] = useState<'upcoming' | 'my' | 'vacant' | 'past' | 'all'>('upcoming');
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
    const events = state.events.filter(event => {
        if (filter === 'all') return true;
        if (filter === 'past') return Date.parse(event.endsAt) < now;
        if (filter === 'my') {
            return Date.parse(event.endsAt) >= now && event.slots.some(s => s.memberId === userId);
        }
        if (filter === 'vacant') {
            return Date.parse(event.endsAt) >= now && (!event.slots.length || event.slots.some(s => !s.memberId || s.attendance === 'absent'));
        }
        return Date.parse(event.endsAt) >= now;
    }).sort((a, b) => filter === 'past' ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt));
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

    return <section aria-labelledby={headingId} className="min-w-0 space-y-5">
        <header className="space-y-1">
            <h2 id={headingId} className="text-xl font-bold">연습·예배 일정</h2>
            <p className="text-sm text-muted-foreground">일정을 펼쳐 배정과 참석 여부를 확인하세요. 시간은 모두 한국 시간입니다.</p>
        </header>
        <div role="status" aria-live="polite" aria-atomic="true" className="text-sm">
            {busy || pending ? '처리 중…' : feedback && !feedback.error ? feedback.text : ''}
        </div>
        {feedback?.error ? <p role="alert" className="text-sm text-destructive">{feedback.text}</p> : null}
        <section aria-label="미해결 긴급 알림" className={`${card} space-y-3 border-destructive/50`}>
            <h3 className="font-bold">긴급 알림 <span className="text-destructive">{openAlerts.length}</span></h3>
            {openAlerts.length ? <ul className="space-y-3">{openAlerts.map(alert => <AlertCard key={alert.id} {...actions} alert={alert} event={eventMap.get(alert.eventId)} names={names} manager={manager} />)}</ul> : <p className="text-sm text-muted-foreground">미해결 긴급 알림이 없습니다.</p>}
        </section>
        {manager ? <details className={card}>
            <summary className={disclosure}>새 일정 만들기 (정기 반복 지원)</summary>
            <div className="pt-3"><EventForm {...actions} /></div>
        </details> : null}
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
        <p className="text-sm text-muted-foreground">{events.length}개 일정 · {filter === 'past' ? '최근 일정부터' : '시작 시간순'}</p>
        {events.length === 0 ? <p className={card}>이 조건에 해당하는 일정이 없습니다.</p> : null}
        <div className="space-y-4">{events.map(event => {
            const alerts = alertsByEvent.get(event.id) ?? [];
            const assignedCount = event.slots.filter(slot => slot.memberId).length;
            const vacantCount = event.slots.filter(slot => !slot.memberId || slot.attendance === 'absent').length;
            const confirmedCount = event.slots.filter(slot => slot.attendance === 'confirmed').length;
            const totalSlots = event.slots.length;
            const isUserAssigned = event.slots.some(slot => slot.memberId === userId);

            return <article key={event.id} className={card} aria-label={event.title}>
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2 text-sm font-semibold">
                            <span>{event.kind === 'rehearsal' ? '연습' : '예배'}</span>
                            {event.cancelled ? <span className="text-destructive">취소됨</span> : <span className="text-muted-foreground">{Date.parse(event.endsAt) < now ? '종료됨' : Date.parse(event.startsAt) <= now ? '진행 중' : '예정'}</span>}
                            {isUserAssigned ? <span className="rounded-full bg-secondary/15 text-secondary px-2 py-0.5 text-xs font-bold">내 사역</span> : null}
                        </div>
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
                    <h3 className="break-words text-lg font-bold">{event.title}</h3>
                    <p className="text-sm"><time dateTime={event.startsAt}>{planningDate(event.startsAt)}</time><span> ~ </span><time dateTime={event.endsAt}>{planningDate(event.endsAt)}</time> (KST)</p>
                    <p className="break-words text-sm text-muted-foreground">장소: {event.location || '미정'}</p>
                    <p className="text-sm text-muted-foreground">배정 {assignedCount}/{totalSlots} · 참석 확정 {confirmedCount} · 불참 {event.slots.filter(s => s.attendance === 'absent').length}</p>
                </header>
                <details className="mt-3">
                    <summary className={disclosure}>일정 상세·참석·배정 보기{alerts.some(alert => !alert.resolvedAt) ? ' · 긴급 알림 있음' : ''}</summary>
                    <div className="space-y-5 pt-3">
                        {event.cancelled ? <p className="rounded-xl bg-muted p-3 text-sm font-semibold">취소된 일정입니다. 배정과 알림은 기록으로만 확인할 수 있습니다.</p> : null}
                        <section aria-label="일정 안내" className="space-y-2"><h4 className="font-semibold">안내 사항</h4><p className="whitespace-pre-wrap break-words text-sm">{event.notes || '등록된 안내 사항이 없습니다.'}</p></section>
                        <section aria-label="일정별 긴급 알림" className="space-y-3">
                            <h4 className="font-semibold">이 일정의 알림 · 해결 기록</h4>
                            {alerts.length ? <ul className="space-y-3">{alerts.map(alert => <AlertCard key={alert.id} {...actions} alert={alert} event={event} names={names} manager={manager} />)}</ul> : <p className="text-sm text-muted-foreground">등록된 알림이 없습니다.</p>}
                        </section>
                        <section aria-label="역할 배정과 참석" className="space-y-3">
                            <h4 className="font-semibold">역할 배정·참석</h4>
                            {event.slots.length ? <ul className="space-y-3">{event.slots.map(slot => <SlotCard key={slot.id} {...actions} slot={slot} event={event} alerts={alerts} members={members} names={names} userId={userId} manager={manager} />)}</ul> : <p className="text-sm text-muted-foreground">아직 등록된 역할이 없습니다.</p>}
                        </section>
                        {manager && !event.cancelled ? <details className="rounded-xl border border-border p-3">
                            <summary className={disclosure}>일정 관리 (역할 템플릿 · 배정 복사)</summary>
                            <div className="space-y-4 pt-3">
                                <details><summary className={disclosure}>일정 수정</summary><EventForm key={JSON.stringify([event.title,event.kind,event.startsAt,event.endsAt,event.location,event.notes])} {...actions} event={event} /></details>
                                <details><summary className={disclosure}>역할·담당자 1명 추가</summary><SlotForm {...actions} eventId={event.id} members={members} /></details>
                                <details><summary className={disclosure}>역할 템플릿 일괄 추가 (표준 밴드, 풀 세션 등)</summary><TemplateForm {...actions} eventId={event.id} /></details>
                                <details><summary className={disclosure}>이전 일정에서 배정 복사해오기</summary><CopyRosterForm {...actions} eventId={event.id} otherEvents={state.events} /></details>
                                <details><summary className={disclosure}>일정 전체 긴급 공지</summary><AlertForm {...actions} eventId={event.id} slotId={null} /></details>
                                <ConfirmAction {...actions} label="일정 취소" explanation="이 일정을 취소하면 참석 응답, 배정 변경, 지원 및 알림 처리를 할 수 없습니다. 취소하시겠습니까?" command={{ type: 'event.cancel', eventId: event.id }} />
                            </div>
                        </details> : null}
                    </div>
                </details>
            </article>;
        })}</div>
    </section>;
}
