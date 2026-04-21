import React from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { Database } from '@/types/schema';
import { Music2, Mic2 } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SetlistSummaryProps {
    songs: Song[];
}

const SetlistSummary: React.FC<SetlistSummaryProps> = ({ songs }) => {
    return (
        <div className="w-full max-w-none lg:max-w-md">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-serif font-bold text-primary">
                <Music2 className="text-secondary" />
                Setlist
            </h3>
            <div className="flex flex-col gap-3">
                {songs.map((song, index) => (
                    <GlassCard key={song.id} variant="light" className="group flex cursor-pointer items-center justify-between gap-3 p-4 transition-all hover:bg-white/60">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-black text-primary/10 transition-colors group-hover:text-secondary">
                                {index + 1}
                            </span>
                            <div>
                                <h4 className="font-bold text-primary">{song.title}</h4>
                                <p className="text-xs uppercase tracking-wider text-primary/50">
                                    {[song.original_key ? `${song.original_key} key` : null, song.bpm ? `${song.bpm} BPM` : null]
                                        .filter(Boolean)
                                        .join(' | ') || 'Sheet details pending'}
                                </p>
                            </div>
                        </div>
                        <Mic2 size={18} className="text-primary/20 opacity-0 transition-all group-hover:opacity-100" />
                    </GlassCard>
                ))}
                {songs.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-primary/5 py-8 text-center text-primary/40">
                        No songs added yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SetlistSummary;
