import { duplicateSetlistFromTemplate } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import SetlistShareButton from '@/components/library/SetlistShareButton';
import { SetlistWithSongs } from '@/lib/data';
import { CalendarClock, CopyPlus } from 'lucide-react';

interface SetlistTimelineProps {
    setlists: SetlistWithSongs[];
}

export default function SetlistTimeline({ setlists }: SetlistTimelineProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                        <CalendarClock size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-serif font-bold text-primary">Setlist Queue</h2>
                        <p className="mt-1 text-sm text-primary/50">Upcoming services and their current song order.</p>
                    </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary/45">
                    {setlists.length} planned
                </span>
            </div>

            <div className="space-y-4">
                {setlists.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/10 px-4 py-8 text-center text-sm text-primary/45">
                        No setlists scheduled yet. Plan the next worship service to unlock live session launch.
                    </div>
                ) : (
                    setlists.map((setlist) => {
                        const worshipDateLabel = new Date(setlist.worship_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                        });

                        return (
                            <div
                                key={setlist.id}
                                className="rounded-2xl border border-primary/10 bg-white/60 px-4 py-4"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-primary">{setlist.title}</h3>
                                        <p className="mt-1 text-xs text-primary/45">
                                            {worshipDateLabel}
                                            {setlist.theme ? ` | Theme: ${setlist.theme}` : ''}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/45">
                                        {setlist.songs.length} songs
                                    </span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {setlist.songs.length === 0 ? (
                                        <span className="text-xs text-primary/45">Song order not set yet.</span>
                                    ) : (
                                        setlist.songs.map((song, index) => (
                                            <span
                                                key={song.id}
                                                className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-primary"
                                            >
                                                {index + 1}. {song.title}
                                            </span>
                                        ))
                                    )}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <SetlistShareButton shareText={buildSetlistShareText(setlist, worshipDateLabel)} />
                                    <form action={duplicateSetlistFromTemplate}>
                                        <input type="hidden" name="setlistId" value={setlist.id} />
                                        <button
                                            type="submit"
                                            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-white/70 px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary/20 hover:bg-white"
                                        >
                                            <CopyPlus size={13} />
                                            Duplicate +7d
                                        </button>
                                    </form>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </GlassCard>
    );
}

function buildSetlistShareText(setlist: SetlistWithSongs, worshipDateLabel: string): string {
    const songs = setlist.songs.length > 0
        ? setlist.songs.map((song, index) => `${index + 1}. ${song.title}`).join('\n')
        : 'Song order not set yet.';

    return [
        setlist.title,
        worshipDateLabel,
        setlist.theme ? `Theme: ${setlist.theme}` : null,
        '',
        songs,
    ].filter((line): line is string => line !== null).join('\n');
}
