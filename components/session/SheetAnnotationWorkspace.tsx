'use client';

import { createClientId } from '@/lib/clientId';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { BookOpen, ChevronRight, Delete, Download, Eraser, FileUp, Hand, Highlighter, ListMusic, Maximize2, Minimize2, Moon, Pencil, Redo2, RotateCw, Share2, Sparkles, Square, Sun, SunDim, Trash2, Type, Undo2, X } from 'lucide-react';
import { usePageTurner } from '@/hooks/usePageTurner';
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
    pointsToSvgPath,
    type SheetDocument,
    type SheetMark,
} from '@/lib/sheetAnnotations';
import {
    abbreviateSectionLabel,
    layoutSongFormMarkup,
    songFormChipColor,
    splitRepeat,
    toggleRepeat,
    SONG_FORM_CHIPS,
    SONG_FORM_DEFAULT_ANCHOR,
    SONG_FORM_MAX_ANCHOR_X,
    SONG_FORM_MAX_SECTIONS,
    SONG_FORM_PRESETS,
    SONG_FORM_ROW_HEIGHT,
} from '@/lib/songFormMarkup';
import { readSongForm } from '@/lib/songFormStorage';
import SongFormScoreOverlay, { type SongFormOverlayDisplayMode } from './SongFormScoreOverlay';
import SongFormMarkup, { SongFormMarkupPlaceholder } from './SongFormMarkup';

type Props = {
    teamId: string;
    songId: string;
    title: string;
    page: number;
    onPageChange: (page: number) => void;
    canTurnPage: boolean;
    onPageCountChange?: (count: number) => void;
};

type SongFormDrag = { id: string; offset: [number, number]; anchor: [number, number] };

const button =
    'tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40';

