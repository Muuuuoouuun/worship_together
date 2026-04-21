import GlassCard from '@/components/ui/GlassCard';
import { Database } from '@/types/schema';
import { LibraryBig } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SongLibraryListProps {
    songs: Song[];
}

export default function SongLibraryList({ songs }: SongLibraryListProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                        <LibraryBig size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-serif font-bold text-primary">Song Library</h2>
                        <p className="mt-1 text-sm text-primary/50">Your team&apos;s reusable worship catalog.</p>
                    </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                    {songs.length} songs
                </span>
            </div>

            <div className="space-y-3">
                {songs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                        No songs yet. Add your first song to start building setlists.
                    </div>
                ) : (
                    songs.map((song) => (
                        <div
                            key={song.id}
                            className="rounded-2xl border border-primary/10 bg-white/60 px-4 py-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary">{song.title}</h3>
                                    <p className="mt-1 text-xs text-primary/45">
                                        {[song.artist, song.original_key ? `${song.original_key} key` : null, song.bpm ? `${song.bpm} BPM` : null]
                                            .filter(Boolean)
                                            .join(' | ') || 'Metadata pending'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {song.music_xml_url && (
                                        <span className="rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                                            XML URL
                                        </span>
                                    )}
                                    {song.data_xml && (
                                        <span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/45">
                                            Inline XML
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </GlassCard>
    );
}
