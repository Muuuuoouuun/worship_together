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
                        <h2 className="text-xl font-serif font-bold text-primary">선곡 통계</h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            최근 콘티에서 곡이 얼마나 자주 사용됐는지 확인해 반복 선곡을 조절합니다.
                        </p>
                    </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {setlists.length}개 콘티
                </span>
            </div>

            <div className="space-y-4">
                {topSongs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-muted-foreground">
                        콘티에 곡을 추가하면 사용 빈도가 표시됩니다.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topSongs.map((insight) => (
                            <div
                                key={insight.song.id}
                                className="rounded-2xl border border-primary/10 bg-card px-4 py-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-primary">{insight.song.title}</p>
                                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock3 size={12} />
                                            {insight.lastUsedAt
                                                ? `마지막 사용 ${formatUsageDate(insight.lastUsedAt)}`
                                                : '날짜 없음'}
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
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">쉬어가는 곡</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
    return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
    }).format(new Date(value));
}
