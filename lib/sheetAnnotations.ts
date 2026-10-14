import { isValidSongFormSections, layoutSectionMarker, layoutSongFormMarkup, SONG_FORM_MAX_ANCHOR_X } from './songFormMarkup';
import { isLeadSheetKey, LEAD_SHEETS, SAMPLE_LEAD_SHEET, transposeLeadSheet, type LeadSheetKey } from './leadSheet';
import { renderLeadSheetPages } from './leadSheetRender';
import { isChartSettings, type ChartSettings } from './chordChart';
import { updateChordChart } from './chordChartSheet';
import { isSheetPart, type SheetPart } from './markParts';

export type { SheetPart };

/**
 * 'songform' = song form band (I → V1 → C …); 'section' = one section chip placed at a measure (text = label);
 * 'line' = a straight stroke between two points, drawn as a line, an arrow or a hairpin.
 */
export type SheetMarkKind = 'pen' | 'highlighter' | 'stamp' | 'text' | 'rect' | 'line' | 'songform' | 'section';
/** kind 'line': line | arrow | cresc (<) | decresc (>). kind 'rect': ellipse (outline circle); a box when unset. */
export type SheetMarkShape = 'line' | 'arrow' | 'cresc' | 'decresc' | 'ellipse';
export const LINE_SHAPES: ReadonlyArray<SheetMarkShape> = ['line', 'arrow', 'cresc', 'decresc'];

export type SheetMark = {
    id: string;
    kind: SheetMarkKind;
    color: string;
    points: Array<[number, number]>;
    text?: string;
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    /** kind 'songform' only: ordered chip labels, e.g. ['I', 'V1', 'C×2']. */
    sections?: string[];
    shape?: SheetMarkShape;
    /** Who the mark is for; unset means everyone (모두). Song form marks ('songform', 'section') ignore it. */
    part?: SheetPart;
};

export type SheetPage = {
    image: string;
    width: number;
    height: number;
    marks: SheetMark[];
    /** Set on pages the app engraved itself: which page of `SheetDocument.score` this is, so a key change can redraw it. */
    scorePage?: number;
    /** Set on chord chart pages: which page of the chart in `SheetDocument.chart` this is, so edits to the chart redraw it. */
    chartPage?: number;
};
export type SheetDocument = {
    version: 1;
    title: string;
    pages: SheetPage[];
    updatedAt: string;
    /** A sheet the app engraves from data (the sample), and the key it is drawn in. */
    score?: { id: string; key: LeadSheetKey };
    /** A chord chart (코드 악보) the app draws from text: its pages carry `chartPage`, and key, capo and view changes redraw them. */
    chart?: ChartSettings;
};

export const SHEET_COLORS = ['#dc2626', '#2563eb', '#15803d', '#111827', '#eab308', '#9333ea'];
export const HIGHLIGHTER_COLORS = [
    'rgba(250, 204, 21, 0.45)',
    'rgba(74, 222, 128, 0.45)',
    'rgba(96, 165, 250, 0.45)',
    'rgba(244, 114, 182, 0.45)',
];
/** Stamps grouped the way a team reads a chart: the road through it, the band's dynamics, who sings. */
export const WORSHIP_STAMP_GROUPS: ReadonlyArray<{ name: string; stamps: readonly string[] }> = [
    { name: '진행', stamps: ['한 번 더', '후렴 반복', '×2', '×3', '마지막만', '브릿지', '엔딩', '멘트', '여기서 끝'] },
    {
        name: '악보 기호',
        stamps: ['‖: 반복', '반복 :‖', '┌ 1.', '┌ 2.', 'D.S. al Coda', 'D.C. al Fine', 'To Coda 𝄌', 'Coda 𝄌', 'Segno 𝄋', 'Fermata 𝄐', 'Fine', 'rit.'],
    },
    {
        name: '밴드·셈여림',
        stamps: ['작게 (p)', '크게 (f)', 'Build Up 📈', 'Drum In 🥁', 'All Out 🔥', 'Break 🔇', '다 같이 Stop', '피아노만', '아카펠라', '키 업 (전조)', '기도 반주', '자유 찬양'],
    },
    { name: '보컬', stamps: ['다 같이', '남성', '여성', '인도자 솔로', '화음', '회중만'] },
];
export const WORSHIP_STAMP_PRESETS: readonly string[] = WORSHIP_STAMP_GROUPS.flatMap((group) => group.stamps);

