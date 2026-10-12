'use client';

import { useState, type ReactNode } from 'react';
import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    CalendarDays,
    ChevronRight,
    Clock3,
    Copy,
    ListMusic,
    ListOrdered,
    MessageSquareText,
    Pencil,
    Plus,
    Radio,
    Share2,
    UsersRound,
    Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    DRAFT_SETLISTS,
    STATUS_META,
    dDayLabel,
    dateParts,
    formatDateLabel,
    pastSetlists,
    shortDate,
    songNumbers,
    songsOf,
    totalMinutes,
    upcomingSetlists,
    type DraftItem,
    type DraftSetlist,
    type DraftTab,
} from './draftData';
import { FormChips, KeyPill, MOMENT_ICONS, ReadinessMeter, useDraftWorkspace } from './draftParts';

/** 시안 A · 카드 스택: 현재 화면의 카드 언어를 유지하면서 '이번 주'를 가장 먼저 보여줍니다. */
export default function DraftStack({ initialTab }: { initialTab: DraftTab }) {
    const ws = useDraftWorkspace(initialTab);
    const [editing, setEditing] = useState(false);

    return (
        <div className="space-y-5">
            <div role="tablist" aria-label="콘티 화면 전환" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1 shadow-xs">
                <StackTab
                    active={ws.tab === 'setlists'}
                    onClick={() => ws.setTab('setlists')}
                    icon={<ListMusic size={17} />}
                    label="콘티"
                    meta={`${DRAFT_SETLISTS.length}개`}
                />
                <StackTab
                    active={ws.tab === 'order'}
                    onClick={() => ws.setTab('order')}
                    icon={<ListOrdered size={17} />}
                    label="순서"
                    meta={shortDate(ws.setlist.date)}
                    detail={ws.setlist.title}
                />
            </div>

            {ws.tab === 'setlists' ? (
                <StackSetlists onOpen={ws.openOrder} />
            ) : (
                <StackOrder
                    setlist={ws.setlist}
                    items={ws.items}
                    editing={editing}
                    onToggleEdit={() => setEditing((value) => !value)}
                    onSelect={ws.selectSetlist}
                    onMove={ws.move}
                />
            )}
        </div>
    );
}

function StackTab({ active, onClick, icon, label, meta, detail }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; meta: string; detail?: string }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={cn(
                'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-all',
                active ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
        >
            <span className="shrink-0">{icon}</span>
            <span className="shrink-0 whitespace-nowrap">{label}</span>
            <span className={cn('min-w-0 truncate text-[11px] font-medium tabular-nums', active ? 'opacity-75' : 'opacity-70')}>
                {meta}
                {detail && <span className="hidden sm:inline"> · {detail}</span>}
            </span>
        </button>
    );
}

/* ───────────────────────── 콘티 탭 ───────────────────────── */

