/** Stage screens draw on this near-black ground; accents must stay readable on it. */
export const STAGE_BACKGROUND = '#070D0C';
/** Dark ink used for text placed on an accent-filled surface. */
export const STAGE_ACCENT_INK = '#0B1211';
export const STAGE_ACCENT_STORAGE_KEY = 'worship-together:stage-accent';

export const STAGE_ACCENT_PRESETS = [
    { id: 'amber', label: '앰버', hex: '#F2B880' },
    { id: 'rose', label: '로즈', hex: '#F09AB9' },
    { id: 'violet', label: '바이올렛', hex: '#B4A2FF' },
    { id: 'sage', label: '세이지', hex: '#8FD1B5' },
] as const;

export const DEFAULT_STAGE_ACCENT: string = STAGE_ACCENT_PRESETS[0].hex;

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const CREAM: Rgb = [255, 247, 232];
const DEEP: Rgb = [20, 10, 6];

/** Accepts `#abc` or `#aabbcc` (case-insensitive) and returns `#AABBCC`, otherwise null. */
export function normalizeHexColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!match) return null;
    const digits = match[1].length === 3
        ? match[1].split('').map((digit) => digit + digit).join('')
        : match[1];
    return `#${digits.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
    const normalized = normalizeHexColor(hex) ?? DEFAULT_STAGE_ACCENT;
    const value = parseInt(normalized.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)) as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
    const [r, g, b] = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: string, second: string): number {
    const a = relativeLuminance(hexToRgb(first));
    const b = relativeLuminance(hexToRgb(second));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * A custom accent can be too dark to read on the stage ground. Lighten it toward white
 * just enough to reach `minRatio`, keeping its hue so the user's choice stays recognizable.
 */
export function ensureStageAccentContrast(hex: string, background = STAGE_BACKGROUND, minRatio = 4.5): string {
    const base = hexToRgb(hex);
    for (let step = 0; step <= 20; step += 1) {
        const candidate = rgbToHex(mixRgb(base, WHITE, step / 20));
        if (contrastRatio(candidate, background) >= minRatio) return candidate;
    }
    return rgbToHex(WHITE);
}

export interface StageAccentTheme {
    accent: string;
    /** Space-separated channels for `rgb(var(--stage-accent-rgb) / <alpha>)`. */
    rgb: string;
    light: string;
    deep: string;
    ink: string;
}

export function getStageAccentTheme(value: unknown): StageAccentTheme {
    const accent = ensureStageAccentContrast(normalizeHexColor(value) ?? DEFAULT_STAGE_ACCENT);
    const rgb = hexToRgb(accent);
    return {
        accent,
        rgb: rgb.join(' '),
        light: rgbToHex(mixRgb(rgb, CREAM, 0.45)),
        deep: rgbToHex(mixRgb(rgb, DEEP, 0.38)),
        ink: contrastRatio(accent, STAGE_ACCENT_INK) >= 4.5 ? STAGE_ACCENT_INK : '#FFFFFF',
    };
}

/** CSS custom properties consumed by the stage screens (`--stage-accent*`). */
export function getStageAccentStyle(value: unknown): Record<`--${string}`, string> {
    const theme = getStageAccentTheme(value);
    return {
        '--stage-accent': theme.accent,
        '--stage-accent-rgb': theme.rgb,
        '--stage-accent-light': theme.light,
        '--stage-accent-deep': theme.deep,
        '--stage-accent-ink': theme.ink,
    };
}