export const sheetKey = (teamId: string, songId: string, shared = false) => `${teamId}:${songId}:${shared ? 'published' : 'draft'}`;

/**
 * v2 keeps page images in their own store, so saving a stroke writes the marks (a few KB) instead of
 * every page image again (several MB). v1 records, with images inline, still load and convert on next save.
 */
function openSheetDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('worship-together-sheets-v1', 2);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sheets')) db.createObjectStore('sheets');
            if (!db.objectStoreNames.contains('pageImages')) db.createObjectStore('pageImages');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** A page as stored in v2: the image lives in 'pageImages' under `imageId`. v1 pages carry `image` inline. */
export type StoredSheetPage = Omit<SheetPage, 'image'> & { image?: string; imageId?: string };
export type StoredSheetDocument = Omit<SheetDocument, 'pages'> & { pages: StoredSheetPage[] };

/**
 * Image data URL → its id in 'pageImages', for images known to be on disk. Edits keep the same string
 * objects and V8 caches a string's hash, so a lookup doesn't rescan the image.
 */
const storedImageIds = new Map<string, string>();

/** Splits a document into its stored form; images without an id yet come back in `newImages` ([id, data]). */
export function splitSheetForStorage(
    doc: SheetDocument,
    idFor: (image: string) => string | undefined,
    makeId: () => string
): { stored: StoredSheetDocument; newImages: Array<[string, string]> } {
    const newImages: Array<[string, string]> = [];
    const pending = new Map<string, string>();
    const pages = doc.pages.map(({ image, ...rest }) => {
        let imageId = idFor(image) ?? pending.get(image);
        if (!imageId) {
            imageId = makeId();
            pending.set(image, imageId);
            newImages.push([imageId, image]);
        }
        return { ...rest, imageId };
    });
    return { stored: { ...doc, pages }, newImages };
}

/** Puts a stored document back together; a missing image fails loudly instead of loading a blank page. */
export function assembleStoredSheet(stored: StoredSheetDocument, images: ReadonlyMap<string, string>): SheetDocument {
    return {
        ...stored,
        pages: stored.pages.map(({ imageId, image, ...rest }) => {
            const data = image ?? (imageId ? images.get(imageId) : undefined);
            if (!data) throw new Error('악보 이미지 일부를 찾지 못했습니다. 공유 파일로 다시 불러와주세요.');
            return { ...rest, image: data };
        }),
    };
}

