"use client";

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import SessionCueToasts from '@/components/session/SessionCueToasts';
import SoundEngineerWorkspace from '@/components/session/SoundEngineerWorkspace';
import { useVisualMetronome } from '@/components/session/SessionBpmConsole';
import { useRealtimeSession, type RealtimeConnectionStatus } from '@/hooks/useRealtimeSession';
import { isPrototypeSessionId } from '@/lib/constants';
import { createClientId } from '@/lib/clientId';
import { useSongSections } from '@/hooks/useSongSections';
import { useSessionStore } from '@/store/sessionStore';
import {
    getDefaultSessionFeedbackTarget,
    getSessionFeedbackPresetStorageKey,
    getCueDeliveryLabel,
    getPresetRecipient,
    normalizeSessionState,
    type SessionCurrentState,
    type SessionFeedbackEntry,
    type SessionFeedbackPreset,
    type SessionFeedbackPresetGroup,
    type SessionFeedbackRole,
    type SessionCueRecipient,
    type SessionRow,
    type SongRow,
} from '@/types/session';
import { usePageTurner } from '@/hooks/usePageTurner';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useFullscreen } from '@/hooks/useFullscreen';
import {
    ArrowLeft,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronsUp,
    CornerDownRight,
    Lock,
    Maximize2,
    Minimize2,
    Pause,
    Radio,
    Send,
    ShieldAlert,
    Sun,
    SunDim,
    Timer,
    Unlock,
    type LucideIcon,
} from 'lucide-react';

