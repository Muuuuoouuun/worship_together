import { duplicateSetlistFromTemplate } from '@/actions/libraryActions';
import SetlistShareButton from '@/components/library/SetlistShareButton';
import { buttonVariants } from '@/components/ui/button';
import { SetlistWithSongs } from '@/lib/data';
import { CopyPlus } from 'lucide-react';

interface SetlistTimelineProps {
    setlists: SetlistWithSongs[];
}

export default function SetlistTimeline({ setlists }: SetlistTimelineProps) {
    return (
        <section className="space-y-4">
            <div>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-semibold tracking-tight text-foreground">콘티 타임라인</h2>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{setlists.length}개 예정</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">예정된 예배와 현재 곡 순서를 확인합니다.</p>
            </div>

            {setlists.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-input px-5 py-10 text-center text-sm text-muted-foreground">
                    아직 예정된 콘티가 없습니다. 다음 예배 콘티를 만들면 라이브 세션을 열 수 있습니다.
                </p>
            ) : (
                <ol className="divide-y divide-border/70">
                    {setlists.map((setlist) => {
                        const worshipDate = new Date(setlist.worship_date);
                        const worshipDateLabel = worshipDate.toLocaleString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                        });
                        const weekdayLabel = worshipDate.toLocaleDateString('ko-KR', { weekday: 'short' });

                        return (
                            <li key={setlist.id} className="flex gap-4 py-5 first:pt-1 sm:gap-6">
                                {/* 날짜 칸: 레퍼런스의 주차 카드처럼 월/일을 크게 */}
                                <div className="w-12 shrink-0 pt-0.5 text-center sm:w-14" aria-hidden="true">
                                    <p className="text-[11px] font-medium text-muted-foreground">{weekdayLabel}</p>
                                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                                        {worshipDate.getMonth() + 1}/{worshipDate.getDate()}
                                    </p>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{setlist.title}</h3>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {worshipDateLabel}
                                                {setlist.theme ? ` · 주제: ${setlist.theme}` : ''}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{setlist.songs.length}곡</span>
                                    </div>

                                    {setlist.songs.length === 0 ? (
                                        <p className="mt-3 text-xs text-muted-foreground">아직 곡 순서가 없습니다.</p>
                                    ) : (
                                        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`${setlist.title} 곡 순서`}>
                                            {setlist.songs.map((song, index) => (
                                                <li key={song.id} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-foreground">
                                                    <span className="tabular-nums text-muted-foreground">{index + 1}</span>
                                                    <span className="truncate">{song.title}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}

                                    <div className="mt-4 flex flex-wrap items-start gap-1.5">
                                        <SetlistShareButton shareText={buildSetlistShareText(setlist, worshipDateLabel)} />
                                        <form action={duplicateSetlistFromTemplate}>
                                            <input type="hidden" name="setlistId" value={setlist.id} />
                                            <button type="submit" className={buttonVariants({ variant: 'outline', size: 'xs' })}>
                                                <CopyPlus size={13} aria-hidden="true" />
                                                다음 주 복제
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function buildSetlistShareText(setlist: SetlistWithSongs, worshipDateLabel: string): string {
    const songs = setlist.songs.length > 0
        ? setlist.songs.map((song, index) => `${index + 1}. ${song.title}`).join('\n')
        : '아직 곡 순서가 없습니다.';

    return [
        setlist.title,
        worshipDateLabel,
        setlist.theme ? `주제: ${setlist.theme}` : null,
        '',
        songs,
    ].filter((line): line is string => line !== null).join('\n');
}
