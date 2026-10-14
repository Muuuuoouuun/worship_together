import { keyLabel, type LeadMeasure, type LeadSheet, type LeadSystem, type Pitch } from './leadSheet';

/**
 * Engraves a lead sheet with VexFlow (treble clef, key and time signatures, beamed notes, chord symbols,
 * lyrics) into page images. Browser only: VexFlow and its Bravura music font load on first use.
 */

/** Logical page: the coordinate space the sample's marks were placed in. */
export const LEAD_PAGE_WIDTH = 1200;
export const LEAD_PAGE_HEIGHT = 1600;
/** Output bitmap 1650×2200, the long side imported PDFs get, so staff lines stay crisp on tablets. */
const OUTPUT_SCALE = 2200 / LEAD_PAGE_HEIGHT;
/** Engraving scale: VexFlow's 10-unit line spacing becomes 14 logical px. */
const VF = 1.4;
const STAFF_LEFT = 80;
const STAFF_RIGHT = 1120;
/** Top staff line of each system; unchanged from the drawn sample so its highlights still sit on the chorus. */
const SYSTEM_TOP = 270;
const SYSTEM_GAP = 310;
const INK = '#111827';
const CHORD_COLOR = '#0b4f8a';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const KOREAN = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "IBM Plex Sans KR", sans-serif';

type VexFlowModule = typeof import('vexflow/bravura');

const vexKey = (p: Pitch) => `${p.letter}${p.accidental > 0 ? '#'.repeat(p.accidental) : 'b'.repeat(-p.accidental)}/${p.octave}`;
const KEY_NAMES: Readonly<Record<string, string>> = { C: 'C', Db: 'D♭', D: 'D', Eb: 'E♭', E: 'E', F: 'F', 'F#': 'F♯', G: 'G', Ab: 'A♭', A: 'A', Bb: 'B♭', B: 'B' };

/** Chord symbol typography: big root, raised quality ("7sus4"), slash bass at full height. */
function drawChord(ctx: CanvasRenderingContext2D, symbol: string, x: number, y: number) {
    const match = symbol.match(/^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
    ctx.save();
    ctx.fillStyle = CHORD_COLOR;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    if (!match) {
        ctx.font = `700 15px ${SANS}`;
        ctx.fillText(symbol, x, y);
        ctx.restore();
        return;
    }
    const [, letter, accidental, quality, bass] = match;
    let cursor = x;
    const put = (text: string, font: string, dy = 0) => {
        ctx.font = font;
        ctx.fillText(text, cursor, y + dy);
        cursor += ctx.measureText(text).width;
    };
    put(letter, `700 17px ${SANS}`);
    if (accidental) put(accidental === '#' ? '♯' : '♭', `700 12px ${SANS}`, -6);
    // Minor stays on the line (Dm7 → D m ⁷); extensions ride up as a superscript.
    const minor = quality.match(/^(m(?!aj))/)?.[1] ?? '';
    if (minor) put(minor, `700 14px ${SANS}`);
    const extension = quality.slice(minor.length);
    if (extension) put(extension, `700 11px ${SANS}`, -7);
    if (bass) put(`/${bass.replace('#', '♯').replace(/^([A-G])b/, '$1♭')}`, `700 14px ${SANS}`);
    ctx.restore();
}

function drawSectionBadge(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
    ctx.save();
    ctx.font = `700 10.5px ${SANS}`;
    const text = `[${label}]`;
    const width = ctx.measureText(text).width + 12;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y - 12, width, 17, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x + 6, y);
    ctx.restore();
}

