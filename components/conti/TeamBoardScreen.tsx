'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Check, ListMusic, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dDay, displayTitle, frequentSongs, md, SETLIST_STATUS, songsOf, weekday, type ContiSetlist } from './model';
import { useConti } from './context';
import { buildRoleMatrix, pickServices, type AssignStatus, type PartAssignment, type ServiceDay } from './planningBridge';
import { PlanningError } from './planningUi';
import TeamScreen, { AssignmentRow } from './TeamScreen';
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

/**
 * 넓은 화면의 팀 배치: 역할 × 주일 배치표 아래에 같은 열 순서로 콘티 보드를 둡니다.
 * 자리를 고르면 오른쪽에서 모바일 화면과 같은 배치 조작(배정·초대·대체 요청·지원)을 합니다.
 */
export default function TeamBoardScreen({ openOrder }: { openOrder: (id: string) => void }) {
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
    const grid: CSSProperties = { gridTemplateColumns: `8rem repeat(${services.length}, minmax(9.5rem, 1fr))`, minWidth: `${8 + services.length * 9.5}rem` };
    const manageHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=schedule` : `${planning.planningHref}?tab=schedule`;
    const createHref = editor?.createHref ?? '/dashboard/songs/library';
    const setlistFor = (service: ServiceDay) => setlists.find((item) => item.id === service.setlistId) ?? setlists.find((item) => item.date === service.date) ?? null;
    const frequent = frequentSongs(setlists, today);
    const select = (service: ServiceDay, item: PartAssignment) => setPicked({ eventId: service.eventId, slotId: item.slotId });
    const columnTint = (service: ServiceDay) => (service.eventId === current.eventId ? 'bg-primary/[0.04]' : service.date < today ? 'bg-neutral-50/70 dark:bg-white/[0.02]' : '');

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
                                    className={cn('h-8 rounded-full px-3.5 text-xs transition', range === value ? cn(selected, 'font-semibold') : body)}
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

            <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-0 flex-[999_1_40rem] space-y-3">
                    <p className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs', sub)}>
                        <Legend className="bg-emerald-500" label="확정" />
                        <Legend className="bg-amber-400" label="응답 대기" />
                        <Legend className="bg-rose-400" label="불참" />
                        <Legend className="border-[1.5px] border-dashed border-neutral-400" label="빈자리" />
                    </p>

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
                                                    <SlotCell
                                                        service={service}
                                                        item={item}
                                                        rowLabel={row.label}
                                                        active={focus?.item.slotId === item.slotId && focus.service.eventId === service.eventId}
                                                        onSelect={() => select(service, item)}
                                                    />
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
                            <h2 className={cn('mb-3 flex items-baseline gap-2 text-[17px] font-semibold tracking-tight', ink)}>
                                <ListMusic size={17} className="self-center" aria-hidden="true" />
                                콘티 보드
                                <span className={cn('text-xs font-normal', sub)}>위 배치표와 같은 주일 순서</span>
                            </h2>
                            <div className="grid gap-x-2.5" style={grid}>
                                <div aria-hidden="true" />
                                {services.map((service) => (
                                    <BoardColumn
                                        key={service.eventId}
                                        service={service}
                                        setlist={setlistFor(service)}
                                        current={service.eventId === current.eventId}
                                        past={service.date < today}
                                        openOrder={openOrder}
                                        createHref={createHref}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <aside aria-label="선택한 자리" className="min-w-0 flex-[1_1_18rem] space-y-4">
                    <section className={cn('rounded-3xl border p-5', line)}>
                        {focus ? (
                            <>
                                <Eyebrow>선택한 자리</Eyebrow>
                                <h2 className={cn('mt-0.5 text-[17px] font-semibold tracking-tight', ink)}>
                                    {md(focus.service.date)} {weekday(focus.service.date)} · {rows.find((row) => row.cells.some((cell) => cell?.slotId === focus.item.slotId))?.label ?? focus.item.roleLabel}
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

                    <section className={cn('rounded-3xl border p-5', line)}>
                        <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>
                            {md(current.date)} 남은 일 <span className={cn('font-normal', sub)}>{todo.length}</span>
                        </h2>
                        {todo.length ? (
                            <ul className="mt-2">
                                {todo.map((item) => (
                                    <li key={item.slotId} className={cn('border-b last:border-b-0', line)}>
                                        <button type="button" onClick={() => select(current, item)} className="flex min-h-11 w-full items-center gap-2.5 text-left">
                                            <span
                                                aria-hidden="true"
                                                className={cn('size-2 shrink-0 rounded-full', item.status ? BAR[item.status] : 'border-[1.5px] border-dashed border-neutral-400')}
                                            />
                                            <span className={cn('min-w-0 flex-1 truncate text-[13px]', ink)}>
                                                {item.roleLabel} {item.memberName ?? ''} {item.status === 'declined' ? '불참' : item.status === 'pending' ? '응답 대기' : '빈자리'}
                                            </span>
                                            {item.volunteers.length > 0 && <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300">지원 {item.volunteers.length}</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={cn('mt-2 flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-300')}>
                                <Check size={14} aria-hidden="true" />
                                모든 자리가 확정됐어요
                            </p>
                        )}
                    </section>

                    {frequent.length > 0 && (
                        <section className={cn('rounded-3xl border p-5', line)}>
                            <h2 className={cn('text-[15px] font-semibold tracking-tight', ink)}>
                                자주 부른 곡 <span className={cn('text-xs font-normal', sub)}>최근 8주</span>
                            </h2>
                            <ol className="mt-2">
                                {frequent.map((song) => (
                                    <li key={song.songId} className={cn('flex min-h-10 items-center gap-2 border-b text-[13px] last:border-b-0', line)}>
                                        <span className={cn('min-w-0 flex-1 truncate', ink)}>{song.title}</span>
                                        <span className={cn('text-[11px] tabular-nums', sub)}>{song.count}회</span>
                                        <span className={cn('w-6 text-right text-xs font-semibold', ink)}>{song.key}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </aside>
            </div>
        </div>
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
    const status = item.status === 'confirmed' ? '확정' : item.status === 'pending' ? '응답 대기' : item.status === 'declined' ? '불참' : '빈자리';
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

function BoardColumn({
    service,
    setlist,
    current,
    past,
    openOrder,
    createHref,
}: {
    service: ServiceDay;
    setlist: ContiSetlist | null;
    current: boolean;
    past: boolean;
    openOrder: (id: string) => void;
    createHref: string;
}) {
    const status = setlist ? SETLIST_STATUS[setlist.status] : null;
    const songs = setlist ? songsOf(setlist.items) : [];
    const numbers = new Map(songs.map((song, index) => [song.id, index + 1]));
    return (
        <div className={cn('flex min-w-0 flex-col gap-2 rounded-3xl p-3', current ? 'bg-primary/[0.05] ring-2 ring-primary/70' : 'bg-neutral-50 dark:bg-white/[0.03]', past && 'opacity-70')}>
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
