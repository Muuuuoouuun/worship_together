import { createSetlist } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database } from '@/types/schema';
import { CalendarRange } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SetlistComposerProps {
    songs: Song[];
    disabled?: boolean;
}

export default function SetlistComposer({ songs, disabled = false }: SetlistComposerProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <CalendarRange size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold text-primary">Plan Setlist</h2>
                    <p className="mt-1 text-sm leading-relaxed text-primary/50">
                        Schedule the next worship service and choose which songs should feed the live session.
                    </p>
                </div>
            </div>

            <form action={createSetlist} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">Service Title</span>
                            <Input name="title" placeholder="Sunday Main Service" required />
                        </label>
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">Theme</span>
                            <Input name="theme" placeholder="Grace and Renewal" />
                        </label>
                    </div>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-primary">Worship Date</span>
                        <Input name="worshipDate" type="datetime-local" required />
                    </label>

                    <div className="space-y-2">
                        <div>
                            <p className="text-sm font-semibold text-primary">Song Order</p>
                            <p className="mt-1 text-xs text-primary/45">
                                Select songs in the order they should appear in the service.
                            </p>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-primary/10 bg-background/70 p-3">
                            {songs.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-primary/10 px-4 py-6 text-sm text-primary/45">
                                    Add songs first to build a setlist.
                                </div>
                            ) : (
                                songs.map((song, index) => (
                                    <label
                                        key={song.id}
                                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-primary/10 hover:bg-white/70"
                                    >
                                        <input
                                            type="checkbox"
                                            name="songIds"
                                            value={song.id}
                                            className="mt-1 h-4 w-4 rounded border-primary/20 text-primary focus:ring-primary/20"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-primary">
                                                {index + 1}. {song.title}
                                            </p>
                                            <p className="text-xs text-primary/45">
                                                {[song.artist, song.original_key ? `${song.original_key} key` : null, song.bpm ? `${song.bpm} BPM` : null]
                                                    .filter(Boolean)
                                                    .join(' | ') || 'Metadata pending'}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-full px-6 sm:w-auto" disabled={songs.length === 0}>
                        Save Setlist
                    </Button>
                </fieldset>
            </form>
        </GlassCard>
    );
}
