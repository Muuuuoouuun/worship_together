'use client';
import { updateSongBpmPreset } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database } from '@/types/schema';
import { AudioLines } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SongBpmPresetManagerProps {
    songs: Song[];
    disabled?: boolean;
    saveAction?: (formData: FormData) => void | Promise<void>;
}

export default function SongBpmPresetManager({
    songs,
    disabled = false,
    saveAction = updateSongBpmPreset,
}: SongBpmPresetManagerProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <AudioLines size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold text-primary">곡별 BPM</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        곡의 기본 템포를 저장합니다.
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
                        <form
                            key={song.id}
                            action={saveAction} onSubmit={saveAction === updateSongBpmPreset ? undefined : event => { event.preventDefault(); void saveAction(new FormData(event.currentTarget)); }}
                            className="rounded-2xl border border-primary/10 bg-card px-4 py-4"
                        >
                            <fieldset
                                disabled={disabled}
                                className="flex flex-col gap-4 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <input type="hidden" name="songId" value={song.id} />
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-primary">{song.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {song.artist ?? 'Artist pending'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <label className="flex-1 space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                            BPM
                                        </span>
                                        <Input
                                            name="bpm"
                                            type="number"
                                            min={20} max={300} step={1}
                                            placeholder="미설정은 비워두세요"
                                            defaultValue={song.bpm ?? ''}
                                        />
                                    </label>
                                    <Button type="submit" className="h-11 w-full rounded-full px-5 sm:w-auto">
                                        BPM 저장
                                    </Button>
                                </div>
                            </fieldset>
                        </form>
                    ))
                )}
            </div>
        </GlassCard>
    );
}
