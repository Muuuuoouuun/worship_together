export const COUNT_IN_BEATS = 4;
/** Used only to pace the count-in when the song has no saved BPM. */
export const FALLBACK_COUNT_IN_BPM = 72;

const COUNT_IN_WORDS = ['하나', '둘', '셋', '넷'] as const;

export function getCountInWord(beat: number): string {
    return COUNT_IN_WORDS[(Math.max(1, Math.min(COUNT_IN_BEATS, Math.round(beat))) - 1)];
}

export function isUsableBpm(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 20 && value <= 300;
}

export function getBeatIntervalMs(bpm: number): number {
    return 60000 / bpm;
}

/** `mm:ss` under an hour, `h:mm:ss` after; negative or invalid input reads as `00:00`. */
export function formatStageElapsed(ms: number): string {
    const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export type TempoPointState = 'past' | 'current' | 'upcoming';

export interface TempoChartSong {
    id: string;
    title: string;
    original_key: string | null;
    bpm: number | null;
}

export interface TempoChartPoint {
    id: string;
    index: number;
    title: string;
    songKey: string | null;
    bpm: number | null;
    x: number;
    /** Null when the song has no saved BPM; such songs are labelled but not plotted. */
    y: number | null;
    state: TempoPointState;
}

export interface TempoChart {
    width: number;
    height: number;
    plotLeft: number;
    points: TempoChartPoint[];
    gridlines: Array<{ bpm: number; y: number }>;
    path: string;
}

export interface TempoChartOptions {
    width?: number;
    height?: number;
    plotLeft?: number;
    plotRight?: number;
    top?: number;
    bottom?: number;
}

/** Lays songs out left-to-right with BPM on the y axis for the setlist tempo chart. */
export function buildTempoChart(
    songs: TempoChartSong[],
    currentSongId: string | null,
    {
        width = 320,
        height = 112,
        plotLeft = 30,
        plotRight = 8,
        top = 12,
        bottom = 12,
    }: TempoChartOptions = {}
): TempoChart {
    const known = songs.map((song) => song.bpm).filter(isUsableBpm);
    const low = known.length ? Math.min(...known) : 60;
    const high = known.length ? Math.max(...known) : 80;
    let min = Math.floor((low - 6) / 10) * 10;
    let max = Math.ceil((high + 6) / 10) * 10;
    if (max - min < 20) {
        const middle = (min + max) / 2;
        min = Math.floor((middle - 10) / 10) * 10;
        max = min + 20;
    }

    const plotWidth = width - plotLeft - plotRight;
    const plotHeight = height - top - bottom;
    const toY = (bpm: number) => +(top + ((max - bpm) / (max - min)) * plotHeight).toFixed(1);
    const step = songs.length > 0 ? plotWidth / songs.length : plotWidth;
    const currentIndex = songs.findIndex((song) => song.id === currentSongId);
    const activeIndex = currentIndex >= 0 ? currentIndex : 0;

    const points = songs.map((song, index): TempoChartPoint => ({
        id: song.id,
        index,
        title: song.title,
        songKey: song.original_key,
        bpm: isUsableBpm(song.bpm) ? song.bpm : null,
        x: +(plotLeft + step * (index + 0.5)).toFixed(1),
        y: isUsableBpm(song.bpm) ? toY(song.bpm) : null,
        state: index < activeIndex ? 'past' : index === activeIndex ? 'current' : 'upcoming',
    }));

    const gridlines: TempoChart['gridlines'] = [];
    const gridStep = max - min > 40 ? 20 : 10;
    for (let bpm = min + gridStep; bpm < max; bpm += gridStep) {
        gridlines.push({ bpm, y: toY(bpm) });
    }

    const plotted = points.filter((point): point is TempoChartPoint & { y: number } => point.y !== null);
    const round = (value: number) => Math.round(value * 10) / 10;
    const path = plotted.reduce((segments, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = plotted[index - 1];
        const handle = (point.x - previous.x) / 2;
        return `${segments} C ${round(previous.x + handle)} ${previous.y}, ${round(point.x - handle)} ${point.y}, ${point.x} ${point.y}`;
    }, '');

    return { width, height, plotLeft, points, gridlines, path };
}
