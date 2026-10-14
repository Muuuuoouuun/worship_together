"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
    Activity,
    AudioLines,
    ChevronLeft,
    ChevronRight,
    CornerDownRight,
    Radio,
    RotateCcw,
    Timer,
} from 'lucide-react';
import { getStageBeatDurationStyle, useStageBeatPhase } from '@/hooks/useStageBeatPhase';
import { buildTempoChart, formatStageElapsed, isUsableBpm } from '@/lib/stageTempo';
import type { SongRow } from '@/types/session';

const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface WorshipPulseViewProps {
    songs: SongRow[];
    currentSong: SongRow | null;
    currentSongIndex: number;
    bpm: number | null;
    bpmEnabled: boolean;
    metronomeActive: boolean;
    activeBeat: number;
    blinkActive: boolean;
    canToggleTempo: boolean;
    onToggleTempo: () => void;
    sections: string[];
    sectionIndex: number;
    displayedSection: string;
    nextSection: string;
    onPrevSection: () => void;
    onNextSection: () => void;
    onSelectSection: (section: string) => void;
    onPrevSong: () => void;
    onNextSong: () => void;
    startedAt: number | null;
    deviceCount: number;
    deviceCaption: string;
    accentPicker: ReactNode;
    onReturnToStart: () => void;
    /** 이번 주 Key 표기 (예: 'Key D (원키 C)'). 비어 있으면 곡의 key 만 보여줍니다. */
    keyLabel?: string;
    /** 이 곡에서 다음 곡으로 넘어갈 때의 메모 */
    transitionNote?: string | null;
}

function useSecondTick(enabled: boolean) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!enabled) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [enabled]);
    return now;
}

