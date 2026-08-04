"use client";

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useRealtimeSession, type RealtimeConnectionStatus } from '@/hooks/useRealtimeSession';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { useSessionStore } from '@/store/sessionStore';
import {
    DEFAULT_SESSION_SECTIONS,
    MAX_SESSION_FEEDBACK_LOG,
    MAX_SESSION_FEEDBACK_PRESETS,
    SESSION_FEEDBACK_ROLES,
    getDefaultSessionFeedbackTarget,
    getSessionFeedbackPresetStorageKey,
    normalizeSessionState,
    resolveSongPresetBpm,
    type SessionCurrentState,
    type SessionFeedbackPreset,
    type SessionFeedbackPresetGroup,
    type SessionFeedbackRole,
    type SessionRow,
    type SongRow,
} from '@/types/session';
import {
    ArrowLeft,
    AudioLines,
    BadgeCheck,
    Cable,
    ChevronLeft,
    ChevronRight,
    Clock3,
    HandHeart,
    HeartHandshake,
    MessageSquare,
    Mic2,
    Pencil,
    Plus,
    Radio,
    RefreshCw,
    Send,
    ShieldCheck,
    Timer,
    UsersRound,
    Waves,
    Wifi,
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

type WakeLockSentinelLike = {
    release: () => Promise<void>;
    addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

type QuickPresetDraft = {
    id: string | null;
    role: SessionFeedbackRole;
    group: SessionFeedbackPresetGroup;
    label: string;
    message: string;
    target: string;
};

const QUICK_PRESET_GROUP_OPTIONS: Array<{ id: SessionFeedbackPresetGroup; label: string }> = [
    { id: 'flow', label: '흐름' },
    { id: 'tempo', label: '템포' },
    { id: 'band', label: '밴드' },
    { id: 'media', label: '미디어' },
];

const STAGE_CONNECTIONS = [
    {
        label: '인도자',
        method: '유선 LAN',
        feature: '큐',
        type: 'wired',
        status: 'stable',
        latency: '8ms',
    },
    {
        label: '드럼',
        method: '유선 IEM',
        feature: 'BPM',
        type: 'wired',
        status: 'stable',
        latency: '6ms',
    },
    {
        label: '보컬',
        method: 'Wi-Fi 5GHz',
        feature: '악보',
        type: 'wireless',
        status: 'watch',
        latency: '22ms',
    },
    {
        label: '미디어',
        method: 'Wi-Fi 5GHz',
        feature: '송출',
        type: 'wireless',
        status: 'stable',
        latency: '18ms',
    },
] as const;

const CONNECTION_STATUS_META = {
    stable: {
        label: '정상',
        dot: 'bg-emerald-500',
        tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    },
    watch: {
        label: '확인',
        dot: 'bg-amber-400',
        tone: 'border-amber-400/30 bg-amber-400/12 text-amber-700',
    },
} as const;

const WIRED_STAGE_CONNECTION_COUNT = STAGE_CONNECTIONS.filter((connection) => connection.type === 'wired').length;
const WIRELESS_STAGE_CONNECTION_COUNT = STAGE_CONNECTIONS.filter((connection) => connection.type === 'wireless').length;
const MAX_STAGE_CONNECTION_LATENCY = STAGE_CONNECTIONS.reduce((highest, connection) => (
    Number.parseInt(connection.latency, 10) > Number.parseInt(highest.latency, 10) ? connection : highest
)).latency;

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

function createQuickPresetDraft(role: SessionFeedbackRole = 'leader'): QuickPresetDraft {
    const group: SessionFeedbackPresetGroup = role === 'broadcast'
        ? 'media'
        : role === 'instrument'
            ? 'band'
            : 'flow';

    return {
        id: null,
        role,
        group,
        label: '',
        message: '',
        target: getDefaultSessionFeedbackTarget(role, group),
    };
}

function createQuickPresetDraftFromPreset(preset: SessionFeedbackPreset): QuickPresetDraft {
    return {
        id: preset.id,
        role: preset.role,
        group: preset.group,
        label: preset.label,
        message: preset.message,
        target: preset.target,
    };
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

function getRealtimeStatusMeta(status: RealtimeConnectionStatus, isDemoMode: boolean) {
    if (isDemoMode) {
        return {
            dot: 'bg-primary/45',
            label: '데모',
            tone: 'bg-primary/5 text-primary/50',
        };
    }

    switch (status) {
        case 'connected':
            return {
                dot: 'sync-pulse bg-emerald-500',
                label: '실시간',
                tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            };
        case 'reconnecting':
            return {
                dot: 'bg-amber-400',
                label: '재연결',
                tone: 'bg-amber-400/15 text-amber-700 dark:text-amber-200',
            };
        case 'offline':
        case 'error':
            return {
                dot: 'bg-red-500',
                label: '오프라인',
                tone: 'bg-red-500/10 text-red-600 dark:text-red-300',
            };
        case 'idle':
        default:
            return {
                dot: 'bg-primary/35',
                label: '대기',
                tone: 'bg-primary/5 text-primary/50',
            };
    }
}

function formatRealtimeAge(value: string | null) {
    if (!value) {
        return '동기화 대기';
    }

    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));

    if (!Number.isFinite(seconds) || seconds < 5) {
        return '방금 동기화';
    }

    if (seconds < 60) {
        return `${seconds}초 전`;
    }

    return `${Math.floor(seconds / 60)}분 전`;
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
    const router = useRouter();
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
    const [quickPresetDraft, setQuickPresetDraft] = useState<QuickPresetDraft>(() => createQuickPresetDraft());
    const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
    const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(12);
    const [wakeLockState, setWakeLockState] = useState<'idle' | 'active' | 'unsupported' | 'released'>('idle');
    const [recentSentPresetId, setRecentSentPresetId] = useState<string | null>(null);
    const recentSentPresetTimeoutRef = useRef<number | null>(null);
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

    const {
        broadcastFeedback,
        lastRealtimeAt,
        realtimeStatus,
    } = useRealtimeSession({
        sessionId: session.id,
        teamId,
    });
    const previousRealtimeStatusRef = useRef<RealtimeConnectionStatus>(realtimeStatus);

    const canControlLocally = isActive && (isMaster || !syncEnabled);
    const canManageQuickPresets = isActive && (isMaster || isDemoMode);
    const currentIndex = songs.findIndex((song) => song.id === currentSongId);
    const currentSongPresetBpm = resolveSongPresetBpm(currentSongId, songs);
    const feedbackFeed = [...feedbackLog].reverse();
    const latestFeedbackEntry = feedbackFeed[0] ?? null;
    const mobileQuickFeedbackPresets = [
        ...quickFeedbackPresets.filter((preset) => preset.role === 'instrument'),
        ...quickFeedbackPresets.filter((preset) => preset.role !== 'instrument'),
    ].slice(0, 3);
    const headerIsPending = isStatePending || isFeedbackPending || isPresetPending;
    const selectedRoleMeta = getFeedbackRoleMeta(selectedFeedbackRole);
    const instrumentMode = selectedFeedbackRole === 'instrument';
    const realtimeMeta = getRealtimeStatusMeta(realtimeStatus, isDemoMode);
    const realtimeAgeLabel = formatRealtimeAge(lastRealtimeAt);
    const mobileBpmLabel = currentBpm ?? currentSongPresetBpm ?? '--';
    const mobileBpmActive = bpmEnabled && isActive && Boolean(currentBpm);
    const mobileBpmBeatStyle = {
        '--beat-duration': `${currentBpm ? Math.max(0.24, 60 / currentBpm).toFixed(3) : '0.75'}s`,
    } as CSSProperties;
    const latestCueLabel = latestFeedbackEntry ? latestFeedbackEntry.message : '큐 대기';
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
    const autoAdvanceStatusLabel = autoAdvanceEnabled
        ? canControlLocally && isActive
            ? '자동 넘김 실행 중'
            : '자동 넘김 대기'
        : '수동 넘김';
    const wakeLockStatusLabel = wakeLockState === 'active'
        ? '화면 켜짐 유지'
        : wakeLockState === 'unsupported'
            ? '브라우저 제한'
            : wakeLockState === 'released'
                ? '다시 활성화 필요'
                : '대기';
    const endSessionAction = endSession.bind(null, session.id, teamId);

    const commitState = useCallback((nextState: Partial<SessionCurrentState>) => {
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
    }, [
        autoBpmSync,
        bpmEnabled,
        canControlLocally,
        currentBpm,
        currentPage,
        currentSection,
        currentSongId,
        isDemoMode,
        isMaster,
        session.id,
        songs,
        startStateTransition,
        teamId,
        updateLocalState,
    ]);

    const handleToggleAutoAdvance = () => {
        const nextEnabled = !autoAdvanceEnabled;

        setAutoAdvanceEnabled(nextEnabled);

        if (!nextEnabled) {
            setWakeLockState('idle');
            return;
        }

        setWakeLockState(
            typeof navigator !== 'undefined' && !(navigator as NavigatorWithWakeLock).wakeLock
                ? 'unsupported'
                : 'idle'
        );
    };

    useEffect(() => {
        if (!autoAdvanceEnabled || typeof navigator === 'undefined') {
            return;
        }

        const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;

        if (!wakeLock) {
            return;
        }

        let sentinel: WakeLockSentinelLike | null = null;
        let cancelled = false;

        const requestWakeLock = async () => {
            try {
                const lock = await wakeLock.request('screen');

                if (cancelled) {
                    await lock.release();
                    return;
                }

                sentinel = lock;
                setWakeLockState('active');
                lock.addEventListener?.('release', () => {
                    sentinel = null;
                    setWakeLockState('released');
                });
            } catch {
                setWakeLockState('unsupported');
            }
        };

        void requestWakeLock();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !sentinel) {
                void requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            if (sentinel) {
                void sentinel.release();
            }
        };
    }, [autoAdvanceEnabled]);

    useEffect(() => {
        if (!autoAdvanceEnabled || !canControlLocally || !isActive) {
            return;
        }

        const timer = window.setTimeout(() => {
            commitState({ page: currentPage + 1 });
        }, autoAdvanceSeconds * 1000);

        return () => window.clearTimeout(timer);
    }, [autoAdvanceEnabled, autoAdvanceSeconds, canControlLocally, commitState, currentPage, isActive]);

    useEffect(() => {
        const previousStatus = previousRealtimeStatusRef.current;

        previousRealtimeStatusRef.current = realtimeStatus;

        if (
            isDemoMode ||
            realtimeStatus !== 'connected' ||
            !['error', 'offline', 'reconnecting'].includes(previousStatus)
        ) {
            return;
        }

        router.refresh();
    }, [isDemoMode, realtimeStatus, router]);

    useEffect(() => {
        if (isDemoMode || !syncEnabled) {
            return;
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                router.refresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isDemoMode, router, syncEnabled]);

    useEffect(() => () => {
        if (recentSentPresetTimeoutRef.current) {
            window.clearTimeout(recentSentPresetTimeoutRef.current);
        }
    }, []);

    const showPresetSentState = useCallback((presetId?: string) => {
        if (!presetId) {
            return;
        }

        setRecentSentPresetId(presetId);

        if (recentSentPresetTimeoutRef.current) {
            window.clearTimeout(recentSentPresetTimeoutRef.current);
        }

        recentSentPresetTimeoutRef.current = window.setTimeout(() => {
            setRecentSentPresetId((currentPresetId) => (
                currentPresetId === presetId ? null : currentPresetId
            ));
            recentSentPresetTimeoutRef.current = null;
        }, 1200);
    }, []);

    const sendFeedbackMessage = async (message: string, role: SessionFeedbackRole) => {
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

        if (isDemoMode) {
            return;
        }

        void broadcastFeedback(entry);

        const result = await appendSessionFeedback(session.id, teamId, {
            id: entry.id,
            clientId,
            role,
            message,
            songId: currentSongId,
            songTitle: currentSong?.title ?? null,
            page: currentPage,
            section: currentSection,
        });

        updateLocalState({ feedbackLog: result.feedbackLog });
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

        const label = quickPresetDraft.label.trim();
        const message = quickPresetDraft.message.trim();
        const target = quickPresetDraft.target.trim() ||
            getDefaultSessionFeedbackTarget(quickPresetDraft.role, quickPresetDraft.group);

        if (!message || !canManageQuickPresets) {
            return;
        }

        const nextPreset = {
            id: quickPresetDraft.id ?? crypto.randomUUID(),
            role: quickPresetDraft.role,
            group: quickPresetDraft.group,
            label: (label || message).slice(0, 32),
            message,
            target: target.slice(0, 24),
            createdAt: new Date().toISOString(),
        };
        const nextDraft = createQuickPresetDraft(quickPresetDraft.role);

        if (isDemoMode) {
            const nextQuickFeedbackPresets = [
                ...quickFeedbackPresets.filter((preset) => preset.id !== nextPreset.id),
                nextPreset,
            ].slice(-MAX_SESSION_FEEDBACK_PRESETS);

            updateLocalState({
                quickFeedbackPresets: nextQuickFeedbackPresets,
            });
            window.sessionStorage.setItem(
                getSessionFeedbackPresetStorageKey(session.id),
                JSON.stringify(nextQuickFeedbackPresets)
            );
            setQuickPresetDraft(nextDraft);
            return;
        }

        startPresetTransition(async () => {
            try {
                const nextQuickFeedbackPresets = await addSessionFeedbackPreset(session.id, teamId, {
                    id: quickPresetDraft.id ?? undefined,
                    role: quickPresetDraft.role,
                    group: quickPresetDraft.group,
                    label: label || message,
                    message,
                    target,
                });

                updateLocalState({ quickFeedbackPresets: nextQuickFeedbackPresets });
                setQuickPresetDraft(nextDraft);
            } catch (error) {
                console.error('Failed to add session feedback preset:', error);
            }
        });
    };

    const handleQuickPresetEdit = (preset: SessionFeedbackPreset) => {
        setQuickPresetDraft(createQuickPresetDraftFromPreset(preset));
    };

    const handleQuickPresetReset = () => {
        setQuickPresetDraft(createQuickPresetDraft(selectedFeedbackRole));
    };

    const handleQuickPresetSend = (message: string, role: SessionFeedbackRole, presetId?: string) => {
        if (!isActive || isFeedbackPending) {
            return;
        }

        showPresetSentState(presetId);

        startFeedbackTransition(async () => {
            try {
                await sendFeedbackMessage(message, role);
            } catch (error) {
                console.error('Failed to send quick feedback:', error);
            }
        });
    };

    return (
        <div className="safe-area-x relative min-h-screen overflow-x-hidden bg-background py-6 pb-32 text-primary sm:px-6 sm:py-8 sm:pb-36 md:px-10 lg:pb-10">
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
                            <h1 className="break-words text-2xl font-serif font-black tracking-tight text-primary sm:text-4xl md:text-5xl">
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

                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
                        <ThemeToggle />
                        <Link
                            href={`/session/${session.id}/team`}
                            className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-secondary/25 bg-secondary/[0.12] px-4 py-3 text-sm font-semibold text-secondary transition hover:bg-secondary/15 motion-safe:active:scale-[0.98]"
                        >
                            <Radio size={16} />
                            예배팀 모드
                        </Link>
                        <button
                            type="button"
                            onClick={toggleMaster}
                            className={`tap-target hidden w-full rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto xl:inline-flex ${isMaster ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-primary/10 bg-card/70 text-primary hover:border-primary/20 hover:bg-card'}`}
                        >
                            {isMaster ? '팔로워로 보기' : '인도자 제어 잡기'}
                        </button>
                        <button
                            type="button"
                            onClick={toggleSync}
                            className={`tap-target hidden w-full rounded-full border px-5 py-3 text-sm font-semibold transition sm:w-auto xl:inline-flex ${syncEnabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-primary/10 bg-card/70 text-primary hover:border-primary/20 hover:bg-card'}`}
                        >
                            {syncEnabled ? '라이브 동기화 켜짐' : '라이브 동기화 꺼짐'}
                        </button>
                        <form action={endSessionAction} className="hidden w-full sm:w-auto xl:block">
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
                    <GlassCard className="border-primary/10 bg-card/60">
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

                <GlassCard className="sticky top-3 z-40 border-primary/10 bg-card/90 p-3 shadow-lg xl:hidden" data-testid="mobile-live-panel">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold ${realtimeMeta.tone}`}
                            data-testid="sync-health-badge"
                        >
                            <span className={`h-2 w-2 rounded-full ${realtimeMeta.dot}`} />
                            {realtimeMeta.label}
                            <span className="opacity-45">·</span>
                            {realtimeAgeLabel}
                        </span>
                        <button
                            type="button"
                            onClick={() => setFeedbackRole('instrument')}
                            className={`min-h-8 rounded-full px-3 text-[11px] font-bold transition motion-safe:active:scale-[0.98] ${instrumentMode ? 'bg-secondary/15 text-secondary' : 'bg-primary/5 text-primary/45'}`}
                        >
                            악기
                        </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-primary/40">
                                {currentSection ?? 'Prelude'}
                            </p>
                            <h2 className="truncate text-xl font-serif font-black text-primary">
                                {currentSong?.title ?? '곡 선택 대기'}
                            </h2>
                        </div>
                        <div className="shrink-0 text-right" style={mobileBpmBeatStyle}>
                            <p className="text-[10px] font-bold uppercase text-primary/35">BPM</p>
                            <div className="mt-1 flex items-center justify-end gap-1">
                                <span className={`h-1.5 w-1.5 rounded-full bg-secondary/70 ${mobileBpmActive ? 'bpm-step-dot' : ''}`} />
                                <span className={`h-1.5 w-1.5 rounded-full bg-secondary/35 ${mobileBpmActive ? 'bpm-step-dot [animation-delay:120ms]' : ''}`} />
                            </div>
                            <p className={`mt-1 inline-block font-serif text-2xl font-black leading-none text-secondary ${mobileBpmActive ? 'bpm-digit-pulse' : ''}`}>
                                {mobileBpmLabel}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-primary/10 bg-background/70 px-3 py-2" data-testid="mobile-latest-cue">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase text-primary/35">최근 큐</p>
                            <p className="truncate text-sm font-semibold text-primary/75">
                                {latestCueLabel}
                            </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/5 px-3 py-1 text-xs font-bold text-primary/60">
                            {currentPage}p
                        </span>
                    </div>

                    {mobileQuickFeedbackPresets.length > 0 ? (
                        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                            {mobileQuickFeedbackPresets.map((preset) => {
                                const isSent = recentSentPresetId === preset.id;

                                return (
                                    <button
                                        key={`mobile-${preset.id}`}
                                        type="button"
                                        onClick={() => handleQuickPresetSend(preset.message, preset.role, preset.id)}
                                        disabled={!isActive || isFeedbackPending}
                                        data-testid={`mobile-cue-${preset.id}`}
                                        className={`tap-target min-w-[6.75rem] rounded-md border px-3 py-2 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 motion-safe:active:scale-[0.98] ${isSent ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-primary/10 bg-card/80 text-primary hover:border-secondary/30 hover:bg-secondary/10'}`}
                                    >
                                        <span className="block truncate">{preset.label}</span>
                                        {isSent ? (
                                            <span className="mt-0.5 block text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-300">
                                                전송
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </GlassCard>

                <GlassCard className="border-primary/10 bg-card/72 p-4 sm:p-5" data-testid="live-stage-link-panel">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                예배 중 핵심
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-serif font-black text-primary">
                                    연결 · BPM · 악보
                                </h2>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${autoAdvanceEnabled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary/5 text-primary/45'}`}>
                                    <RefreshCw size={13} />
                                    {autoAdvanceStatusLabel}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${realtimeMeta.tone}`}>
                                    <span className={`h-2 w-2 rounded-full ${realtimeMeta.dot}`} />
                                    {realtimeMeta.label}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-primary/55 sm:flex">
                            <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-background/75 px-3 py-2">
                                <Cable size={13} />
                                유선 {WIRED_STAGE_CONNECTION_COUNT}
                            </span>
                            <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-background/75 px-3 py-2">
                                <Wifi size={13} />
                                Wi-Fi {WIRELESS_STAGE_CONNECTION_COUNT}
                            </span>
                            <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-background/75 px-3 py-2">
                                <Timer size={13} />
                                {MAX_STAGE_CONNECTION_LATENCY}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                            {STAGE_CONNECTIONS.map((connection) => {
                                const statusMeta = CONNECTION_STATUS_META[connection.status];
                                const ConnectionIcon = connection.type === 'wireless' ? Wifi : Cable;

                                return (
                                    <div
                                        key={connection.label}
                                        className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-primary/10 bg-card/65 px-3 py-2.5"
                                        data-testid={`stage-connection-${connection.label}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${statusMeta.dot}`} />
                                                <p className="truncate text-sm font-bold text-primary">
                                                    {connection.label}
                                                </p>
                                            </div>
                                            <p className="mt-1 flex items-center gap-1.5 text-xs text-primary/45">
                                                <ConnectionIcon size={12} />
                                                <span className="truncate">{connection.method} · {connection.feature}</span>
                                            </p>
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${statusMeta.tone}`}>
                                            {statusMeta.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-[auto_1fr_auto] gap-2 sm:grid-cols-[auto_1fr_auto_auto] lg:w-[23rem]">
                            <button
                                type="button"
                                onClick={() => setAutoAdvanceSeconds((seconds) => Math.max(6, seconds - 2))}
                                disabled={!canControlLocally}
                                data-testid="auto-advance-decrease"
                                className="tap-target rounded-md border border-primary/10 bg-background/80 px-3 py-2 text-sm font-bold text-primary transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                -2초
                            </button>
                            <div className="flex min-w-0 items-center justify-center gap-2 rounded-md border border-primary/10 bg-background/80 px-3 py-2 text-sm font-bold text-primary">
                                <Timer size={15} />
                                <span>{autoAdvanceSeconds}초</span>
                                <span className="text-xs font-semibold text-primary/35">| {wakeLockStatusLabel}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAutoAdvanceSeconds((seconds) => Math.min(30, seconds + 2))}
                                disabled={!canControlLocally}
                                data-testid="auto-advance-increase"
                                className="tap-target rounded-md border border-primary/10 bg-background/80 px-3 py-2 text-sm font-bold text-primary transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                +2초
                            </button>
                            <button
                                type="button"
                                onClick={handleToggleAutoAdvance}
                                disabled={!isActive || (!canControlLocally && !autoAdvanceEnabled)}
                                data-testid="auto-advance-toggle"
                                className={`tap-target col-span-3 rounded-md px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-1 ${autoAdvanceEnabled ? 'bg-emerald-600 text-white' : 'bg-primary text-surface'}`}
                            >
                                {autoAdvanceEnabled ? '끄기' : '켜기'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="song-link-check-list">
                        {songs.length === 0 ? (
                            <div className="w-full rounded-md border border-dashed border-primary/10 px-4 py-4 text-center text-sm text-primary/45">
                                연결할 곡이 없습니다.
                            </div>
                        ) : (
                            songs.map((song) => {
                                const isCurrent = song.id === currentSongId;
                                const presetBpm = resolveSongPresetBpm(song.id, songs);
                                const hasSheet = Boolean(song.music_xml_url || song.data_xml);

                                return (
                                    <div
                                        key={`song-link-${song.id}`}
                                        data-testid={`song-link-check-${song.id}`}
                                        className={`min-w-[12rem] rounded-md border px-3 py-3 ${isCurrent ? 'border-secondary/30 bg-secondary/10' : 'border-primary/10 bg-card/55'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-bold text-primary">{song.title}</p>
                                            {isCurrent && (
                                                <span className="shrink-0 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                                                    Live
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-primary/45">
                                            {hasSheet ? '악보 연결' : '악보 대기'} · {presetBpm ? `${presetBpm} BPM` : 'BPM 대기'}
                                        </p>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary/40">
                        <span>{currentIndex >= 0 ? `${currentIndex + 1}/${songs.length}곡` : '곡 대기'}</span>
                        <span>|</span>
                        <span>{realtimeAgeLabel}</span>
                        <span>|</span>
                        <span>잠금/완전 백그라운드는 앱 보강 필요</span>
                        {!canControlLocally && (
                            <>
                                <span>|</span>
                                <span>팔로워 모드</span>
                            </>
                        )}
                    </div>
                </GlassCard>

                <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
                    <div className="flex flex-col gap-6">
                        <GlassCard className="overflow-hidden border-primary/10 p-0">
                            <div className="border-b border-primary/10 bg-card/50 px-4 py-4 sm:px-6">
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
                                <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.16),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.55))] p-5 dark:bg-[radial-gradient(circle_at_top,_rgba(226,182,141,0.16),_transparent_48%),linear-gradient(180deg,rgba(22,33,31,0.92),rgba(22,33,31,0.66))] sm:rounded-[2rem] sm:p-8">
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
                                            <div className="rounded-2xl border border-primary/10 bg-card/70 p-5">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary/35">
                                                    <AudioLines size={14} />
                                                    큐 상태
                                                </div>
                                                <p className="mt-3 text-sm leading-relaxed text-primary/55">
                                                    라이브 동기화가 켜져 있으면 팔로워 화면에 즉시 반영됩니다.
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-primary/10 bg-card/70 p-5">
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
                                    <div className="rounded-3xl border border-primary/10 bg-card/60 p-5">
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
                                                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                <ChevronLeft size={16} />
                                                이전
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => commitState({ page: currentPage + 1 })}
                                                disabled={!canControlLocally}
                                                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                            >
                                                다음
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-primary/10 bg-card/60 p-5">
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
                                                        : 'border-primary/10 bg-background/80 text-primary hover:border-primary/20 hover:bg-card'} disabled:cursor-not-allowed disabled:opacity-45`}
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
                            <div className="border-b border-primary/10 bg-card/55 px-5 py-5">
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
                                                className={`tap-target rounded-2xl border px-4 py-4 text-left transition ${isSelected ? roleMeta.tone : 'border-primary/10 bg-background/70 text-primary hover:border-primary/20 hover:bg-card'}`}
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

                                    <form onSubmit={handleQuickPresetSubmit} className="mt-4 space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                                            <label className="block">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">버튼명</span>
                                                <input
                                                    value={quickPresetDraft.label}
                                                    onChange={(event) => setQuickPresetDraft((draft) => ({
                                                        ...draft,
                                                        label: event.target.value,
                                                    }))}
                                                    maxLength={32}
                                                    placeholder="예: 다음 섹션"
                                                    className="tap-target mt-2 w-full rounded-2xl border border-primary/10 bg-card/80 px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10"
                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">전송 메시지</span>
                                                <input
                                                    value={quickPresetDraft.message}
                                                    onChange={(event) => setQuickPresetDraft((draft) => ({
                                                        ...draft,
                                                        message: event.target.value,
                                                    }))}
                                                    maxLength={220}
                                                    placeholder="예: 다음 섹션으로 넘어갑니다."
                                                    className="tap-target mt-2 w-full rounded-2xl border border-primary/10 bg-card/80 px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10"
                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                />
                                            </label>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                                            <label className="block">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">대상</span>
                                                <input
                                                    value={quickPresetDraft.target}
                                                    onChange={(event) => setQuickPresetDraft((draft) => ({
                                                        ...draft,
                                                        target: event.target.value,
                                                    }))}
                                                    maxLength={24}
                                                    placeholder="예: 전체, 리듬, 미디어"
                                                    className="tap-target mt-2 w-full rounded-2xl border border-primary/10 bg-card/80 px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10"
                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                />
                                            </label>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">그룹</span>
                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        {QUICK_PRESET_GROUP_OPTIONS.map((group) => (
                                                            <button
                                                                key={group.id}
                                                                type="button"
                                                                onClick={() => setQuickPresetDraft((draft) => ({
                                                                    ...draft,
                                                                    group: group.id,
                                                                    target: draft.target || getDefaultSessionFeedbackTarget(draft.role, group.id),
                                                                }))}
                                                                disabled={!canManageQuickPresets || isPresetPending}
                                                                className={`tap-target rounded-2xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${quickPresetDraft.group === group.id ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-primary/10 bg-card/70 text-primary/60 hover:bg-card'}`}
                                                            >
                                                                {group.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/35">채널</span>
                                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                                        {SESSION_FEEDBACK_ROLES.map((role) => {
                                                            const roleMeta = getFeedbackRoleMeta(role);

                                                            return (
                                                                <button
                                                                    key={`preset-role-${role}`}
                                                                    type="button"
                                                                    onClick={() => setQuickPresetDraft((draft) => ({
                                                                        ...draft,
                                                                        role,
                                                                        target: draft.target || getDefaultSessionFeedbackTarget(role, draft.group),
                                                                    }))}
                                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                                    className={`tap-target rounded-2xl border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${quickPresetDraft.role === role ? roleMeta.tone : 'border-primary/10 bg-card/70 text-primary/60 hover:bg-card'}`}
                                                                >
                                                                    {roleMeta.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-xs leading-relaxed text-primary/45">
                                                {canManageQuickPresets ? '저장한 버튼은 예배팀 모드의 즉시 큐에 바로 반영됩니다.' : '버튼 설정은 관리자 또는 인도자 모드에서 변경할 수 있습니다.'}
                                            </p>
                                            <div className="flex gap-2">
                                                {quickPresetDraft.id ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleQuickPresetReset}
                                                        className="tap-target inline-flex items-center justify-center rounded-full border border-primary/10 bg-card/70 px-4 py-2 text-sm font-semibold text-primary/60 transition hover:bg-card"
                                                    >
                                                        새 버튼
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="submit"
                                                    disabled={!canManageQuickPresets || isPresetPending || quickPresetDraft.message.trim().length === 0}
                                                    className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-card/80 px-5 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                                >
                                                    <Plus size={15} />
                                                    {quickPresetDraft.id ? '버튼 수정' : '버튼 저장'}
                                                </button>
                                            </div>
                                        </div>
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
                                                    const isSent = recentSentPresetId === preset.id;

                                                    return (
                                                        <div
                                                            key={preset.id}
                                                            className={`rounded-2xl border p-2 transition ${isSent ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-primary/10 bg-card/60'}`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickPresetSend(preset.message, preset.role, preset.id)}
                                                                disabled={!isActive || isFeedbackPending}
                                                                className="tap-target w-full rounded-xl px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${presetMeta.iconTone}`}>
                                                                        <PresetIcon size={15} />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <p className="truncate text-sm font-semibold">
                                                                                {preset.label}
                                                                            </p>
                                                                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/45">
                                                                                {isSent ? 'Sent' : 'Tap'}
                                                                            </span>
                                                                        </div>
                                                                        <p className="mt-1 truncate text-xs text-primary/55">
                                                                            {preset.message}
                                                                        </p>
                                                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary/45">
                                                                            <span className="rounded-full bg-primary/5 px-2 py-1">{preset.target}</span>
                                                                            <span className="rounded-full bg-primary/5 px-2 py-1">{presetMeta.label}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickPresetEdit(preset)}
                                                                disabled={!canManageQuickPresets || isPresetPending}
                                                                className="tap-target mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary/50 transition hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Pencil size={13} />
                                                                설정
                                                            </button>
                                                        </div>
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
                                            className="mt-3 w-full resize-none rounded-2xl border border-primary/10 bg-card/80 px-4 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary/30 focus:ring-2 focus:ring-secondary/10 sm:text-sm"
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
                                                        className="rounded-3xl border border-primary/10 bg-card/70 p-4"
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
                                                    : 'border-primary/10 bg-card/60 hover:border-primary/20 hover:bg-card'} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <span className={`mt-1 text-lg font-black ${isCurrent ? 'text-secondary' : 'text-primary/20'}`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="truncate text-sm font-semibold text-primary">{song.title}</p>
                                                            {isCurrent && (
                                                                <span className="rounded-full bg-card/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
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

                        <GlassCard className="border-primary/10 bg-card/60">
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
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-card/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-card"
                                    >
                                        <HandHeart size={16} />
                                        기도
                                    </Link>
                                    <Link
                                        href="/serve"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-card/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-card"
                                    >
                                        <BadgeCheck size={16} />
                                        섬김
                                    </Link>
                                    <Link
                                        href="/groups"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-card/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-card"
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
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-card/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <ChevronLeft size={16} />
                        이전
                    </button>
                    <div
                        key={`mobile-page-${currentPage}`}
                        className="min-w-0 rounded-2xl border border-primary/10 bg-primary px-4 py-3 text-center text-surface shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-surface/60">악보</p>
                        <p className="mt-1 text-lg font-black leading-none">{currentPage}</p>
                        {autoAdvanceEnabled && (
                            <p className="mt-1 text-[10px] font-bold leading-none text-surface/65">
                                {autoAdvanceSeconds}초
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label="다음 악보 페이지"
                        onClick={() => commitState({ page: currentPage + 1 })}
                        disabled={!canControlLocally}
                        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-card/85 px-3 py-3 text-sm font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        다음
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
