import React from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Database } from '@/types/schema';
import { Music2, Mic2 } from 'lucide-react';

type Song = Database['public']['Tables']['songs']['Row'];

interface SetlistSummaryProps {
    songs: Song[];
}

const SetlistSummary: React.FC<SetlistSummaryProps> = ({ songs }) => {
    return (
        <div className="w-full max-w-none lg:max-w-md">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-serif font-bold text-foreground">
                <Music2 className="text-secondary" size={20} />
                <span>선곡 리스트</span>
                <span className="text-xs font-normal text-muted-foreground">({songs.length}곡)</span>
            </h3>
            <div className="flex flex-col gap-2.5">
                {songs.map((song, index) => (
                    <GlassCard
                        key={song.id}
                        className="group flex cursor-pointer items-center justify-between gap-3 p-3.5 transition-all hover:border-primary/40 hover:bg-muted/40"
                    >
                        <div className="flex items-center gap-3.5">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                {index + 1}
                            </span>
                            <div>
                                <h4 className="text-sm font-bold text-foreground">{song.title}</h4>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                    {song.original_key && (
                                        <Badge variant="outline" size="sm">
                                            {song.original_key} Key
                                        </Badge>
                                    )}
                                    {song.bpm && (
                                        <span className="text-[11px] text-muted-foreground font-medium">
                                            {song.bpm} BPM
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Mic2 size={16} className="text-muted-foreground/40 transition-colors group-hover:text-secondary" />
                    </GlassCard>
                ))}
                {songs.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
                        등록된 곡이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SetlistSummary;
