'use client';

import { createClientId } from '@/lib/clientId';
import { memo, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react';
import { BookOpen, ChevronRight, Delete, Download, Eraser, FileUp, Hand, Highlighter, Keyboard, ListMusic, Maximize2, Minimize2, Moon, Pencil, Redo2, RotateCw, Share2, Sparkles, Square, Sun, SunDim, Trash2, Type, Undo2, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getSheetMarkPath } from '@/components/session/sheetMarkPath';
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
    type SheetDocument,
    type SheetMark,
    type SheetPage,
} from '@/lib/sheetAnnotations';
import {
    abbreviateSectionLabel,
    isSongFormTint,
    layoutSectionMarker,
    layoutSongFormMarkup,
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
};

const isSongFormMark = (mark: SheetMark) => mark.kind === 'songform' || mark.kind === 'section';

/** Outline pill. aria-pressed is the one selected state: a black pill (white in dark mode). */
const pill = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'h-10 touch-manipulation px-3.5 text-sm font-medium aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90'
);
/** Selected look for toggles whose label flips with the state (not announced as pressed). */
const pillOn = 'border-primary bg-primary text-primary-foreground hover:bg-primary/90';
const dangerPill = cn(buttonVariants({ variant: 'destructive-outline', size: 'sm' }), 'h-10 touch-manipulation px-3.5 text-sm font-medium');
/** Small option chips (선 굵기, 글자 크기, 프리셋 문구). */
const chip = 'inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors';
const chipOff = 'bg-muted text-foreground hover:bg-muted/70';
const chipOn = 'bg-primary text-primary-foreground';
/** Rows that wrap on wider screens and scroll sideways on a phone instead of stacking 5–6 lines. */
/** 내 필기 / 팀 공유본: the shared Segmented look (white chip on a gray track), kept as pressed buttons. */
const segment = 'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-xs';
const scrollRow = 'no-scrollbar flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible';

