import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clampClickVolume,
    clickAt,
    clickPeakGain,
    clickSchedule,
    countInClickCount,
    DEFAULT_CLICK_VOLUME,
    parseStoredClickVolume,
    takeClicksBefore,
    type ClickRun,
} from '../lib/metronome.js';
import { FALLBACK_COUNT_IN_BPM, getBeatIntervalMs } from '../lib/stageTempo.js';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('60 bpm clicks once a second and 120 bpm twice a second', () => {
    assert.deepEqual(clickSchedule(60, 4, 10, 4).map((click) => click.time), [10, 11, 12, 13]);
    assert.deepEqual(clickSchedule(120, 4, 0, 4).map((click) => click.time), [0, 0.5, 1, 1.5]);
});

test('clicks are placed from the index, so a long run does not drift', () => {
    const late = clickAt(120, 4, 0, 1000);
    near(late.time, 500);
    assert.equal(late.beat, 1);
});

test('beat 1 of every bar is accented and beats are numbered within the bar', () => {
    const clicks = clickSchedule(120, 4, 0, 9);
    assert.deepEqual(clicks.map((click) => click.beat), [1, 2, 3, 4, 1, 2, 3, 4, 1]);
    assert.deepEqual(clicks.filter((click) => click.accent).map((click) => click.time), [0, 2, 4]);
    assert.deepEqual(clicks.filter((click) => !click.accent).map((click) => click.beat), [2, 3, 4, 2, 3, 4]);
});

test('the lookahead queues each click once across successive windows', () => {
    const run: ClickRun = { origin: 0, bpm: 120, beatsPerBar: 4, index: 0, total: Infinity };
    const first = takeClicksBefore(run, 1.2);
    assert.deepEqual(first.map((click) => click.time), [0, 0.5, 1]);
    assert.deepEqual(takeClicksBefore(run, 1.2), []);
    const second = takeClicksBefore(run, 2.1);
    assert.deepEqual(second.map((click) => click.time), [1.5, 2]);
    assert.equal(second[1].accent, true);
    assert.equal(run.index, 5);
});

test('a count-in queues exactly its clicks and then the run is finished', () => {
    const run: ClickRun = { origin: 10, bpm: 60, beatsPerBar: 4, index: 0, total: countInClickCount(4, 1) };
    const clicks = takeClicksBefore(run, 1000);
    assert.deepEqual(clicks.map((click) => click.beat), [1, 2, 3, 4]);
    assert.deepEqual(clicks.map((click) => click.time), [10, 11, 12, 13]);
    assert.equal(run.index >= run.total, true);
    assert.deepEqual(takeClicksBefore(run, 1000), []);
});

test('beats per bar sets the bar length', () => {
    const waltz = clickSchedule(120, 3, 0, 6);
    assert.deepEqual(waltz.map((click) => click.beat), [1, 2, 3, 1, 2, 3]);
    assert.deepEqual(waltz.filter((click) => click.accent).map((click) => click.time), [0, 1.5]);
});

test('a count-in is beatsPerBar times bars clicks and stops there', () => {
    assert.equal(countInClickCount(4, 1), 4);
    assert.equal(countInClickCount(4, 2), 8);
    assert.equal(countInClickCount(3), 3);
    assert.equal(countInClickCount(4, 99), 32);
    assert.equal(clickSchedule(120, 4, 0, countInClickCount(4, 1)).length, 4);
    assert.equal(clickSchedule(120, 4, 0, 0).length, 0);
});

test('an unusable bpm counts at the count-in fallback, as stageTempo does', () => {
    const fallbackInterval = getBeatIntervalMs(FALLBACK_COUNT_IN_BPM) / 1000;
    for (const bpm of [null, undefined, 0, -60, 10, 500, Number.NaN, Number.POSITIVE_INFINITY]) {
        near(clickSchedule(bpm, 4, 0, 2)[1].time, fallbackInterval);
    }
});

test('usable bpm limits come from stageTempo', () => {
    assert.equal(clickSchedule(20, 4, 0, 2)[1].time, 3);
    assert.equal(clickSchedule(300, 4, 0, 2)[1].time, 0.2);
});

test('volume is clamped to 0 to 1 and an unreadable stored value falls back', () => {
    assert.equal(clampClickVolume(1.7), 1);
    assert.equal(clampClickVolume(-1), 0);
    assert.equal(clampClickVolume(Number.NaN), DEFAULT_CLICK_VOLUME);
    assert.equal(parseStoredClickVolume(null), DEFAULT_CLICK_VOLUME);
    assert.equal(parseStoredClickVolume('0.25'), 0.25);
    assert.equal(parseStoredClickVolume('9'), 1);
    assert.equal(parseStoredClickVolume('loud'), DEFAULT_CLICK_VOLUME);
});

test('the downbeat click is louder than the others, and silence stays silent', () => {
    assert.ok(clickPeakGain(1, true) > clickPeakGain(1, false));
    assert.ok(clickPeakGain(1, true) <= 1);
    assert.equal(clickPeakGain(0, true), 0);
    assert.equal(clickPeakGain(0, false), 0);
});
