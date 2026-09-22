'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { updateSongBpmPreset } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database } from '@/types/schema';
import { AudioLines, Play, Square, Timer } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SongBpmPresetManagerProps {
    songs: Song[];
    disabled?: boolean;
    saveAction?: (formData: FormData) => void | Promise<void>;
}

function SongBpmItem({
    song,
    disabled,
    saveAction,
}: {
    song: Song;
    disabled: boolean;
    saveAction: (formData: FormData) => void | Promise<void>;
}) {
    const [bpm, setBpm] = useState<number | ''>(song.bpm ?? '');
    const [isPlaying, setIsPlaying] = useState(false);
    const [tapTimes, setTapTimes] = useState<number[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<number | null>(null);

    // Clean up audio on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
        };
    }, []);

    const playBeep = useCallback((freq = 600) => {
        try {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.09);
        } catch {
            // Audio context not allowed or supported
        }
    }, []);

    const toggleMetronome = () => {
        if (isPlaying) {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsPlaying(false);
        } else {
            const currentBpm = typeof bpm === 'number' && bpm >= 20 && bpm <= 300 ? bpm : 120;
            if (bpm === '') setBpm(currentBpm);
            const intervalMs = (60 / currentBpm) * 1000;
            playBeep(880);
            let beatCount = 1;
            timerRef.current = window.setInterval(() => {
                beatCount = (beatCount % 4) + 1;
                playBeep(beatCount === 1 ? 880 : 440);
            }, intervalMs);
            setIsPlaying(true);
        }
    };

    const handleTap = () => {
        const now = performance.now();
        const recentTaps = [...tapTimes.filter(t => now - t < 3000), now];
        setTapTimes(recentTaps);

        if (recentTaps.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < recentTaps.length; i++) {
                intervals.push(recentTaps[i] - recentTaps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            if (calculatedBpm >= 30 && calculatedBpm <= 260) {
                setBpm(calculatedBpm);
                if (isPlaying) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    const intervalMs = (60 / calculatedBpm) * 1000;
                    timerRef.current = window.setInterval(() => {
                        playBeep(440);
                    }, intervalMs);
                }
            }
        }
        playBeep(700);
    };

    return (
        <form
            action={saveAction}
            onSubmit={
                saveAction === updateSongBpmPreset
                    ? undefined
                    : (event) => {
                          event.preventDefault();
                          void saveAction(new FormData(event.currentTarget));
                      }
            }
            className="rounded-2xl border border-primary/10 bg-card p-4 transition-all hover:border-primary/20"
        >
            <fieldset disabled={disabled} className="flex flex-col gap-4 disabled:opacity-60">
                <input type="hidden" name="songId" value={song.id} />
                <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-bold text-foreground">{song.title}</p>
                    <p className="text-xs text-muted-foreground">{song.artist ?? '아티스트 미정'}</p>
                </div>

                <div className="flex flex-wrap items-end gap-2.5">
                    <label className="min-w-[100px] flex-1 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            BPM
                        </span>
                        <Input
                            name="bpm"
                            type="number"
                            min={20}
                            max={300}
                            step={1}
                            placeholder="미설정"
                            value={bpm}
                            onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setBpm(val);
                            }}
                            className="h-10 text-center font-bold"
                        />
                    </label>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTap}
                        className="h-10 px-3 text-xs font-bold text-primary hover:bg-primary/10 active:scale-95"
                        title="박자에 맞춰 연속으로 탭하세요"
                    >
                        <Timer size={14} />
                        <span>탭 템포 {tapTimes.length > 1 ? `(${tapTimes.length})` : ''}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={isPlaying ? 'destructive' : 'secondary'}
                        size="sm"
                        onClick={toggleMetronome}
                        className="h-10 px-3 text-xs font-semibold"
                        title="메트로놈 비프음 미리듣기"
                    >
                        {isPlaying ? <Square size={14} /> : <Play size={14} />}
                        <span>{isPlaying ? '정지' : '듣기'}</span>
                    </Button>

                    <Button type="submit" size="sm" className="h-10 px-4 text-xs font-bold">
                        BPM 저장
                    </Button>
                </div>
            </fieldset>
        </form>
    );
}

export default function SongBpmPresetManager({
    songs,
    disabled = false,
    saveAction = updateSongBpmPreset,
}: SongBpmPresetManagerProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary shadow-xs">
                    <AudioLines size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold text-foreground">곡별 BPM 설정</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        곡의 기본 템포를 설정하고 탭 템포와 메트로놈 비프음으로 직접 확인합니다.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {songs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-muted-foreground">
                        곡을 추가한 뒤 BPM을 저장하세요.
                    </div>
                ) : (
                    songs.map((song) => (
                        <SongBpmItem
                            key={song.id}
                            song={song}
                            disabled={disabled}
                            saveAction={saveAction}
                        />
                    ))
                )}
            </div>
        </GlassCard>
    );
}
