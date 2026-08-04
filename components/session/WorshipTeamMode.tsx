"use client";

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { appendSessionFeedback } from '@/actions/sessionActions';
import { useRealtimeSession, type RealtimeConnectionStatus } from '@/hooks/useRealtimeSession';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { useSessionStore } from '@/store/sessionStore';
import {
    DEFAULT_SESSION_SECTIONS,
    getDefaultSessionFeedbackTarget,
    getSessionFeedbackPresetStorageKey,
    MAX_SESSION_FEEDBACK_LOG,
    normalizeSessionState,
    type SessionCurrentState,
    type SessionFeedbackEntry,
    type SessionFeedbackPreset,
    type SessionFeedbackPresetGroup,
    type SessionFeedbackRole,
    type SessionRow,
    type SongRow,
} from '@/types/session';
import {
    ArrowLeft,
    Check,
    ChevronsUp,
    CornerDownRight,
    Pause,
    Radio,
    Send,
    ShieldAlert,
    Timer,
    type LucideIcon,
} from 'lucide-react';

interface WorshipTeamModeProps {
    session: SessionRow;
    songs: SongRow[];
    teamId: string;
    initialState: SessionCurrentState;
    teamName: string;
    setlistTitle: string;
}

type StageAction = {
    id: string;
    label: string;
    message: string;
    role: SessionFeedbackRole;
    group: SessionFeedbackPresetGroup;
    target: string;
    tone: string;
    accent: string;
    Icon: LucideIcon;
    cooldown?: boolean;
};

type StageFlash = {
    id: string;
    token: string;
    label: string;
    message: string;
    target: string;
    role: SessionFeedbackRole;
    accent: string;
};

const ACTION_GROUP_META: Record<SessionFeedbackPresetGroup, {
    label: string;
    tone: string;
    accent: string;
    Icon: LucideIcon;
    cooldown?: boolean;
}> = {
    flow: {
        label: '흐름',
        tone: 'border-sky-300/25 bg-sky-300/12 text-sky-50',
        accent: '125 211 252',
        Icon: CornerDownRight,
        cooldown: true,
    },
    tempo: {
        label: '템포',
        tone: 'border-amber-300/25 bg-amber-300/12 text-amber-50',
        accent: '252 211 77',
        Icon: ChevronsUp,
    },
    band: {
        label: '반주',
        tone: 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50',
        accent: '110 231 183',
        Icon: Pause,
    },
    media: {
        label: '미디어',
        tone: 'border-violet-300/25 bg-violet-300/12 text-violet-50',
        accent: '196 181 253',
        Icon: Radio,
    },
};

const ACTION_GROUPS: Array<{ id: SessionFeedbackPresetGroup; label: string }> = [
    { id: 'flow', label: '흐름' },
    { id: 'tempo', label: '템포' },
    { id: 'band', label: '반주' },
    { id: 'media', label: '미디어' },
];

function createStageAction(preset: SessionFeedbackPreset): StageAction {
    const groupMeta = ACTION_GROUP_META[preset.group];

    return {
        id: preset.id,
        label: preset.label,
        message: preset.message,
        role: preset.role,
        group: preset.group,
        target: preset.target || getDefaultSessionFeedbackTarget(preset.role, preset.group),
        tone: groupMeta.tone,
        accent: groupMeta.accent,
        Icon: groupMeta.Icon,
        cooldown: groupMeta.cooldown,
    };
}

const ROLE_LABELS: Record<SessionFeedbackRole, string> = {
    leader: '인도자',
    instrument: '악기',
    broadcast: '미디어',
};

