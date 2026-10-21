'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Hand, Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { leadParts, partOfRole, type LeadPart } from '@/types/planning';
import { dayOf, md, monthOf, weekday } from './model';
import { useConti } from './context';
import type { Notice, PartAssignment, ServiceDay } from './planningBridge';
import { pill, pillOn, useDispatch } from './planningUi';
import { AssignmentRow } from './TeamScreen';
import { Avatar, body, chip, ink, line, sub } from './ui';

/** 휴대폰은 아래에서 올라오는 시트, 넓은 화면은 가운데 창 */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeRef.current();
        };
        document.addEventListener('keydown', onKey);
        panelRef.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-neutral-900/40 animate-in fade-in duration-150 dark:bg-black/60" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className="relative flex max-h-[88%] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] outline-none animate-in slide-in-from-bottom-6 duration-200 dark:bg-neutral-900 sm:max-w-md sm:rounded-[1.75rem]"
            >
                <span aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 sm:hidden" />
                <button type="button" aria-label="닫기" onClick={onClose} className={cn('absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full', chip, body)}>
                    <X size={16} aria-hidden="true" />
                </button>
                <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:pt-5">{children}</div>
            </div>
        </div>
    );
}

function headlineOf(item: PartAssignment): { text: string; className: string } {
    if (item.status === 'declined') return { text: '결석 · 대체 인원이 필요해요', className: 'text-rose-700 dark:text-rose-300' };
    if (item.status === null) return { text: item.substituteOpen ? '빈자리 · 대체 모집 중' : '빈자리', className: 'text-orange-700 dark:text-orange-300' };
    if (item.status === 'pending') return { text: '응답 대기', className: 'text-amber-700 dark:text-amber-300' };
    return { text: '참석 확정', className: 'text-emerald-700 dark:text-emerald-300' };
}

/**
 * 자리 하나의 상세: 모바일 목록과 같은 배치 조작에 더해
 * 알림이 간 사람, 대체 부탁 현황, 같은 역할의 다른 팀원, 팀 전체 요청을 보여줍니다.
 */
