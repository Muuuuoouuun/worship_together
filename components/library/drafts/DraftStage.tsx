'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileMusic, PlayCircle, Plus, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    DRAFT_SETLISTS,
    SECTION_NAMES,
    STATUS_META,
    dDayLabel,
    dateParts,
    dayDiff,
    formatDateLabel,
    pastSetlists,
    sectionTone,
    songNumbers,
    songsOf,
    startTimes,
    totalMinutes,
    upcomingSetlists,
    clockLabel,
    type DraftItem,
    type DraftMomentKind,
    type DraftSetlist,
    type DraftSong,
    type DraftTab,
} from './draftData';
import { MOMENT_ICONS, useDraftWorkspace } from './draftParts';

/** 시안 C · 스테이지: 콘티는 커버처럼 넘겨 보고, 순서는 템포 곡선과 큰 글씨로 흐름을 따라갑니다. */
export default function DraftStage({ initialTab }: { initialTab: DraftTab }) {
    const ws = useDraftWorkspace(initialTab);

    return (
        <div className="space-y-6">
            <div className="sticky top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 flex justify-center lg:top-4">
                <div role="tablist" aria-label="콘티 화면 전환" className="inline-flex gap-1 rounded-full border border-border/80 bg-card/90 p-1 shadow-lg backdrop-blur-md">
                    {(['setlists', 'order'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={ws.tab === value}
                            onClick={() => ws.setTab(value)}
                            className={cn(
                                'min-h-11 rounded-full px-6 text-sm font-bold transition-all',
                                ws.tab === value ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {value === 'setlists' ? '콘티' : '순서'}
                        </button>
                    ))}
                </div>
            </div>

            {ws.tab === 'setlists' ? (
                <StageSetlists onOpen={ws.openOrder} />
            ) : (
                <StageOrder setlist={ws.setlist} items={ws.items} onSelect={ws.selectSetlist} />
            )}
        </div>
    );
}

/* ───────────────────────── 콘티 탭 ───────────────────────── */

function StageSetlists({ onOpen }: { onOpen: (id: string) => void }) {
    const [hero, ...upcoming] = upcomingSetlists(DRAFT_SETLISTS);
    const past = pastSetlists(DRAFT_SETLISTS);

    return (
        <div className="space-y-8">
            {hero && <StageCover setlist={hero} onOpen={onOpen} />}

            <section aria-labelledby="stage-upcoming" className="space-y-3">
                <h3 id="stage-upcoming" className="text-sm font-bold text-foreground">이어서 준비할 콘티</h3>
                <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                    {upcoming.map((setlist) => (
                        <StageMiniCover key={setlist.id} setlist={setlist} onOpen={onOpen} />
                    ))}
                    <button
                        type="button"
                        className="flex w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-card/50 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                        <Plus size={20} />
                        새 콘티
                    </button>
                </div>
            </section>

            <section aria-labelledby="stage-past" className="space-y-3">
                <h3 id="stage-past" className="text-sm font-bold text-foreground">지난 예배</h3>
                <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                    {past.map((setlist) => (
                        <StageMiniCover key={setlist.id} setlist={setlist} onOpen={onOpen} muted />
                    ))}
                </div>
            </section>
        </div>
    );
}

function StageCover({ setlist, onOpen }: { setlist: DraftSetlist; onOpen: (id: string) => void }) {
    const songs = songsOf(setlist.items);
    return (
        <article className="relative overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-lg sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-primary-foreground/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-44 rounded-full border border-primary-foreground/10" />

            <p className="relative text-xs font-bold tracking-[0.18em] opacity-75">
                이번 주 · {dDayLabel(setlist.date)}
            </p>
            <h2 className="relative mt-4 font-serif text-[2rem] font-black leading-[1.15] sm:text-5xl">{setlist.theme}</h2>
            <p className="relative mt-3 text-sm opacity-80">
                {formatDateLabel(setlist)} · {setlist.title} · 인도 {setlist.leader}
            </p>

            <TempoSparkline songs={songs} className="relative mt-6 h-14 w-full text-primary-foreground/70" />
            <p className="relative mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold opacity-80">
                <span>{songs.length}곡</span>
                <span>약 {totalMinutes(setlist.items)}분</span>
                <span className="tabular-nums">{songs.map((song) => song.key).join(' → ')}</span>
            </p>

            <div className="relative mt-6 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => onOpen(setlist.id)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-foreground px-5 text-sm font-bold text-primary transition hover:opacity-90 active:scale-[0.98]"
                >
                    순서 열기
                    <ArrowRight size={16} />
                </button>
                <button
                    type="button"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-semibold transition hover:bg-primary-foreground/10"
                >
                    <Radio size={16} />
                    예배 입장
                </button>
            </div>
        </article>
    );
}

function StageMiniCover({ setlist, onOpen, muted = false }: { setlist: DraftSetlist; onOpen: (id: string) => void; muted?: boolean }) {
    const songs = songsOf(setlist.items);
    const status = STATUS_META[setlist.status];
    const { month, day, weekday } = dateParts(setlist.date);
    return (
        <button
            type="button"
            onClick={() => onOpen(setlist.id)}
            className={cn(
                'card-interactive flex w-60 shrink-0 snap-start flex-col rounded-3xl border border-border/80 bg-card p-5 text-left shadow-xs hover:border-primary/40',
                muted && 'w-52 bg-card/70',
            )}
        >
            <span className="flex items-start justify-between gap-2">
                <span className="leading-none">
                    <span className={cn('block font-serif text-4xl font-black tabular-nums', muted ? 'text-muted-foreground' : 'text-primary')}>{day}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-muted-foreground">{month}월 · {weekday}요일 {setlist.time}</span>
                </span>
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
            </span>
            <span className="mt-4 block truncate text-base font-bold text-foreground">{setlist.theme}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{setlist.title} · {songs.length}곡</span>
            <TempoSparkline songs={songs} className={cn('mt-4 h-8 w-full', muted ? 'text-muted-foreground/50' : 'text-secondary')} />
        </button>
    );
}

/** 장식용 템포 실루엣. 정확한 값은 순서 탭의 템포 흐름 차트에서 읽습니다. */
function TempoSparkline({ songs, className }: { songs: DraftSong[]; className?: string }) {
    if (songs.length < 2) return <div className={className} />;
    const min = Math.min(...songs.map((song) => song.bpm)) - 6;
    const max = Math.max(...songs.map((song) => song.bpm)) + 6;
    const points = songs.map((song, index) => {
        const x = (index / (songs.length - 1)) * 100;
        const y = 100 - ((song.bpm - min) / (max - min)) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return (
        <svg aria-hidden="true" viewBox="-2 -8 104 116" preserveAspectRatio="none" className={className}>
            <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/* ───────────────────────── 순서 탭 ───────────────────────── */

function StageOrder({ setlist, items, onSelect }: { setlist: DraftSetlist; items: DraftItem[]; onSelect: (id: string) => void }) {
    const [openId, setOpenId] = useState<string | null>(null);
    const chronological = [...DRAFT_SETLISTS].sort((a, b) => dayDiff(a.date) - dayDiff(b.date));
    const position = chronological.findIndex((item) => item.id === setlist.id);
    const prev = chronological[position - 1];
    const next = chronological[position + 1];
    const numbers = songNumbers(items);
    const times = startTimes(items, setlist.time);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="icon" aria-label={prev ? `이전 콘티: ${prev.date}` : '이전 콘티 없음'} disabled={!prev} onClick={() => prev && onSelect(prev.id)}>
                    <ChevronLeft />
                </Button>
                <div className="min-w-0 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">{formatDateLabel(setlist)} · {dDayLabel(setlist.date)}</p>
                    <h2 className="mt-1 truncate font-serif text-2xl font-black text-primary sm:text-3xl">{setlist.theme}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{setlist.title} · 인도 {setlist.leader}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={next ? `다음 콘티: ${next.date}` : '다음 콘티 없음'} disabled={!next} onClick={() => next && onSelect(next.id)}>
                    <ChevronRight />
                </Button>
            </div>

            <TempoFlowChart setlist={setlist} items={items} />

            <ol aria-label={`${setlist.title} 예배 순서`} className="space-y-1">
                {items.map((item, index) => {
                    if (item.kind === 'moment') {
                        const Icon = MOMENT_ICONS[item.moment];
                        return (
                            <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
                                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                                <Icon size={14} aria-hidden="true" />
                                <span className="font-semibold">{item.label}</span>
                                <span className="tabular-nums">{item.minutes}분</span>
                                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                            </li>
                        );
                    }

                    const open = openId === item.id;
                    const changed = item.key !== item.originalKey;
                    return (
                        <li key={item.id} className={cn('rounded-3xl border transition-colors', open ? 'border-border bg-card shadow-xs' : 'border-transparent hover:bg-card/60')}>
                            <button
                                type="button"
                                aria-expanded={open}
                                onClick={() => setOpenId(open ? null : item.id)}
                                className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 pt-4 text-left sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
                            >
                                <span className="font-serif text-3xl font-black tabular-nums text-primary/30 sm:text-4xl">
                                    {String(numbers[index]).padStart(2, '0')}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-lg font-bold text-foreground sm:text-xl">{item.title}</span>
                                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                        <span
                                            aria-hidden="true"
                                            className="bpm-step-dot inline-block size-1.5 rounded-full bg-secondary"
                                            style={{ '--beat-duration': `${(60 / item.bpm).toFixed(3)}s` } as CSSProperties}
                                        />
                                        <span className="tabular-nums">{item.bpm} BPM</span>
                                        <span aria-hidden="true">·</span>
                                        <span className="tabular-nums">{times[index]}</span>
                                        <span aria-hidden="true">·</span>
                                        <span>{item.minutes}분</span>
                                    </span>
                                </span>
                                <span className="flex flex-col items-center gap-1">
                                    <span className={cn('flex size-11 items-center justify-center rounded-full border-2 text-base font-black', changed ? 'border-secondary text-secondary' : 'border-primary/70 text-primary')}>
                                        {item.key}
                                    </span>
                                    <span className={cn('text-[10px] font-semibold', changed ? 'text-secondary' : 'text-muted-foreground')}>
                                        {changed ? `원키 ${item.originalKey}` : 'Key'}
                                    </span>
                                </span>
                            </button>

                            <div className="px-3 pb-4 pl-[4.25rem] sm:pl-[5rem]">
                                <FormBar form={item.form} />
                                {open && (
                                    <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                                        {item.memo && (
                                            <p className="border-l-2 border-secondary pl-3 text-sm leading-relaxed text-foreground">{item.memo}</p>
                                        )}
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {item.form.map((code) => SECTION_NAMES[code] ?? code).join(' → ')}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button type="button" variant="outline" size="sm">
                                                <FileMusic />
                                                악보
                                            </Button>
                                            <Button type="button" variant="outline" size="sm">
                                                <PlayCircle />
                                                연습 영상
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {!open && (item.memo || item.form.length > 0) && (
                                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground" aria-hidden="true">
                                        <ChevronDown size={12} />
                                        {item.memo ? '메모 · 악보' : '악보'}
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>

            <button
                type="button"
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.99]"
            >
                <Radio size={17} />
                이 흐름으로 예배 입장
            </button>
        </div>
    );
}

function FormBar({ form }: { form: string[] }) {
    return (
        <ol aria-label="송폼 진행 순서" className="flex gap-[2px]">
            {form.map((code, index) => {
                const tone = sectionTone(code);
                return (
                    <li
                        key={`${code}-${index}`}
                        title={SECTION_NAMES[code] ?? code}
                        className={cn(
                            'flex h-6 min-w-0 flex-1 items-center justify-center text-[10px] font-bold first:rounded-l-md last:rounded-r-md',
                            tone === 'chorus' && 'bg-primary text-primary-foreground',
                            tone === 'bridge' && 'bg-accent text-accent-foreground',
                            tone === 'plain' && 'bg-muted text-muted-foreground',
                        )}
                    >
                        {code}
                    </li>
                );
            })}
        </ol>
    );
}

/* ───────────────────────── 템포 흐름 차트 ───────────────────────── */

const CHART_HEIGHT = 188;
const PAD = { top: 30, right: 14, bottom: 26, left: 34 };
const Y_TICKS = [60, 90, 120];
const MOMENT_SHORT: Record<DraftMomentKind, string> = { prayer: '기도', word: '말씀', transition: '전환' };

function useElementWidth<T extends HTMLElement>(fallback: number) {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

/** 단일 계열(BPM) 라인 차트: x축은 예배 진행 시간, 기도·멘트 구간은 음영 띠로 표시합니다. */
function TempoFlowChart({ setlist, items }: { setlist: DraftSetlist; items: DraftItem[] }) {
    const [ref, width] = useElementWidth<HTMLDivElement>(640);
    const [active, setActive] = useState<number | null>(null);
    const total = totalMinutes(items);
    const numbers = songNumbers(items);
    const times = startTimes(items, setlist.time);
    const [startH, startM] = setlist.time.split(':').map(Number);

    const bpms = songsOf(items).map((song) => song.bpm);
    const yMin = Math.min(50, ...bpms.map((bpm) => bpm - 8));
    const yMax = Math.max(135, ...bpms.map((bpm) => bpm + 8));
    const plotW = Math.max(width - PAD.left - PAD.right, 10);
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const x = (minute: number) => PAD.left + (minute / Math.max(total, 1)) * plotW;
    const y = (bpm: number) => PAD.top + (1 - (bpm - yMin) / (yMax - yMin)) * plotH;

    const spans = items.map((item, index) => {
        const from = totalMinutes(items.slice(0, index));
        return { item, index, from, to: from + item.minutes };
    });
    const points = spans
        .filter((span): span is typeof span & { item: DraftSong } => span.item.kind === 'song')
        .map((span) => ({ ...span, cx: x((span.from + span.to) / 2), cy: y(span.item.bpm) }));
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.cx.toFixed(1)},${point.cy.toFixed(1)}`).join(' ');
    const activePoint = points.find((point) => point.index === active);

    return (
        <figure className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
            <figcaption className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground">템포 흐름</span>
                <span className="text-[11px] text-muted-foreground">BPM · 점을 눌러 곡 정보 보기</span>
            </figcaption>

            <div ref={ref} className="relative mt-2" onMouseLeave={() => setActive(null)}>
                <svg width={width} height={CHART_HEIGHT} className="block overflow-visible" role="img" aria-label={`템포 흐름: ${points.map((point) => `${numbers[point.index]}번 ${point.item.bpm} BPM`).join(', ')}`}>
                    {spans.filter((span) => span.item.kind === 'moment').map((span) => (
                        <g key={span.item.id}>
                            <rect x={x(span.from)} y={PAD.top - 8} width={Math.max(x(span.to) - x(span.from), 1)} height={plotH + 8} className="fill-muted" rx={4} />
                            {x(span.to) - x(span.from) > 30 && (
                                <text x={(x(span.from) + x(span.to)) / 2} y={PAD.top + plotH - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold">
                                    {span.item.kind === 'moment' ? MOMENT_SHORT[span.item.moment] : ''}
                                </text>
                            )}
                        </g>
                    ))}

                    {Y_TICKS.filter((tick) => tick > yMin && tick < yMax).map((tick) => (
                        <g key={tick}>
                            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" />
                            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                                {tick}
                            </text>
                        </g>
                    ))}

                    <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} className="stroke-border" strokeWidth={1} />
                    <text x={PAD.left} y={CHART_HEIGHT - 6} className="fill-muted-foreground text-[10px] tabular-nums">{setlist.time}</text>
                    <text x={PAD.left + plotW} y={CHART_HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                        {clockLabel(startH * 60 + startM + total)}
                    </text>

                    {activePoint && (
                        <line x1={activePoint.cx} x2={activePoint.cx} y1={PAD.top - 8} y2={PAD.top + plotH} className="stroke-input" strokeWidth={1} />
                    )}

                    <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                    {points.map((point) => (
                        <g key={point.item.id}>
                            <text x={point.cx} y={point.cy - 12} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">
                                {numbers[point.index]}
                            </text>
                            <circle cx={point.cx} cy={point.cy} r={active === point.index ? 7 : 5} className="fill-primary stroke-card transition-[r]" strokeWidth={2} />
                        </g>
                    ))}

                    {points.map((point, order) => {
                        const left = order === 0 ? PAD.left : (points[order - 1].cx + point.cx) / 2;
                        const right = order === points.length - 1 ? PAD.left + plotW : (point.cx + points[order + 1].cx) / 2;
                        return (
                            <rect
                                key={`hit-${point.item.id}`}
                                x={left}
                                y={0}
                                width={Math.max(right - left, 1)}
                                height={CHART_HEIGHT}
                                fill="transparent"
                                tabIndex={0}
                                role="button"
                                aria-label={`${numbers[point.index]}. ${point.item.title}, Key ${point.item.key}, ${point.item.bpm} BPM`}
                                onMouseEnter={() => setActive(point.index)}
                                onFocus={() => setActive(point.index)}
                                onBlur={() => setActive(null)}
                                onClick={() => setActive(point.index)}
                                className="cursor-pointer outline-none"
                            />
                        );
                    })}
                </svg>

                {activePoint && (
                    <div
                        role="status"
                        className="pointer-events-none absolute z-10 w-max max-w-[13rem] -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
                        style={{
                            left: Math.min(Math.max(activePoint.cx, 96), width - 96),
                            top: activePoint.cy - 18,
                        }}
                    >
                        <p className="truncate font-bold text-foreground">
                            {numbers[activePoint.index]}. {activePoint.item.title}
                        </p>
                        <p className="mt-0.5 tabular-nums text-muted-foreground">
                            Key {activePoint.item.key} · {activePoint.item.bpm} BPM · {times[activePoint.index]}
                        </p>
                    </div>
                )}
            </div>
        </figure>
    );
}
