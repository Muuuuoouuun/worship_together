'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientId } from '@/lib/clientId';
import { DEMO_SESSION_ID } from '@/lib/constants';
import type { SetlistWithSongs } from '@/lib/data';
import { hasDuplicateSongIds, normalizeSetlistSongOrder, LIBRARY_CHANGED_EVENT, readPrototypeLibrary, savePrototypeLibrary, type LibrarySong, type PrototypeLibrary } from '@/lib/libraryPrototypeStorage';
import { readSongForm } from '@/lib/songFormStorage';
import { Badge } from '@/components/ui/Badge';
import {
    Calendar,
    ChevronDown,
    ChevronUp,
    Copy,
    ListMusic,
    MessageSquareText,
    Music,
    Plus,
    Radio,
    Search,
    SlidersHorizontal,
    UsersRound,
} from 'lucide-react';
import SongComposer from './SongComposer';
import SetlistComposer from './SetlistComposer';
import SongBpmPresetManager from './SongBpmPresetManager';
import SongFormEditor from './SongFormEditor';
import SetlistShareButton from './SetlistShareButton';
import { duplicateSetlistFromTemplate } from '@/actions/libraryActions';

export default function LibraryWorkspace({
    initialSongs,
    initialSetlists,
    teamId,
    hasBackend,
}: {
    initialSongs: LibrarySong[];
    initialSetlists: SetlistWithSongs[];
    teamId: string;
    hasBackend: boolean;
}) {
    const seed: PrototypeLibrary = {
        version: 1,
        songs: initialSongs,
        setlists: initialSetlists.map((setlist) => ({
            id: setlist.id,
            team_id: setlist.team_id,
            title: setlist.title,
            theme: setlist.theme,
            worship_date: setlist.worship_date,
            song_order: normalizeSetlistSongOrder(setlist.song_order),
            created_at: setlist.created_at,
            updated_at: setlist.updated_at,
        })),
    };

    const [library, setLibrary] = useState(seed);
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        function refresh() {
            if (hasBackend) {
                setReady(true);
                return;
            }
            try {
                const saved = readPrototypeLibrary(teamId);
                if (saved) setLibrary(saved);
                setReady(true);
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '저장 데이터를 읽지 못했습니다.');
            }
        }
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
        return () => {
            window.removeEventListener('storage', refresh);
            window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh);
        };
    }, [hasBackend, teamId]);

    function persist(change: (current: PrototypeLibrary) => PrototypeLibrary, success: string) {
        try {
            const next = change(readPrototypeLibrary(teamId) ?? library);
            savePrototypeLibrary(teamId, next);
            setLibrary(next);
            setMessage(success + ' 브라우저에 저장했습니다.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
        }
    }

    function bpmFrom(data: FormData): number | null {
        const value = String(data.get('bpm') ?? '').trim();
        if (!value) return null;
        const bpm = Number(value);
        if (!Number.isInteger(bpm) || bpm < 20 || bpm > 300) {
            throw new Error('BPM은 20~300 사이 정수로 입력해주세요.');
        }
        return bpm;
    }

    function addSong(data: FormData) {
        persist((current) => {
            const title = String(data.get('title') ?? '').trim();
            if (!title) throw new Error('곡명을 입력해주세요.');
            const text = (key: string) => String(data.get(key) ?? '').trim() || null;
            const now = new Date().toISOString();
            const song: LibrarySong = {
                id: createClientId(),
                team_id: teamId,
                title,
                artist: text('artist'),
                original_key: text('originalKey'),
                bpm: bpmFrom(data),
                music_xml_url: text('musicXmlUrl'),
                data_xml: text('dataXml'),
                created_at: now,
                updated_at: now,
            };
            return { ...current, songs: [song, ...current.songs] };
        }, '새 찬양곡을');
    }

    function addSetlist(data: FormData) {
        persist((current) => {
            const title = String(data.get('title') ?? '').trim();
            const date = new Date(String(data.get('worshipDate') ?? ''));
            const ids = data.getAll('songIds').map(String);
            if (hasDuplicateSongIds(ids)) {
                throw new Error('콘티에는 같은 곡을 한 번만 추가할 수 있습니다. 후렴 반복은 곡의 송폼에서 설정해주세요.');
            }
            if (!title || Number.isNaN(date.getTime()) || !ids.length || ids.some((id) => !current.songs.some((song) => song.id === id))) {
                throw new Error('예배 제목, 일시, 곡 순서를 확인해주세요.');
            }
            const now = new Date().toISOString();
            return {
                ...current,
                setlists: [
                    {
                        id: createClientId(),
                        team_id: teamId,
                        title,
                        theme: String(data.get('theme') ?? '').trim() || null,
                        worship_date: date.toISOString(),
                        song_order: ids,
                        created_at: now,
                        updated_at: now,
                    },
                    ...current.setlists,
                ],
            };
        }, '콘티를');
    }

    function updateBpm(data: FormData) {
        persist(
            (current) => ({
                ...current,
                songs: current.songs.map((song) =>
                    song.id === data.get('songId')
                        ? { ...song, bpm: bpmFrom(data), updated_at: new Date().toISOString() }
                        : song
                ),
            }),
            'BPM 프리셋을'
        );
    }

    function duplicate(id: string) {
        persist((current) => {
            const original = current.setlists.find((setlist) => setlist.id === id);
            if (!original) throw new Error('복제할 콘티를 찾지 못했습니다.');
            const date = new Date(original.worship_date);
            date.setDate(date.getDate() + 7);
            const now = new Date().toISOString();
            return {
                ...current,
                setlists: [
                    {
                        ...original,
                        id: createClientId(),
                        title: `${original.title} (복제)`,
                        worship_date: date.toISOString(),
                        created_at: now,
                        updated_at: now,
                    },
                    ...current.setlists,
                ],
            };
        }, '다음 주 콘티를');
    }

    const songs = hasBackend ? initialSongs : library.songs;
    const setlists = hasBackend ? initialSetlists : library.setlists;
    const filtered = songs.filter((song) => `${song.title} ${song.artist ?? ''}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* 상태 요약 바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2">
                    <Badge variant={hasBackend ? 'success' : 'secondary'} size="sm" dot>
                        {hasBackend ? '서버 연결됨' : '브라우저 로컬 저장'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        찬양 {songs.length}곡 · 콘티 {setlists.length}개
                    </span>
                </div>
                {message && (
                    <p role="status" aria-live="polite" className="text-xs font-semibold text-secondary">
                        {message}
                    </p>
                )}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-2">
                {/* 좌측: 찬양곡 및 송폼 */}
                <div className="min-w-0 space-y-5">
                    <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Music size={20} className="text-primary" />
                                <h2 className="text-lg font-bold">곡 보관함 & 송폼</h2>
                            </div>
                            <span className="text-xs text-muted-foreground">{filtered.length}곡 검색됨</span>
                        </div>

                        {/* 검색창 */}
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="곡명 또는 아티스트 검색…"
                            />
                        </div>

                        {/* 곡 목록 */}
                        <div className="space-y-2.5">
                            {filtered.map((song) => (
                                <div
                                    key={song.id}
                                    className="overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:border-primary/40"
                                >
                                    <button
                                        type="button"
                                        className="tap-target flex w-full items-center justify-between p-3.5 text-left transition hover:bg-muted/40"
                                        aria-expanded={expanded === song.id}
                                        onClick={() => setExpanded((id) => (id === song.id ? null : song.id))}
                                    >
                                        <div className="min-w-0 pr-3">
                                            <span className="block font-bold text-foreground text-sm truncate">{song.title}</span>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {song.artist && (
                                                    <span className="text-xs text-muted-foreground">{song.artist}</span>
                                                )}
                                                {song.original_key && (
                                                    <Badge variant="outline" size="sm">
                                                        {song.original_key}
                                                    </Badge>
                                                )}
                                                {song.bpm && (
                                                    <Badge variant="subtle" size="sm">
                                                        {song.bpm} BPM
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-semibold text-secondary shrink-0">
                                            <span>송폼</span>
                                            {expanded === song.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </button>

                                    {expanded === song.id && ready && (
                                        <div className="border-t border-border/60 bg-muted/20 p-4">
                                            <SongFormEditor
                                                key={song.id}
                                                songId={song.id}
                                                teamId={teamId}
                                                initialForm={readSongForm(song.id, teamId)}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {!filtered.length && (
                                <p className="py-8 text-center text-xs text-muted-foreground">표시할 곡이 없습니다.</p>
                            )}
                        </div>
                    </section>

                    {/* 새 곡 추가 접이식 */}
                    <details className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
                        <summary className="min-h-11 cursor-pointer font-bold text-foreground hover:text-primary transition-colors flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Plus size={16} className="text-secondary" />
                                <span>새 곡 추가하기</span>
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">펼치기</span>
                        </summary>
                        <div className="mt-4 pt-3 border-t border-border/60">
                            <SongComposer disabled={!ready} saveAction={hasBackend ? undefined : addSong} />
                        </div>
                    </details>

                    {/* BPM 수정 접이식 */}
                    <details className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
                        <summary className="min-h-11 cursor-pointer font-bold text-foreground hover:text-primary transition-colors flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-secondary" />
                                <span>곡별 BPM 프리셋 수정</span>
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">펼치기</span>
                        </summary>
                        <div className="mt-4 pt-3 border-t border-border/60">
                            <SongBpmPresetManager songs={songs} disabled={!ready} saveAction={hasBackend ? undefined : updateBpm} />
                        </div>
                    </details>
                </div>

                {/* 우측: 저장된 콘티 목록 */}
                <div className="min-w-0 space-y-5">
                    <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <ListMusic size={20} className="text-secondary" />
                                <h2 className="text-lg font-bold">저장된 콘티 목록</h2>
                            </div>
                            <Badge variant="outline" size="sm">
                                {setlists.length}개
                            </Badge>
                        </div>

                        <div className="space-y-4">
                            {setlists.map((setlist) => {
                                const ids = normalizeSetlistSongOrder(setlist.song_order);
                                const ordered = ids.map((id) => songs.find((song) => song.id === id));
                                const date = new Date(setlist.worship_date).toLocaleString('ko-KR', {
                                    timeZone: 'Asia/Seoul',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    weekday: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                });

                                return (
                                    <div
                                        key={setlist.id}
                                        className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-secondary/40"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-bold text-foreground text-base">{setlist.title}</h3>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Calendar size={13} />
                                                    <span>{date}</span>
                                                    {setlist.theme && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-secondary font-medium">{setlist.theme}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <Badge variant="subtle" size="sm">
                                                {ordered.length}곡
                                            </Badge>
                                        </div>

                                        {/* 수록곡 순서 */}
                                        <ol className="my-3.5 space-y-1.5 rounded-xl bg-muted/40 p-3 text-xs">
                                            {ordered.map((song, i) => (
                                                <li key={`${ids[i]}-${i}`} className="flex items-center gap-2">
                                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-card text-[11px] font-bold text-muted-foreground">
                                                        {i + 1}
                                                    </span>
                                                    <span className="font-medium text-foreground truncate">
                                                        {song?.title ?? '곡을 찾을 수 없습니다.'}
                                                    </span>
                                                    {song?.original_key && (
                                                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                                            {song.original_key}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>

                                        {/* 액션 버튼들 */}
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <Link
                                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                                href={`/dashboard/planning?team=${encodeURIComponent(teamId)}&tab=requests&setlistId=${encodeURIComponent(setlist.id)}&setlistTitle=${encodeURIComponent(setlist.title)}`}
                                            >
                                                <MessageSquareText size={14} className="text-secondary" />
                                                <span>질문·요청</span>
                                            </Link>

                                            <SetlistShareButton
                                                shareText={[
                                                    setlist.title,
                                                    date,
                                                    ...ordered.map((song, i) => `${i + 1}. ${song?.title ?? '알 수 없는 곡'}`),
                                                ].join('\n')}
                                            />

                                            {hasBackend ? (
                                                <form action={duplicateSetlistFromTemplate}>
                                                    <input type="hidden" name="setlistId" value={setlist.id} />
                                                    <button className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                                                        <Copy size={14} />
                                                        <span>다음 주 복제</span>
                                                    </button>
                                                </form>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                                    onClick={() => duplicate(setlist.id)}
                                                >
                                                    <Copy size={14} />
                                                    <span>다음 주 복제</span>
                                                </button>
                                            )}

                                            {!hasBackend && ordered.length > 0 && (
                                                <>
                                                    <Link
                                                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                                                        href={`/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}
                                                    >
                                                        <Radio size={14} />
                                                        <span>예배 열기</span>
                                                    </Link>
                                                    <Link
                                                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted"
                                                        href={`/session/${DEMO_SESSION_ID}/team?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}
                                                    >
                                                        <UsersRound size={14} />
                                                        <span>팀원 화면</span>
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {!setlists.length && (
                                <p className="py-8 text-center text-xs text-muted-foreground">아직 저장된 콘티가 없습니다.</p>
                            )}
                        </div>
                    </section>

                    {/* 새 콘티 만들기 접이식 */}
                    <details className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
                        <summary className="min-h-11 cursor-pointer font-bold text-foreground hover:text-primary transition-colors flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Plus size={16} className="text-secondary" />
                                <span>새 콘티 만들기</span>
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">펼치기</span>
                        </summary>
                        <div className="mt-4 pt-3 border-t border-border/60">
                            <SetlistComposer songs={songs} disabled={!ready} saveAction={hasBackend ? undefined : addSetlist} />
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
}
