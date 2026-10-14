"use client";

import Link from 'next/link';
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, Heart, Play, Radio } from 'lucide-react';
import { useVisualMetronome } from '@/components/session/SessionBpmConsole';
import { getStageBeatDurationStyle, useStageBeatPhase } from '@/hooks/useStageBeatPhase';
import { buildTempoChart, isUsableBpm } from '@/lib/stageTempo';
import type { SessionFeedbackRole, SessionParticipant, SongRow } from '@/types/session';

type StartTab = 'tempo' | 'team' | 'signal';

const START_TABS: Array<{ id: StartTab; label: string }> = [
    { id: 'tempo', label: '템포 흐름' },
    { id: 'team', label: '팀 접속' },
    { id: 'signal', label: '시작 신호' },
];

// Beat ticks sit on the inner ring (inset 22/280 of the pulse) at 12, 3, 6 and 9 o'clock.
const BEAT_TICKS = [
    { beat: 1, left: '50%', top: '7.86%' },
    { beat: 2, left: '92.14%', top: '50%' },
    { beat: 3, left: '50%', top: '92.14%' },
    { beat: 4, left: '7.86%', top: '50%' },
] as const;

interface WorshipStartScreenProps {
    workspaceHref: string;
    teamName: string;
    setlistTitle: string;
    songs: SongRow[];
    currentSong: SongRow | null;
    bpm: number | null;
    isActive: boolean;
    participants: SessionParticipant[];
    myRole: SessionFeedbackRole;
    roleLabels: Record<SessionFeedbackRole, string>;
    onChangeRole: (role: SessionFeedbackRole) => void;
    connectionLabel: string;
    canSendSignal: boolean;
    sendStartSignal: boolean;
    onToggleStartSignal: () => void;
    startSignalMessage: string;
    accentPicker: ReactNode;
    onStart: () => void;
    onSkip: () => void;
}