const newImageId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function readSheet(key: string): Promise<SheetDocument | null> {
    const db = await openSheetDatabase();
    try {
        const { stored, images } = await new Promise<{ stored: StoredSheetDocument | undefined; images: Map<string, string> }>((resolve, reject) => {
            const transaction = db.transaction(['sheets', 'pageImages']);
            const images = new Map<string, string>();
            let stored: StoredSheetDocument | undefined;
            const get = transaction.objectStore('sheets').get(key);
            get.onsuccess = () => {
                stored = get.result as StoredSheetDocument | undefined;
                for (const id of new Set((stored?.pages ?? []).map((p) => p.imageId).filter((v): v is string => Boolean(v)))) {
                    const image = transaction.objectStore('pageImages').get(id);
                    image.onsuccess = () => {
                        if (typeof image.result === 'string') images.set(id, image.result);
                    };
                }
            };
            transaction.oncomplete = () => resolve({ stored, images });
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
        if (!stored) return null;
        const doc = validateSheet(assembleStoredSheet(stored, images));
        for (const [id, data] of images) storedImageIds.set(data, id);
        return doc;
    } finally { db.close(); }
}

export async function saveSheet(key: string, document: SheetDocument): Promise<void> {
    const db = await openSheetDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['sheets', 'pageImages'], 'readwrite');
            const sheets = transaction.objectStore('sheets');
            const pageImages = transaction.objectStore('pageImages');
            let newImages: Array<[string, string]> = [];
            const previous = sheets.get(key);
            // Runs once earlier saves have committed, so the id map matches what is on disk.
            previous.onsuccess = () => {
                const split = splitSheetForStorage(document, (image) => storedImageIds.get(image), newImageId);
                newImages = split.newImages;
                for (const [id, data] of newImages) pageImages.put(data, id);
                sheets.put(split.stored, key);
                const keep = new Set(split.stored.pages.map((p) => p.imageId));
                const dropped = ((previous.result as StoredSheetDocument | undefined)?.pages ?? [])
                    .map((p) => p.imageId)
                    .filter((id): id is string => Boolean(id) && !keep.has(id));
                if (!dropped.length) return;
                // Delete images no saved sheet points at any more (the draft and the team copy share them).
                const all = sheets.getAll();
                all.onsuccess = () => {
                    const used = new Set((all.result as StoredSheetDocument[]).flatMap((doc) => (doc.pages ?? []).map((p) => p.imageId)));
                    for (const id of dropped) {
                        if (used.has(id)) continue;
                        pageImages.delete(id);
                        for (const [data, known] of storedImageIds) if (known === id) storedImageIds.delete(data);
                    }
                };
            };
            transaction.oncomplete = () => {
                // Only images now on disk may be referenced by id from later saves.
                for (const [id, data] of newImages) storedImageIds.set(data, id);
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { db.close(); }
}

export function validateSheet(value: unknown): SheetDocument {
    if (!value || typeof value !== 'object') throw new Error('악보 파일 형식이 올바르지 않습니다.');
    const doc = value as SheetDocument;
    if (doc.version !== 1 || typeof doc.title !== 'string' || doc.title.length > 200 ||
        typeof doc.updatedAt !== 'string' || !Array.isArray(doc.pages) || doc.pages.length < 1 || doc.pages.length > 20) {
        throw new Error('1~20페이지의 Worship Together 공유 파일을 선택해주세요.');
    }
    if (doc.score !== undefined && (!doc.score || !(doc.score.id in LEAD_SHEETS) || !isLeadSheetKey(doc.score.key))) {
        throw new Error('악보 키 정보가 올바르지 않습니다.');
    }
    if (doc.chart !== undefined && !isChartSettings(doc.chart)) throw new Error('코드 악보 정보가 올바르지 않습니다.');
    for (const page of doc.pages) {
        if (page?.chartPage !== undefined && (!doc.chart || !Number.isInteger(page.chartPage) || page.chartPage < 0 || page.chartPage >= 20)) {
            throw new Error('코드 악보 정보가 올바르지 않습니다.');
        }
        if (page?.scorePage !== undefined && (!doc.score || !Number.isInteger(page.scorePage) || page.scorePage < 0 || page.scorePage >= LEAD_SHEETS[doc.score.id].pages.length)) {
            throw new Error('악보 키 정보가 올바르지 않습니다.');
        }
        if (!page || typeof page.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(page.image) ||
            !Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width < 1 || page.height < 1 ||
            page.width > 5000 || page.height > 5000 || !Array.isArray(page.marks) || page.marks.length > 2000) {
            throw new Error('악보 이미지 또는 필기 데이터가 올바르지 않습니다.');
        }
        for (const mark of page.marks) {
            const isValidColor =
                SHEET_COLORS.includes(mark.color) ||
                HIGHLIGHTER_COLORS.includes(mark.color) ||
                /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(mark.color) ||
                /^rgba?\([^)]+\)$/.test(mark.color);
            const isValidKind = ['pen', 'highlighter', 'stamp', 'text', 'rect', 'line', 'songform', 'section'].includes(mark.kind);
            const isValidShape =
                mark.shape === undefined ||
                (mark.kind === 'line' && LINE_SHAPES.includes(mark.shape)) ||
                (mark.kind === 'rect' && mark.shape === 'ellipse');
            const isValidWidth = mark.strokeWidth === undefined || (Number.isFinite(mark.strokeWidth) && mark.strokeWidth >= 0.5 && mark.strokeWidth <= 60);
            const isValidOpacity = mark.opacity === undefined || (Number.isFinite(mark.opacity) && mark.opacity >= 0 && mark.opacity <= 1);
            const isValidFontSize = mark.fontSize === undefined || (Number.isFinite(mark.fontSize) && mark.fontSize >= 8 && mark.fontSize <= 72);
            const isValidPart = mark.part === undefined || isSheetPart(mark.part);

            if (!mark || typeof mark.id !== 'string' || !isValidKind || !isValidColor ||
                !isValidWidth || !isValidOpacity || !isValidFontSize || !isValidShape || !isValidPart ||
                (mark.kind === 'line' && mark.points?.length !== 2) ||
                !Array.isArray(mark.points) || mark.points.length < 1 || mark.points.length > 5000 ||
                mark.points.some((point) => !Array.isArray(point) || point.length !== 2 || point.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)) ||
                ((mark.kind === 'stamp' || mark.kind === 'text') && (typeof mark.text !== 'string' || mark.text.length > 100)) ||
                (mark.kind === 'songform' && !isValidSongFormSections(mark.sections)) ||
                (mark.kind === 'section' && !isValidSongFormSections([mark.text]))) {
                throw new Error('필기 데이터가 올바르지 않습니다.');
            }
        }
    }
    return doc;
}

