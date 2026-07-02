"use client";

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
    addSessionFeedbackPreset,
    appendSessionFeedback,
    endSession,
    updateSessionState,
} from '@/actions/sessionActions';
import SessionBpmConsole from '@/components/session/SessionBpmConsole';
import SessionCueToasts from '@/components/session/SessionCueToasts';
import GlassCard from '@/components/ui/GlassCard';
import MeshBackground from '@/components/ui/MeshBackground';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { useSessionStore } from '@/store/sessionStore';
import {
    DEFAULT_SESSION_SECTIONS,
    MAX_SESSION_FEEDBACK_LOG,
    SESSION_FEEDBACK_ROLES,
    normalizeSessionState,
    resolveSongPresetBpm,
    type SessionCurrentState,
    type SessionFeedbackRole,
    type SessionRow,
    type SongRow,
} from '@/types/session';
import {
    ArrowLeft,
    AudioLines,
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    Clock3,
    HandHeart,
    HeartHandshake,
    MessageSquare,
    Mic2,
    Plus,
    Radio,
    Send,
    ShieldCheck,
    UsersRound,
    Waves,
} from 'lucide-react';

interface SessionWorkspaceProps {
    session: SessionRow;
    songs: SongRow[];
    teamId: string;
    initialState: SessionCurrentState;
    teamName: string;
    setlistTitle: string;
    worshipDateLabel: string;
    theme: string | null;
}

function formatSongMeta(song: SongRow | null) {
    if (!song) {
        return '곡을 선택하면 시작합니다.';
    }

    return [song.artist, song.original_key ? `${song.original_key} 키` : null, song.bpm ? `${song.bpm} BPM` : null]
        .filter(Boolean)
        .join(' | ');
}

function getFeedbackRoleMeta(role: SessionFeedbackRole) {
    switch (role) {
        case 'instrument':
            return {
                detail: '밴드 밸런스, 전환, 편곡 큐를 보냅니다.',
                icon: AudioLines,
                iconTone: 'bg-primary/8 text-primary/70',
                label: '악기장',
                tone: 'border-primary/15 bg-primary/5 text-primary',
            };
        case 'broadcast':
            return {
                detail: '가사, 송출, 믹스, 카메라 큐를 보냅니다.',
                icon: Radio,
                iconTone: 'bg-emerald-500/12 text-emerald-600',
                label: '미디어',
                tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
            };
        case 'leader':
        default:
            return {
                detail: '예배 흐름, 섹션, 보컬 방향을 보냅니다.',
                icon: Mic2,
                iconTone: 'bg-secondary/12 text-secondary',
                label: '인도자',
                tone: 'border-secondary/20 bg-secondary/10 text-secondary',
            };
    }
}

