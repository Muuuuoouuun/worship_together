export type SheetMark = {
    id: string;
    kind: 'pen' | 'stamp';
    color: string;
    points: Array<[number, number]>;
    text?: string;
};

export type SheetPage = { image: string; width: number; height: number; marks: SheetMark[] };
export type SheetDocument = {
    version: 1;
    title: string;
    pages: SheetPage[];
    updatedAt: string;
};

export const SHEET_COLORS = ['#dc2626', '#2563eb', '#15803d', '#111827'];
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
            if (!mark || typeof mark.id !== 'string' || !['pen', 'stamp'].includes(mark.kind) || !SHEET_COLORS.includes(mark.color) ||
                !Array.isArray(mark.points) || mark.points.length < 1 || mark.points.length > 5000 ||
                mark.points.some((point) => !Array.isArray(point) || point.length !== 2 || point.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)) ||
                (mark.kind === 'stamp' && (typeof mark.text !== 'string' || mark.text.length > 40))) {
                throw new Error('필기 데이터가 올바르지 않습니다.');
            }
        }
    }
    return doc;
}

export async function importSheetPages(file: File): Promise<SheetPage[]> {
    if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 파일을 선택해주세요.');
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjs = await import('pdfjs-dist');
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