/**
 * Long side of an imported page in pixels: sharp on a 2× tablet screen at full height or 150% zoom.
 * At JPEG 0.85 a typical lead sheet page is ~340KB, about a third more than the old 1600px / 0.9.
 */
export const IMPORT_LONG_SIDE = 2200;
const IMPORT_QUALITY = 0.85;

/** `onPage` reports PDF progress (pages done, page count) so a long import can show where it is. */
export async function importSheetPages(file: File, onPage?: (done: number, total: number) => void): Promise<SheetPage[]> {
    if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 파일을 선택해주세요.');
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Legacy build: bundles polyfills (e.g. Map.prototype.getOrInsertComputed, native only in
        // Chrome 145+/Safari 26.2+/Firefox 144+) that the modern build calls directly.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const task = pdfjs.getDocument({
            data: await file.arrayBuffer(),
            // Copied to /public/pdfjs by scripts/prepare-pdf-worker.mjs.
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/',
            iccUrl: '/pdfjs/iccs/',
        });
        const pdf = await task.promise;
        try {
            if (pdf.numPages > 20) throw new Error('악보는 최대 20페이지까지 불러올 수 있습니다.');
            const pages: SheetPage[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const original = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: Math.min(3, IMPORT_LONG_SIDE / Math.max(original.width, original.height)) });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                await page.render({ canvas, viewport }).promise;
                pages.push({ image: canvas.toDataURL('image/jpeg', IMPORT_QUALITY), width: canvas.width, height: canvas.height, marks: [] });
                canvas.width = canvas.height = 0;
                page.cleanup();
                onPage?.(i, pdf.numPages);
            }
            return pages;
        } finally { await task.destroy(); }
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PDF, PNG, JPG, WebP 파일을 선택해주세요.');
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, IMPORT_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('이 브라우저에서 이미지를 열 수 없습니다.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return [{ image: canvas.toDataURL('image/jpeg', IMPORT_QUALITY), width: canvas.width, height: canvas.height, marks: [] }];
    } finally { bitmap.close(); }
}

/**
 * Calculates Euclidean distance from point (px, py) to line segment A(ax, ay) -> B(bx, by).
 */
export function distanceToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        return Math.hypot(px - ax, py - ay);
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
}

/** Pen points closer than this (mark units) to the last kept point add nothing visible; they are dropped. */
export const STROKE_MIN_STEP = 1.5;

/** Adds a pointer sample to a stroke unless it sits on top of the last one. Returns whether it was kept. */
export function appendStrokePoint(points: Array<[number, number]>, point: [number, number], minStep = STROKE_MIN_STEP): boolean {
    const last = points[points.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < minStep) return false;
    points.push(point);
    return true;
}

type Vec = [number, number];
/**
 * Straight segments (viewBox units, y scaled by the page ratio) that draw a 'line' mark: the stroke itself,
 * an arrowhead at the end, or the two sides of a crescendo (<, opening at the end) / decrescendo (>) hairpin.
 */
export function lineMarkSegments(mark: Pick<SheetMark, 'points' | 'shape' | 'strokeWidth'>, ratio: number): Array<[Vec, Vec]> {
    const [p, q] = mark.points;
    if (!p || !q) return [];
    const a: Vec = [p[0], p[1] * ratio];
    const b: Vec = [q[0], q[1] * ratio];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.01) return [[a, b]];
    const ux = (b[0] - a[0]) / length;
    const uy = (b[1] - a[1]) / length;
    const nx = -uy;
    const ny = ux;
    if (mark.shape === 'cresc' || mark.shape === 'decresc') {
        const spread = Math.min(26, Math.max(8, length * 0.12));
        const [tip, mouth] = mark.shape === 'cresc' ? [a, b] : [b, a];
        return [
            [tip, [mouth[0] + nx * spread, mouth[1] + ny * spread]],
            [tip, [mouth[0] - nx * spread, mouth[1] - ny * spread]],
        ];
    }
    if (mark.shape === 'arrow') {
        const head = Math.min(length * 0.45, Math.max(14, (mark.strokeWidth ?? 3) * 4.5));
        const back = (side: number): Vec => [b[0] - ux * head * 0.88 + nx * head * 0.5 * side, b[1] - uy * head * 0.88 + ny * head * 0.5 * side];
        return [[a, b], [b, back(1)], [b, back(-1)]];
    }
    return [[a, b]];
}