export function SlotDetail({ service, item, label }: { service: ServiceDay; item: PartAssignment; label: string }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const manager = Boolean(planning.viewer?.canManage);
    const needsSub = item.status === null || item.status === 'declined';
    const headline = headlineOf(item);

    return (
        <div className="space-y-4">
            <div className="pr-10">
                <p className={cn('text-[11px] font-semibold', headline.className)}>{headline.text}</p>
                <h2 className={cn('mt-0.5 text-lg font-semibold tracking-tight', ink)}>
                    {md(service.date)} {weekday(service.date)} · {label}
                </h2>
                <p className={cn('mt-0.5 text-xs', sub)}>
                    {service.title} · {service.time}
                    {service.place ? ` · ${service.place}` : ''}
                </p>
            </div>

            <ul>
                <AssignmentRow key={`${service.eventId}:${item.slotId}`} service={service} item={item} />
            </ul>

            {item.keepers.length > 0 && (
                <section aria-label="알림이 간 곳">
                    <p className={cn('text-xs font-semibold', body)}>알림이 간 곳</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.keepers.map((keeper) => (
                            <span key={keeper.id} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-xs', chip, ink)}>
                                <Avatar name={keeper.name} size="xs" />
                                {keeper.label} {keeper.name}
                            </span>
                        ))}
                        {item.asks.asked > 0 && (
                            <span className="inline-flex h-8 items-center rounded-full bg-orange-50 px-3 text-xs font-medium text-orange-800 dark:bg-orange-400/15 dark:text-orange-200">
                                {item.asks.asked}명에게 대체 부탁
                            </span>
                        )}
                    </div>
                    {item.asks.passedNames.length > 0 && <p className={cn('mt-2 text-xs', sub)}>어려워요 · {item.asks.passedNames.join(', ')}</p>}
                </section>
            )}

            {needsSub && item.options.length > 0 && (
                <section aria-label={`다른 ${item.roleLabel} 팀원`}>
                    <p className={cn('text-xs font-semibold', body)}>
                        다른 {item.roleLabel} 팀원 <span className={cn('font-normal', sub)}>설 수 있는 사람 · 덜 선 순서</span>
                    </p>
                    <ul className="mt-1">
                        {item.options.map((option) => (
                            <li key={option.id} className={cn('flex min-h-12 items-center gap-2.5 border-b last:border-b-0', line)}>
                                <Avatar name={option.name} className={cn(option.blocker && 'opacity-50')} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className={cn('truncate text-[13px] font-medium', option.blocker ? sub : ink)}>{option.name}</span>
                                    <span className={cn('text-[11px]', sub)}>{option.blocker ?? `지금까지 ${option.load}회 배치`}</span>
                                </span>
                                {!option.blocker && manager && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void send({ type: 'slot.save', eventId: service.eventId, slotId: item.slotId, role: item.role, memberId: option.id })}
                                        className={pill}
                                    >
                                        배정
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {needsSub && item.canHandle && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send({ type: 'slot.askAll', eventId: service.eventId, slotId: item.slotId })}
                    className={cn('flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border text-sm font-medium transition active:scale-[0.99] disabled:opacity-40', line, ink)}
                >
                    <Megaphone size={15} aria-hidden="true" />
                    팀 전체에 대체 요청 보내기
                </button>
            )}
        </div>
    );
}

/** 나에게 온 대체 부탁 (자리마다 하나). 팀 소식과 휴대폰 팀 배치 맨 위에 보여줍니다. */
export function AskCards() {
    const { planning } = useConti();
    const seen = new Set<string>();
    const asks = planning.notices.filter((notice) => {
        const ask = notice.ask;
        if (!ask?.open || seen.has(ask.slotId)) return false;
        seen.add(ask.slotId);
        return ask.canVolunteer || ask.volunteered || ask.passed;
    });
    if (!asks.length) return null;
    return (
        <div className="space-y-3">
            {asks.map((notice) => (
                <AskCard key={notice.ask!.slotId} notice={notice} />
            ))}
        </div>
    );
}

function AskCard({ notice }: { notice: Notice }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const ask = notice.ask!;
    const event = planning.events.find((item) => item.id === ask.eventId);
    const item = planning.services.find((service) => service.eventId === ask.eventId)?.assignments.find((assignment) => assignment.slotId === ask.slotId);
    const keepers = item?.keepers ?? [];

    async function act(command: Parameters<typeof send>[0]) {
        const ok = await send(command);
        if (ok && notice.unread) void send({ type: 'notification.read', notificationId: notice.id });
    }

    return (
        <article aria-label={`${ask.roleLabel} 대체 부탁`} className="rounded-3xl bg-orange-50 p-5 ring-1 ring-inset ring-orange-200 dark:bg-orange-400/10 dark:ring-orange-400/30">
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-orange-700 px-2.5 text-[11px] font-bold text-white">
                    <Hand size={11} aria-hidden="true" />
                    대체 부탁
                </span>
                <span className="text-[11px] text-orange-800 dark:text-orange-200">{notice.ago}</span>
            </div>
            <h2 className={cn('mt-3 text-xl font-bold tracking-tight', ink)}>{ask.roleLabel} 대체 가능하신가요?</h2>
            <dl className="mt-3 grid grid-cols-[3rem_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
                {event && (
                    <>
                        <dt className="text-orange-800 dark:text-orange-200">예배</dt>
                        <dd className={ink}>
                            {event.title}
                            {event.place ? ` · ${event.place}` : ''}
                        </dd>
                        <dt className="text-orange-800 dark:text-orange-200">일시</dt>
                        <dd className={cn('tabular-nums', ink)}>
                            {monthOf(event.date)}월 {dayOf(event.date)}일 ({weekday(event.date)}) {event.start}
                        </dd>
                    </>
                )}
                <dt className="text-orange-800 dark:text-orange-200">자리</dt>
                <dd className={ink}>
                    {ask.roleLabel}
                    {item?.memberName ? ` · ${item.memberName} 불참` : ' · 빈자리'}
                </dd>
                {item?.note && (
                    <>
                        <dt className="text-orange-800 dark:text-orange-200">사유</dt>
                        <dd className={ink}>{item.note}</dd>
                    </>
                )}
            </dl>
            {keepers.length > 0 && (
                <p className={cn('mt-3 rounded-2xl bg-white px-3.5 py-2.5 text-xs leading-relaxed dark:bg-neutral-900', body)}>
                    지원하면 {keepers.map((keeper) => `${keeper.label} ${keeper.name}`).join(', ')}님이 확정해요
                </p>
            )}

            {ask.volunteered ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
                        <Check size={15} aria-hidden="true" />
                        지원했어요 · 확정을 기다리는 중
                    </p>
                    <button type="button" disabled={busy} onClick={() => void act({ type: 'slot.unvolunteer', eventId: ask.eventId, slotId: ask.slotId })} className={pill}>
                        지원 취소
                    </button>
                </div>
            ) : ask.passed ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                    <p className={cn('text-[13px]', body)}>이번엔 어렵다고 답했어요</p>
                    {ask.canVolunteer && (
                        <button type="button" disabled={busy} onClick={() => void act({ type: 'slot.volunteer', eventId: ask.eventId, slotId: ask.slotId })} className={pillOn}>
                            그래도 지원하기
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-4 grid gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act({ type: 'slot.volunteer', eventId: ask.eventId, slotId: ask.slotId })}
                        className="h-12 rounded-2xl bg-neutral-900 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                    >
                        이 자리에 지원하기
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act({ type: 'slot.pass', eventId: ask.eventId, slotId: ask.slotId })}
                        className="h-11 rounded-2xl border border-orange-200 bg-white text-sm font-medium text-orange-900 transition active:scale-[0.99] disabled:opacity-40 dark:border-orange-400/30 dark:bg-neutral-900 dark:text-orange-100"
                    >
                        이번엔 어려워요
                    </button>
                </div>
            )}
        </article>
    );
}

