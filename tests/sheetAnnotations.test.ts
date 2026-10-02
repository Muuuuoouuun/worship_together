import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateSheet,
    pointsToSvgPath,
    distanceToSegment,
    isPointNearMark,
    createSampleSheetDocument,
    type SheetDocument,
    type SheetMark,
} from '../lib/sheetAnnotations';

test('validateSheet validates legacy v1 document correctly', () => {
    const legacyDoc: SheetDocument = {
        version: 1,
        title: '은혜로다',
        updatedAt: new Date().toISOString(),
        pages: [
            {
                image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
                width: 1200,
                height: 1600,
                marks: [
                    {
                        id: 'mark-1',
                        kind: 'pen',
                        color: '#dc2626',
                        points: [[100, 100], [105, 105]],
                    },
                    {
                        id: 'mark-2',
                        kind: 'stamp',
                        color: '#2563eb',
                        points: [[200, 200]],
                        text: '한 번 더',
                    },
                ],
            },
        ],
    };

    const validated = validateSheet(legacyDoc);
    assert.equal(validated.title, '은혜로다');
    assert.equal(validated.pages[0].marks.length, 2);
});

test('validateSheet accepts highlighter marks and extended worship stamps', () => {
    const extendedDoc = {
        version: 1,
        title: '주 은혜임을',
        updatedAt: new Date().toISOString(),
        pages: [
            {
                image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                width: 1000,
                height: 1414,
                marks: [
                    {
                        id: 'mark-hl',
                        kind: 'highlighter',
                        color: 'rgba(250, 204, 21, 0.45)',
                        strokeWidth: 16,
                        opacity: 0.45,
                        points: [[50, 50], [500, 50]],
                    },
                    {
                        id: 'mark-stamp-worship',
                        kind: 'stamp',
                        color: '#eab308',
                        points: [[300, 400]],
                        text: '기도 반주',
                    },
                ],
            },
        ],
    };

    const validated = validateSheet(extendedDoc);
    assert.equal(validated.pages[0].marks[0].kind, 'highlighter');
    assert.equal(validated.pages[0].marks[1].text, '기도 반주');
});

test('validateSheet rejects invalid inputs', () => {
    assert.throws(() => validateSheet(null), /악보 파일 형식이 올바르지 않습니다/);
    assert.throws(() => validateSheet({ version: 2 }), /1~20페이지/);
    assert.throws(
        () =>
            validateSheet({
                version: 1,
                title: 'Invalid',
                updatedAt: new Date().toISOString(),
                pages: [
                    {
                        image: 'data:image/jpeg;base64,123',
                        width: 100,
                        height: 100,
                        marks: [
                            {
                                id: 'bad-kind',
                                kind: 'unknown_kind',
                                color: '#dc2626',
                                points: [[0, 0]],
                            },
                        ],
                    },
                ],
            }),
    );
});

test('pointsToSvgPath generates smooth Bézier curve strings', () => {
    assert.equal(pointsToSvgPath([], 1.4), '');
    assert.equal(pointsToSvgPath([[100, 100]], 1.4), 'M 100.00 140.00 l 0.1 0.1');
    assert.equal(pointsToSvgPath([[100, 100], [200, 200]], 1.0), 'M 100.00 100.00 L 200.00 200.00');
    assert.equal(pointsToSvgPath([[0, 0], [50, 100], [100, 0]], 1.0), 'M 0.00 0.00 Q 50.00 100.00, 100.00 0.00');
    const multiPath = pointsToSvgPath([[0, 0], [20, 20], [40, 20], [60, 0]], 1.0);
    assert.ok(multiPath.includes('Q 20.00 20.00, 30.00 20.00'));
    assert.ok(multiPath.endsWith('L 60.00 0.00'));
});

test('distanceToSegment computes exact perpendicular and endpoint distances', () => {
    // Perpendicular hit on segment (100, 100) -> (300, 100) at (200, 110)
    const dist = distanceToSegment(200, 110, 100, 100, 300, 100);
    assert.equal(Math.round(dist), 10);

    // Endpoint A
    const distA = distanceToSegment(90, 100, 100, 100, 300, 100);
    assert.equal(Math.round(distA), 10);

    // Endpoint B
    const distB = distanceToSegment(310, 100, 100, 100, 300, 100);
    assert.equal(Math.round(distB), 10);
});

test('isPointNearMark accurately detects hits on line segments and stamps', () => {
    const penMark: SheetMark = {
        id: 'pen-1',
        kind: 'pen',
        color: '#dc2626',
        points: [[100, 100], [300, 100]],
        strokeWidth: 3,
    };

    // Click in the middle of segment (200, 105), ratio 1.0
    assert.equal(isPointNearMark(200, 105, penMark, 1.0), true);

    // Far from segment (200, 200)
    assert.equal(isPointNearMark(200, 200, penMark, 1.0), false);

    // Stamp mark hit check
    const stampMark: SheetMark = {
        id: 'stamp-1',
        kind: 'stamp',
        color: '#2563eb',
        points: [[200, 200]],
        text: '후렴 반복',
    };
    assert.equal(isPointNearMark(210, 205, stampMark, 1.0), true);
    assert.equal(isPointNearMark(600, 600, stampMark, 1.0), false);
});

test('createSampleSheetDocument produces a valid 2-page document with sample markings', () => {
    const doc = createSampleSheetDocument('은혜로다');
    assert.equal(doc.version, 1);
    assert.equal(doc.title, '은혜로다');
    assert.equal(doc.pages.length, 2);
    assert.ok(doc.pages[0].marks.length >= 2);
    const validated = validateSheet(doc);
    assert.equal(validated.pages.length, 2);
});

test('validateSheet and isPointNearMark accept text and rect marks', () => {
    const textMark: SheetMark = {
        id: 'text-1',
        kind: 'text',
        color: '#15803d',
        points: [[150, 150]],
        text: 'Capo 2 (Key D)',
        fontSize: 20,
    };

    const rectMark: SheetMark = {
        id: 'rect-1',
        kind: 'rect',
        color: '#2563eb',
        points: [[100, 100], [400, 300]],
        strokeWidth: 3,
        opacity: 0.2,
    };

    const doc: SheetDocument = {
        version: 1,
        title: '신규 마크업 테스트',
        updatedAt: new Date().toISOString(),
        pages: [
            {
                image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                width: 1000,
                height: 1400,
                marks: [textMark, rectMark],
            },
        ],
    };

    const validated = validateSheet(doc);
    assert.equal(validated.pages[0].marks.length, 2);
    assert.equal(validated.pages[0].marks[0].kind, 'text');
    assert.equal(validated.pages[0].marks[1].kind, 'rect');

    // Test hit detection for text
    assert.equal(isPointNearMark(160, 145, textMark, 1.4), true);
    assert.equal(isPointNearMark(600, 600, textMark, 1.4), false);

    // Test hit detection for rect
    assert.equal(isPointNearMark(200, 180, rectMark, 1.4), true); // Inside rect
    assert.equal(isPointNearMark(800, 800, rectMark, 1.4), false); // Outside rect
});



