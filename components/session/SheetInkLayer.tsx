'use client';

import { memo, type MouseEvent } from 'react';
import { lineMarkPath, pointsToSvgPath, type SheetMark } from '@/lib/sheetAnnotations';
import { markPart, PART_BADGES } from '@/lib/markParts';

/** Hand-drawn marks in their layer order; song form markup is drawn by the caller on top. */
const INK_ORDER: ReadonlyArray<SheetMark['kind']> = ['highlighter', 'rect', 'pen', 'line', 'stamp', 'text'];
const ERASABLE_CLASS = 'cursor-pointer hover:opacity-40 transition';

type MarkProps = {
    mark: SheetMark;
    ratio: number;
    /** Stage dark mode (the page is inverted): labels and highlighters switch to colors that survive it. */
    dark: boolean;
    erasable: boolean;
    onErase?: (id: string) => void;
};

/**
 * One committed mark. Memoized on the mark object, which edits never mutate, so drawing a new stroke
 * re-renders nothing that is already on the page.
 */
const InkMark = memo(function InkMark({ mark, ratio, dark, erasable, onErase }: MarkProps) {
    const point = mark.points[0] ?? [0, 0];
    const interactive = erasable
        ? {
              className: ERASABLE_CLASS,
              onClick: (event: MouseEvent<SVGElement>) => {
                  event.stopPropagation();
                  onErase?.(mark.id);
              },
          }
        : {};

    switch (mark.kind) {
        case 'highlighter':
            return (
                <path
                    d={pointsToSvgPath(mark.points, ratio)}
                    fill="none"
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 16}
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    style={{ mixBlendMode: dark ? 'screen' : 'multiply', opacity: mark.opacity ?? 0.45 }}
                    {...interactive}
                />
            );
        case 'rect': {
            if (mark.points.length < 2) return null;
            const [p1, p2] = mark.points;
            const x = Math.min(p1[0], p2[0]);
            const y = Math.min(p1[1], p2[1]) * ratio;
            const width = Math.abs(p2[0] - p1[0]);
            const height = Math.abs(p2[1] - p1[1]) * ratio;
            return mark.shape === 'ellipse' ? (
                <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill="none" stroke={mark.color} strokeWidth={mark.strokeWidth || 3} {...interactive} />
            ) : (
                <rect x={x} y={y} width={width} height={height} fill={mark.color} fillOpacity={mark.opacity ?? 0.15} stroke={mark.color} strokeWidth={mark.strokeWidth || 3} rx="6" {...interactive} />
            );
        }
        case 'line':
            return (
                <path
                    d={lineMarkPath(mark, ratio)}
                    fill="none"
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...interactive}
                />
            );
        case 'stamp':
            return (
                <text
                    x={Math.min(point[0], 780)}
                    y={Math.max(point[1] * ratio, 25)}
                    fill={mark.color}
                    fontSize="25"
                    fontWeight="800"
                    stroke={dark ? '#000' : '#fff'}
                    strokeWidth="3"
                    paintOrder="stroke"
                    {...interactive}
                >
                    {mark.text}
                </text>
            );
        case 'text': {
            const size = mark.fontSize ?? 20;
            return (
                <g {...interactive}>
                    <rect
                        x={Math.min(point[0], 900) - 4}
                        y={Math.max(point[1] * ratio, 20) - size}
                        width={(mark.text?.length ?? 3) * (size * 0.65) + 8}
                        height={size + 6}
                        rx="4"
                        fill={dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'}
                    />
                    <text x={Math.min(point[0], 900)} y={Math.max(point[1] * ratio, 20) - 2} fill={dark ? '#000' : mark.color} fontSize={size} fontWeight="800" fontFamily="monospace, sans-serif">
                        {mark.text}
                    </text>
                </g>
            );
        }
        case 'pen':
            return (
                <path
                    d={pointsToSvgPath(mark.points, ratio)}
                    fill="none"
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...interactive}
                />
            );
        default:
            return null;
    }
});

const BADGE_WIDTH = 18;
const BADGE_HEIGHT = 14;

/** Top-left corner of a mark as drawn above, where its part badge hangs off. */
function badgeCorner(mark: SheetMark, ratio: number): [number, number] {
    const [x, y] = mark.points[0] ?? [0, 0];
    switch (mark.kind) {
        case 'stamp':
            return [Math.min(x, 780), Math.max(y * ratio, 25) - 25];
        case 'text':
            return [Math.min(x, 900) - 4, Math.max(y * ratio, 20) - (mark.fontSize ?? 20)];
        case 'rect': {
            const q = mark.points[1];
            return q ? [Math.min(x, q[0]), Math.min(y, q[1]) * ratio] : [x, y * ratio];
        }
        default:
            return [x, y * ratio];
    }
}

/** A tiny tag on a mark that is for one part only, so the leader can tell whose notes are whose. */
const PartBadge = memo(function PartBadge({ mark, ratio }: { mark: SheetMark; ratio: number }) {
    const part = markPart(mark);
    if (!part) return null;
    const [cornerX, cornerY] = badgeCorner(mark, ratio);
    const x = Math.max(0, Math.min(cornerX, 1000 - BADGE_WIDTH));
    const y = Math.max(0, cornerY - BADGE_HEIGHT);
    const { short, color } = PART_BADGES[part];
    return (
        <g data-part={part} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} pointerEvents="none">
            <rect width={BADGE_WIDTH} height={BADGE_HEIGHT} rx="4" fill={color} fillOpacity="0.88" />
            <text x={BADGE_WIDTH / 2} y={BADGE_HEIGHT / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="10" fontWeight="800">
                {short}
            </text>
        </g>
    );
});

type LayerProps = {
    marks: readonly SheetMark[];
    ratio: number;
    dark?: boolean;
    /** Workspace: tag marks that are for one part with a small badge. */
    partBadges?: boolean;
    /** Eraser tool: marks fade on hover and a click removes them. */
    erasable?: boolean;
    /** Keep this stable (useCallback) so the layer stays memoized. */
    onErase?: (id: string) => void;
};

/** The page's hand-drawn marks (pen, highlighter, boxes, lines, stamps, text) inside the page SVG. */
function SheetInkLayer({ marks, ratio, dark = false, partBadges = false, erasable = false, onErase }: LayerProps) {
    return (
        <>
            {INK_ORDER.flatMap((kind) =>
                marks
                    .filter((mark) => mark.kind === kind)
                    .map((mark) => <InkMark key={mark.id} mark={mark} ratio={ratio} dark={dark} erasable={erasable} onErase={onErase} />)
            )}
            {partBadges ? marks.map((mark) => (markPart(mark) ? <PartBadge key={`${mark.id}:part`} mark={mark} ratio={ratio} /> : null)) : null}
        </>
    );
}

export default memo(SheetInkLayer);
