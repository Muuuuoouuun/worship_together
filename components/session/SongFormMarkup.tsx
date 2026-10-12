import type { MouseEvent } from 'react';
import {
    layoutSongFormMarkup,
    splitRepeat,
    SONG_FORM_CHIP_FONT_SIZE,
    SONG_FORM_REPEAT_FONT_SIZE,
    SONG_FORM_ROW_HEIGHT,
} from '@/lib/songFormMarkup';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';

type Props = {
    sections: string[];
    /** Band top-left in mark coordinates (x 0..1000, y 0..1000 of page height). */
    anchor: [number, number];
    ratio: number;
    className?: string;
    onClick?: (event: MouseEvent<SVGGElement>) => void;
    /** Editing affordance: amber outline while the 송폼 tool is active. */
    selected?: boolean;
    dragging?: boolean;
};

/** Renders a 'songform' sheet mark: I → V1 → C … chips on a light plate, inside the page's SVG overlay. */
export default function SongFormMarkup({ sections, anchor, ratio, className, onClick, selected = false, dragging = false }: Props) {
    const { plate, chips, arrows } = layoutSongFormMarkup(sections, [anchor[0], anchor[1] * ratio]);
    const outlined = selected || dragging;
    return (
        <g className={className} onClick={onClick} opacity={dragging ? 0.75 : 1}>
            <title>{`송폼: ${sections.join(' → ')}`}</title>
            <rect
                x={plate.x}
                y={plate.y}
                width={plate.width}
                height={plate.height}
                rx="14"
                fill="#ffffff"
                fillOpacity="0.92"
                stroke={outlined ? '#f59e0b' : '#0f172a'}
                strokeOpacity={outlined ? 1 : 0.18}
                strokeWidth={outlined ? 3 : 1.5}
                strokeDasharray={dragging ? '8 6' : undefined}
            />
            {arrows.map((arrow, index) => (
                <path
                    key={`arrow-${index}`}
                    d={`M ${arrow.x - 4} ${arrow.y - 7} L ${arrow.x + 4} ${arrow.y} L ${arrow.x - 4} ${arrow.y + 7}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {chips.map((chip, index) => {
                const { base, repeat } = splitRepeat(chip.label);
                return (
                    <g key={`chip-${index}`}>
                        <rect x={chip.x} y={chip.y} width={chip.width} height={chip.height} rx="9" fill={chip.color} />
                        <text
                            x={chip.x + chip.width / 2}
                            y={chip.y + chip.height / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#ffffff"
                            fontSize={SONG_FORM_CHIP_FONT_SIZE}
                            fontWeight="800"
                            fontFamily={FONT_FAMILY}
                        >
                            {base}
                            {repeat !== null && (
                                <tspan dx="3" fontSize={SONG_FORM_REPEAT_FONT_SIZE} fontWeight="700">
                                    ×{repeat}
                                </tspan>
                            )}
                        </text>
                    </g>
                );
            })}
        </g>
    );
}

/** Dashed target shown while the 송폼 tool is active and the page has no band yet. */
const PLACEHOLDER_WIDTH = 430;

export function SongFormMarkupPlaceholder({ anchor, ratio }: { anchor: [number, number]; ratio: number }) {
    const x = Math.min(anchor[0], 988 - PLACEHOLDER_WIDTH);
    const y = anchor[1] * ratio;
    return (
        <g pointerEvents="none">
            <rect
                x={x}
                y={y}
                width={PLACEHOLDER_WIDTH}
                height={SONG_FORM_ROW_HEIGHT}
                rx="14"
                fill="#fef3c7"
                fillOpacity="0.85"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="8 6"
            />
            <text
                x={x + PLACEHOLDER_WIDTH / 2}
                y={y + SONG_FORM_ROW_HEIGHT / 2}
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
