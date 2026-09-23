'use client';

import { useState } from 'react';
import type { SongRow } from '@/types/session';
import {
    BatteryMedium,
    Check,
    ClipboardCopy,
    Mic,
    Mic2,
    Radio,
    Sliders,
    Volume2,
    VolumeX,
} from 'lucide-react';

interface SoundEngineerWorkspaceProps {
    songs: SongRow[];
    currentSongId: string | null;
    currentSection: string | null;
    sections: string[];
    onSendCue: (message: string, targetRole?: string) => void;
    teamName: string;
}

// 송폼별 추천 다이내믹스 및 음향 가이드
function getDynamicsGuide(section: string): { level: string; color: string; desc: string; instrumentation: string } {
    const s = section.toLowerCase();
    if (s.includes('intro') || s.includes('도입')) {
        return {
            level: 'mp',
            color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            desc: '단독 악기 또는 잔잔한 건반/어쿠스틱 시작',
            instrumentation: '건반 / 어쿠스틱 기타 (보컬 OFF)',
        };
    }
    if (s.includes('verse') || s.includes('절')) {
        return {
            level: 'mf',
            color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            desc: '인도자 중심 보컬 + 리듬 파트 차분하게 진입',
            instrumentation: '인도자 보컬 + 베이스/심벌 탭',
        };
    }
    if (s.includes('pre-chorus') || s.includes('프리')) {
        return {
            level: 'f',
            color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            desc: '후렴으로 넘어가는 빌드업 구간 (드럼 스네어/탐 빌드업)',
            instrumentation: '전체 싱어 코러스 + 드럼 빌드업',
        };
    }
    if (s.includes('chorus') || s.includes('후렴')) {
        return {
            level: 'ff',
            color: 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-black',
            desc: '풀밴드 폭발 구간. 하우스 음압 및 메인 마이크 게인 확보',
            instrumentation: '풀밴드 (일렉/드럼 풀) + 전원 코러스',
        };
    }
    if (s.includes('bridge') || s.includes('브릿지')) {
        return {
            level: 'f ~ ff',
            color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            desc: '클라이맥스 고조 또는 순간 브레이크 후 폭발',
            instrumentation: '악기 다이내믹스 주시 (순간 컷 대비)',
        };
    }
    if (s.includes('outro') || s.includes('엔딩') || s.includes('기도')) {
        return {
            level: 'p',
            color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
            desc: '기도회 진입 또는 잔잔한 페이드아웃',
            instrumentation: '메인 건반 패드 유지 + 멘트 마이크 오픈',
        };
    }
    return {
        level: 'mf',
        color: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        desc: '진행 구간',
        instrumentation: '기본 밴드 세션',
    };
}

