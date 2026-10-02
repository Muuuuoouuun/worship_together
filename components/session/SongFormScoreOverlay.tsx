'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronRight, Layers, Sparkles, X, Check, Eye } from 'lucide-react';
import { readSongForm, saveSongForm, SONG_FORM_CHANGED_EVENT } from '@/lib/songFormStorage';
import { type SongForm } from '@/lib/songForm';

export type SongFormOverlayDisplayMode = 'first_page_only' | 'all_pages' | 'hidden';

export interface SongFormScoreOverlayProps {
    teamId: string;
    songId: string;
    page: number;
    totalPages?: number;
    currentSection?: string | null;
    displayMode?: SongFormOverlayDisplayMode;
    onDisplayModeChange?: (mode: SongFormOverlayDisplayMode) => void;
    onSelectSection?: (sectionLabel: string) => void;
    isDarkInverted?: boolean;
    compact?: boolean;
}

const DEFAULT_FLOW_PRESET: Array<{ label: string; key: string }> = [
    { label: 'Intro', key: 'intro' },
    { label: 'Verse 1', key: 'v1' },
    { label: 'Chorus', key: 'c1' },
    { label: 'Verse 2', key: 'v2' },
    { label: 'Chorus', key: 'c2' },
    { label: 'Bridge', key: 'b' },
    { label: 'Chorus', key: 'c3' },
    { label: 'Outro', key: 'outro' },
];

