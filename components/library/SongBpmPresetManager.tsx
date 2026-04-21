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
}

export default function SongBpmPresetManager({
    songs,
    disabled = false,
}: SongBpmPresetManagerProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <AudioLines size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold text-primary">Instrument BPM Presets</h2>
                    <p className="mt-1 text-sm leading-relaxed text-primary/50">
                        Save each song&apos;s blink BPM here. When the live session moves to that song, the preset tempo can auto-apply.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {songs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                        Add songs first, then save their BPM presets here.
                    </div>
                ) : (
                    songs.map((song) => (
                        <form
                            key={song.id}
                            action={updateSongBpmPreset}
                            className="rounded-2xl border border-primary/10 bg-white/60 px-4 py-4"
                        >
                            <fieldset
                                disabled={disabled}
                                className="flex flex-col gap-4 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <input type="hidden" name="songId" value={song.id} />
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-primary">{song.title}</p>
                                    <p className="text-xs text-primary/45">
                                        {song.artist ?? 'Artist pending'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <label className="flex-1 space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary/35">
                                            BPM preset
                                        </span>
                                        <Input
                                            name="bpm"
                                            type="number"
                                            min={1}
                                            placeholder="Leave empty to disable"
                                            defaultValue={song.bpm ?? ''}
                                        />
                                    </label>
                                    <Button type="submit" className="h-10 w-full rounded-full px-5 sm:w-auto">
                                        Save BPM
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
