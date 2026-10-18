'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Check, Clock3, ListMusic, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { partOfRole, type LeadPart } from '@/types/planning';
import { dDay, displayTitle, frequentSongs, md, SETLIST_STATUS, songsOf, weekday, type ContiSetlist, type FrequentSong } from './model';
import { useConti } from './context';
import { buildRoleMatrix, pickServices, type AssignStatus, type PartAssignment, type RoleRow, type ServiceDay } from './planningBridge';
import { PlanningError, pill, pillOn, useDispatch } from './planningUi';
import TeamScreen, { AssignmentRow, WeekEvents } from './TeamScreen';
import { AddButton, Avatar, Eyebrow, SampleChip, ScreenTitle, body, ink, line, selected, sub } from './ui';

const RANGES = [4, 8] as const;

const BAR: Record<AssignStatus, string> = {
    confirmed: 'bg-emerald-500',
    pending: 'bg-amber-400',
    declined: 'bg-rose-400',
};

/** 손볼 자리 순서: 불참 → 빈자리 → 응답 대기 */
function attentionOf(service: ServiceDay | undefined): PartAssignment[] {
    if (!service) return [];
    const rank = (item: PartAssignment) => (item.status === 'declined' ? 0 : item.status === null ? 1 : 2);
    return service.assignments.filter((item) => item.status !== 'confirmed').sort((a, b) => rank(a) - rank(b));
}

function statusText(item: PartAssignment): string {
    return item.status === 'confirmed' ? '확정' : item.status === 'pending' ? '응답 대기' : item.status === 'declined' ? '불참' : '빈자리';
}

/** 두 배치 화면(넓은 화면·휴대폰)이 함께 쓰는 값 */
interface Board {
    today: string;
    services: ServiceDay[];
    /** 다가오는 첫 예배 (없으면 마지막 예배) */
    current: ServiceDay;
    rows: RoleRow[];
    todo: PartAssignment[];
    focus: { service: ServiceDay; item: PartAssignment } | null;
    frequent: FrequentSong[];
    createHref: string;
    setlistFor: (service: ServiceDay) => ContiSetlist | null;
    labelOf: (item: PartAssignment) => string;
    isFocus: (service: ServiceDay, item: PartAssignment) => boolean;
    select: (service: ServiceDay, item: PartAssignment) => void;
    openOrder: (id: string) => void;
}

/**
 * 팀 배치: 역할 × 주일 배치표 아래에 같은 열 순서로 콘티 보드를 둡니다.
 * 자리를 고르면 모바일 목록과 같은 배치 조작(배정·초대·대체 요청·지원)을 합니다.
 * - responsive: 대시보드. xl 이상은 넓은 배치표, 그보다 좁으면 휴대폰 배치표
 * - compact: 휴대폰 화면(시안 페이지)
 */
