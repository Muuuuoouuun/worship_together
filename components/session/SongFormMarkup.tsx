import type { MouseEvent, PointerEvent } from 'react';
import {
    isSongFormTint,
    layoutSectionMarker,
    layoutSongFormMarkup,
    songFormMetrics,
    songFormRowHeight,
    splitRepeat,
    type SongFormChipBox,
} from '@/lib/songFormMarkup';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
/** Hidden until hover on mouse/pen devices; always shown while editing on touch screens (no hover). */
const REMOVE_BADGE_CLASS = 'opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100';

type ChipProps = {
    box: SongFormChipBox;
    fontSize?: number;
    tint: boolean;
    /** Section markers get a white rim so a solid chip stays distinct on top of noteheads. */
    rim?: boolean;
    onRemove?: () => void;
};

function Chip({ box, fontSize, tint, rim = false, onRemove }: ChipProps) {
    const m = songFormMetrics(fontSize);
    const { base, repeat } = splitRepeat(box.label);
    return (
        <g className="group">
            <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={9 * m.scale}
                fill={box.color}
                fillOpacity={tint ? 0.26 : 1}
                stroke={tint ? box.color : rim ? '#ffffff' : 'none'}
                strokeWidth={(tint ? 2 : 2.5) * m.scale}
            />
            <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={tint ? box.color : '#ffffff'}
                stroke={tint ? '#ffffff' : undefined}
                strokeWidth={tint ? 4 * m.scale : undefined}
                strokeOpacity={tint ? 0.85 : undefined}
                paintOrder="stroke"
                fontSize={m.fontSize}
                fontWeight="800"
                fontFamily={FONT_FAMILY}
            >
                {base}
                {repeat !== null && (
                    <tspan dx={3 * m.scale} fontSize={m.repeatFontSize} fontWeight="700">
                        ×{repeat}
                    </tspan>
                )}
            </text>
            {onRemove && (
                <g
                    role="button"
                    aria-label={`${box.label} 빼기`}
                    className={`${REMOVE_BADGE_CLASS} cursor-pointer`}
                    onPointerDown={(event: PointerEvent<SVGGElement>) => {
                        // Must not reach the overlay's pointerdown, which would start a drag.
                        event.stopPropagation();
                        event.preventDefault();
                        onRemove();
                    }}
                >
                    <circle cx={box.x + box.width} cy={box.y} r={12 * m.scale} fill="#0f172a" stroke="#ffffff" strokeWidth={2 * m.scale} />
                    <path
                        d={`M ${box.x + box.width - 4.5 * m.scale} ${box.y - 4.5 * m.scale} L ${box.x + box.width + 4.5 * m.scale} ${box.y + 4.5 * m.scale} M ${box.x + box.width + 4.5 * m.scale} ${box.y - 4.5 * m.scale} L ${box.x + box.width - 4.5 * m.scale} ${box.y + 4.5 * m.scale}`}
                        stroke="#ffffff"
                        strokeWidth={2.5 * m.scale}
                        strokeLinecap="round"
                    />
                </g>
            )}
        </g>
    );
}

type BandProps = {
    sections: string[];
    /** Band top-left in mark coordinates (x 0..1000, y 0..1000 of page height). */
    anchor: [number, number];
    ratio: number;
    fontSize?: number;
    opacity?: number;
    className?: string;
    onClick?: (event: MouseEvent<SVGGElement>) => void;
    /** Editing affordance: amber outline while the 송폼 tool is active. */
    selected?: boolean;
    dragging?: boolean;
    /** When set (editing), each chip shows a hover × that removes it. */
    onRemoveChip?: (index: number) => void;
};

