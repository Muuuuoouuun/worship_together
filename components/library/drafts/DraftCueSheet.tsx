'use client';

import { useState, type CSSProperties } from 'react';
import { MessageSquareText, Plus, Printer, Radio, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    DRAFT_SETLISTS,
    STATUS_META,
    clockLabel,
    dDayLabel,
    dateParts,
    dayDiff,
    pastSetlists,
    songNumbers,
    songsOf,
    startTimes,
    totalMinutes,
    upcomingSetlists,
    type DraftItem,
    type DraftSetlist,
    type DraftTab,
} from './draftData';
import { KeyPill, MOMENT_ICONS } from './draftParts';

/** 기도·멘트 구간: 곡과 색이 아닌 질감으로도 구분되도록 사선 패턴을 씁니다. */
const MOMENT_STRIPES: CSSProperties = {
    backgroundColor: 'var(--muted)',
    backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklab, var(--muted-foreground) 28%, transparent) 4px 6px)',
};

const ROW_COLUMNS = 'sm:grid-cols-[3.25rem_1.75rem_minmax(0,1fr)_4.25rem_3rem_minmax(0,12.5rem)_2.75rem]';

/** 시안 B · 큐시트: 시간 축을 기준으로 순서를 읽는 운영표. 데스크톱은 콘티·순서를 나란히 둡니다. */
export default function DraftCueSheet({ initialTab }: { initialTab: DraftTab }) {
    const ws = useCueWorkspace(initialTab);
    const end = endTime(ws.setlist, ws.items);

    return (
        <div className="space-y-4">
            <div role="tablist" aria-label="콘티 화면 전환" className="flex items-end gap-1 border-b border-border lg:hidden">
                <CueTab active={ws.tab === 'setlists'} onClick={() => ws.setTab('setlists')} label="콘티" meta={`${DRAFT_SETLISTS.length}`} />
                <CueTab active={ws.tab === 'order'} onClick={() => ws.setTab('order')} label="순서" meta={`${ws.setlist.time}–${end}`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
                <div className={cn(ws.tab !== 'setlists' && 'hidden lg:block')}>
                    <CueSetlistPanel selectedId={ws.setlist.id} onOpen={ws.openOrder} />
                </div>
                <div className={cn(ws.tab !== 'order' && 'hidden lg:block')}>
                    <CueOrderPanel setlist={ws.setlist} items={ws.items} />
                </div>
            </div>
        </div>
    );
}

function useCueWorkspace(initialTab: DraftTab) {
    const [tab, setTab] = useState<DraftTab>(initialTab);
    const [selectedId, setSelectedId] = useState(DRAFT_SETLISTS[0].id);
    const setlist = DRAFT_SETLISTS.find((item) => item.id === selectedId) ?? DRAFT_SETLISTS[0];

    function openOrder(id: string) {
        setSelectedId(id);
        setTab('order');
    }

    return { tab, setTab, setlist, items: setlist.items, openOrder };
}

function endTime(setlist: DraftSetlist, items: DraftItem[]): string {
    const [h, m] = setlist.time.split(':').map(Number);
    return clockLabel(h * 60 + m + totalMinutes(items));
}

function CueTab({ active, onClick, label, meta }: { active: boolean; onClick: () => void; label: string; meta: string }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={cn(
                '-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors',
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
            <span
                className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
            >
                {meta}
            </span>
        </button>
    );
}

/* ───────────────────────── 콘티 패널 ───────────────────────── */

function CueSetlistPanel({ selectedId, onOpen }: { selectedId: string; onOpen: (id: string) => void }) {
    const upcoming = upcomingSetlists(DRAFT_SETLISTS);
    const past = pastSetlists(DRAFT_SETLISTS);
    const strip = [...past].reverse().concat(upcoming);
    const todayIndex = past.length;

    return (
        <section aria-labelledby="cue-setlists" className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 id="cue-setlists" className="text-sm font-bold text-foreground">콘티</h2>
                <Button type="button" variant="outline" size="xs">
                    <Plus />
                    새 콘티
                </Button>
            </header>

            <div className="no-scrollbar flex items-stretch gap-1.5 overflow-x-auto border-b border-border px-4 py-3" aria-label="예배 날짜">
                {strip.map((setlist, index) => {
                    const { month, day, weekday } = dateParts(setlist.date);
                    const active = setlist.id === selectedId;
                    return (
                        <div key={setlist.id} className="flex items-stretch gap-1.5">
                            {index === todayIndex && (
                                <span className="flex w-7 shrink-0 flex-col items-center justify-center gap-1 text-[10px] font-bold text-secondary">
                                    <span className="h-full w-px bg-secondary/50" aria-hidden="true" />
                                    오늘
                                    <span className="h-full w-px bg-secondary/50" aria-hidden="true" />
                                </span>
                            )}
                            <button
                                type="button"
                                aria-pressed={active}
                                aria-label={`${month}월 ${day}일 ${setlist.title}`}
                                onClick={() => onOpen(setlist.id)}
                                className={cn(
                                    'flex w-12 shrink-0 flex-col items-center rounded-lg border py-1.5 leading-none transition',
                                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/40',
                                    setlist.status === 'done' && !active && 'text-muted-foreground',
                                )}
                            >
                                <span className="text-[10px] font-semibold opacity-75">{weekday}</span>
                                <span className="mt-1 font-mono text-lg font-black tabular-nums">{day}</span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'mt-1 size-1.5 rounded-full',
                                        setlist.status === 'confirmed' && 'bg-emerald-500',
                                        setlist.status === 'draft' && 'bg-amber-500',
                                        setlist.status === 'done' && 'bg-muted-foreground/40',
                                    )}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>

            <CueSetlistGroup label="예정" setlists={upcoming} selectedId={selectedId} onOpen={onOpen} />
            <CueSetlistGroup label="지난 예배" setlists={past} selectedId={selectedId} onOpen={onOpen} />
        </section>
    );
}

function CueSetlistGroup({ label, setlists, selectedId, onOpen }: { label: string; setlists: DraftSetlist[]; selectedId: string; onOpen: (id: string) => void }) {
    return (
        <div>
            <p className="border-b border-border/70 bg-muted/40 px-4 py-1.5 text-[11px] font-bold tracking-wider text-muted-foreground">{label}</p>
            <ul>
                {setlists.map((setlist) => {
                    const songs = songsOf(setlist.items);
                    const status = STATUS_META[setlist.status];
                    const { month, day, weekday } = dateParts(setlist.date);
                    const active = setlist.id === selectedId;
                    const past = dayDiff(setlist.date) < 0;
                    return (
                        <li key={setlist.id} className="border-b border-border/70 last:border-b-0">
                            <button
                                type="button"
                                aria-current={active ? 'true' : undefined}
                                onClick={() => onOpen(setlist.id)}
                                className={cn(
                                    'grid min-h-16 w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40',
                                    active && 'bg-primary/[0.06] shadow-[inset_3px_0_0_var(--primary)]',
                                )}
                            >
                                <span className="font-mono leading-tight tabular-nums">
                                    <span className={cn('block text-sm font-black', past ? 'text-muted-foreground' : 'text-foreground')}>
                                        {String(month).padStart(2, '0')}.{String(day).padStart(2, '0')}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground">
                                        {weekday} {setlist.time}
                                    </span>
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-bold text-foreground">{setlist.title}</span>
                                        <Badge variant={status.variant} size="sm" className="shrink-0">{status.label}</Badge>
                                    </span>
                                    <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                                        {songs.map((song) => song.key).join(' · ')} — {songs.length}곡 {totalMinutes(setlist.items)}′
                                    </span>
                                </span>
                                <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">{dDayLabel(setlist.date)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* ───────────────────────── 순서 패널 ───────────────────────── */

function CueOrderPanel({ setlist, items }: { setlist: DraftSetlist; items: DraftItem[] }) {
    const [showMemo, setShowMemo] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const times = startTimes(items, setlist.time);
    const numbers = songNumbers(items);
    const songs = songsOf(items);
    const total = totalMinutes(items);
    const end = endTime(setlist, items);
    const { month, day, weekday } = dateParts(setlist.date);

    return (
        <section aria-labelledby="cue-order" className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground">순서 · 큐시트</p>
                    <h2 id="cue-order" className="mt-1 text-lg font-bold text-foreground">
                        <span className="font-mono tabular-nums">{month}.{day} ({weekday})</span> {setlist.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {setlist.theme} · 인도 {setlist.leader}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" aria-label="인쇄용 큐시트">
                        <Printer />
                        <span className="hidden sm:inline">인쇄</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" aria-label="공유">
                        <Share2 />
                        <span className="hidden sm:inline">공유</span>
                    </Button>
                    <Button type="button" size="sm">
                        <Radio />
                        예배 열기
                    </Button>
                </div>
            </header>

            <dl className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
                <div className="px-2 py-3">
                    <dt className="text-[11px] font-semibold text-muted-foreground">시작</dt>
                    <dd className="mt-0.5 font-mono text-base font-black tabular-nums text-foreground">{setlist.time}</dd>
                </div>
                <div className="px-2 py-3">
                    <dt className="text-[11px] font-semibold text-muted-foreground">종료 예상</dt>
                    <dd className="mt-0.5 font-mono text-base font-black tabular-nums text-foreground">{end}</dd>
                </div>
                <div className="px-2 py-3">
                    <dt className="text-[11px] font-semibold text-muted-foreground">구성</dt>
                    <dd className="mt-0.5 text-base font-black tabular-nums text-foreground">
                        {songs.length}곡 <span className="text-xs font-semibold text-muted-foreground">/ {items.length}순서</span>
                    </dd>
                </div>
            </dl>

            <div className="border-b border-border px-4 py-3 sm:px-5">
                <div className="flex h-7 gap-[2px] overflow-hidden rounded-md" aria-label={`전체 ${total}분 시간 배분`} role="img">
                    {items.map((item, index) => (
                        <span
                            key={item.id}
                            title={`${times[index]} ${item.kind === 'song' ? item.title : item.label} · ${item.minutes}분`}
                            onMouseEnter={() => setActiveId(item.id)}
                            onMouseLeave={() => setActiveId(null)}
                            style={item.kind === 'song' ? { flexGrow: item.minutes, flexBasis: 0 } : { ...MOMENT_STRIPES, flexGrow: item.minutes, flexBasis: 0 }}
                            className={cn(
                                'flex min-w-0 items-center justify-center text-[10px] font-black tabular-nums transition-opacity first:rounded-l-[4px] last:rounded-r-[4px]',
                                item.kind === 'song' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                                activeId && activeId !== item.id && 'opacity-40',
                            )}
                        >
                            {numbers[index] ?? ''}
                        </span>
                    ))}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                    <span>{setlist.time}</span>
                    <span>{total}분</span>
                    <span>{end}</span>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <p className="text-xs text-muted-foreground">
                    <span className="mr-1.5 inline-block size-2 rounded-sm bg-primary align-middle" aria-hidden="true" />곡
                    <span className="ml-3 mr-1.5 inline-block size-2 rounded-sm align-middle" style={MOMENT_STRIPES} aria-hidden="true" />기도·멘트
                </p>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                    <input type="checkbox" checked={showMemo} onChange={(event) => setShowMemo(event.target.checked)} className="size-4 accent-[var(--primary)]" />
                    메모 표시
                </label>
            </div>

            <div aria-hidden="true" className={cn('hidden gap-3 border-y border-border bg-muted/40 px-5 py-2 text-[11px] font-bold text-muted-foreground sm:grid', ROW_COLUMNS)}>
                <span>시작</span>
                <span>#</span>
                <span>곡 · 순서</span>
                <span>Key</span>
                <span>BPM</span>
                <span>송폼</span>
                <span className="text-right">길이</span>
            </div>

            <ol aria-label={`${setlist.title} 큐시트`} className="border-t border-border sm:border-t-0">
                {items.map((item, index) => {
                    const active = activeId === item.id;
                    const rowEvents = {
                        onMouseEnter: () => setActiveId(item.id),
                        onMouseLeave: () => setActiveId(null),
                    };

                    if (item.kind === 'moment') {
                        const Icon = MOMENT_ICONS[item.moment];
                        return (
                            <li
                                key={item.id}
                                {...rowEvents}
                                className={cn(
                                    'grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-2.5 sm:px-5',
                                    'sm:grid-cols-[3.25rem_1.75rem_minmax(0,1fr)_2.75rem]',
                                    active && 'bg-muted/70',
                                )}
                            >
                                <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">{times[index]}</span>
                                <Icon size={14} className="hidden text-muted-foreground sm:block" aria-hidden="true" />
                                <span className="min-w-0">
                                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                                    {showMemo && item.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>}
                                </span>
                                <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{item.minutes}′</span>
                            </li>
                        );
                    }

                    return (
                        <li key={item.id} {...rowEvents} className={cn('border-b border-border/70 px-4 py-3 transition-colors sm:px-5', active && 'bg-primary/[0.05]')}>
                            {/* 모바일: 시간 + 2줄 요약 */}
                            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 sm:hidden">
                                <span className="pt-0.5 font-mono text-xs font-bold tabular-nums text-foreground">{times[index]}</span>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2">
                                        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-black tabular-nums text-primary-foreground">{numbers[index]}</span>
                                        <span className="truncate text-sm font-bold text-foreground">{item.title}</span>
                                    </p>
                                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                        <KeyPill song={item} />
                                        <span className="font-mono tabular-nums">{item.bpm} BPM</span>
                                        <span className="font-mono tabular-nums">{item.minutes}′</span>
                                    </p>
                                    <p className="mt-1.5 truncate font-mono text-[11px] tracking-tight text-muted-foreground">{item.form.join(' ')}</p>
                                    {showMemo && item.memo && <CueMemo memo={item.memo} />}
                                </div>
                            </div>

                            {/* 태블릿·데스크톱: 표 형태 */}
                            <div className={cn('hidden items-start gap-3 sm:grid', ROW_COLUMNS)}>
                                <span className="pt-0.5 font-mono text-xs font-bold tabular-nums text-foreground">{times[index]}</span>
                                <span className="flex size-5 items-center justify-center rounded bg-primary text-[11px] font-black tabular-nums text-primary-foreground">{numbers[index]}</span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                                    <p className="text-[11px] text-muted-foreground">{item.artist}</p>
                                    {showMemo && item.memo && <CueMemo memo={item.memo} />}
                                </div>
                                <span><KeyPill song={item} /></span>
                                <span className="pt-0.5 font-mono text-xs font-bold tabular-nums text-foreground">{item.bpm}</span>
                                <span className="pt-0.5 font-mono text-[11px] leading-relaxed tracking-tight text-muted-foreground">{item.form.join(' ')}</span>
                                <span className="pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{item.minutes}′</span>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <footer className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-xs sm:px-5">
                <span className="font-semibold text-muted-foreground">합계</span>
                <span className="font-mono font-bold tabular-nums text-foreground">
                    {songs.length}곡 · {total}분 · {setlist.time}–{end}
                </span>
            </footer>
        </section>
    );
}

function CueMemo({ memo }: { memo: string }) {
    return (
        <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-secondary">
            <MessageSquareText size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{memo}</span>
        </p>
    );
}
