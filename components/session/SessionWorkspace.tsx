"use client";

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    addSessionFeedbackPreset,
    endSession,
    updateSessionState,
} from '@/actions/sessionActions';
import SessionBpmConsole from '@/components/session/SessionBpmConsole';
import SessionCueToasts from '@/components/session/SessionCueToasts';
import SheetAnnotationWorkspace from '@/components/session/SheetAnnotationWorkspace';
import PageHeader from '@/components/ui/PageHeader';
import Notice from '@/components/ui/Notice';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { STATUS } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import { useRealtimeSession, type RealtimeConnectionStatus } from '@/hooks/useRealtimeSession';
import { isPrototypeSessionId } from '@/lib/constants';
import { useSessionStore } from '@/store/sessionStore';
import { useSongSections } from '@/hooks/useSongSections';
import { createClientId } from '@/lib/clientId';
import { readSongForm } from '@/lib/songFormStorage';
import {
    DEFAULT_SESSION_SECTIONS,
    getCueDeliveryLabel,
    getPresetRecipient,
    MAX_SESSION_FEEDBACK_PRESETS,
    SESSION_FEEDBACK_ROLES,
    getDefaultSessionFeedbackTarget,
    getSessionFeedbackPresetStorageKey,
    normalizeSessionState,
    resolveSongPresetBpm,
    type SessionCurrentState,
    type SessionCueRecipient,
    type SessionFeedbackPreset,
    type SessionFeedbackPresetGroup,
    type SessionFeedbackRole,
    type SessionRow,
    type SongRow,
} from '@/types/session';
import {
    AudioLines,
    BadgeCheck,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    HandHeart,
    HeartHandshake,
    Keyboard,
    Mic2,
    Pencil,
    Plus,
    Radio,
    RefreshCw,
    Send,
    Timer,
    UsersRound,
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
    sessionHref?: string;
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
    { id: 'sound', label: '음향' },
    { id: 'band', label: '밴드' },
    { id: 'media', label: '미디어' },
];

function formatSongMeta(song: SongRow | null) {
    if (!song) {
        return '곡을 선택하면 시작합니다.';
    }

    return [song.artist, song.original_key ? `${song.original_key} 키` : null, song.bpm ? `${song.bpm} BPM` : null]
        .filter(Boolean)
        .join(' · ');
}

