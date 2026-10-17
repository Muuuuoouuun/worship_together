import type { SetlistWithSongs } from '@/lib/data';
import type { SongRow } from '@/types/session';
import { TONE_BLOCK } from '@/components/conti/ui';
import { cn } from '@/lib/utils';
import { Clock3, Repeat2 } from 'lucide-react';

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
        <section className="space-y-4">
            <div>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-semibold tracking-tight text-foreground">선곡 통계</h2>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{setlists.length}개 콘티</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    최근 콘티에서 곡이 얼마나 자주 사용됐는지 확인해 반복 선곡을 조절합니다.
                </p>
            </div>

            {topSongs.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-input px-5 py-10 text-center text-sm text-muted-foreground">
                    콘티에 곡을 추가하면 사용 빈도가 표시됩니다.
                </p>
            ) : (
                <ol className="divide-y divide-border/70">
                    {topSongs.map((insight, index) => (
                        <li key={insight.song.id} className="flex items-center gap-3.5 py-3.5 first:pt-1">
                            <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-medium text-foreground">{insight.song.title}</p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock3 size={12} aria-hidden="true" />
                                    {insight.lastUsedAt
                                        ? `마지막 사용 ${formatUsageDate(insight.lastUsedAt)}`
                                        : '날짜 없음'}
                                </p>
                            </div>
                            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-semibold tabular-nums text-foreground">
                                <Repeat2 size={12} className="text-muted-foreground" aria-hidden="true" />
                                {insight.usageCount}x
                            </span>
                        </li>
                    ))}
                </ol>
            )}

            {restingSongs.length > 0 && (
                <div className={cn('rounded-2xl p-4', TONE_BLOCK.sky)}>
                    <p className="text-[11px] font-medium text-muted-foreground">쉬어가는 곡</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {restingSongs.map((insight) => insight.song.title).join(', ')}
                    </p>
                </div>
            )}
        </section>
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