const FLOW = [
    { title: '팀원이 불참 · 사유 선택', detail: '예: 기타 · 시험 기간', className: 'bg-rose-600' },
    { title: '그 예배 인도자 + 파트 담당에게 알림', detail: '악기 자리는 악기장, 보컬 자리는 싱어 담당', className: 'bg-primary' },
    { title: '같은 악기·파트 팀원에게 대체 부탁', detail: '이미 배치됐거나 불가일·겹치는 일정인 사람은 빼고 보내요', className: 'bg-orange-700' },
];

/** 파트 담당 요약. 인도자·관리자는 시트에서 악기장·싱어 담당을 한 번에 고릅니다. */
export function PartLeadsCard({ className }: { className?: string }) {
    const { planning } = useConti();
    const [open, setOpen] = useState(false);
    const manager = Boolean(planning.viewer?.canManage);
    if (!planning.partLeads.length) return null;
    const empty = planning.partLeads.every((group) => !group.members.length);

    return (
        <section aria-label="파트 담당" className={cn('rounded-3xl border p-5', line, className)}>
            <div className="flex items-center justify-between gap-2">
                <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>파트 담당</h2>
                {manager && (
                    <button type="button" onClick={() => setOpen(true)} className={pill}>
                        {empty ? '등록' : '변경'}
                    </button>
                )}
            </div>
            <ul className="mt-2">
                {planning.partLeads.map((group) => (
                    <li key={group.part} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b py-2.5 last:border-b-0 last:pb-0', line)}>
                        <span className={cn('w-16 shrink-0 text-[13px] font-semibold', ink)}>{group.label}</span>
                        {group.members.length ? (
                            group.members.map((member) => (
                                <span key={member.id} className={cn('inline-flex items-center gap-1.5 text-[13px]', ink)}>
                                    <Avatar name={member.name} size="xs" />
                                    {member.name}
                                </span>
                            ))
                        ) : (
                            <span className={cn('text-xs', sub)}>아직 없어요 · 그 예배 인도자에게 알림이 가요</span>
                        )}
                    </li>
                ))}
            </ul>
            <Sheet open={open} onClose={() => setOpen(false)} label="파트 담당">
                <PartLeadsEditor onDone={() => setOpen(false)} />
            </Sheet>
        </section>
    );
}

function PartLeadsEditor({ onDone }: { onDone: () => void }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const initial = Object.fromEntries(planning.partLeads.map((group) => [group.part, group.members.map((member) => member.id)])) as Record<LeadPart, string[]>;
    const [draft, setDraft] = useState<Record<LeadPart, string[]>>(initial);

    async function save() {
        for (const group of planning.partLeads) {
            const before = initial[group.part] ?? [];
            const after = draft[group.part] ?? [];
            const same = before.length === after.length && before.every((id) => after.includes(id));
            if (!same && !(await send({ type: 'partLead.set', part: group.part, memberIds: after }))) return;
        }
        onDone();
    }

    return (
        <div className="space-y-5">
            <h2 className={cn('pr-10 text-lg font-semibold tracking-tight', ink)}>파트 담당</h2>
            <ol aria-label="펑크가 나면" className={cn('space-y-2.5 rounded-2xl p-4', chip)}>
                {FLOW.map((step, index) => (
                    <li key={step.title} className="flex items-start gap-2.5">
                        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', step.className)}>{index + 1}</span>
                        <span>
                            <span className={cn('block text-[13px] font-semibold', ink)}>{step.title}</span>
                            <span className={cn('block text-[11px]', body)}>{step.detail}</span>
                        </span>
                    </li>
                ))}
            </ol>

            {planning.partLeads.map((group) => {
                // 이 파트를 맡는 역할의 팀원부터
                const roster = [...planning.roster].sort((a, b) => Number(partOfRole(b.role) === group.part) - Number(partOfRole(a.role) === group.part));
                const picked = draft[group.part] ?? [];
                return (
                    <section key={group.part} aria-label={`${leadParts[group.part]} 고르기`}>
                        <p className={cn('text-sm font-semibold', ink)}>
                            {group.label} <span className={cn('text-[11px] font-normal', sub)}>{group.roles}</span>
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {roster.map((member) => {
                                const on = picked.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setDraft((value) => ({ ...value, [group.part]: on ? picked.filter((id) => id !== member.id) : [...picked, member.id] }))}
                                        className={cn(on ? pillOn : pill, 'h-9 gap-1.5 pl-1')}
                                    >
                                        <Avatar name={member.name} size="xs" />
                                        {member.name}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
                저장 · 새 담당에게 알림
            </button>
        </div>
    );
}
