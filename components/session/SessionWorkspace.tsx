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
import { useSessionStore } from '@/store/sessionStore';
import {
    DEFAULT_SESSION_SECTIONS,
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
        return 'Select a song to begin.';
    }

    return [song.artist, song.original_key ? `${song.original_key} key` : null, song.bpm ? `${song.bpm} BPM` : null]
        .filter(Boolean)
        .join(' | ');
}

function getFeedbackRoleMeta(role: SessionFeedbackRole) {
    switch (role) {
        case 'instrument':
            return {
                detail: 'Band balance, transitions, and arrangement notes.',
                icon: AudioLines,
                iconTone: 'bg-primary/8 text-primary/70',
                label: 'Instrument lead',
                tone: 'border-primary/15 bg-primary/5 text-primary',
            };
        case 'broadcast':
            return {
                detail: 'Stream, mix, subtitles, and camera coordination.',
                icon: Radio,
                iconTone: 'bg-emerald-500/12 text-emerald-600',
                label: 'Broadcast',
                tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
            };
        case 'leader':
        default:
            return {
                detail: 'Flow, cue timing, and vocal direction for the room.',
                icon: Mic2,
                iconTone: 'bg-secondary/12 text-secondary',
                label: 'Leader',
                tone: 'border-secondary/20 bg-secondary/10 text-secondary',
            };
    }
}