function readStoredFeedbackPresets(sessionId: string): SessionFeedbackPreset[] | null {
    try {
        const storedValue = window.sessionStorage.getItem(
            getSessionFeedbackPresetStorageKey(sessionId)
        );

        if (!storedValue) {
            return null;
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return null;
        }

        const presets = parsedValue.filter((value): value is SessionFeedbackPreset => (
            typeof value === 'object' &&
            value !== null &&
            typeof value.id === 'string' &&
            typeof value.label === 'string' &&
            typeof value.message === 'string' &&
            typeof value.target === 'string' &&
            typeof value.createdAt === 'string' &&
            'role' in value &&
            typeof value.role === 'string' &&
            value.role in ROLE_LABELS &&
            'group' in value &&
            typeof value.group === 'string' &&
            value.group in ACTION_GROUP_META
        ));

        return presets.length > 0 ? presets : null;
    } catch {
        return null;
    }
}

export default function WorshipTeamMode({
    session,
    songs,
    teamId,
    initialState,
    teamName,
    setlistTitle,
}: WorshipTeamModeProps) {
    const initializeSession = useSessionStore((state) => state.initializeSession);
    const applyRemoteState = useSessionStore((state) => state.applyRemoteState);
    const updateLocalState = useSessionStore((state) => state.updateState);
    const currentSession = useSessionStore((state) => state.currentSession);
    const currentSong = useSessionStore((state) => state.currentSong);
    const currentSongId = useSessionStore((state) => state.currentSongId);
    const currentPage = useSessionStore((state) => state.currentPage);
    const currentSection = useSessionStore((state) => state.currentSection);
    const currentBpm = useSessionStore((state) => state.currentBpm);
    const bpmEnabled = useSessionStore((state) => state.bpmEnabled);
    const feedbackLog = useSessionStore((state) => state.feedbackLog);
    const quickFeedbackPresets = useSessionStore((state) => state.quickFeedbackPresets);
    const isActive = useSessionStore((state) => state.isActive);
    const [clientId] = useState(() => crypto.randomUUID());
    const [recentActionId, setRecentActionId] = useState<string | null>(null);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [failedActionId, setFailedActionId] = useState<string | null>(null);
    const [cooldownActionIds, setCooldownActionIds] = useState<string[]>([]);
    const [stageFlash, setStageFlash] = useState<StageFlash | null>(null);
    const [isPending, startTransition] = useTransition();
    const flashTimeoutRef = useRef<number | null>(null);
    const cooldownTimeoutRefs = useRef<Record<string, number>>({});
    const appliedSessionStateRef = useRef(JSON.stringify(session.current_state) ?? '');
    const isDemoMode = session.id === DEMO_SESSION_ID;
    const { activeBeat, blinkActive } = useStageMetronome(bpmEnabled && isActive, currentBpm);
    const nowTick = useNowTick(5000);
    const { broadcastFeedback, lastRealtimeAt, realtimeStatus } = useRealtimeSession({
        sessionId: session.id,
        teamId,
    });
    useWakeLock(isActive);

    const realtimeMeta = getRealtimeStatusMeta(realtimeStatus, isDemoMode);
    const realtimeAgeLabel = formatRealtimeAge(lastRealtimeAt, nowTick);
    const latestCue = feedbackLog[feedbackLog.length - 1] ?? null;
    const currentSongIndex = songs.findIndex((song) => song.id === currentSongId);
    const nextSong = currentSongIndex >= 0 ? songs[currentSongIndex + 1] ?? null : songs[1] ?? null;
    const nextSection = getNextSectionLabel(currentSection);
    const beatDurationStyle = {
        '--beat-duration': `${currentBpm ? Math.max(0.24, 60 / currentBpm).toFixed(3) : '0.75'}s`,
    } as CSSProperties;
    const metronomeActive = bpmEnabled && isActive && Boolean(currentBpm);

    const configuredPresets = quickFeedbackPresets.length > 0
        ? quickFeedbackPresets
        : initialState.quickFeedbackPresets;
    const stageActions = useMemo(
        () => configuredPresets.map(createStageAction),
        [configuredPresets]
    );
    const actionsByGroup = useMemo(() => (
        ACTION_GROUPS.map((group) => ({
            ...group,
            actions: stageActions.filter((action) => action.group === group.id),
        })).filter((group) => group.actions.length > 0)
    ), [stageActions]);

    useEffect(() => {
        const storedFeedbackPresets = isDemoMode
            ? readStoredFeedbackPresets(session.id)
            : null;

        initializeSession(session, songs, storedFeedbackPresets
            ? { ...initialState, quickFeedbackPresets: storedFeedbackPresets }
            : initialState);
    }, [initializeSession, initialState, isDemoMode, session, songs]);

    useEffect(() => {
        if (!currentSession) {
            return;
        }

        const sessionStateFingerprint = JSON.stringify(currentSession.current_state) ?? '';

        if (sessionStateFingerprint === appliedSessionStateRef.current) {
            return;
        }

        appliedSessionStateRef.current = sessionStateFingerprint;
        applyRemoteState(normalizeSessionState(currentSession.current_state, songs));
    }, [applyRemoteState, currentSession, songs]);

    useEffect(() => () => {
        if (flashTimeoutRef.current) {
            window.clearTimeout(flashTimeoutRef.current);
        }

        Object.values(cooldownTimeoutRefs.current).forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
    }, []);

    const showActionFeedback = (action: StageAction) => {
        const flashToken = crypto.randomUUID();

        setRecentActionId(action.id);
        setStageFlash({
            id: action.id,
            token: flashToken,
            label: action.label,
            message: action.message,
            target: action.target,
            role: action.role,
            accent: action.accent,
        });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([18, 24, 32]);
        }

        if (flashTimeoutRef.current) {
            window.clearTimeout(flashTimeoutRef.current);
        }

        flashTimeoutRef.current = window.setTimeout(() => {
            setRecentActionId((currentActionId) => (
                currentActionId === action.id ? null : currentActionId
            ));
            setStageFlash((currentFlash) => (
                currentFlash?.token === flashToken ? null : currentFlash
            ));
            flashTimeoutRef.current = null;
        }, 2200);
    };

    const beginCooldown = (action: StageAction) => {
        if (!action.cooldown) {
            return;
        }

        setCooldownActionIds((ids) => (
            ids.includes(action.id) ? ids : [...ids, action.id]
        ));

        if (cooldownTimeoutRefs.current[action.id]) {
            window.clearTimeout(cooldownTimeoutRefs.current[action.id]);
        }

        cooldownTimeoutRefs.current[action.id] = window.setTimeout(() => {
            setCooldownActionIds((ids) => ids.filter((id) => id !== action.id));
            delete cooldownTimeoutRefs.current[action.id];
        }, 1600);
    };

    const sendStageAction = (action: StageAction) => {
        if (!isActive || isPending || pendingActionId || cooldownActionIds.includes(action.id)) {
            return;
        }

        showActionFeedback(action);
        beginCooldown(action);
        setFailedActionId(null);

        const previousFeedbackLog = feedbackLog;
        const entry: SessionFeedbackEntry = {
            id: crypto.randomUUID(),
            clientId,
            role: action.role,
            message: action.message,
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

        if (isDemoMode) {
            return;
        }

        setPendingActionId(action.id);

        startTransition(async () => {
            try {
                const result = await appendSessionFeedback(session.id, teamId, {
                    id: entry.id,
                    clientId,
                    role: action.role,
                    message: action.message,
                    songId: currentSongId,
                    songTitle: currentSong?.title ?? null,
                    page: currentPage,
                    section: currentSection,
                });

                updateLocalState({ feedbackLog: result.feedbackLog });
                void broadcastFeedback(result.entry);
            } catch (error) {
                console.error('Failed to send worship team action:', error);
                setFailedActionId(action.id);
                updateLocalState({ feedbackLog: previousFeedbackLog });
            } finally {
                setPendingActionId(null);
            }
        });
    };

    return (
        <main className="safe-area-x min-h-dvh overflow-x-hidden bg-[#050b0a] text-[#fff7e8]">
            {stageFlash ? (
                <div key={stageFlash.token} className="stage-cue-layer pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5">
                    <div className="stage-cue-backdrop absolute inset-0" />
                    <div
                        className="stage-cue-shell relative w-full max-w-xl overflow-hidden rounded-lg border px-5 py-6 text-center backdrop-blur-xl sm:px-8 sm:py-8"
                        style={{ '--cue-accent': stageFlash.accent } as CSSProperties}
                    >
                        <div className="stage-cue-mark mx-auto flex h-11 w-11 items-center justify-center rounded-full border sm:h-12 sm:w-12">
                            <Check size={23} strokeWidth={3} />
                        </div>
                        <p className="stage-cue-kicker mt-3 text-[10px] font-black uppercase tracking-[0.2em] sm:text-xs">Cue sent</p>
                        <p className="stage-cue-title mt-2 text-4xl font-black leading-none sm:text-6xl">{stageFlash.label}</p>
                        <p className="stage-cue-message mt-3 text-sm font-bold text-white/72 sm:mt-4 sm:text-base">{stageFlash.message}</p>
                        <div className="stage-cue-meta mt-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs">
                            <span>{stageFlash.target}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ROLE_LABELS[stageFlash.role]}</span>
                        </div>
                        <span className="stage-cue-timer absolute inset-x-0 bottom-0 h-1" />
                    </div>
                </div>
            ) : null}

            <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
                <header className="flex items-center justify-between gap-3">
                    <Link
                        href={`/session/${session.id}`}
                        aria-label="기본 세션 화면으로 돌아가기"
                        className="tap-target inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft size={14} />
                        <span className="hidden sm:inline">기본 화면</span>
                    </Link>
                    <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-xs font-bold text-white/35">{currentSong?.title ?? '곡 대기'}</p>
                    </div>
                    <span
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${realtimeMeta.tone}`}
                        data-testid="team-mode-sync"
                    >
                        <span className={`h-2 w-2 rounded-full ${realtimeMeta.dot}`} />
                        {realtimeMeta.label}
                    </span>
                </header>

                {!isActive ? (
                    <section className="rounded-lg border border-red-300/20 bg-red-500/10 p-4 text-red-50">
                        <div className="flex items-center gap-3">
                            <ShieldAlert size={20} />
                            <div>
                                <p className="text-lg font-black">세션 종료</p>
                                <p className="text-sm font-semibold text-red-50/70">새 큐 전송이 잠겨 있습니다.</p>
                            </div>
                        </div>
                    </section>
                ) : null}

                <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)_auto]">
                    <section
                        className={`stage-bpm-panel order-1 relative overflow-hidden rounded-lg border border-[#f0b56b]/20 bg-[#f0b56b]/[0.075] p-3 sm:p-5 lg:order-none lg:col-start-1 lg:row-start-1 ${blinkActive ? 'stage-bpm-panel--beat' : ''} ${blinkActive && activeBeat === 1 ? 'stage-bpm-panel--downbeat' : ''}`}
                        style={beatDurationStyle}
                        data-testid="team-mode-bpm"
                    >
                        <div className="relative flex min-h-[16.5rem] flex-col justify-between gap-4 sm:min-h-[32rem] sm:gap-5 lg:min-h-full">
                            <div className="grid grid-cols-[minmax(0,1fr)_7.75rem] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.32fr)]">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffe0b8]/45 sm:text-xs sm:tracking-[0.2em]">
                                        현재 섹션
                                    </p>
                                    <h1 className="mt-1.5 truncate text-4xl font-black leading-none text-[#ffe0b8] sm:mt-2 sm:text-7xl">
                                        {currentSection ?? 'Ready'}
                                    </h1>
                                </div>
                                <div className="min-w-0 rounded-lg border border-[#ffe0b8]/16 bg-black/20 px-3 py-2.5 sm:px-4 sm:py-3">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#ffe0b8]/45 sm:text-[10px] sm:tracking-[0.18em]">
                                        다음
                                    </p>
                                    <p className="mt-1.5 truncate text-base font-black leading-none text-white sm:mt-2 sm:text-3xl">
                                        {nextSection}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-5">
                                <div>
                                    <div className="flex items-end gap-3">
                                        <p className={`stage-bpm-value font-serif text-6xl font-black leading-none text-[#ffe0b8] sm:text-8xl ${blinkActive ? 'stage-bpm-value--beat' : ''} ${blinkActive && activeBeat === 1 ? 'stage-bpm-value--downbeat' : ''}`}>
                                            {currentBpm ?? '--'}
                                        </p>
                                        <div className="flex flex-col items-start gap-1 pb-1 sm:gap-2 sm:pb-2">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffe0b8]/45 sm:text-xs sm:tracking-[0.18em]">
                                                BPM
                                            </p>
                                            <p className="inline-flex rounded-full bg-[#ffe0b8]/[0.12] px-2 py-1 text-[10px] font-black text-[#ffe0b8] sm:px-3 sm:text-xs">
                                                Key {currentSong?.original_key ?? '-'}
                                            </p>
                                            <p className={`hidden rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex sm:px-3 sm:text-xs ${metronomeActive ? 'bg-emerald-300/[0.12] text-emerald-100' : 'bg-white/10 text-white/45'}`}>
                                                {metronomeActive ? '시각 템포' : '대기'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-4 gap-2 sm:mt-8" aria-label="4박 시각 신호">
                                        {[1, 2, 3, 4].map((beat) => {
                                            const isActiveBeat = activeBeat === beat && blinkActive;
                                            const isDownBeat = beat === 1;

                                            return (
                                                <span
                                                    key={beat}
                                                    className={`stage-beat-track rounded-full ${isActiveBeat ? 'stage-beat-track--active' : ''} ${isActiveBeat && isDownBeat ? 'stage-beat-track--downbeat' : ''} ${isDownBeat ? 'h-4 sm:h-5' : 'h-3 sm:h-4'}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={`stage-metronome-shell relative h-28 overflow-hidden rounded-lg border border-[#ffe0b8]/20 bg-black/22 sm:h-44 ${blinkActive ? 'stage-metronome-shell--beat' : ''}`}>
                                    <div className="absolute inset-x-5 bottom-6 h-1 rounded-full bg-[#ffe0b8]/16 sm:inset-x-9 sm:bottom-9" />
                                    <div className={`absolute left-1/2 top-6 h-16 w-1 -translate-x-1/2 rounded-full bg-[#ffe0b8] sm:top-9 sm:h-24 ${metronomeActive ? 'bpm-metronome-arm' : 'opacity-35'}`}>
                                        <span className="absolute -top-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-[#ffe0b8] shadow-[0_0_32px_rgba(255,224,184,0.48)] sm:-top-1.5 sm:h-5 sm:w-5" />
                                    </div>
                                    <div className="absolute bottom-5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[#ffe0b8] sm:bottom-8 sm:h-6 sm:w-6" />
                                    {metronomeActive ? (
                                        <div className="bpm-beat-ring absolute bottom-0 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-[#ffe0b8]/35 sm:bottom-1 sm:h-24 sm:w-24" />
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside
                        className={`order-2 rounded-lg border border-white/10 bg-white/[0.052] px-3 py-2.5 lg:hidden ${recentActionId ? 'stage-latest-cue-active' : ''}`}
                        aria-live="polite"
                        data-testid="team-latest-cue-mobile"
                    >
                        <div className="flex items-center gap-3">
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">최근 큐</span>
                            <p className="min-w-0 flex-1 truncate text-sm font-black text-white">
                                {latestCue?.message ?? '큐 대기'}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold text-white/35">
                                {latestCue ? ROLE_LABELS[latestCue.role] : realtimeAgeLabel}
                            </span>
                        </div>
                    </aside>

                    <aside className="order-3 rounded-lg border border-white/10 bg-white/[0.052] p-3 sm:p-4 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-black text-white sm:text-2xl">즉시 큐</h2>
                            <Send size={20} className="text-[#ffe0b8]/70" />
                        </div>

                        <div className="mt-2.5 space-y-2.5 sm:mt-4 sm:space-y-4">
                            {actionsByGroup.map((group) => {
                                const mobileColumns = group.actions.length === 1
                                    ? 'grid-cols-1'
                                    : group.actions.length === 2
                                        ? 'grid-cols-2'
                                        : 'grid-cols-3';

                                return (
                                <div key={group.id}>
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/32 sm:mb-2 sm:tracking-[0.18em]">
                                        {group.label}
                                    </p>
                                    <div className={`grid gap-2 sm:gap-3 lg:grid-cols-1 ${mobileColumns}`}>
                                        {group.actions.map((action) => {
                                            const isSent = recentActionId === action.id;
                                            const isPendingAction = pendingActionId === action.id;
                                            const isFailed = failedActionId === action.id;
                                            const isCoolingDown = cooldownActionIds.includes(action.id);
                                            const disabled = !isActive || Boolean(pendingActionId) || isCoolingDown;
                                            const Icon = action.Icon;

                                            return (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    onClick={() => sendStageAction(action)}
                                                    disabled={disabled}
                                                    data-testid={`team-action-${action.id}`}
                                                    className={`tap-target min-h-12 rounded-lg border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[4.75rem] sm:px-4 sm:py-3 motion-safe:active:scale-[0.98] ${isFailed ? 'border-red-300/40 bg-red-400/[0.18] text-red-50' : isSent ? 'stage-action-sent border-emerald-300/40 bg-emerald-300/[0.2] text-emerald-50 shadow-[0_0_30px_rgba(110,231,183,0.14)]' : action.tone}`}
                                                >
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                                            <Icon size={16} className="shrink-0 opacity-80 sm:h-[18px] sm:w-[18px]" />
                                                            <span className="min-w-0 truncate whitespace-nowrap text-xs font-black leading-none sm:text-lg sm:leading-tight">{action.label}</span>
                                                        </span>
                                                        <span className="hidden shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase text-white/65 sm:inline-flex">
                                                            {isFailed ? '실패' : isPendingAction ? '전송 중' : isCoolingDown ? '대기' : isSent ? '전송' : action.target}
                                                        </span>
                                                    </span>
                                                    <span className="mt-1.5 hidden truncate text-xs font-semibold opacity-58 sm:block">
                                                        {ROLE_LABELS[action.role]}에게 전달
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="order-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] lg:order-none lg:col-start-1 lg:row-start-2">
                        <aside className={`hidden rounded-lg border border-white/10 bg-white/[0.052] p-4 lg:block ${recentActionId ? 'stage-latest-cue-active' : ''}`} aria-live="polite" data-testid="team-latest-cue">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">최근 큐</p>
                            <p className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
                                {latestCue?.message ?? '큐 대기'}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-white/45">
                                {latestCue ? `${ROLE_LABELS[latestCue.role]} · ${latestCue.section ?? '전체'} · ${latestCue.page}p` : '팀 액션을 기다리는 중'}
                            </p>
                        </aside>

                        <aside className="rounded-lg border border-white/10 bg-white/[0.052] p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">
                                {teamName}
                            </p>
                            <h3 className="mt-2 truncate text-xl font-black text-[#ffe0b8]">{currentSong?.title ?? '곡 대기'}</h3>
                            <p className="mt-2 truncate text-sm font-semibold text-white/45">{setlistTitle}</p>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <StageMetric label="악보" value={`${currentPage}p`} />
                                <StageMetric label="키" value={currentSong?.original_key ?? '-'} />
                                <StageMetric label="다음 곡" value={nextSong?.title ?? '마지막'} />
                                <StageMetric label="넘김" value="리더 따라감" />
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-white/45">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-2">
                                    <Radio size={13} />
                                    {realtimeAgeLabel}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-2">
                                    <Timer size={13} />
                                    {nextSection}
                                </span>
                            </div>
                        </aside>
                    </section>
                </section>
            </div>
        </main>
    );
}

function StageMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-lg border border-white/10 bg-black/[0.14] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
            <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
        </div>
    );
}

function useStageMetronome(enabled: boolean, bpm: number | null) {
    const [blinkActive, setBlinkActive] = useState(false);
    const [activeBeat, setActiveBeat] = useState(0);
    const isEnabled = enabled && Boolean(bpm);

    useEffect(() => {
        if (!isEnabled || !bpm) {
            return;
        }

        const intervalMs = Math.max(240, Math.floor(60000 / bpm));
        const pulseMs = Math.min(180, Math.floor(intervalMs * 0.5));
        let beat = 0;
        let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

        const triggerBeat = () => {
            beat = (beat % 4) + 1;
            setActiveBeat(beat);
            setBlinkActive(true);

            if (pulseTimeout) {
                clearTimeout(pulseTimeout);
            }

            pulseTimeout = setTimeout(() => {
                setBlinkActive(false);
            }, pulseMs);
        };

        triggerBeat();
        const interval = setInterval(triggerBeat, intervalMs);

        return () => {
            clearInterval(interval);

            if (pulseTimeout) {
                clearTimeout(pulseTimeout);
            }
        };
    }, [bpm, isEnabled]);

    return {
        activeBeat: isEnabled ? activeBeat : 0,
        blinkActive: isEnabled ? blinkActive : false,
    };
}

function useNowTick(intervalMs: number) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, intervalMs);

        return () => window.clearInterval(interval);
    }, [intervalMs]);

    return now;
}

function useWakeLock(enabled: boolean) {
    useEffect(() => {
        if (!enabled || typeof navigator === 'undefined') {
            return;
        }

        let sentinel: { release: () => Promise<void> } | null = null;
        let isReleased = false;
        const wakeLock = (navigator as Navigator & {
            wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;

        if (!wakeLock) {
            return;
        }

        void wakeLock.request('screen')
            .then((nextSentinel) => {
                if (isReleased) {
                    void nextSentinel.release();
                    return;
                }

                sentinel = nextSentinel;
            })
            .catch(() => {
                sentinel = null;
            });

        return () => {
            isReleased = true;

            if (sentinel) {
                void sentinel.release();
            }
        };
    }, [enabled]);
}

function getNextSectionLabel(section: string | null) {
    const currentIndex = DEFAULT_SESSION_SECTIONS.findIndex((item) => item === section);

    if (currentIndex < 0) {
        return '다음';
    }

    return DEFAULT_SESSION_SECTIONS[currentIndex + 1] ?? '엔딩';
}

function getRealtimeStatusMeta(status: RealtimeConnectionStatus, isDemoMode: boolean) {
    if (isDemoMode) {
        return {
            dot: 'bg-white/45',
            label: '데모',
            tone: 'bg-white/[0.08] text-white/60',
        };
    }

    switch (status) {
        case 'connected':
            return {
                dot: 'sync-pulse bg-emerald-400',
                label: '실시간',
                tone: 'bg-emerald-300/[0.12] text-emerald-100',
            };
        case 'reconnecting':
            return {
                dot: 'bg-amber-300',
                label: '재연결',
                tone: 'bg-amber-300/[0.12] text-amber-100',
            };
        case 'offline':
        case 'error':
            return {
                dot: 'bg-red-400',
                label: '오프라인',
                tone: 'bg-red-400/[0.12] text-red-100',
            };
        case 'idle':
        default:
            return {
                dot: 'bg-white/35',
                label: '대기',
                tone: 'bg-white/[0.08] text-white/60',
            };
    }
}

function formatRealtimeAge(value: string | null, now: number) {
    if (!value) {
        return '동기화 대기';
    }

    const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));

    if (!Number.isFinite(seconds) || seconds < 5) {
        return '방금 동기화';
    }

    if (seconds < 60) {
        return `${seconds}초 전`;
    }

    return `${Math.floor(seconds / 60)}분 전`;
}