export default function SoundEngineerWorkspace({
    songs,
    currentSongId,
    currentSection,
    sections,
    onSendCue,
    teamName,
}: SoundEngineerWorkspaceProps) {
    const currentSong = songs.find((s) => s.id === currentSongId) ?? songs[0];
    const [copiedLyrics, setCopiedLyrics] = useState(false);
    const [sentCueId, setSentCueId] = useState<string | null>(null);

    // 음향 엔지니어 특화 퀵 큐 프리셋
    const soundCuePresets = [
        { id: 'lead-up', label: '인도자 마이크 UP', message: '인도자 보컬 레벨 올려드렸습니다.', icon: Mic },
        { id: 'monitor-check', label: '모니터 체크 요망', message: '무대 모니터 밸런스 확인해 주세요.', icon: Sliders },
        { id: 'keyboard-pad', label: '세컨 패드 확인', message: '세컨 건반 패드 볼륨 조정 부탁드립니다.', icon: Volume2 },
        { id: 'battery-warning', label: '무선 배터리 주의', message: '무선 마이크 배터리 잔량 1칸입니다.', icon: BatteryMedium },
        { id: 'prayer-bgm', label: '기도 BGM 대기', message: '기도회 전환 BGM 준비해 주세요.', icon: Radio },
        { id: 'feedback-warning', label: '하울링 주의', message: '스피커 앞 마이크 각도 주의해 주세요.', icon: VolumeX },
    ];

    const handleSendQuickCue = (id: string, message: string) => {
        onSendCue(message, 'sound');
        setSentCueId(id);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(25);
        }
        setTimeout(() => setSentCueId(null), 2000);
    };

    // 자막팀용 가사 및 송폼 복사
    const handleCopyLyricsAndSongForm = async () => {
        const textLines = [
            `[⛪ ${teamName} 찬양 자막 & 송폼 안내]`,
            '',
            ...songs.map((song, idx) => {
                return `${idx + 1}. ${song.title} (${song.original_key ?? '-'} Key)\n송폼: ${sections.length ? sections.join(' → ') : '기본 진행'}\n`;
            }),
            '※ 방송/자막팀은 위 순서대로 자막 슬라이드를 송출해 주세요.',
        ];
        try {
            await navigator.clipboard.writeText(textLines.join('\n'));
            setCopiedLyrics(true);
            setTimeout(() => setCopiedLyrics(false), 2500);
        } catch {
            // fallback
        }
    };

    return (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0d1614] p-4 text-[#e6f4f1] sm:p-5">
            {/* 상단: 음향 부스 타이틀 & 자막 복사 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Sliders size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white sm:text-lg">
                            음향 & 미디어 엔지니어 콘솔 큐시트
                        </h2>
                        <p className="text-xs text-white/60">
                            현재 곡: <strong className="text-amber-300">{currentSong?.title ?? '곡 대기'}</strong> ({currentSong?.original_key ?? '-'} Key · {currentSong?.bpm ?? '--'} BPM)
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleCopyLyricsAndSongForm}
                    className="tap-target inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                    {copiedLyrics ? (
                        <>
                            <Check size={14} className="text-emerald-400" />
                            <span>자막팀용 송폼 전체 복사됨!</span>
                        </>
                    ) : (
                        <>
                            <ClipboardCopy size={14} />
                            <span>자막/PPT용 송폼 1초 복사</span>
                        </>
                    )}
                </button>
            </div>

            {/* 마이크 라인업 현황 */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                    보컬 & 마이크 채널 라인업
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                    <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2">
                        <Mic size={15} className="text-amber-400 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-bold text-amber-200">CH 1: 인도자</p>
                            <p className="text-[10px] text-white/50 truncate">메인 보컬 / 멘트</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                        <Mic2 size={15} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-bold text-white">CH 2: 싱어 1</p>
                            <p className="text-[10px] text-white/50 truncate">소프라노</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                        <Mic2 size={15} className="text-sky-400 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-bold text-white">CH 3: 싱어 2</p>
                            <p className="text-[10px] text-white/50 truncate">알토 / 코러스</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                        <Mic size={15} className="text-purple-400 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-bold text-white">CH 4: 싱어 3</p>
                            <p className="text-[10px] text-white/50 truncate">테너</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 현재 곡 송폼 섹션별 음향 다이내믹스 타임라인 */}
            <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                    현재 곡 송폼 & 사운드 다이내믹스 타임라인
                </span>

                <div className="space-y-2">
                    {sections.length > 0 ? (
                        sections.map((sec, idx) => {
                            const isCurrent = sec === currentSection;
                            const guide = getDynamicsGuide(sec);

                            return (
                                <div
                                    key={`${sec}-${idx}`}
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 transition-all ${
                                        isCurrent
                                            ? 'border-amber-400 bg-amber-400/15 shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-400'
                                            : 'border-white/10 bg-black/20 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                            isCurrent ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/70'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-sm text-white">
                                                    {sec}
                                                </span>
                                                {isCurrent && (
                                                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300 animate-pulse">
                                                        진행 중 ●
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/70 truncate mt-0.5">
                                                {guide.desc}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                        <span className="text-[11px] text-white/60 hidden md:inline">
                                            {guide.instrumentation}
                                        </span>
                                        <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${guide.color}`}>
                                            {guide.level}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-white/50">
                            등록된 송폼 섹션이 없습니다. 기본 밸런스로 진행됩니다.
                        </div>
                    )}
                </div>
            </div>

            {/* 음향 엔지니어 전용 1초 톡백 큐 프리셋 */}
            <div className="pt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                    무대 전송 1초 톡백 큐 (음향 전용)
                </span>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {soundCuePresets.map((cue) => {
                        const Icon = cue.icon;
                        const isSent = sentCueId === cue.id;

                        return (
                            <button
                                key={cue.id}
                                type="button"
                                onClick={() => handleSendQuickCue(cue.id, cue.message)}
                                className={`tap-target flex items-center justify-between rounded-xl border p-2.5 text-left text-xs font-semibold transition-all active:scale-95 ${
                                    isSent
                                        ? 'border-emerald-400 bg-emerald-400/25 text-emerald-200'
                                        : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20'
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon size={16} className={isSent ? 'text-emerald-300' : 'text-amber-400/80'} />
                                    <span>{cue.label}</span>
                                </span>
                                {isSent && <Check size={14} className="text-emerald-300" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