function drawSystem(
    VexFlow: VexFlowModule,
    ctx: CanvasRenderingContext2D,
    vfContext: InstanceType<VexFlowModule['CanvasContext']>,
    sheet: LeadSheet,
    system: LeadSystem,
    lineTop: number,
    firstMeasureNumber: number,
    { withTime, lastSystem }: { withTime: boolean; lastSystem: boolean }
) {
    const { Stave, StaveNote, Voice, Formatter, Accidental, Beam, BarlineType } = VexFlow;
    const x0 = STAFF_LEFT / VF;
    const total = (STAFF_RIGHT - STAFF_LEFT) / VF;
    const staveY = lineTop - 40;

    const first = new Stave(x0, staveY, 120).addClef('treble').addKeySignature(sheet.key);
    if (withTime) first.addTimeSignature('4/4');
    const modifiers = first.getNoteStartX() - x0;
    const noteWidth = (total - modifiers) / system.measures.length;

    let x = x0;
    system.measures.forEach((measure: LeadMeasure, index) => {
        const stave = index === 0 ? first : new Stave(x, staveY, noteWidth);
        if (index === 0) stave.setWidth(modifiers + noteWidth);
        if (index === system.measures.length - 1) stave.setEndBarType(lastSystem ? BarlineType.END : BarlineType.DOUBLE);
        // The canvas is shared with the chord and lyric text, so put the ink back before VexFlow draws.
        vfContext.setFillStyle(INK);
        vfContext.setStrokeStyle(INK);
        stave.setContext(vfContext).draw();

        const notes = measure.notes.map((n) => new StaveNote({ keys: [vexKey(n.pitch)], duration: n.duration, autoStem: true }));
        const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes);
        Accidental.applyAccidentals([voice], sheet.key);
        const beams = Beam.generateBeams(notes);
        new Formatter().joinVoices([voice]).formatToStave([voice], stave);
        voice.draw(vfContext, stave);
        beams.forEach((beam) => beam.setContext(vfContext).draw());

        // Chords over the note that starts their beat; lyrics centred under each notehead.
        let beat = 0;
        measure.notes.forEach((n, i) => {
            const note = notes[i];
            const head = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
            const chord = measure.chords.find((c) => Math.abs(c.beat - beat) < 1e-6);
            if (chord) drawChord(ctx, chord.symbol, note.getNoteHeadBeginX() - 2, lineTop - 17);
            if (n.lyric) {
                ctx.font = `600 13px ${KOREAN}`;
                ctx.fillStyle = INK;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(n.lyric, head, lineTop + 76);
                ctx.textAlign = 'left';
            }
            beat += n.duration === 'w' ? 4 : n.duration === 'h' ? 2 : n.duration === 'q' ? 1 : 0.5;
        });
        if (measure.endText) {
            ctx.font = `italic 700 13px Georgia, "Times New Roman", serif`;
            ctx.fillStyle = INK;
            ctx.textAlign = 'right';
            ctx.fillText(measure.endText, stave.getX() + stave.getWidth() - 2, lineTop - 17);
            ctx.textAlign = 'left';
        }
        x += stave.getWidth();
    });

    drawSectionBadge(ctx, system.section, x0, lineTop - 46);
    ctx.font = `italic 9.5px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(String(firstMeasureNumber), x0 + 1, lineTop - 14);
    if (system.note) {
        ctx.font = `600 12.5px ${KOREAN}`;
        ctx.fillStyle = '#334155';
        ctx.fillText(system.note, x0 + 4, lineTop + 76);
    }
}

function drawPageFrame(ctx: CanvasRenderingContext2D, sheet: LeadSheet, title: string, pageIndex: number) {
    const pageCount = sheet.pages.length;
    ctx.fillStyle = '#fcfbfa';
    ctx.fillRect(0, 0, LEAD_PAGE_WIDTH, LEAD_PAGE_HEIGHT);
    ctx.strokeStyle = '#e2dfd8';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, LEAD_PAGE_WIDTH - 60, LEAD_PAGE_HEIGHT - 60);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 44px ${KOREAN}`;
    ctx.fillText(title || '은혜로다', LEAD_PAGE_WIDTH / 2, 96);
    ctx.font = `600 20px ${KOREAN}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText(sheet.subtitle[pageIndex] ?? sheet.subtitle[0] ?? '', LEAD_PAGE_WIDTH / 2, 128);

    // The rule ends above the first system's section badge.
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${SANS}`;
    ctx.fillStyle = '#b45309';
    const name = KEY_NAMES[sheet.key] ?? keyLabel(sheet.key);
    ctx.fillText(`Key: ${name} Major (1 = ${name})`, 80, 164);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `700 20px ${SANS}`;
    const tempo = ` = ${sheet.tempo}  |  Page ${pageIndex + 1} of ${pageCount}`;
    ctx.fillText(tempo, 1120, 164);
    const tempoWidth = ctx.measureText(tempo).width;
    // Metronome mark from the music font; text fonts draw ♩ tiny or not at all.
    ctx.font = '30px Bravura';
    ctx.fillText('\uECA5', 1120 - tempoWidth - 2, 164);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 177);
    ctx.lineTo(1120, 177);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 183);
    ctx.lineTo(1120, 183);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `500 15px ${SANS}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Worship Together Stage Score Engine · ${pageIndex + 1}/${pageCount} 페이지`, LEAD_PAGE_WIDTH / 2, 1560);
}

export type EngravedPage = { image: string; width: number; height: number };

/** Every page of the sheet as a PNG data URL at 1650×2200; line art stays sharp without JPEG ringing. */
export async function renderLeadSheetPages(sheet: LeadSheet, title: string): Promise<EngravedPage[]> {
    const VexFlow = await import('vexflow/bravura');
    await Promise.all([document.fonts.load('30px Bravura'), document.fonts.load('12px Academico'), document.fonts.load(`600 13px ${KOREAN}`)]);
    const pages: EngravedPage[] = [];
    let measureNumber = 1;
    for (const [pageIndex, systems] of sheet.pages.entries()) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(LEAD_PAGE_WIDTH * OUTPUT_SCALE);
        canvas.height = Math.round(LEAD_PAGE_HEIGHT * OUTPUT_SCALE);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('이 브라우저에서는 악보를 그릴 수 없습니다.');
        ctx.setTransform(OUTPUT_SCALE, 0, 0, OUTPUT_SCALE, 0, 0);
        drawPageFrame(ctx, sheet, title, pageIndex);

        const renderer = new VexFlow.Renderer(canvas, VexFlow.Renderer.Backends.CANVAS);
        const vfContext = renderer.getContext() as InstanceType<VexFlowModule['CanvasContext']>;
        ctx.setTransform(OUTPUT_SCALE * VF, 0, 0, OUTPUT_SCALE * VF, 0, 0);
        systems.forEach((system, index) => {
            const lineTop = (SYSTEM_TOP + index * SYSTEM_GAP) / VF;
            const lastSystem = pageIndex === sheet.pages.length - 1 && index === systems.length - 1;
            drawSystem(VexFlow, ctx, vfContext, sheet, system, lineTop, measureNumber, { withTime: pageIndex === 0 && index === 0, lastSystem });
            measureNumber += system.measures.length;
        });
        pages.push({ image: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
        canvas.width = canvas.height = 0;
    }
    return pages;
}