export default function WorshipPulseView({
    songs,
    currentSong,
    currentSongIndex,
    bpm,
    bpmEnabled,
    metronomeActive,
    activeBeat,
    blinkActive,
    canToggleTempo,
    onToggleTempo,
    sections,
    sectionIndex,
    displayedSection,
    nextSection,
    onPrevSection,
    onNextSection,
    onSelectSection,
    onPrevSong,
    onNextSong,
    startedAt,
    deviceCount,
    deviceCaption,
    accentPicker,
    onReturnToStart,
    keyLabel,
    transitionNote,
}: WorshipPulseViewProps) {
    const tempoBpm = isUsableBpm(bpm) ? bpm : null;
    const phaseRef = useStageBeatPhase<HTMLElement>(metronomeActive ? tempoBpm : null);
    const now = useSecondTick(startedAt !== null);
    const songIndex = currentSongIndex >= 0 ? currentSongIndex : 0;
    const prevSong = songIndex > 0 ? songs[songIndex - 1] ?? null : null;
    const nextSong = songs[songIndex + 1] ?? null;
    const progress = sections.length > 0 && sectionIndex >= 0 ? (sectionIndex + 1) / sections.length : 0;
    const angle = progress * 2 * Math.PI;
    const tip = { x: 112 + RING_RADIUS * Math.sin(angle), y: 112 - RING_RADIUS * Math.cos(angle) };
    const spark = useMemo(
        () => buildTempoChart(songs, currentSong?.id ?? null, { width: 140, height: 36, plotLeft: 6, plotRight: 6, top: 6, bottom: 6 }),
        [songs, currentSong?.id]
    );
    const elapsedLabel = startedAt !== null ? formatStageElapsed(now - startedAt) : '--:--';

    return (
        <section
            ref={phaseRef}
            data-testid="team-mode-bpm"
            aria-label="예배 진행"
            className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-[#070D0C] px-4 pb-4 pt-3.5 text-[#FFF7E8] sm:px-6 sm:pb-6"
            style={getStageBeatDurationStyle(tempoBpm) as CSSProperties}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_12rem,rgb(var(--stage-accent-rgb)/0.16)_0%,transparent_18rem)] md:bg-[radial-gradient(circle_at_27%_50%,rgb(var(--stage-accent-rgb)/0.16)_0%,transparent_22rem)]"
            />

            <div className="relative flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold tracking-[0.08em] text-(--stage-accent)">
                    진행 중 · {songIndex + 1} / {Math.max(1, songs.length)}곡
                    {keyLabel ? ` · ${keyLabel}` : currentSong?.original_key ? ` · ${currentSong.original_key}` : ''}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onReturnToStart}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        <RotateCcw size={13} aria-hidden="true" />
                        시작 화면
                    </button>
                    {accentPicker}
                </div>
            </div>

            <div className="relative mt-2 grid flex-1 content-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                <div className="min-w-0">
                    <div className="relative -mx-4 h-[15rem] overflow-hidden sm:-mx-6 md:mx-0 lg:h-[17.5rem]">
                        {prevSong ? (
                            <button
                                type="button"
                                onClick={onPrevSong}
                                aria-label={`이전 곡: ${prevSong.title}`}
                                className="absolute right-[calc(100%-3.25rem)] top-1/2 flex size-44 -translate-y-1/2 flex-col items-end justify-center gap-0.5 rounded-full border border-white/14 pr-3 text-right transition hover:border-white/30"
                            >
                                <ChevronLeft size={16} aria-hidden="true" className="text-white/60" />
                                <span className="text-[11px] text-white/60">이전</span>
                                <span className="text-xl font-light tabular-nums text-white/75">{prevSong.bpm ?? '--'}</span>
                            </button>
                        ) : null}
                        {nextSong ? (
                            <button
                                type="button"
                                onClick={onNextSong}
                                aria-label={`다음 곡: ${nextSong.title}`}
                                className="absolute left-[calc(100%-3.25rem)] top-1/2 flex size-44 -translate-y-1/2 flex-col items-start justify-center gap-0.5 rounded-full border border-white/14 pl-3 text-left transition hover:border-white/30"
                            >
                                <ChevronRight size={16} aria-hidden="true" className="text-white/60" />
                                <span className="text-[11px] text-white/60">다음</span>
                                <span className="text-xl font-light tabular-nums text-white/75">{nextSong.bpm ?? '--'}</span>
                            </button>
                        ) : null}

                        <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 lg:size-64">
                            {metronomeActive ? (
                                <div aria-hidden="true" className="stage-pulse-halo absolute inset-0 rounded-full border-[1.5px] border-(--stage-accent)/45" />
                            ) : null}
                            <svg
                                viewBox="0 0 224 224"
                                className="absolute inset-0 size-full"
                                role="img"
                                aria-label={sections.length > 0 ? `송폼 ${sectionIndex + 1} / ${sections.length} 섹션` : '송폼 섹션 없음'}
                            >
                                <circle cx={112} cy={112} r={111} fill="none" stroke="rgba(255,247,232,0.08)" strokeWidth={1} />
                                <circle cx={112} cy={112} r={RING_RADIUS} stroke="rgba(255,247,232,0.10)" strokeWidth={6} style={{ fill: 'rgb(var(--stage-accent-rgb) / 0.06)' }} />
                                {progress > 0 ? (
                                    <>
                                        <circle
                                            cx={112}
                                            cy={112}
                                            r={RING_RADIUS}
                                            fill="none"
                                            strokeWidth={6}
                                            strokeLinecap="round"
                                            strokeDasharray={`${(RING_CIRCUMFERENCE * progress).toFixed(1)} ${RING_CIRCUMFERENCE.toFixed(1)}`}
                                            transform="rotate(-90 112 112)"
                                            style={{ stroke: 'var(--stage-accent)', transition: 'stroke-dasharray 300ms ease' }}
                                        />
                                        <circle cx={tip.x.toFixed(1)} cy={tip.y.toFixed(1)} r={6} fill="#FFF7E8" strokeWidth={2} style={{ stroke: 'var(--stage-accent)' }} />
                                    </>
                                ) : null}
                            </svg>
                            <div className="absolute inset-[10%] flex flex-col items-center justify-center gap-1 text-center">
                                <span className="text-[11px] font-semibold tracking-[0.08em] text-white/65">현재 섹션</span>
                                <span className="max-w-full truncate px-2 text-[2.5rem] font-light leading-[1.05] tracking-[-0.03em]">{displayedSection}</span>
                                <span className="text-xs tabular-nums text-white/65">
                                    {sections.length > 0 && sectionIndex >= 0 ? `${sectionIndex + 1} / ${sections.length}` : '송폼 확인'}
                                </span>
                                <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-(--stage-accent)/14 px-2.5 py-1 text-xs font-semibold text-(--stage-accent)">
                                    <CornerDownRight size={13} aria-hidden="true" className="shrink-0" />
                                    <span className="truncate">다음: {nextSection}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div aria-hidden="true" className="mt-1 flex items-center justify-center gap-1.5">
                        {songs.map((song, index) => (
                            <span
                                key={song.id}
                                className={`h-1.5 rounded-full transition-all ${index === songIndex ? 'w-[1.125rem] bg-(--stage-accent)' : 'w-1.5 bg-white/25'}`}
                            />
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onPrevSection}
                            disabled={sectionIndex <= 0}
                            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/14 bg-white/[0.04] text-[13px] font-semibold transition hover:bg-white/[0.08] disabled:opacity-30"
                        >
                            <ChevronLeft size={15} aria-hidden="true" /> 이전 섹션
                        </button>
                        <button
                            type="button"
                            onClick={onNextSection}
                            disabled={sections.length === 0 || sectionIndex >= sections.length - 1}
                            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-(--stage-accent)/40 bg-(--stage-accent)/12 text-[13px] font-semibold text-(--stage-accent) transition hover:bg-(--stage-accent)/20 disabled:opacity-30"
                        >
                            다음 섹션 <ChevronRight size={15} aria-hidden="true" />
                        </button>
                    </div>
                    {sections.length > 0 ? (
                        <ol aria-label="송폼 진행 순서" className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
                            {sections.map((section, index) => (
                                <li key={`${index}:${section}`} className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => onSelectSection(section)}
                                        aria-current={index === sectionIndex ? 'step' : undefined}
                                        className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition ${index === sectionIndex ? 'border-(--stage-accent) bg-(--stage-accent)/18 text-(--stage-accent)' : index < sectionIndex ? 'border-white/10 text-white/50' : 'border-white/12 text-white/80 hover:bg-white/[0.06]'}`}
                                    >
                                        {section}
                                    </button>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    <dl className="grid grid-cols-2 border-t border-white/10">
                        <div className="flex flex-col gap-1.5 border-b border-white/10 py-3.5 pr-3.5">
                            <dt className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-(--stage-accent)">
                                <AudioLines size={15} aria-hidden="true" /> 박자
                            </dt>
                            <dd className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-light leading-none tracking-[-0.03em] tabular-nums">{tempoBpm ?? '--'}</span>
                                <span className="text-xs text-white/65">{tempoBpm ? 'BPM · 4/4' : 'BPM 미설정'}</span>
                            </dd>
                            <dd aria-hidden="true" className="flex h-7 items-end gap-1.5">
                                {[1, 2, 3, 4].map((beat) => (
                                    <span
                                        key={beat}
                                        className={`stage-pulse-bar w-3 rounded-[3px] bg-(--stage-accent) ${beat === 1 ? 'h-7' : 'h-[1.125rem]'} ${metronomeActive && activeBeat === beat && blinkActive ? 'stage-pulse-bar--on' : ''}`}
                                    />
                                ))}
                            </dd>
                            <dd>
                                <button
                                    type="button"
                                    aria-pressed={bpmEnabled}
                                    onClick={onToggleTempo}
                                    disabled={!canToggleTempo}
                                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40 ${bpmEnabled ? 'border-(--stage-accent)/50 text-(--stage-accent)' : 'border-white/14 text-white/75 hover:bg-white/[0.06]'}`}
                                >
                                    템포 가이드 {bpmEnabled ? '켜짐' : '꺼짐'}
                                </button>
                            </dd>
                        </div>
                        <div className="flex flex-col gap-1.5 border-b border-l border-white/10 py-3.5 pl-4">
                            <dt className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-(--stage-accent)">
                                <Activity size={15} aria-hidden="true" /> 다음 곡 템포
                            </dt>
                            <dd className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-light leading-none tracking-[-0.03em] tabular-nums">{nextSong ? nextSong.bpm ?? '--' : '—'}</span>
                                <span className="truncate text-xs text-white/65">
                                    {nextSong ? `BPM${nextSong.original_key ? ` · ${nextSong.original_key}` : ''}` : '마지막 곡'}
                                </span>
                            </dd>
                            <dd>
                                <svg
                                    viewBox={`0 0 ${spark.width} ${spark.height}`}
                                    className="block h-9 w-full max-w-[8.75rem] overflow-visible"
                                    role="img"
                                    aria-label={`콘티 템포 흐름 ${spark.points.map((point) => point.bpm ?? '미설정').join(', ')}`}
                                >
                                    {spark.path ? <path d={spark.path} fill="none" strokeWidth={2} strokeLinecap="round" style={{ stroke: 'rgb(var(--stage-accent-rgb) / 0.6)' }} /> : null}
                                    {spark.points.map((point) => point.y === null ? null : point.state === 'current' ? (
                                        <circle key={point.id} cx={point.x} cy={point.y} r={4} style={{ fill: 'var(--stage-accent)' }} />
                                    ) : point.index === songIndex + 1 ? (
                                        <circle key={point.id} cx={point.x} cy={point.y} r={4.5} fill="#070D0C" stroke="#FFF7E8" strokeWidth={2} />
                                    ) : (
                                        <circle key={point.id} cx={point.x} cy={point.y} r={3} fill="rgba(255,247,232,0.4)" />
                                    ))}
                                </svg>
                            </dd>
                        </div>
                        <div className="flex flex-col gap-1.5 py-3.5 pr-3.5">
                            <dt className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-(--stage-accent)">
                                <Timer size={15} aria-hidden="true" /> 예배 경과
                            </dt>
                            <dd className="text-3xl font-light leading-none tracking-[-0.02em] tabular-nums">{elapsedLabel}</dd>
                            <dd className="text-xs text-white/65">{startedAt !== null ? '카운트인 이후' : '시작 기록 없음'}</dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 border-l border-white/10 py-3.5 pl-4">
                            <dt className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-(--stage-accent)">
                                <Radio size={15} aria-hidden="true" /> 접속 기기
                            </dt>
                            <dd className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-light leading-none tracking-[-0.03em] tabular-nums">{deviceCount}</span>
                                <span className="text-xs text-white/65">대</span>
                            </dd>
                            <dd className="line-clamp-2 text-xs text-white/65">{deviceCaption}</dd>
                        </div>
                    </dl>

                    {nextSong && transitionNote ? (
                        <p className="rounded-2xl border border-(--stage-accent)/40 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold leading-snug text-[#FFF7E8]" data-testid="stage-transition-note">
                            <span className="mr-1.5 text-xs font-semibold tracking-[0.04em] text-(--stage-accent)">곡 전환</span>
                            {transitionNote}
                        </p>
                    ) : null}

                    <button
                        type="button"
                        onClick={onNextSong}
                        disabled={!nextSong}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-(--stage-accent) px-5 text-(--stage-accent-ink) shadow-[0_12px_32px_rgb(var(--stage-accent-rgb)/0.35)] transition active:scale-[0.98] disabled:bg-white/[0.08] disabled:text-white/60 disabled:shadow-none"
                    >
                        {nextSong ? (
                            <>
                                <span className="truncate text-base font-bold tracking-[-0.01em]">다음 곡 · {nextSong.title}</span>
                                <span className="shrink-0 text-[13px] font-medium opacity-75">
                                    {[nextSong.original_key, nextSong.bpm].filter(Boolean).join(' · ')}
                                </span>
                                <ChevronRight size={18} aria-hidden="true" className="shrink-0" />
                            </>
                        ) : (
                            <span className="text-base font-semibold">마지막 곡이에요</span>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
