'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { createSetlist } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import type { LibrarySong } from '@/lib/libraryPrototypeStorage';
import { COMMON_KEYS, saveSetlistDetails, type SongSetlistOverride } from '@/lib/setlistDetailsStorage';
import { createClientId } from '@/lib/clientId';
import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    Music,
    Search,
    Trash2,
} from 'lucide-react';

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
        <GlassCard className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground">콘티 만들기</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        드래그하거나 버튼으로 곡 순서를 정렬하고, 이번 주 변경할 Key와 연주 메모를 입력하세요.
                    </p>
                </div>
                <Badge variant="subtle" size="sm">
                    {order.length}곡 선택됨
                </Badge>
            </div>

            <form
                action={saveAction}
                onSubmit={handleSubmit}
                className="mt-4"
            >
                <input type="hidden" name="setlistId" defaultValue="" />
                <fieldset disabled={disabled} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-semibold text-foreground">
                            예배 제목
                            <Input
                                name="title"
                                required
                                maxLength={120}
                                className="mt-1 min-h-11"
                                placeholder="예: 주일 2부 예배"
                            />
                        </label>
                        <label className="block text-sm font-semibold text-foreground">
                            예배 일시
                            <Input
                                name="worshipDate"
                                type="datetime-local"
                                required
                                className="mt-1 min-h-11"
                            />
                        </label>
                    </div>

                    <label className="block text-sm font-semibold text-foreground">
                        주제 (선택)
                        <Input
                            name="theme"
                            className="mt-1 min-h-11"
                            placeholder="예: 회복과 감사, 부활절 찬양"
                        />
                    </label>

                    {/* 곡 추가 영역 & 검색 */}
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Music size={14} className="text-secondary" />
                                곡 목록에서 콘티에 추가
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {filteredSongs.length}곡 검색됨
                            </span>
                        </div>

                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="곡명 또는 아티스트 검색…"
                                className="min-h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                            />
                        </div>

                        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto pr-1 no-scrollbar">
                            {filteredSongs.map((song) => {
                                const isAdded = order.includes(song.id);
                                return (
                                    <Button
                                        type="button"
                                        key={song.id}
                                        variant={isAdded ? 'secondary' : 'outline'}
                                        size="sm"
                                        disabled={isAdded}
                                        className="h-auto py-1.5 px-2.5 text-xs font-medium rounded-lg"
                                        onClick={() => addSongToOrder(song.id)}
                                    >
                                        {isAdded ? '✓ 추가됨' : '+'} {song.title}
                                        {song.original_key && (
                                            <span className="ml-1 opacity-70">({song.original_key})</span>
                                        )}
                                    </Button>
                                );
                            })}
                            {!filteredSongs.length && (
                                <p className="text-xs text-muted-foreground py-2">검색 결과가 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* 선택된 곡 순서 및 세부 설정 리스트 (드래그 앤 드롭 지원) */}
                    <div className="space-y-2">
                        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            선택된 콘티 곡 순서 ({order.length}곡) · 핸들을 드래그하여 순서 변경
                        </span>

                        {!order.length ? (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                위 곡 목록에서 곡을 클릭하여 콘티에 추가하세요.
                            </div>
                        ) : (
                            <ol className="space-y-2.5">
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
                                            className={`rounded-xl border p-3 transition-all ${
                                                isDragging
                                                    ? 'border-primary bg-primary/10 opacity-60 shadow-lg'
                                                    : 'border-border/80 bg-card hover:border-border'
                                            }`}
                                        >
                                            <input type="hidden" name="songIds" value={id} />

                                            {/* 상단: 핸들, 곡명, 순서 번호, 삭제 */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <button
                                                        type="button"
                                                        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing p-1"
                                                        title="드래그하여 순서 변경"
                                                    >
                                                        <GripVertical size={16} />
                                                    </button>
                                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                                        {index + 1}
                                                    </span>
                                                    <p className="truncate text-sm font-bold text-foreground">
                                                        {song.title}
                                                    </p>
                                                    {song.artist && (
                                                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                                                            · {song.artist}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                        disabled={index === 0}
                                                        title="위로 이동"
                                                        onClick={() => move(index, -1)}
                                                    >
                                                        <ArrowUp size={14} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                        disabled={index === order.length - 1}
                                                        title="아래로 이동"
                                                        onClick={() => move(index, 1)}
                                                    >
                                                        <ArrowDown size={14} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                        title="삭제"
                                                        onClick={() => removeSongFromOrder(index)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* 하단: 인도자 전용 세부 설정 (타겟 Key, 커스텀 BPM, 디렉팅 메모) */}
                                            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-[6rem_5.5rem_minmax(0,1fr)] gap-2 pt-2 border-t border-border/50">
                                                <label className="text-[11px] font-semibold text-muted-foreground">
                                                    이번 주 Key
                                                    <select
                                                        value={override.targetKey ?? song.original_key ?? ''}
                                                        onChange={(e) => updateOverride(id, { targetKey: e.target.value })}
                                                        className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                                    >
                                                        <option value="">원곡 ({song.original_key ?? '-'})</option>
                                                        {COMMON_KEYS.map((k) => (
                                                            <option key={k} value={k}>{k} Key</option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="text-[11px] font-semibold text-muted-foreground">
                                                    템포 BPM
                                                    <input
                                                        type="number"
                                                        min={20}
                                                        max={300}
                                                        value={override.customBpm ?? song.bpm ?? ''}
                                                        onChange={(e) => updateOverride(id, { customBpm: e.target.value ? Number(e.target.value) : null })}
                                                        placeholder={song.bpm ? String(song.bpm) : '기본'}
                                                        className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                                    />
                                                </label>

                                                <label className="col-span-2 sm:col-span-1 text-[11px] font-semibold text-muted-foreground">
                                                    인도자 디렉팅 메모
                                                    <input
                                                        type="text"
                                                        maxLength={100}
                                                        value={override.leaderNotes ?? ''}
                                                        onChange={(e) => updateOverride(id, { leaderNotes: e.target.value })}
                                                        placeholder="예: 잔잔하게 피아노만 시작, 2절 후렴 빌드업 후 드럼 진입"
                                                        className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
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
                        className="min-h-11 w-full text-sm font-bold shadow-sm"
                        type="submit"
                        disabled={!order.length}
                    >
                        콘티 저장 ({order.length}곡)
                    </Button>
                </fieldset>
            </form>
        </GlassCard>
    );
}