function formatFeedbackTime(createdAt: string) {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return '방금';
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatFeedbackContext(songTitle: string | null, section: string | null, page: number) {
    return [songTitle ?? '전체 큐', section, `${page}p`].filter(Boolean).join(' | ');
}

export default function SessionWorkspace({
    session,
    songs,
    teamId,
    initialState,
    teamName,
    setlistTitle,
    worshipDateLabel,
    theme,
}: SessionWorkspaceProps) {
    const initializeSession = useSessionStore((state) => state.initializeSession);
    const applyRemoteState = useSessionStore((state) => state.applyRemoteState);
    const updateLocalState = useSessionStore((state) => state.updateState);
    const syncQuickFeedbackPresets = useSessionStore((state) => state.syncQuickFeedbackPresets);
    const setFeedbackRole = useSessionStore((state) => state.setFeedbackRole);
    const toggleMaster = useSessionStore((state) => state.toggleMaster);
    const toggleSync = useSessionStore((state) => state.toggleSync);
    const isActive = useSessionStore((state) => state.isActive);
    const isMaster = useSessionStore((state) => state.isMaster);
    const syncEnabled = useSessionStore((state) => state.syncEnabled);
    const currentSession = useSessionStore((state) => state.currentSession);
    const currentSong = useSessionStore((state) => state.currentSong);
    const currentSongId = useSessionStore((state) => state.currentSongId);
    const currentPage = useSessionStore((state) => state.currentPage);
    const currentSection = useSessionStore((state) => state.currentSection);
    const bpmEnabled = useSessionStore((state) => state.bpmEnabled);
    const currentBpm = useSessionStore((state) => state.currentBpm);
    const autoBpmSync = useSessionStore((state) => state.autoBpmSync);
    const feedbackLog = useSessionStore((state) => state.feedbackLog);
    const quickFeedbackPresets = useSessionStore((state) => state.quickFeedbackPresets);
    const selectedFeedbackRole = useSessionStore((state) => state.selectedFeedbackRole);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [clientId] = useState(() => crypto.randomUUID());
    const [quickPresetDraft, setQuickPresetDraft] = useState('');
    const [isStatePending, startStateTransition] = useTransition();
    const [isFeedbackPending, startFeedbackTransition] = useTransition();
    const [isPresetPending, startPresetTransition] = useTransition();
    const isDemoMode = session.id === DEMO_SESSION_ID;

    useEffect(() => {
        initializeSession(session, songs, initialState);
    }, [initializeSession, initialState, session, songs]);

    useEffect(() => {
        if (!currentSession) {
            return;
        }

        const remoteState = normalizeSessionState(currentSession.current_state, songs);

        if (!isMaster && syncEnabled) {
            applyRemoteState(remoteState);
            return;
        }

        syncQuickFeedbackPresets(remoteState.quickFeedbackPresets);
    }, [applyRemoteState, currentSession, isMaster, songs, syncEnabled, syncQuickFeedbackPresets]);

    const { broadcastFeedback } = useRealtimeSession({
        sessionId: session.id,
        teamId,
    });

    const canControlLocally = isActive && (isMaster || !syncEnabled);
    const currentIndex = songs.findIndex((song) => song.id === currentSongId);
    const currentSongPresetBpm = resolveSongPresetBpm(currentSongId, songs);
    const feedbackFeed = [...feedbackLog].reverse();
    const headerIsPending = isStatePending || isFeedbackPending || isPresetPending;
    const selectedRoleMeta = getFeedbackRoleMeta(selectedFeedbackRole);
    const sessionStatusLabel = isMaster
        ? '인도자 모드'
        : syncEnabled
            ? '라이브 팔로우'
            : '개별 연습';
    const sessionStatusTone = isMaster
        ? 'bg-secondary/15 text-secondary'
        : syncEnabled
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-primary/5 text-primary/60';
    const endSessionAction = endSession.bind(null, session.id, teamId);

    const commitState = (nextState: Partial<SessionCurrentState>) => {
        if (!canControlLocally) {
            return;
        }

        const nextSongId = nextState.songId ?? currentSongId ?? songs[0]?.id ?? null;
        const songChanged = nextState.songId !== undefined && nextSongId !== currentSongId;
        const nextAutoBpmSync = nextState.autoBpmSync ?? autoBpmSync;
        const nextBpmValue = nextState.bpmValue !== undefined
            ? nextState.bpmValue
            : songChanged && nextAutoBpmSync
                ? resolveSongPresetBpm(nextSongId, songs)
                : currentBpm;
        const payload: Partial<SessionCurrentState> = {
            songId: nextSongId,
            page: nextState.page ?? currentPage,
            section: nextState.section ?? currentSection,
            bpmEnabled: nextState.bpmEnabled ?? bpmEnabled,
            bpmValue: nextBpmValue,
            autoBpmSync: nextAutoBpmSync,
        };

        updateLocalState(payload);

        if (!isMaster || isDemoMode) {
            return;
        }

        startStateTransition(async () => {
            await updateSessionState(session.id, teamId, payload);
        });
    };

    const sendFeedbackMessage = async (message: string, role: SessionFeedbackRole) => {
        if (isDemoMode) {
            const entry = {
                id: crypto.randomUUID(),
                clientId,
                role,
                message,
                createdAt: new Date().toISOString(),
                teamId,
                songId: currentSongId,
                songTitle: currentSong?.title ?? null,
                page: currentPage,
                section: currentSection,
            };

            updateLocalState({
                feedbackLog: [...feedbackLog, entry].slice(-MAX_SESSION_FEEDBACK_LOG),
            });

            return;
        }

        const result = await appendSessionFeedback(session.id, teamId, {
            clientId,
            role,
            message,
            songId: currentSongId,
            songTitle: currentSong?.title ?? null,
            page: currentPage,
            section: currentSection,
        });

        updateLocalState({ feedbackLog: result.feedbackLog });
        void broadcastFeedback(result.entry);
    };

    const handleFeedbackSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const message = feedbackMessage.trim();

        if (!message || !isActive) {
            return;
        }

        setFeedbackMessage('');

        startFeedbackTransition(async () => {
            try {
                await sendFeedbackMessage(message, selectedFeedbackRole);
            } catch (error) {
                console.error('Failed to submit session feedback:', error);
                setFeedbackMessage(message);
            }
        });
    };

    const handleToggleBpmEnabled = () => {
        const nextEnabled = !bpmEnabled;

        commitState({
            bpmEnabled: nextEnabled,
            bpmValue: nextEnabled ? currentBpm ?? currentSongPresetBpm ?? 72 : currentBpm,
        });
    };

    const handleToggleAutoBpmSync = () => {
        const nextAutoBpmSync = !autoBpmSync;

        commitState({
            autoBpmSync: nextAutoBpmSync,
            bpmValue: nextAutoBpmSync ? currentSongPresetBpm : currentBpm,
        });
    };

    const handleAdjustBpm = (delta: number) => {
        const baseBpm = currentBpm ?? currentSongPresetBpm ?? 72;
        const nextBpm = Math.max(30, Math.min(260, baseBpm + delta));

        commitState({
            bpmEnabled: true,
            autoBpmSync: false,
            bpmValue: nextBpm,
        });
    };

    const handleApplySongPreset = () => {
        if (!currentSongPresetBpm) {
            return;
        }

        commitState({
            bpmEnabled: true,
            bpmValue: currentSongPresetBpm,
        });
    };

    const handleQuickPresetSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const message = quickPresetDraft.trim();

        if (!message || !isActive) {
            return;
        }

        setQuickPresetDraft('');

        if (isDemoMode) {
            updateLocalState({
                quickFeedbackPresets: [
                    ...quickFeedbackPresets,
                    {
                        id: crypto.randomUUID(),
                        role: selectedFeedbackRole,
                        label: message.slice(0, 32),
                        message,
                        createdAt: new Date().toISOString(),
                    },
                ].slice(-12),
            });
            return;
        }

        startPresetTransition(async () => {
            try {
                const nextQuickFeedbackPresets = await addSessionFeedbackPreset(session.id, teamId, {
                    role: selectedFeedbackRole,
                    label: message,
                    message,
                });

                updateLocalState({ quickFeedbackPresets: nextQuickFeedbackPresets });
            } catch (error) {
                console.error('Failed to add session feedback preset:', error);
                setQuickPresetDraft(message);
            }
        });
    };

    const handleQuickPresetSend = (message: string, role: SessionFeedbackRole) => {
        if (!isActive || isFeedbackPending) {
            return;
        }

        startFeedbackTransition(async () => {
            try {
                await sendFeedbackMessage(message, role);
            } catch (error) {
                console.error('Failed to send quick feedback:', error);
            }
        });
    };

    return (
        <div className="safe-area-x relative min-h-screen overflow-hidden bg-background py-6 pb-32 text-primary sm:px-6 sm:py-8 sm:pb-36 md:px-10 lg:pb-10">
            <MeshBackground />
            <SessionCueToasts entries={feedbackLog} isActive={isActive} currentClientId={clientId} />

            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-3">
                        <Link
                            href="/dashboard"
                            className="tap-target inline-flex items-center gap-2 text-sm font-medium text-primary/50 transition-colors hover:text-primary"
                        >
                            <ArrowLeft size={16} />
                            대시보드로 돌아가기
                        </Link>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${isActive ? 'bg-red-500/10 text-red-500' : 'bg-primary/5 text-primary/40'}`}>
                                {isActive ? '라이브 세션' : '세션 종료'}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${sessionStatusTone}`}>
                                {sessionStatusLabel}
                            </span>
                            {headerIsPending && (
                                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/50">
                                    동기화 중
                                </span>
                            )}
                        </div>
                        <div>
                            <h1 className="break-words text-3xl font-serif font-black tracking-tight text-primary sm:text-4xl md:text-5xl">
                                {setlistTitle}
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-primary/55 md:text-base">
                                {teamName}
                                <span className="mx-2 text-primary/20">|</span>
                                {worshipDateLabel}
                                {theme ? (
                                    <>
                                        <span className="mx-2 text-primary/20">|</span>
                                        주제: {theme}
                                    </>
                                ) : null}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <button
                            type="button"
                            onClick={toggleMaster}
                            className={`tap-target w-full rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto ${isMaster ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-primary/10 bg-white/70 text-primary hover:border-primary/20 hover:bg-white'}`}
                        >
                            {isMaster ? '팔로워로 보기' : '인도자 제어 잡기'}
                        </button>
                        <button
                            type="button"
                            onClick={toggleSync}
                            className={`tap-target w-full rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto ${syncEnabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-primary/10 bg-white/70 text-primary hover:border-primary/20 hover:bg-white'}`}
                        >
                            {syncEnabled ? '라이브 동기화 켜짐' : '라이브 동기화 꺼짐'}
                        </button>
                        <form action={endSessionAction} className="w-full sm:w-auto">
                            <button
                                type="submit"
                                className="tap-target w-full rounded-full border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                disabled={!isActive || isDemoMode}
                            >
                                {isDemoMode ? '데모 세션 유지' : '세션 종료'}
                            </button>
                        </form>
                    </div>
                </header>

                {!isActive && (
                    <GlassCard className="border-primary/10 bg-white/60">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/40">
                                    세션이 종료되었습니다
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                    이 라이브 룸은 닫혔습니다. 다음 리허설이나 예배가 준비되면 대시보드에서 새 세션을 시작하세요.
                                </p>
                            </div>
                            <Link
                                href="/dashboard"
                                className="tap-target inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-surface transition hover:scale-[1.01]"
                            >
                                대시보드로 돌아가기
                            </Link>
                        </div>
                    </GlassCard>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
                    <div className="flex flex-col gap-6">
                        <GlassCard className="overflow-hidden border-primary/10 p-0">
                            <div className="border-b border-primary/10 bg-white/50 px-4 py-4 sm:px-6">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/35">
                                            현재 곡
                                        </p>
                                        <h2 className="mt-2 break-words text-2xl font-serif font-black text-primary sm:text-3xl">
                                            {currentSong?.title ?? '곡이 선택되지 않았습니다'}
                                        </h2>
                                        <p className="mt-2 text-sm text-primary/55">{formatSongMeta(currentSong)}</p>
                                    </div>
                                    <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
                                        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">섹션</p>
                                            <p className="mt-2 text-lg font-semibold text-primary">{currentSection ?? 'Prelude'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">악보</p>
                                            <p className="mt-2 text-lg font-semibold text-primary">{currentPage}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
                                <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.16),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.55))] p-5 sm:rounded-[2rem] sm:p-8">
                                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary/35">
                                        <Waves size={16} />
                                        스테이지 모니터
                                    </div>
                                    <div className="mt-8 space-y-5">
                                        <div className="rounded-3xl border border-secondary/15 bg-secondary/5 p-6">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">현재 인도 섹션</p>
                                            <p className="mt-4 break-words text-3xl font-serif font-black text-primary sm:text-4xl">
                                                {currentSection ?? 'Prelude'}
                                            </p>
                                            <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                실제 악보 렌더링이 연결되기 전까지 인도자와 세션이 같은 섹션을 보는 모니터입니다.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-primary/10 bg-white/70 p-5">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                    <AudioLines size={14} />
                                                    큐 상태
                                                </div>
                                                <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                    라이브 동기화가 켜져 있으면 팔로워 화면에 즉시 반영됩니다.
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-primary/10 bg-white/70 p-5">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                    <ShieldCheck size={14} />
                                                    다음 보강
                                                </div>
                                                <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                    MusicXML 악보와 주석 레이어를 연결하면 실제 악보 화면으로 교체됩니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="rounded-3xl border border-primary/10 bg-white/60 p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">악보 넘기기</p>
                                                <p className="mt-2 text-sm text-primary/55">
                                                    인도자의 페이지 변경은 모든 팔로워에게 공유됩니다.
                                                </p>
                                            </div>
                                            <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                                {currentIndex >= 0 ? `${currentIndex + 1} / ${songs.length}` : '콘티 대기'}
                                            </div>
                                        </div>
                                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={() => commitState({ page: Math.max(1, currentPage - 1) })}
                                                disabled={!canControlLocally || currentPage <= 1}
                                                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                <ChevronLeft size={16} />
                                                이전
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => commitState({ page: currentPage + 1 })}
                                                disabled={!canControlLocally}
                                                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                다음
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-primary/10 bg-white/60 p-5">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">섹션 알림</p>
                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {DEFAULT_SESSION_SECTIONS.map((sectionName) => (
                                                <button
                                                    key={sectionName}
                                                    type="button"
                                                    onClick={() => commitState({ section: sectionName })}
                                                    disabled={!canControlLocally}
                                                    className={`tap-target rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${currentSection === sectionName
                                                        ? 'border-secondary/30 bg-secondary/10 text-secondary'
                                                        : 'border-primary/10 bg-background/80 text-primary hover:border-primary/20 hover:bg-white'} disabled:cursor-not-allowed disabled:opacity-45`}
                                                >
                                                    {sectionName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </div>

                    <div className="flex flex-col gap-6">
                        <GlassCard className="border-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                                    <Radio size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">동기화 상태</p>
                                    <p className="mt-1 text-sm leading-relaxed text-primary/55">
                                        {isMaster
                                            ? '페이지와 섹션 변경을 전체 라이브 룸에 보내는 중입니다.'
                                            : syncEnabled
                                                ? '현재 화면은 인도자의 라이브 진행을 따라갑니다.'
                                                : '개별 확인을 위해 라이브 동기화가 잠시 꺼져 있습니다.'}
                                    </p>
                                </div>
                            </div>
                        </GlassCard>

                        <SessionBpmConsole
                            autoBpmSync={autoBpmSync}
                            bpmEnabled={bpmEnabled}
                            canControlLocally={canControlLocally}
                            currentBpm={currentBpm}
                            currentSongTitle={currentSong?.title ?? null}
                            isActive={isActive}
                            onAdjustBpm={handleAdjustBpm}
                            onApplySongPreset={handleApplySongPreset}
                            onToggleAutoBpmSync={handleToggleAutoBpmSync}
                            onToggleBpmEnabled={handleToggleBpmEnabled}
                            songPresetBpm={currentSongPresetBpm}
                        />

                        <GlassCard className="border-primary/10 p-0">
                            <div className="border-b border-primary/10 bg-white/55 px-5 py-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${selectedRoleMeta.iconTone}`}>
                                            <MessageSquare size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Team feedback</p>
                                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                                Drop quick notes for the worship leader, instrument lead, or broadcast booth without leaving the live room.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                        {feedbackLog.length} notes
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-5 px-5 py-5">
                                <div className="grid grid-cols-1 gap-3">
                                    {SESSION_FEEDBACK_ROLES.map((role) => {
                                        const roleMeta = getFeedbackRoleMeta(role);
                                        const RoleIcon = roleMeta.icon;
                                        const isSelected = role === selectedFeedbackRole;

                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setFeedbackRole(role)}
                                                className={`tap-target rounded-2xl border px-4 py-4 text-left transition ${isSelected ? roleMeta.tone : 'border-primary/10 bg-background/70 text-primary hover:border-primary/20 hover:bg-white'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSelected ? roleMeta.iconTone : 'bg-primary/5 text-primary/55'}`}>
                                                        <RoleIcon size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold">{roleMeta.label}</p>
                                                        <p className="mt-1 text-xs leading-relaxed text-primary/55">
                                                            {roleMeta.detail}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="rounded-3xl border border-primary/10 bg-background/75 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                원터치 버튼
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                                자주 쓰는 큐를 등록해두고 한 번의 터치로 전체 라이브 그룹에 보냅니다.
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                            {quickFeedbackPresets.length}개 저장
                                        </span>
                                    </div>

                                    <form onSubmit={handleQuickPresetSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                                        <input
                                            value={quickPresetDraft}
                                            onChange={(event) => setQuickPresetDraft(event.target.value)}
                                            maxLength={32}
                                            placeholder="예: 보컬 올려주세요, 다음 절"
                                            className="tap-target flex-1 rounded-2xl border border-primary/10 bg-white/80 px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10"
                                            disabled={!isActive || isPresetPending}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!isActive || isPresetPending || quickPresetDraft.trim().length === 0}
                                            className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-white/80 px-5 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            <Plus size={15} />
                                            버튼 저장
                                        </button>
                                    </form>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {quickFeedbackPresets.length === 0 ? (
                                            <div className="sm:col-span-2 rounded-2xl border border-dashed border-primary/10 px-4 py-6 text-center text-sm text-primary/45">
                                                아직 빠른 버튼이 없습니다. 예배 중 자주 반복하는 큐를 추가하면 여기에 표시됩니다.
                                            </div>
                                        ) : (
                                            quickFeedbackPresets
                                                .slice()
                                                .reverse()
                                                .map((preset) => {
                                                    const presetMeta = getFeedbackRoleMeta(preset.role);
                                                    const PresetIcon = presetMeta.icon;

                                                    return (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => handleQuickPresetSend(preset.message, preset.role)}
                                                            disabled={!isActive || isFeedbackPending}
                                                            className={`tap-target rounded-2xl border px-4 py-4 text-left transition ${presetMeta.tone} disabled:cursor-not-allowed disabled:opacity-45`}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${presetMeta.iconTone}`}>
                                                                    <PresetIcon size={16} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="truncate text-sm font-semibold">
                                                                            {preset.label}
                                                                        </p>
                                                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/45">
                                                                            Tap
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-1 text-xs leading-relaxed text-primary/55">
                                                                        {presetMeta.label}로 전송
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                                    <div className="rounded-3xl border border-primary/10 bg-background/75 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                {selectedRoleMeta.label}로 보내기
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/35">
                                                <Clock3 size={13} />
                                                {currentSection ?? 'Prelude'} | {currentPage}p
                                            </div>
                                        </div>
                                        <textarea
                                            value={feedbackMessage}
                                            onChange={(event) => setFeedbackMessage(event.target.value)}
                                            maxLength={220}
                                            rows={4}
                                            placeholder="Share a quick cue, balance note, or broadcast issue for the team."
                                            className="mt-3 w-full resize-none rounded-2xl border border-primary/10 bg-white/80 px-4 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10 sm:text-sm"
                                            disabled={!isActive || isFeedbackPending}
                                        />
                                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-xs leading-relaxed text-primary/45">
                                                Everyone in this live room sees new notes in real time, even when page sync is paused.
                                            </p>
                                            <button
                                                type="submit"
                                                disabled={!isActive || isFeedbackPending || feedbackMessage.trim().length === 0}
                                                className="tap-target inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-surface transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                <Send size={15} />
                                                큐 보내기
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">최근 큐</p>
                                        <p className="text-xs text-primary/40">
                                            최근 큐는 라이브 세션 로그에 함께 남습니다.
                                        </p>
                                    </div>
                                    <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                                        {feedbackFeed.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                                                아직 큐가 없습니다. 첫 팀 알림이 여기에 표시됩니다.
                                            </div>
                                        ) : (
                                            feedbackFeed.map((entry) => {
                                                const roleMeta = getFeedbackRoleMeta(entry.role);
                                                const EntryIcon = roleMeta.icon;

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className="rounded-3xl border border-primary/10 bg-white/70 p-4"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${roleMeta.iconTone}`}>
                                                                <EntryIcon size={16} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${roleMeta.tone}`}>
                                                                        {roleMeta.label}
                                                                    </span>
                                                                    <span className="text-xs text-primary/40">
                                                                        {formatFeedbackTime(entry.createdAt)}
                                                                    </span>
                                                                </div>
                                                                <p className="mt-3 text-sm leading-relaxed text-primary">
                                                                    {entry.message}
                                                                </p>
                                                                <p className="mt-3 text-xs leading-relaxed text-primary/45">
                                                                    {formatFeedbackContext(entry.songTitle, entry.section, entry.page)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard className="border-primary/10">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">콘티 순서</p>
                                    <p className="mt-1 text-sm text-primary/55">곡을 누르면 현재 라이브 곡으로 전환됩니다.</p>
                                </div>
                                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                    {songs.length}곡
                                </span>
                            </div>
                            <div className="mt-5 flex flex-col gap-3">
                                {songs.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                                        아직 콘티에 연결된 곡이 없습니다.
                                    </div>
                                ) : (
                                    songs.map((song, index) => {
                                        const isCurrent = song.id === currentSongId;

                                        return (
                                            <button
                                                key={song.id}
                                                type="button"
                                                onClick={() => commitState({
                                                    songId: song.id,
                                                    page: 1,
                                                    section: DEFAULT_SESSION_SECTIONS[0],
                                                })}
                                                disabled={!canControlLocally}
                                                className={`tap-target rounded-2xl border px-4 py-4 text-left transition ${isCurrent
                                                    ? 'border-secondary/30 bg-secondary/10'
                                                    : 'border-primary/10 bg-white/60 hover:border-primary/20 hover:bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <span className={`mt-1 text-lg font-black ${isCurrent ? 'text-secondary' : 'text-primary/20'}`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="truncate text-sm font-semibold text-primary">{song.title}</p>
                                                            {isCurrent && (
                                                                <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                                                                    진행 중
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-1 text-xs leading-relaxed text-primary/45">
                                                            {formatSongMeta(song)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </GlassCard>

                        <GlassCard className="border-primary/10 bg-white/60">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                                        <HeartHandshake size={19} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                            예배 후
                                        </p>
                                        <h2 className="mt-2 text-2xl font-serif font-black text-primary">
                                            찬양 이후에도 팀의 연결을 이어갑니다.
                                        </h2>
                                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary/55">
                                            라이브 컨트롤은 단순하게 유지하면서 예배 후 기도, 섬김, 그룹, 묵상으로 이어지게 합니다.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
                                    <Link
                                        href="/care"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <HandHeart size={16} />
                                        기도
                                    </Link>
                                    <Link
                                        href="/serve"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <BadgeCheck size={16} />
                                        섬김
                                    </Link>
                                    <Link
                                        href="/groups"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <UsersRound size={16} />
                                        그룹
                                    </Link>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard className="border-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/5 text-primary/60">
                                    <Mic2 size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">다음 보강</p>
                                    <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                        MusicXML 악보, 주석, 곡별 인도자 메모를 연결하면 실제 무대용 세션 화면으로 완성됩니다.
                                    </p>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/10 bg-background/95 px-3 py-3 shadow-[0_-18px_45px_rgba(26,31,44,0.12)] backdrop-blur-xl lg:hidden">
                <div className="pb-safe mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <button
                        type="button"
                        aria-label="이전 악보 페이지"
                        onClick={() => commitState({ page: Math.max(1, currentPage - 1) })}
                        disabled={!canControlLocally || currentPage <= 1}
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-white/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <ChevronLeft size={16} />
                        이전
                    </button>
                    <div className="min-w-0 rounded-2xl border border-primary/10 bg-primary px-4 py-3 text-center text-surface shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-surface/60">악보</p>
                        <p className="mt-1 text-lg font-black leading-none">{currentPage}</p>
                    </div>
                    <button
                        type="button"
                        aria-label="다음 악보 페이지"
                        onClick={() => commitState({ page: currentPage + 1 })}
                        disabled={!canControlLocally}
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-white/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        다음
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