export function lineMarkPath(mark: Pick<SheetMark, 'points' | 'shape' | 'strokeWidth'>, ratio: number): string {
    return lineMarkSegments(mark, ratio)
        .map(([s, e]) => `M ${s[0].toFixed(2)} ${s[1].toFixed(2)} L ${e[0].toFixed(2)} ${e[1].toFixed(2)}`)
        .join(' ');
}

/** Holding Shift while drawing a line snaps it to the nearest 45° (on screen, so y is scaled by the ratio). */
export function snapLineEnd(start: Vec, end: Vec, ratio: number): Vec {
    const dx = end[0] - start[0];
    const dy = (end[1] - start[1]) * ratio;
    const length = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return [
        Math.max(0, Math.min(1000, start[0] + Math.cos(angle) * length)),
        Math.max(0, Math.min(1000, start[1] + (Math.sin(angle) * length) / ratio)),
    ];
}

/**
 * Converts discrete points into a smooth SVG path (quadratic Bézier curves through midpoints).
 * Coordinates are mapped with Y scaled by the aspect ratio.
 */
export function pointsToSvgPath(points: Array<[number, number]>, ratio: number): string {
    if (!points || points.length === 0) return '';
    const p0 = points[0];
    const y0 = (p0[1] * ratio).toFixed(2);
    const x0 = p0[0].toFixed(2);

    if (points.length === 1) {
        return `M ${x0} ${y0} l 0.1 0.1`;
    }
    if (points.length === 2) {
        const p1 = points[1];
        return `M ${x0} ${y0} L ${p1[0].toFixed(2)} ${(p1[1] * ratio).toFixed(2)}`;
    }
    if (points.length === 3) {
        const p1 = points[1];
        const p2 = points[2];
        return `M ${x0} ${y0} Q ${p1[0].toFixed(2)} ${(p1[1] * ratio).toFixed(2)}, ${p2[0].toFixed(2)} ${(p2[1] * ratio).toFixed(2)}`;
    }

    let path = `M ${x0} ${y0}`;
    for (let i = 1; i < points.length - 1; i++) {
        const pCurr = points[i];
        const pNext = points[i + 1];
        const midX = ((pCurr[0] + pNext[0]) / 2).toFixed(2);
        const midY = (((pCurr[1] + pNext[1]) / 2) * ratio).toFixed(2);
        path += ` Q ${pCurr[0].toFixed(2)} ${(pCurr[1] * ratio).toFixed(2)}, ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    path += ` L ${last[0].toFixed(2)} ${(last[1] * ratio).toFixed(2)}`;
    return path;
}

/**
 * Checks whether coordinate (x, y) [0..1000] hits mark considering aspect ratio and stroke geometry.
 */
export function isPointNearMark(
    x: number,
    y: number,
    mark: SheetMark,
    ratio: number,
    threshold?: number
): boolean {
    if (!mark.points || mark.points.length === 0) return false;
    const targetX = x;
    const targetY = y * ratio;

    if (mark.kind === 'stamp') {
        const origin = mark.points[0];
        const stampX = Math.min(origin[0], 780);
        const stampY = Math.max(origin[1] * ratio, 25);
        const textLen = (mark.text?.length ?? 4) * 22;
        // Bounding box hit check around stamp text
        if (
            targetX >= stampX - 15 &&
            targetX <= stampX + textLen + 15 &&
            targetY >= stampY - 32 &&
            targetY <= stampY + 16
        ) {
            return true;
        }
        return Math.hypot(targetX - stampX, targetY - stampY) <= (threshold ?? 35);
    }

    if (mark.kind === 'text') {
        const origin = mark.points[0];
        const textX = Math.min(origin[0], 920);
        const textY = Math.max(origin[1] * ratio, 20);
        const fSize = mark.fontSize ?? 20;
        const textLen = (mark.text?.length ?? 4) * (fSize * 0.7);
        if (
            targetX >= textX - 12 &&
            targetX <= textX + textLen + 12 &&
            targetY >= textY - fSize - 10 &&
            targetY <= textY + 12
        ) {
            return true;
        }
        return Math.hypot(targetX - textX, targetY - textY) <= (threshold ?? 30);
    }

    if (mark.kind === 'songform' || mark.kind === 'section') {
        const origin: [number, number] = [mark.points[0][0], mark.points[0][1] * ratio];
        const box = mark.kind === 'songform'
            ? layoutSongFormMarkup(mark.sections ?? [], origin, mark.fontSize).plate
            : layoutSectionMarker(mark.text ?? '', origin, mark.fontSize);
        const tolerance = threshold ?? 6;
        return (
            targetX >= box.x - tolerance &&
            targetX <= box.x + box.width + tolerance &&
            targetY >= box.y - tolerance &&
            targetY <= box.y + box.height + tolerance
        );
    }

    if (mark.kind === 'line') {
        const radius = threshold ?? Math.max(16, (mark.strokeWidth ?? 3) / 2 + 14);
        return lineMarkSegments(mark, ratio).some(([a, b]) => distanceToSegment(targetX, targetY, a[0], a[1], b[0], b[1]) <= radius);
    }

    if (mark.kind === 'rect') {
        if (mark.points.length < 2) return false;
        const [p1, p2] = mark.points;
        const minX = Math.min(p1[0], p2[0]);
        const maxX = Math.max(p1[0], p2[0]);
        const minY = Math.min(p1[1], p2[1]) * ratio;
        const maxY = Math.max(p1[1], p2[1]) * ratio;
        const hitTol = threshold ?? 20;
        const inside = targetX >= minX - 5 && targetX <= maxX + 5 && targetY >= minY - 5 && targetY <= maxY + 5;
        if (inside) return true;
        const nearBorder =
            (Math.abs(targetX - minX) <= hitTol && targetY >= minY - hitTol && targetY <= maxY + hitTol) ||
            (Math.abs(targetX - maxX) <= hitTol && targetY >= minY - hitTol && targetY <= maxY + hitTol) ||
            (Math.abs(targetY - minY) <= hitTol && targetX >= minX - hitTol && targetX <= maxX + hitTol) ||
            (Math.abs(targetY - maxY) <= hitTol && targetX >= minX - hitTol && targetX <= maxX + hitTol);
        return nearBorder;
    }

    const hitRadius =
        threshold ??
        (mark.kind === 'highlighter'
            ? Math.max(24, (mark.strokeWidth ?? 16) / 2 + 12)
            : Math.max(16, (mark.strokeWidth ?? 2.5) / 2 + 14));

    if (mark.points.length === 1) {
        const [px, py] = mark.points[0];
        return Math.hypot(targetX - px, targetY - py * ratio) <= hitRadius;
    }

    for (let i = 0; i < mark.points.length - 1; i++) {
        const [ax, ayRaw] = mark.points[i];
        const [bx, byRaw] = mark.points[i + 1];
        const dist = distanceToSegment(targetX, targetY, ax, ayRaw * ratio, bx, byRaw * ratio);
        if (dist <= hitRadius) {
            return true;
        }
    }
    return false;
}

const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * The 2-page 체험용 sample, engraved with VexFlow in `key` (C by default), with a few sample marks.
 * Outside a browser (tests, SSR) the pages are 1px placeholders.
 */
export async function createSampleSheetDocument(title = '은혜로다', key: LeadSheetKey = 'C'): Promise<SheetDocument> {
    const engraved = typeof document === 'undefined' ? null : await renderLeadSheetPages(transposeLeadSheet(SAMPLE_LEAD_SHEET, key), title || '은혜로다');
    const pageImage = (index: number) => engraved?.[index] ?? { image: PLACEHOLDER_IMAGE, width: 1200, height: 1600 };
    const pages: SheetDocument['pages'] = [];

    pages.push({
        ...pageImage(0),
        scorePage: 0,
        marks: [
            {
                id: 'sample-mark-hl-1',
                kind: 'highlighter',
                color: 'rgba(250, 204, 21, 0.45)',
                strokeWidth: 24,
                opacity: 0.45,
                points: [
                    [70, 560],
                    [300, 560],
                    [600, 560],
                    [930, 560],
                ],
            },
            {
                id: 'sample-mark-stamp-1',
                kind: 'stamp',
                color: '#2563eb',
                text: '후렴 반복',
                points: [[790, 530]],
            },
            {
                id: 'sample-mark-pen-1',
                kind: 'pen',
                color: '#dc2626',
                strokeWidth: 3,
                opacity: 1,
                points: [
                    [840, 715],
                    [870, 700],
                    [910, 705],
                    [920, 725],
                    [880, 735],
                    [845, 720],
                ],
            },
        ],
    });

    pages.push({
        ...pageImage(1),
        scorePage: 1,
        marks: [
            {
                id: 'sample-mark-stamp-2',
                kind: 'stamp',
                color: '#eab308',
                text: '기도 반주',
                points: [[760, 840]],
            },
        ],
    });

    return {
        version: 1,
        title: (title || '은혜로다').slice(0, 200),
        pages,
        updatedAt: new Date().toISOString(),
        score: { id: SAMPLE_LEAD_SHEET.id, key },
    };
}

/** Re-engraves the app-drawn pages of a sheet in another key; marks and any added pages stay as they are. */
async function rekeyScore(doc: SheetDocument, key: LeadSheetKey): Promise<SheetDocument> {
    const sheet = doc.score ? LEAD_SHEETS[doc.score.id] : undefined;
    if (!doc.score || !sheet || doc.score.key === key) return doc;
    const engraved = await renderLeadSheetPages(transposeLeadSheet(sheet, key), doc.title);
    return {
        ...doc,
        score: { ...doc.score, key },
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((page) => {
            const next = page.scorePage === undefined ? undefined : engraved[page.scorePage];
            return next ? { ...page, image: next.image, width: next.width, height: next.height } : page;
        }),
    };
}

/**
 * Moves a sheet to another key: the engraved sample and the chord chart are re-drawn, uploaded pages are left alone.
 * Marks stay. A chart that now needs more or fewer pages follows the rule in `mergeChartPages`.
 */
export async function rekeySheet(doc: SheetDocument, key: LeadSheetKey): Promise<SheetDocument> {
    const next = await rekeyScore(doc, key);
    return next.chart && next.chart.key !== key ? updateChordChart(next, { key }) : next;
}

/**
 * Moves marks with their page when it turns clockwise by `angleDeg`. Points map exactly; widths and text
 * sizes (in units of the page width) are rescaled for 90°/270° so they keep their size on the music.
 */
export function rotateMarks(marks: SheetMark[], angleDeg: 90 | 180 | 270, width: number, height: number): SheetMark[] {
    const map = ([x, y]: [number, number]): [number, number] =>
        angleDeg === 90 ? [1000 - y, x] : angleDeg === 180 ? [1000 - x, 1000 - y] : [y, 1000 - x];
    const scale = angleDeg === 180 ? 1 : width / height;
    const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
    return marks.map((mark) => {
        let points = mark.points.map(map);
        // Labels are anchored at one corner; keep the anchor where the label still fits on the page.
        if (mark.kind === 'songform') points = points.map(([x, y]) => [clamp(x, 0, SONG_FORM_MAX_ANCHOR_X), clamp(y, 0, 960)]);
        if (mark.kind === 'section' || mark.kind === 'stamp' || mark.kind === 'text') points = points.map(([x, y]) => [clamp(x, 0, 940), clamp(y, 0, 1000)]);
        return {
            ...mark,
            points,
            ...(mark.strokeWidth !== undefined ? { strokeWidth: clamp(mark.strokeWidth * scale, 0.5, 60) } : {}),
            ...(mark.fontSize !== undefined ? { fontSize: clamp(mark.fontSize * scale, 8, 72) } : {}),
        };
    });
}

/**
 * Rotates a sheet page clockwise by 90, 180, or 270 degrees, carrying its marks along.
 */
export async function rotateSheetPage(page: SheetPage, angleDeg: 90 | 180 | 270 = 90): Promise<SheetPage> {
    if (typeof document === 'undefined') return page;
    const img = new Image();
    img.src = page.image;
    await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('이미지 로드 실패'));
    });
    const canvas = document.createElement('canvas');
    if (angleDeg === 90 || angleDeg === 270) {
        canvas.width = img.naturalHeight;
        canvas.height = img.naturalWidth;
    } else {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return page;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    // A turned page no longer matches its engraving, so it drops out of key changes.
    const { scorePage: _engraved, chartPage: _charted, ...rest } = page;
    void _engraved;
    void _charted;
    return {
        ...rest,
        image: canvas.toDataURL('image/jpeg', IMPORT_QUALITY),
        width: canvas.width,
        height: canvas.height,
        marks: rotateMarks(page.marks, angleDeg, page.width, page.height),
    };
}
