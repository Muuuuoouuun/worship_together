import { isValidSongFormSections, layoutSectionMarker, layoutSongFormMarkup } from './songFormMarkup';

/** 'songform' = song form band (I → V1 → C …); 'section' = one section chip placed at a measure (text = label). */
export type SheetMarkKind = 'pen' | 'highlighter' | 'stamp' | 'text' | 'rect' | 'songform' | 'section';

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
};

export type SheetPage = { image: string; width: number; height: number; marks: SheetMark[] };
export type SheetDocument = {
    version: 1;
    title: string;
    pages: SheetPage[];
    updatedAt: string;
};

export const SHEET_COLORS = ['#dc2626', '#2563eb', '#15803d', '#111827', '#eab308', '#9333ea'];
export const HIGHLIGHTER_COLORS = [
    'rgba(250, 204, 21, 0.45)',
    'rgba(74, 222, 128, 0.45)',
    'rgba(96, 165, 250, 0.45)',
    'rgba(244, 114, 182, 0.45)',
];
export const WORSHIP_STAMP_PRESETS = [
    '한 번 더',
    '후렴 반복',
    '브릿지',
    '엔딩',
    '작게 (p)',
    '크게 (f)',
    '기도 반주',
    '자유 찬양',
    '멘트',
    'Coda 𝄌',
    'Segno 𝄋',
    'Fermata 𝄐',
    'Fine',
    'Drum In 🥁',
    'All Out 🔥',
    'Build Up 📈',
    'Break 🔇',
] as const;

export const sheetKey = (teamId: string, songId: string, shared = false) => `${teamId}:${songId}:${shared ? 'published' : 'draft'}`;

function openSheetDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('worship-together-sheets-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('sheets');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function readSheet(key: string): Promise<SheetDocument | null> {
    const db = await openSheetDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const request = db.transaction('sheets').objectStore('sheets').get(key);
            request.onsuccess = () => resolve(request.result ? validateSheet(request.result) : null);
            request.onerror = () => reject(request.error);
        });
    } finally { db.close(); }
}