export default function SheetAnnotationWorkspace({
    teamId,
    songId,
    title,
    page,
    onPageChange,
    canTurnPage,
    onPageCountChange,
}: Props) {
    const [draft, setDraft] = useState<SheetDocument | null>(null);
    const [published, setPublished] = useState<SheetDocument | null>(null);
    const [view, setView] = useState<'draft' | 'published'>('draft');
    const [tool, setTool] = useState<'move' | 'pen' | 'highlighter' | 'eraser' | 'stamp' | 'text' | 'rect' | 'songform'>('move');
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

    const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen } = useFullscreen();
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported, toggle: toggleWakeLock } = useScreenWakeLock(true);

    const draftKey = sheetKey(teamId, songId);
    const publishedKey = sheetKey(teamId, songId, true);
    const shown = view === 'draft' ? draft : published;
    const activePage = shown?.pages[page - 1];
    const pageRatio = activePage ? activePage.height / activePage.width : 1;
    const songFormSections = (view === 'draft' && activePage?.marks.find((m) => m.kind === 'songform')?.sections) || [];
    const isSongFormEditing = tool === 'songform' && view === 'draft';

    usePageTurner({
        onNext: () => {
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && shown && page + step <= shown.pages.length + (isDualPage ? 1 : 0)) {
                onPageChange(Math.min(shown.pages.length, page + step));
            }
        },
        onPrev: () => {
            const step = isDualPage ? 2 : 1;
            if (canTurnPage && page > 1) {
                onPageChange(Math.max(1, page - step));
            }
        },
        enabled: canTurnPage && Boolean(shown?.pages.length),
    });

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

    function persist(next: SheetDocument) {
        documentRef.current = next;
        setDraft(next);
        setStatus('저장 중…');
        writeQueue.current = writeQueue.current
            .catch(() => {})
            .then(() => saveSheet(draftKey, next));
        void writeQueue.current.then(
            () => setStatus('내 필기 저장됨 · 전체 공유 전'),
            () => setStatus('기기 저장 실패 · 공유 파일로 내려받아 보관해주세요.')
        );
    }

    async function upload(file?: File, sharedFile = false) {
        if (!file) return;
        setBusy(true);
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
                const pages = await importSheetPages(file);
                const existing = documentRef.current;
                if ((existing?.pages.length ?? 0) + pages.length > 20) {
                    throw new Error('한 곡에 최대 20페이지를 추가할 수 있습니다.');
                }
                persist({
                    version: 1,
                    title: title.slice(0, 200),
                    pages: [...(existing?.pages ?? []), ...pages],
                    updatedAt: new Date().toISOString(),
                });
                setView('draft');
            }
            if (canTurnPage) onPageChange(1);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : '파일을 불러오지 못했습니다.');
        } finally {
            setBusy(false);
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

    /** One song form band per page; reads documentRef so rapid chip taps never drop a chip. */
    function currentSongFormMark(): SheetMark | null {
        return documentRef.current?.pages[page - 1]?.marks.find((m) => m.kind === 'songform') ?? null;
    }

    function writeSongForm(sections: string[], anchor?: [number, number]) {
        const current = documentRef.current;
        const target = current?.pages[page - 1];
        if (!current || !target) return;
        const existing = currentSongFormMark();
        const nextSections = sections.slice(0, SONG_FORM_MAX_SECTIONS);
        let marks: SheetMark[];
        if (!nextSections.length) {
            marks = target.marks.filter((m) => m.kind !== 'songform');
        } else if (existing) {
            marks = target.marks.map((m) =>
                m.id === existing.id ? { ...m, sections: nextSections, points: anchor ? [anchor] : m.points } : m
            );
        } else {
            if (target.marks.length >= 2000) return;
            const start = anchor ?? (pendingSongFormAnchor?.page === page ? pendingSongFormAnchor.point : SONG_FORM_DEFAULT_ANCHOR);
            marks = [...target.marks, { id: createClientId(), kind: 'songform', color: '#0f172a', points: [start], sections: nextSections }];
        }
        setRedoStack([]);
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) => (index === page - 1 ? { ...item, marks } : item)),
        });
    }

    function appendSongFormChip(label: string) {
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

    function importSavedSongForm() {
        const saved = readSongForm(songId, teamId);
        if (!saved?.sections.length) {
            setStatus('이 곡에 저장된 송폼이 없습니다. 칩이나 프리셋으로 만들어주세요.');
            return;
        }
        writeSongForm(saved.sections.map((section) => abbreviateSectionLabel(section.label)));
    }

    /** Converts a pointer position (viewBox units) into a clamped band anchor (mark units). */
    function songFormAnchorAt(pointVb: [number, number], offset: [number, number], sections: string[]): [number, number] {
        const plateHeight = layoutSongFormMarkup(sections, [0, 0]).plate.height;
        const x = Math.max(0, Math.min(SONG_FORM_MAX_ANCHOR_X, pointVb[0] - offset[0]));
        const yVb = Math.max(0, Math.min(1000 * pageRatio - plateHeight, pointVb[1] - offset[1]));
        return [x, Math.max(0, Math.min(1000, yVb / pageRatio))];
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
            const [x, y] = position(event.clientX, event.clientY, event.currentTarget);
            const pointVb: [number, number] = [x, y * pageRatio];
            const existing = currentSongFormMark();
            if (!existing?.sections) {
                setPendingSongFormAnchor({ page, point: songFormAnchorAt(pointVb, [0, SONG_FORM_ROW_HEIGHT / 2], ['I']) });
                rectRef.current = null;
                return;
            }
            const anchorVb: [number, number] = [existing.points[0][0], existing.points[0][1] * pageRatio];
            // Grabbing the band keeps the grab offset; tapping elsewhere moves the band's first row there.
            const offset: [number, number] = isPointNearMark(x, y, existing, pageRatio, 0)
                ? [pointVb[0] - anchorVb[0], pointVb[1] - anchorVb[1]]
                : [0, SONG_FORM_ROW_HEIGHT / 2];
            event.currentTarget.setPointerCapture(event.pointerId);
            const drag = { id: existing.id, offset, anchor: songFormAnchorAt(pointVb, offset, existing.sections) };
            songFormDragRef.current = drag;
            setSongFormDrag(drag);
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
            };
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
            drag.anchor = songFormAnchorAt([x, y * pageRatio], drag.offset, currentSongFormMark()?.sections ?? []);
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

        if (tool === 'rect' && rectStart && strokeRef.current) {
            const currentPt = position(event.clientX, event.clientY, event.currentTarget);
            strokeRef.current.points = [rectStart, currentPt];
            setStroke({ ...strokeRef.current });
            return;
        }

        if (!strokeRef.current || !event.isPrimary) return;
        if (strokeRef.current.points.length >= 5000) return;
        const pt = position(event.clientX, event.clientY, event.currentTarget);
        strokeRef.current.points.push(pt);
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                if (strokeRef.current) setStroke({ ...strokeRef.current, points: [...strokeRef.current.points] });
            });
        }
    }

    function pointerUp() {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (songFormDragRef.current) {
            const sections = currentSongFormMark()?.sections;
            if (sections) writeSongForm(sections, songFormDragRef.current.anchor);
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
            setStatus(`${page}페이지가 90도 회전되었습니다.`);
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
        const url = URL.createObjectURL(new Blob([JSON.stringify(published)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/[<>:"/\\|?*]/g, '_')}-공유악보.json`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('공유 파일을 내려받았습니다. 팀원에게 전달 후 공유 파일 열기로 확인해주세요.');
    }

    function renderMark(mark: SheetMark) {
        const point = mark.points[0];
        const ratio = activePage ? activePage.height / activePage.width : 1;

        if (mark.kind === 'stamp') {
            return (
                <text
                    key={mark.id}
                    x={Math.min(point[0], 780)}
                    y={Math.max(point[1] * ratio, 25)}
                    fill={mark.color}
                    fontSize="25"
                    fontWeight="800"
                    stroke="white"
                    strokeWidth="3"
                    paintOrder="stroke"
                    className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}
                    onClick={(e) => {
                        if (tool === 'eraser') {
                            e.stopPropagation();
                            removeMark(mark.id);
                        }
                    }}
                >
                    {mark.text}
                </text>
            );
        }

        if (mark.kind === 'highlighter') {
            return (
                <path
                    key={mark.id}
                    d={pointsToSvgPath(mark.points, ratio)}
                    fill="none"
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 16}
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    style={{ mixBlendMode: 'multiply', opacity: mark.opacity ?? 0.45 }}
                    className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}
                    onClick={(e) => {
                        if (tool === 'eraser') {
                            e.stopPropagation();
                            removeMark(mark.id);
                        }
                    }}
                />
            );
        }

        if (mark.kind === 'text') {
            const fSize = mark.fontSize ?? 20;
            return (
                <g key={mark.id} className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}>
                    <rect
                        x={Math.min(point[0], 900) - 4}
                        y={Math.max(point[1] * ratio, 20) - fSize}
                        width={(mark.text?.length ?? 3) * (fSize * 0.65) + 8}
                        height={fSize + 6}
                        rx="4"
                        fill="rgba(0, 0, 0, 0.75)"
                    />
                    <text
                        x={Math.min(point[0], 900)}
                        y={Math.max(point[1] * ratio, 20) - 2}
                        fill={mark.color}
                        fontSize={fSize}
                        fontWeight="800"
                        fontFamily="monospace, sans-serif"
                        onClick={(e) => {
                            if (tool === 'eraser') {
                                e.stopPropagation();
                                removeMark(mark.id);
                            }
                        }}
                    >
                        {mark.text}
                    </text>
                </g>
            );
        }

        if (mark.kind === 'rect') {
            if (mark.points.length < 2) return null;
            const [p1, p2] = mark.points;
            const minX = Math.min(p1[0], p2[0]);
            const maxX = Math.max(p1[0], p2[0]);
            const minY = Math.min(p1[1], p2[1]) * ratio;
            const maxY = Math.max(p1[1], p2[1]) * ratio;
            return (
                <rect
                    key={mark.id}
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    fill={mark.color}
                    fillOpacity={mark.opacity ?? 0.15}
                    stroke={mark.color}
                    strokeWidth={mark.strokeWidth || 3}
                    rx="6"
                    className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}
                    onClick={(e) => {
                        if (tool === 'eraser') {
                            e.stopPropagation();
                            removeMark(mark.id);
                        }
                    }}
                />
            );
        }

        return (
            <path
                key={mark.id}
                d={pointsToSvgPath(mark.points, ratio)}
                fill="none"
                stroke={mark.color}
                strokeWidth={mark.strokeWidth || 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}
                onClick={(e) => {
                    if (tool === 'eraser') {
                        e.stopPropagation();
                        removeMark(mark.id);
                    }
                }}
            />
        );
    }

    function renderSongFormMark(mark: SheetMark, interactive: boolean) {
        const drag = interactive && songFormDrag?.id === mark.id ? songFormDrag : null;
        return (
            <SongFormMarkup
                key={mark.id}
                sections={mark.sections ?? []}
                anchor={drag?.anchor ?? mark.points[0]}
                ratio={pageRatio}
                dragging={Boolean(drag)}
                selected={interactive && isSongFormEditing}
                className={tool === 'eraser' ? 'cursor-pointer hover:opacity-40 transition' : ''}
                onClick={(e) => {
                    if (tool === 'eraser') {
                        e.stopPropagation();
                        removeMark(mark.id);
                    }
                }}
            />
        );
    }

    function renderMarkList(marks: SheetMark[], currentStroke?: SheetMark | null, interactive = true) {
        const highlighters = marks.filter((m) => m.kind === 'highlighter');
        const rects = marks.filter((m) => m.kind === 'rect');
        const pens = marks.filter((m) => m.kind === 'pen');
        const stamps = marks.filter((m) => m.kind === 'stamp');
        const texts = marks.filter((m) => m.kind === 'text');
        const songForms = marks.filter((m) => m.kind === 'songform');

        return (
            <>
                {highlighters.map(renderMark)}
                {currentStroke?.kind === 'highlighter' ? renderMark(currentStroke) : null}
                {rects.map(renderMark)}
                {currentStroke?.kind === 'rect' ? renderMark(currentStroke) : null}
                {pens.map(renderMark)}
                {currentStroke?.kind === 'pen' ? renderMark(currentStroke) : null}
                {stamps.map(renderMark)}
                {currentStroke?.kind === 'stamp' ? renderMark(currentStroke) : null}
                {texts.map(renderMark)}
                {currentStroke?.kind === 'text' ? renderMark(currentStroke) : null}
                {songForms.map((mark) => renderSongFormMark(mark, interactive))}
                {interactive && isSongFormEditing && !songForms.length ? (
                    <SongFormMarkupPlaceholder
                        anchor={pendingSongFormAnchor?.page === page ? pendingSongFormAnchor.point : SONG_FORM_DEFAULT_ANCHOR}
                        ratio={pageRatio}
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
                        disabled={busy || !loaded}
                        onChange={(e) => {
                            void upload(e.target.files?.[0]);
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
                            void upload(e.target.files?.[0], true);
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
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">섹션</span>
                                    {SONG_FORM_CHIPS.map((chip) => (
                                        <button
                                            key={chip.label}
                                            type="button"
                                            title={`${chip.name} 추가`}
                                            disabled={busy || !activePage || songFormSections.length >= SONG_FORM_MAX_SECTIONS}
                                            onClick={() => appendSongFormChip(chip.label)}
                                            className="tap-target min-w-12 rounded-xl px-3 text-sm font-black text-white shadow-xs transition hover:brightness-110 active:scale-95 disabled:opacity-40"
                                            style={{ backgroundColor: songFormChipColor(chip.label) }}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>
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
                                            className={`${button} min-w-12 aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
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
                        ) : tool === 'pen' || tool === 'stamp' || tool === 'text' || tool === 'rect' ? (
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
                                ? '칩을 누를 때마다 이 페이지 상단에 송폼이 마크업으로 얹힙니다. 악보를 누르거나 끌어서 위치를 옮기고, 공유본·공유 파일에 함께 담깁니다.'
                            : tool === 'pen'
                                ? '악보 위에 손가락이나 펜으로 그리세요. 스크롤하려면 이동을 누르세요.'
                                : tool === 'highlighter'
                                    ? '악보 가사와 마디 위에 굵은 반투명 형광펜으로 강조 표시합니다.'
                                    : tool === 'text'
                                        ? '악보 원하는 위치를 클릭하여 코드(Capo 2, F#m7)나 연주 메모를 입력하세요.'
                                        : tool === 'rect'
                                            ? '마우스/손가락을 대각선으로 드래그하여 특정 마디나 섹션에 하이라이트 박스를 치세요.'
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>💡</span>
                    <span>블루투스 페달 또는 키보드 방향키(←, →), PageUp/Down으로 {isDualPage ? '2페이지씩' : '악보를'} 넘길 수 있습니다.</span>
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
                                            tool === 'move' || tool === 'songform'
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
                                    {renderMarkList(activePage.marks, stroke)}
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
                                    {renderMarkList(shown.pages[page].marks, null, false)}
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
                                    tool === 'move' || tool === 'songform'
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
                            {renderMarkList(activePage.marks, stroke)}
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
            <p role="status" className="text-sm font-medium text-muted-foreground">
                {busy ? '파일 처리 중…' : status}
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
