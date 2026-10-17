import { pointsToSvgPath, type SheetMark } from '@/lib/sheetAnnotations';

type CachedPath = { points: SheetMark['points']; length: number; ratio: number; d: string };

const pathCache = new WeakMap<SheetMark, CachedPath>();

/**
 * pointsToSvgPath, memoized per mark. A re-render that leaves a mark alone reuses its path
 * instead of rebuilding the curve from every point. The cache entry is dropped when the mark's
 * points array is replaced, grows (a stroke still being drawn) or the page ratio changes.
 */
export function getSheetMarkPath(mark: SheetMark, ratio: number): string {
    const cached = pathCache.get(mark);
    if (cached && cached.points === mark.points && cached.length === mark.points.length && cached.ratio === ratio) {
        return cached.d;
    }
    const d = pointsToSvgPath(mark.points, ratio);
    pathCache.set(mark, { points: mark.points, length: mark.points.length, ratio, d });
    return d;
}