export async function saveSheet(key: string, document: SheetDocument): Promise<void> {
    const db = await openSheetDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('sheets', 'readwrite');
            transaction.objectStore('sheets').put(document, key);
            transaction.oncomplete = () => resolve();
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
    for (const page of doc.pages) {
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
            const isValidKind = ['pen', 'highlighter', 'stamp', 'text', 'rect', 'songform', 'section'].includes(mark.kind);
            const isValidWidth = mark.strokeWidth === undefined || (Number.isFinite(mark.strokeWidth) && mark.strokeWidth >= 0.5 && mark.strokeWidth <= 60);
            const isValidOpacity = mark.opacity === undefined || (Number.isFinite(mark.opacity) && mark.opacity >= 0 && mark.opacity <= 1);
            const isValidFontSize = mark.fontSize === undefined || (Number.isFinite(mark.fontSize) && mark.fontSize >= 8 && mark.fontSize <= 72);

            if (!mark || typeof mark.id !== 'string' || !isValidKind || !isValidColor ||
                !isValidWidth || !isValidOpacity || !isValidFontSize ||
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

export async function importSheetPages(file: File): Promise<SheetPage[]> {
    if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 파일을 선택해주세요.');
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Legacy build: bundles polyfills (e.g. Map.prototype.getOrInsertComputed, native only in
        // Chrome 145+/Safari 26.2+/Firefox 144+) that the modern build calls directly.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
        const pdf = await task.promise;
        try {
            if (pdf.numPages > 20) throw new Error('악보는 최대 20페이지까지 불러올 수 있습니다.');
            const pages: SheetPage[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const original = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(original.width, original.height)) });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                await page.render({ canvas, viewport }).promise;
                pages.push({ image: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height, marks: [] });
                canvas.width = canvas.height = 0;
                page.cleanup();
            }
            return pages;
        } finally { await task.destroy(); }
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PDF, PNG, JPG, WebP 파일을 선택해주세요.');
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('이 브라우저에서 이미지를 열 수 없습니다.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return [{ image: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height, marks: [] }];
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

/**
 * Creates a realistic, high-definition 2-page sample worship lead sheet.
 * In browser environments, draws crisp musical staves, chords, lyrics, and marks on HTML5 Canvas.
 * In Node/SSR, provides a lightweight valid fallback.
 */
export function createSampleSheetDocument(title = '은혜로다'): SheetDocument {
    const pages: SheetDocument['pages'] = [];

    const generatePageImage = (pageNumber: number): string => {
        if (typeof document === 'undefined') {
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        }
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        }

        // Crisp warm manuscript paper background
        ctx.fillStyle = '#fcfbfa';
        ctx.fillRect(0, 0, 1200, 1600);

        // Subtle vintage paper border
        ctx.strokeStyle = '#e2dfd8';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 30, 1140, 1540);

        // Header Title
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif';
        ctx.fillText(title || '은혜로다', 600, 110);

        ctx.font = '600 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(pageNumber === 1 ? 'Worship Lead Sheet · 4/4 박자 · 느리고 은혜롭게' : 'Worship Lead Sheet · 후렴 및 엔딩', 600, 145);

        // Header Meta info
        ctx.textAlign = 'left';
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#b45309';
        ctx.fillText('Key: C Major (1 = C)', 80, 190);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Tempo: ♩ = 68  |  Page ' + pageNumber + ' of 2', 1120, 190);

        // Divider
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(80, 210);
        ctx.lineTo(1120, 210);
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(80, 216);
        ctx.lineTo(1120, 216);
        ctx.stroke();

        // Staves setup
        const systems = pageNumber === 1
            ? [
                { section: '[Intro]', chords: ['C', 'G/B', 'Am7', 'Em7'], lyrics: '(피아노 & 어쿠스틱 기타 아르페지오 잔잔하게 시작)' },
                { section: '[Verse 1]', chords: ['F', 'C/E', 'Dm7', 'G7sus4 G'], lyrics: '시작됐네 우리 주님의 능력이 나의 삶을 다스리시네' },
                { section: '[Chorus]', chords: ['C', 'Em7', 'F', 'G'], lyrics: '주의 은혜로다 주의 은혜로다 주님의 사랑이 나를 감싸네' },
                { section: '[Verse 2]', chords: ['Am7', 'Em7', 'F  G7', 'C'], lyrics: '넘치는 은혜로 내 영혼 소생케 하시며 나의 모든 길 인도하시네' },
            ]
            : [
                { section: '[Bridge]', chords: ['F', 'G/F', 'Em7', 'Am7'], lyrics: '내가 누려왔던 모든 것들이 내가 지나왔던 모든 시간이' },
                { section: '[Bridge 2]', chords: ['Dm7', 'G7', 'C', 'C7'], lyrics: '내가 걸어왔던 모든 순간이 당연한 것 아니라 은혜였소' },
                { section: '[Chorus (All Out)]', chords: ['F', 'G/F', 'Em7', 'Am7'], lyrics: '아침 해가 뜨고 저녁의 노을 봄의 꽃향기와 가을의 열매' },
                { section: '[Ending / Coda]', chords: ['Dm7', 'G7', 'Csus4', 'C (Fine)'], lyrics: '꿈꾸지 못했던 가장 큰 선물 주님의 사랑과 은혜라네' },
            ];

        const startY = 270;
        const systemGap = 310;
        const staffLineGap = 16;

        systems.forEach((sys, sysIdx) => {
            const topY = startY + sysIdx * systemGap;

            // Section Tag Badge
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.roundRect(80, topY - 35, 120, 28, 6);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(sys.section, 140, topY - 16);

            // Chords above staff
            ctx.textAlign = 'left';
            ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = '#0369a1';
            const colWidth = (1120 - 80) / 4;
            sys.chords.forEach((chord, cIdx) => {
                ctx.fillText(chord, 80 + cIdx * colWidth + 15, topY - 10);
            });

            // 5 staff lines
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            for (let l = 0; l < 5; l++) {
                const lineY = topY + l * staffLineGap;
                ctx.beginPath();
                ctx.moveTo(80, lineY);
                ctx.lineTo(1120, lineY);
                ctx.stroke();
            }

            // Left and Right barlines
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(80, topY);
            ctx.lineTo(80, topY + 4 * staffLineGap);
            ctx.moveTo(1120, topY);
            ctx.lineTo(1120, topY + 4 * staffLineGap);
            ctx.stroke();

            // Internal measure barlines
            ctx.lineWidth = 1.5;
            for (let b = 1; b < 4; b++) {
                const barX = 80 + b * colWidth;
                ctx.beginPath();
                ctx.moveTo(barX, topY);
                ctx.lineTo(barX, topY + 4 * staffLineGap);
                ctx.stroke();
            }

            // Note stems and heads decorative representation
            ctx.fillStyle = '#0f172a';
            for (let m = 0; m < 4; m++) {
                const measureX = 80 + m * colWidth;
                [0.28, 0.68].forEach((offsetRatio, noteIdx) => {
                    const noteX = measureX + colWidth * offsetRatio;
                    const noteY = topY + ((m + noteIdx) % 4) * staffLineGap + 8;
                    ctx.beginPath();
                    ctx.ellipse(noteX, noteY, 8, 6, -0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillRect(noteX + 6, noteY - 32, 2.5, 32);
                });
            }

            // Lyrics underneath staff
            ctx.textAlign = 'left';
            ctx.font = '600 21px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
            ctx.fillStyle = '#1e293b';
            ctx.fillText(sys.lyrics, 85, topY + 4 * staffLineGap + 40);
        });

        // Bottom Footer
        ctx.textAlign = 'center';
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Worship Together Stage Score Engine · ' + (pageNumber === 1 ? '1/2 페이지' : '2/2 페이지'), 600, 1560);

        return canvas.toDataURL('image/jpeg', 0.92);
    };

    pages.push({
        image: generatePageImage(1),
        width: 1200,
        height: 1600,
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
                points: [[760, 530]],
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
        image: generatePageImage(2),
        width: 1200,
        height: 1600,
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
    };
}

/**
 * Rotates a sheet page clockwise by 90, 180, or 270 degrees.
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
    return {
        ...page,
        image: canvas.toDataURL('image/jpeg', 0.92),
        width: canvas.width,
        height: canvas.height,
        marks: [], // Marks reset on rotation to prevent coordinate distortion
    };
}
