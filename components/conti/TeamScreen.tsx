'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, ListMusic, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dayOf, md, monthOf, shortWeekLabel, weekDates, weekday } from './model';
import { useConti } from './context';
import { pickServices, type PartAssignment, type ServiceDay } from './planningBridge';
import { AbsenceReasons, EVENT_KIND, PlanningError, ROLE_ICON, pill, pillOn, useDispatch } from './planningUi';
import { AddButton, Avatar, AvatarStack, Eyebrow, SampleChip, ScreenTitle, SectionTitle, TONE_BLOCK, chip, ink, line, selected, sub } from './ui';

const STATUS_TEXT = {
    confirmed: { label: '참석 확정', className: 'text-emerald-600 dark:text-emerald-400' },
    pending: { label: '응답 대기', className: 'text-amber-600 dark:text-amber-400' },
    declined: { label: '불참', className: 'text-rose-600 dark:text-rose-400' },
} as const;

export default function TeamScreen({ openOrder }: { openOrder: (id: string) => void }) {
    const { today, planning, setlists } = useConti();
    const services = pickServices(planning.services, today);
    const defaultId = services.find((service) => service.date >= today)?.eventId ?? services[services.length - 1]?.eventId ?? '';
    const [picked, setPicked] = useState<string | null>(null);
    const service = services.find((item) => item.eventId === picked) ?? services.find((item) => item.eventId === defaultId) ?? null;
    const sample = planning.sample ? <SampleChip className="ml-1" /> : null;
    const manageHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=schedule` : `${planning.planningHref}?tab=schedule`;

    return (
        <div className="space-y-7">
            <ScreenTitle eyebrow={<>팀 {sample}</>} title="악기 담당 · 일정" aside={<AddButton label="일정·배치 관리 (일정·요청 화면)" href={manageHref} />} />
            <PlanningError />

            {!planning.ready ? (
                <p className={cn('py-10 text-center text-sm', sub)}>팀 배치를 불러오는 중…</p>
            ) : !services.length ? (
                <div className={cn('rounded-3xl border border-dashed px-5 py-8 text-center', 'border-neutral-300 dark:border-neutral-700')}>
                    <p className={cn('text-[15px] font-medium', ink)}>아직 예배 일정이 없어요</p>
                    <p className={cn('mt-1 text-xs', sub)}>일정·요청 화면에서 예배 일정과 역할을 만들면 여기에 보여요</p>
                    <Link href={manageHref} className={cn('mt-4 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold', selected)}>
                        <Plus size={15} aria-hidden="true" />
                        일정 만들기
                    </Link>
                </div>
            ) : (
                <>
                    <div className={cn('grid gap-1 rounded-2xl border p-1.5', line)} style={{ gridTemplateColumns: `repeat(${services.length}, minmax(0, 1fr))` }} role="tablist" aria-label="예배 선택">
                        {services.map((item) => {
                            const active = item.eventId === service?.eventId;
                            return (
                                <button
                                    key={item.eventId}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setPicked(item.eventId)}
                                    className={cn('flex min-w-0 flex-col items-center rounded-xl px-1 py-2 transition', active ? selected : ink)}
                                >
                                    <span className={cn('max-w-full truncate text-[10px]', active ? 'opacity-70' : sub)}>
                                        {monthOf(item.date)}월 {shortWeekLabel(item.date)}
                                    </span>
                                    <span className="mt-0.5 text-sm font-semibold tabular-nums">
                                        {md(item.date)} <span className="font-normal opacity-70">{weekday(item.date)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {service && <ServiceSection service={service} openOrder={setlists.some((item) => item.id === service.setlistId) ? openOrder : null} />}
                </>
            )}

            {planning.ready && <WeekEvents date={service?.date ?? today} />}
        </div>
    );
}

function ServiceSection({ service, openOrder }: { service: ServiceDay; openOrder: ((id: string) => void) | null }) {
    const { counts } = service;
    return (
        <>
            <section aria-label="배치 현황" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={cn('text-[15px]', ink)}>
                            <span className="font-semibold tabular-nums">{counts.total}자리</span> 중 <span className="font-semibold tabular-nums">{counts.confirmed}명</span> 확정
                        </p>
                        <p className={cn('mt-0.5 text-xs', sub)}>
                            {service.title} · {service.time}
                            {service.place ? ` · ${service.place}` : ''}
                        </p>
                    </div>
                    {service.setlistId && openOrder && (
                        <button type="button" onClick={() => openOrder(service.setlistId!)} className={cn(pill, 'shrink-0')}>
                            <ListMusic size={13} aria-hidden="true" />
                            콘티 보기
                        </button>
                    )}
                </div>
                {counts.total > 0 && (
                    <>
                        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`확정 ${counts.confirmed}, 대기 ${counts.pending}, 불참 ${counts.declined}, 빈자리 ${counts.vacant}`}>
                            {service.assignments.map((item) => (
                                <span
                                    key={item.slotId}
                                    className={cn(
                                        'flex-1',
                                        item.status === null && 'bg-neutral-200 dark:bg-neutral-700',
                                        item.status === 'confirmed' && 'bg-emerald-500',
                                        item.status === 'pending' && 'bg-amber-400',
                                        item.status === 'declined' && 'bg-rose-400',
                                    )}
                                />
                            ))}
                        </div>
                        <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums', sub)}>
                            <Dot className="bg-emerald-500" label={`확정 ${counts.confirmed}`} />
                            <Dot className="bg-amber-400" label={`대기 ${counts.pending}`} />
                            <Dot className="bg-rose-400" label={`불참 ${counts.declined}`} />
                            <Dot className="bg-neutral-300 dark:bg-neutral-600" label={`빈자리 ${counts.vacant}`} />
                        </p>
                    </>
                )}
            </section>

            <section aria-label="악기 담당">
                <SectionTitle title="악기 담당" meta={`${md(service.date)} ${weekday(service.date)}`} />
                {service.assignments.length ? (
                    <ul className="mt-1">
                        {service.assignments.map((item) => (
                            <AssignmentRow key={item.slotId} service={service} item={item} />
                        ))}
                    </ul>
                ) : (
                    <p className={cn('py-6 text-sm', sub)}>아직 역할이 없어요. 일정·요청 화면에서 역할 템플릿을 적용해 보세요.</p>
                )}
            </section>
        </>
    );
}

export function AssignmentRow({ service, item }: { service: ServiceDay; item: PartAssignment }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const [mode, setMode] = useState<'idle' | 'decline' | 'assign'>('idle');
    const [assignee, setAssignee] = useState('');
    const viewer = planning.viewer;
    const manager = Boolean(viewer?.canManage);
    const Icon = ROLE_ICON[item.role];
    const status = item.status ? STATUS_TEXT[item.status] : null;
    const eventId = service.eventId;
    const { volunteered, canVolunteer } = item;
    const roleMatches = planning.roster.filter((member) => member.role === item.role);
    const candidates = [...roleMatches, ...planning.roster.filter((member) => member.role !== item.role)];

    async function run(command: Parameters<typeof send>[0]) {
        const ok = await send(command);
        if (ok) setMode('idle');
    }

    return (
        <li className={cn('border-b py-3.5 last:border-b-0', line)}>
            <div className="flex items-center gap-3.5">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', chip, ink)}>
                    <Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className={cn('text-[15px] font-medium', ink)}>
                        {item.roleLabel}
                        {item.mine && <span className={cn('ml-1.5 text-[11px] font-semibold', 'text-primary')}>나</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs">
                        {status ? <span className={status.className}>{status.label}</span> : <span className={sub}>빈자리</span>}
                        {item.note && <span className={sub}> · {item.note}</span>}
                        {item.substituteOpen && <span className="text-orange-600 dark:text-orange-300"> · 대체 모집 중</span>}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {item.memberName ? (
                        <span className={cn('inline-flex items-center gap-1.5', item.status === 'declined' && 'opacity-50')}>
                            <Avatar name={item.memberName} size="sm" />
                            <span className={cn('text-[13px]', ink, item.status === 'declined' && 'line-through')}>{item.memberName}</span>
                        </span>
                    ) : (
                        <span className={cn('text-xs', sub)}>미정</span>
                    )}
                </div>
            </div>

            {(item.volunteers.length > 0 || item.mine || manager || canVolunteer) && (
                <div className="mt-2.5 space-y-2 pl-[3.375rem]">
                    {item.volunteers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('text-[11px] font-medium', sub)}>대체 지원 {item.volunteers.length}명</span>
                            {item.volunteers.map((person) => (
                                <span key={person.id} className="inline-flex items-center gap-1.5">
                                    <Avatar name={person.name} size="xs" />
                                    <span className={cn('text-xs', ink)}>{person.name}</span>
                                    {manager && (
                                        <button
                                            type="button"
                                            disabled={busy || !person.member}
                                            title={person.member ? undefined : '팀을 나간 사람은 확정할 수 없어요'}
                                            onClick={() => run({ type: 'slot.accept', eventId, slotId: item.slotId, memberId: person.id })}
                                            className={pillOn}
                                        >
                                            담당자로 확정
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}

                    {mode === 'decline' ? (
                        <AbsenceReasons busy={busy} onCancel={() => setMode('idle')} onPick={(reason) => run({ type: 'attendance.set', eventId, slotId: item.slotId, attendance: 'absent', reason, autoRequestSubstitute: true })} />
                    ) : mode === 'assign' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <select
                                aria-label={`${item.roleLabel} 담당 선택`}
                                value={assignee}
                                onChange={(event) => setAssignee(event.target.value)}
                                className={cn('h-8 max-w-44 rounded-full border bg-transparent px-3 text-xs', line, ink)}
                            >
                                <option value="">팀원 선택</option>
                                {candidates.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                        {member.role === item.role ? '' : ` (${planning.roster.find((row) => row.id === member.id)?.role === 'member' ? '미정' : '다른 파트'})`}
                                    </option>
                                ))}
                            </select>
                            <button type="button" disabled={busy || !assignee} onClick={() => run({ type: 'slot.save', eventId, slotId: item.slotId, role: item.role, memberId: assignee })} className={pillOn}>
                                <Check size={13} aria-hidden="true" />
                                배정
                            </button>
                            <button type="button" onClick={() => setMode('idle')} className={cn('h-8 px-2 text-xs', sub)}>
                                취소
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {item.mine && item.status === 'pending' && (
                                <>
                                    <button type="button" disabled={busy} onClick={() => run({ type: 'attendance.set', eventId, slotId: item.slotId, attendance: 'confirmed', reason: '' })} className={pillOn}>
                                        <Check size={13} aria-hidden="true" />
                                        참석 확정
                                    </button>
                                    <button type="button" disabled={busy} onClick={() => setMode('decline')} className={pill}>
                                        불참
                                    </button>
                                </>
                            )}
                            {item.mine && item.status === 'confirmed' && (
                                <button type="button" disabled={busy} onClick={() => setMode('decline')} className={pill}>
                                    참석 변경
                                </button>
                            )}
                            {item.mine && item.status === 'declined' && (
                                <button type="button" disabled={busy} onClick={() => run({ type: 'attendance.set', eventId, slotId: item.slotId, attendance: 'confirmed', reason: '' })} className={pill}>
                                    참석으로 변경
                                </button>
                            )}
                            {manager && !item.mine && item.status === 'pending' && (
                                <button type="button" disabled={busy} onClick={() => run({ type: 'slot.sendInvite', eventId, slotId: item.slotId })} className={cn(pill, 'text-amber-700 dark:text-amber-200', TONE_BLOCK.sand, 'border-transparent')}>
                                    {item.invitedAt ? '초대 재발송' : '초대 알림'}
                                </button>
                            )}
                            {manager && item.status === 'declined' && !item.substituteOpen && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => run({ type: 'alert.create', eventId, slotId: item.slotId, kind: 'substitute', body: `${item.roleLabel} 대체 인원을 구합니다` })}
                                    className={cn(pill, 'border-transparent text-orange-700 dark:text-orange-200', TONE_BLOCK.peach)}
                                >
                                    대체 인원 요청
                                </button>
                            )}
                            {manager && item.status === null && (
                                <button type="button" disabled={busy} onClick={() => setMode('assign')} className={cn(pill, 'border-dashed')}>
                                    <Plus size={13} aria-hidden="true" />
                                    배정
                                </button>
                            )}
                            {canVolunteer && (
                                volunteered ? (
                                    <button type="button" disabled={busy} onClick={() => run({ type: 'slot.unvolunteer', eventId, slotId: item.slotId })} className={pill}>
                                        지원 취소
                                    </button>
                                ) : (
                                    <button type="button" disabled={busy} onClick={() => run({ type: 'slot.volunteer', eventId, slotId: item.slotId })} className={pillOn}>
                                        이 역할에 지원하기
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

export function WeekEvents({ date }: { date: string }) {
    const { planning } = useConti();
    const dates = weekDates(date);
    const events = planning.events.filter((event) => dates.includes(event.date));
    const manageHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=schedule` : `${planning.planningHref}?tab=schedule`;

    return (
        <section aria-label="이번 주 일정" className="space-y-3">
            <SectionTitle title="이번 주 일정" meta={`${md(dates[0])} - ${md(dates[6])}`} />
            {events.length ? (
                <ul className="space-y-2">
                    {events.map((event) => {
                        const kind = EVENT_KIND[event.kind];
                        return (
                            <li key={event.id} className={cn('flex items-center gap-3.5 rounded-2xl p-3', TONE_BLOCK[kind.tone])}>
                                <span className="flex w-10 shrink-0 flex-col items-center leading-none">
                                    <span className={cn('text-[11px]', sub)}>{weekday(event.date)}</span>
                                    <span className={cn('mt-1 text-lg font-semibold tabular-nums', ink)}>{dayOf(event.date)}</span>
                                </span>
                                <div className="min-w-0 flex-1">
                                    <Eyebrow>{kind.label}</Eyebrow>
                                    <p className={cn('truncate text-sm font-medium', ink)}>{event.title}</p>
                                    <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                                        {event.start} - {event.end}
                                        {event.place ? ` · ${event.place}` : ''}
                                    </p>
                                </div>
                                <span className="flex flex-col items-end gap-1">
                                    {event.attendees.length > 0 && <AvatarStack names={event.attendees} max={2} size="xs" />}
                                    <span className={cn('text-[11px] tabular-nums', sub)}>
                                        {event.expected ? `${event.attendees.length}/${event.expected}` : '인원 미정'}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <Link href={manageHref} className={cn('flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed text-sm', 'border-neutral-300 dark:border-neutral-600', sub)}>
                    <ExternalLink size={15} aria-hidden="true" />
                    일정·요청 화면에서 연습 일정 추가
                </Link>
            )}
        </section>
    );
}

function Dot({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', className)} aria-hidden="true" />
            {label}
        </span>
    );
}