export default function WorshipStartScreen({
    workspaceHref,
    teamName,
    setlistTitle,
    songs,
    currentSong,
    bpm,
    isActive,
    participants,
    myRole,
    roleLabels,
    onChangeRole,
    connectionLabel,
    canSendSignal,
    sendStartSignal,
    onToggleStartSignal,
    startSignalMessage,
    accentPicker,
    onStart,
    onSkip,
}: WorshipStartScreenProps) {
    const [tab, setTab] = useState<StartTab>('tempo');
    const tabsId = useId();
    const pulseBpm = isUsableBpm(bpm) ? bpm : null;
    // The opening tempo previews on this device even before the shared tempo guide is turned on.
    const { activeBeat, blinkActive } = useVisualMetronome(Boolean(pulseBpm), pulseBpm);
    const phaseRef = useStageBeatPhase<HTMLDivElement>(pulseBpm);
    const chart = useMemo(() => buildTempoChart(songs, currentSong?.id ?? null, { width: 320, height: 112 }), [songs, currentSong?.id]);
    const deviceCount = participants.length + 1;

    return (
        <div
            ref={phaseRef}
            className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
            style={getStageBeatDurationStyle(pulseBpm) as CSSProperties}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-16 top-8 h-[30rem] w-[calc(100%+8rem)]"
                style={{ background: 'radial-gradient(circle at 50% 45%, rgb(var(--stage-accent-rgb) / 0.18) 0%, transparent 60%)' }}
            />

            <header className="relative flex h-12 items-center justify-between gap-2">
                <Link
                    href={workspaceHref}
                    aria-label="기본 세션 화면으로 돌아가기"
                    className="tap-target inline-flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#FFF7E8] transition hover:bg-white/10"
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                </Link>
                <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                    <h1 className="max-w-[14rem] truncate text-[17px] font-semibold tracking-[-0.02em]">{setlistTitle}</h1>
                    <p className="max-w-[14rem] truncate text-xs text-white/70">{teamName}</p>
                </div>
                {accentPicker}
            </header>

            <p className="relative mt-3.5 text-center text-xs font-semibold tracking-[0.08em] text-(--stage-accent)">
                예배 시작 전 · 오프닝 템포
            </p>

            <div className="relative mx-auto mt-4 aspect-square w-full max-w-[17.5rem] shrink-0">
                <div aria-hidden="true" className="absolute inset-0 rounded-full border border-(--stage-accent)/15" />
                <div aria-hidden="true" className="absolute inset-[7.86%] rounded-full border border-(--stage-accent)/25" />
                <div aria-hidden="true" className="absolute inset-[17.14%] rounded-full border-[1.5px] border-(--stage-accent)/35 bg-(--stage-accent)/[0.06]" />
                {pulseBpm ? (
                    <>
                        <div aria-hidden="true" className="stage-pulse-ripple absolute inset-0 rounded-full border-2 border-(--stage-accent)" />
                        <div aria-hidden="true" className="stage-pulse-orbit absolute inset-[7.86%]">
                            <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF7E8] shadow-[0_0_14px_var(--stage-accent),0_0_4px_var(--stage-accent)]" />
                        </div>
                    </>
                ) : null}
                {BEAT_TICKS.map((tick) => (
                    <span
                        key={tick.beat}
                        aria-hidden="true"
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: tick.left, top: tick.top }}
                    >
                        <span
                            className={`stage-pulse-tick block rounded-full bg-(--stage-accent) ${tick.beat === 1 ? 'size-2.5' : 'size-2'} ${pulseBpm && activeBeat === tick.beat && blinkActive ? 'stage-pulse-tick--on' : ''}`}
                        />
                    </span>
                ))}

                <div
                    aria-hidden="true"
                    className={`absolute inset-[30%] flex items-center justify-center rounded-full ${pulseBpm ? 'stage-pulse-disc' : ''}`}
                    style={{
                        background: 'radial-gradient(circle at 32% 26%, var(--stage-accent-light) 0%, var(--stage-accent) 46%, var(--stage-accent-deep) 100%)',
                        boxShadow: '0 0 48px rgb(var(--stage-accent-rgb) / 0.45), inset 0 -8px 18px rgba(0,0,0,0.22)',
                    }}
                >
                    <Heart size={42} fill="#FFFDF8" strokeWidth={0} className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)]" />
                </div>

                <div
                    className="absolute left-[85.4%] top-[85.4%] flex size-[3.625rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-px rounded-full border border-(--stage-accent)/35 bg-[#111917] shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
                    title={`접속 기기 ${deviceCount}대 · ${connectionLabel}`}
                >
                    <Radio size={16} aria-hidden="true" className="text-(--stage-accent)" />
                    <span className="text-xs font-semibold tabular-nums">
                        <span className="sr-only">접속 기기 </span>{deviceCount}대
                    </span>
                </div>
            </div>

            <div className="relative mt-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <Heart size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" className="text-(--stage-accent)" />
                <span className="text-3xl font-light leading-none tracking-[-0.03em] tabular-nums">{pulseBpm ?? '--'}</span>
                <span className="text-[13px] font-semibold tracking-[0.08em]">BPM</span>
                <span className="max-w-[12rem] truncate text-[13px] text-white/70">
                    {currentSong ? `${currentSong.title}${currentSong.original_key ? ` · ${currentSong.original_key}` : ''}` : '곡 대기'}
                </span>
            </div>
            {!pulseBpm ? (
                <p className="relative mt-1 text-center text-xs text-white/65">시작 곡에 BPM이 없어 박동을 표시하지 않아요.</p>
            ) : null}

            <div role="tablist" aria-label="예배 준비 보기" className="relative mt-4 grid grid-cols-3 gap-2">
                {START_TABS.map((item) => {
                    const selected = item.id === tab;
                    return (
                        <button
                            key={item.id}
                            id={`${tabsId}-${item.id}-tab`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`${tabsId}-${item.id}-panel`}
                            onClick={() => setTab(item.id)}
                            className={`min-h-11 rounded-full border px-2 text-[13px] font-semibold transition ${selected ? 'border-(--stage-accent) bg-(--stage-accent) text-(--stage-accent-ink)' : 'border-white/14 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]'}`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            <section
                id={`${tabsId}-${tab}-panel`}
                role="tabpanel"
                aria-labelledby={`${tabsId}-${tab}-tab`}
                className="relative mt-3 flex min-h-[13.5rem] flex-1 flex-col gap-2 rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 pb-3 pt-3.5"
            >
                {tab === 'tempo' ? (
                    <>
                        <div className="flex items-baseline justify-between gap-2">
                            <h2 className="text-[13px] font-semibold">콘티 템포 흐름</h2>
                            <span className="truncate text-xs text-white/70">
                                {songs.length}곡{songs.some((song) => song.original_key) ? ` · ${songs.map((song) => song.original_key ?? '-').join(' → ')}` : ''}
                            </span>
                        </div>
                        <svg
                            viewBox={`0 0 ${chart.width} ${chart.height}`}
                            className="block w-full overflow-visible"
                            role="img"
                            aria-label={`콘티 템포: ${chart.points.map((point) => `${point.title} ${point.bpm ?? 'BPM 미설정'}`).join(', ')}`}
                        >
                            {chart.gridlines.map((line) => (
                                <g key={line.bpm}>
                                    <line x1={chart.plotLeft} x2={chart.width} y1={line.y} y2={line.y} stroke="rgba(255,247,232,0.10)" strokeDasharray="2 4" />
                                    <text x={0} y={line.y + 3.5} fontSize={10} fill="rgba(255,247,232,0.6)">{line.bpm}</text>
                                </g>
                            ))}
                            {chart.path ? <path d={chart.path} fill="none" style={{ stroke: 'rgb(var(--stage-accent-rgb) / 0.55)' }} strokeWidth={2} strokeLinecap="round" /> : null}
                            {chart.points.map((point) => point.y === null ? (
                                <circle key={point.id} cx={point.x} cy={chart.height - 6} r={3} fill="none" stroke="rgba(255,247,232,0.35)" strokeDasharray="2 2" />
                            ) : point.state === 'current' ? (
                                <g key={point.id}>
                                    <line x1={point.x} x2={point.x} y1={4} y2={chart.height - 4} style={{ stroke: 'rgb(var(--stage-accent-rgb) / 0.35)' }} strokeDasharray="3 3" />
                                    <circle cx={point.x} cy={point.y} r={19} style={{ fill: 'rgb(var(--stage-accent-rgb) / 0.18)' }} />
                                    {pulseBpm ? <circle className="stage-pulse-svg-ring" cx={point.x} cy={point.y} r={9} fill="none" style={{ stroke: 'var(--stage-accent)' }} strokeWidth={1.5} /> : null}
                                    <circle cx={point.x} cy={point.y} r={9} style={{ fill: 'var(--stage-accent)' }} />
                                </g>
                            ) : (
                                <g key={point.id} opacity={point.state === 'past' ? 0.5 : 1}>
                                    <circle cx={point.x} cy={point.y} r={8} fill="#070D0C" style={{ stroke: 'rgb(var(--stage-accent-rgb) / 0.6)' }} strokeWidth={1.5} />
                                    <circle cx={point.x} cy={point.y} r={3} style={{ fill: 'rgb(var(--stage-accent-rgb) / 0.6)' }} />
                                </g>
                            ))}
                        </svg>
                        <ol
                            className="grid"
                            style={{ gridTemplateColumns: `repeat(${Math.max(1, chart.points.length)}, minmax(0, 1fr))`, paddingLeft: `${(chart.plotLeft / chart.width) * 100}%`, paddingRight: '2.5%' }}
                        >
                            {chart.points.map((point) => (
                                <li key={point.id} className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                                    <span className={`max-w-full truncate text-xs font-semibold ${point.state === 'current' ? 'text-(--stage-accent)' : 'text-[#FFF7E8]'}`}>{point.title}</span>
                                    <span className="text-[11px] tabular-nums text-white/65">
                                        {[point.songKey, point.bpm].filter(Boolean).join(' · ') || 'BPM 미설정'}
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-1 text-[11px] text-white/65">
                            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-(--stage-accent)" />시작 곡</span>
                            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-(--stage-accent)/60" />이어질 곡</span>
                        </div>
                    </>
                ) : null}

                {tab === 'team' ? (
                    <>
                        <div className="flex items-baseline justify-between gap-2">
                            <h2 className="text-[13px] font-semibold">팀 접속</h2>
                            <span className="text-xs text-white/70">{connectionLabel} · {deviceCount}대</span>
                        </div>
                        <fieldset className="rounded-[0.875rem] border border-white/8 bg-white/[0.04] px-3 pb-3 pt-2">
                            <legend className="px-1 text-xs font-semibold text-white/75">이 기기의 수신 역할</legend>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(roleLabels) as SessionFeedbackRole[]).map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        aria-pressed={role === myRole}
                                        onClick={() => onChangeRole(role)}
                                        className={`min-h-11 rounded-xl border text-[13px] font-semibold transition ${role === myRole ? 'border-(--stage-accent) bg-(--stage-accent)/15 text-(--stage-accent)' : 'border-white/12 text-white/80 hover:bg-white/[0.06]'}`}
                                    >
                                        {roleLabels[role]}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                        {participants.length > 0 ? (
                            <ul className="grid grid-cols-2 gap-2">
                                {participants.map((participant) => (
                                    <li key={participant.clientId} className="flex min-h-12 min-w-0 items-center gap-2.5 rounded-[0.875rem] border border-white/8 bg-white/[0.04] px-3">
                                        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[#8FD1B5]" />
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-[13px] font-semibold">{roleLabels[participant.role]}</span>
                                            <span className="truncate text-[11px] text-white/65">기기 {participant.clientId.slice(0, 6)} · 접속 중</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="rounded-[0.875rem] border border-dashed border-white/12 px-3 py-3 text-xs leading-relaxed text-white/70">
                                아직 다른 기기가 없어요. 팀원이 같은 예배 무대 화면을 열면 여기에 표시돼요.
                            </p>
                        )}
                    </>
                ) : null}

                {tab === 'signal' ? (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-[13px] font-semibold">시작할 때 팀 전체에 알리기</h2>
                                <p className="mt-0.5 text-xs text-white/70">
                                    {canSendSignal ? '카운트인과 함께 큐 하나를 전체에 보내요.' : '전송 연결이 없어 이 기기에서만 시작돼요.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={sendStartSignal && canSendSignal}
                                aria-label="시작 신호 보내기"
                                disabled={!canSendSignal}
                                onClick={onToggleStartSignal}
                                className={`relative inline-flex h-11 w-[3.75rem] shrink-0 items-center rounded-full border transition disabled:opacity-40 ${sendStartSignal && canSendSignal ? 'border-(--stage-accent) bg-(--stage-accent)' : 'border-white/20 bg-white/[0.06]'}`}
                            >
                                <span className={`absolute size-7 rounded-full bg-[#FFF7E8] shadow transition-all ${sendStartSignal && canSendSignal ? 'left-[1.75rem]' : 'left-1.5'}`} />
                            </button>
                        </div>
                        <div className={`rounded-[0.875rem] border border-white/8 bg-white/[0.04] p-3 ${sendStartSignal && canSendSignal ? '' : 'opacity-50'}`}>
                            <p className="text-[11px] font-semibold text-(--stage-accent)">보낼 큐 · 전체</p>
                            <p className="mt-1 text-[13px] leading-relaxed">{startSignalMessage}</p>
                        </div>
                        <p className="mt-auto text-[11px] leading-relaxed text-white/65">
                            ‘기기 수신’은 팀원 화면에 도착했다는 뜻이며, 읽었는지는 알 수 없어요. 카운트인은 기기마다 따로 셉니다.
                        </p>
                    </>
                ) : null}
            </section>

            <button
                type="button"
                onClick={onStart}
                disabled={!isActive}
                className="relative mt-3.5 flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-full bg-(--stage-accent) px-5 text-(--stage-accent-ink) shadow-[0_12px_32px_rgb(var(--stage-accent-rgb)/0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
                <Play size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span className="text-base font-bold tracking-[-0.01em]">{isActive ? '예배 시작' : '세션이 종료되었어요'}</span>
                {isActive ? <span className="text-[13px] font-medium opacity-75">4박 카운트인</span> : null}
            </button>
            <button
                type="button"
                onClick={onSkip}
                className="relative mt-1 inline-flex min-h-11 items-center justify-center self-center px-3 text-[13px] font-semibold text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
                카운트인 없이 무대 화면 열기
            </button>
        </div>
    );
}
