import { lineMarkPath, pointsToSvgPath, type SheetMark, type SheetPage } from './sheetAnnotations';
import { isSongFormTint, layoutSectionMarker, layoutSongFormMarkup, songFormMetrics, splitRepeat, type SongFormChipBox } from './songFormMarkup';

/**
 * Burns a page's marks into an image (print, save, share). Draws with Canvas 2D in the same viewBox units
 * as the on-screen SVG (page width = 1000), so the output matches what the team sees, song form chips included.
 */

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
/** Draw order matches the SVG layers: highlighter under everything, song form markup on top. */
const LAYERS: ReadonlyArray<SheetMark['kind']> = ['highlighter', 'rect', 'pen', 'line', 'stamp', 'text', 'songform', 'section'];

function drawChip(ctx: CanvasRenderingContext2D, box: SongFormChipBox, fontSize: number | undefined, tint: boolean, rim: boolean) {
    const m = songFormMetrics(fontSize);
    const { base, repeat } = splitRepeat(box.label);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 9 * m.scale);
    ctx.globalAlpha = tint ? 0.26 : 1;
    ctx.fillStyle = box.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (tint || rim) {
        ctx.strokeStyle = tint ? box.color : '#ffffff';
        ctx.lineWidth = (tint ? 2 : 2.5) * m.scale;
        ctx.stroke();
    }
    const repeatText = repeat === null ? '' : `×${repeat}`;
    ctx.font = `800 ${m.fontSize}px ${FONT_FAMILY}`;
    const baseWidth = ctx.measureText(base).width;
    ctx.font = `700 ${m.repeatFontSize}px ${FONT_FAMILY}`;
    const repeatWidth = repeatText ? ctx.measureText(repeatText).width + 3 * m.scale : 0;
    let x = box.x + box.width / 2 - (baseWidth + repeatWidth) / 2;
    const y = box.y + box.height / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const paint = (text: string, font: string) => {
        ctx.font = font;
        if (tint) {
            ctx.lineWidth = 4 * m.scale;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineJoin = 'round';
            ctx.strokeText(text, x, y);
        }
        ctx.fillStyle = tint ? box.color : '#ffffff';
        ctx.fillText(text, x, y);
    };
    paint(base, `800 ${m.fontSize}px ${FONT_FAMILY}`);
    x += baseWidth + 3 * m.scale;
    if (repeatText) paint(repeatText, `700 ${m.repeatFontSize}px ${FONT_FAMILY}`);
    ctx.restore();
}

function drawMark(ctx: CanvasRenderingContext2D, mark: SheetMark, ratio: number) {
    const [x, y] = mark.points[0] ?? [0, 0];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (mark.kind) {
        case 'highlighter':
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = mark.opacity ?? 0.45;
            ctx.lineCap = 'square';
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = mark.strokeWidth || 16;
            ctx.stroke(new Path2D(pointsToSvgPath(mark.points, ratio)));
            break;
        case 'pen':
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = mark.strokeWidth || 2.5;
            ctx.stroke(new Path2D(pointsToSvgPath(mark.points, ratio)));
            break;
        case 'line':
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = mark.strokeWidth || 3;
            ctx.stroke(new Path2D(lineMarkPath(mark, ratio)));
            break;
        case 'rect': {
            if (mark.points.length < 2) break;
            const [[ax, ay], [bx, by]] = mark.points;
            const left = Math.min(ax, bx);
            const top = Math.min(ay, by) * ratio;
            const width = Math.abs(bx - ax);
            const height = Math.abs(by - ay) * ratio;
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = mark.strokeWidth || 3;
            ctx.beginPath();
            if (mark.shape === 'ellipse') {
                ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            } else {
                ctx.roundRect(left, top, width, height, 6);
                ctx.globalAlpha = mark.opacity ?? 0.15;
                ctx.fillStyle = mark.color;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.stroke();
            break;
        }
        case 'stamp':
            ctx.font = `800 25px ${FONT_FAMILY}`;
            ctx.textBaseline = 'alphabetic';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText(mark.text ?? '', Math.min(x, 780), Math.max(y * ratio, 25));
            ctx.fillStyle = mark.color;
            ctx.fillText(mark.text ?? '', Math.min(x, 780), Math.max(y * ratio, 25));
            break;
        case 'text': {
            const size = mark.fontSize ?? 20;
            const left = Math.min(x, 900);
            const baseline = Math.max(y * ratio, 20);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(left - 4, baseline - size, (mark.text?.length ?? 3) * (size * 0.65) + 8, size + 6, 4);
            ctx.fill();
            ctx.font = `800 ${size}px monospace, sans-serif`;
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = mark.color;
            ctx.fillText(mark.text ?? '', left, baseline - 2);
            break;
        }
        case 'songform': {
            const m = songFormMetrics(mark.fontSize);
            const tint = isSongFormTint(mark.opacity);
            const { plate, chips, arrows } = layoutSongFormMarkup(mark.sections ?? [], [x, y * ratio], mark.fontSize);
            ctx.beginPath();
            ctx.roundRect(plate.x, plate.y, plate.width, plate.height, 14 * m.scale);
            ctx.fillStyle = `rgba(255, 255, 255, ${tint ? 0.28 : 0.92})`;
            ctx.fill();
            if (!tint) {
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 3 * m.scale;
            for (const arrow of arrows) {
                ctx.beginPath();
                ctx.moveTo(arrow.x - 4 * m.scale, arrow.y - 7 * m.scale);
                ctx.lineTo(arrow.x + 4 * m.scale, arrow.y);
                ctx.lineTo(arrow.x - 4 * m.scale, arrow.y + 7 * m.scale);
                ctx.stroke();
            }
            for (const chip of chips) drawChip(ctx, chip, mark.fontSize, tint, false);
            break;
        }
        case 'section':
            drawChip(ctx, layoutSectionMarker(mark.text ?? '', [x, y * ratio], mark.fontSize), mark.fontSize, isSongFormTint(mark.opacity), true);
            break;
    }
    ctx.restore();
}

/** Picks which of a page's marks to draw (e.g. only the parts being viewed); the stored marks are left alone. */
export type SheetMarksFilter = (marks: readonly SheetMark[]) => readonly SheetMark[];

/** Draws marks in viewBox units; the caller scales the context so 1000 units span the page width. */
export function drawSheetMarks(ctx: CanvasRenderingContext2D, marks: readonly SheetMark[], ratio: number, filter?: SheetMarksFilter) {
    const shown = filter ? filter(marks) : marks;
    for (const kind of LAYERS) for (const mark of shown) if (mark.kind === kind) drawMark(ctx, mark, ratio);
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('악보 이미지를 그리지 못했습니다.'));
        image.src = src;
    });
}

export type SheetImageOptions = { withMarks?: boolean; type?: 'image/jpeg' | 'image/png'; quality?: number; marksFilter?: SheetMarksFilter };

/** One page with its marks as an image file, at the page's own resolution. */
export async function renderSheetPageImage(page: SheetPage, { withMarks = true, type = 'image/jpeg', quality = 0.92, marksFilter }: SheetImageOptions = {}): Promise<Blob> {
    const image = await loadImage(page.image);
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저에서는 악보 이미지를 만들 수 없습니다.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (withMarks) {
        const unit = canvas.width / 1000;
        ctx.scale(unit, unit);
        drawSheetMarks(ctx, page.marks, page.height / page.width, marksFilter);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('악보 이미지를 만들지 못했습니다.');
    return blob;
}

/** Safe file name stem for a song title. */
export const sheetFileStem = (title: string) => title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 80) || '악보';