export default function TeamBoardScreen({ openOrder, layout = 'responsive' }: { openOrder: (id: string) => void; layout?: 'responsive' | 'compact' }) {
    const { today, planning, setlists, editor } = useConti();
    const [range, setRange] = useState<(typeof RANGES)[number]>(4);
    const [picked, setPicked] = useState<{ eventId: string; slotId: string } | null>(null);

    if (!planning.ready || !planning.services.length) return <TeamScreen openOrder={openOrder} />;

    const services = pickServices(planning.services, today, range);
    const current = services.find((service) => service.date >= today) ?? services[services.length - 1];
    const rows = buildRoleMatrix(services);
    const todo = attentionOf(current);
    const pickedService = picked ? services.find((service) => service.eventId === picked.eventId) : undefined;
    const pickedItem = pickedService?.assignments.find((item) => item.slotId === picked?.slotId);
    const focus = pickedService && pickedItem ? { service: pickedService, item: pickedItem } : todo[0] ? { service: current, item: todo[0] } : null;
    const manageHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=schedule` : `${planning.planningHref}?tab=schedule`;
    const board: Board = {
        today,
        services,
        current,
        rows,
        todo,
        focus,
        frequent: frequentSongs(setlists, today),
        createHref: editor?.createHref ?? '/dashboard/songs/library',
        setlistFor: (service) => setlists.find((item) => item.id === service.setlistId) ?? setlists.find((item) => item.date === service.date) ?? null,
        labelOf: (item) => rows.find((row) => row.cells.some((cell) => cell?.slotId === item.slotId))?.label ?? item.roleLabel,
        isFocus: (service, item) => focus?.service.eventId === service.eventId && focus.item.slotId === item.slotId,
        select: (service, item) => setPicked({ eventId: service.eventId, slotId: item.slotId }),
        openOrder,
    };

    return (
        <div className="space-y-6">
            <ScreenTitle
                eyebrow={<>팀 배치 {planning.sample && <SampleChip className="ml-1" />}</>}
                title="인원 배치표"
                trailing={`${md(services[0].date)} – ${md(services[services.length - 1].date)}`}
                aside={
                    <>
                        <div role="group" aria-label="기간" className={cn('flex gap-0.5 rounded-full border p-0.5', line)}>
                            {RANGES.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={range === value}
                                    onClick={() => setRange(value)}
                                    className={cn('h-8 rounded-full px-3 text-xs transition', range === value ? cn(selected, 'font-semibold') : body)}
                                >
                                    {value}주
                                </button>
                            ))}
                        </div>
                        <AddButton label="일정·배치 관리 (일정·요청 화면)" href={manageHref} />
                    </>
                }
            />
            <PlanningError />

            {layout === 'responsive' ? (
                <>
                    <div className="hidden xl:block">
                        <WideBoard board={board} />
                    </div>
                    <div className="xl:hidden">
                        <CompactBoard board={board} />
                    </div>
                </>
            ) : (
                <CompactBoard board={board} />
            )}
        </div>
    );
}

function WideBoard({ board }: { board: Board }) {
    const { services, current, rows, today } = board;
    const grid: CSSProperties = { gridTemplateColumns: `8rem repeat(${services.length}, minmax(9.5rem, 1fr))`, minWidth: `${8 + services.length * 9.5}rem` };
    const columnTint = (service: ServiceDay) => (service.eventId === current.eventId ? 'bg-primary/[0.04]' : service.date < today ? 'bg-neutral-50/70 dark:bg-white/[0.02]' : '');

    return (
        <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_40rem] space-y-3">
                <LegendRow />

                <div className="no-scrollbar overflow-x-auto">
                    <section aria-label="주일별 배치" className={cn('overflow-hidden rounded-3xl border', line)} style={{ minWidth: grid.minWidth }}>
                        <div className={cn('grid border-b bg-neutral-50/80 dark:bg-white/[0.03]', line)} style={grid}>
                            <div className={cn('p-4 text-xs font-medium', sub)}>역할</div>
                            {services.map((service) => (
                                <ColumnHead key={service.eventId} service={service} current={service.eventId === current.eventId} today={today} />
                            ))}
                        </div>
                        {rows.map((row) => (
                            <div key={row.key} className={cn('grid border-b last:border-b-0', line)} style={grid}>
                                <div className={cn('flex items-center px-4 text-[13px] font-medium', ink)}>{row.label}</div>
                                {row.cells.map((item, index) => {
                                    const service = services[index];
                                    return (
                                        <div key={service.eventId} className={cn('flex min-h-14 items-center border-l px-2 py-1.5', line, columnTint(service))}>
                                            {item ? (
                                                <SlotCell service={service} item={item} rowLabel={row.label} active={board.isFocus(service, item)} onSelect={() => board.select(service, item)} />
                                            ) : (
                                                <span className={cn('px-2 text-xs', sub)}>자리 없음</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </section>

                    <section aria-label="콘티 보드" className="mt-7" style={{ minWidth: grid.minWidth }}>
                        <BoardTitle />
                        <div className="grid gap-x-2.5" style={grid}>
                            <div aria-hidden="true" />
                            {services.map((service) => (
                                <BoardColumn key={service.eventId} board={board} service={service} />
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            <aside aria-label="선택한 자리" className="min-w-0 flex-[1_1_18rem] space-y-4">
                <FocusCard board={board} />
                <TodoCard board={board} />
                <PartLeadsCard />
                <FrequentCard songs={board.frequent} />
            </aside>
        </div>
    );
}

/** 휴대폰 폭: 칸에는 아바타와 상태 배지만, 고른 자리는 표 바로 아래 카드에서 다룹니다. 콘티 보드는 옆으로 넘깁니다. */
function CompactBoard({ board }: { board: Board }) {
    const { services, current, rows, today } = board;
    const detailRef = useRef<HTMLDivElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLDivElement>(null);
    const grid: CSSProperties = {
        gridTemplateColumns: `4.25rem repeat(${services.length}, minmax(3.5rem, 1fr))`,
        minWidth: `${4.25 + services.length * 3.5}rem`,
    };

    /** 콘티 보드는 다가오는 예배부터 보이게 */
    useEffect(() => {
        const strip = stripRef.current;
        const column = currentRef.current;
        if (strip && column) strip.scrollLeft = column.offsetLeft - strip.offsetLeft;
    }, [current.eventId, services.length]);

    function select(service: ServiceDay, item: PartAssignment) {
        board.select(service, item);
        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <LegendRow />
                <div className="no-scrollbar overflow-x-auto">
                    <section aria-label="주일별 배치" className={cn('overflow-hidden rounded-2xl border', line)} style={{ minWidth: grid.minWidth }}>
                        <div className={cn('grid border-b bg-neutral-50/80 dark:bg-white/[0.03]', line)} style={grid}>
                            <div className={cn('flex items-end px-3 pb-2 text-[11px] font-medium', sub)}>역할</div>
                            {services.map((service) => {
                                const isCurrent = service.eventId === current.eventId;
                                return (
                                    <div key={service.eventId} className={cn('min-w-0 border-l px-1 pb-2 pt-2.5 text-center', line, isCurrent && 'bg-primary/[0.07]')}>
                                        <p className={cn('text-[13px] font-semibold tabular-nums', isCurrent ? 'text-primary' : ink)}>{md(service.date)}</p>
                                        <p className={cn('mt-0.5 truncate text-[10px]', sub)}>
                                            {weekday(service.date)} · {service.date < today ? '지난' : dDay(service.date, today)}
                                        </p>
                                        <p className={cn('mt-0.5 text-[10px] font-medium tabular-nums', body)}>
                                            {service.counts.confirmed}/{service.counts.total}
                                        </p>
                                        <div className="mx-1 mt-1 flex h-1 gap-px overflow-hidden rounded-full" aria-hidden="true">
                                            {service.assignments.map((item) => (
                                                <span key={item.slotId} className={cn('flex-1', item.status ? BAR[item.status] : 'bg-neutral-200 dark:bg-neutral-700')} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {rows.map((row) => (
                            <div key={row.key} className={cn('grid border-b last:border-b-0', line)} style={grid}>
                                <div className={cn('flex min-w-0 items-center break-keep px-3 text-xs font-medium leading-tight', ink)}>{row.label}</div>
                                {row.cells.map((item, index) => {
                                    const service = services[index];
                                    return (
                                        <div
                                            key={service.eventId}
                                            className={cn('flex items-center justify-center border-l py-1', line, service.eventId === current.eventId && 'bg-primary/[0.04]', service.date < today && 'opacity-60')}
                                        >
                                            {item ? (
                                                <CompactCell service={service} item={item} rowLabel={row.label} active={board.isFocus(service, item)} onSelect={() => select(service, item)} />
                                            ) : (
                                                <span className={cn('text-xs', sub)}>
                                                    <span aria-hidden="true">–</span>
                                                    <span className="sr-only">자리 없음</span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </section>
                </div>
            </div>

            <div ref={detailRef} className="scroll-mt-28 space-y-3">
                <FocusCard board={board} />
                <TodoCard board={board} />
                <PartLeadsCard />
            </div>

            <section aria-label="콘티 보드">
                <BoardTitle />
                <div ref={stripRef} className="no-scrollbar relative -mx-1 flex snap-x snap-mandatory items-start gap-2.5 overflow-x-auto px-1 pb-1">
                    {services.map((service) => (
                        <div key={service.eventId} ref={service.eventId === current.eventId ? currentRef : undefined} className="flex w-[72%] max-w-64 shrink-0 snap-start">
                            <BoardColumn board={board} service={service} />
                        </div>
                    ))}
                </div>
            </section>

            <FrequentCard songs={board.frequent} />
            <WeekEvents date={current.date} />
        </div>
    );
}

function CompactCell({ service, item, rowLabel, active, onSelect }: { service: ServiceDay; item: PartAssignment; rowLabel: string; active: boolean; onSelect: () => void }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            aria-label={`${md(service.date)} ${rowLabel} · ${item.memberName ?? '미정'}${item.mine ? '(나)' : ''} · ${statusText(item)}`}
            className={cn('relative flex size-11 items-center justify-center rounded-xl transition active:scale-95', active && 'bg-white ring-2 ring-neutral-900 dark:bg-neutral-900 dark:ring-white')}
        >
            {item.memberName ? (
                <>
                    <Avatar name={item.memberName} size="md" className={cn(item.status === 'declined' && 'opacity-40', item.mine && 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-neutral-900')} />
                    {item.status && (
                        <span
                            aria-hidden="true"
                            className={cn(
                                'absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-white dark:ring-neutral-900',
                                item.status === 'confirmed' && 'bg-emerald-600',
                                item.status === 'pending' && 'bg-amber-500',
                                item.status === 'declined' && 'bg-rose-600',
                            )}
                        >
                            {item.status === 'confirmed' ? <Check size={10} strokeWidth={3.5} /> : item.status === 'pending' ? <Clock3 size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3.5} />}
                        </span>
                    )}
                </>
            ) : (
                <span className={cn('flex size-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-neutral-300 dark:border-neutral-600', body)}>
                    <Plus size={14} aria-hidden="true" />
                </span>
            )}
            {item.volunteers.length > 0 && (
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
                    {item.volunteers.length}
                </span>
            )}
        </button>
    );
}

function LegendRow() {
    return (
        <p className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs', sub)}>
            <Legend className="bg-emerald-500" label="확정" />
            <Legend className="bg-amber-400" label="응답 대기" />
            <Legend className="bg-rose-400" label="불참" />
            <Legend className="border-[1.5px] border-dashed border-neutral-400" label="빈자리" />
        </p>
    );
}

function BoardTitle() {
    return (
        <h2 className={cn('mb-3 flex flex-wrap items-baseline gap-x-2 text-[17px] font-semibold tracking-tight', ink)}>
            <ListMusic size={17} className="self-center" aria-hidden="true" />
            콘티 보드
            <span className={cn('text-xs font-normal', sub)}>위 배치표와 같은 주일 순서</span>
        </h2>
    );
}

function FocusCard({ board }: { board: Board }) {
    const { focus } = board;
    return (
        <section aria-label="선택한 자리" className={cn('rounded-3xl border p-5', line)}>
            {focus ? (
                <>
                    <Eyebrow>선택한 자리</Eyebrow>
                    <h2 className={cn('mt-0.5 text-[17px] font-semibold tracking-tight', ink)}>
                        {md(focus.service.date)} {weekday(focus.service.date)} · {board.labelOf(focus.item)}
                    </h2>
                    <p className={cn('mt-0.5 text-xs', sub)}>
                        {focus.service.title} · {focus.service.time}
                        {focus.service.place ? ` · ${focus.service.place}` : ''}
                    </p>
                    <ul className="mt-2">
                        <AssignmentRow key={`${focus.service.eventId}:${focus.item.slotId}`} service={focus.service} item={focus.item} />
                    </ul>
                </>
            ) : (
                <p className={cn('py-4 text-center text-sm', sub)}>배치표에서 자리를 고르면 여기서 배정·초대·대체 요청을 할 수 있어요</p>
            )}
        </section>
    );
}

function TodoCard({ board }: { board: Board }) {
    const { current, todo } = board;
    return (
        <section className={cn('rounded-3xl border p-5', line)}>
            <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>
                {md(current.date)} 남은 일 <span className={cn('font-normal', sub)}>{todo.length}</span>
            </h2>
            {todo.length ? (
                <ul className="mt-2">
                    {todo.map((item) => (
                        <li key={item.slotId} className={cn('border-b last:border-b-0', line)}>
                            <button type="button" onClick={() => board.select(current, item)} className="flex min-h-11 w-full items-center gap-2.5 text-left">
                                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', item.status ? BAR[item.status] : 'border-[1.5px] border-dashed border-neutral-400')} />
                                <span className={cn('min-w-0 flex-1 truncate text-[13px]', ink)}>
                                    {board.labelOf(item)} {item.memberName ?? ''} {statusText(item)}
                                </span>
                                {item.volunteers.length > 0 && <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300">지원 {item.volunteers.length}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-300">
                    <Check size={14} aria-hidden="true" />
                    모든 자리가 확정됐어요
                </p>
            )}
        </section>
    );
}

/** 악기장·싱어 담당 등록. 결석이 생기면 그 예배 인도자와 함께 이 사람들에게 알림이 갑니다. */
function PartLeadsCard() {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const [editing, setEditing] = useState<LeadPart | null>(null);
    const [draft, setDraft] = useState<string[]>([]);
    const manager = Boolean(planning.viewer?.canManage);
    if (!planning.partLeads.length) return null;

    async function save(part: LeadPart) {
        if (await send({ type: 'partLead.set', part, memberIds: draft })) setEditing(null);
    }

    return (
        <section aria-label="파트 담당" className={cn('rounded-3xl border p-5', line)}>
            <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>파트 담당</h2>
            <p className={cn('mt-1 text-xs leading-relaxed', sub)}>결석이 생기면 그 예배 인도자와 파트 담당에게 알림이 가고, 같은 악기·파트 팀원에게 대체를 부탁해요</p>
            <ul className="mt-2">
                {planning.partLeads.map((group) => {
                    const open = editing === group.part;
                    // 이 파트를 맡는 역할의 팀원부터
                    const roster = [...planning.roster].sort((a, b) => Number(partOfRole(b.role) === group.part) - Number(partOfRole(a.role) === group.part));
                    return (
                        <li key={group.part} className={cn('border-b py-3 last:border-b-0 last:pb-0', line)}>
                            <div className="flex items-center justify-between gap-2">
                                <p className={cn('text-[13px] font-semibold', ink)}>
                                    {group.label} <span className={cn('text-[11px] font-normal', sub)}>{group.roles}</span>
                                </p>
                                {manager && !open && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditing(group.part);
                                            setDraft(group.members.map((member) => member.id));
                                        }}
                                        className={pill}
                                    >
                                        {group.members.length ? '변경' : '등록'}
                                    </button>
                                )}
                            </div>
                            {open ? (
                                <div className="mt-2.5 space-y-2.5">
                                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${group.label} 고르기`}>
                                        {roster.map((member) => {
                                            const on = draft.includes(member.id);
                                            return (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => setDraft((ids) => (on ? ids.filter((id) => id !== member.id) : [...ids, member.id]))}
                                                    className={cn(on ? pillOn : pill, 'gap-1.5 pl-1')}
                                                >
                                                    <Avatar name={member.name} size="xs" />
                                                    {member.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button type="button" disabled={busy} onClick={() => save(group.part)} className={pillOn}>
                                            <Check size={13} aria-hidden="true" />
                                            저장
                                        </button>
                                        <button type="button" onClick={() => setEditing(null)} className={cn('h-8 px-2 text-xs', sub)}>
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : group.members.length ? (
                                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                                    {group.members.map((member) => (
                                        <span key={member.id} className={cn('inline-flex items-center gap-1.5 text-[13px]', ink)}>
                                            <Avatar name={member.name} size="xs" />
                                            {member.name}
                                        </span>
                                    ))}
                                </p>
                            ) : (
                                <p className={cn('mt-1.5 text-xs', sub)}>아직 없어요 · 그 예배 인도자에게만 알림이 가요</p>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function FrequentCard({ songs }: { songs: FrequentSong[] }) {
    if (!songs.length) return null;
    return (
        <section className={cn('rounded-3xl border p-5', line)}>
            <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>
                자주 부른 곡 <span className={cn('text-xs font-normal', sub)}>최근 8주</span>
            </h2>
            <ol className="mt-2">
                {songs.map((song) => (
                    <li key={song.songId} className={cn('flex min-h-10 items-center gap-2 border-b text-[13px] last:border-b-0', line)}>
                        <span className={cn('min-w-0 flex-1 truncate', ink)}>{song.title}</span>
                        <span className={cn('text-[11px] tabular-nums', sub)}>{song.count}회</span>
                        <span className={cn('w-6 text-right text-xs font-semibold', ink)}>{song.key}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function Legend({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', className)} aria-hidden="true" />
            {label}
        </span>
    );
}

function ColumnHead({ service, current, today }: { service: ServiceDay; current: boolean; today: string }) {
    const { counts } = service;
    const tag = service.date < today ? '지난' : dDay(service.date, today);
    return (
        <div className={cn('min-w-0 border-l p-3.5', line, current && 'bg-primary/[0.07]')}>
            <div className="flex items-center justify-between gap-1.5">
                <span className={cn('text-[17px] font-semibold tabular-nums', ink)}>
                    {md(service.date)} <span className={cn('text-xs font-normal', sub)}>{weekday(service.date)}</span>
                </span>
                <span className={cn('shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', current ? 'bg-primary text-primary-foreground' : cn('bg-neutral-100 dark:bg-neutral-800', body))}>{tag}</span>
            </div>
            <div
                role="img"
                aria-label={`확정 ${counts.confirmed}, 대기 ${counts.pending}, 불참 ${counts.declined}, 빈자리 ${counts.vacant}`}
                className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
            >
                {service.assignments.map((item) => (
                    <span key={item.slotId} className={cn('flex-1', item.status ? BAR[item.status] : 'bg-neutral-200 dark:bg-neutral-700')} />
                ))}
            </div>
            <p className={cn('mt-1.5 text-xs tabular-nums', body)}>
                {counts.confirmed}/{counts.total} 확정
                {counts.pending > 0 && ` · 대기 ${counts.pending}`}
                {counts.vacant > 0 && ` · 빈자리 ${counts.vacant}`}
            </p>
        </div>
    );
}

function SlotCell({ service, item, rowLabel, active, onSelect }: { service: ServiceDay; item: PartAssignment; rowLabel: string; active: boolean; onSelect: () => void }) {
    const status = statusText(item);
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            aria-label={`${md(service.date)} ${rowLabel} · ${item.memberName ?? '미정'} · ${status}`}
            className={cn(
                'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-1.5 text-left transition hover:bg-neutral-100/70 dark:hover:bg-white/5',
                active && 'bg-white ring-2 ring-neutral-900 hover:bg-white dark:bg-neutral-900 dark:ring-white dark:hover:bg-neutral-900',
                item.status === null && !active && 'justify-center border-[1.5px] border-dashed border-neutral-300 dark:border-neutral-600',
            )}
        >
            {item.memberName ? (
                <>
                    <Avatar name={item.memberName} className={cn(item.status === 'declined' && 'opacity-50')} />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn('truncate text-[13px]', item.status === 'declined' ? cn('line-through', sub) : ink)}>
                            {item.memberName}
                            {item.mine && <span className="ml-1 text-[11px] font-semibold text-primary">나</span>}
                        </span>
                        {item.status === 'declined' && <span className="truncate text-[11px] text-rose-700 dark:text-rose-300">불참{item.note ? ` · ${item.note}` : ''}</span>}
                    </span>
                    {item.status === 'confirmed' && <Check size={15} strokeWidth={2.5} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
                    {item.status === 'pending' && <span className="shrink-0 text-[11px] font-semibold text-amber-700 dark:text-amber-300">대기</span>}
                    {item.status === 'declined' && item.volunteers.length > 0 && (
                        <span className="shrink-0 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-400/15 dark:text-orange-200">지원 {item.volunteers.length}</span>
                    )}
                </>
            ) : (
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium', body)}>
                    <Plus size={13} aria-hidden="true" />
                    {item.substituteOpen ? '대체 모집 중' : item.volunteers.length ? `지원 ${item.volunteers.length}` : '배정'}
                </span>
            )}
        </button>
    );
}

function BoardColumn({ board, service }: { board: Board; service: ServiceDay }) {
    const { openOrder, createHref } = board;
    const setlist = board.setlistFor(service);
    const current = service.eventId === board.current.eventId;
    const past = service.date < board.today;
    const status = setlist ? SETLIST_STATUS[setlist.status] : null;
    const songs = setlist ? songsOf(setlist.items) : [];
    const numbers = new Map(songs.map((song, index) => [song.id, index + 1]));
    return (
        <div className={cn('flex w-full min-w-0 flex-col gap-2 rounded-3xl p-3', current ? 'bg-primary/[0.05] ring-2 ring-primary/70' : 'bg-neutral-50 dark:bg-white/[0.03]', past && 'opacity-70')}>
            <div className="flex items-center justify-between gap-1.5">
                <span className={cn('text-xs font-medium tabular-nums', body)}>
                    {md(service.date)} {weekday(service.date)}
                </span>
                {status && <span className={cn('text-[11px] font-semibold', status.text)}>{status.label}</span>}
            </div>
            {setlist ? (
                <button type="button" onClick={() => openOrder(setlist.id)} className="text-left">
                    <span className={cn('block truncate text-sm font-semibold', ink)}>{displayTitle(setlist)}</span>
                    <span className={cn('mt-0.5 block truncate text-[11px]', sub)}>
                        {songs.length}곡{setlist.owner ? ` · 인도 ${setlist.owner}` : ''}
                    </span>
                </button>
            ) : (
                <span className={cn('truncate text-sm font-semibold', sub)}>{service.setlistTitle || '콘티 없음'}</span>
            )}

            {setlist && setlist.items.length > 0 ? (
                <ol className="space-y-1.5">
                    {setlist.items.map((item) =>
                        item.kind === 'song' ? (
                            <li key={item.id} className={cn('flex items-start gap-2 rounded-xl bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 dark:bg-neutral-900', 'ring-neutral-100 dark:ring-neutral-800')}>
                                <span className={cn('w-3 shrink-0 text-[11px] font-semibold leading-5 tabular-nums', sub)}>{numbers.get(item.id)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className={cn('block text-xs font-medium leading-5', ink)}>{item.title}</span>
                                    <span className={cn('mt-0.5 flex items-center gap-1.5 text-[11px]', sub)}>
                                        <span className={cn('font-semibold', ink)}>{item.key}</span>
                                        {item.lead && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span className="truncate">{item.lead}</span>
                                            </>
                                        )}
                                    </span>
                                </span>
                            </li>
                        ) : (
                            <li key={item.id} className={cn('truncate rounded-lg border border-dashed px-2.5 py-1 text-[11px]', 'border-neutral-300 dark:border-neutral-600', body)}>
                                {item.title}
                            </li>
                        ),
                    )}
                </ol>
            ) : (
                <div className={cn('flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed px-3 text-center text-xs', 'border-neutral-300 dark:border-neutral-600', body)}>
                    아직 곡이 없어요
                    {setlist ? (
                        <button type="button" onClick={() => openOrder(setlist.id)} className={cn('inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full px-3 font-semibold', selected)}>
                            <Plus size={13} aria-hidden="true" />곡 고르기
                        </button>
                    ) : (
                        !past && (
                            <Link href={createHref} className={cn('inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full px-3 font-semibold', selected)}>
                                <Plus size={13} aria-hidden="true" />콘티 만들기
                            </Link>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