/** Renders a 'songform' sheet mark: I → V1 → C … chips on a plate, inside the page's SVG overlay. */
export default function SongFormMarkup({
    sections,
    anchor,
    ratio,
    fontSize,
    opacity,
    className,
    onClick,
    selected = false,
    dragging = false,
    onRemoveChip,
}: BandProps) {
    const m = songFormMetrics(fontSize);
    const tint = isSongFormTint(opacity);
    const { plate, chips, arrows } = layoutSongFormMarkup(sections, [anchor[0], anchor[1] * ratio], fontSize);
    const outlined = selected || dragging;
    return (
        <g className={className} onClick={onClick} opacity={dragging ? 0.75 : 1}>
            <title>{`송폼: ${sections.join(' → ')}`}</title>
            <rect
                x={plate.x}
                y={plate.y}
                width={plate.width}
                height={plate.height}
                rx={14 * m.scale}
                fill="#ffffff"
                fillOpacity={tint ? 0.28 : 0.92}
                stroke={outlined ? '#f59e0b' : '#0f172a'}
                strokeOpacity={outlined ? 1 : tint ? 0 : 0.18}
                strokeWidth={outlined ? 3 : 1.5}
                strokeDasharray={dragging ? '8 6' : undefined}
            />
            {arrows.map((arrow, index) => (
                <path
                    key={`arrow-${index}`}
                    d={`M ${arrow.x - 4 * m.scale} ${arrow.y - 7 * m.scale} L ${arrow.x + 4 * m.scale} ${arrow.y} L ${arrow.x - 4 * m.scale} ${arrow.y + 7 * m.scale}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={3 * m.scale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {chips.map((chip, index) => (
                <Chip
                    key={`chip-${index}`}
                    box={chip}
                    fontSize={fontSize}
                    tint={tint}
                    onRemove={onRemoveChip && !dragging ? () => onRemoveChip(index) : undefined}
                />
            ))}
        </g>
    );
}

type MarkerProps = {
    label: string;
    anchor: [number, number];
    ratio: number;
    fontSize?: number;
    opacity?: number;
    className?: string;
    onClick?: (event: MouseEvent<SVGGElement>) => void;
    selected?: boolean;
    dragging?: boolean;
    onRemove?: () => void;
};

/** Renders a 'section' sheet mark: one section chip placed at the measure where that section starts. */
export function SongFormSectionMarker({
    label,
    anchor,
    ratio,
    fontSize,
    opacity,
    className,
    onClick,
    selected = false,
    dragging = false,
    onRemove,
}: MarkerProps) {
    const box = layoutSectionMarker(label, [anchor[0], anchor[1] * ratio], fontSize);
    const m = songFormMetrics(fontSize);
    return (
        <g className={className} onClick={onClick} opacity={dragging ? 0.75 : 1}>
            <title>{`섹션: ${label}`}</title>
            {(selected || dragging) && (
                <rect
                    x={box.x - 4 * m.scale}
                    y={box.y - 4 * m.scale}
                    width={box.width + 8 * m.scale}
                    height={box.height + 8 * m.scale}
                    rx={12 * m.scale}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray={dragging ? '8 6' : undefined}
                />
            )}
            <Chip box={box} fontSize={fontSize} tint={isSongFormTint(opacity)} rim onRemove={dragging ? undefined : onRemove} />
        </g>
    );
}

const PLACEHOLDER_WIDTH = 430;

/** Dashed target shown while the 송폼 tool is active and the page has no band yet. */
export function SongFormMarkupPlaceholder({ anchor, ratio, fontSize }: { anchor: [number, number]; ratio: number; fontSize?: number }) {
    const height = songFormRowHeight(fontSize);
    const x = Math.min(anchor[0], 988 - PLACEHOLDER_WIDTH);
    const y = anchor[1] * ratio;
    return (
        <g pointerEvents="none">
            <rect
                x={x}
                y={y}
                width={PLACEHOLDER_WIDTH}
                height={height}
                rx="14"
                fill="#fef3c7"
                fillOpacity="0.85"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="8 6"
            />
            <text
                x={x + PLACEHOLDER_WIDTH / 2}
                y={y + height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#b45309"
                fontSize="20"
                fontWeight="700"
                fontFamily={FONT_FAMILY}
            >
                칩을 누르면 여기에 송폼이 얹힙니다
            </text>
        </g>
    );
}
