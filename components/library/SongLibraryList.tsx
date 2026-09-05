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
                        <h2 className="text-xl font-serif font-bold text-primary">악보 라이브러리</h2>
                        <p className="mt-1 text-sm text-muted-foreground">팀이 반복해서 쓰는 예배곡 카탈로그입니다.</p>
                    </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {songs.length}곡
                </span>
            </div>

            <div className="space-y-3">
                {songs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-muted-foreground">
                        아직 곡이 없습니다. 첫 곡을 추가해 콘티를 만들어보세요.
                    </div>
                ) : (
                    songs.map((song) => (
                        <div
                            key={song.id}
                            className="rounded-2xl border border-primary/10 bg-card px-4 py-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary">{song.title}</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {[song.artist, song.original_key ? `${song.original_key} 키` : null, song.bpm ? `${song.bpm} BPM` : null]
                                            .filter(Boolean)
                                            .join(' | ') || '메타데이터 대기'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {song.music_xml_url && (
                                        <span className="rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                                            XML URL
                                        </span>
                                    )}
                                    {song.data_xml && (
                                        <span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
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