function formatFeedbackTime(createdAt: string) {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return 'Now';
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatFeedbackContext(songTitle: string | null, section: string | null, page: number) {
    return [songTitle ?? 'General cue', section, `Page ${page}`].filter(Boolean).join(' | ');
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
        ? 'Leader mode'
        : syncEnabled
            ? 'Following live'
            : 'Preview mode';
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

        if (!isMaster) {
            return;
        }

        startStateTransition(async () => {
            await updateSessionState(session.id, teamId, payload);
        });
    };

    const sendFeedbackMessage = async (message: string, role: SessionFeedbackRole) => {
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
                            Back to dashboard
                        </Link>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${isActive ? 'bg-red-500/10 text-red-500' : 'bg-primary/5 text-primary/40'}`}>
                                {isActive ? 'Live session' : 'Session closed'}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${sessionStatusTone}`}>
                                {sessionStatusLabel}
                            </span>
                            {headerIsPending && (
                                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/50">
                                    Syncing
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
                                        Theme: {theme}
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
                            {isMaster ? 'Switch to follower' : 'Take leader controls'}
                        </button>
                        <button
                            type="button"
                            onClick={toggleSync}
                            className={`tap-target w-full rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto ${syncEnabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-primary/10 bg-white/70 text-primary hover:border-primary/20 hover:bg-white'}`}
                        >
                            {syncEnabled ? 'Live sync on' : 'Live sync off'}
                        </button>
                        <form action={endSessionAction} className="w-full sm:w-auto">
                            <button
                                type="submit"
                                className="tap-target w-full rounded-full border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                disabled={!isActive}
                            >
                                End session
                            </button>
                        </form>
                    </div>
                </header>

                {!isActive && (
                    <GlassCard className="border-primary/10 bg-white/60">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/40">
                                    Session archived
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                    This live room is closed. Start a new session from the dashboard when the next rehearsal or service is ready.
                                </p>
                            </div>
                            <Link
                                href="/dashboard"
                                className="tap-target inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-surface transition hover:scale-[1.01]"
                            >
                                Return to dashboard
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
                                            Current focus
                                        </p>
                                        <h2 className="mt-2 break-words text-2xl font-serif font-black text-primary sm:text-3xl">
                                            {currentSong?.title ?? 'No song selected'}
                                        </h2>
                                        <p className="mt-2 text-sm text-primary/55">{formatSongMeta(currentSong)}</p>
                                    </div>
                                    <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
                                        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Section</p>
                                            <p className="mt-2 text-lg font-semibold text-primary">{currentSection ?? 'Prelude'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Page</p>
                                            <p className="mt-2 text-lg font-semibold text-primary">{currentPage}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
                                <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.16),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.55))] p-5 sm:rounded-[2rem] sm:p-8">
                                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary/35">
                                        <Waves size={16} />
                                        Stage monitor
                                    </div>
                                    <div className="mt-8 space-y-5">
                                        <div className="rounded-3xl border border-secondary/15 bg-secondary/5 p-6">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Now leading</p>
                                            <p className="mt-4 break-words text-3xl font-serif font-black text-primary sm:text-4xl">
                                                {currentSection ?? 'Prelude'}
                                            </p>
                                            <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                Use this view as the interim conductor monitor until VexFlow score rendering is wired into the live room.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-primary/10 bg-white/70 p-5">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                    <AudioLines size={14} />
                                                    Cue state
                                                </div>
                                                <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                    Followers see this cue instantly when live sync is enabled.
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-primary/10 bg-white/70 p-5">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                    <ShieldCheck size={14} />
                                                    Next step
                                                </div>
                                                <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                    Upload MusicXML and annotation layers next to replace this placeholder monitor.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="rounded-3xl border border-primary/10 bg-white/60 p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Page navigation</p>
                                                <p className="mt-2 text-sm text-primary/55">
                                                    Leader updates publish to all followers.
                                                </p>
                                            </div>
                                            <div className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                                {currentIndex >= 0 ? `${currentIndex + 1} / ${songs.length}` : 'Queue pending'}
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
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => commitState({ page: currentPage + 1 })}
                                                disabled={!canControlLocally}
                                                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                Next
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-primary/10 bg-white/60 p-5">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Section cues</p>
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
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Sync status</p>
                                    <p className="mt-1 text-sm leading-relaxed text-primary/55">
                                        {isMaster
                                            ? 'You are broadcasting page and section changes to the room.'
                                            : syncEnabled
                                                ? 'Your view follows the live conductor feed.'
                                                : 'Live sync is paused for private review.'}
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
                                                One-touch buttons
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                                Register the cues you use often, then tap once to send them to the whole live group.
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                            {quickFeedbackPresets.length} saved
                                        </span>
                                    </div>

                                    <form onSubmit={handleQuickPresetSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                                        <input
                                            value={quickPresetDraft}
                                            onChange={(event) => setQuickPresetDraft(event.target.value)}
                                            maxLength={32}
                                            placeholder="Add a quick button like 'Raise vocal' or 'Next verse'"
                                            className="tap-target flex-1 rounded-2xl border border-primary/10 bg-white/80 px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10"
                                            disabled={!isActive || isPresetPending}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!isActive || isPresetPending || quickPresetDraft.trim().length === 0}
                                            className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-white/80 px-5 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            <Plus size={15} />
                                            Save button
                                        </button>
                                    </form>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {quickFeedbackPresets.length === 0 ? (
                                            <div className="sm:col-span-2 rounded-2xl border border-dashed border-primary/10 px-4 py-6 text-center text-sm text-primary/45">
                                                No quick buttons yet. Add the phrases your team repeats during worship and they will appear here for everyone.
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
                                                                        Sends as {presetMeta.label}
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
                                                Posting as {selectedRoleMeta.label}
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/35">
                                                <Clock3 size={13} />
                                                {currentSection ?? 'Prelude'} | Page {currentPage}
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
                                                Send note
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Recent feedback</p>
                                        <p className="text-xs text-primary/40">
                                            Latest cues stay attached to the live session.
                                        </p>
                                    </div>
                                    <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                                        {feedbackFeed.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                                                No feedback yet. The first team note will appear here.
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
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Setlist queue</p>
                                    <p className="mt-1 text-sm text-primary/55">Tap a song to make it the current live focus.</p>
                                </div>
                                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                                    {songs.length} songs
                                </span>
                            </div>
                            <div className="mt-5 flex flex-col gap-3">
                                {songs.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                                        No songs are attached to this setlist yet.
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
                                                                    Live
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
                                            After worship
                                        </p>
                                        <h2 className="mt-2 text-2xl font-serif font-black text-primary">
                                            Keep the connection moving after the song ends.
                                        </h2>
                                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary/55">
                                            Give participants a simple bridge into prayer, serving, or a group without crowding the live worship controls.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
                                    <Link
                                        href="/care"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <HandHeart size={16} />
                                        Prayer
                                    </Link>
                                    <Link
                                        href="/serve"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <BadgeCheck size={16} />
                                        Serve
                                    </Link>
                                    <Link
                                        href="/groups"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
                                    >
                                        <UsersRound size={16} />
                                        Groups
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
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Build next</p>
                                    <p className="mt-2 text-sm leading-relaxed text-primary/55">
                                        Wire the song canvas to MusicXML, add annotations, and persist conductor notes per song for a complete stage-ready session.
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
                        aria-label="Previous page"
                        onClick={() => commitState({ page: Math.max(1, currentPage - 1) })}
                        disabled={!canControlLocally || currentPage <= 1}
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-white/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <ChevronLeft size={16} />
                        Prev
                    </button>
                    <div className="min-w-0 rounded-2xl border border-primary/10 bg-primary px-4 py-3 text-center text-surface shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-surface/60">Page</p>
                        <p className="mt-1 text-lg font-black leading-none">{currentPage}</p>
                    </div>
                    <button
                        type="button"
                        aria-label="Next page"
                        onClick={() => commitState({ page: currentPage + 1 })}
                        disabled={!canControlLocally}
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-white/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