interface WorshipTeamModeProps {
    workspaceHref?: string;
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
    workspaceHref,
    session,
    songs,
    teamId,
    initialState,
    teamName,
    setlistTitle,
}: WorshipTeamModeProps) {
    const initializeSession = useSessionStore((state) => state.initializeSession);
    const applyRemoteState = useSessionStore((state) => state.applyRemoteState);
    const updateState = useSessionStore((state) => state.updateState);
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
    const selectedFeedbackRole = useSessionStore((state) => state.selectedFeedbackRole);
    const setFeedbackRole = useSessionStore((state) => state.setFeedbackRole);
    const cueDeliveries = useSessionStore((state) => state.cueDeliveries);
    const [recipientChoice, setRecipientChoice] = useState('preset');
    const [lastSentEntryId, setLastSentEntryId] = useState<string | null>(null);
    const [clientId] = useState(createClientId);
    const [modeView, setModeView] = useState<'stage' | 'sound'>('stage');
    const [stageLocked, setStageLocked] = useState(false);
    const [recentActionId, setRecentActionId] = useState<string | null>(null);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [failedActionId, setFailedActionId] = useState<string | null>(null);
    const [cooldownActionIds, setCooldownActionIds] = useState<string[]>([]);
    const [stageFlash, setStageFlash] = useState<StageFlash | null>(null);
    const [isPending, startTransition] = useTransition();
    const flashTimeoutRef = useRef<number | null>(null);
    const cooldownTimeoutRefs = useRef<Record<string, number>>({});
    const appliedSessionStateRef = useRef(JSON.stringify(session.current_state) ?? '');
    const isDemoMode = isPrototypeSessionId(session.id);
    const { activeBeat, blinkActive } = useVisualMetronome(bpmEnabled && isActive, currentBpm);
    const nowTick = useNowTick(5000);
    const { sendFeedback, participants, localTransportAvailable, lastRealtimeAt, realtimeStatus } = useRealtimeSession({
        sessionId: session.id,
        teamId,
        clientId,
    });
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported, toggle: toggleWakeLock } = useScreenWakeLock(isActive);
    const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen } = useFullscreen();

    const realtimeMeta = getRealtimeStatusMeta(realtimeStatus, localTransportAvailable);
    const realtimeAgeLabel = formatRealtimeAge(lastRealtimeAt, nowTick);
    const latestCue = feedbackLog[feedbackLog.length - 1] ?? null;
    const currentSongIndex = songs.findIndex((song) => song.id === currentSongId);
    const nextSong = currentSongIndex >= 0 ? songs[currentSongIndex + 1] ?? null : songs[1] ?? null;
    const sections = useSongSections(currentSongId, teamId);
    const displayedSection = currentSection ?? sections[0] ?? '대기';
    const sectionIndex = sections.indexOf(displayedSection);
    const nextSection = sectionIndex < 0 ? '섹션 확인' : sections[sectionIndex + 1] ?? '마지막 섹션';
    const beatDurationStyle = {
        '--beat-duration': `${currentBpm ? (60 / currentBpm).toFixed(3) : '0.75'}s`,
    } as CSSProperties;
    const metronomeActive = bpmEnabled && isActive && Boolean(currentBpm);

    const handlePrevSong = () => {
        if (currentSongIndex > 0) {
            const prev = songs[currentSongIndex - 1];
            updateState({ songId: prev.id, page: 1, section: null });
        }
    };
    const handleNextSong = () => {
        if (currentSongIndex < songs.length - 1) {
            const next = songs[currentSongIndex + 1];
            updateState({ songId: next.id, page: 1, section: null });
        }
    };
    const handlePrevSection = () => {
        if (sectionIndex > 0) {
            updateState({ section: sections[sectionIndex - 1] });
        }
    };
    const handleNextSection = () => {
        if (sectionIndex >= 0 && sectionIndex < sections.length - 1) {
            updateState({ section: sections[sectionIndex + 1] });
        } else if (sectionIndex < 0 && sections.length > 0) {
            updateState({ section: sections[0] });
        }
    };

    usePageTurner({
        onNext: () => {
            if (sectionIndex >= 0 && sectionIndex < sections.length - 1) {
                handleNextSection();
            } else if (currentSongIndex < songs.length - 1) {
                handleNextSong();
            }
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.(35);
            }
        },
        onPrev: () => {
            if (sectionIndex > 0) {
                handlePrevSection();
            } else if (currentSongIndex > 0) {
                handlePrevSong();
            }
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.(35);
            }
        },
        enabled: isActive,
    });

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
        const flashToken = createClientId();

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

        beginCooldown(action);
        setFailedActionId(null);

        const recipient: SessionCueRecipient = recipientChoice.startsWith('member:')
            ? { kind: 'member', clientId: recipientChoice.slice(7) }
            : recipientChoice === 'everyone' ? { kind: 'everyone' }
            : recipientChoice === 'preset'
                ? getPresetRecipient(action)
                : { kind: 'role', role: recipientChoice as SessionFeedbackRole };
        const entry: SessionFeedbackEntry = {
            id: createClientId(),
            clientId,
            role: action.role,
            message: action.message,
            createdAt: new Date().toISOString(),
            teamId,
            songId: currentSongId,
            songTitle: currentSong?.title ?? null,
            page: currentPage,
            section: currentSection,
            recipient,
        };
        setLastSentEntryId(entry.id);
        setPendingActionId(action.id);

        startTransition(async () => {
            try {
                const result = await sendFeedback(entry);
                if (result.status === 'failed') {
                    setFailedActionId(action.id);
                } else {
                    const targetLabel = result.transport === 'local' && realtimeStatus !== 'connected'
                        ? '로컬 전용 (원격 미연결)'
                        : recipient.kind === 'everyone' ? '전체' : recipient.kind === 'role' ? ROLE_LABELS[recipient.role] : `기기 ${recipient.clientId.slice(0, 6)}`;
                    showActionFeedback({ ...action, target: targetLabel });
                }
            } catch (error) {
                console.error('Failed to send worship team action:', error);
                setFailedActionId(action.id);
            } finally {
                setPendingActionId(null);
            }
        });
    };

    return (
        <main className="safe-area-x min-h-dvh overflow-x-hidden bg-[#050b0a] text-[#fff7e8]">
            <SessionCueToasts entries={feedbackLog} isActive={isActive} currentClientId={clientId} />
            {stageFlash ? (
                <div key={stageFlash.token} className="pointer-events-none fixed top-4 inset-x-4 z-50 flex justify-center animate-in slide-in-from-top duration-200">
                    <div
                        className="flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl bg-black/90 text-white"
                        style={{ borderColor: `rgb(${stageFlash.accent})` }}
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check size={18} strokeWidth={3} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-base font-black leading-tight tracking-tight">
                                {stageFlash.label}{' '}
                                <span className="text-xs font-normal text-white/70">· {stageFlash.target}</span>
                            </p>
                            <p className="text-xs text-white/80 truncate">{stageFlash.message}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
                <header className="flex items-center justify-between gap-2 sm:gap-3">
                    <Link
                        href={workspaceHref ?? `/session/${session.id}`}
                        aria-label="기본 세션 화면으로 돌아가기"
                        className="tap-target inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft size={14} />
                        <span className="hidden sm:inline">기본 화면</span>
                    </Link>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
                        <button
                            type="button"
                            onClick={handlePrevSong}
                            disabled={currentSongIndex <= 0}
                            className="p-1 rounded-lg text-white/70 hover:text-white disabled:opacity-20 transition"
                            title="이전 곡"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <p className="truncate text-xs font-bold text-white/90 max-w-[160px] sm:max-w-xs">{currentSong?.title ?? '곡 대기'}</p>
                        <button
                            type="button"
                            onClick={handleNextSong}
                            disabled={currentSongIndex >= songs.length - 1}
                            className="p-1 rounded-lg text-white/70 hover:text-white disabled:opacity-20 transition"
                            title="다음 곡"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {isWakeLockSupported && (
                            <button
                                type="button"
                                onClick={toggleWakeLock}
                                className={`tap-target inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${
                                    isWakeLockActive
                                        ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                                        : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                                title="화면 꺼짐 방지 토글"
                            >
                                {isWakeLockActive ? <Sun size={13} /> : <SunDim size={13} />}
                                <span className="hidden md:inline">화면 {isWakeLockActive ? '켜짐' : '꺼짐'}</span>
                            </button>
                        )}
                        {isFullscreenSupported && (
                            <button
                                type="button"
                                onClick={() => void toggleFullscreen()}
                                className="tap-target inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/10"
                                title="무대 전체화면 전환"
                            >
                                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                <span className="hidden md:inline">{isFullscreen ? '해제' : '전체화면'}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setStageLocked((prev) => {
                                    const next = !prev;
                                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                                        navigator.vibrate?.(next ? [25, 25, 25] : 30);
                                    }
                                    return next;
                                });
                            }}
                            className={`tap-target inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${
                                stageLocked
                                    ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                                    : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                            }`}
                            title="무대 미스터치 방지 잠금 (블루투스 페달은 잠금 중에도 작동)"
                        >
                            {stageLocked ? <Lock size={13} /> : <Unlock size={13} />}
                            <span className="hidden sm:inline">{stageLocked ? '잠김' : '잠금'}</span>
                        </button>
                        <span
                            className="hidden lg:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60"
                            title="블루투스 악보 넘김 페달 및 방향키 지원"
                        >
                            ⌨️ 페달 지원
                        </span>
                        <span
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${realtimeMeta.tone}`}
                            data-testid="team-mode-sync"
                        >
                            <span className={`h-2 w-2 rounded-full ${realtimeMeta.dot}`} />
                            {realtimeMeta.label}
                        </span>
                    </div>
                </header>

                {/* 뷰 모드 전환 (무대 세션 뷰 ↔ 음향·미디어 큐시트) */}
                <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1">
                    <button
                        type="button"
                        onClick={() => setModeView('stage')}
                        className={`tap-target flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                            modeView === 'stage'
                                ? 'bg-[#ffe0b8] text-black shadow-xs'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        🎤 무대 세션 뷰 (BPM/큐)
                    </button>
                    <button
                        type="button"
                        onClick={() => setModeView('sound')}
                        className={`tap-target flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                            modeView === 'sound'
                                ? 'bg-emerald-400 text-black shadow-xs'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        🎚️ 음향·미디어 큐시트
                    </button>
                </div>

                <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-white/70">내 수신 역할
                        <select aria-label="내 수신 역할" value={selectedFeedbackRole} onChange={(event) => setFeedbackRole(event.target.value as SessionFeedbackRole)} className="mt-2 block min-h-11 w-full rounded-lg bg-[#152321] px-3 text-sm text-white">
                            {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-bold text-white/70">큐 받을 대상
                        <select aria-label="큐 받을 대상" value={recipientChoice} onChange={(event) => setRecipientChoice(event.target.value)} className="mt-2 block min-h-11 w-full rounded-lg bg-[#152321] px-3 text-sm text-white">
                            <option value="preset">버튼에 지정된 대상</option>
                            <option value="everyone">전체</option>
                            {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                            {participants.map((participant) => <option key={participant.clientId} value={`member:${participant.clientId}`}>{ROLE_LABELS[participant.role]} · 기기 {participant.clientId.slice(0, 6)}</option>)}
                        </select>
                    </label>
                    <p className="text-xs text-white/75 sm:col-span-2">{realtimeStatus === 'connected' ? '서버 연결됨' : localTransportAvailable ? '같은 브라우저의 열린 탭끼리만 연결됩니다.' : '전송 연결 없음'} · 다른 접속 기기 {participants.length}개 · 역할/기기 큐는 실시간 알림만 제공</p>
                    {lastSentEntryId ? <p role="status" className="text-sm font-bold text-[#ffe0b8] sm:col-span-2">{getCueDeliveryLabel(cueDeliveries[lastSentEntryId])}{cueDeliveries[lastSentEntryId]?.error && cueDeliveries[lastSentEntryId]?.status !== 'failed' ? ` · ${cueDeliveries[lastSentEntryId].error}` : ''}</p> : null}
                </div>

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

                {modeView === 'sound' ? (
                    <SoundEngineerWorkspace
                        songs={songs}
                        currentSongId={currentSongId}
                        currentSection={currentSection}
                        sections={sections}
                        teamName={teamName}
                        onSendCue={(msg, targetRole) => {
                            const entry: SessionFeedbackEntry = {
                                id: createClientId(),
                                clientId,
                                role: (targetRole as SessionFeedbackRole) || 'broadcast',
                                message: msg,
                                createdAt: new Date().toISOString(),
                                teamId,
                                songId: currentSongId,
                                songTitle: currentSong?.title ?? null,
                                page: currentPage,
                                section: currentSection,
                                recipient: { kind: 'everyone' },
                            };
                            setLastSentEntryId(entry.id);
                            void sendFeedback(entry);
                        }}
                    />
                ) : (
                <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)_auto]">
                    <section
                        className={`stage-bpm-panel order-1 relative overflow-hidden rounded-lg border border-[#f0b56b]/20 bg-[#f0b56b]/[0.075] p-3 sm:p-5 lg:order-none lg:col-start-1 lg:row-start-1 ${blinkActive ? 'stage-bpm-panel--beat' : ''} ${blinkActive && activeBeat === 1 ? 'stage-bpm-panel--downbeat' : ''}`}
                        style={beatDurationStyle}
                        data-testid="team-mode-bpm"
                    >
                        <div className="relative flex min-h-[16.5rem] flex-col justify-between gap-4 sm:min-h-[32rem] sm:gap-5 lg:min-h-full">
                            <div className="grid grid-cols-[minmax(0,1fr)_7.75rem] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.32fr)]">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 sm:text-xs sm:tracking-[0.2em]">
                                        현재 섹션
                                    </p>
                                    <h1 className="mt-1.5 break-words text-3xl font-black leading-tight text-[#ffe0b8] sm:mt-2 sm:text-6xl">
                                        {displayedSection}
                                    </h1>
                                </div>
                                <div className="min-w-0 rounded-lg border border-[#ffe0b8]/25 bg-black/40 px-3 py-2.5 sm:px-4 sm:py-3">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300 sm:text-[10px] sm:tracking-[0.18em]">
                                        다음
                                    </p>
                                    <p className="mt-1.5 break-words text-base font-black leading-tight text-white sm:mt-2 sm:text-xl">
                                        {nextSection}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrevSection}
                                    disabled={sectionIndex <= 0}
                                    className="tap-target inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-25 transition active:scale-95"
                                >
                                    <ChevronLeft size={14} /> 이전 섹션
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextSection}
                                    disabled={sectionIndex >= sections.length - 1}
                                    className="tap-target inline-flex items-center gap-1 rounded-xl border border-[#ffe0b8]/40 bg-[#ffe0b8]/15 px-3 py-1.5 text-xs font-bold text-[#ffe0b8] hover:bg-[#ffe0b8]/25 disabled:opacity-25 transition active:scale-95"
                                >
                                    다음 섹션 <ChevronRight size={14} />
                                </button>
                            </div>

                            <ol aria-label="송폼 진행 순서" className="flex flex-wrap gap-2">
                                {sections.map((section, index) => <li key={`${index}:${section}`} aria-current={index === sectionIndex ? 'step' : undefined} className={`rounded-full border px-3 py-2 text-xs font-bold ${index === sectionIndex ? 'border-[#ffe0b8] bg-[#ffe0b8]/20 text-[#ffe0b8]' : index < sectionIndex ? 'border-emerald-300/25 text-emerald-200' : 'border-white/10 text-white/75'}`}>
                                    {index < sectionIndex ? '✓ ' : index === sectionIndex ? '● ' : ''}{section}
                                </li>)}
                            </ol>

                            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-5">
                                <div>
                                    <div className="flex items-end gap-3">
                                        <p className={`stage-bpm-value font-serif text-6xl font-black leading-none text-[#ffe0b8] sm:text-8xl ${blinkActive ? 'stage-bpm-value--beat' : ''} ${blinkActive && activeBeat === 1 ? 'stage-bpm-value--downbeat' : ''}`}>
                                            {currentBpm ?? '--'}
                                        </p>
                                        <div className="flex flex-col items-start gap-1 pb-1 sm:gap-2 sm:pb-2">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 sm:text-xs sm:tracking-[0.18em]">
                                                BPM
                                            </p>
                                            <p className="inline-flex rounded-full bg-[#ffe0b8]/[0.12] px-2 py-1 text-[10px] font-black text-[#ffe0b8] sm:px-3 sm:text-xs">
                                                Key {currentSong?.original_key ?? '-'}
                                            </p>
                                            <p className={`hidden rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex sm:px-3 sm:text-xs ${metronomeActive ? 'bg-emerald-300/[0.12] text-emerald-100' : 'bg-white/10 text-white/75'}`}>
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
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">최근 큐</span>
                            <p className="min-w-0 flex-1 truncate text-sm font-black text-white">
                                {latestCue?.message ?? '큐 대기'}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold text-white/75">
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
                                        : 'grid-cols-2 sm:grid-cols-3';

                                return (
                                <div key={group.id}>
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75 sm:mb-2 sm:tracking-[0.18em]">
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
                                                    className={`tap-target tap-bounce min-h-12 rounded-lg border px-2.5 py-2 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[4.75rem] sm:px-4 sm:py-3 motion-safe:active:scale-[0.98] ${isFailed ? 'animate-shake border-red-300/40 bg-red-400/[0.18] text-red-50' : isSent ? 'stage-action-sent border-emerald-300/50 bg-emerald-300/[0.25] text-emerald-50 shadow-[0_0_35px_rgba(110,231,183,0.25)]' : action.tone}`}
                                                >
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                                            {isSent ? (
                                                                <Check size={18} className="animate-check-pop shrink-0 text-emerald-300 sm:h-[18px] sm:w-[18px]" />
                                                            ) : isPendingAction ? (
                                                                <Send size={16} className="animate-send-fly shrink-0 text-[#ffe0b8] sm:h-[18px] sm:w-[18px]" />
                                                            ) : (
                                                                <Icon size={16} className="shrink-0 opacity-80 sm:h-[18px] sm:w-[18px]" />
                                                            )}
                                                            <span className="min-w-0 text-xs font-black leading-snug sm:text-lg sm:leading-tight">{action.label}</span>
                                                        </span>
                                                        <span className={`shrink-0 rounded-full px-1.5 py-1 text-[9px] font-bold sm:px-2 sm:text-[10px] transition-all ${isSent ? 'bg-emerald-400/30 text-emerald-100 font-extrabold animate-check-pop' : isFailed ? 'bg-red-400/30 text-red-100' : isPendingAction ? 'bg-amber-400/25 text-amber-100' : 'bg-white/10 text-white/65'}`}>
                                                            {isFailed ? '실패' : isPendingAction ? '전송 중…' : isCoolingDown ? '대기' : isSent ? '전송 완료' : action.target}
                                                        </span>
                                                    </span>
                                                    <span className="mt-1.5 hidden truncate text-xs font-semibold opacity-58 sm:block">
                                                        {recipientChoice === 'preset' ? action.target : recipientChoice === 'everyone' ? '전체' : recipientChoice.startsWith('member:') ? '선택한 기기' : ROLE_LABELS[recipientChoice as SessionFeedbackRole]} 대상
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
                        <aside className={`hidden rounded-lg border border-white/10 bg-white/[0.052] p-4 lg:block transition-all ${recentActionId ? 'stage-latest-cue-active animate-success-bounce' : ''}`} aria-live="polite" data-testid="team-latest-cue">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">최근 큐</p>
                            <p className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
                                {latestCue?.message ?? '큐 대기'}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-white/75">
                                {latestCue ? `${ROLE_LABELS[latestCue.role]} · ${latestCue.section ?? '전체'} · ${latestCue.page}p` : '팀 액션을 기다리는 중'}
                            </p>
                        </aside>

                        <aside className="rounded-lg border border-white/10 bg-white/[0.052] p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                                {teamName}
                            </p>
                            <h3 className="mt-2 truncate text-xl font-black text-[#ffe0b8]">{currentSong?.title ?? '곡 대기'}</h3>
                            <p className="mt-2 truncate text-sm font-semibold text-white/75">{setlistTitle}</p>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <StageMetric label="악보" value={`${currentPage}p`} />
                                <StageMetric label="키" value={currentSong?.original_key ?? '-'} />
                                <StageMetric label="다음 곡" value={nextSong?.title ?? '마지막'} />
                                <StageMetric label="넘김" value="리더 따라감" />
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-white/75">
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
                )}
            </div>
        </main>
    );
}

function StageMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-lg border border-white/10 bg-black/[0.14] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">{label}</p>
            <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
        </div>
    );
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

function getRealtimeStatusMeta(status: RealtimeConnectionStatus, localTransportAvailable: boolean) {
    if (status !== 'connected' && localTransportAvailable) {
        return {
            dot: 'bg-white/45',
            label: '브라우저 탭',
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
                dot: 'sync-pulse-warning bg-amber-300',
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