export default function SongFormScoreOverlay({
    teamId,
    songId,
    page,
    currentSection,
    displayMode = 'first_page_only',
    onDisplayModeChange,
    onSelectSection,
    isDarkInverted = false,
}: SongFormScoreOverlayProps) {
    const [songForm, setSongForm] = useState<SongForm | null>(null);
    const [showModeSelector, setShowModeSelector] = useState(false);

    useEffect(() => {
        const load = () => {
            if (!songId || !teamId) return;
            const form = readSongForm(songId, teamId);
            setSongForm(form);
        };
        load();
        window.addEventListener('storage', load);
        window.addEventListener(SONG_FORM_CHANGED_EVENT, load);
        return () => {
            window.removeEventListener('storage', load);
            window.removeEventListener(SONG_FORM_CHANGED_EVENT, load);
        };
    }, [songId, teamId]);

    const sections = useMemo(() => {
        if (songForm?.sections?.length) {
            return songForm.sections.map((s, idx) => ({
                id: s.id,
                label: s.label,
                cleanLabel: s.label.replace(/^\d+[\.\s]*/, '').trim(),
                index: idx,
            }));
        }
        return DEFAULT_FLOW_PRESET.map((s, idx) => ({
            id: `default-${idx}`,
            label: s.label,
            cleanLabel: s.label,
            index: idx,
        }));
    }, [songForm]);

    const isCustomForm = Boolean(songForm?.sections?.length);

    // Matches displayed/active section
    const activeSectionIndex = useMemo(() => {
        if (!currentSection) return -1;
        const normalizedCurrent = currentSection.replace(/^\d+[\.\s]*/, '').trim().toLowerCase();
        return sections.findIndex(
            (s) =>
                s.label.toLowerCase() === currentSection.toLowerCase() ||
                s.cleanLabel.toLowerCase() === normalizedCurrent ||
                normalizedCurrent.includes(s.cleanLabel.toLowerCase())
        );
    }, [currentSection, sections]);

    // Check display conditions:
    // 1. If hidden: do not render.
    // 2. If 'first_page_only' and page > 1: do not render! (악보 맨 첫 페이지만 오버레이)
    if (displayMode === 'hidden') return null;
    if (displayMode === 'first_page_only' && page > 1) return null;

    const handleCreateDefaultSongForm = () => {
        if (!songId || !teamId) return;
        const newForm: SongForm = {
            version: 1,
            songId,
            youtubeUrl: null,
            source: 'manual',
            sections: DEFAULT_FLOW_PRESET.map((p, idx) => ({
                id: `sec-${Date.now()}-${idx}`,
                label: p.label,
                startSeconds: null,
            })),
            updatedAt: new Date().toISOString(),
        };
        saveSongForm(newForm, teamId);
    };

    return (
        <aside
            aria-label="악보 송폼 오버레이"
            className="pointer-events-auto absolute top-2 inset-x-2 sm:inset-x-3 z-30 transition-all duration-200"
        >
            <div
                className={`rounded-xl border backdrop-blur-xl px-2.5 py-1.5 shadow-xl transition-all ${
                    isDarkInverted
                        ? 'border-amber-400/40 bg-black/85 text-amber-100'
                        : 'border-slate-700/30 bg-slate-900/90 text-white'
                }`}
            >
                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-white/10 text-[11px]">
                    <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 font-bold text-[10px]">
                            <Layers size={11} />
                        </span>
                        <span className="font-black text-amber-300 tracking-wider">
                            송폼 로드맵
                        </span>
                        <span className="text-[10px] text-white/50">
                            {displayMode === 'first_page_only' ? '(1p 상단 오버레이)' : '(전 페이지 고정)'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {!isCustomForm && (
                            <button
                                type="button"
                                onClick={handleCreateDefaultSongForm}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-[10px] font-bold transition"
                                title="표준 송폼(Intro-V-C-B-O) 저장"
                            >
                                <Sparkles size={10} />
                                <span>표준 송폼 적용</span>
                            </button>
                        )}

                        {onDisplayModeChange && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowModeSelector((prev) => !prev)}
                                    className="tap-target inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white/70 hover:bg-white/10 transition"
                                    title="송폼 오버레이 표시 위치 설정"
                                >
                                    <Eye size={10} />
                                    <span>설정</span>
                                </button>

                                {showModeSelector && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowModeSelector(false)}
                                        />
                                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/15 bg-black/95 p-1.5 shadow-2xl backdrop-blur-2xl space-y-1 text-left">
                                            <div className="px-2 py-1 text-[10px] font-bold text-white/50 border-b border-white/10">
                                                악보 위 송폼 표시
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDisplayModeChange('first_page_only');
                                                    setShowModeSelector(false);
                                                }}
                                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                                                    displayMode === 'first_page_only'
                                                        ? 'bg-amber-400/20 font-black text-amber-300'
                                                        : 'text-white/70 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>1페이지에만 표시</span>
                                                {displayMode === 'first_page_only' && <Check size={12} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDisplayModeChange('all_pages');
                                                    setShowModeSelector(false);
                                                }}
                                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                                                    displayMode === 'all_pages'
                                                        ? 'bg-amber-400/20 font-black text-amber-300'
                                                        : 'text-white/70 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>모든 페이지에 표시</span>
                                                {displayMode === 'all_pages' && <Check size={12} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDisplayModeChange('hidden');
                                                    setShowModeSelector(false);
                                                }}
                                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                                                    (displayMode as string) === 'hidden'
                                                        ? 'bg-rose-400/20 font-black text-rose-300'
                                                        : 'text-white/70 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>숨김</span>
                                                {(displayMode as string) === 'hidden' && <Check size={12} />}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {onDisplayModeChange && (
                            <button
                                type="button"
                                onClick={() => onDisplayModeChange('hidden')}
                                className="text-white/40 hover:text-white p-0.5 rounded transition"
                                title="송폼 오버레이 닫기"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Section Road Sequence Chips */}
                <div className="mt-1.5 flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar scroll-smooth">
                    {sections.map((sec, idx) => {
                        const isActive = idx === activeSectionIndex;
                        const isPast = activeSectionIndex >= 0 && idx < activeSectionIndex;

                        return (
                            <div key={sec.id} className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => onSelectSection?.(sec.label)}
                                    className={`tap-target group flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs transition-all active:scale-95 ${
                                        isActive
                                            ? 'bg-amber-400 text-slate-950 font-black shadow-[0_0_14px_rgba(251,191,36,0.9)] ring-2 ring-white scale-105 z-10'
                                            : isPast
                                            ? 'bg-white/5 text-white/40 border border-white/5 line-through opacity-70'
                                            : 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/10'
                                    }`}
                                    title={`클릭하여 ${sec.cleanLabel} 섹션으로 이동`}
                                >
                                    <span className="truncate max-w-[5.5rem] sm:max-w-none">
                                        {sec.cleanLabel}
                                    </span>
                                    {isActive && (
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                                    )}
                                </button>
                                {idx < sections.length - 1 && (
                                    <ChevronRight
                                        size={11}
                                        className={`shrink-0 ${
                                            isPast
                                                ? 'text-white/20'
                                                : isActive
                                                ? 'text-amber-300 font-bold'
                                                : 'text-white/30'
                                        }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
