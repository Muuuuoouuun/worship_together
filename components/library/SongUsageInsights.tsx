import GlassCard from '@/components/ui/GlassCard';
import type { SetlistWithSongs } from '@/lib/data';
import type { SongRow } from '@/types/session';
import { BarChart3, Clock3, Repeat2 } from 'lucide-react';

interface SongUsageInsightsProps {
    setlists: SetlistWithSongs[];
    songs: SongRow[];
}

interface SongUsageInsight {
    lastUsedAt: string | null;
    song: SongRow;
    usageCount: number;
}

export default function SongUsageInsights({ setlists, songs }: SongUsageInsightsProps) {
    const insights = buildSongUsageInsights(songs, setlists);
    const topSongs = insights
        .filter((insight) => insight.usageCount > 0)
        .slice(0, 5);
    const restingSongs = insights
        .filter((insight) => insight.usageCount === 0)
        .slice(0, 3);

    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-serif font-bold text-primary">Song Rotation</h2>
                        <p className="mt-1 text-sm leading-relaxed text-primary/50">
                            Track how often songs appear in planned setlists before the team repeats them too soon.
                        </p>
                    </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                    {setlists.length} plans
                </span>
            </div>

            <div className="space-y-4">
                {topSongs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                        Add songs to setlists to see rotation frequency.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topSongs.map((insight) => (
                            <div
                                key={insight.song.id}
                                className="rounded-2xl border border-primary/10 bg-white/60 px-4 py-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-primary">{insight.song.title}</p>
                                        <p className="mt-1 flex items-center gap-2 text-xs text-primary/45">
                                            <Clock3 size={12} />
                                            {insight.lastUsedAt
                                                ? `Last planned ${formatUsageDate(insight.lastUsedAt)}`
                                                : 'No date found'}
                                        </p>
                                    </div>
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                                        <Repeat2 size={12} />
                                        {insight.usageCount}x
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {restingSongs.length > 0 && (
                    <div className="rounded-2xl border border-primary/10 bg-background/70 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/35">Resting songs</p>
                        <p className="mt-2 text-sm leading-relaxed text-primary/55">
                            {restingSongs.map((insight) => insight.song.title).join(', ')}
                        </p>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}

function buildSongUsageInsights(
    songs: SongRow[],
    setlists: SetlistWithSongs[]
): SongUsageInsight[] {
    const stats = new Map<string, { lastUsedAt: string | null; usageCount: number }>();

    songs.forEach((song) => {
        stats.set(song.id, { lastUsedAt: null, usageCount: 0 });
    });

    setlists.forEach((setlist) => {
        setlist.songs.forEach((song) => {
            const currentStats = stats.get(song.id) ?? { lastUsedAt: null, usageCount: 0 };
            const nextLastUsedAt = resolveLatestDate(currentStats.lastUsedAt, setlist.worship_date);

            stats.set(song.id, {
                lastUsedAt: nextLastUsedAt,
                usageCount: currentStats.usageCount + 1,
            });
        });
    });

    return songs
        .map((song) => {
            const songStats = stats.get(song.id) ?? { lastUsedAt: null, usageCount: 0 };

            return {
                song,
                ...songStats,
            };
        })
        .sort((left, right) => {
            if (right.usageCount !== left.usageCount) {
                return right.usageCount - left.usageCount;
            }

            return right.song.updated_at.localeCompare(left.song.updated_at);
        });
}

function resolveLatestDate(currentDate: string | null, candidateDate: string): string {
    if (!currentDate) {
        return candidateDate;
    }

    return new Date(candidateDate).getTime() > new Date(currentDate).getTime()
        ? candidateDate
        : currentDate;
}

function formatUsageDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(new Date(value));
}
