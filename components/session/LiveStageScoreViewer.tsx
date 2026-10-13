'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Activity,
    Bell,
    BellOff,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Eye,
    EyeOff,
    FileText,
    History,
    Footprints,
    Keyboard,
    ListMusic,
    Maximize2,
    Minimize2,
    Moon,
    Music2,
    Radio,
    Settings2,
    Sparkles,
    Sun,
    X,
    Zap,
} from 'lucide-react';
import { usePageTurner } from '@/hooks/usePageTurner';
import { useSongFormStepper } from '@/hooks/useSongFormStepper';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useVisualMetronome } from '@/components/session/SessionBpmConsole';
import { isStageAudioEnabled, setStageAudioEnabled, playStageCueSound } from '@/lib/stageAudioCue';
import { readSongStageNote, saveSongStageNote, STAGE_NOTE_CHANGED_EVENT } from '@/lib/stageNotesStorage';
import { getCueCategory } from '@/types/session';
import {
    createSampleSheetDocument,
    pointsToSvgPath,
    readSheet,
    saveSheet,
    sheetKey,
    type SheetDocument,
    type SheetMark,
} from '@/lib/sheetAnnotations';
import SongFormScoreOverlay, { type SongFormOverlayDisplayMode } from './SongFormScoreOverlay';
import SongFormMarkup, { SongFormSectionMarker } from './SongFormMarkup';

export interface LiveStageScoreViewerProps {
    teamId: string;
    songId: string;
    title: string;
    originalKey?: string | null;
    currentBpm?: number | null;
    bpmEnabled?: boolean;
    isActive?: boolean;
    currentSection?: string | null;
    nextSection?: string | null;
    page: number;
    onPageChange: (page: number) => void;
    canTurnPage: boolean;
    latestCueMessage?: string | null;
    latestCueRole?: string | null;
    latestCueAccent?: string | null;
    stageLocked?: boolean;
    onToggleStageLock?: () => void;
    onSwitchToBpmMode?: () => void;
    onPrevSong?: () => void;
    onNextSong?: () => void;
    hasPrevSong?: boolean;
    hasNextSong?: boolean;
    nextSongTitle?: string | null;
    prevSongTitle?: string | null;
    songs?: Array<{ id: string; title: string; original_key?: string | null; default_bpm?: number | null }>;
    onSelectSong?: (songId: string) => void;
    leaderSongId?: string | null;
    leaderPage?: number | null;
    onBpmChange?: (bpm: number) => void;
    onSendCue?: (message: string, targetRole?: string) => void;
    onSelectSection?: (section: string) => void;
    participantCount?: number;
    realtimeStatus?: string;
    lastSentDeliveryLabel?: string;
}