function SheetAnnotationWorkspace({
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
    const [songFormMode, setSongFormMode] = useState<'band' | 'section'>('band');
    const [armedSection, setArmedSection] = useState<string | null>(null);
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
                    pages.push(...(await importSheetPages(item)));
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

    function replacePageMarks(marks: SheetMark[]) {
        const current = documentRef.current;
        if (!current?.pages[page - 1]) return;
        setRedoStack([]);
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) => (index === page - 1 ? { ...item, marks } : item)),
        });
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
        const drag = { id: mark.id, offset, bounds, anchor: anchorWithin(pointVb, offset, bounds) };
        songFormDragRef.current = drag;
        setSongFormDrag(drag);
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
            drag.anchor = anchorWithin([x, y * pageRatio], drag.offset, drag.bounds);
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
                    d={getSheetMarkPath(mark, ratio)}
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
                d={getSheetMarkPath(mark, ratio)}
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
        const editing = interactive && isSongFormEditing;
        const shared = {
            anchor: drag?.anchor ?? mark.points[0],
            ratio: pageRatio,
            fontSize: mark.fontSize,
            opacity: mark.opacity,
            dragging: Boolean(drag),
            selected: editing,
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
                onRemove={editing ? () => removeMark(mark.id) : undefined}
            />
        ) : (
            <SongFormMarkup key={mark.id} {...shared} sections={mark.sections ?? []} onRemoveChip={editing ? removeSongFormChip : undefined} />
        );
    }

    function renderMarkList(marks: SheetMark[], currentStroke?: SheetMark | null, interactive = true) {
        const highlighters = marks.filter((m) => m.kind === 'highlighter');
        const rects = marks.filter((m) => m.kind === 'rect');
        const pens = marks.filter((m) => m.kind === 'pen');
        const stamps = marks.filter((m) => m.kind === 'stamp');
        const texts = marks.filter((m) => m.kind === 'text');
        const songForms = marks.filter((m) => m.kind === 'songform');
        const sectionMarkers = marks.filter((m) => m.kind === 'section');

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
                {sectionMarkers.map((mark) => renderSongFormMark(mark, interactive))}
                {interactive && isSongFormEditing && songFormMode === 'band' && !songForms.length ? (
                    <SongFormMarkupPlaceholder
                        anchor={pendingSongFormAnchor?.page === page ? pendingSongFormAnchor.point : SONG_FORM_DEFAULT_ANCHOR}
                        ratio={pageRatio}
                        fontSize={songFormFontSize}
                    />
                ) : null}
            </>
        );
    }

    return (
        <section
            ref={sectionRef}
            className={cn('min-w-0 space-y-4', isFullscreen && 'fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6')}
            aria-label="악보와 필기"
        >
            <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-[17px] font-semibold tracking-tight text-foreground">악보 · 필기</h3>
                    <span className="text-xs text-muted-foreground">기기 저장 프로토타입</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    내 필기를 저장한 뒤 전체 공유본으로 확정하세요. 다른 기기로는 악보와 필기가 담긴 공유 파일을 전달합니다.
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <label className={cn(pill, 'cursor-pointer has-[input:disabled]:opacity-40')}>
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
                <label className={cn(pill, 'cursor-pointer has-[input:disabled]:opacity-40')}>
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
                    className={pill}
                    disabled={busy || !loaded}
                    onClick={() => {
                        const sampleDoc = createSampleSheetDocument(title);
                        persist(sampleDoc);
                        setView('draft');
                        if (canTurnPage) onPageChange(1);
                        setStatus('체험용 샘플 악보 2장을 불러왔습니다.');
                    }}
                >
                    <Sparkles size={16} className="text-brand" />
                    체험용 샘플 악보 불러오기
                </button>
            </div>
            <div className="inline-flex max-w-full gap-1 rounded-full bg-muted p-1" role="group" aria-label="필기 버전">
                <button
                    type="button"
                    className={segment}
                    aria-pressed={view === 'draft'}
                    onClick={() => setView('draft')}
                >
                    내 필기
                </button>
                <button
                    type="button"
                    className={segment}
                    aria-pressed={view === 'published'}
                    onClick={() => setView('published')}
                >
                    팀 공유본 {published ? `· ${published.pages.length}p` : '없음'}
                </button>
            </div>
            {showTools && view === 'draft' && (
                <div className="space-y-3 border-y border-border py-3 animate-in fade-in duration-150">
                    <div className={scrollRow} role="group" aria-label="필기 도구">
                        <button type="button" className={pill} aria-pressed={tool === 'move'} onClick={() => setTool('move')}>
                            <Hand size={16} /> 이동
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'songform'} onClick={() => setTool('songform')}>
                            <ListMusic size={16} /> 송폼
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
                            <Pencil size={16} /> 펜
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'highlighter'} onClick={() => setTool('highlighter')}>
                            <Highlighter size={16} /> 형광펜
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'text'} onClick={() => setTool('text')}>
                            <Type size={16} /> 텍스트/코드
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'rect'} onClick={() => setTool('rect')}>
                            <Square size={16} /> 구역 박스
                        </button>
                        <button type="button" className={pill} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
                            <Eraser size={16} /> 지우개
                        </button>

                        <div className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card pl-3.5 pr-1 text-sm">
                            <span className="text-muted-foreground">스탬프:</span>
                            <select
                                aria-label="스탬프 문구 선택"
                                value={stamp}
                                onChange={(e) => {
                                    setStamp(e.target.value);
                                    setTool('stamp');
                                }}
                                className="bg-transparent font-medium text-foreground focus:outline-hidden"
                            >
                                {WORSHIP_STAMP_PRESETS.map((label) => (
                                    <option key={label} value={label}>{label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                aria-pressed={tool === 'stamp'}
                                className={cn(chip, 'text-foreground hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground')}
                                onClick={() => setTool('stamp')}
                            >
                                찍기
                            </button>
                        </div>

                        <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
                        <button type="button" className={pill} disabled={!activePage?.marks.length || busy} onClick={undo} title="실행 취소">
                            <Undo2 size={16} /> 되돌리기
                        </button>
                        <button type="button" className={pill} disabled={!redoStack.length || busy} onClick={redo} title="다시 실행">
                            <Redo2 size={16} /> 다시 실행
                        </button>
                        <button
                            type="button"
                            className={pill}
                            disabled={!activePage?.marks.length || busy}
                            onClick={clearPageMarks}
                            title="현재 페이지의 모든 필기 삭제"
                        >
                            <Trash2 size={16} /> 전체 지우기
                        </button>
                    </div>

                    {/* Tool Detail Options (Colors & Stroke Widths) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 empty:hidden">
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
                                                    className={cn(pill, 'relative min-w-12')}
                                                >
                                                    {index + 1}p
                                                    {hasMarkup && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-current" aria-hidden />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="송폼 입력 방식">
                                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">방식</span>
                                    <button type="button" aria-pressed={songFormMode === 'band'} onClick={() => setSongFormMode('band')} className={pill}>
                                        송폼 띠 (상단)
                                    </button>
                                    <button type="button" aria-pressed={songFormMode === 'section'} onClick={() => setSongFormMode('section')} className={pill}>
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
                                                className={cn(
                                                    'inline-flex h-10 min-w-12 touch-manipulation items-center justify-center rounded-full px-3.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40',
                                                    armed && 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                                                )}
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
                                                className={cn(pill, 'min-w-12')}
                                            >
                                                ×{times}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className={pill}
                                            disabled={busy || !songFormSections.length}
                                            onClick={() => removeSongFormChip(songFormSections.length - 1)}
                                        >
                                            <Delete size={16} /> 마지막 칩
                                        </button>
                                        <button
                                            type="button"
                                            className={dangerPill}
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
                                                        className="group inline-flex min-h-8 items-center gap-0.5 rounded-full px-2.5 text-xs font-bold text-white transition active:scale-95"
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
                                                className={dangerPill}
                                                disabled={busy}
                                                onClick={() => replacePageMarks(currentPageMarks().filter((m) => m.kind !== 'section'))}
                                            >
                                                <Trash2 size={16} /> 섹션 표시 지우기
                                            </button>
                                        )}
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
                                            className={pill}
                                        >
                                            {size.label}
                                        </button>
                                    ))}
                                    <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
                                    <button type="button" aria-pressed={!songFormTint} disabled={busy} onClick={() => applySongFormLook(songFormFontSize, false)} className={pill}>
                                        진하게
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={songFormTint}
                                        disabled={busy}
                                        title="악보가 비쳐 보이는 반투명 음영으로 표시합니다"
                                        onClick={() => applySongFormLook(songFormFontSize, true)}
                                        className={pill}
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
                                                    className={pill}
                                                    title={preset.sections.join(' → ')}
                                                    disabled={busy || !activePage}
                                                    onClick={() => writeSongForm(preset.sections)}
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                className={pill}
                                                title="곡 라이브러리·유튜브 챕터로 저장한 송폼을 칩으로 가져옵니다"
                                                disabled={busy || !activePage}
                                                onClick={importSavedSongForm}
                                            >
                                                곡 송폼 불러오기
                                            </button>
                                        </div>
                                        <ol
                                            aria-label="현재 페이지 송폼 순서"
                                            className="flex min-h-11 flex-wrap items-center gap-1 rounded-2xl border border-dashed border-border bg-background px-2 py-1.5"
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
                                                            className="group inline-flex min-h-8 items-center gap-0.5 rounded-full px-2.5 text-xs font-bold text-white transition active:scale-95"
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

                        {tool === 'pen' && (
                            <div className={cn(scrollRow, 'gap-1.5 text-xs')}>
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
                                        aria-pressed={penWidth === w.val}
                                        className={cn(chip, penWidth === w.val ? chipOn : chipOff)}
                                    >
                                        {w.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'highlighter' && (
                            <div className={cn(scrollRow, 'gap-1.5 text-xs')}>
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
                                        aria-pressed={highlighterWidth === w.val}
                                        className={cn(chip, highlighterWidth === w.val ? chipOn : chipOff)}
                                    >
                                        {w.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'text' && (
                            <div className={cn(scrollRow, 'gap-1.5 text-xs')}>
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
                                        aria-pressed={textFontSize === s.val}
                                        className={cn(chip, textFontSize === s.val ? chipOn : chipOff)}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {tool === 'highlighter' ? (
                            <div className="flex items-center gap-1">
                                <span className="mr-1 text-xs font-medium text-muted-foreground">색상:</span>
                                {HIGHLIGHTER_COLORS.map((value, i) => (
                                    <button
                                        key={value}
                                        aria-label={`형광펜 색상 ${i + 1}`}
                                        aria-pressed={highlighterColor === value}
                                        onClick={() => setHighlighterColor(value)}
                                        type="button"
                                        className={cn(
                                            'flex size-10 touch-manipulation items-center justify-center rounded-full border-2',
                                            highlighterColor === value ? 'border-foreground' : 'border-transparent'
                                        )}
                                    >
                                        <span className="size-6 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/25" style={{ backgroundColor: value }} />
                                    </button>
                                ))}
                            </div>
                        ) : tool === 'pen' || tool === 'stamp' || tool === 'text' || tool === 'rect' ? (
                            <div className="flex items-center gap-1">
                                <span className="mr-1 text-xs font-medium text-muted-foreground">색상:</span>
                                {SHEET_COLORS.map((value, i) => (
                                    <button
                                        key={value}
                                        aria-label={`필기 색상 ${i + 1}`}
                                        aria-pressed={color === value}
                                        onClick={() => setColor(value)}
                                        type="button"
                                        className={cn(
                                            'flex size-10 touch-manipulation items-center justify-center rounded-full border-2',
                                            color === value ? 'border-foreground' : 'border-transparent'
                                        )}
                                    >
                                        <span className="size-6 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/25" style={{ backgroundColor: value }} />
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
                                            ? '마우스/손가락을 대각선으로 드래그하여 특정 마디나 섹션에 하이라이트 박스를 치세요.'
                                            : tool === 'eraser'
                                                ? '지우고 싶은 필기, 텍스트, 스탬프를 터치하거나 드래그하여 지웁니다.'
                                                : `악보 위를 누르면 ‘${stamp}’ 스탬프가 놓입니다.`}
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                <div className={scrollRow}>
                    <button
                        type="button"
                        className={pill}
                        disabled={!canTurnPage || page <= 1}
                        onClick={() => onPageChange(Math.max(1, page - (isDualPage ? 2 : 1)))}
                    >
                        이전
                    </button>
                    <span className="shrink-0 whitespace-nowrap px-1 text-sm font-semibold tabular-nums text-foreground">
                        {isDualPage && shown && page + 1 <= shown.pages.length ? `${page}-${page + 1}` : page} / {shown?.pages.length ?? 0}p
                    </span>
                    {isEditingOtherPage && (
                        <button
                            type="button"
                            className={cn(pill, 'bg-muted')}
                            title="라이브 진행 중인 페이지로 돌아갑니다"
                            onClick={() => setEditPage(null)}
                        >
                            {page}p 편집 중 · 라이브 {livePage}p로
                        </button>
                    )}
                    <button
                        type="button"
                        className={pill}
                        disabled={!canTurnPage || page >= (shown?.pages.length ?? 0)}
                        onClick={() => onPageChange(Math.min(shown?.pages.length ?? page, page + (isDualPage ? 2 : 1)))}
                    >
                        다음
                    </button>
                    {!isDualPage && (
                        <button type="button" className={pill} aria-label="악보 확대 전환" onClick={() => setZoom(zoom === 1 ? 1.5 : 1)}>
                            {zoom === 1 ? '확대 150%' : '맞춤'}
                        </button>
                    )}

                    {/* Page Rotation Button */}
                    <button
                        type="button"
                        className={pill}
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
                            className={dangerPill}
                            disabled={busy}
                            onClick={handleDeletePage}
                            title="현재 페이지 삭제"
                        >
                            <Trash2 size={15} />
                            <span>페이지 삭제</span>
                        </button>
                    )}
                </div>

                <div className={scrollRow}>
                    <button
                        type="button"
                        className={cn(pill, isDarkInverted && pillOn)}
                        title="무대 어두운 조명에서 눈부심을 방지하는 흑백 반전 모드"
                        onClick={() => setIsDarkInverted((prev) => !prev)}
                    >
                        {isDarkInverted ? <Sun size={16} /> : <Moon size={16} />}
                        <span>{isDarkInverted ? '라이트' : '다크 악보'}</span>
                    </button>

                    <button
                        type="button"
                        className={cn(pill, isDualPage && pillOn)}
                        title="가로 모드에서 2페이지 나란히 펼침 보기"
                        onClick={() => setIsDualPage((prev) => !prev)}
                    >
                        <BookOpen size={16} />
                        <span>{isDualPage ? '1쪽 보기' : '2쪽 펼침'}</span>
                    </button>

                    <button
                        type="button"
                        className={pill}
                        title="필기 도구 숨기기 / 펼치기"
                        onClick={() => setShowTools((prev) => !prev)}
                    >
                        <span>{showTools ? '도구 숨김' : '도구 펼침'}</span>
                    </button>

                    {isWakeLockSupported && (
                        <button
                            type="button"
                            className={cn(pill, isWakeLockActive && pillOn)}
                            title="연주 중 화면이 꺼지지 않도록 방지합니다"
                            onClick={toggleWakeLock}
                        >
                            {isWakeLockActive ? <Sun size={16} /> : <SunDim size={16} />}
                            <span>화면 {isWakeLockActive ? '켜짐 유지' : '자동 꺼짐'}</span>
                        </button>
                    )}
                    {isFullscreenSupported && (
                        <button
                            type="button"
                            className={pill}
                            title="무대 모드: 브라우저 바를 숨기고 악보를 전체 화면으로 봅니다"
                            onClick={() => void toggleFullscreen(sectionRef.current || undefined)}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            <span>{isFullscreen ? '전체화면 해제' : '무대 전체화면'}</span>
                        </button>
                    )}
                </div>
            </div>
            {shown?.pages.length ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Keyboard size={14} className="shrink-0" aria-hidden />
                    <span>블루투스 페달 또는 키보드 방향키(←, →), PageUp/Down으로 {isDualPage ? '2페이지씩' : '악보를'} 넘길 수 있습니다.</span>
                </div>
            ) : null}
            <div
                className={cn(
                    'relative overflow-auto rounded-2xl border border-border transition-all',
                    !activePage
                        ? 'border-dashed border-input bg-muted/40'
                        : isDarkInverted
                            ? 'bg-[#0a0f0e] dark-sheet-invert'
                            : 'bg-white text-gray-900'
                )}
            >
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
                    <div className="grid grid-cols-1 gap-3 bg-foreground/5 p-2 md:grid-cols-2">
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
                            <div className="hidden items-center justify-center rounded-2xl border border-dashed border-border p-8 text-xs text-muted-foreground md:flex">
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
                            {renderMarkList(activePage.marks, stroke)}
                        </svg>
                    </div>
                ) : (
                    <div className="px-6 py-16 text-center text-sm text-muted-foreground">
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
                    type="button"
                    className={cn(buttonVariants({ size: 'sm' }), 'h-10 touch-manipulation px-4 text-sm')}
                    disabled={!draft || busy}
                    onClick={() => void publish()}
                >
                    <Share2 size={16} /> 전체 공유본으로 저장
                </button>
                <button type="button" className={pill} disabled={!published || busy} onClick={download}>
                    <Download size={16} /> 공유 파일 내려받기
                </button>
                {view === 'published' && published && (
                    <button
                        type="button"
                        className={pill}
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
                    <div className="w-full max-w-sm space-y-3 rounded-3xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <Type size={16} className="text-muted-foreground" />
                                <span>악보 텍스트 / 코드 입력</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setTextModal(null)}
                                className="inline-flex size-8 items-center justify-center rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                className={cn(fieldClass, 'font-semibold')}
                            />
                        </div>
                        {/* Quick Worship Chord & Memo Shortcuts */}
                        <div className="space-y-1">
                            <span className="text-[11px] font-medium text-muted-foreground">빠른 선택 프리셋:</span>
                            <div className="flex flex-wrap gap-1">
                                {['Capo 1', 'Capo 2', 'Key Up (반음↑)', '간주 4마디', '빌드업', '잔잔하게', 'All Out', '드럼 킥 진입'].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setTextModal({ ...textModal, text: preset })}
                                        className={cn(chip, chipOff, 'h-7 px-2.5 text-[11px] active:scale-95')}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                            <button
                                type="button"
                                onClick={() => setTextModal(null)}
                                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTextMark}
                                disabled={!textModal.text.trim()}
                                className={buttonVariants({ size: 'sm' })}
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

// The prep page re-renders on every realtime and session-state change; the sheet only needs to when its own props do.
export default memo(SheetAnnotationWorkspace);
