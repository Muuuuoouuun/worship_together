'use client';

import { createClientId } from '@/lib/clientId';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { BookOpen, Download, FileUp, Hand, Maximize2, Minimize2, Moon, Pencil, Share2, Sun, SunDim, Trash2, Undo2 } from 'lucide-react';
import { usePageTurner } from '@/hooks/usePageTurner';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useFullscreen } from '@/hooks/useFullscreen';
import {
    importSheetPages,
    readSheet,
    saveSheet,
    sheetKey,
    SHEET_COLORS,
    validateSheet,
    type SheetDocument,
    type SheetMark,
} from '@/lib/sheetAnnotations';

type Props = {
    teamId: string;
    songId: string;
    title: string;
    page: number;
    onPageChange: (page: number) => void;
    canTurnPage: boolean;
    onPageCountChange?: (count: number) => void;
};

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
    const [tool, setTool] = useState<'move' | 'pen' | 'stamp'>('move');
    const [stamp, setStamp] = useState('한 번 더');
    const [color, setColor] = useState(SHEET_COLORS[0]);
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
    const sectionRef = useRef<HTMLElement | null>(null);

    const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen } = useFullscreen();
    const { isActive: isWakeLockActive, isSupported: isWakeLockSupported, toggle: toggleWakeLock } = useScreenWakeLock(true);

    const draftKey = sheetKey(teamId, songId);
    const publishedKey = sheetKey(teamId, songId, true);
    const shown = view === 'draft' ? draft : published;
    const activePage = shown?.pages[page - 1];

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
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: [...item.marks, mark] } : item
            ),
        });
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
        event.currentTarget.setPointerCapture(event.pointerId);
        const mark: SheetMark = {
            id: createClientId(),
            kind: 'pen',
            points: [position(event.clientX, event.clientY, event.currentTarget)],
            color,
        };
        strokeRef.current = mark;
        setStroke(mark);
    }

    function pointerMove(event: PointerEvent<SVGSVGElement>) {
        if (!strokeRef.current || !event.isPrimary) return;
        if (strokeRef.current.points.length >= 5000) return;
        const pt = position(event.clientX, event.clientY, event.currentTarget);
        strokeRef.current = { ...strokeRef.current, points: [...strokeRef.current.points, pt] };
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                if (strokeRef.current) setStroke({ ...strokeRef.current });
            });
        }
    }

    function pointerUp() {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (strokeRef.current) addMark(strokeRef.current);
        strokeRef.current = null;
        setStroke(null);
        rectRef.current = null;
    }

    function undo() {
        const current = documentRef.current;
        if (!current) return;
        persist({
            ...current,
            updatedAt: new Date().toISOString(),
            pages: current.pages.map((item, index) =>
                index === page - 1 ? { ...item, marks: item.marks.slice(0, -1) } : item
            ),
        });
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
        return mark.kind === 'stamp' ? (
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
            >
                {mark.text}
            </text>
        ) : (
            <polyline
                key={mark.id}
                points={(mark.points.length === 1 ? [point, [point[0] + 0.1, point[1] + 0.1]] : mark.points)
                    .map((p) => `${p[0]},${p[1] * ratio}`)
                    .join(' ')}
                fill="none"
                stroke={mark.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
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
                <div className="space-y-2 animate-in fade-in duration-150">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="필기 도구">
                        <button className={button} aria-pressed={tool === 'move'} onClick={() => setTool('move')}>
                            <Hand size={16} /> 이동
                        </button>
                        <button className={button} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
                            <Pencil size={16} /> 펜
                        </button>
                        {['한 번 더', '브릿지', '엔딩', '작게', '크게'].map((label) => (
                            <button
                                key={label}
                                className={button}
                                aria-pressed={tool === 'stamp' && stamp === label}
                                onClick={() => {
                                    setStamp(label);
                                    setTool('stamp');
                                }}
                            >
                                {label}
                            </button>
                        ))}
                        <button className={button} disabled={!activePage?.marks.length || busy} onClick={undo}>
                            <Undo2 size={16} /> 되돌리기
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
                    <div className="flex items-center gap-2">
                        {SHEET_COLORS.map((value, i) => (
                            <button
                                key={value}
                                aria-label={`${['빨강', '파랑', '초록', '검정'][i]} 필기`}
                                aria-pressed={color === value}
                                onClick={() => setColor(value)}
                                className={`tap-target flex items-center justify-center rounded-full border-2 ${
                                    color === value ? 'border-primary' : 'border-transparent'
                                }`}
                            >
                                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: value }} />
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {tool === 'move'
                            ? '이동 모드에서는 손가락으로 화면을 스크롤할 수 있습니다.'
                            : tool === 'pen'
                              ? '악보 위에 손가락이나 펜으로 그리세요. 스크롤하려면 이동을 누르세요.'
                              : `악보 위를 누르면 ‘${stamp}’ 표시가 놓입니다.`}
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
            <div className={`overflow-auto rounded-xl border border-primary/15 transition-all ${
                isDarkInverted ? 'bg-[#0a0f0e] dark-sheet-invert' : 'bg-white text-gray-900'
            }`}>
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
                                        cursor: tool === 'move' ? 'auto' : 'crosshair',
                                    }}
                                    onPointerDown={pointerDown}
                                    onPointerMove={pointerMove}
                                    onPointerUp={pointerUp}
                                    onPointerCancel={() => {
                                        strokeRef.current = null;
                                        setStroke(null);
                                    }}
                                >
                                    {activePage.marks.map(renderMark)}
                                    {stroke ? renderMark(stroke) : null}
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
                                    {shown.pages[page].marks.map(renderMark)}
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
                                cursor: tool === 'move' ? 'auto' : 'crosshair',
                            }}
                            onPointerDown={pointerDown}
                            onPointerMove={pointerMove}
                            onPointerUp={pointerUp}
                            onPointerCancel={() => {
                                strokeRef.current = null;
                                setStroke(null);
                            }}
                        >
                            {activePage.marks.map(renderMark)}
                            {stroke ? renderMark(stroke) : null}
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
        </section>
    );
}