function StackSetlists({ onOpen }: { onOpen: (id: string) => void }) {
    const [hero, ...upcoming] = upcomingSetlists(DRAFT_SETLISTS);
    const past = pastSetlists(DRAFT_SETLISTS);

    return (
        <div className="space-y-6">
            {hero && <StackHero setlist={hero} onOpen={onOpen} />}

            <section aria-labelledby="stack-upcoming" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 id="stack-upcoming" className="text-sm font-bold text-foreground">다가오는 콘티</h3>
                    <span className="text-xs text-muted-foreground">{upcoming.length}개</span>
                </div>
                <div className="space-y-2.5">
                    {upcoming.map((setlist) => (
                        <StackUpcomingCard key={setlist.id} setlist={setlist} onOpen={onOpen} />
                    ))}
                    <button
                        type="button"
                        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                        <Plus size={16} />
                        새 콘티 만들기
                    </button>
                </div>
            </section>

            <section aria-labelledby="stack-past" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 id="stack-past" className="text-sm font-bold text-foreground">지난 콘티</h3>
                    <span className="text-xs text-muted-foreground">복제해서 다음 예배에 사용</span>
                </div>
                <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
                    {past.map((setlist) => {
                        const songs = songsOf(setlist.items);
                        return (
                            <li key={setlist.id} className="flex items-center gap-3 px-4 py-3">
                                <button type="button" onClick={() => onOpen(setlist.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                                    <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{shortDate(setlist.date)}</span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-foreground">{setlist.theme}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {setlist.title} · {songs.length}곡
                                        </span>
                                    </span>
                                </button>
                                <Button type="button" variant="outline" size="xs" className="shrink-0">
                                    <Copy />
                                    복제
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}

function StackHero({ setlist, onOpen }: { setlist: DraftSetlist; onOpen: (id: string) => void }) {
    const songs = songsOf(setlist.items);
    const status = STATUS_META[setlist.status];

    return (
        <article className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
            <div className="border-b border-border/60 bg-primary/[0.04] px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" size="sm">이번 주</Badge>
                    <Badge variant={status.variant} size="sm" dot>{status.label}</Badge>
                    <span className="ml-auto text-sm font-black tabular-nums text-secondary">{dDayLabel(setlist.date)}</span>
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">{setlist.title}</h2>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                    <CalendarDays size={14} aria-hidden="true" />
                    <span>{formatDateLabel(setlist)}</span>
                    <span aria-hidden="true">·</span>
                    <span>인도 {setlist.leader}</span>
                </p>
                <p className="mt-2 text-sm font-semibold text-secondary">“{setlist.theme}”</p>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]">
                <ol aria-label="곡 순서 미리보기" className="space-y-0.5">
                    {songs.map((song, index) => (
                        <li key={song.id} className="flex min-h-10 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-muted/50">
                            <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{song.title}</span>
                            <KeyPill song={song} />
                        </li>
                    ))}
                </ol>

                <div className="space-y-3.5 rounded-2xl bg-muted/40 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Clock3 size={13} aria-hidden="true" />
                        {songs.length}곡 · 약 {totalMinutes(setlist.items)}분
                    </p>
                    <ReadinessMeter label="악보 등록" value={setlist.readiness.sheets} />
                    <ReadinessMeter label="송폼 입력" value={setlist.readiness.forms} />
                    <ReadinessMeter label="팀원 확인" value={setlist.readiness.members} />
                </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-border/60 px-5 py-4 sm:flex sm:px-6">
                <Button type="button" onClick={() => onOpen(setlist.id)} className="sm:px-5">
                    순서 보기
                    <ArrowRight />
                </Button>
                <Button type="button" variant="outline">
                    <Radio />
                    <span className="hidden min-[400px]:inline">예배 열기</span>
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="콘티 공유">
                    <Share2 />
                </Button>
            </div>
        </article>
    );
}

function StackUpcomingCard({ setlist, onOpen }: { setlist: DraftSetlist; onOpen: (id: string) => void }) {
    const songs = songsOf(setlist.items);
    const status = STATUS_META[setlist.status];
    const { month, day, weekday } = dateParts(setlist.date);

    return (
        <button
            type="button"
            onClick={() => onOpen(setlist.id)}
            className="card-interactive group flex w-full items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-xs hover:border-primary/40"
        >
            <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-muted/70 py-2 leading-none">
                <span className="text-[10px] font-semibold text-muted-foreground">{month}월</span>
                <span className="mt-1 text-xl font-black tabular-nums text-foreground">{day}</span>
                <span className="mt-1 text-[10px] font-semibold text-muted-foreground">{weekday}요일</span>
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate font-bold text-foreground">{setlist.title}</span>
                    <Badge variant={status.variant} size="sm" className="shrink-0">{status.label}</Badge>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {setlist.theme} · {songs.length}곡 · 약 {totalMinutes(setlist.items)}분
                </span>
                <span className="mt-1.5 block truncate text-xs text-foreground/75">
                    {songs.map((song) => song.title).join(' · ')}
                </span>
            </span>
            <span className="hidden shrink-0 text-xs font-black tabular-nums text-muted-foreground min-[400px]:block">{dDayLabel(setlist.date)}</span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
    );
}

/* ───────────────────────── 순서 탭 ───────────────────────── */

function StackOrder({
    setlist,
    items,
    editing,
    onToggleEdit,
    onSelect,
    onMove,
}: {
    setlist: DraftSetlist;
    items: DraftItem[];
    editing: boolean;
    onToggleEdit: () => void;
    onSelect: (id: string) => void;
    onMove: (index: number, offset: number) => void;
}) {
    const songs = songsOf(items);
    const ordered = [...upcomingSetlists(DRAFT_SETLISTS), ...pastSetlists(DRAFT_SETLISTS)];
    const numbers = songNumbers(items);

    return (
        <div className="space-y-4">
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0" aria-label="콘티 선택">
                {ordered.map((item) => {
                    const active = item.id === setlist.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect(item.id)}
                            className={cn(
                                'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition',
                                active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                                item.status === 'done' && !active && 'opacity-70',
                            )}
                        >
                            <span className="tabular-nums">{shortDate(item.date)}</span>
                            <span className="font-bold">{item.title}</span>
                        </button>
                    );
                })}
            </div>

            <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">{formatDateLabel(setlist)} · 인도 {setlist.leader}</p>
                        <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground">{setlist.title}</h2>
                        <p className="mt-0.5 text-sm font-semibold text-secondary">“{setlist.theme}”</p>
                    </div>
                    <Button type="button" variant={editing ? 'default' : 'outline'} size="sm" onClick={onToggleEdit} aria-pressed={editing}>
                        {editing ? <Check /> : <Pencil />}
                        {editing ? '완료' : '순서 편집'}
                    </Button>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 px-2 py-2.5">
                        <dt className="text-[11px] font-semibold text-muted-foreground">곡</dt>
                        <dd className="mt-0.5 text-base font-black tabular-nums text-foreground">{songs.length}</dd>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-2 py-2.5">
                        <dt className="text-[11px] font-semibold text-muted-foreground">예상 시간</dt>
                        <dd className="mt-0.5 text-base font-black tabular-nums text-foreground">{totalMinutes(items)}분</dd>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-2 py-2.5">
                        <dt className="text-[11px] font-semibold text-muted-foreground">Key 흐름</dt>
                        <dd className="mt-1 truncate text-xs font-black tabular-nums tracking-tight text-foreground">{songs.map((song) => song.key).join('·')}</dd>
                    </div>
                </dl>
            </section>

            <ol aria-label={`${setlist.title} 예배 순서`} className="relative space-y-3">
                <span aria-hidden="true" className="absolute bottom-6 left-[1.125rem] top-6 w-px bg-border" />
                {items.map((item, index) => {
                    const controls = editing && (
                        <div className="flex shrink-0 flex-col gap-1 self-center">
                            <Button type="button" variant="outline" size="icon-sm" aria-label="위로" disabled={index === 0} onClick={() => onMove(index, -1)}>
                                <ArrowUp />
                            </Button>
                            <Button type="button" variant="outline" size="icon-sm" aria-label="아래로" disabled={index === items.length - 1} onClick={() => onMove(index, 1)}>
                                <ArrowDown />
                            </Button>
                        </div>
                    );

                    if (item.kind === 'moment') {
                        const Icon = MOMENT_ICONS[item.moment];
                        return (
                            <li key={item.id} className="relative flex items-center gap-3">
                                <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-background text-muted-foreground">
                                    <Icon size={15} aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-2.5">
                                    <p className="text-sm font-semibold text-foreground">
                                        {item.label}
                                        <span className="ml-1.5 text-xs font-medium text-muted-foreground">{item.minutes}분</span>
                                    </p>
                                    {item.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>}
                                </div>
                                {controls}
                            </li>
                        );
                    }

                    return (
                        <li key={item.id} className="relative flex gap-3">
                            <span className="relative z-10 mt-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black tabular-nums text-primary-foreground ring-4 ring-background">
                                {numbers[index]}
                            </span>
                            <article className="min-w-0 flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-base font-bold text-foreground">{item.title}</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {item.artist} · 약 {item.minutes}분
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1 min-[400px]:flex-row min-[400px]:items-center">
                                        <KeyPill song={item} />
                                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-tight tabular-nums text-muted-foreground">
                                            {item.bpm} BPM
                                        </span>
                                    </div>
                                </div>
                                <FormChips form={item.form} className="mt-3" />
                                {item.memo && (
                                    <p className="mt-3 flex gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                                        <MessageSquareText size={14} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
                                        <span>{item.memo}</span>
                                    </p>
                                )}
                            </article>
                            {controls}
                        </li>
                    );
                })}
                {editing && (
                    <li className="relative flex gap-3">
                        <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-background text-muted-foreground">
                            <Plus size={15} aria-hidden="true" />
                        </span>
                        <div className="grid flex-1 grid-cols-2 gap-2">
                            <button type="button" className="min-h-11 rounded-2xl border border-dashed border-border bg-card/60 text-sm font-semibold text-muted-foreground hover:text-primary">곡 추가</button>
                            <button type="button" className="min-h-11 rounded-2xl border border-dashed border-border bg-card/60 text-sm font-semibold text-muted-foreground hover:text-primary">기도·멘트 추가</button>
                        </div>
                    </li>
                )}
            </ol>

            <div className="grid grid-cols-[auto_auto_1fr] gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-xs">
                <Button type="button" variant="ghost">
                    <Share2 />
                    <span className="hidden min-[400px]:inline">공유</span>
                </Button>
                <Button type="button" variant="ghost">
                    <UsersRound />
                    <span className="hidden min-[400px]:inline">팀원 화면</span>
                </Button>
                <Button type="button">
                    <Radio />
                    이 순서로 예배 열기
                </Button>
            </div>
        </div>
    );
}
