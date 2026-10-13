'use client';

import { createClientId } from '@/lib/clientId';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronLeft, ChevronRight, Copy, Delete, Download, Eraser, FileUp, Hand, Highlighter, ImageDown, ListMusic, Maximize2, Minimize2, Moon, MoveUpRight, Pencil, Printer, Redo2, RotateCw, Share2, Sparkles, Square, Sun, SunDim, Trash2, Type, Undo2, X } from 'lucide-react';
import { usePageTurner } from '@/hooks/usePageTurner';
import { useSongFormStepper } from '@/hooks/useSongFormStepper';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useFullscreen } from '@/hooks/useFullscreen';
import {
    createSampleSheetDocument,
    HIGHLIGHTER_COLORS,
    importSheetPages,
    readSheet,
    rotateSheetPage,
    saveSheet,
    sheetKey,
    SHEET_COLORS,
    validateSheet,
    WORSHIP_STAMP_PRESETS,
    isPointNearMark,
    appendStrokePoint,
    lineMarkPath,
    pointsToSvgPath,
    snapLineEnd,
    type SheetDocument,
    type SheetMark,
    type SheetMarkShape,
    type SheetPage,
} from '@/lib/sheetAnnotations';
import { renderSheetPageImage, sheetFileStem } from '@/lib/sheetRender';
import {
    abbreviateSectionLabel,
    formatSongFormText,
    isSongFormTint,
    layoutSectionMarker,
    layoutSongFormMarkup,
    parseSongFormText,
    songFormChipColor,
    songFormRowHeight,
    splitRepeat,
    toggleRepeat,
    SONG_FORM_CHIPS,
    SONG_FORM_DEFAULT_ANCHOR,
    SONG_FORM_DEFAULT_FONT_SIZE,
    SONG_FORM_MAX_ANCHOR_X,
    SONG_FORM_MAX_SECTIONS,
    SONG_FORM_PRESETS,
    SONG_FORM_SIZES,
    SONG_FORM_TINT_OPACITY,
} from '@/lib/songFormMarkup';
import { readSongForm } from '@/lib/songFormStorage';
import SongFormScoreOverlay, { type SongFormOverlayDisplayMode } from './SongFormScoreOverlay';
import SongFormMarkup, { SongFormMarkupPlaceholder, SongFormSectionMarker } from './SongFormMarkup';
import SheetInkLayer from './SheetInkLayer';

type Props = {
    teamId: string;
    songId: string;
    title: string;
    page: number;
    onPageChange: (page: number) => void;
    canTurnPage: boolean;
    onPageCountChange?: (count: number) => void;
};

type SongFormDrag = {
    id: string;
    offset: [number, number];
    bounds: { maxX: number; height: number };
    anchor: [number, number];
    /** Section markers line up with each other while dragged. */
    snaps: boolean;
    /** x (viewBox units) of the marker this one lines up with, drawn as a guide. */
    guideX: number | null;
};

/** A marker within this many screen pixels of another's left edge lines up with it. */
const SNAP_PX = 8;
const NUDGE_STEP = 2.5;
const NUDGE_STEP_LARGE = 10;
const ARROW_STEPS: Readonly<Record<string, [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const isTypingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

const isSongFormMark = (mark: SheetMark) => mark.kind === 'songform' || mark.kind === 'section';

const LINE_SHAPE_OPTIONS: ReadonlyArray<{ shape: SheetMarkShape; label: string; title: string }> = [
    { shape: 'arrow', label: '화살표 →', title: '되돌아갈 곳이나 다음 진행을 가리킵니다' },
    { shape: 'line', label: '직선 ─', title: '' },
    { shape: 'cresc', label: '크레센도 <', title: '점점 크게' },
    { shape: 'decresc', label: '디크레센도 >', title: '점점 작게' },
];

/** Print view: every page burned with its marks, one per sheet of paper. Hidden on screen. */
const PRINT_CSS = `
#sheet-print-root { display: none; }
@media print {
  @page { margin: 8mm; }
  body > *:not(#sheet-print-root) { display: none !important; }
  #sheet-print-root { display: block !important; }
  .sheet-print-page { height: 100vh; display: flex; align-items: center; justify-content: center; break-after: page; page-break-after: always; }
  .sheet-print-page:last-child { break-after: auto; page-break-after: auto; }
  .sheet-print-page img { max-width: 100%; max-height: 100%; object-fit: contain; }
}`;

/** Saves a blob under a file name. The link is attached while clicking; detached links lose the name in Chromium. */
function downloadFile(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const noSubscribe = () => () => {};
/** Whether this device can hand an image file to another app (Web Share level 2, e.g. KakaoTalk on phones). */
function canShareImageFiles() {
    try {
        return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'sheet.jpg', { type: 'image/jpeg' })] });
    } catch {
        return false;
    }
}

const button =
    'tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40';