export default function LiveStageScoreViewer({
    teamId,
    songId,
    title,
    originalKey,
    currentBpm,
    bpmEnabled = false,
    isActive = true,
    currentSection,
    page,
    onPageChange,
    canTurnPage,
    latestCueMessage,
    latestCueRole,
    latestCueAccent,
    stageLocked = false,
    onToggleStageLock,
    onSwitchToBpmMode,
    onPrevSong,
    onNextSong,
    hasPrevSong = false,
    hasNextSong = false,
    nextSongTitle,
    prevSongTitle,
    songs,
    onSelectSong,
    leaderSongId,
    leaderPage,
    onBpmChange,
    onSendCue,
    onSelectSection,
    participantCount = 1,
    realtimeStatus = 'connected',
    lastSentDeliveryLabel,
}: LiveStageScoreViewerProps) {
    const [sheet, setSheet] = useState<SheetDocument | null>(null);
    const [sheetSource, setSheetSource] = useState<'published' | 'draft'>('published');
    const [loaded, setLoaded] = useState(false);
    const [cueBanner, setCueBanner] = useState<{ message: string; role?: string | null; accent?: string | null } | null>(null);
    const [pageTurnFlash, setPageTurnFlash] = useState<'prev' | 'next' | null>(null);
    const [isFollowLeader, setIsFollowLeader] = useState<boolean>(true);
    const [showSetlistDrawer, setShowSetlistDrawer] = useState<boolean>(false);
    const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
    const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
    const [activeCueTab, setActiveCueTab] = useState<'all' | 'tempo' | 'sound' | 'flow'>('all');
    const [isZenMode, setIsZenMode] = useState<boolean>(false);
    const [showLeaderNotes, setShowLeaderNotes] = useState<boolean>(false);
    const [songFormOverlayMode, setSongFormOverlayMode] = useState<SongFormOverlayDisplayMode>(() => {
        if (typeof window === 'undefined') return 'first_page_only';
        return (window.localStorage.getItem('wt_score_songform_mode') as SongFormOverlayDisplayMode) || 'first_page_only';
    });
    const channelRef = useRef<BroadcastChannel | null>(null);

    // Audio cue in-ear chime & Floating Cue Dial & Sound Targets
    const [audioCueEnabled, setAudioCueEnabled] = useState<boolean>(() => isStageAudioEnabled());
    const [showFloatingCueDial, setShowFloatingCueDial] = useState<boolean>(false);
    const [soundTarget, setSoundTarget] = useState<'내 모니터' | '보컬' | '건반' | '기타' | '드럼' | '전체'>('내 모니터');
    const [stageNote, setStageNote] = useState<string>(() => readSongStageNote(teamId, songId));
    const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
    const [noteDraft, setNoteDraft] = useState<string>('');
    const [recentCues, setRecentCues] = useState<Array<{ id: string; message: string; role?: string | null; time: string }>>([]);
    const [showRecentCuesDrawer, setShowRecentCuesDrawer] = useState<boolean>(false);
    const [showPedalShortcutsModal, setShowPedalShortcutsModal] = useState<boolean>(false);

    // In-ear audio cue chime toggle
    const handleToggleAudioCue = () => {
        const next = !audioCueEnabled;
        setAudioCueEnabled(next);
        setStageAudioEnabled(next);
        triggerHaptic(15);
        if (next) {
            playStageCueSound('flow');
        }
    };

    // Stage note sync across team
    useEffect(() => {
        setStageNote(readSongStageNote(teamId, songId));
        setIsEditingNote(false);
    }, [teamId, songId]);

    useEffect(() => {
        const handleNoteChange = (e: Event) => {
            const customEvent = e as CustomEvent<{ teamId: string; songId: string; note: string }>;
            if (customEvent.detail && customEvent.detail.songId === songId && customEvent.detail.teamId === teamId) {
                setStageNote(customEvent.detail.note);
            }
        };
        window.addEventListener(STAGE_NOTE_CHANGED_EVENT, handleNoteChange);
        return () => window.removeEventListener(STAGE_NOTE_CHANGED_EVENT, handleNoteChange);
    }, [teamId, songId]);

    const handleSaveNote = () => {
        saveSongStageNote(teamId, songId, noteDraft);
        setStageNote(noteDraft.trim());
        setIsEditingNote(false);
        triggerHaptic(20);
    };

    // BPM & Pulse Mode states
    const [effectiveBpm, setEffectiveBpm] = useState<number>(() => currentBpm ?? 120);
    const [showBpmPopover, setShowBpmPopover] = useState<boolean>(false);
    const [pulseMode, setPulseMode] = useState<'dot' | 'edge' | 'fullscreen' | 'giant'>(() => {
        if (typeof window === 'undefined') return 'dot';
        return (window.localStorage.getItem('wt_bpm_pulse_mode') as 'dot' | 'edge' | 'fullscreen' | 'giant') || 'dot';
    });

    useEffect(() => {
        if (currentBpm && Number.isFinite(currentBpm)) {
            setEffectiveBpm(currentBpm);
        }
    }, [currentBpm]);

    useEffect(() => {
        try {
            window.localStorage.setItem('wt_bpm_pulse_mode', pulseMode);
        } catch {}
    }, [pulseMode]);

    const updateBpm = useCallback((newBpm: number) => {
        const clamped = Math.max(30, Math.min(280, newBpm));
        setEffectiveBpm(clamped);
        onBpmChange?.(clamped);
        triggerHaptic(10);
    }, [onBpmChange]);

    const tapTimesRef = useRef<number[]>([]);
    const handleTapTempo = useCallback(() => {
        const now = Date.now();
        const times = tapTimesRef.current.filter((t) => now - t < 3000);
        times.push(now);
        tapTimesRef.current = times;
        if (times.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < times.length; i++) {
                intervals.push(times[i] - times[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            if (calculatedBpm >= 40 && calculatedBpm <= 260) {
                updateBpm(calculatedBpm);
                triggerHaptic(20);
            }
        } else {
            triggerHaptic(10);
        }
    }, [updateBpm]);

    const loadSampleSheet = async () => {
        try {
            const sampleDoc = createSampleSheetDocument(title);
            const publishedKey = sheetKey(teamId, songId, true);
            await saveSheet(publishedKey, sampleDoc);
            setSheet(sampleDoc);
            setSheetSource('published');
            channelRef.current?.postMessage('published');
            triggerHaptic(20);
        } catch (e) {
            console.error('Failed to load sample sheet', e);
        }
    };

    // Persistent display settings
    const [isDarkInverted, setIsDarkInverted] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const saved = window.localStorage.getItem('wt_score_dark_inverted');
        return saved !== null ? saved === 'true' : true;
    });
    const [isAmberShield, setIsAmberShield] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('wt_score_amber_shield') === 'true';
    });
    const [fitMode, setFitMode] = useState<'height' | 'width'>('height');
    const [isDualPage, setIsDualPage] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const cueTimeoutRef = useRef<number | null>(null);
    const flashTimeoutRef = useRef<number | null>(null);

    const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen } = useFullscreen();
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported, toggle: toggleWakeLock } = useScreenWakeLock(isActive);
    const { activeBeat, blinkActive } = useVisualMetronome(bpmEnabled && isActive, effectiveBpm);

    const totalPages = sheet?.pages.length ?? 0;
    const activePage = sheet?.pages[page - 1];
    const secondPage = isDualPage && sheet?.pages[page] ? sheet.pages[page] : null;

    // Save preferences
    useEffect(() => {
        try {
            window.localStorage.setItem('wt_score_dark_inverted', String(isDarkInverted));
        } catch {}
    }, [isDarkInverted]);

    useEffect(() => {
        try {
            window.localStorage.setItem('wt_score_amber_shield', String(isAmberShield));
        } catch {}
    }, [isAmberShield]);

    // Tactile feedback helper
    const triggerHaptic = (pattern: number | number[] = 15) => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate?.(pattern);
            } catch {}
        }
    };

    // Flash turn feedback indicator
    const showPageTurnFlash = (direction: 'prev' | 'next') => {
        setPageTurnFlash(direction);
        if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = window.setTimeout(() => setPageTurnFlash(null), 300);
    };

    // Pedal 섹션 이동 mode: walk the song form band, turning to each section marker's page.
    const stepper = useSongFormStepper({
        pages: sheet?.pages,
        page,
        canTurnPage,
        onPageChange: (next) => {
            showPageTurnFlash(next > page ? 'next' : 'prev');
            onPageChange(next);
        },
        resetKey: songId,
    });
    const stepSection = (direction: 1 | -1) => {
        if (!stepper.step(direction)) return false;
        setIsFollowLeader(false);
        triggerHaptic(15);
        return true;
    };

    const handleSendStageCue = (message: string) => {
        triggerHaptic([20, 30]);
        const cat = getCueCategory(message);
        if (audioCueEnabled) {
            try {
                playStageCueSound(cat);
            } catch {}
        }
        setCueBanner({
            message,
            role: '내 발신',
            accent: '#f59e0b',
        });
        setRecentCues((prev) => [
            {
                id: `cue_${Date.now()}`,
                message,
                role: '내 발신',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 7),
        ]);
        if (cueTimeoutRef.current) {
            window.clearTimeout(cueTimeoutRef.current);
        }
        cueTimeoutRef.current = window.setTimeout(() => {
            setCueBanner(null);
            cueTimeoutRef.current = null;
        }, 5000);

        onSendCue?.(message, 'leader');
    };

    // Load sheet document & listen to live updates via BroadcastChannel
    useEffect(() => {
        let active = true;
        const draftKey = sheetKey(teamId, songId, false);
        const publishedKey = sheetKey(teamId, songId, true);

        const reload = async () => {
            try {
                const [published, draft] = await Promise.all([readSheet(publishedKey), readSheet(draftKey)]);
                if (!active) return;
                if (published && published.pages.length > 0) {
                    setSheet(published);
                    setSheetSource('published');
                } else if (draft && draft.pages.length > 0) {
                    setSheet(draft);
                    setSheetSource('draft');
                } else {
                    setSheet(null);
                }
            } catch {
                if (active) setSheet(null);
            } finally {
                if (active) setLoaded(true);
            }
        };

        void reload();

        const channel = typeof BroadcastChannel !== 'undefined'
            ? new BroadcastChannel(`sheet:${teamId}:${songId}`)
            : null;
        channelRef.current = channel;

        if (channel) {
            channel.onmessage = () => {
                if (active) void reload();
            };
        }

        return () => {
            active = false;
            channel?.close();
            channelRef.current = null;
        };
    }, [teamId, songId]);

    // Leader Follow Sync: Automatically follow leader unless manually overridden
    useEffect(() => {
        if (!isFollowLeader) return;
        if (leaderSongId && leaderSongId !== songId && onSelectSong) {
            onSelectSong(leaderSongId);
        }
    }, [leaderSongId, isFollowLeader, songId, onSelectSong]);

    useEffect(() => {
        if (!isFollowLeader) return;
        if (typeof leaderPage === 'number' && leaderPage > 0 && leaderPage !== page) {
            onPageChange(leaderPage);
        }
    }, [leaderPage, isFollowLeader, page, onPageChange]);

    // Bluetooth Foot Pedal & Keyboard Navigation
    usePageTurner({
        onNext: () => {
            if (stepSection(1)) return;
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && totalPages > 0) {
                if (page + step <= totalPages) {
                    setIsFollowLeader(false);
                    triggerHaptic(15);
                    showPageTurnFlash('next');
                    onPageChange(page + step);
                } else if (page >= totalPages && onNextSong && hasNextSong) {
                    setIsFollowLeader(false);
                    triggerHaptic([15, 30]);
                    onNextSong();
                }
            }
        },
        onPrev: () => {
            if (stepSection(-1)) return;
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && page > 1) {
                setIsFollowLeader(false);
                triggerHaptic(15);
                showPageTurnFlash('prev');
                onPageChange(Math.max(1, page - step));
            } else if (canTurnPage && page <= 1 && onPrevSong && hasPrevSong) {
                setIsFollowLeader(false);
                triggerHaptic([15, 30]);
                onPrevSong();
            }
        },
        enabled: canTurnPage && totalPages > 0,
    });

    // Stage keyboard and pedal shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            if (e.code === 'KeyT') {
                e.preventDefault();
                handleTapTempo();
            } else if (e.code === 'KeyZ') {
                e.preventDefault();
                setIsZenMode((prev) => !prev);
                triggerHaptic(20);
            } else if (e.code === 'KeyB') {
                e.preventDefault();
                setShowFloatingCueDial((prev) => !prev);
                triggerHaptic(15);
            } else if (e.code === 'KeyM') {
                e.preventDefault();
                setNoteDraft(stageNote);
                setIsEditingNote((prev) => !prev);
            } else if (e.code === 'KeyH') {
                e.preventDefault();
                setShowRecentCuesDrawer((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [stageNote, handleTapTempo]);

    // Flash cue banner and play in-ear chime when a stage action cue arrives
    useEffect(() => {
        if (!latestCueMessage) return;

        const cat = getCueCategory(latestCueMessage);
        if (audioCueEnabled) {
            try {
                playStageCueSound(cat);
            } catch {}
        }

        setRecentCues((prev) => [
            {
                id: `cue_${Date.now()}`,
                message: latestCueMessage,
                role: latestCueRole ?? '팀 신호',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 7),
        ]);

        const showTimer = window.setTimeout(() => {
            setCueBanner({
                message: latestCueMessage,
                role: latestCueRole,
                accent: latestCueAccent,
            });
        }, 0);

        if (cueTimeoutRef.current) {
            window.clearTimeout(cueTimeoutRef.current);
        }

        cueTimeoutRef.current = window.setTimeout(() => {
            setCueBanner(null);
            cueTimeoutRef.current = null;
        }, 3500);

        return () => {
            window.clearTimeout(showTimer);
            if (cueTimeoutRef.current) {
                window.clearTimeout(cueTimeoutRef.current);
            }
        };
    }, [latestCueMessage, latestCueRole, latestCueAccent, audioCueEnabled]);

    // Renders marks in layered order: highlighters first (underneath), then pens, then stamps
    function renderMarks(marks: SheetMark[], pageObj: { width: number; height: number }) {
        const ratio = pageObj.height / pageObj.width;

        const renderSingleMark = (mark: SheetMark) => {
            const point = mark.points[0];

            if (mark.kind === 'songform') {
                return (
                    <SongFormMarkup
                        key={mark.id}
                        sections={mark.sections ?? []}
                        anchor={point}
                        ratio={ratio}
                        fontSize={mark.fontSize}
                        opacity={mark.opacity}
                        currentIndex={stepper.active && stepper.route?.bandId === mark.id ? stepper.index : null}
                    />
                );
            }

            if (mark.kind === 'section') {
                return (
                    <SongFormSectionMarker
                        key={mark.id}
                        label={mark.text ?? ''}
                        anchor={point}
                        ratio={ratio}
                        fontSize={mark.fontSize}
                        opacity={mark.opacity}
                        current={stepper.active && stepper.stop?.markId === mark.id}
                    />
                );
            }

            if (mark.kind === 'stamp') {
                return (
                    <text
                        key={mark.id}
                        x={Math.min(point[0], 780)}
                        y={Math.max(point[1] * ratio, 25)}
                        fill={mark.color}
                        fontSize="25"
                        fontWeight="800"
                        stroke={isDarkInverted ? '#000' : '#fff'}
                        strokeWidth="3"
                        paintOrder="stroke"
                    >
                        {mark.text}
                    </text>
                );
            }

            if (mark.kind === 'highlighter') {
                return (
                    <path
                        key={mark.id}
                        d={pointsToSvgPath(mark.points, ratio)}
                        fill="none"
                        stroke={mark.color}
                        strokeWidth={mark.strokeWidth || 16}
                        strokeLinecap="square"
                        strokeLinejoin="round"
                        style={{ mixBlendMode: isDarkInverted ? 'screen' : 'multiply', opacity: mark.opacity ?? 0.55 }}
                    />
                );
            }

            if (mark.kind === 'text') {
                const fSize = mark.fontSize ?? 20;
                return (
                    <g key={mark.id}>
                        <rect
                            x={Math.min(point[0], 900) - 4}
                            y={Math.max(point[1] * ratio, 20) - fSize}
                            width={(mark.text?.length ?? 3) * (fSize * 0.65) + 8}
                            height={fSize + 6}
                            rx="4"
                            fill={isDarkInverted ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'}
                        />
                        <text
                            x={Math.min(point[0], 900)}
                            y={Math.max(point[1] * ratio, 20) - 2}
                            fill={isDarkInverted ? '#000' : mark.color}
                            fontSize={fSize}
                            fontWeight="800"
                            fontFamily="monospace, sans-serif"
                        >
                            {mark.text}
                        </text>
                    </g>
                );
            }

            if (mark.kind === 'rect') {
                if (mark.points.length < 2) return null;
                const [p1, p2] = mark.points;
                const minX = Math.min(p1[0], p2[0]);
                const maxX = Math.max(p1[0], p2[0]);
                const minY = Math.min(p1[1], p2[1]) * ratio;
                const maxY = Math.max(p1[1], p2[1]) * ratio;
                return (
                    <rect
                        key={mark.id}
                        x={minX}
                        y={minY}
                        width={maxX - minX}
                        height={maxY - minY}
                        fill={mark.color}
                        fillOpacity={mark.opacity ?? 0.15}
                        stroke={mark.color}
                        strokeWidth={mark.strokeWidth || 3}
                        rx="6"
                    />
                );
            }

            return (
                <path
                    key={mark.id}
                    d={pointsToSvgPath(mark.points, ratio)}
                    fill="none"
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            );
        };

        const highlighters = marks.filter((m) => m.kind === 'highlighter');
        const rects = marks.filter((m) => m.kind === 'rect');
        const pens = marks.filter((m) => m.kind === 'pen');
        const stamps = marks.filter((m) => m.kind === 'stamp');
        const texts = marks.filter((m) => m.kind === 'text');
        // Section markers draw above the song form band.
        const songForms = [...marks.filter((m) => m.kind === 'songform'), ...marks.filter((m) => m.kind === 'section')];

        return (
            <>
                {highlighters.map(renderSingleMark)}
                {rects.map(renderSingleMark)}
                {pens.map(renderSingleMark)}
                {stamps.map(renderSingleMark)}
                {texts.map(renderSingleMark)}
                {songForms.map(renderSingleMark)}
            </>
        );
    }

    return (
        <section
            ref={containerRef}
            aria-label="예배 무대 악보 뷰어"
            className={`relative flex min-h-[32rem] flex-col rounded-2xl border border-white/10 bg-[#060c0b] text-[#fff7e8] transition-all lg:min-h-full ${
                isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-2 sm:p-4' : 'p-2 sm:p-3'
            }`}
        >
            {/* Live Cue Neon Flash Overlay Banner */}
            {cueBanner && (
                <div className="pointer-events-none absolute top-3 inset-x-4 z-40 flex justify-center animate-in slide-in-from-top duration-200">
                    <div
                        className="flex items-center gap-3 rounded-2xl border-2 px-5 py-3 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl bg-black/95 text-white"
                        style={{ borderColor: cueBanner.accent ? `rgb(${cueBanner.accent})` : '#f0b56b' }}
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 font-black text-sm">
                            큐
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black leading-tight text-white tracking-wide">
                                {cueBanner.message}
                            </p>
                            {cueBanner.role && (
                                <p className="text-[11px] font-semibold text-white/70">
                                    대상: {cueBanner.role}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Top HUD (Zen mode collapses it smoothly with pure whitespace) */}
            <header
                className={`mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0a0f0e]/85 px-3.5 py-2 backdrop-blur-xl shadow-lg transition-all duration-300 ${
                    isZenMode ? '-translate-y-4 opacity-0 pointer-events-none h-0 p-0 m-0 overflow-hidden' : 'opacity-100'
                }`}
            >
                {/* Left: Setlist Badge + Title + Key + Section */}
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Setlist Quick Jump Drawer */}
                    {songs && songs.length > 0 && onSelectSong && (
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowSetlistDrawer((prev) => !prev)}
                                className="tap-target inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-400/25 transition active:scale-95"
                                title="콘티 목록 빠른 이동"
                            >
                                <ListMusic size={14} />
                                <span>
                                    콘티 {songs.findIndex((s) => s.id === songId) >= 0 ? `${songs.findIndex((s) => s.id === songId) + 1}/${songs.length}` : ''}
                                </span>
                                <ChevronDown
                                    size={12}
                                    className={`transition-transform duration-200 ${showSetlistDrawer ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {showSetlistDrawer && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowSetlistDrawer(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-2 z-50 w-72 max-h-80 overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0f0e]/95 p-2 shadow-[0_15px_40px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-2.5 py-1.5 text-[11px] font-bold text-white/50 border-b border-white/10 mb-1 flex items-center justify-between">
                                            <span>전체 콘티 ({songs.length}곡)</span>
                                            <span className="text-[10px] text-amber-300">선택 시 즉시 이동</span>
                                        </div>
                                        <div className="space-y-1">
                                            {songs.map((s, idx) => {
                                                const isCurrent = s.id === songId;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => {
                                                            onSelectSong(s.id);
                                                            setShowSetlistDrawer(false);
                                                        }}
                                                        className={`w-full text-left flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition ${
                                                            isCurrent
                                                                ? 'border border-amber-400/50 bg-amber-400/20 font-black text-amber-200'
                                                                : 'text-white/80 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span
                                                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                                                    isCurrent ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/70'
                                                                }`}
                                                            >
                                                                {idx + 1}
                                                            </span>
                                                            <span className="truncate">{s.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-white/50 shrink-0">
                                                            {s.original_key && (
                                                                <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold text-amber-300">
                                                                    {s.original_key}
                                                                </span>
                                                            )}
                                                            {s.default_bpm ? <span>♩{s.default_bpm}</span> : null}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 truncate">
                        <span className="truncate text-sm font-black text-white/95">
                            {title}
                        </span>
                        {originalKey && (
                            <span className="inline-flex rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-black text-amber-300 shrink-0">
                                Key {originalKey}
                            </span>
                        )}
                        {currentSection && (
                            <span className="hidden sm:inline-flex items-center rounded-md border border-[#ffe0b8]/30 bg-[#ffe0b8]/15 px-2 py-0.5 text-[10px] font-black text-[#ffe0b8] shrink-0">
                                {currentSection}
                            </span>
                        )}
                    </div>
                </div>

                {/* Center: BPM Visual Pulse & Quick Edit Popover Trigger */}
                {bpmEnabled && effectiveBpm ? (
                    <div className="flex items-center gap-1.5">
                        <div className="relative flex items-center">
                            <button
                                type="button"
                                onClick={() => setShowBpmPopover((prev) => !prev)}
                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 active:scale-95 transition cursor-pointer"
                                title="BPM 템포 조정 및 펄스 모드 설정 (클릭)"
                            >
                                <span className="font-mono text-xs font-black text-amber-300">
                                    ♩ {effectiveBpm}
                                </span>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4].map((beat) => {
                                        const isDownbeat = beat === 1;
                                        const isCurrent = activeBeat === beat && blinkActive;
                                        return (
                                            <span
                                                key={beat}
                                                className={`rounded-full transition-all duration-75 ${
                                                    isCurrent
                                                        ? isDownbeat
                                                            ? 'h-2.5 w-2.5 bg-amber-300 shadow-[0_0_8px_#fde047]'
                                                            : 'h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#4ade80]'
                                                        : isDownbeat
                                                            ? 'h-2 w-2 bg-white/20'
                                                            : 'h-1.5 w-1.5 bg-white/10'
                                                }`}
                                            />
                                        );
                                    })}
                                </div>
                            </button>

                            {/* Micro BPM Adjustment Stepper & Tap in HUD */}
                            <div className="hidden md:flex items-center gap-0.5 ml-1">
                                <button
                                    type="button"
                                    onClick={() => updateBpm(effectiveBpm - 2)}
                                    className="tap-target px-1.5 py-0.5 rounded-md text-[10px] font-black text-amber-300 hover:bg-amber-400/20 active:scale-90 transition"
                                    title="BPM -2 (단축 감속)"
                                >
                                    -2
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateBpm(effectiveBpm + 2)}
                                    className="tap-target px-1.5 py-0.5 rounded-md text-[10px] font-black text-amber-300 hover:bg-amber-400/20 active:scale-90 transition"
                                    title="BPM +2 (단축 가속)"
                                >
                                    +2
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTapTempo}
                                    className="tap-target px-1.5 py-0.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-[10px] font-black text-amber-200 border border-amber-400/30 active:scale-90 transition ml-0.5"
                                    title="탭 템포 (단축키 T)"
                                >
                                    TAP
                                </button>
                            </div>

                            {/* Interactive BPM & Pulse Mode Quick Popover */}
                            {showBpmPopover && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowBpmPopover(false)} />
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 rounded-2xl border border-white/15 bg-[#0a0f0e]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3">
                                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                            <span className="text-xs font-black text-amber-300">♩ 템포(BPM) 및 펄스 모드</span>
                                            <button type="button" onClick={() => setShowBpmPopover(false)} className="text-white/40 hover:text-white">
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Quick BPM Adjustment */}
                                        <div className="flex items-center justify-between gap-1.5">
                                            <button type="button" onClick={() => updateBpm(effectiveBpm - 5)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black text-white">-5</button>
                                            <button type="button" onClick={() => updateBpm(effectiveBpm - 1)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black text-white">-1</button>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={30}
                                                    max={280}
                                                    value={effectiveBpm}
                                                    onChange={(e) => updateBpm(Number(e.target.value))}
                                                    className="w-16 rounded-lg bg-black/60 border border-amber-400/40 px-2 py-1 text-center font-mono text-sm font-black text-amber-300 focus:outline-none"
                                                />
                                            </div>
                                            <button type="button" onClick={() => updateBpm(effectiveBpm + 1)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black text-white">+1</button>
                                            <button type="button" onClick={() => updateBpm(effectiveBpm + 5)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black text-white">+5</button>
                                        </div>

                                        {/* Tap Tempo Button */}
                                        <button
                                            type="button"
                                            onClick={handleTapTempo}
                                            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-400/40 text-xs font-black text-amber-200 active:scale-95 transition-all shadow"
                                        >
                                            👆 탭 템포 (Tap Tempo)
                                        </button>

                                        {/* Pulse Mode Selector */}
                                        <div className="space-y-1.5 pt-1 border-t border-white/10">
                                            <span className="text-[11px] font-bold text-white/70 block">시각적 펄스 표시 크기</span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setPulseMode('dot')}
                                                    className={`p-1.5 rounded-lg border text-[11px] font-bold transition ${
                                                        pulseMode === 'dot' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    🔘 미니 점 (기본)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPulseMode('edge')}
                                                    className={`p-1.5 rounded-lg border text-[11px] font-bold transition ${
                                                        pulseMode === 'edge' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    🔲 테두리 플래시
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPulseMode('fullscreen')}
                                                    className={`p-1.5 rounded-lg border text-[11px] font-bold transition ${
                                                        pulseMode === 'fullscreen' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    💡 전체 화면 플래시
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPulseMode('giant')}
                                                    className={`p-1.5 rounded-lg border text-[11px] font-bold transition ${
                                                        pulseMode === 'giant' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    📊 대형 상단 바
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* In-Ear Audio Chime Toggle */}
                        <button
                            type="button"
                            onClick={handleToggleAudioCue}
                            className={`tap-target inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                                audioCueEnabled
                                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                                    : 'border-white/15 bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                            title={audioCueEnabled ? '인이어 큐 사운드 알림 켜짐 (클릭 시 무음)' : '인이어 큐 사운드 무음 (클릭 시 켜짐)'}
                        >
                            {audioCueEnabled ? <Bell size={13} className="text-emerald-400" /> : <BellOff size={13} />}
                            <span className="hidden xl:inline text-[11px]">{audioCueEnabled ? '소리 ON' : '무음'}</span>
                        </button>
                    </div>
                ) : null}

                {/* Right: Essential 3 Actions (Dark Invert, Zen Mode, Fullscreen) + Settings Popover */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Pedal mode: turn pages, or walk the song form section by section */}
                    {stepper.available && (
                        <button
                            type="button"
                            aria-pressed={stepper.sectionMode}
                            aria-label={`페달: ${stepper.sectionMode ? '섹션 이동' : '페이지 넘김'}`}
                            onClick={() => stepper.setSectionMode(!stepper.sectionMode)}
                            className={`tap-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                                stepper.sectionMode
                                    ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                                    : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                            title="페달·방향키가 페이지를 넘길지, 송폼 순서대로 섹션 표시를 따라갈지 바꿉니다"
                        >
                            <Footprints size={14} />
                            <span className="hidden sm:inline">
                                {!stepper.sectionMode ? '페이지 넘김' : stepper.active && stepper.stop ? `${stepper.stop.label} · ${(stepper.index ?? 0) + 1}/${stepper.total}` : '섹션 이동'}
                            </span>
                        </button>
                    )}

                    {/* Dark Inversion Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsDarkInverted((prev) => !prev)}
                        className={`tap-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                            isDarkInverted
                                ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                                : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                        title="무대 다크 반전 (눈부심 방지)"
                    >
                        {isDarkInverted ? <Moon size={14} /> : <Sun size={14} />}
                        <span className="hidden sm:inline">{isDarkInverted ? '다크' : '라이트'}</span>
                    </button>

                    {/* Zen / Immersion Mode Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsZenMode(true)}
                        className="tap-target inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition"
                        title="무대 몰입 모드 (상단/하단 메뉴 숨김)"
                    >
                        <EyeOff size={14} />
                        <span className="hidden sm:inline">몰입</span>
                    </button>

                    {/* Fullscreen */}
                    {isFullscreenSupported && (
                        <button
                            type="button"
                            onClick={() => void toggleFullscreen(containerRef.current || undefined)}
                            className="tap-target inline-flex items-center rounded-xl border border-white/15 bg-white/5 p-2 text-xs font-bold text-white/80 hover:bg-white/10"
                            title="무대 전체화면"
                        >
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                    )}

                    {/* Stage Status Diagnostics Button */}
                    <button
                        type="button"
                        onClick={() => setShowDiagnosticsModal(true)}
                        className={`tap-target inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                            showDiagnosticsModal
                                ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                                : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                        }`}
                        title="무대 실시간 연결 및 상태 점검 (클릭)"
                    >
                        <Activity size={13} className={realtimeStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'} />
                        <span className="hidden sm:inline">상태 점검</span>
                    </button>

                    {/* Master Settings Popover */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowSettingsPopover((p) => !p)}
                            className={`tap-target inline-flex items-center gap-1 rounded-xl border p-2 text-xs font-bold transition ${
                                showSettingsPopover
                                    ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                                    : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                            title="무대 보기 및 디스플레이 설정"
                        >
                            <Settings2 size={14} />
                        </button>

                        {showSettingsPopover && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowSettingsPopover(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-white/15 bg-[#0a0f0e]/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                        <span className="text-xs font-black text-white/90">무대 디스플레이 설정</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowSettingsPopover(false)}
                                            className="text-white/40 hover:text-white"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Amber Eye Shield */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium">웜톤 앰버 시력보호</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsAmberShield((prev) => !prev)}
                                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                                isAmberShield
                                                    ? 'bg-amber-400 text-black'
                                                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                                            }`}
                                        >
                                            {isAmberShield ? '켜짐' : '꺼짐'}
                                        </button>
                                    </div>

                                    {/* Page spread mode */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium">페이지 보기</span>
                                        <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setIsDualPage(false)}
                                                className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                                                    !isDualPage ? 'bg-white/20 text-white' : 'text-white/50'
                                                }`}
                                            >
                                                1쪽
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsDualPage(true)}
                                                className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                                                    isDualPage ? 'bg-amber-400 text-black' : 'text-white/50'
                                                }`}
                                            >
                                                2쪽
                                            </button>
                                        </div>
                                    </div>

                                    {/* Song Form Overlay Mode */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium">악보 위 송폼 표시</span>
                                        <select
                                            aria-label="악보 위 송폼 표시 방식"
                                            value={songFormOverlayMode}
                                            onChange={(e) => {
                                                const m = e.target.value as SongFormOverlayDisplayMode;
                                                setSongFormOverlayMode(m);
                                                try {
                                                    window.localStorage.setItem('wt_score_songform_mode', m);
                                                } catch {}
                                            }}
                                            className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-amber-300 border border-white/15 focus:outline-none"
                                        >
                                            <option value="first_page_only">1페이지에만 (기본)</option>
                                            <option value="all_pages">모든 페이지</option>
                                            <option value="hidden">숨김</option>
                                        </select>
                                    </div>

                                    {/* Fit Mode */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium">화면 맞춤</span>
                                        <button
                                            type="button"
                                            onClick={() => setFitMode((m) => (m === 'height' ? 'width' : 'height'))}
                                            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/15 transition"
                                        >
                                            {fitMode === 'height' ? '높이 맞춤' : '너비 채움'}
                                        </button>
                                    </div>

                                    {/* Stage Lock */}
                                    {onToggleStageLock && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-white/70 font-medium">터치 미스터치 잠금</span>
                                            <button
                                                type="button"
                                                onClick={onToggleStageLock}
                                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                                    stageLocked
                                                        ? 'bg-red-500/80 text-white'
                                                        : 'bg-white/10 text-white/60 hover:bg-white/15'
                                                }`}
                                            >
                                                {stageLocked ? '잠김' : '해제'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Screen Wake Lock */}
                                    {isWakeLockSupported && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-white/70 font-medium">화면 꺼짐 방지</span>
                                            <button
                                                type="button"
                                                onClick={toggleWakeLock}
                                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                                    isWakeLockActive
                                                        ? 'bg-amber-400 text-black'
                                                        : 'bg-white/10 text-white/60 hover:bg-white/15'
                                                }`}
                                            >
                                                {isWakeLockActive ? '유지됨' : '꺼짐'}
                                            </button>
                                        </div>
                                    )}

                                    <div className="border-t border-white/10 pt-2 space-y-1.5">
                                        {/* Switch to BPM View */}
                                        {onSwitchToBpmMode && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowSettingsPopover(false);
                                                    onSwitchToBpmMode();
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10 transition"
                                            >
                                                <Radio size={13} />
                                                <span>BPM 전광판 뷰 전환</span>
                                            </button>
                                        )}

                                        {/* Quick Sample Sheet Loader / Reset */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowSettingsPopover(false);
                                                void loadSampleSheet();
                                            }}
                                            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-400/25 transition"
                                        >
                                            <Sparkles size={13} />
                                            <span>샘플 악보 생성 / 리셋</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Floating Zen Mode Exit Pill when HUD is hidden */}
            {isZenMode && (
                <div className="absolute top-3 right-4 z-40 animate-in fade-in slide-in-from-top-1 duration-200">
                    <button
                        type="button"
                        onClick={() => {
                            setIsZenMode(false);
                            triggerHaptic(20);
                        }}
                        className="tap-target inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#0a0f0e]/90 px-3.5 py-1.5 text-xs font-black text-amber-300 shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur-xl hover:bg-amber-400/20 active:scale-95 transition"
                        title="무대 메뉴 복귀 (단축키 Z 또는 탭)"
                    >
                        <Eye size={13} className="text-amber-400" />
                        <span>몰입 모드 해제 (Z)</span>
                    </button>
                </div>
            )}

            {/* Song Stage Note & Arrangement Tip Bar */}
            {!isZenMode && (
                <div className="mb-2 px-3 py-1.5 rounded-xl border border-white/10 bg-[#0a0f0e]/70 backdrop-blur-md flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="shrink-0 flex items-center gap-1 font-bold text-amber-300 text-[11px]">
                            <FileText size={13} />
                            <span>곡 메모</span>
                        </span>
                        {isEditingNote ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveNote();
                                        if (e.key === 'Escape') setIsEditingNote(false);
                                    }}
                                    placeholder="예: 후렴 2회 반복 후 건반 솔로 4마디, 엔딩 페이드아웃..."
                                    className="flex-1 rounded-lg bg-black/60 border border-amber-400/40 px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveNote}
                                    className="tap-target px-2.5 py-1 rounded-lg bg-amber-400 text-black text-[11px] font-black shrink-0 hover:bg-amber-300 transition"
                                >
                                    저장
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingNote(false)}
                                    className="tap-target px-2 py-1 rounded-lg bg-white/10 text-white/60 text-[11px] font-bold shrink-0 hover:bg-white/20 transition"
                                >
                                    취소
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => {
                                    setNoteDraft(stageNote);
                                    setIsEditingNote(true);
                                }}
                                className="truncate text-white/80 text-[11px] cursor-pointer hover:text-white transition flex-1"
                                title="클릭하여 곡 진행 메모 수정 (단축키 M)"
                            >
                                {stageNote ? (
                                    <span>{stageNote}</span>
                                ) : (
                                    <span className="text-white/40 italic">클릭하여 이 곡의 연주/송폼 팁을 기록하세요 (예: 후렴 2회 반복, BPM 가속 등)</span>
                                )}
                            </div>
                        )}
                    </div>
                    {!isEditingNote && (
                        <button
                            type="button"
                            onClick={() => {
                                setNoteDraft(stageNote);
                                setIsEditingNote(true);
                            }}
                            className="tap-target px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/60 shrink-0 transition"
                            title="곡 메모 수정 (M)"
                        >
                            메모 편집 (M)
                        </button>
                    )}
                </div>
            )}

            {/* Score Display Area with BPM Giant Bar & Pulse Overlay */}
            <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-white/10 bg-black flex flex-col">
                {/* Song Form Roadmap Overlay on Sheet Music — yields to a song form band burned into the page */}
                {activePage && !activePage.marks.some((m) => m.kind === 'songform') && (
                    <SongFormScoreOverlay
                        teamId={teamId}
                        songId={songId}
                        page={page}
                        totalPages={totalPages}
                        currentSection={currentSection}
                        displayMode={songFormOverlayMode}
                        onDisplayModeChange={(m) => {
                            setSongFormOverlayMode(m);
                            try {
                                window.localStorage.setItem('wt_score_songform_mode', m);
                            } catch {}
                        }}
                        onSelectSection={(sec) => {
                            onSelectSection?.(sec);
                            triggerHaptic(20);
                        }}
                        isDarkInverted={isDarkInverted}
                    />
                )}

                {/* Live Stage Beacon Banner (Spontaneous Form & Tempo Alert) */}
                {cueBanner && (
                    <div
                        className="w-full p-2.5 sm:p-3 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white text-xs font-black shadow-2xl flex items-center justify-between z-40 shrink-0 animate-in fade-in slide-in-from-top-2 duration-150 ring-2 ring-white/30"
                        style={{
                            borderColor: cueBanner.accent ?? undefined,
                        }}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-black/30 text-white font-bold text-xs">
                                🚨
                            </span>
                            <div className="min-w-0">
                                <span className="truncate block font-black text-white text-xs sm:text-sm">
                                    {cueBanner.message}
                                </span>
                                {cueBanner.role && (
                                    <span className="text-[10px] text-white/80">발신: {cueBanner.role}</span>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCueBanner(null)}
                            className="px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-[10px] font-bold text-white shrink-0 ml-2"
                        >
                            확인 ✕
                        </button>
                    </div>
                )}

                {/* Giant 4-Beat Bar HUD */}
                {bpmEnabled && pulseMode === 'giant' && (
                    <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-black/80 border-b border-white/15 shrink-0 z-20">
                        {[1, 2, 3, 4].map((beat) => {
                            const isDownbeat = beat === 1;
                            const isHit = activeBeat === beat && blinkActive;
                            return (
                                <div
                                    key={beat}
                                    className={`h-4 sm:h-5 rounded-lg transition-all duration-75 text-center flex items-center justify-center font-mono font-black text-xs ${
                                        isHit
                                            ? isDownbeat
                                                ? 'bg-amber-400 text-black shadow-[0_0_20px_#fbbf24] scale-[1.02]'
                                                : 'bg-emerald-400 text-black shadow-[0_0_12px_#34d399] scale-[1.02]'
                                            : isDownbeat
                                            ? 'bg-amber-400/20 text-amber-300/40'
                                            : 'bg-white/10 text-white/30'
                                    }`}
                                >
                                    {beat === 1 ? '1 ●' : beat}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* BPM Pulse Overlay (Edge Strobe or Fullscreen Flash) */}
                {bpmEnabled && blinkActive && (pulseMode === 'edge' || pulseMode === 'fullscreen') && (
                    <div
                        className={`pointer-events-none absolute inset-0 z-30 transition-all duration-75 ${
                            pulseMode === 'edge'
                                ? activeBeat === 1
                                    ? 'border-4 border-amber-300 shadow-[inset_0_0_60px_rgba(251,191,36,0.7)]'
                                    : 'border-2 border-emerald-400 shadow-[inset_0_0_30px_rgba(52,211,153,0.4)]'
                                : activeBeat === 1
                                ? 'bg-amber-400/25 backdrop-brightness-125'
                                : 'bg-emerald-400/12'
                        }`}
                    />
                )}

                {activePage ? (
                    <div
                        className={`h-full w-full overflow-auto flex items-center justify-center p-1 sm:p-2 select-none ${
                            isAmberShield ? 'sepia-[0.35]' : ''
                        }`}
                    >
                        <div
                            className={`relative grid gap-2 transition-all ${
                                isDualPage && secondPage ? 'grid-cols-2 max-w-full h-full' : 'grid-cols-1'
                            } ${fitMode === 'height' ? 'max-h-full h-full w-auto' : 'w-full max-w-4xl'}`}
                            style={{
                                filter: isDarkInverted
                                    ? 'invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(1.08)'
                                    : 'none',
                            }}
                        >
                            {/* Page 1 */}
                            <div
                                className={`relative overflow-hidden rounded-lg bg-white shadow-2xl ${
                                    fitMode === 'height' ? 'h-full max-h-full w-auto' : 'w-full'
                                }`}
                                style={{ aspectRatio: `${activePage.width}/${activePage.height}` }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={activePage.image}
                                    alt={`${title} 악보 ${page}페이지`}
                                    className="block h-full w-full object-contain pointer-events-none"
                                    draggable={false}
                                />
                                <svg
                                    aria-label={`악보 ${page}페이지 필기 레이어`}
                                    className="absolute inset-0 h-full w-full pointer-events-none"
                                    viewBox={`0 0 1000 ${(1000 * activePage.height) / activePage.width}`}
                                    preserveAspectRatio="none"
                                >
                                    {renderMarks(activePage.marks, activePage)}
                                </svg>
                            </div>

                            {/* Page 2 (Dual Page Mode) */}
                            {isDualPage && secondPage && (
                                <div
                                    className={`relative overflow-hidden rounded-lg bg-white shadow-2xl ${
                                        fitMode === 'height' ? 'h-full max-h-full w-auto' : 'w-full'
                                    }`}
                                    style={{ aspectRatio: `${secondPage.width}/${secondPage.height}` }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={secondPage.image}
                                        alt={`${title} 악보 ${page + 1}페이지`}
                                        className="block h-full w-full object-contain pointer-events-none"
                                        draggable={false}
                                    />
                                    <svg
                                        aria-label={`악보 ${page + 1}페이지 필기 레이어`}
                                        className="absolute inset-0 h-full w-full pointer-events-none"
                                        viewBox={`0 0 1000 ${(1000 * secondPage.height) / secondPage.width}`}
                                        preserveAspectRatio="none"
                                    >
                                        {renderMarks(secondPage.marks, secondPage)}
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Interactive Touch Navigation Zones (with tactile chevron feedback) */}
                        {!stageLocked && (
                            <>
                                {/* Left Tap Zone: Previous Page / Previous Song */}
                                <button
                                    type="button"
                                    aria-label="이전 페이지 터치 넘김"
                                    onClick={() => {
                                        if (canTurnPage) {
                                            setIsFollowLeader(false);
                                            if (page > 1) {
                                                triggerHaptic(15);
                                                showPageTurnFlash('prev');
                                                onPageChange(Math.max(1, page - (isDualPage ? 2 : 1)));
                                            } else if (onPrevSong && hasPrevSong) {
                                                triggerHaptic([15, 30]);
                                                onPrevSong();
                                            }
                                        }
                                    }}
                                    className="group absolute inset-y-0 left-0 w-1/4 flex items-center justify-start pl-3 cursor-pointer opacity-0 hover:opacity-100 active:opacity-100 focus:outline-hidden transition-all duration-150"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-lg backdrop-blur-xs group-active:scale-90 transition transform">
                                        <ChevronLeft size={28} />
                                    </div>
                                </button>

                                {/* Right Tap Zone: Next Page / Next Song */}
                                <button
                                    type="button"
                                    aria-label="다음 페이지 터치 넘김"
                                    onClick={() => {
                                        if (canTurnPage) {
                                            setIsFollowLeader(false);
                                            if (page < totalPages) {
                                                triggerHaptic(15);
                                                showPageTurnFlash('next');
                                                onPageChange(Math.min(totalPages, page + (isDualPage ? 2 : 1)));
                                            } else if (onNextSong && hasNextSong) {
                                                triggerHaptic([15, 30]);
                                                onNextSong();
                                            }
                                        }
                                    }}
                                    className="group absolute inset-y-0 right-0 w-1/4 flex items-center justify-end pr-3 cursor-pointer opacity-0 hover:opacity-100 active:opacity-100 focus:outline-hidden transition-all duration-150"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-lg backdrop-blur-xs group-active:scale-90 transition transform">
                                        <ChevronRight size={28} />
                                    </div>
                                </button>
                            </>
                        )}

                        {/* Page Turn Flash Indicator */}
                        {pageTurnFlash && (
                            <div
                                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-75 ${
                                    pageTurnFlash === 'prev' ? 'left-8' : 'right-8'
                                }`}
                            >
                                {pageTurnFlash === 'prev' ? <ChevronLeft size={36} /> : <ChevronRight size={36} />}
                            </div>
                        )}

                        {/* Return to Leader Floating Pill */}
                        {!isFollowLeader && typeof leaderPage === 'number' && leaderPage > 0 && (leaderPage !== page || (leaderSongId && leaderSongId !== songId)) && (
                            <div className="absolute bottom-4 right-4 z-40">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsFollowLeader(true);
                                        if (leaderSongId && leaderSongId !== songId && onSelectSong) {
                                            onSelectSong(leaderSongId);
                                        }
                                        if (leaderPage) {
                                            onPageChange(leaderPage);
                                        }
                                    }}
                                    className="tap-target inline-flex items-center gap-2 rounded-full border-2 border-amber-400 bg-black/90 px-3.5 py-2 text-xs font-black text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.4)] backdrop-blur-md transition hover:bg-amber-400/20 active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                >
                                    <Radio size={14} className="animate-pulse text-amber-400" />
                                    <span>인도자 위치 ({leaderPage}p) 복귀</span>
                                </button>
                            </div>
                        )}
                        {/* Zen Mode Floating Restore Button */}
                        {isZenMode && (
                            <button
                                type="button"
                                onClick={() => setIsZenMode(false)}
                                className="absolute top-4 right-4 z-40 tap-target inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-3.5 py-1.5 text-xs font-bold text-white/90 backdrop-blur-md shadow-2xl hover:bg-black hover:text-white transition active:scale-95 animate-in fade-in duration-200"
                                title="무대 조작 메뉴 다시 보기"
                            >
                                <Eye size={14} className="text-amber-300" />
                                <span>메뉴 복원</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full min-h-[22rem] flex-col items-center justify-center p-6 text-center text-white/70">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300 mb-4 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
                            <Music2 size={28} />
                        </div>
                        <h4 className="text-base font-black text-white/95">
                            {loaded ? '등록된 악보가 없습니다' : '악보를 불러오는 중…'}
                        </h4>
                        <p className="mt-1.5 text-xs text-white/50 max-w-sm leading-relaxed">
                            콘티 작업 공간에서 악보 PDF나 이미지를 등록하거나, 지금 바로 무대 뷰어와 베지에 필기 엔진을 체험해볼 수 있는 샘플 찬양 악보를 생성할 수 있습니다.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => void loadSampleSheet()}
                                className="tap-target inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/20 px-4 py-2 text-xs font-black text-amber-200 hover:bg-amber-400/30 transition shadow-lg active:scale-95"
                            >
                                <Sparkles size={14} className="text-amber-300" />
                                <span>⚡ 체험용 샘플 악보 2장 생성</span>
                            </button>
                            {onSwitchToBpmMode && (
                                <button
                                    type="button"
                                    onClick={onSwitchToBpmMode}
                                    className="tap-target inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/70 hover:bg-white/10 transition"
                                >
                                    <Radio size={14} />
                                    <span>BPM 전광판 뷰</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Leader's Sermon & Speech Note HUD (Collapsible) */}
            {showLeaderNotes && (
                <div
                    className={`mt-2 w-full p-3.5 rounded-2xl bg-[#0a0f0e]/95 border border-amber-400/40 text-xs shadow-2xl space-y-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 transition-all ${
                        isZenMode ? 'hidden' : 'block'
                    }`}
                >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="font-black text-amber-300 flex items-center gap-1.5">
                            <span>📖</span> 인도자 곡간 멘트 & 말씀 메모
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowLeaderNotes(false)}
                            className="text-white/40 hover:text-white transition text-xs"
                        >
                            닫기 ✕
                        </button>
                    </div>
                    <div className="space-y-1.5 text-white/80 text-[11px] leading-relaxed">
                        <p>
                            <strong className="text-amber-300">말씀 본문:</strong> 시편 100편 1-5절 (&quot;온 땅이여 여호와께 즐거운 찬송을 부를지어다&quot;)
                        </p>
                        <p>
                            <strong className="text-emerald-300">곡간 멘트:</strong> &quot;오늘 이곳에 임재하신 주님을 바라봅니다. 잔잔한 마음으로 주님의 이름을 높여 찬양하겠습니다.&quot; (멘트 끝날 때 드럼 킥 진입)
                        </p>
                        <p>
                            <strong className="text-rose-300">합심 기도:</strong> 찬양 후 환우들과 공동체를 위한 3분 통성 기도 (건반 E key 잔잔한 패드 유지)
                        </p>
                    </div>
                </div>
            )}

            {/* Stage Feedback & Quick Cue Hub (Non-verbal Stage Communication) */}
            <div
                className={`mt-2 p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-[#0a0f0e] via-[#0d1413] to-[#121a18] border border-white/10 shadow-lg space-y-2.5 transition-all duration-300 ${
                    isZenMode ? 'translate-y-4 opacity-0 pointer-events-none h-0 p-0 m-0 overflow-hidden' : 'opacity-100'
                }`}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                            <span>📡</span> 실시간 무대 무음 큐
                        </span>
                        {lastSentDeliveryLabel ? (
                            <span className="truncate rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                                {lastSentDeliveryLabel}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setShowDiagnosticsModal(true)}
                            className="tap-target px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 transition"
                        >
                            ⚡ 상태 점검
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowLeaderNotes((prev) => !prev)}
                            className={`tap-target px-2.5 py-1 rounded-xl text-[10px] font-bold border transition ${
                                showLeaderNotes
                                    ? 'bg-amber-400 text-black border-amber-400'
                                    : 'bg-white/5 hover:bg-white/10 text-amber-200 border-amber-400/30'
                            }`}
                        >
                            📖 말씀 메모
                        </button>
                    </div>
                </div>

                {/* Cue Category Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    <button
                        type="button"
                        onClick={() => setActiveCueTab('all')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                            activeCueTab === 'all'
                                ? 'bg-white/20 text-white shadow-xs'
                                : 'text-white/50 hover:text-white/80'
                        }`}
                    >
                        전체 (12)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCueTab('tempo')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                            activeCueTab === 'tempo'
                                ? 'bg-amber-400 text-black shadow-xs font-black'
                                : 'text-amber-200/60 hover:text-amber-200'
                        }`}
                    >
                        ⚡ 템포·박자
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCueTab('sound')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                            activeCueTab === 'sound'
                                ? 'bg-rose-400 text-black shadow-xs font-black'
                                : 'text-rose-200/60 hover:text-rose-200'
                        }`}
                    >
                        🔊 음향·볼륨
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCueTab('flow')}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                            activeCueTab === 'flow'
                                ? 'bg-emerald-400 text-black shadow-xs font-black'
                                : 'text-emerald-200/60 hover:text-emerald-200'
                        }`}
                    >
                        🎶 송폼·흐름
                    </button>
                </div>

                {/* 1-Tap 템포 및 연주 피드백 칩 (빨라요, 느려요, 드럼 박자, 박자 밀림) */}
                {(activeCueTab === 'all' || activeCueTab === 'tempo') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🐇 [템포 주의] 빨라지고 있습니다. 차분하게 가라앉혀요!')}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/30 hover:border-amber-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-amber-300 group-hover:text-amber-100 flex items-center justify-between">
                                <span>🐇 빨라요</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200">템포</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">차분히 템포 홀드</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🐢 [템포 주의] 템포가 처지고 있습니다. 살짝만 밀어주세요!')}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/30 hover:border-amber-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-amber-300 group-hover:text-amber-100 flex items-center justify-between">
                                <span>🐢 느려요</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200">템포</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">살짝 템포 푸시</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🥁 [드럼 박자] 드럼 4박 카운트 또는 1박 다운비트 확실히 잡아주세요!')}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/30 hover:border-amber-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-amber-300 group-hover:text-amber-100 flex items-center justify-between">
                                <span>🥁 드럼 박자</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200">박자</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">비트 카운트·다운비트</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('⚠️ [박자 싱크 경고] 악기 간 박자가 어긋났습니다! 1박자 다운비트 확인!')}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-rose-300 group-hover:text-rose-100 flex items-center justify-between">
                                <span>⚠️ 박자 밀림</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-200">싱크</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">1박 정렬 필요</div>
                        </button>
                    </div>
                )}

                {/* 1-Tap 음향 및 볼륨 피드백 칩 (볼륨 업, 볼륨 다운, 보컬 UP, 모니터 체크) */}
                {(activeCueTab === 'all' || activeCueTab === 'sound') && (
                    <div className="space-y-1.5 pt-0.5">
                        {/* Sound Target Selector Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                            <span className="text-[10px] font-bold text-rose-300/80 shrink-0">대상 선택:</span>
                            {(['내 모니터', '보컬', '건반', '기타', '드럼', '전체'] as const).map((tgt) => (
                                <button
                                    key={tgt}
                                    type="button"
                                    onClick={() => {
                                        setSoundTarget(tgt);
                                        triggerHaptic(10);
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition shrink-0 ${
                                        soundTarget === tgt
                                            ? 'bg-rose-400 text-black border-rose-400'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                    }`}
                                >
                                    {tgt}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleSendStageCue(`🔊 [${soundTarget}] 볼륨을 살짝 올려주세요!`)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/60 text-left transition-all active:scale-95 shadow group"
                            >
                                <div className="text-xs font-black text-rose-300 group-hover:text-rose-100 flex items-center justify-between">
                                    <span>🔊 볼륨 업</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-200">{soundTarget}</span>
                                </div>
                                <div className="text-[10px] text-white/60 mt-1 truncate">사운드 레벨 증가</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendStageCue(`🔉 [${soundTarget}] 사운드가 큽니다. 볼륨을 살짝 낮춰주세요!`)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/60 text-left transition-all active:scale-95 shadow group"
                            >
                                <div className="text-xs font-black text-rose-300 group-hover:text-rose-100 flex items-center justify-between">
                                    <span>🔉 볼륨 다운</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-200">{soundTarget}</span>
                                </div>
                                <div className="text-[10px] text-white/60 mt-1 truncate">사운드 레벨 감소</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendStageCue(`🎤 [${soundTarget}] 보컬/마이크 레벨 명료하게 올려주세요!`)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/60 text-left transition-all active:scale-95 shadow group"
                            >
                                <div className="text-xs font-black text-rose-300 group-hover:text-rose-100 flex items-center justify-between">
                                    <span>🎤 보컬 UP</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-200">{soundTarget}</span>
                                </div>
                                <div className="text-[10px] text-white/60 mt-1 truncate">보컬 명료도 확보</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendStageCue(`🎚️ [${soundTarget}] 무대 모니터 밸런스 및 인이어 볼륨 체크 요망!`)}
                                className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/25 border border-sky-400/30 hover:border-sky-400/60 text-left transition-all active:scale-95 shadow group"
                            >
                                <div className="text-xs font-black text-sky-300 group-hover:text-sky-100 flex items-center justify-between">
                                    <span>🎚️ 모니터 체크</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-200">{soundTarget}</span>
                                </div>
                                <div className="text-[10px] text-white/60 mt-1 truncate">인이어 밸런스</div>
                            </button>
                        </div>
                    </div>
                )}

                {/* 1-Tap 송폼 즉흥 전환 및 통신 점검 칩 (한 번 더, 기도 BGM, 엔딩 컷, 통신 점검) */}
                {(activeCueTab === 'all' || activeCueTab === 'flow') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🔁 [인도자 큐] 엔딩 없이 후렴(Chorus) 한 번 더 반복합니다!')}
                            className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-400/30 hover:border-indigo-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-indigo-300 group-hover:text-indigo-100 flex items-center justify-between">
                                <span>🔁 한 번 더</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-400/20 text-indigo-200">반복</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">후렴 즉시 반복</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🎹 [송폼 전환] 모든 악기 FADE OUT, 건반 단독 잔잔한 기도 BGM 진입!')}
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-400/30 hover:border-emerald-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-emerald-300 group-hover:text-emerald-100 flex items-center justify-between">
                                <span>🎹 기도 BGM</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200">전환</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">피아노 단독 유지</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('🛑 [엔딩 신호] 2마디 후 정박 심벌 치고 일제히 컷! (Big Hit)')}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 hover:border-rose-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-rose-300 group-hover:text-rose-100 flex items-center justify-between">
                                <span>🛑 엔딩 컷</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-200">종료</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">심벌 히트 후 멈춤</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSendStageCue('📶 [통신 점검] 무대 실시간 통신 정상 작동 중입니다. (통신 확인)')}
                            className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/25 border border-sky-400/30 hover:border-sky-400/60 text-left transition-all active:scale-95 shadow group"
                        >
                            <div className="text-xs font-black text-sky-300 group-hover:text-sky-100 flex items-center justify-between">
                                <span>📶 통신 점검</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-200">점검</span>
                            </div>
                            <div className="text-[10px] text-white/60 mt-1 truncate">전체 기기 핑 확인</div>
                        </button>
                    </div>
                )}
            </div>

            {/* Diagnostics Modal Dialog */}
            {showDiagnosticsModal && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in"
                        onClick={() => setShowDiagnosticsModal(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-white/20 bg-[#0a0f0e] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in zoom-in-95 duration-150 space-y-4 text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                                    <Activity size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">
                                        무대 실시간 상태 점검 및 진단
                                    </h3>
                                    <p className="text-[11px] text-white/60">
                                        네트워크 품질, 기기 수신, 큐 전송 상태
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDiagnosticsModal(false)}
                                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">실시간 연결 상태</span>
                                <div className="flex items-center gap-2">
                                    <span className={`size-2.5 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                                    <span className="font-black text-white">
                                        {realtimeStatus === 'connected' ? '정상 연결됨' : '대기 / 로컬 연결'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-white/60">
                                    {realtimeStatus === 'connected' ? '초저지연 Web Broadcast' : '브라우저 간 통신 대기'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">접속 기기 수</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg font-black text-amber-300">{participantCount}</span>
                                    <span className="text-xs text-white/70">대 온라인</span>
                                </div>
                                <p className="text-[10px] text-white/60">인도자, 악기, 미디어</p>
                            </div>
                        </div>

                        {/* Recent Delivery Status */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">최근 큐 전달 확인 (ACK)</span>
                            <p className="text-xs font-black text-emerald-300">
                                {lastSentDeliveryLabel ?? '아직 전송된 큐가 없습니다.'}
                            </p>
                            <p className="text-[10px] text-white/60">
                                큐 전송 시 각 팀원 기기에서 수신 확인 신호가 실시간 반환됩니다.
                            </p>
                        </div>

                        {/* Quick Test Ping Button */}
                        <div className="pt-1 space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    handleSendStageCue('📶 [통신 점검] 무대 실시간 상태 점검 핑 신호 수신 확인!');
                                    setShowDiagnosticsModal(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/25 to-emerald-500/25 hover:from-amber-500/35 hover:to-emerald-500/35 border border-amber-400/40 py-2.5 text-xs font-black text-amber-200 transition active:scale-95 shadow"
                            >
                                <Radio size={14} />
                                <span>전체 기기에 통신 점검 신호 보내기</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Stage Bottom Navigation Bar (Zen Mode collapses smoothly) */}
            <footer
                className={`mt-2 flex flex-wrap items-center justify-between gap-2 px-1 transition-all duration-300 ${
                    isZenMode ? 'translate-y-4 opacity-0 pointer-events-none h-0 p-0 m-0 overflow-hidden' : 'opacity-100'
                }`}
            >
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsFollowLeader(false);
                            if (page > 1) {
                                triggerHaptic(15);
                                onPageChange(Math.max(1, page - (isDualPage ? 2 : 1)));
                            } else if (onPrevSong && hasPrevSong) {
                                triggerHaptic([15, 30]);
                                onPrevSong();
                            }
                        }}
                        disabled={!canTurnPage || (page <= 1 && !hasPrevSong)}
                        title={page <= 1 && hasPrevSong && prevSongTitle ? `이전 곡: ${prevSongTitle}` : '이전 페이지'}
                        className="tap-target inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-30 transition"
                    >
                        <ChevronLeft size={16} />
                        <span>{page <= 1 && hasPrevSong ? (prevSongTitle ? `이전: ${prevSongTitle}` : '이전 곡') : '이전'}</span>
                    </button>
                    <span className="text-xs font-black text-white/90">
                        {isDualPage && secondPage ? `${page}-${page + 1}` : page} / {totalPages || 1}p
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsFollowLeader(false);
                            if (page < totalPages) {
                                triggerHaptic(15);
                                onPageChange(Math.min(totalPages, page + (isDualPage ? 2 : 1)));
                            } else if (onNextSong && hasNextSong) {
                                triggerHaptic([15, 30]);
                                onNextSong();
                            }
                        }}
                        disabled={!canTurnPage || (page >= totalPages && !hasNextSong)}
                        className="tap-target inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-30 transition"
                    >
                        <span>{page >= totalPages && hasNextSong ? `다음 곡` : `다음`}</span>
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Prompt to advance to next song when at the end of current sheet */}
                    {page >= totalPages && hasNextSong && nextSongTitle && onNextSong ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsFollowLeader(false);
                                triggerHaptic([15, 30]);
                                onNextSong();
                            }}
                            className="tap-target inline-flex items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-400/20 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-400/30 transition animate-pulse"
                        >
                            <span>다음 곡: {nextSongTitle}</span>
                            <ChevronsRight size={15} />
                        </button>
                    ) : null}

                    {/* Recent Cue Pill Button */}
                    {recentCues.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowRecentCuesDrawer(true)}
                            className="tap-target inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-400/20 transition max-w-[130px] sm:max-w-xs truncate"
                            title="최근 무대 신호 내역 (단축키 H)"
                        >
                            <History size={12} className="shrink-0" />
                            <span className="truncate">{recentCues[0].message}</span>
                        </button>
                    )}

                    {/* Keyboard / Pedal Shortcuts Guide Button */}
                    <button
                        type="button"
                        onClick={() => setShowPedalShortcutsModal(true)}
                        className="tap-target hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white transition"
                        title="페달 및 키보드 단축키 안내"
                    >
                        <Keyboard size={12} />
                        <span>단축키 안내</span>
                    </button>

                    <div className="hidden md:flex items-center gap-2 text-[11px] text-white/60">
                        <span>
                            {sheetSource === 'published' ? '팀 공유본' : '내 필기본'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-medium">
                            {stepper.sectionMode && stepper.available ? '🦶 페달로 섹션 이동' : '⌨️ 페달 넘김 가능'}
                        </span>
                    </div>
                </div>
            </footer>

            {/* Floating Quick Cue FAB (Always accessible, even in Zen mode) */}
            <div className="fixed sm:absolute bottom-4 right-4 z-40 flex flex-col items-end">
                {showFloatingCueDial && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in duration-100"
                            onClick={() => setShowFloatingCueDial(false)}
                        />
                        <div className="relative z-50 mb-2 w-56 rounded-2xl border border-amber-400/40 bg-[#0a0f0e]/95 p-2 shadow-[0_15px_40px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-150 space-y-1.5">
                            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
                                <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                                    <Zap size={12} /> 1-터치 빠른 신호
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowFloatingCueDial(false)}
                                    className="text-white/40 hover:text-white text-xs"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue('🐇 [템포 주의] 빨라지고 있습니다. 차분하게 가라앉혀요!');
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/20 transition active:scale-95"
                                >
                                    <span>🐇</span>
                                    <span>빨라요 (템포 홀드)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue('🐢 [템포 주의] 템포가 처지고 있습니다. 살짝만 밀어주세요!');
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/20 transition active:scale-95"
                                >
                                    <span>🐢</span>
                                    <span>느려요 (템포 푸시)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue('🔁 [인도자 큐] 엔딩 없이 후렴(Chorus) 한 번 더 반복합니다!');
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/20 transition active:scale-95"
                                >
                                    <span>🔁</span>
                                    <span>한 번 더 반복</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue('🎹 [송폼 전환] 모든 악기 FADE OUT, 건반 단독 잔잔한 기도 BGM 진입!');
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20 transition active:scale-95"
                                >
                                    <span>🎹</span>
                                    <span>기도 BGM 전환</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue('🛑 [엔딩 신호] 2마디 후 정박 심벌 치고 일제히 컷! (Big Hit)');
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/20 transition active:scale-95"
                                >
                                    <span>🛑</span>
                                    <span>엔딩 컷</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSendStageCue(`🔊 [${soundTarget}] 볼륨을 살짝 올려주세요!`);
                                        setShowFloatingCueDial(false);
                                    }}
                                    className="w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/20 transition active:scale-95"
                                >
                                    <span>🔊</span>
                                    <span>{soundTarget} 볼륨 UP</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setShowFloatingCueDial((prev) => !prev);
                        triggerHaptic(15);
                    }}
                    className={`tap-target flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black shadow-[0_6px_25px_rgba(0,0,0,0.8)] backdrop-blur-xl border transition-all active:scale-90 ${
                        showFloatingCueDial
                            ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400/50'
                            : 'bg-[#0a0f0e]/90 text-amber-300 border-amber-400/40 hover:bg-amber-400/20'
                    }`}
                    title="빠른 무대 신호 다이얼 (단축키 B)"
                >
                    <Zap size={14} className={showFloatingCueDial ? 'text-black' : 'text-amber-400 animate-pulse'} />
                    <span>신호 (B)</span>
                </button>
            </div>

            {/* Recent Cues History Drawer / Modal */}
            {showRecentCuesDrawer && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs animate-in fade-in"
                        onClick={() => setShowRecentCuesDrawer(false)}
                    />
                    <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-white/20 bg-[#0a0f0e]/95 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in slide-in-from-bottom duration-150 space-y-3 text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                                <History size={16} className="text-amber-300" />
                                <h3 className="text-xs font-black text-white">최근 무대 신호 기록</h3>
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                    {recentCues.length}건
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRecentCuesDrawer(false)}
                                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {recentCues.length === 0 ? (
                            <div className="py-6 text-center text-xs text-white/40">
                                아직 전송되거나 수신된 신호가 없습니다.
                            </div>
                        ) : (
                            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                                {recentCues.map((cue) => (
                                    <div
                                        key={cue.id}
                                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs hover:bg-white/10 transition"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-amber-300/80">
                                                    {cue.role ?? '팀 신호'}
                                                </span>
                                                <span className="text-[10px] text-white/40">
                                                    {cue.time}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-white/95 mt-0.5 truncate">
                                                {cue.message}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleSendStageCue(cue.message);
                                                setShowRecentCuesDrawer(false);
                                            }}
                                            className="tap-target px-2 py-1 rounded-lg bg-white/10 hover:bg-amber-400 hover:text-black text-[10px] font-bold text-white/80 shrink-0 transition"
                                            title="이 신호 다시 보내기"
                                        >
                                            재전송
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-1 flex items-center justify-between text-[11px] text-white/50 border-t border-white/10">
                            <span>단축키: H로 열기/닫기</span>
                            <button
                                type="button"
                                onClick={() => setRecentCues([])}
                                className="text-[10px] text-white/40 hover:text-white/70"
                            >
                                기록 지우기
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Pedal & Keyboard Shortcuts Guide Modal */}
            {showPedalShortcutsModal && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in"
                        onClick={() => setShowPedalShortcutsModal(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-white/20 bg-[#0a0f0e] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-in zoom-in-95 duration-150 space-y-4 text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                                    <Keyboard size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">
                                        무대 단축키 & 블루투스 페달 안내
                                    </h3>
                                    <p className="text-[11px] text-white/60">
                                        손대지 않고 쾌적하게 조작하는 무대 가이드
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPedalShortcutsModal(false)}
                                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                                <span className="text-[11px] font-black text-amber-300 block">🦶 블루투스 풋 페달</span>
                                <div className="space-y-1 text-white/80 text-[11px]">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">PageUp / ArrowUp</span>
                                        <span>이전 페이지 (1페이지에서 누르면 이전 곡)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">PageDown / Space / Right</span>
                                        <span>다음 페이지 (끝페이지에서 누르면 다음 곡)</span>
                                    </div>
                                </div>
                                {stepper.available && (
                                    <div className="space-y-1.5 border-t border-white/10 pt-2 text-[11px] text-white/80">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-white">페달 동작</span>
                                            <span className="inline-flex gap-1" role="group" aria-label="페달 동작">
                                                {([false, true] as const).map((on) => (
                                                    <button
                                                        key={String(on)}
                                                        type="button"
                                                        aria-pressed={stepper.sectionMode === on}
                                                        onClick={() => stepper.setSectionMode(on)}
                                                        className="rounded-lg border border-white/15 px-2 py-0.5 font-bold aria-pressed:bg-amber-400 aria-pressed:text-black"
                                                    >
                                                        {on ? '섹션 이동' : '페이지 넘김'}
                                                    </button>
                                                ))}
                                            </span>
                                        </div>
                                        <p className="text-white/60">
                                            섹션 이동: 악보에 얹은 송폼 순서대로 다음 섹션의 마디 표시로 넘어가고, 그 표시가 있는 페이지를 엽니다. 송폼 끝에서는 다시 페이지를 넘깁니다.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                                <span className="text-[11px] font-black text-emerald-300 block">⌨️ 무대 키보드 단축키</span>
                                <div className="space-y-1.5 text-white/80 text-[11px]">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded font-black">T</span>
                                        <span>탭 템포 (연타하여 박자/BPM 즉시 측정)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-2 py-0.5 rounded font-black">Z</span>
                                        <span>무대 몰입 모드 (상단/하단 메뉴 숨김 토글)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-2 py-0.5 rounded font-black">B</span>
                                        <span>플로팅 빠른 신호 다이얼 (1-터치 큐 열기)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-2 py-0.5 rounded font-black">M</span>
                                        <span>곡 진행 메모 열기 및 편집 (엔터로 저장)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono bg-white/10 px-2 py-0.5 rounded font-black">H</span>
                                        <span>최근 무대 신호 내역 (History) 열람</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPedalShortcutsModal(false)}
                            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-white transition active:scale-95"
                        >
                            확인 완료
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
