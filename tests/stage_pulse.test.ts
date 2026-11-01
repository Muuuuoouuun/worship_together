import test from 'node:test';
import assert from 'node:assert/strict';
import {
    contrastRatio,
    DEFAULT_STAGE_ACCENT,
    ensureStageAccentContrast,
    getStageAccentStyle,
    getStageAccentTheme,
    normalizeHexColor,
    STAGE_ACCENT_INK,
    STAGE_ACCENT_PRESETS,
    STAGE_BACKGROUND,
} from '../lib/stageAccent.js';
import {
    buildTempoChart,
    formatStageElapsed,
    getCountInWord,
    isUsableBpm,
} from '../lib/stageTempo.js';

const song = (id: string, bpm: number | null, key: string | null = null) => ({ id, title: id, original_key: key, bpm });

test('normalizeHexColor accepts short and long hex and rejects anything else', () => {
    assert.equal(normalizeHexColor('#f2b880'), '#F2B880');
    assert.equal(normalizeHexColor('abc'), '#AABBCC');
    assert.equal(normalizeHexColor(' #ABC '), '#AABBCC');
    assert.equal(normalizeHexColor('#12345'), null);
    assert.equal(normalizeHexColor('red'), null);
    assert.equal(normalizeHexColor('url(javascript:alert(1))'), null);
    assert.equal(normalizeHexColor(null), null);
});

test('amber is the default accent and every preset is readable on the stage ground', () => {
    assert.equal(DEFAULT_STAGE_ACCENT, '#F2B880');
    for (const preset of STAGE_ACCENT_PRESETS) {
        assert.ok(contrastRatio(preset.hex, STAGE_BACKGROUND) >= 4.5, `${preset.label} contrast`);
        assert.equal(ensureStageAccentContrast(preset.hex), preset.hex, `${preset.label} is used as picked`);
    }
});

test('a too-dark custom accent is lightened until it reaches 4.5:1 on the stage ground', () => {
    const adjusted = ensureStageAccentContrast('#1A0F40');
    assert.notEqual(adjusted, '#1A0F40');
    assert.ok(contrastRatio(adjusted, STAGE_BACKGROUND) >= 4.5);
});

test('accent theme falls back to amber for invalid input and keeps dark ink readable on the accent', () => {
    const theme = getStageAccentTheme('not-a-color');
    assert.equal(theme.accent, DEFAULT_STAGE_ACCENT);
    assert.equal(theme.rgb, '242 184 128');
    assert.equal(theme.ink, STAGE_ACCENT_INK);
    assert.ok(contrastRatio(theme.accent, theme.ink) >= 4.5);

    const style = getStageAccentStyle('#B4A2FF');
    assert.equal(style['--stage-accent'], '#B4A2FF');
    assert.equal(style['--stage-accent-rgb'], '180 162 255');
    assert.match(style['--stage-accent-light'], /^#[0-9A-F]{6}$/);
    assert.match(style['--stage-accent-deep'], /^#[0-9A-F]{6}$/);
});

test('count-in words and BPM guard', () => {
    assert.deepEqual([1, 2, 3, 4].map(getCountInWord), ['하나', '둘', '셋', '넷']);
    assert.equal(getCountInWord(9), '넷');
    assert.equal(isUsableBpm(72), true);
    assert.equal(isUsableBpm(0), false);
    assert.equal(isUsableBpm(null), false);
    assert.equal(isUsableBpm(Number.NaN), false);
});

test('formatStageElapsed shows mm:ss and switches to h:mm:ss after an hour', () => {
    assert.equal(formatStageElapsed(0), '00:00');
    assert.equal(formatStageElapsed(252_000), '04:12');
    assert.equal(formatStageElapsed(3_723_000), '1:02:03');
    assert.equal(formatStageElapsed(-5000), '00:00');
    assert.equal(formatStageElapsed(Number.NaN), '00:00');
});

test('tempo chart plots faster songs higher and marks past, current and upcoming songs', () => {
    const chart = buildTempoChart([song('a', 72, 'D'), song('b', 68, 'G'), song('c', 76, 'A')], 'b');
    const [a, b, c] = chart.points;
    assert.equal(chart.points.length, 3);
    assert.ok(c.y! < a.y! && a.y! < b.y!, '76 above 72 above 68');
    assert.deepEqual(chart.points.map((point) => point.state), ['past', 'current', 'upcoming']);
    assert.ok(a.x < b.x && b.x < c.x);
    assert.match(chart.path, /^M [\d.]+ [\d.]+( C [\d.]+ [\d.]+, [\d.]+ [\d.]+, [\d.]+ [\d.]+){2}$/);
    assert.ok(chart.gridlines.length > 0);
    for (const line of chart.gridlines) {
        assert.ok(line.y > 0 && line.y < chart.height);
    }
});

test('tempo chart keeps songs without a BPM as labels but leaves them off the line', () => {
    const chart = buildTempoChart([song('a', 72), song('b', null), song('c', 80)], 'zzz');
    assert.equal(chart.points[1].y, null);
    assert.equal(chart.points[1].bpm, null);
    assert.equal(chart.points[0].state, 'current', 'unknown current song falls back to the first');
    assert.equal(chart.path.split(' C ').length, 2, 'one curve joins the two plotted songs');

    const empty = buildTempoChart([], null);
    assert.equal(empty.points.length, 0);
    assert.equal(empty.path, '');
});