export default function SheetAnnotationWorkspace({
    teamId,
    songId,
    title,
    page: livePage,
    onPageChange,
    canTurnPage,
    onPageCountChange,
}: Props) {
    const [draft, setDraft] = useState<SheetDocument | null>(null);
    const [published, setPublished] = useState<SheetDocument | null>(null);
    const [view, setView] = useState<'draft' | 'published'>('draft');
    const [tool, setTool] = useState<'move' | 'pen' | 'highlighter' | 'eraser' | 'stamp' | 'text' | 'rect' | 'line' | 'songform'>('move');
    const [lineShape, setLineShape] = useState<SheetMarkShape>('arrow');
    const [lineWidth, setLineWidth] = useState(3);
    const [rectShape, setRectShape] = useState<'box' | 'ellipse'>('box');
    /** Print / image export: burn the marks in, or output the clean sheet. */
    const [exportMarks, setExportMarks] = useState(true);
    const [printImages, setPrintImages] = useState<string[] | null>(null);
    const canShareFiles = useSyncExternalStore(noSubscribe, canShareImageFiles, () => false);
    const [stamp, setStamp] = useState<string>(WORSHIP_STAMP_PRESETS[0]);
    const [color, setColor] = useState(SHEET_COLORS[0]);
    const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0]);
    const [penWidth, setPenWidth] = useState<number>(3);
    const [highlighterWidth, setHighlighterWidth] = useState<number>(18);
    const [textFontSize, setTextFontSize] = useState<number>(20);
    const [redoStack, setRedoStack] = useState<SheetMark[]>([]);
    const [textModal, setTextModal] = useState<{ isOpen: boolean; x: number; y: number; text: string } | null>(null);
    const [rectStart, setRectStart] = useState<[number, number] | null>(null);
    const [songFormDrag, setSongFormDrag] = useState<SongFormDrag | null>(null);
    const [pendingSongFormAnchor, setPendingSongFormAnchor] = useState<{ page: number; point: [number, number] } | null>(null);
    const [songFormMode, setSongFormMode] = useState<'band' | 'section'>('band');
    const [armedSection, setArmedSection] = useState<string | null>(null);
    /** The band or marker arrow keys move (송폼 tool). */
    const [selectedSongFormId, setSelectedSongFormId] = useState<string | null>(null);
    const [importProgress, setImportProgress] = useState<string | null>(null);
    /** While following the leader (no page control), marking up another page opens it locally only. */
    const [editPage, setEditPage] = useState<number | null>(null);
    const [songFormLook, setSongFormLook] = useState({ fontSize: SONG_FORM_DEFAULT_FONT_SIZE, tint: false });
    const [songFormOverlayMode, setSongFormOverlayMode] = useState<SongFormOverlayDisplayMode>(() => {
        if (typeof window === 'undefined') return 'first_page_only';
        return (window.localStorage.getItem('wt_sheet_songform_mode') as SongFormOverlayDisplayMode) || 'first_page_only';
    });
    const [stroke, setStroke] = useState<SheetMark | null>(null);
    const [status, setStatus] = useState('악보 불러오는 중…');
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isDarkInverted, setIsDarkInverted] = useState(false);
    const [isDualPage, setIsDualPage] = useState(false);
    const [showTools, setShowTools] = useState(true);

    const documentRef = useRef<SheetDocument | null>(null);
    const strokeRef = useRef<SheetMark | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const writeQueue = useRef(Promise.resolve());
    const rectRef = useRef<DOMRect | null>(null);
    const rafRef = useRef<number | null>(null);
    const lastEraserCheckRef = useRef<number>(0);
    const sectionRef = useRef<HTMLElement | null>(null);
    const songFormDragRef = useRef<SongFormDrag | null>(null);
    const songFormTextRef = useRef<HTMLInputElement | null>(null);
    /** The stroke being drawn; pointer moves update its attributes directly instead of re-rendering the page. */
    const liveRef = useRef<SVGPathElement | SVGRectElement | SVGEllipseElement | null>(null);
    const removeMarkRef = useRef<(id: string) => void>(() => {});
    const lazySaveRef = useRef<number | null>(null);

    const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen } = useFullscreen();
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported, toggle: toggleWakeLock } = useScreenWakeLock(true);

    const draftKey = sheetKey(teamId, songId);
    const publishedKey = sheetKey(teamId, songId, true);
    const shown = view === 'draft' ? draft : published;
    const isEditingOtherPage = !canTurnPage && editPage !== null && editPage !== livePage && editPage <= (shown?.pages.length ?? 0);
    const page = isEditingOtherPage && editPage !== null ? editPage : livePage;
    const activePage = shown?.pages[page - 1];
    const pageRatio = activePage ? activePage.height / activePage.width : 1;
    const pageSongFormMarks = (view === 'draft' && activePage?.marks.filter(isSongFormMark)) || [];
    const songFormSections = pageSongFormMarks.find((m) => m.kind === 'songform')?.sections ?? [];
    const pageSectionMarkers = pageSongFormMarks.filter((m) => m.kind === 'section');
    // The tray mirrors the page's existing look so new markers match the band already on it.
    const songFormFontSize = pageSongFormMarks[0] ? (pageSongFormMarks[0].fontSize ?? SONG_FORM_DEFAULT_FONT_SIZE) : songFormLook.fontSize;
    const songFormTint = pageSongFormMarks[0] ? isSongFormTint(pageSongFormMarks[0].opacity) : songFormLook.tint;
    const isSongFormEditing = tool === 'songform' && view === 'draft';
    const selectedSongFormMark = isSongFormEditing ? (pageSongFormMarks.find((m) => m.id === selectedSongFormId) ?? null) : null;
    const stepper = useSongFormStepper({ pages: shown?.pages, page, canTurnPage, onPageChange, resetKey: `${songId}:${view}` });

    /** Moves the pedal along the song form; false when section mode doesn't apply, so pages turn instead. */
    function stepSection(direction: 1 | -1): boolean {
        const stop = stepper.step(direction);
        if (!stop) return false;
        setStatus(
            stop.page === null
                ? `지금 ${stop.label} · 이 섹션은 마디 표시가 없어 페이지는 그대로입니다.`
                : `지금 ${stop.label}${stop.sharedWith ? ` · ${stop.sharedWith} 구간` : ''} · ${stop.page}p`
        );
        return true;
    }

    usePageTurner({
        onNext: () => {
            if (stepSection(1)) return;
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && shown && page + step <= shown.pages.length + (isDualPage ? 1 : 0)) {
                onPageChange(Math.min(shown.pages.length, page + step));
            }
        },
        onPrev: () => {
            if (stepSection(-1)) return;
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && page > 1) {
                onPageChange(Math.max(1, page - step));
            }
        },
        // While a band or marker is selected, arrow keys move it instead of turning pages.
        enabled: canTurnPage && Boolean(shown?.pages.length) && !selectedSongFormMark,
    });

    // 송폼 tool: arrow keys nudge the selected band or marker (Shift for bigger steps), Delete removes a marker.
    useEffect(() => {
        if (!selectedSongFormMark) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
            const arrow = ARROW_STEPS[event.key];
            if (arrow) {
                event.preventDefault();
                const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
                nudgeSongFormMark(selectedSongFormMark.id, arrow[0] * step, arrow[1] * step);
            } else if (event.key === 'Escape') {
                setSelectedSongFormId(null);
            } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSongFormMark.kind === 'section') {
                event.preventDefault();
                removeMark(selectedSongFormMark.id);
                setSelectedSongFormId(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

    // The ink layer is memoized; it gets a stable eraser callback that reaches the current page.
    useEffect(() => {
        removeMarkRef.current = removeMark;
    });
    const eraseMark = useCallback((id: string) => removeMarkRef.current(id), []);

    // Print once the burned page images have decoded; clean up when the print dialog closes.
    useEffect(() => {
        if (!printImages) return;
        let cancelled = false;
        const images = Array.from(document.querySelectorAll<HTMLImageElement>('#sheet-print-root img'));
        void Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
            if (!cancelled) window.print();
        });
        const done = () => setPrintImages(null);
        window.addEventListener('afterprint', done, { once: true });
        return () => {
            cancelled = true;
            window.removeEventListener('afterprint', done);
            printImages.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [printImages]);

    // A save held back during a burst of nudges still lands if the song changes or the view closes.
    useEffect(() => {
        const key = draftKey;
        return () => {
            if (lazySaveRef.current === null) return;
            window.clearTimeout(lazySaveRef.current);
            lazySaveRef.current = null;
            const doc = documentRef.current;
            // Behind any write still queued, so an older copy can't land after this one.
            if (doc) writeQueue.current = writeQueue.current.catch(() => {}).then(() => saveSheet(key, doc));
        };
    }, [draftKey]);

    useEffect(() => {
        let active = true;
        const reloadPublished = () =>
            readSheet(publishedKey).then((doc) => {
                if (active) setPublished(doc);
            });
        void Promise.all([readSheet(draftKey), readSheet(publishedKey)])
            .then(([local, shared]) => {
                if (!active) return;
                documentRef.current = local;
                setDraft(local);
                setPublished(shared);
                setLoaded(true);
                setStatus(local ? '이 기기에 저장된 악보' : 'PDF 또는 이미지를 추가해주세요.');
            })
            .catch(() => {
                if (active) {
                    setLoaded(true);
                    setStatus('기기 저장소를 열 수 없습니다. 브라우저 저장 권한을 확인해주세요.');
                }
            });
        const channel =
            typeof BroadcastChannel !== 'undefined'
                ? new BroadcastChannel(`sheet:${teamId}:${songId}`)
                : null;
        channelRef.current = channel;
        if (channel) {
            channel.onmessage = () => {
                void reloadPublished().catch(() => setStatus('공유본을 다시 불러오지 못했습니다.'));
            };
        }
        return () => {
            active = false;
            channel?.close();
            channelRef.current = null;
        };
    }, [draftKey, publishedKey, songId, teamId]);

    useEffect(() => {
        onPageCountChange?.(shown?.pages.length ?? 0);
    }, [shown?.pages.length, onPageCountChange]);

    /** `lazy` holds the write until edits pause (arrow-key nudges), so a held key doesn't rewrite the sheet every step. */
    function persist(next: SheetDocument, lazy = false) {
        documentRef.current = next;
        setDraft(next);
        setStatus('저장 중…');
        if (lazySaveRef.current !== null) {
            window.clearTimeout(lazySaveRef.current);
            lazySaveRef.current = null;
        }
        if (lazy) {
            lazySaveRef.current = window.setTimeout(() => {
                lazySaveRef.current = null;
                if (documentRef.current) queueSave(documentRef.current);
            }, 400);
            return;
        }
        queueSave(next);
    }

    function queueSave(next: SheetDocument) {
        writeQueue.current = writeQueue.current
            .catch(() => {})
            .then(() => saveSheet(draftKey, next));
        void writeQueue.current.then(
            // Keeps a message set after the edit (e.g. which words became custom chips).
            () => setStatus((current) => (current === '저장 중…' ? '내 필기 저장됨 · 전체 공유 전' : current)),
            () => setStatus('기기 저장 실패 · 공유 파일로 내려받아 보관해주세요.')
        );
    }

    async function upload(files: File[], sharedFile = false) {
        const file = files[0];
        if (!file) return;
        setBusy(true);
        let firstNewPage = 1;
        try {
            if (sharedFile) {
                if (file.size > 35 * 1024 * 1024) throw new Error('공유 파일은 35MB 이하로 선택해주세요.');
                const next = validateSheet(JSON.parse(await file.text()));
                await saveSheet(publishedKey, next);
                setPublished(next);
                setView('published');
                channelRef.current?.postMessage('published');
                setStatus('공유 악보와 필기를 불러왔습니다. 팀 공유본에서 확인하세요.');
            } else {
                const existing = documentRef.current;
                const existingCount = existing?.pages.length ?? 0;
                // Several page photos picked at once keep their file-name order (page1, page2, … page10).
                const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                const pages: SheetPage[] = [];
                for (const item of ordered) {
                    pages.push(
                        ...(await importSheetPages(item, (done, total) =>
                            setImportProgress(total > 1 ? `${item.name} · ${done}/${total}페이지 처리 중…` : null)
                        ))
                    );
                    if (existingCount + pages.length > 20) throw new Error('한 곡에 최대 20페이지를 추가할 수 있습니다.');
                }
                persist({
                    version: 1,
                    title: title.slice(0, 200),
                    pages: [...(existing?.pages ?? []), ...pages],
                    updatedAt: new Date().toISOString(),
                });
                setView('draft');
                firstNewPage = existingCount + 1;
            }
            if (canTurnPage) onPageChange(firstNewPage);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : '파일을 불러오지 못했습니다.');
        } finally {
            setBusy(false);
            setImportProgress(null);
        }
    }

    function addMark(mark: SheetMark) {
        const current = documentRef.current;
        if (!current?.pages[page - 1] || current.pages[page - 1].marks.length >= 2000) return;
        setRedoStack([]); // New action resets redo stack
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: [...item.marks, mark] } : item
            ),
        });
    }

    function removeMark(markId: string) {
        const current = documentRef.current;
        if (!current?.pages[page - 1]) return;
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1
                    ? { ...item, marks: item.marks.filter((m) => m.id !== markId) }
                    : item
            ),
        });
        setStatus('필기 항목이 삭제되었습니다.');
    }

    /** Reads documentRef (not render state) so rapid chip taps never drop a chip. */
    function currentPageMarks(): SheetMark[] {
        return documentRef.current?.pages[page - 1]?.marks ?? [];
    }

    /** One song form band per page. */
    function currentSongFormMark(): SheetMark | null {
        return currentPageMarks().find((m) => m.kind === 'songform') ?? null;
    }

    function replacePageMarks(marks: SheetMark[], lazy = false) {
        const current = documentRef.current;
        if (!current?.pages[page - 1]) return;
        setRedoStack([]);
        persist(
            {
                ...current,
                updatedAt: new Date().toISOString(),
                pages: current.pages.map((item, index) => (index === page - 1 ? { ...item, marks } : item)),
            },
            lazy
        );
    }

    function writeSongForm(sections: string[]) {
        if (!documentRef.current?.pages[page - 1]) return;
        const marks = currentPageMarks();
        const existing = currentSongFormMark();
        const nextSections = sections.slice(0, SONG_FORM_MAX_SECTIONS);
        if (!nextSections.length) {
            replacePageMarks(marks.filter((m) => m.kind !== 'songform'));
        } else if (existing) {
            replacePageMarks(marks.map((m) => (m.id === existing.id ? { ...m, sections: nextSections } : m)));
        } else if (marks.length < 2000) {
            const start = pendingSongFormAnchor?.page === page ? pendingSongFormAnchor.point : SONG_FORM_DEFAULT_ANCHOR;
            replacePageMarks([
                ...marks,
                {
                    id: createClientId(),
                    kind: 'songform',
                    color: '#0f172a',
                    points: [start],
                    sections: nextSections,
                    fontSize: songFormFontSize,
                    opacity: songFormTint ? SONG_FORM_TINT_OPACITY : 1,
                },
            ]);
        }
    }

    function moveMark(id: string, anchor: [number, number]) {
        const marks = currentPageMarks();
        const target = marks.find((m) => m.id === id);
        if (!target || (target.points[0][0] === anchor[0] && target.points[0][1] === anchor[1])) return;
        replacePageMarks(marks.map((m) => (m.id === id ? { ...m, points: [anchor] } : m)));
    }

    /** Size and solid/translucent look apply to the whole page's band and section markers, and to new ones. */
    function applySongFormLook(fontSize: number, tint: boolean) {
        setSongFormLook({ fontSize, tint });
        const marks = currentPageMarks();
        if (!marks.some(isSongFormMark)) return;
        replacePageMarks(
            marks.map((m) => (isSongFormMark(m) ? { ...m, fontSize, opacity: tint ? SONG_FORM_TINT_OPACITY : 1 } : m))
        );
    }

    function handleSongFormChip(label: string) {
        if (songFormMode === 'section') {
            setArmedSection(label);
            setStatus(`악보에서 ‘${label}’ 섹션이 시작되는 마디를 누르세요.`);
            return;
        }
        const sections = currentSongFormMark()?.sections ?? [];
        if (sections.length >= SONG_FORM_MAX_SECTIONS) {
            setStatus(`송폼은 최대 ${SONG_FORM_MAX_SECTIONS}칸까지 얹을 수 있습니다.`);
            return;
        }
        writeSongForm([...sections, label]);
    }

    function repeatLastSongFormChip(times: number) {
        const sections = currentSongFormMark()?.sections ?? [];
        if (!sections.length) return;
        writeSongForm([...sections.slice(0, -1), toggleRepeat(sections[sections.length - 1], times)]);
    }

    function removeSongFormChip(index: number) {
        writeSongForm((currentSongFormMark()?.sections ?? []).filter((_, i) => i !== index));
    }

    function applySongFormText(text: string) {
        const { sections, custom } = parseSongFormText(text);
        if (!sections.length) {
            setStatus('송폼을 텍스트로 입력해주세요. 예: I - V1 - C - V2 - C - B - C×2 - O');
            return;
        }
        writeSongForm(sections);
        const extra = custom.length ? ` 칩에 없는 말은 그대로 칩으로 넣었습니다: ${custom.slice(0, 3).join(', ')}${custom.length > 3 ? ' …' : ''}` : '';
        setStatus(`텍스트로 송폼 ${sections.length}칸을 얹었습니다.${extra}`);
    }

    async function copySongFormText() {
        try {
            await navigator.clipboard.writeText(`${title}\n${formatSongFormText(songFormSections)}`);
            setStatus('송폼을 텍스트로 복사했습니다. 단톡방에 붙여 넣으세요.');
        } catch {
            songFormTextRef.current?.select();
            setStatus('복사하지 못했습니다. 선택된 텍스트 칸을 직접 복사해주세요.');
        }
    }

    function nudgeSongFormMark(id: string, dx: number, dy: number) {
        const marks = currentPageMarks();
        const target = marks.find((m) => m.id === id);
        if (!target) return;
        const [x, y] = target.points[0];
        const anchor = anchorWithin([x + dx, y * pageRatio + dy], [0, 0], songFormBounds(target));
        if (anchor[0] === x && anchor[1] === y) return;
        replacePageMarks(marks.map((m) => (m.id === id ? { ...m, points: [anchor] } : m)), true);
    }

    function importSavedSongForm() {
        const saved = readSongForm(songId, teamId);
        if (!saved?.sections.length) {
            setStatus('이 곡에 저장된 송폼이 없습니다. 칩이나 프리셋으로 만들어주세요.');
            return;
        }
        writeSongForm(saved.sections.map((section) => abbreviateSectionLabel(section.label)));
    }

    function songFormBounds(mark: SheetMark): SongFormDrag['bounds'] {
        if (mark.kind === 'section') {
            const box = layoutSectionMarker(mark.text ?? '', [0, 0], mark.fontSize);
            return { maxX: 1000 - box.width, height: box.height };
        }
        return { maxX: SONG_FORM_MAX_ANCHOR_X, height: layoutSongFormMarkup(mark.sections ?? [], [0, 0], mark.fontSize).plate.height };
    }

    /** Converts a pointer position (viewBox units) into a clamped top-left anchor (mark units). */
    function anchorWithin(pointVb: [number, number], offset: [number, number], bounds: SongFormDrag['bounds']): [number, number] {
        const x = Math.max(0, Math.min(bounds.maxX, pointVb[0] - offset[0]));
        const yVb = Math.max(0, Math.min(1000 * pageRatio - bounds.height, pointVb[1] - offset[1]));
        return [x, Math.max(0, Math.min(1000, yVb / pageRatio))];
    }

    function startSongFormDrag(event: PointerEvent<SVGSVGElement>, mark: SheetMark, pointVb: [number, number], offset: [number, number]) {
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = songFormBounds(mark);
        const drag = { id: mark.id, offset, bounds, anchor: anchorWithin(pointVb, offset, bounds), snaps: mark.kind === 'section', guideX: null };
        songFormDragRef.current = drag;
        setSongFormDrag(drag);
        setSelectedSongFormId(mark.id);
    }

    /** Lines a dragged marker's left edge up with the nearest other marker on the page (Alt places freely). */
    function snapSectionMarker(drag: SongFormDrag, free: boolean) {
        drag.guideX = null;
        const width = rectRef.current?.width;
        if (!drag.snaps || free || !width) return;
        const tolerance = (SNAP_PX * 1000) / width;
        let best: number | null = null;
        for (const mark of currentPageMarks()) {
            if (mark.kind !== 'section' || mark.id === drag.id) continue;
            const x = mark.points[0][0];
            if (x <= drag.bounds.maxX && Math.abs(x - drag.anchor[0]) < tolerance && (best === null || Math.abs(x - drag.anchor[0]) < Math.abs(best - drag.anchor[0]))) best = x;
        }
        if (best === null) return;
        drag.anchor = [best, drag.anchor[1]];
        drag.guideX = best;
    }

    /** 송폼 tool: press a band/marker to drag it; tap empty space to move the band (띠) or place a marker (마디 섹션). */
    function songFormPointerDown(event: PointerEvent<SVGSVGElement>) {
        const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
        const pointVb: [number, number] = [x, y * pageRatio];
        const marks = currentPageMarks();
        // Topmost first: section markers render above the band.
        const hit = [...marks].reverse().find((m) => isSongFormMark(m) && isPointNearMark(x, y, m, pageRatio, 0));
        if (hit) {
            startSongFormDrag(event, hit, pointVb, [pointVb[0] - hit.points[0][0], pointVb[1] - hit.points[0][1] * pageRatio]);
            return;
        }
        if (songFormMode === 'section') {
            if (!armedSection) {
                setStatus('먼저 섹션 칩을 고른 뒤 악보를 눌러주세요.');
                setSelectedSongFormId(null);
                rectRef.current = null;
                return;
            }
            if (marks.length >= 2000) return;
            const box = layoutSectionMarker(armedSection, [0, 0], songFormFontSize);
            const offset: [number, number] = [box.width / 2, box.height / 2];
            const mark: SheetMark = {
                id: createClientId(),
                kind: 'section',
                color: box.color,
                text: armedSection,
                points: [anchorWithin(pointVb, offset, { maxX: 1000 - box.width, height: box.height })],
                fontSize: songFormFontSize,
                opacity: songFormTint ? SONG_FORM_TINT_OPACITY : 1,
            };
            addMark(mark);
            startSongFormDrag(event, mark, pointVb, offset);
            return;
        }
        const band = currentSongFormMark();
        const rowHeight = songFormRowHeight(songFormFontSize);
        if (!band) {
            setPendingSongFormAnchor({ page, point: anchorWithin(pointVb, [0, rowHeight / 2], { maxX: SONG_FORM_MAX_ANCHOR_X, height: rowHeight }) });
            setSelectedSongFormId(null);
            rectRef.current = null;
            return;
        }
        startSongFormDrag(event, band, pointVb, [0, rowHeight / 2]);
    }

    function position(clientX: number, clientY: number, target?: SVGSVGElement): [number, number] {
        const rect = rectRef.current ?? target?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
        return [
            Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 1000)),
            Math.max(0, Math.min(1000, ((clientY - rect.top) / rect.height) * 1000)),
        ];
    }

    function pointerDown(event: PointerEvent<SVGSVGElement>) {
        if (view !== 'draft' || tool === 'move' || !event.isPrimary || busy || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        rectRef.current = event.currentTarget.getBoundingClientRect();

        if (tool === 'songform') {
            songFormPointerDown(event);
            return;
        }

        if (tool === 'eraser') {
            const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
            const currentMarks = documentRef.current?.pages[page - 1]?.marks ?? [];
            const ratio = activePage ? activePage.height / activePage.width : 1;
            const hit = currentMarks.find((m) => isPointNearMark(x, y, m, ratio));
            if (hit) {
                removeMark(hit.id);
            }
            rectRef.current = null;
            return;
        }

        if (tool === 'stamp') {
            addMark({
                id: createClientId(),
                kind: 'stamp',
                points: [position(event.clientX, event.clientY, event.currentTarget)],
                color,
                text: stamp,
            });
            rectRef.current = null;
            return;
        }

        if (tool === 'text') {
            const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
            setTextModal({
                isOpen: true,
                x,
                y,
                text: '',
            });
            rectRef.current = null;
            return;
        }

        if (tool === 'rect') {
            const pt = position(event.clientX, event.clientY, event.currentTarget);
            setRectStart(pt);
            const mark: SheetMark = {
                id: createClientId(),
                kind: 'rect',
                points: [pt, pt],
                color,
                strokeWidth: 3,
                opacity: 0.18,
                ...(rectShape === 'ellipse' ? { shape: 'ellipse' as const } : {}),
            };
            strokeRef.current = mark;
            setStroke(mark);
            return;
        }

        if (tool === 'line') {
            event.currentTarget.setPointerCapture(event.pointerId);
            const pt = position(event.clientX, event.clientY, event.currentTarget);
            const mark: SheetMark = { id: createClientId(), kind: 'line', points: [pt, pt], color, strokeWidth: lineWidth, shape: lineShape };
            strokeRef.current = mark;
            setStroke(mark);
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const isHighlighter = tool === 'highlighter';
        const mark: SheetMark = {
            id: createClientId(),
            kind: isHighlighter ? 'highlighter' : 'pen',
            points: [position(event.clientX, event.clientY, event.currentTarget)],
            color: isHighlighter ? highlighterColor : color,
            strokeWidth: isHighlighter ? highlighterWidth : penWidth,
            opacity: isHighlighter ? 0.45 : 1,
        };
        strokeRef.current = mark;
        setStroke(mark);
    }

    function pointerMove(event: PointerEvent<SVGSVGElement>) {
        if (songFormDragRef.current) {
            const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
            const drag = songFormDragRef.current;
            drag.anchor = anchorWithin([x, y * pageRatio], drag.offset, drag.bounds);
            snapSectionMarker(drag, event.altKey);
            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    if (songFormDragRef.current) setSongFormDrag({ ...songFormDragRef.current });
                });
            }
            return;
        }

        if (tool === 'eraser' && (event.buttons === 1 || event.pointerType === 'touch')) {
            const now = performance.now();
            if (now - lastEraserCheckRef.current < 25) return;
            lastEraserCheckRef.current = now;
            const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
            const currentMarks = documentRef.current?.pages[page - 1]?.marks ?? [];
            const ratio = activePage ? activePage.height / activePage.width : 1;
            const hit = currentMarks.find((m) => isPointNearMark(x, y, m, ratio));
            if (hit) {
                removeMark(hit.id);
            }
            return;
        }

        const live = strokeRef.current;
        if (!live || !event.isPrimary) return;
        const pt = position(event.clientX, event.clientY, event.currentTarget);
        if (live.kind === 'rect') {
            if (!rectStart) return;
            live.points = [rectStart, pt];
        } else if (live.kind === 'line') {
            live.points = [live.points[0], event.shiftKey ? snapLineEnd(live.points[0], pt, pageRatio) : pt];
        } else if (live.points.length >= 5000 || !appendStrokePoint(live.points, pt)) {
            return;
        }
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                paintLiveStroke();
            });
        }
    }

    /** Writes the live stroke's geometry straight to its SVG element: no React render while drawing. */
    function paintLiveStroke() {
        const element = liveRef.current;
        const mark = strokeRef.current;
        if (!element || !mark) return;
        if (mark.kind === 'pen' || mark.kind === 'highlighter') element.setAttribute('d', pointsToSvgPath(mark.points, pageRatio));
        else if (mark.kind === 'line') element.setAttribute('d', lineMarkPath(mark, pageRatio));
        else if (mark.kind === 'rect') {
            const box = liveBox(mark);
            if (mark.shape === 'ellipse') {
                element.setAttribute('cx', String(box.x + box.width / 2));
                element.setAttribute('cy', String(box.y + box.height / 2));
                element.setAttribute('rx', String(box.width / 2));
                element.setAttribute('ry', String(box.height / 2));
            } else {
                element.setAttribute('x', String(box.x));
                element.setAttribute('y', String(box.y));
                element.setAttribute('width', String(box.width));
                element.setAttribute('height', String(box.height));
            }
        }
    }

    function liveBox(mark: SheetMark) {
        const [p1, p2] = mark.points;
        const end = p2 ?? p1;
        return { x: Math.min(p1[0], end[0]), y: Math.min(p1[1], end[1]) * pageRatio, width: Math.abs(end[0] - p1[0]), height: Math.abs(end[1] - p1[1]) * pageRatio };
    }

    function pointerUp() {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (songFormDragRef.current) {
            moveMark(songFormDragRef.current.id, songFormDragRef.current.anchor);
            songFormDragRef.current = null;
            setSongFormDrag(null);
            rectRef.current = null;
            return;
        }
        if (tool === 'rect') {
            if (strokeRef.current && strokeRef.current.points.length >= 2) {
                const [p1, p2] = strokeRef.current.points;
                if (Math.abs(p2[0] - p1[0]) > 6 && Math.abs(p2[1] - p1[1]) > 6) {
                    addMark(strokeRef.current);
                }
            }
            strokeRef.current = null;
            setStroke(null);
            setRectStart(null);
            return;
        }
        if (strokeRef.current?.kind === 'line') {
            const [p1, p2] = strokeRef.current.points;
            if (Math.hypot(p2[0] - p1[0], (p2[1] - p1[1]) * pageRatio) > 8) addMark(strokeRef.current);
            strokeRef.current = null;
            setStroke(null);
            rectRef.current = null;
            return;
        }
        if (strokeRef.current) addMark(strokeRef.current);
        strokeRef.current = null;
        setStroke(null);
        rectRef.current = null;
    }

    function cancelPointer() {
        strokeRef.current = null;
        setStroke(null);
        songFormDragRef.current = null;
        setSongFormDrag(null);
    }

    function handleSaveTextMark() {
        if (!textModal || !textModal.text.trim()) return;
        addMark({
            id: createClientId(),
            kind: 'text',
            points: [[textModal.x, textModal.y]],
            color,
            text: textModal.text.trim(),
            fontSize: textFontSize,
        });
        setTextModal(null);
        setStatus('텍스트/코드가 악보에 추가되었습니다.');
    }

    function undo() {
        const current = documentRef.current;
        if (!current) return;
        const pageMarks = current.pages[page - 1]?.marks ?? [];
        if (!pageMarks.length) return;
        const lastMark = pageMarks[pageMarks.length - 1];
        setRedoStack((prev) => [...prev, lastMark]);
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: item.marks.slice(0, -1) } : item
            ),
        });
        setStatus('마지막 필기가 취소되었습니다.');
    }

    function redo() {
        if (!redoStack.length) return;
        const markToRestore = redoStack[redoStack.length - 1];
        setRedoStack((prev) => prev.slice(0, -1));
        const current = documentRef.current;
        if (!current?.pages[page - 1]) return;
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: [...item.marks, markToRestore] } : item
            ),
        });
        setStatus('필기를 다시 실행했습니다.');
    }

    async function handleRotatePage() {
        const current = documentRef.current;
        if (!current?.pages[page - 1]) return;
        setBusy(true);
        try {
            const rotated = await rotateSheetPage(current.pages[page - 1], 90);
            persist({
                ...current,
                updatedAt: new Date().toISOString(),
                pages: current.pages.map((p, idx) => (idx === page - 1 ? rotated : p)),
            });
            setStatus(`${page}페이지를 90도 돌렸습니다. 필기도 함께 돌렸습니다.`);
        } catch {
            setStatus('페이지 회전에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    }

    function handleDeletePage() {
        const current = documentRef.current;
        if (!current || current.pages.length <= 1) {
            setStatus('악보는 최소 1페이지 이상 유지되어야 합니다.');
            return;
        }
        if (typeof window !== 'undefined' && !window.confirm(`${page}페이지를 완전히 삭제하시겠습니까?`)) {
            return;
        }
        const nextPages = current.pages.filter((_, idx) => idx !== page - 1);
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: nextPages,
        });
        if (page > nextPages.length) {
            onPageChange(nextPages.length);
        }
        setStatus(`${page}페이지가 삭제되었습니다.`);
    }

    function clearPageMarks() {
        const current = documentRef.current;
        if (!current || !current.pages[page - 1]?.marks.length) return;
        if (typeof window !== 'undefined' && !window.confirm('현재 페이지의 모든 필기를 지우시겠습니까?')) {
            return;
        }
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: [] } : item
            ),
        });
    }

    async function publish() {
        if (!draft) return;
        setBusy(true);
        try {
            await writeQueue.current;
            await saveSheet(publishedKey, draft);
            setPublished(draft);
            setView('published');
            channelRef.current?.postMessage('published');
            setStatus('이 브라우저의 팀 공유본 갱신됨 · 다른 기기는 공유 파일을 전달해주세요.');
        } catch {
            setStatus('공유본 저장 실패 · 다시 시도해주세요.');
        } finally {
            setBusy(false);
        }
    }

    function download() {
        if (!published) return;
        downloadFile(new Blob([JSON.stringify(published)], { type: 'application/json' }), `${title.replace(/[<>:"/\\|?*]/g, '_')}-공유악보.json`);
        setStatus('공유 파일을 내려받았습니다. 팀원에게 전달 후 공유 파일 열기로 확인해주세요.');
    }

    async function printSheet() {
        const pages = shown?.pages;
        if (!pages?.length) return;
        setBusy(true);
        try {
            const urls: string[] = [];
            for (const [index, item] of pages.entries()) {
                setImportProgress(`인쇄할 악보 ${index + 1}/${pages.length}페이지 만드는 중…`);
                urls.push(URL.createObjectURL(await renderSheetPageImage(item, { withMarks: exportMarks })));
            }
            setPrintImages(urls);
            setStatus(`${pages.length}페이지를 인쇄 창으로 보냈습니다. ‘PDF로 저장’을 고르면 PDF 파일로 남습니다.`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : '인쇄용 악보를 만들지 못했습니다.');
        } finally {
            setBusy(false);
            setImportProgress(null);
        }
    }

    /** The page on screen as a JPEG file, marks burned in unless turned off. */
    async function currentPageFile(): Promise<File | null> {
        if (!activePage) return null;
        const blob = await renderSheetPageImage(activePage, { withMarks: exportMarks });
        return new File([blob], `${sheetFileStem(title)}-${page}p.jpg`, { type: 'image/jpeg' });
    }

    async function saveCurrentPageImage() {
        setBusy(true);
        try {
            const file = await currentPageFile();
            if (!file) return;
            downloadFile(file, file.name);
            setStatus(`${page}페이지를 이미지로 저장했습니다${exportMarks ? ' (필기 포함)' : ''}.`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : '이미지를 만들지 못했습니다.');
        } finally {
            setBusy(false);
        }
    }

    async function shareCurrentPageImage() {
        setBusy(true);
        try {
            const file = await currentPageFile();
            if (!file) return;
            await navigator.share({ files: [file], title: `${title} ${page}p` });
            setStatus('악보 이미지를 공유했습니다.');
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('공유하지 못했습니다. 이미지 저장으로 내려받아 보내주세요.');
        } finally {
            setBusy(false);
        }
    }

    function renderLiveStroke(ratio: number) {
        if (!stroke) return null;
        if (stroke.kind === 'pen' || stroke.kind === 'highlighter') {
            const isHighlighter = stroke.kind === 'highlighter';
            return (
                <path
                    ref={(element) => {
                        liveRef.current = element;
                    }}
                    d={pointsToSvgPath(stroke.points, ratio)}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.strokeWidth || (isHighlighter ? 16 : 2.5)}
                    strokeLinecap={isHighlighter ? 'square' : 'round'}
                    strokeLinejoin="round"
                    style={isHighlighter ? { mixBlendMode: 'multiply', opacity: stroke.opacity ?? 0.45 } : undefined}
                    pointerEvents="none"
                />
            );
        }
        if (stroke.kind === 'line') {
            return (
                <path
                    ref={(element) => {
                        liveRef.current = element;
                    }}
                    d={lineMarkPath(stroke, ratio)}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.strokeWidth || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="none"
                />
            );
        }
        if (stroke.kind === 'rect') {
            const box = liveBox(stroke);
            return stroke.shape === 'ellipse' ? (
                <ellipse
                    ref={(element) => {
                        liveRef.current = element;
                    }}
                    cx={box.x + box.width / 2}
                    cy={box.y + box.height / 2}
                    rx={box.width / 2}
                    ry={box.height / 2}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.strokeWidth || 3}
                    pointerEvents="none"
                />
            ) : (
                <rect
                    ref={(element) => {
                        liveRef.current = element;
                    }}
                    {...box}
                    fill={stroke.color}
                    fillOpacity={stroke.opacity ?? 0.15}
                    stroke={stroke.color}
                    strokeWidth={stroke.strokeWidth || 3}
                    rx="6"
                    pointerEvents="none"
                />
            );
        }
        return null;
    }

    function renderSongFormMark(mark: SheetMark, interactive: boolean, ratio: number) {
        const drag = interactive && songFormDrag?.id === mark.id ? songFormDrag : null;
        const editing = interactive && isSongFormEditing;
        const shared = {
            anchor: drag?.anchor ?? mark.points[0],
            ratio,
            fontSize: mark.fontSize,
            opacity: mark.opacity,
            dragging: Boolean(drag),
            selected: editing,
            focused: editing && selectedSongFormMark?.id === mark.id,
            className: tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : '',
            onClick: (e: ReactMouseEvent<SVGGElement>) => {
                if (tool === 'eraser') {
                    e.stopPropagation();
                    removeMark(mark.id);
                }
            },
        };
        return mark.kind === 'section' ? (
            <SongFormSectionMarker
                key={mark.id}
                {...shared}
                label={mark.text ?? ''}
                current={stepper.active && stepper.stop?.markId === mark.id}
                onRemove={editing ? () => removeMark(mark.id) : undefined}
            />
        ) : (
            <SongFormMarkup
                key={mark.id}
                {...shared}
                sections={mark.sections ?? []}
                currentIndex={stepper.active && stepper.route?.bandId === mark.id ? stepper.index : null}
                onRemoveChip={editing ? removeSongFormChip : undefined}
            />
        );
    }

    function renderMarkList(marks: SheetMark[], interactive: boolean, ratio: number) {
        const songForms = marks.filter((m) => m.kind === 'songform');
        const sectionMarkers = marks.filter((m) => m.kind === 'section');

        return (
            <>
                <SheetInkLayer marks={marks} ratio={ratio} erasable={interactive && tool === 'eraser'} onErase={eraseMark} />
                {interactive ? renderLiveStroke(ratio) : null}
                {songForms.map((mark) => renderSongFormMark(mark, interactive, ratio))}
                {sectionMarkers.map((mark) => renderSongFormMark(mark, interactive, ratio))}
                {interactive && songFormDrag?.guideX != null ? (
                    <line
                        x1={songFormDrag.guideX}
                        x2={songFormDrag.guideX}
                        y1={0}
                        y2={1000 * ratio}
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        strokeDasharray="6 6"
                        pointerEvents="none"
                    />
                ) : null}
                {interactive && isSongFormEditing && songFormMode === 'band' && !songForms.length ? (
                    <SongFormMarkupPlaceholder
                        anchor={pendingSongFormAnchor?.page === page ? pendingSongFormAnchor.point : SONG_FORM_DEFAULT_ANCHOR}
                        ratio={ratio}
                        fontSize={songFormFontSize}
                    />
                ) : null}
            </>
        );
    }

    return (
        <section
            ref={sectionRef}
            className={`min-w-0 space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6 shadow-2xl' : ''}`}
            aria-label="악보와 필기"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">악보 · 필기</h3>
                <span className="text-xs text-muted-foreground">기기 저장 프로토타입</span>
            </div>
            <p className="text-sm text-muted-foreground">
                내 필기를 저장한 뒤 전체 공유본으로 확정하세요. 다른 기기로는 악보와 필기가 담긴 공유 파일을 전달합니다.
            </p>
            <div className="flex flex-wrap gap-2">
                <label className={`${button} cursor-pointer`}>
                    <FileUp size={16} /> PDF / 이미지 추가
                    <input
                        aria-label="악보 파일 추가"
                        className="sr-only"
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        multiple
                        disabled={busy || !loaded}
                        onChange={(e) => {
                            void upload(Array.from(e.target.files ?? []));
                            e.target.value = '';
                        }}
                    />
                </label>
                <label className={`${button} cursor-pointer`}>
                    공유 파일 열기
                    <input
                        aria-label="공유 악보 파일 열기"
                        className="sr-only"
                        type="file"
                        accept="application/json,.json"
                        disabled={busy || !loaded}
                        onChange={(e) => {
                            void upload(Array.from(e.target.files ?? []), true);
                            e.target.value = '';
                        }}
                    />
                </label>
                <button
                    type="button"
                    className={`${button} border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-400/20`}
                    disabled={busy || !loaded}
                    onClick={() => {
                        const sampleDoc = createSampleSheetDocument(title);
                        persist(sampleDoc);
                        setView('draft');
                        if (canTurnPage) onPageChange(1);
                        setStatus('체험용 샘플 악보 2장을 불러왔습니다.');
                    }}
                >
                    <Sparkles size={16} className="text-amber-500" />
                    체험용 샘플 악보 불러오기
                </button>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="필기 버전">
                <button
                    className={`${button} ${view === 'draft' ? 'bg-primary text-primary-foreground' : ''}`}
                    aria-pressed={view === 'draft'}
                    onClick={() => setView('draft')}
                >
                    내 필기
                </button>
                <button
                    className={`${button} ${view === 'published' ? 'bg-primary text-primary-foreground' : ''}`}
                    aria-pressed={view === 'published'}
                    onClick={() => setView('published')}
                >
                    팀 공유본 {published ? `· ${published.pages.length}p` : '없음'}
                </button>
            </div>
            {showTools && view === 'draft' && (
                <div className="space-y-3 rounded-2xl border border-primary/10 bg-card/40 p-3 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="필기 도구">
                        <button className={`${button} ${tool === 'move' ? 'bg-primary text-primary-foreground' : ''}`} aria-pressed={tool === 'move'} onClick={() => setTool('move')}>
                            <Hand size={16} /> 이동
                        </button>
                        <button className={`${button} ${tool === 'songform' ? 'bg-violet-500/20 border-violet-400 text-violet-700 dark:text-violet-300 font-bold' : ''}`} aria-pressed={tool === 'songform'} onClick={() => setTool('songform')}>
                            <ListMusic size={16} /> 송폼
                        </button>
                        <button className={`${button} ${tool === 'pen' ? 'bg-primary text-primary-foreground' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
                            <Pencil size={16} /> 펜
                        </button>
                        <button className={`${button} ${tool === 'highlighter' ? 'bg-amber-400/20 border-amber-400 text-amber-700 dark:text-amber-300 font-bold' : ''}`} aria-pressed={tool === 'highlighter'} onClick={() => setTool('highlighter')}>
                            <Highlighter size={16} /> 형광펜
                        </button>
                        <button className={`${button} ${tool === 'text' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold' : ''}`} aria-pressed={tool === 'text'} onClick={() => setTool('text')}>
                            <Type size={16} /> 텍스트/코드
                        </button>
                        <button className={`${button} ${tool === 'rect' ? 'bg-indigo-500/20 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold' : ''}`} aria-pressed={tool === 'rect'} onClick={() => setTool('rect')}>
                            <Square size={16} /> 구역 박스
                        </button>
                        <button className={`${button} ${tool === 'line' ? 'bg-sky-500/20 border-sky-400 text-sky-700 dark:text-sky-300 font-bold' : ''}`} aria-pressed={tool === 'line'} onClick={() => setTool('line')}>
                            <MoveUpRight size={16} /> 선·화살표
                        </button>
                        <button className={`${button} ${tool === 'eraser' ? 'bg-rose-500/20 border-rose-400 text-rose-700 dark:text-rose-300 font-bold' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
                            <Eraser size={16} /> 지우개
                        </button>

                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/15 bg-background/80 px-2.5 py-1.5 text-xs font-semibold">
                            <span className="text-muted-foreground">스탬프:</span>
                            <select
                                aria-label="스탬프 문구 선택"
                                value={stamp}
                                onChange={(e) => {
                                    setStamp(e.target.value);
                                    setTool('stamp');
                                }}
                                className="bg-transparent font-bold text-primary focus:outline-hidden"
                            >
                                {WORSHIP_STAMP_PRESETS.map((label) => (
                                    <option key={label} value={label}>{label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className={`rounded-lg px-2 py-1 text-xs font-bold transition ${tool === 'stamp' ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                                onClick={() => setTool('stamp')}
                            >
                                찍기
                            </button>
                        </div>

                        <button className={button} disabled={!activePage?.marks.length || busy} onClick={undo} title="실행 취소">
                            <Undo2 size={16} /> 되돌리기
                        </button>
                        <button className={button} disabled={!redoStack.length || busy} onClick={redo} title="다시 실행">
                            <Redo2 size={16} /> 다시 실행
                        </button>
                        <button
                            className={button}
                            disabled={!activePage?.marks.length || busy}
                            onClick={clearPageMarks}
                            title="현재 페이지의 모든 필기 삭제"
                        >
                            <Trash2 size={16} /> 전체 지우기
                        </button>
                    </div>

                    {/* Tool Detail Options (Colors & Stroke Widths) */}
                    <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-primary/10">
                        {tool === 'songform' && (
                            <div className="w-full space-y-2.5" role="group" aria-label="송폼 칩">
                                {(shown?.pages.length ?? 0) > 1 && (
                                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="송폼을 얹을 페이지">
                                        <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">페이지</span>
                                        {shown?.pages.map((item, index) => {
                                            const hasMarkup = item.marks.some(isSongFormMark);
                                            return (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    aria-pressed={page === index + 1}
                                                    aria-label={`${index + 1}페이지${hasMarkup ? ' · 송폼 있음' : ''}`}
                                                    title={canTurnPage ? undefined : '라이브 페이지는 그대로 두고 이 페이지만 열어 편집합니다'}
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (canTurnPage) onPageChange(index + 1);
                                                        else setEditPage(index + 1);
                                                    }}
                                                    className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground relative min-w-12`}
                                                >
                                                    {index + 1}p
                                                    {hasMarkup && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-500" aria-hidden />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="송폼 입력 방식">
                                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">방식</span>
                                    <button type="button" aria-pressed={songFormMode === 'band'} onClick={() => setSongFormMode('band')} className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}>
                                        송폼 띠 (상단)
                                    </button>
                                    <button type="button" aria-pressed={songFormMode === 'section'} onClick={() => setSongFormMode('section')} className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}>
                                        마디 섹션
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">섹션</span>
                                    {SONG_FORM_CHIPS.map((chip) => {
                                        const armed = songFormMode === 'section' && armedSection === chip.label;
                                        return (
                                            <button
                                                key={chip.label}
                                                type="button"
                                                title={songFormMode === 'band' ? `${chip.name} 추가` : `${chip.name} 표시를 마디에 놓기`}
                                                aria-pressed={songFormMode === 'section' ? armed : undefined}
                                                disabled={busy || !activePage || (songFormMode === 'band' && songFormSections.length >= SONG_FORM_MAX_SECTIONS)}
                                                onClick={() => handleSongFormChip(chip.label)}
                                                className={`tap-target min-w-12 rounded-xl px-3 text-sm font-black text-white shadow-xs transition hover:brightness-110 active:scale-95 disabled:opacity-40 ${
                                                    armed ? 'scale-105 ring-4 ring-amber-400 ring-offset-2 ring-offset-background' : ''
                                                }`}
                                                style={{ backgroundColor: songFormChipColor(chip.label) }}
                                            >
                                                {chip.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {songFormMode === 'band' ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">반복</span>
                                        {[2, 3].map((times) => (
                                            <button
                                                key={times}
                                                type="button"
                                                title={`마지막 칩을 ${times}번 반복으로 표시`}
                                                disabled={busy || !songFormSections.length}
                                                aria-pressed={splitRepeat(songFormSections[songFormSections.length - 1] ?? '').repeat === times}
                                                onClick={() => repeatLastSongFormChip(times)}
                                                className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground min-w-12`}
                                            >
                                                ×{times}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className={button}
                                            disabled={busy || !songFormSections.length}
                                            onClick={() => removeSongFormChip(songFormSections.length - 1)}
                                        >
                                            <Delete size={16} /> 마지막 칩
                                        </button>
                                        <button
                                            type="button"
                                            className={`${button} text-rose-600 border-rose-300/40 hover:bg-rose-500/10`}
                                            disabled={busy || !songFormSections.length}
                                            onClick={() => writeSongForm([])}
                                        >
                                            <Trash2 size={16} /> 송폼 지우기
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">표시</span>
                                        {pageSectionMarkers.length ? (
                                            [...pageSectionMarkers]
                                                .sort((a, b) => a.points[0][1] - b.points[0][1] || a.points[0][0] - b.points[0][0])
                                                .map((marker) => (
                                                    <button
                                                        key={marker.id}
                                                        type="button"
                                                        aria-label={`${marker.text} 표시 빼기`}
                                                        title="눌러서 이 표시 빼기"
                                                        disabled={busy}
                                                        onClick={() => removeMark(marker.id)}
                                                        className="group inline-flex min-h-8 items-center gap-0.5 rounded-lg px-2 text-xs font-black text-white transition active:scale-95"
                                                        style={{ backgroundColor: songFormChipColor(marker.text ?? '') }}
                                                    >
                                                        {marker.text}
                                                        <X size={11} className="opacity-60 group-hover:opacity-100" aria-hidden />
                                                    </button>
                                                ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground">이 페이지에 놓은 섹션 표시가 없습니다.</span>
                                        )}
                                        {pageSectionMarkers.length > 0 && (
                                            <button
                                                type="button"
                                                className={`${button} text-rose-600 border-rose-300/40 hover:bg-rose-500/10`}
                                                disabled={busy}
                                                onClick={() => replacePageMarks(currentPageMarks().filter((m) => m.kind !== 'section'))}
                                            >
                                                <Trash2 size={16} /> 섹션 표시 지우기
                                            </button>
                                        )}
                                    </div>
                                )}
                                {selectedSongFormMark && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="w-12 shrink-0 font-medium text-muted-foreground">선택</span>
                                        <span
                                            className="rounded-lg px-2 py-1 font-black text-white"
                                            style={{ backgroundColor: songFormChipColor(selectedSongFormMark.text ?? 'I') }}
                                        >
                                            {selectedSongFormMark.kind === 'section' ? selectedSongFormMark.text : '송폼 띠'}
                                        </span>
                                        <span className="text-muted-foreground">
                                            방향키로 조금씩 옮기고 Shift는 크게{selectedSongFormMark.kind === 'section' ? ', Delete로 지웁니다' : ''}. 마디 표시는 끌면 다른 표시와 세로줄이 맞춰집니다(Alt는 자유).
                                        </span>
                                        <button type="button" className={button} onClick={() => setSelectedSongFormId(null)}>
                                            선택 해제
                                        </button>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="송폼 크기와 스타일">
                                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">모양</span>
                                    {SONG_FORM_SIZES.map((size) => (
                                        <button
                                            key={size.fontSize}
                                            type="button"
                                            aria-pressed={songFormFontSize === size.fontSize}
                                            disabled={busy}
                                            onClick={() => applySongFormLook(size.fontSize, songFormTint)}
                                            className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
                                        >
                                            {size.label}
                                        </button>
                                    ))}
                                    <span className="mx-1 h-6 w-px bg-primary/15" aria-hidden />
                                    <button type="button" aria-pressed={!songFormTint} disabled={busy} onClick={() => applySongFormLook(songFormFontSize, false)} className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}>
                                        진하게
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={songFormTint}
                                        disabled={busy}
                                        title="악보가 비쳐 보이는 반투명 음영으로 표시합니다"
                                        onClick={() => applySongFormLook(songFormFontSize, true)}
                                        className={`${button} aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
                                    >
                                        반투명
                                    </button>
                                </div>
                                {songFormMode === 'band' && (
                                    <>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">프리셋</span>
                                            {SONG_FORM_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    className={button}
                                                    title={preset.sections.join(' → ')}
                                                    disabled={busy || !activePage}
                                                    onClick={() => writeSongForm(preset.sections)}
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                className={button}
                                                title="곡 라이브러리·유튜브 챕터로 저장한 송폼을 칩으로 가져옵니다"
                                                disabled={busy || !activePage}
                                                onClick={importSavedSongForm}
                                            >
                                                곡 송폼 불러오기
                                            </button>
                                        </div>
                                        <form
                                            className="flex flex-wrap items-center gap-1.5"
                                            aria-label="송폼 텍스트로 입력"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                applySongFormText(String(new FormData(event.currentTarget).get('songFormText') ?? ''));
                                            }}
                                        >
                                            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">텍스트</span>
                                            <input
                                                // Re-fills from the band whenever it changes; typing doesn't change the band until 적용.
                                                key={formatSongFormText(songFormSections)}
                                                ref={songFormTextRef}
                                                name="songFormText"
                                                type="text"
                                                defaultValue={formatSongFormText(songFormSections)}
                                                placeholder="I - V1 - C - V2 - C - B - C×2 - O"
                                                aria-label="송폼 텍스트"
                                                title="띄어쓰기, -, →로 칸을 나눕니다. 전주·1절·후렴·브릿지 같은 말과 ×2·x2·2번도 알아듣습니다."
                                                autoComplete="off"
                                                spellCheck={false}
                                                disabled={busy || !activePage}
                                                className="min-w-0 flex-1 basis-48 rounded-xl border border-primary/15 bg-background/80 px-3 py-2 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                                            />
                                            <button type="submit" className={button} disabled={busy || !activePage}>
                                                적용
                                            </button>
                                            <button
                                                type="button"
                                                className={button}
                                                disabled={busy || !songFormSections.length}
                                                title="곡 제목과 송폼을 한 줄 텍스트로 복사합니다"
                                                onClick={() => void copySongFormText()}
                                            >
                                                <Copy size={16} /> 복사
                                            </button>
                                        </form>
                                        <ol
                                            aria-label="현재 페이지 송폼 순서"
                                            className="flex min-h-11 flex-wrap items-center gap-1 rounded-xl border border-dashed border-primary/20 bg-background/60 px-2 py-1.5"
                                        >
                                            {songFormSections.length ? (
                                                songFormSections.map((label, index) => (
                                                    <li key={`${index}-${label}`} className="flex items-center gap-1">
                                                        {index > 0 && <ChevronRight size={12} className="text-muted-foreground" aria-hidden />}
                                                        <button
                                                            type="button"
                                                            aria-label={`${index + 1}번째 ${label} 빼기`}
                                                            title="눌러서 이 칩 빼기"
                                                            disabled={busy}
                                                            onClick={() => removeSongFormChip(index)}
                                                            className="group inline-flex min-h-8 items-center gap-0.5 rounded-lg px-2 text-xs font-black text-white transition active:scale-95"
                                                            style={{ backgroundColor: songFormChipColor(label) }}
                                                        >
                                                            {label}
                                                            <X size={11} className="opacity-60 group-hover:opacity-100" aria-hidden />
                                                        </button>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="text-xs text-muted-foreground">아직 송폼이 없습니다. 위 칩을 진행 순서대로 눌러보세요.</li>
                                            )}
                                        </ol>
                                    </>
                                )}
                            </div>
                        )}

                        {tool === 'line' && (
                            <>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="선 모양">
                                    <span className="font-medium text-muted-foreground">모양:</span>
                                    {LINE_SHAPE_OPTIONS.map((option) => (
                                        <button
                                            key={option.shape}
                                            type="button"
                                            title={option.title || undefined}
                                            aria-pressed={lineShape === option.shape}
                                            onClick={() => setLineShape(option.shape)}
                                            className="rounded-lg bg-muted px-2 py-0.5 text-xs font-bold transition hover:bg-muted/80 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs" role="group" aria-label="선 굵기">
                                    <span className="font-medium text-muted-foreground">굵기:</span>
                                    {[2, 3, 5].map((width) => (
                                        <button
                                            key={width}
                                            type="button"
                                            aria-pressed={lineWidth === width}
                                            onClick={() => setLineWidth(width)}
                                            className="rounded-lg bg-muted px-2 py-0.5 text-xs font-bold transition hover:bg-muted/80 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                                        >
                                            {width === 2 ? '얇게' : width === 3 ? '보통' : '굵게'}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {tool === 'rect' && (
                            <div className="flex items-center gap-1.5 text-xs" role="group" aria-label="구역 표시 모양">
                                <span className="font-medium text-muted-foreground">모양:</span>
                                {(['box', 'ellipse'] as const).map((shape) => (
                                    <button
                                        key={shape}
                                        type="button"
                                        aria-pressed={rectShape === shape}
                                        onClick={() => setRectShape(shape)}
                                        className="rounded-lg bg-muted px-2 py-0.5 text-xs font-bold transition hover:bg-muted/80 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                                    >
                                        {shape === 'box' ? '박스 ▢' : '동그라미 ◯'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'pen' && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-medium text-muted-foreground">선 굵기:</span>
                                {[
                                    { label: '얇게 (1.5px)', val: 1.5 },
                                    { label: '보통 (3px)', val: 3 },
                                    { label: '굵게 (6px)', val: 6 },
                                ].map((w) => (
                                    <button
                                        key={w.val}
                                        type="button"
                                        onClick={() => setPenWidth(w.val)}
                                        className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                                            penWidth === w.val ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                                        }`}
                                    >
                                        {w.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'highlighter' && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-medium text-muted-foreground">형광펜 굵기:</span>
                                {[
                                    { label: '보통 (16px)', val: 16 },
                                    { label: '굵게 (26px)', val: 26 },
                                    { label: '와이드 (38px)', val: 38 },
                                ].map((w) => (
                                    <button
                                        key={w.val}
                                        type="button"
                                        onClick={() => setHighlighterWidth(w.val)}
                                        className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                                            highlighterWidth === w.val ? 'bg-amber-400 text-black' : 'bg-muted hover:bg-muted/80'
                                        }`}
                                    >
                                        {w.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'text' && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-medium text-muted-foreground">글자 크기:</span>
                                {[
                                    { label: '작게 (16pt)', val: 16 },
                                    { label: '보통 (20pt)', val: 20 },
                                    { label: '크게 (26pt)', val: 26 },
                                ].map((s) => (
                                    <button
                                        key={s.val}
                                        type="button"
                                        onClick={() => setTextFontSize(s.val)}
                                        className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                                            textFontSize === s.val ? 'bg-emerald-600 text-white' : 'bg-muted hover:bg-muted/80'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'highlighter' ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">색상:</span>
                                {HIGHLIGHTER_COLORS.map((value, i) => (
                                    <button
                                        key={value}
                                        aria-label={`형광펜 색상 ${i + 1}`}
                                        aria-pressed={highlighterColor === value}
                                        onClick={() => setHighlighterColor(value)}
                                        className={`tap-target flex items-center justify-center rounded-full border-2 ${
                                            highlighterColor === value ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                                        }`}
                                    >
                                        <span className="h-6 w-6 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: value }} />
                                    </button>
                                ))}
                            </div>
                        ) : tool === 'pen' || tool === 'stamp' || tool === 'text' || tool === 'rect' || tool === 'line' ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">색상:</span>
                                {SHEET_COLORS.map((value, i) => (
                                    <button
                                        key={value}
                                        aria-label={`필기 색상 ${i + 1}`}
                                        aria-pressed={color === value}
                                        onClick={() => setColor(value)}
                                        className={`tap-target flex items-center justify-center rounded-full border-2 ${
                                            color === value ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                                        }`}
                                    >
                                        <span className="h-5 w-5 rounded-full shadow-xs" style={{ backgroundColor: value }} />
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {tool === 'move'
                            ? '이동 모드에서는 손가락으로 화면을 스크롤할 수 있습니다.'
                            : tool === 'songform'
                                ? songFormMode === 'band'
                                    ? '칩을 누를 때마다 이 페이지 상단에 송폼이 얹힙니다. 띠를 끌어 옮기고, 칩에 마우스를 올리면 나오는 ×로 뺍니다. 공유본·공유 파일에 함께 담깁니다.'
                                    : armedSection
                                        ? `악보에서 ‘${armedSection}’ 섹션이 시작되는 마디를 누르면 표시가 놓입니다. 놓은 표시는 끌어서 옮기고 ×로 지웁니다.`
                                        : '섹션 칩을 고른 뒤 악보에서 그 섹션이 시작되는 마디를 누르세요.'
                            : tool === 'pen'
                                ? '악보 위에 손가락이나 펜으로 그리세요. 스크롤하려면 이동을 누르세요.'
                                : tool === 'highlighter'
                                    ? '악보 가사와 마디 위에 굵은 반투명 형광펜으로 강조 표시합니다.'
                                    : tool === 'text'
                                        ? '악보 원하는 위치를 클릭하여 코드(Capo 2, F#m7)나 연주 메모를 입력하세요.'
                                        : tool === 'rect'
                                            ? rectShape === 'ellipse'
                                                ? '대각선으로 끌어 음표나 마디에 동그라미를 칩니다.'
                                                : '마우스/손가락을 대각선으로 드래그하여 특정 마디나 섹션에 하이라이트 박스를 치세요.'
                                            : tool === 'line'
                                                ? '시작점에서 끝점까지 끕니다. Shift를 누르면 가로·세로·45°로 곧게 맞춰집니다. 크레센도는 끝으로 갈수록 벌어집니다.'
                                            : tool === 'eraser'
                                                ? '지우고 싶은 필기, 텍스트, 스탬프를 터치하거나 드래그하여 지웁니다.'
                                                : `악보 위를 누르면 ‘${stamp}’ 스탬프가 놓입니다.`}
                    </p>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className={button}
                        disabled={!canTurnPage || page <= 1}
                        onClick={() => onPageChange(Math.max(1, page - (isDualPage ? 2 : 1)))}
                    >
                        이전
                    </button>
                    <span className="text-sm font-bold">
                        {isDualPage && shown && page + 1 <= shown.pages.length ? `${page}-${page + 1}` : page} / {shown?.pages.length ?? 0}p
                    </span>
                    {isEditingOtherPage && (
                        <button
                            type="button"
                            className={`${button} border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300`}
                            title="라이브 진행 중인 페이지로 돌아갑니다"
                            onClick={() => setEditPage(null)}
                        >
                            {page}p 편집 중 · 라이브 {livePage}p로
                        </button>
                    )}
                    <button
                        className={button}
                        disabled={!canTurnPage || page >= (shown?.pages.length ?? 0)}
                        onClick={() => onPageChange(Math.min(shown?.pages.length ?? page, page + (isDualPage ? 2 : 1)))}
                    >
                        다음
                    </button>
                    {!isDualPage && (
                        <button className={button} aria-label="악보 확대 전환" onClick={() => setZoom(zoom === 1 ? 1.5 : 1)}>
                            {zoom === 1 ? '확대 150%' : '맞춤'}
                        </button>
                    )}

                    {/* Page Rotation Button */}
                    <button
                        type="button"
                        className={button}
                        disabled={!activePage || busy}
                        onClick={() => void handleRotatePage()}
                        title="스마트폰/스캔 악보 방향을 시계방향으로 90도 회전합니다"
                    >
                        <RotateCw size={15} />
                        <span>90° 회전</span>
                    </button>

                    {/* Page Delete Button */}
                    {(shown?.pages.length ?? 0) > 1 && (
                        <button
                            type="button"
                            className={`${button} text-rose-600 hover:bg-rose-500/10 border-rose-300/40`}
                            disabled={busy}
                            onClick={handleDeletePage}
                            title="현재 페이지 삭제"
                        >
                            <Trash2 size={15} />
                            <span>페이지 삭제</span>
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className={`${button} ${isDarkInverted ? 'border-amber-400/60 bg-amber-400/15 text-amber-600 dark:text-amber-300 font-bold' : ''}`}
                        title="무대 어두운 조명에서 눈부심을 방지하는 흑백 반전 모드"
                        onClick={() => setIsDarkInverted((prev) => !prev)}
                    >
                        {isDarkInverted ? <Sun size={16} /> : <Moon size={16} />}
                        <span className="text-xs">{isDarkInverted ? '라이트' : '다크 악보'}</span>
                    </button>

                    <button
                        className={`${button} ${isDualPage ? 'border-primary bg-primary text-primary-foreground font-bold' : ''}`}
                        title="가로 모드에서 2페이지 나란히 펼침 보기"
                        onClick={() => setIsDualPage((prev) => !prev)}
                    >
                        <BookOpen size={16} />
                        <span className="text-xs">{isDualPage ? '1쪽 보기' : '2쪽 펼침'}</span>
                    </button>

                    <button
                        className={button}
                        title="필기 도구 숨기기 / 펼치기"
                        onClick={() => setShowTools((prev) => !prev)}
                    >
                        <span className="text-xs">{showTools ? '도구 숨김' : '도구 펼침'}</span>
                    </button>

                    {isWakeLockSupported && (
                        <button
                            className={`${button} ${
                                isWakeLockActive ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300' : ''
                            }`}
                            title="연주 중 화면이 꺼지지 않도록 방지합니다"
                            onClick={toggleWakeLock}
                        >
                            {isWakeLockActive ? <Sun size={16} /> : <SunDim size={16} />}
                            <span className="text-xs">화면 {isWakeLockActive ? '켜짐 유지' : '자동 꺼짐'}</span>
                        </button>
                    )}
                    {isFullscreenSupported && (
                        <button
                            className={button}
                            title="무대 모드: 브라우저 바를 숨기고 악보를 전체 화면으로 봅니다"
                            onClick={() => void toggleFullscreen(sectionRef.current || undefined)}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            <span className="text-xs">{isFullscreen ? '전체화면 해제' : '무대 전체화면'}</span>
                        </button>
                    )}
                </div>
            </div>
            {shown?.pages.length ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>💡</span>
                    <span>
                        {stepper.active
                            ? '페달·방향키가 송폼 순서대로 섹션을 넘기고, 섹션 표시가 있는 페이지로 자동으로 넘어갑니다. 송폼 끝에서는 다시 페이지를 넘깁니다.'
                            : `블루투스 페달 또는 키보드 방향키(←, →), PageUp/Down으로 ${isDualPage ? '2페이지씩' : '악보를'} 넘길 수 있습니다.`}
                    </span>
                    {stepper.available && (
                        <span className="inline-flex items-center gap-1" role="group" aria-label="페달 동작">
                            <button
                                type="button"
                                aria-pressed={!stepper.sectionMode}
                                onClick={() => stepper.setSectionMode(false)}
                                className="rounded-lg border border-primary/15 px-2 py-1 font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                            >
                                페이지 넘김
                            </button>
                            <button
                                type="button"
                                aria-pressed={stepper.sectionMode}
                                title={canTurnPage ? '송폼 순서대로 섹션 표시를 따라갑니다' : '리더를 따라가는 중에는 페이지를 넘길 수 없어 섹션 이동도 쉬어 갑니다'}
                                onClick={() => stepper.setSectionMode(true)}
                                className="rounded-lg border border-primary/15 px-2 py-1 font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                            >
                                섹션 이동
                            </button>
                        </span>
                    )}
                    {stepper.active && (
                        <span className="inline-flex items-center gap-1">
                            <button type="button" className={button} aria-label="이전 섹션" onClick={() => stepSection(-1) || setStatus('송폼의 첫 섹션입니다.')}>
                                <ChevronLeft size={16} />
                            </button>
                            <span className="min-w-20 text-center font-semibold text-foreground" aria-live="polite">
                                {stepper.stop ? `${stepper.stop.label} · ${(stepper.index ?? 0) + 1}/${stepper.total}` : `${stepper.total}개 섹션`}
                            </span>
                            <button type="button" className={button} aria-label="다음 섹션" onClick={() => stepSection(1) || setStatus('송폼의 마지막 섹션입니다.')}>
                                <ChevronRight size={16} />
                            </button>
                        </span>
                    )}
                </div>
            ) : null}
            <div className={`relative overflow-auto rounded-xl border border-primary/15 transition-all ${
                isDarkInverted ? 'bg-[#0a0f0e] dark-sheet-invert' : 'bg-white text-gray-900'
            }`}>
                {/* Song Form Roadmap Overlay on Sheet Music — yields to a song form band burned into the page */}
                {activePage && !isSongFormEditing && !activePage.marks.some((m) => m.kind === 'songform') && (
                    <SongFormScoreOverlay
                        teamId={teamId}
                        songId={songId}
                        page={page}
                        totalPages={shown?.pages.length ?? 1}
                        displayMode={songFormOverlayMode}
                        onDisplayModeChange={(m) => {
                            setSongFormOverlayMode(m);
                            try {
                                window.localStorage.setItem('wt_sheet_songform_mode', m);
                            } catch {}
                        }}
                        isDarkInverted={isDarkInverted}
                    />
                )}

                {isDualPage && shown ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 bg-neutral-900/10">
                        {/* 1번째 페이지 (page) */}
                        {activePage ? (
                            <div
                                className="relative overflow-hidden rounded-lg bg-white shadow-xs"
                                style={{ aspectRatio: `${activePage.width}/${activePage.height}` }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={activePage.image}
                                    alt={`${title} 악보 ${page}페이지`}
                                    className="block h-full w-full"
                                    draggable={false}
                                />
                                <svg
                                    data-testid="sheet-overlay"
                                    aria-label="악보 필기 영역"
                                    className="absolute inset-0 h-full w-full"
                                    viewBox={`0 0 1000 ${(1000 * activePage.height) / activePage.width}`}
                                    preserveAspectRatio="none"
                                    style={{
                                        touchAction: view === 'draft' && tool !== 'move' ? 'none' : 'auto',
                                        cursor:
                                            tool === 'move' || (tool === 'songform' && songFormMode === 'band')
                                                ? 'grab'
                                                : tool === 'eraser'
                                                    ? 'pointer'
                                                    : tool === 'stamp'
                                                        ? 'copy'
                                                        : 'crosshair',
                                    }}
                                    onPointerDown={pointerDown}
                                    onPointerMove={pointerMove}
                                    onPointerUp={pointerUp}
                                    onPointerCancel={cancelPointer}
                                >
                                    {renderMarkList(activePage.marks, true, pageRatio)}
                                </svg>
                                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                                    {page}p
                                </span>
                            </div>
                        ) : null}

                        {/* 2번째 페이지 (page + 1) */}
                        {page < shown.pages.length && shown.pages[page] ? (
                            <div
                                className="relative overflow-hidden rounded-lg bg-white shadow-xs"
                                style={{ aspectRatio: `${shown.pages[page].width}/${shown.pages[page].height}` }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={shown.pages[page].image}
                                    alt={`${title} 악보 ${page + 1}페이지`}
                                    className="block h-full w-full"
                                    draggable={false}
                                />
                                <svg
                                    aria-label="2페이지 필기 오버레이"
                                    className="absolute inset-0 h-full w-full pointer-events-none"
                                    viewBox={`0 0 1000 ${(1000 * shown.pages[page].height) / shown.pages[page].width}`}
                                    preserveAspectRatio="none"
                                >
                                    {renderMarkList(shown.pages[page].marks, false, shown.pages[page].height / shown.pages[page].width)}
                                </svg>
                                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                                    {page + 1}p
                                </span>
                            </div>
                        ) : (
                            <div className="hidden md:flex items-center justify-center rounded-lg border border-dashed border-muted p-8 text-xs text-muted-foreground">
                                마지막 페이지입니다.
                            </div>
                        )}
                    </div>
                ) : activePage ? (
                    <div
                        className="relative"
                        style={{ width: `${zoom * 100}%`, aspectRatio: `${activePage.width}/${activePage.height}` }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={activePage.image}
                            alt={`${title} 악보 ${page}페이지`}
                            className="block h-full w-full"
                            draggable={false}
                        />
                        <svg
                            data-testid="sheet-overlay"
                            aria-label="악보 필기 영역"
                            className="absolute inset-0 h-full w-full"
                            viewBox={`0 0 1000 ${(1000 * activePage.height) / activePage.width}`}
                            preserveAspectRatio="none"
                            style={{
                                touchAction: view === 'draft' && tool !== 'move' ? 'none' : 'auto',
                                cursor:
                                    tool === 'move' || (tool === 'songform' && songFormMode === 'band')
                                        ? 'grab'
                                        : tool === 'eraser'
                                            ? 'pointer'
                                            : tool === 'stamp'
                                                ? 'copy'
                                                : 'crosshair',
                            }}
                            onPointerDown={pointerDown}
                            onPointerMove={pointerMove}
                            onPointerUp={pointerUp}
                            onPointerCancel={cancelPointer}
                        >
                            {renderMarkList(activePage.marks, true, pageRatio)}
                        </svg>
                    </div>
                ) : (
                    <div className="px-6 py-16 text-center text-sm text-gray-600">
                        {shown
                            ? '이 페이지에 악보가 없습니다. 페이지를 이동해주세요.'
                            : view === 'published'
                              ? '아직 공유된 악보가 없습니다.'
                              : '가지고 있는 PDF 또는 이미지 악보를 추가하세요.'}
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    className={`${button} bg-primary text-primary-foreground`}
                    disabled={!draft || busy}
                    onClick={() => void publish()}
                >
                    <Share2 size={16} /> 전체 공유본으로 저장
                </button>
                <button className={button} disabled={!published || busy} onClick={download}>
                    <Download size={16} /> 공유 파일 내려받기
                </button>
                {view === 'published' && published && (
                    <button
                        className={button}
                        disabled={busy}
                        onClick={() => {
                            persist(structuredClone(published));
                            setView('draft');
                        }}
                    >
                        공유본을 내 필기로 복사
                    </button>
                )}
            </div>
            {shown?.pages.length ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="악보 출력">
                    <span className="text-xs font-bold text-muted-foreground">출력</span>
                    <button className={button} disabled={busy} onClick={() => void printSheet()} title="모든 페이지를 인쇄합니다. 인쇄 창에서 ‘PDF로 저장’을 고르면 PDF 파일이 됩니다.">
                        <Printer size={16} /> 인쇄 · PDF ({shown.pages.length}p)
                    </button>
                    <button className={button} disabled={busy || !activePage} onClick={() => void saveCurrentPageImage()}>
                        <ImageDown size={16} /> {page}p 이미지 저장
                    </button>
                    {canShareFiles && (
                        <button className={button} disabled={busy || !activePage} onClick={() => void shareCurrentPageImage()} title="카카오톡 등 다른 앱으로 이 페이지 이미지를 보냅니다">
                            <Share2 size={16} /> {page}p 이미지 공유
                        </button>
                    )}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <input type="checkbox" checked={exportMarks} onChange={(e) => setExportMarks(e.target.checked)} className="size-4 accent-primary" />
                        필기·송폼 포함
                    </label>
                    <span className="text-xs text-muted-foreground">{view === 'published' ? '팀 공유본' : '내 필기'} 기준</span>
                </div>
            ) : null}
            {printImages &&
                createPortal(
                    <div id="sheet-print-root" aria-hidden>
                        <style>{PRINT_CSS}</style>
                        {printImages.map((src, index) => (
                            <div key={src} className="sheet-print-page">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={`${title} ${index + 1}페이지`} />
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
            <p role="status" className="text-sm font-medium text-muted-foreground">
                {busy ? (importProgress ?? '파일 처리 중…') : status}
            </p>

            {/* Text & Chord Input Dialog */}
            {textModal?.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-sm rounded-2xl border border-primary/20 bg-background p-4 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                            <span className="text-sm font-black flex items-center gap-1.5 text-foreground">
                                <Type size={16} className="text-primary" />
                                <span>악보 텍스트 / 코드 입력</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setTextModal(null)}
                                className="text-muted-foreground hover:text-foreground text-xs p-1"
                            >
                                ✕
                            </button>
                        </div>
                        <div>
                            <input
                                autoFocus
                                type="text"
                                value={textModal.text}
                                onChange={(e) => setTextModal({ ...textModal, text: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTextMark();
                                    if (e.key === 'Escape') setTextModal(null);
                                }}
                                placeholder="예: Capo 2, F#m7, 4마디 대기, 잔잔하게"
                                maxLength={100}
                                className="w-full rounded-xl border border-primary/25 bg-muted/40 px-3 py-2 text-sm font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        {/* Quick Worship Chord & Memo Shortcuts */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground">빠른 선택 프리셋:</span>
                            <div className="flex flex-wrap gap-1">
                                {['Capo 1', 'Capo 2', 'Key Up (반음↑)', '간주 4마디', '빌드업', '잔잔하게', 'All Out', '드럼 킥 진입'].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setTextModal({ ...textModal, text: preset })}
                                        className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/10">
                            <button
                                type="button"
                                onClick={() => setTextModal(null)}
                                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTextMark}
                                disabled={!textModal.text.trim()}
                                className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40 transition shadow"
                            >
                                악보에 삽입
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
