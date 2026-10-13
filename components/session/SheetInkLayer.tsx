'use client';

import { memo, type MouseEvent } from 'react';
import { lineMarkPath, pointsToSvgPath, type SheetMark } from '@/lib/sheetAnnotations';

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

type LayerProps = {
    marks: readonly SheetMark[];
    ratio: number;
    dark?: boolean;
    /** Eraser tool: marks fade on hover and a click removes them. */
    erasable?: boolean;
    /** Keep this stable (useCallback) so the layer stays memoized. */
    onErase?: (id: string) => void;
};

/** The page's hand-drawn marks (pen, highlighter, boxes, lines, stamps, text) inside the page SVG. */
function SheetInkLayer({ marks, ratio, dark = false, erasable = false, onErase }: LayerProps) {
    return (
        <>
            {INK_ORDER.flatMap((kind) =>
                marks
                    .filter((mark) => mark.kind === kind)
                    .map((mark) => <InkMark key={mark.id} mark={mark} ratio={ratio} dark={dark} erasable={erasable} onErase={onErase} />)
            )}
        </>
    );
}

export default memo(SheetInkLayer);