/** 역할은 아이콘으로만 구분합니다 (색은 모두 같은 회색 — 선택 표시는 검정/흰 칩이 맡습니다). */
function getFeedbackRoleMeta(role: SessionFeedbackRole) {
    switch (role) {
        case 'instrument':
            return {
                detail: '밴드 밸런스, 전환, 편곡 큐를 보냅니다.',
                icon: AudioLines,
                label: '악기장',
            };
        case 'broadcast':
            return {
                detail: '가사, 송출, 믹스, 카메라 큐를 보냅니다.',
                icon: Radio,
                label: '미디어',
            };
        case 'leader':
        default:
            return {
                detail: '예배 흐름, 섹션, 보컬 방향을 보냅니다.',
                icon: Mic2,
                label: '인도자',
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
    return [songTitle ?? '전체 큐', section, `${page}p`].filter(Boolean).join(' · ');
}

function getRealtimeStatusMeta(status: RealtimeConnectionStatus, isDemoMode: boolean) {
    if (isDemoMode) {
        return { dot: STATUS.idle.dot, label: '데모', tone: STATUS.idle.soft };
    }

    switch (status) {
        case 'connected':
            return { dot: cn('sync-pulse', STATUS.ok.dot), label: '실시간', tone: STATUS.ok.soft };
        case 'reconnecting':
            return { dot: cn('sync-pulse-warning', STATUS.warn.dot), label: '재연결', tone: STATUS.warn.soft };
        case 'offline':
        case 'error':
            return { dot: STATUS.danger.dot, label: '오프라인', tone: STATUS.danger.soft };
        case 'idle':
        default:
            return { dot: STATUS.idle.dot, label: '대기', tone: STATUS.idle.soft };
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

/** '몇 초 전' 글자만 5초마다 새로 그립니다 (페이지 전체를 다시 그리지 않도록 잎 컴포넌트로 분리). */
function SyncAge({ at }: { at: string | null }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 5000);
        return () => window.clearInterval(timer);
    }, []);

    return <>{formatRealtimeAge(at, now)}</>;
}

/** 작은 회색 개수 표시 (줄바꿈 없음) */
const countPill = 'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-2.5 text-xs font-medium tabular-nums text-muted-foreground';
/** 선택형 알약: 선택 = 검정 알약, 나머지 = 흰 바탕 + 가는 테두리 */
const choicePill = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const choiceOn = 'border-primary bg-primary text-primary-foreground';
const choiceOff = 'border-border bg-card text-foreground hover:bg-muted';
/** 목록 앞의 회색 아이콘 칸 */
const iconTile = 'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground';
const fieldLabel = 'text-xs font-medium text-muted-foreground';

export default function SessionWorkspace({
    session,
    songs,
    teamId,
    initialState,
    teamName,
    setlistTitle,
    worshipDateLabel,
    theme,
    sessionHref,
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
    const cueDeliveries = useSessionStore((state) => state.cueDeliveries);
    const songSections = useSongSections(currentSongId, teamId);
    const quickFeedbackPresets = useSessionStore((state) => state.quickFeedbackPresets);
    const selectedFeedbackRole = useSessionStore((state) => state.selectedFeedbackRole);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [sessionError, setSessionError] = useState('');
    const [sheetPageCount, setSheetPageCount] = useState(0);
    const [clientId] = useState(() => createClientId());
    const [quickPresetDraft, setQuickPresetDraft] = useState<QuickPresetDraft>(() => createQuickPresetDraft());
    const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
    const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(12);
    const [wakeLockState, setWakeLockState] = useState<'idle' | 'active' | 'unsupported' | 'released'>('idle');
    const [recentSentPresetId, setRecentSentPresetId] = useState<string | null>(null);
    const [selectedPresetCategory, setSelectedPresetCategory] = useState<'all' | SessionFeedbackPresetGroup>('all');
    const [feedbackSentSuccess, setFeedbackSentSuccess] = useState(false);
    const recentSentPresetTimeoutRef = useRef<number | null>(null);
    const [isStatePending, startStateTransition] = useTransition();
    const [isFeedbackPending, startFeedbackTransition] = useTransition();
    const [isPresetPending, startPresetTransition] = useTransition();
    const isDemoMode = isPrototypeSessionId(session.id);

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
        sendFeedback,
        lastRealtimeAt,
        realtimeStatus,
    } = useRealtimeSession({
        sessionId: session.id,
        teamId,
        clientId,
    });
    const previousRealtimeStatusRef = useRef<RealtimeConnectionStatus>(realtimeStatus);

    const canControlLocally = isActive && (isMaster || !syncEnabled);
    const canManageQuickPresets = isActive && (isMaster || isDemoMode);
    const currentIndex = songs.findIndex((song) => song.id === currentSongId);
    const currentSongPresetBpm = resolveSongPresetBpm(currentSongId, songs);
    const feedbackFeed = [...feedbackLog].reverse();
    const latestFeedbackEntry = feedbackFeed[0] ?? null;
    const mobileQuickFeedbackPresets = [
        ...quickFeedbackPresets.filter((preset) => preset.group === 'tempo' || preset.group === 'sound'),
        ...quickFeedbackPresets.filter((preset) => preset.group !== 'tempo' && preset.group !== 'sound'),
    ].slice(0, 10);
    const filteredQuickFeedbackPresets = useMemo(() => {
        if (selectedPresetCategory === 'all') return quickFeedbackPresets;
        return quickFeedbackPresets.filter((preset) => preset.group === selectedPresetCategory);
    }, [quickFeedbackPresets, selectedPresetCategory]);
    const headerIsPending = isStatePending || isFeedbackPending || isPresetPending;
    const selectedRoleMeta = getFeedbackRoleMeta(selectedFeedbackRole);
    const instrumentMode = selectedFeedbackRole === 'instrument';
    const realtimeMeta = getRealtimeStatusMeta(realtimeStatus, isDemoMode);
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
        ? 'font-semibold text-foreground'
        : syncEnabled
            ? 'text-brand'
            : undefined;
    const syncDescription = isMaster
        ? '페이지와 섹션 변경을 전체 라이브 룸에 보내는 중입니다.'
        : syncEnabled
            ? '현재 화면은 인도자의 라이브 진행을 따라갑니다.'
            : '개별 확인을 위해 라이브 동기화가 잠시 꺼져 있습니다.';
    const teamModeHref = sessionHref
        ? sessionHref.replace('?', '/team?') + (sessionHref.includes('?') ? '' : '/team')
        : `/session/${session.id}/team`;
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
            section: songChanged ? (() => { const first = nextSongId ? readSongForm(nextSongId, teamId)?.sections[0] : null; return first ? `1. ${first.label}` : DEFAULT_SESSION_SECTIONS[0]; })() : nextState.section ?? currentSection,
            bpmEnabled: nextState.bpmEnabled ?? bpmEnabled,
            bpmValue: nextBpmValue,
            autoBpmSync: nextAutoBpmSync,
        };

        updateLocalState(payload);

        if (!isMaster || isPrototypeSessionId(session.id)) {
            return;
        }

        startStateTransition(async () => {
            try {
                await updateSessionState(session.id, teamId, payload);
                setSessionError('');
            } catch {
                setSessionError('변경을 서버에 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.');
            }
        });
    }, [
        autoBpmSync,
        bpmEnabled,
        canControlLocally,
        currentBpm,
        currentPage,
        currentSection,
        currentSongId,
        isMaster,
        session.id,
        songs,
        startStateTransition,
        teamId,
        updateLocalState,
    ]);

    // 악보 화면에 넘기는 페이지 콜백은 항상 같은 함수로 유지합니다.
    // (접속자 신호처럼 페이지와 무관한 이유로 다시 그려질 때 악보 필기 화면까지 새 props 를 받지 않도록)
    const commitStateRef = useRef(commitState);
    useLayoutEffect(() => {
        commitStateRef.current = commitState;
    }, [commitState]);
    const handleSheetPageChange = useCallback((page: number) => {
        commitStateRef.current({ page });
    }, []);

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
        if (!autoAdvanceEnabled || !canControlLocally || !isActive || !sheetPageCount || currentPage >= sheetPageCount) {
            return;
        }

        const timer = window.setTimeout(() => {
            commitState({ page: currentPage + 1 });
        }, autoAdvanceSeconds * 1000);

        return () => window.clearTimeout(timer);
    }, [autoAdvanceEnabled, autoAdvanceSeconds, canControlLocally, commitState, currentPage, isActive, sheetPageCount]);

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

    const sendFeedbackMessage = async (message: string, role: SessionFeedbackRole, recipient: SessionCueRecipient = { kind: 'everyone' }) => {
        const entry = {
            id: createClientId(),
            clientId,
            role,
            message,
            createdAt: new Date().toISOString(),
            teamId,
            songId: currentSongId,
            songTitle: currentSong?.title ?? null,
            page: currentPage,
            section: currentSection,
            recipient,
        };

        const result = await sendFeedback(entry);
        if (result.status === 'failed') throw new Error(result.error ?? '큐 전송에 실패했습니다.');
        setSessionError('');
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
                setFeedbackSentSuccess(true);
                setTimeout(() => setFeedbackSentSuccess(false), 2400);
            } catch (error) {
                console.error('Failed to submit session feedback:', error);
                setFeedbackMessage(message);
                setSessionError('큐를 전송하지 못했습니다. 연결을 확인한 뒤 다시 보내주세요.');
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
            id: quickPresetDraft.id ?? createClientId(),
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

        startFeedbackTransition(async () => {
            try {
                const preset = quickFeedbackPresets.find(item => item.id === presetId);
                const recipient: SessionCueRecipient = preset ? getPresetRecipient(preset) : { kind: 'everyone' };
                await sendFeedbackMessage(message, role, recipient);
                showPresetSentState(presetId);
            } catch (error) {
                console.error('Failed to send quick feedback:', error);
                setSessionError('큐를 전송하지 못했습니다. 연결을 확인한 뒤 다시 보내주세요.');
            }
        });
    };

    return (
        <div className="safe-area-x relative min-h-screen overflow-x-hidden bg-background py-6 pb-32 text-foreground sm:px-6 sm:py-8 sm:pb-36 md:px-10 lg:pb-10">
            <SessionCueToasts entries={feedbackLog} isActive={isActive} currentClientId={clientId} appearance="light" />
            {sessionError && <Notice tone="error" className="mx-auto mb-4 max-w-7xl">{sessionError}</Notice>}

            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <PageHeader
                    back={{ href: '/dashboard', label: '오늘' }}
                    eyebrow={
                        <span className="inline-flex flex-wrap items-center gap-x-1.5">
                            <span className={cn('size-1.5 rounded-full', isActive ? 'bg-destructive' : 'bg-muted-foreground/40')} aria-hidden="true" />
                            <span className={cn(isActive && 'font-semibold text-foreground')}>{isActive ? '라이브 세션' : '세션 종료'}</span>
                            <span aria-hidden="true">·</span>
                            <span className={sessionStatusTone}>{sessionStatusLabel}</span>
                            {headerIsPending && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <RefreshCw size={11} className="animate-spin" aria-hidden="true" />
                                        동기화 중
                                    </span>
                                </>
                            )}
                        </span>
                    }
                    title={<span className="break-words">{setlistTitle}</span>}
                    description={
                        <>
                            {[teamName, worshipDateLabel, theme ? `주제: ${theme}` : null].filter(Boolean).join(' · ')}
                            <span className="mt-0.5 block text-xs">{syncDescription}</span>
                        </>
                    }
                    actions={
                        <>
                            <Link href={teamModeHref} className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-4')}>
                                <Radio size={15} aria-hidden="true" />
                                예배팀 모드
                            </Link>
                            <button
                                type="button"
                                onClick={toggleMaster}
                                className={cn(buttonVariants({ variant: isMaster ? 'secondary' : 'outline', size: 'sm' }), 'h-10 px-4')}
                            >
                                {isMaster ? '팔로워로 보기' : '인도자 제어 잡기'}
                            </button>
                            <button
                                type="button"
                                onClick={toggleSync}
                                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-4')}
                            >
                                <span className={cn('size-1.5 rounded-full', syncEnabled ? 'bg-brand' : 'bg-muted-foreground/40')} aria-hidden="true" />
                                {syncEnabled ? '라이브 동기화 켜짐' : '라이브 동기화 꺼짐'}
                            </button>
                            <form action={endSessionAction} className="hidden xl:block">
                                <button
                                    type="submit"
                                    className={cn(buttonVariants({ variant: 'destructive-outline', size: 'sm' }), 'h-10 px-4')}
                                    disabled={!isActive || isDemoMode}
                                >
                                    {isDemoMode ? '데모 세션 유지' : '세션 종료'}
                                </button>
                            </form>
                            <ThemeToggle />
                        </>
                    }
                />

                {!isActive && (
                    <section className="flex flex-col gap-3 rounded-3xl bg-muted/60 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[15px] font-semibold text-foreground">세션이 종료되었습니다</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                이 라이브 룸은 닫혔습니다. 다음 리허설이나 예배가 준비되면 대시보드에서 새 세션을 시작하세요.
                            </p>
                        </div>
                        <Link href="/dashboard" className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-4')}>
                            대시보드로 돌아가기
                        </Link>
                    </section>
                )}

                <section className="sticky top-3 z-40 rounded-3xl border border-border bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] xl:hidden" data-testid="mobile-live-panel">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium', realtimeMeta.tone)}
                            data-testid="sync-health-badge"
                        >
                            <span className={cn('size-1.5 rounded-full', realtimeMeta.dot)} />
                            {realtimeMeta.label}
                            <span className="opacity-50">·</span>
                            <SyncAge at={lastRealtimeAt} />
                        </span>
                        <button
                            type="button"
                            onClick={() => setFeedbackRole('instrument')}
                            aria-pressed={instrumentMode}
                            className={cn(choicePill, 'h-7 px-3 text-[11px]', instrumentMode ? choiceOn : 'border-transparent bg-muted text-muted-foreground')}
                        >
                            악기
                        </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-xs text-muted-foreground">
                                {currentSection ?? 'Prelude'}
                            </p>
                            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {currentSong?.title ?? '곡 선택 대기'}
                            </h2>
                        </div>
                        <div className="shrink-0 text-right" style={mobileBpmBeatStyle}>
                            <p className="flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground">
                                <span className={cn('size-1.5 rounded-full bg-foreground/70', mobileBpmActive && 'bpm-step-dot')} />
                                <span className={cn('size-1.5 rounded-full bg-foreground/30', mobileBpmActive && 'bpm-step-dot [animation-delay:120ms]')} />
                                <span className="ml-0.5">BPM</span>
                            </p>
                            <p className={cn('mt-1 inline-block text-2xl font-semibold leading-none tabular-nums text-foreground', mobileBpmActive && 'bpm-digit-pulse')}>
                                {mobileBpmLabel}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3" data-testid="mobile-latest-cue">
                        <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground">최근 큐</p>
                            <p className="truncate text-sm font-medium text-foreground/80">
                                {latestCueLabel}
                            </p>
                        </div>
                        <span className={countPill}>
                            {currentPage}p
                        </span>
                    </div>

                    {mobileQuickFeedbackPresets.length > 0 ? (
                        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
                            {mobileQuickFeedbackPresets.map((preset) => {
                                const isSent = recentSentPresetId === preset.id;

                                return (
                                    <button
                                        key={`mobile-${preset.id}`}
                                        type="button"
                                        onClick={() => handleQuickPresetSend(preset.message, preset.role, preset.id)}
                                        disabled={!isActive || isFeedbackPending}
                                        data-testid={`mobile-cue-${preset.id}`}
                                        className={cn(choicePill, 'h-9 px-3.5 text-[13px] motion-safe:active:scale-[0.98]', isSent ? 'border-brand/30 bg-brand/10 text-brand' : choiceOff)}
                                    >
                                        {isSent && <Check size={13} className="animate-check-pop" aria-hidden="true" />}
                                        <span className="max-w-[9rem] truncate">{preset.label}</span>
                                        {isSent ? <span className="text-[11px]">전송</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </section>

                <details className="group rounded-3xl border border-border bg-card">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-2">
                            <span className={cn('size-1.5 shrink-0 rounded-full', realtimeMeta.dot)} aria-hidden="true" />
                            연결 상태 · 자동 넘김 설정
                        </span>
                        <ChevronDown size={16} className="shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="space-y-4 border-t border-border px-5 py-4" data-testid="live-stage-link-panel">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', autoAdvanceEnabled ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground')}>
                                <RefreshCw size={12} aria-hidden="true" />
                                {autoAdvanceStatusLabel}
                            </span>
                            <span className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', realtimeMeta.tone)}>
                                <span className={cn('size-1.5 rounded-full', realtimeMeta.dot)} />
                                {realtimeMeta.label}
                            </span>
                            <p className="text-sm text-muted-foreground">{isDemoMode ? '같은 브라우저의 탭에서 예배 흐름을 체험합니다.' : `서버 연결: ${realtimeMeta.label}`} · 기기별 연결 속도는 측정하지 않습니다.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
                                <button
                                    type="button"
                                    onClick={() => setAutoAdvanceSeconds((seconds) => Math.max(6, seconds - 2))}
                                    disabled={!canControlLocally}
                                    data-testid="auto-advance-decrease"
                                    className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    -2초
                                </button>
                                <span className="inline-flex min-w-16 items-center justify-center gap-1.5 px-1 text-sm font-semibold tabular-nums text-foreground">
                                    <Timer size={14} className="text-muted-foreground" aria-hidden="true" />
                                    {autoAdvanceSeconds}초
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setAutoAdvanceSeconds((seconds) => Math.min(30, seconds + 2))}
                                    disabled={!canControlLocally}
                                    data-testid="auto-advance-increase"
                                    className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    +2초
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleToggleAutoAdvance}
                                disabled={!isActive || (!canControlLocally && !autoAdvanceEnabled)}
                                data-testid="auto-advance-toggle"
                                aria-pressed={autoAdvanceEnabled}
                                className={cn(choicePill, 'h-10 px-4 text-sm font-semibold', autoAdvanceEnabled ? choiceOn : choiceOff)}
                            >
                                {autoAdvanceEnabled ? '끄기' : '켜기'}
                            </button>
                            <span className="text-xs text-muted-foreground">화면 켜짐 · {wakeLockStatusLabel}</span>
                        </div>

                        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" data-testid="song-link-check-list">
                            {songs.length === 0 ? (
                                <div className="w-full rounded-2xl border border-dashed border-input px-4 py-4 text-center text-sm text-muted-foreground">
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
                                            className={cn('min-w-[12rem] rounded-2xl border px-3.5 py-2.5', isCurrent ? 'border-primary' : 'border-border')}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{song.title}</p>
                                                {isCurrent && (
                                                    <span className="shrink-0 text-[11px] font-medium text-brand">
                                                        진행 중
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {hasSheet ? '악보 연결' : '악보 대기'} · {presetBpm ? `${presetBpm} BPM` : 'BPM 대기'}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {[
                                currentIndex >= 0 ? `${currentIndex + 1}/${songs.length}곡` : '곡 대기',
                                '잠금/완전 백그라운드는 앱 보강 필요',
                                !canControlLocally ? '팔로워 모드' : null,
                            ].filter(Boolean).join(' · ')}
                            {' · '}
                            <SyncAge at={lastRealtimeAt} />
                        </p>
                    </div>
                </details>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <section className="min-w-0 rounded-3xl border border-border bg-card" aria-label="현재 곡">
                            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">현재 곡</p>
                                    <h2 className="mt-0.5 break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                        {currentSong?.title ?? '곡이 선택되지 않았습니다'}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">{formatSongMeta(currentSong)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-sm">
                                        <span className="text-muted-foreground">섹션</span>
                                        <span className="font-semibold text-foreground">{currentSection ?? 'Prelude'}</span>
                                    </span>
                                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-sm">
                                        <span className="text-muted-foreground">악보</span>
                                        <span className="font-semibold tabular-nums text-foreground">{currentPage}p</span>
                                    </span>
                                </div>
                            </div>

                            <div className="grid min-w-0 gap-6 p-5 sm:p-6">
                                {currentSong ? <SheetAnnotationWorkspace
                                    key={`${teamId}:${currentSong.id}`}
                                    teamId={teamId}
                                    songId={currentSong.id}
                                    title={currentSong.title}
                                    page={currentPage}
                                    onPageChange={handleSheetPageChange}
                                    canTurnPage={canControlLocally}
                                    onPageCountChange={setSheetPageCount}
                                /> : <p className="text-sm text-muted-foreground">콘티에서 곡을 선택해주세요.</p>}

                                <div className="border-t border-border pt-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-[17px] font-semibold tracking-tight text-foreground">악보 넘기기</h3>
                                                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                                                    <Keyboard size={12} aria-hidden="true" />
                                                    페달 / 방향키 지원
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                인도자의 페이지 변경은 모든 팔로워에게 공유됩니다.
                                            </p>
                                        </div>
                                        <span className={countPill}>
                                            {currentIndex >= 0 ? `${currentIndex + 1} / ${songs.length}` : '콘티 대기'}
                                        </span>
                                    </div>
                                    <div className="mt-4 hidden gap-2 lg:flex">
                                        <button
                                            type="button"
                                            onClick={() => commitState({ page: Math.max(1, currentPage - 1) })}
                                            disabled={!canControlLocally || currentPage <= 1}
                                            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
                                        >
                                            <ChevronLeft size={16} />
                                            이전
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => commitState({ page: currentPage + 1 })}
                                            disabled={!canControlLocally || currentPage >= sheetPageCount}
                                            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
                                        >
                                            다음
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t border-border pt-5">
                                    <h3 className="text-[17px] font-semibold tracking-tight text-foreground">섹션 알림</h3>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {songSections.map((sectionName) => {
                                            const isCurrentSection = currentSection === sectionName;

                                            return (
                                                <button
                                                    key={sectionName}
                                                    type="button"
                                                    onClick={() => commitState({ section: sectionName })}
                                                    disabled={!canControlLocally}
                                                    aria-pressed={isCurrentSection}
                                                    className={cn(choicePill, 'tap-bounce h-10 px-4 text-sm', isCurrentSection ? choiceOn : choiceOff)}
                                                >
                                                    {sectionName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <p className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                                    <span className="font-semibold text-foreground">악보 함께 보기</span>
                                    {' · '}
                                    PDF·이미지 악보에 필기한 뒤 공유본을 저장하세요. 다른 기기에서는 전달받은 공유 파일을 열어 확인할 수 있습니다.
                                </p>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="session-order-title">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 id="session-order-title" className="text-[17px] font-semibold tracking-tight text-foreground">콘티 순서</h2>
                                    <p className="mt-1 text-sm text-muted-foreground">곡을 누르면 현재 라이브 곡으로 전환됩니다.</p>
                                </div>
                                <span className={countPill}>
                                    {songs.length}곡
                                </span>
                            </div>
                            <ol className="-mx-2 mt-3 space-y-0.5">
                                {songs.length === 0 ? (
                                    <li className="mx-2 rounded-2xl border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
                                        아직 콘티에 연결된 곡이 없습니다.
                                    </li>
                                ) : (
                                    songs.map((song, index) => {
                                        const isCurrent = song.id === currentSongId;

                                        return (
                                            <li key={song.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => commitState({
                                                        songId: song.id,
                                                        page: 1,
                                                        section: DEFAULT_SESSION_SECTIONS[0],
                                                    })}
                                                    disabled={!canControlLocally}
                                                    aria-current={isCurrent ? 'true' : undefined}
                                                    className={cn(
                                                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                                        isCurrent ? 'bg-muted' : 'hover:bg-muted/60',
                                                    )}
                                                >
                                                    <span className={cn('w-6 shrink-0 text-sm font-semibold tabular-nums', isCurrent ? 'text-brand' : 'text-muted-foreground')}>
                                                        {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-center justify-between gap-3">
                                                            <span className="truncate text-[15px] font-medium text-foreground">{song.title}</span>
                                                            {isCurrent && (
                                                                <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                                                                    진행 중
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                            {formatSongMeta(song)}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })
                                )}
                            </ol>
                        </section>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
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

                        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="session-team-cue-title">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 id="session-team-cue-title" className="text-[17px] font-semibold tracking-tight text-foreground">팀에 전달</h2>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                        짧은 메시지를 전체에 전하거나 예배팀 모드에서 수신 대상을 선택하세요.
                                    </p>
                                </div>
                                <span className={countPill}>
                                    {feedbackLog.length}개 기록
                                </span>
                            </div>

                            <div className="mt-4">
                                <div role="group" aria-label="작성 역할" className="flex w-full gap-1 rounded-full bg-muted p-1">
                                    {SESSION_FEEDBACK_ROLES.map((role) => {
                                        const roleMeta = getFeedbackRoleMeta(role);
                                        const RoleIcon = roleMeta.icon;
                                        const isSelected = role === selectedFeedbackRole;

                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setFeedbackRole(role)}
                                                aria-pressed={isSelected}
                                                className={cn(
                                                    'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors',
                                                    isSelected ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                <RoleIcon size={14} aria-hidden="true" />
                                                <span className="truncate">{roleMeta.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{selectedRoleMeta.detail}</p>
                            </div>

                            <div className="mt-6 border-t border-border pt-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-[15px] font-semibold text-foreground">원터치 버튼</h3>
                                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                            자주 쓰는 큐를 등록해두고 한 번의 터치로 전체 라이브 그룹에 보냅니다.
                                        </p>
                                    </div>
                                    <span className={countPill}>
                                        {quickFeedbackPresets.length}개 저장
                                    </span>
                                </div>

                                <details className="group/preset mt-3">
                                    <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                                        <Plus size={15} className="text-brand" aria-hidden="true" />
                                        큐 버튼 만들기 · 설정
                                        <ChevronDown size={14} className="text-muted-foreground transition group-open/preset:rotate-180" aria-hidden="true" />
                                    </summary>
                                    <form onSubmit={handleQuickPresetSubmit} className="mt-3 space-y-4 rounded-3xl bg-muted/50 p-4">
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                                            <label className="block">
                                                <span className={fieldLabel}>버튼명</span>
                                                <Input
                                                    value={quickPresetDraft.label}
                                                    onChange={(event) => setQuickPresetDraft((draft) => ({
                                                        ...draft,
                                                        label: event.target.value,
                                                    }))}
                                                    maxLength={32}
                                                    placeholder="예: 다음 섹션"
                                                    className="mt-1.5"
                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                />
                                            </label>
                                            <label className="block">
                                                <span className={fieldLabel}>전송 메시지</span>
                                                <Input
                                                    value={quickPresetDraft.message}
                                                    onChange={(event) => setQuickPresetDraft((draft) => ({
                                                        ...draft,
                                                        message: event.target.value,
                                                    }))}
                                                    maxLength={220}
                                                    placeholder="예: 다음 섹션으로 넘어갑니다."
                                                    className="mt-1.5"
                                                    disabled={!canManageQuickPresets || isPresetPending}
                                                />
                                            </label>
                                        </div>

                                        <label className="block">
                                            <span className={fieldLabel}>대상</span>
                                            <Select
                                                value={quickPresetDraft.target}
                                                onChange={(event) => setQuickPresetDraft((draft) => ({ ...draft, target: event.target.value }))}
                                                className="mt-1.5"
                                                disabled={!canManageQuickPresets || isPresetPending}
                                            >
                                                {['전체', '팀', '인도자', '악기', '리듬', '음향', '미디어'].map(target => <option key={target} value={target}>{target}</option>)}
                                                {!['전체', '팀', '인도자', '악기', '리듬', '음향', '미디어'].includes(quickPresetDraft.target) && <option value={quickPresetDraft.target}>{quickPresetDraft.target} (기존 표시)</option>}
                                            </Select>
                                        </label>

                                        <div>
                                            <span className={fieldLabel}>그룹</span>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                                                        aria-pressed={quickPresetDraft.group === group.id}
                                                        className={cn(choicePill, 'h-8 px-3 text-xs', quickPresetDraft.group === group.id ? choiceOn : choiceOff)}
                                                    >
                                                        {group.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className={fieldLabel}>채널</span>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                                                            aria-pressed={quickPresetDraft.role === role}
                                                            className={cn(choicePill, 'h-8 px-3 text-xs', quickPresetDraft.role === role ? choiceOn : choiceOff)}
                                                        >
                                                            {roleMeta.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-xs leading-relaxed text-muted-foreground">
                                                {canManageQuickPresets ? '저장한 버튼은 예배팀 모드의 즉시 큐에 바로 반영됩니다.' : '버튼 설정은 관리자 또는 인도자 모드에서 변경할 수 있습니다.'}
                                            </p>
                                            <div className="flex shrink-0 gap-2">
                                                {quickPresetDraft.id ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleQuickPresetReset}
                                                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                                                    >
                                                        새 버튼
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="submit"
                                                    disabled={!canManageQuickPresets || isPresetPending || quickPresetDraft.message.trim().length === 0}
                                                    className={buttonVariants({ size: 'sm' })}
                                                >
                                                    <Plus size={15} />
                                                    {quickPresetDraft.id ? '버튼 수정' : '버튼 저장'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </details>

                                {quickFeedbackPresets.length > 0 && (
                                    <div role="group" aria-label="큐 그룹" className="no-scrollbar -mx-5 mt-4 flex gap-5 overflow-x-auto border-b border-border px-5 sm:-mx-6 sm:px-6">
                                        {[{ id: 'all' as const, label: '전체', count: quickFeedbackPresets.length }, ...QUICK_PRESET_GROUP_OPTIONS.map((grp) => ({
                                            id: grp.id,
                                            label: grp.label,
                                            count: quickFeedbackPresets.filter((p) => p.group === grp.id).length,
                                        }))].map((tab) => {
                                            const isOn = selectedPresetCategory === tab.id;

                                            return (
                                                <button
                                                    key={`cat-filter-${tab.id}`}
                                                    type="button"
                                                    onClick={() => setSelectedPresetCategory(tab.id)}
                                                    aria-pressed={isOn}
                                                    className={cn('-mb-px inline-flex h-10 shrink-0 items-center gap-1 border-b-2 text-sm transition-colors', isOn ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
                                                >
                                                    {tab.label}
                                                    <span className="text-xs tabular-nums opacity-70">{tab.count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <ul className="mt-1 divide-y divide-border">
                                    {filteredQuickFeedbackPresets.length === 0 ? (
                                        <li className="mt-3 rounded-2xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
                                            {selectedPresetCategory === 'all'
                                                ? '아직 빠른 버튼이 없습니다. 예배 중 자주 반복하는 큐를 추가하면 여기에 표시됩니다.'
                                                : `'${QUICK_PRESET_GROUP_OPTIONS.find((g) => g.id === selectedPresetCategory)?.label}' 그룹에 등록된 버튼이 없습니다.`}
                                        </li>
                                    ) : (
                                        filteredQuickFeedbackPresets
                                            .slice()
                                            .reverse()
                                            .map((preset) => {
                                                const presetMeta = getFeedbackRoleMeta(preset.role);
                                                const PresetIcon = presetMeta.icon;
                                                const isSent = recentSentPresetId === preset.id;

                                                return (
                                                    <li key={preset.id} className="flex items-center gap-2 py-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickPresetSend(preset.message, preset.role, preset.id)}
                                                            disabled={!isActive || isFeedbackPending}
                                                            className="tap-bounce flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left transition disabled:cursor-not-allowed disabled:opacity-45"
                                                        >
                                                            <span className={cn(iconTile, 'transition-colors', isSent && 'bg-brand text-brand-foreground animate-success-bounce')}>
                                                                {isSent ? <Check size={16} className="animate-check-pop" /> : <PresetIcon size={16} />}
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="truncate text-sm font-semibold text-foreground">{preset.label}</span>
                                                                    {isSent && (
                                                                        <span className="animate-check-pop shrink-0 text-[11px] font-semibold text-brand">전송 완료</span>
                                                                    )}
                                                                </span>
                                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                                    {preset.message} · {preset.target} · {presetMeta.label}
                                                                </span>
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickPresetEdit(preset)}
                                                            disabled={!canManageQuickPresets || isPresetPending}
                                                            aria-label="설정"
                                                            title={`${preset.label} 버튼 설정`}
                                                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                    </li>
                                                );
                                            })
                                    )}
                                </ul>
                            </div>

                            <form onSubmit={handleFeedbackSubmit} className="mt-6 border-t border-border pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-[15px] font-semibold text-foreground">
                                        전체에게 보내기 <span className="font-normal text-muted-foreground">· 작성 역할 {selectedRoleMeta.label}</span>
                                    </h3>
                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Clock3 size={13} aria-hidden="true" />
                                        {currentSection ?? 'Prelude'} · {currentPage}p
                                    </span>
                                </div>
                                <Textarea
                                    value={feedbackMessage}
                                    onChange={(event) => setFeedbackMessage(event.target.value)}
                                    maxLength={220}
                                    rows={4}
                                    placeholder="예배팀에 전달할 짧은 메시지를 입력하세요."
                                    className="mt-3 resize-none"
                                    disabled={!isActive || isFeedbackPending}
                                />
                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        실제 수신 여부는 아래 큐 기록에서 확인하세요.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={!isActive || isFeedbackPending || feedbackMessage.trim().length === 0}
                                        className={cn(buttonVariants({ size: 'sm' }), 'tap-bounce h-10 px-5', feedbackSentSuccess && 'bg-brand text-brand-foreground hover:bg-brand/90')}
                                    >
                                        {isFeedbackPending ? (
                                            <>
                                                <Send size={15} className="animate-send-fly" />
                                                <span>전송 중…</span>
                                            </>
                                        ) : feedbackSentSuccess ? (
                                            <>
                                                <Check size={16} className="animate-check-pop" />
                                                <span>전송 완료!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={15} />
                                                <span>큐 보내기</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 border-t border-border pt-5">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <h3 className="text-[15px] font-semibold text-foreground">최근 큐</h3>
                                    <p className="text-xs text-muted-foreground">
                                        최근 큐는 라이브 세션 로그에 함께 남습니다.
                                    </p>
                                </div>
                                <ul className="mt-2 max-h-[26rem] divide-y divide-border overflow-y-auto pr-1">
                                    {feedbackFeed.length === 0 ? (
                                        <li className="mt-2 rounded-2xl border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
                                            아직 큐가 없습니다. 첫 팀 알림이 여기에 표시됩니다.
                                        </li>
                                    ) : (
                                        feedbackFeed.map((entry) => {
                                            const roleMeta = getFeedbackRoleMeta(entry.role);
                                            const EntryIcon = roleMeta.icon;

                                            return (
                                                <li key={entry.id} className="flex items-start gap-3 py-3.5">
                                                    <span className={iconTile}>
                                                        <EntryIcon size={16} />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-semibold text-foreground">{roleMeta.label}</span>
                                                            {' · '}
                                                            {formatFeedbackTime(entry.createdAt)}
                                                        </p>
                                                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                                                            {entry.message}
                                                        </p>
                                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                            {entry.clientId === clientId ? getCueDeliveryLabel(cueDeliveries[entry.id]) : '수신 큐 · 읽음 확인은 별도입니다.'}
                                                        </p>
                                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                                            {formatFeedbackContext(entry.songTitle, entry.section, entry.page)}
                                                        </p>
                                                    </div>
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                            <div className="flex items-start gap-3">
                                <span className={iconTile}>
                                    <HeartHandshake size={18} aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">예배 후</p>
                                    <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
                                        찬양 이후에도 팀의 연결을 이어갑니다.
                                    </h2>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                        라이브 컨트롤은 단순하게 유지하면서 예배 후 기도, 섬김, 그룹, 묵상으로 이어지게 합니다.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link href="/care" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-4')}>
                                    <HandHeart size={15} className="text-muted-foreground" />
                                    기도
                                </Link>
                                <Link href="/serve" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-4')}>
                                    <BadgeCheck size={15} className="text-muted-foreground" />
                                    섬김
                                </Link>
                                <Link href="/groups" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-10 px-4')}>
                                    <UsersRound size={15} className="text-muted-foreground" />
                                    그룹
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 pt-3 backdrop-blur lg:hidden">
                <div className="pb-safe mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <button
                        type="button"
                        aria-label="이전 악보 페이지"
                        onClick={() => commitState({ page: Math.max(1, currentPage - 1) })}
                        disabled={!canControlLocally || currentPage <= 1}
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        <ChevronLeft size={16} />
                        이전
                    </button>
                    <div
                        key={`mobile-page-${currentPage}`}
                        className="inline-flex h-11 min-w-20 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold tabular-nums text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
                    >
                        <span className="text-xs font-medium text-primary-foreground/60">악보</span>
                        {currentPage}p
                        {autoAdvanceEnabled && (
                            <span className="text-xs font-medium text-primary-foreground/60">· {autoAdvanceSeconds}초</span>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label="다음 악보 페이지"
                        onClick={() => commitState({ page: currentPage + 1 })}
                        disabled={!canControlLocally || currentPage >= sheetPageCount}
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        다음
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
