'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { createSetlist } from '@/actions/libraryActions';
import { Button } from '@/components/ui/button';
import { Input, Select, searchFieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LibrarySong } from '@/lib/libraryPrototypeStorage';
import { COMMON_KEYS, saveSetlistDetails, type SongSetlistOverride } from '@/lib/setlistDetailsStorage';
import { createClientId } from '@/lib/clientId';
import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    Search,
    Trash2,
} from 'lucide-react';

const labelClass = 'block space-y-1.5';
const labelText = 'block text-sm font-semibold text-foreground';
/** 곡 행 안의 작은 설정 칸 이름 */
const miniLabel = 'block min-w-0 text-[11px] font-medium text-muted-foreground';

interface SetlistComposerProps {
    songs: LibrarySong[];
    teamId?: string;
    disabled?: boolean;
    saveAction?: (data: FormData) => void | Promise<void>;
}

export default function SetlistComposer({
    songs,
    teamId = 'default',
    disabled = false,
    saveAction = createSetlist,
}: SetlistComposerProps) {
    const [order, setOrder] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);
    const [overrides, setOverrides] = useState<Record<string, SongSetlistOverride>>({});
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // 검색 필터링된 곡 목록 (useDeferredValue로 타이핑 지연 해소)
    const filteredSongs = useMemo(() => {
        if (!deferredSearch.trim()) return songs;
        const q = deferredSearch.toLowerCase();
        return songs.filter(s => s.title.toLowerCase().includes(q) || (s.artist && s.artist.toLowerCase().includes(q)));
    }, [songs, deferredSearch]);

    const move = (index: number, offset: number) => {
        const targetIndex = index + offset;
        if (targetIndex < 0 || targetIndex >= order.length) return;
        setOrder((ids) => {
            const next = [...ids];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        setOrder((ids) => {
            const next = [...ids];
            const [draggedItem] = next.splice(draggedIndex, 1);
            next.splice(targetIndex, 0, draggedItem);
            return next;
        });
        setDraggedIndex(targetIndex);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const updateOverride = (songId: string, partial: Partial<SongSetlistOverride>) => {
        setOverrides((prev) => ({
            ...prev,
            [songId]: {
                ...(prev[songId] ?? { songId }),
                ...partial,
            },
        }));
    };

    const addSongToOrder = (songId: string) => {
        if (order.includes(songId)) return;
        const originalSong = songs.find((s) => s.id === songId);
        setOrder((ids) => [...ids, songId]);
        if (originalSong) {
            updateOverride(songId, {
                targetKey: originalSong.original_key ?? null,
                customBpm: originalSong.bpm ?? null,
                leaderNotes: '',
            });
        }
    };

    const removeSongFromOrder = (index: number) => {
        const removedId = order[index];
        setOrder((ids) => ids.filter((_, i) => i !== index));
        setOverrides((prev) => {
            const next = { ...prev };
            delete next[removedId];
            return next;
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        // await 이후에는 event.currentTarget 이 비므로 먼저 잡아둡니다.
        const form = event.currentTarget;
        // 새 콘티 id 를 미리 정해 두어 곡별 Key·BPM·메모를 같은 id 로 저장합니다.
        const setlistId = createClientId();
        const idInput = form.elements.namedItem('setlistId');
        if (idInput instanceof HTMLInputElement) idInput.value = setlistId;
        if (saveAction !== createSetlist) {
            event.preventDefault();
            await saveAction(new FormData(form));
        }
        saveSetlistDetails(teamId, setlistId, overrides);
    };

    return (
        <div>
            <div className="mb-4 flex items-start justify-between gap-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    드래그하거나 버튼으로 곡 순서를 정렬하고, 이번 주 변경할 Key와 연주 메모를 입력하세요.
                </p>
                <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {order.length}곡 선택됨
                </span>
            </div>

            <form
                action={saveAction}
                onSubmit={handleSubmit}
            >
                <input type="hidden" name="setlistId" defaultValue="" />
                <fieldset disabled={disabled} className="space-y-6 disabled:opacity-60">
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className={labelClass}>
                                <span className={labelText}>예배 제목</span>
                                <Input
                                    name="title"
                                    required
                                    maxLength={120}
                                    placeholder="예: 주일 2부 예배"
                                />
                            </label>
                            <label className={labelClass}>
                                <span className={labelText}>예배 일시</span>
                                <Input
                                    name="worshipDate"
                                    type="datetime-local"
                                    required
                                />
                            </label>
                        </div>

                        <label className={labelClass}>
                            <span className={labelText}>주제 (선택)</span>
                            <Input
                                name="theme"
                                placeholder="예: 회복과 감사, 부활절 찬양"
                            />
                        </label>
                    </div>

                    {/* 곡 추가 영역 & 검색 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className={labelText}>곡 목록에서 콘티에 추가</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {filteredSongs.length}곡 검색됨
                            </span>
                        </div>

                        <label className="relative block">
                            <span className="sr-only">콘티에 추가할 곡 검색</span>
                            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="곡명 또는 아티스트 검색…"
                                className={cn(searchFieldClass, 'h-11 pl-11')}
                            />
                        </label>

                        <div className="no-scrollbar flex max-h-48 flex-wrap gap-1.5 overflow-auto">
                            {filteredSongs.map((song) => {
                                const isAdded = order.includes(song.id);
                                return (
                                    <Button
                                        type="button"
                                        key={song.id}
                                        variant={isAdded ? 'secondary' : 'outline'}
                                        size="sm"
                                        disabled={isAdded}
                                        className="max-w-full gap-1 font-medium disabled:opacity-60"
                                        onClick={() => addSongToOrder(song.id)}
                                    >
                                        <span className="truncate">
                                            {isAdded ? '✓ 추가됨' : <span className="font-semibold text-brand">+</span>} {song.title}
                                        </span>
                                        {song.original_key && (
                                            <span className="text-muted-foreground">({song.original_key})</span>
                                        )}
                                    </Button>
                                );
                            })}
                            {!filteredSongs.length && (
                                <p className="py-2 text-xs text-muted-foreground">검색 결과가 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* 선택된 곡 순서 및 세부 설정 리스트 (드래그 앤 드롭 지원) */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className={labelText}>
                                선택된 콘티 곡 순서 ({order.length}곡)
                            </span>
                            <span className="text-xs text-muted-foreground">핸들을 드래그하여 순서 변경</span>
                        </div>

                        {!order.length ? (
                            <p className="rounded-2xl border border-dashed border-input px-5 py-8 text-center text-sm text-muted-foreground">
                                위 곡 목록에서 곡을 클릭하여 콘티에 추가하세요.
                            </p>
                        ) : (
                            <ol className="divide-y divide-border/70 border-y border-border/70">
                                {order.map((id, index) => {
                                    const song = songs.find((s) => s.id === id);
                                    if (!song) return null;
                                    const override = overrides[id] ?? {};
                                    const isDragging = draggedIndex === index;

                                    return (
                                        <li
                                            key={id}
                                            draggable
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            className={cn('py-3.5 transition-colors', isDragging && 'rounded-2xl bg-muted opacity-70')}
                                        >
                                            <input type="hidden" name="songIds" value={id} />

                                            {/* 상단: 핸들, 순서 번호, 곡명, 이동·삭제 */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        className="-ml-1.5 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                                                        title="드래그하여 순서 변경"
                                                    >
                                                        <GripVertical size={16} aria-hidden="true" />
                                                    </button>
                                                    <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                                                        {index + 1}
                                                    </span>
                                                    <p className="min-w-0 truncate text-[15px] font-medium text-foreground">
                                                        {song.title}
                                                        {song.artist && (
                                                            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                                                                {' '}· {song.artist}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="flex shrink-0 items-center">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        disabled={index === 0}
                                                        title="위로 이동"
                                                        onClick={() => move(index, -1)}
                                                    >
                                                        <ArrowUp size={15} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        disabled={index === order.length - 1}
                                                        title="아래로 이동"
                                                        onClick={() => move(index, 1)}
                                                    >
                                                        <ArrowDown size={15} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                        title="삭제"
                                                        onClick={() => removeSongFromOrder(index)}
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* 하단: 인도자 전용 세부 설정 (타겟 Key, 커스텀 BPM, 디렉팅 메모) */}
                                            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[7rem_5.5rem_minmax(0,1fr)] sm:pl-[3.625rem]">
                                                <label className={miniLabel}>
                                                    이번 주 Key
                                                    <Select
                                                        value={override.targetKey ?? song.original_key ?? ''}
                                                        onChange={(e) => updateOverride(id, { targetKey: e.target.value })}
                                                        className="mt-1 h-10 pl-3 font-semibold"
                                                    >
                                                        <option value="">원곡 ({song.original_key ?? '-'})</option>
                                                        {COMMON_KEYS.map((k) => (
                                                            <option key={k} value={k}>{k} Key</option>
                                                        ))}
                                                    </Select>
                                                </label>

                                                <label className={miniLabel}>
                                                    템포 BPM
                                                    <Input
                                                        type="number"
                                                        min={20}
                                                        max={300}
                                                        value={override.customBpm ?? song.bpm ?? ''}
                                                        onChange={(e) => updateOverride(id, { customBpm: e.target.value ? Number(e.target.value) : null })}
                                                        placeholder={song.bpm ? String(song.bpm) : '기본'}
                                                        className="mt-1 h-10 px-3 font-semibold tabular-nums"
                                                    />
                                                </label>

                                                <label className={cn(miniLabel, 'col-span-2 sm:col-span-1')}>
                                                    인도자 디렉팅 메모
                                                    <Input
                                                        type="text"
                                                        maxLength={100}
                                                        value={override.leaderNotes ?? ''}
                                                        onChange={(e) => updateOverride(id, { leaderNotes: e.target.value })}
                                                        placeholder="예: 잔잔하게 피아노만 시작, 2절 후렴 빌드업 후 드럼 진입"
                                                        className="mt-1 h-10 px-3"
                                                    />
                                                </label>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    <Button
                        className="w-full px-6 sm:w-auto"
                        type="submit"
                        disabled={!order.length}
                    >
                        콘티 저장 ({order.length}곡)
                    </Button>
                </fieldset>
            </form>
        </div>
    );
}
