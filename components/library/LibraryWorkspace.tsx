'use client';

import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import Link from 'next/link';
import { createClientId } from '@/lib/clientId';
import { DEMO_SESSION_ID } from '@/lib/constants';
import type { SetlistWithSongs } from '@/lib/data';
import {
    normalizeSetlistSongOrder,
    LIBRARY_CHANGED_EVENT,
    readPrototypeLibrary,
    savePrototypeLibrary,
    type LibrarySong,
    type PrototypeLibrary,
} from '@/lib/libraryPrototypeStorage';
import { readSongForm } from '@/lib/songFormStorage';
import { buttonVariants } from '@/components/ui/button';
import PageTabs, { type PageTab } from '@/components/ui/PageTabs';
import { STATUS } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import {
    BarChart3,
    Bell,
    Calendar,
    CalendarClock,
    ChevronDown,
    ChevronUp,
    Copy,
    MessageSquareText,
    Music,
    Plus,
    Radio,
    Search,
    SlidersHorizontal,
    Trash2,
    UsersRound,
} from 'lucide-react';
import SongComposer from './SongComposer';
import SetlistComposer from './SetlistComposer';
import SongBpmPresetManager from './SongBpmPresetManager';
import SongFormEditor from './SongFormEditor';
import SetlistShareButton from './SetlistShareButton';
import SetlistTimeline from './SetlistTimeline';
import SongUsageInsights from './SongUsageInsights';
import { duplicateSetlistFromTemplate, deleteSong, deleteSetlist } from '@/actions/libraryActions';

type LibraryTab = 'catalog' | 'timeline' | 'insights' | 'bpm';

/** 날짜 형식기는 한 번만 만듭니다 (콘티마다 새로 만들면 느립니다). */
const WORSHIP_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

const iconButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive';

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
    const [library, setLibrary] = useState<PrototypeLibrary>(() => ({
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
    }));
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<LibraryTab>('catalog');

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

    function removeSong(id: string) {
        if (!window.confirm('이 곡을 라이브러리에서 삭제하시겠습니까?')) return;
        persist((current) => ({
            ...current,
            songs: current.songs.filter((s) => s.id !== id),
            setlists: current.setlists.map((sl) => ({
                ...sl,
                song_order: sl.song_order.filter((songId) => songId !== id),
            })),
        }), '찬양곡을');
    }

    function addSetlist(data: FormData) {
        persist((current) => {
            const title = String(data.get('title') ?? '').trim();
            const date = new Date(String(data.get('worshipDate') ?? ''));
            const ids = data.getAll('songIds').map(String);
            if (!title || Number.isNaN(date.getTime()) || !ids.length || ids.some((id) => !current.songs.some((song) => song.id === id))) {
                throw new Error('예배 제목, 일시, 곡 순서를 확인해주세요.');
            }
            const now = new Date().toISOString();
            const requestedId = String(data.get('setlistId') ?? '').trim();
            const id = requestedId && !current.setlists.some((setlist) => setlist.id === requestedId) ? requestedId : createClientId();
            return {
                ...current,
                setlists: [
                    {
                        id,
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

    function removeSetlist(id: string) {
        if (!window.confirm('이 콘티를 삭제하시겠습니까?')) return;
        persist((current) => ({
            ...current,
            setlists: current.setlists.filter((sl) => sl.id !== id),
        }), '콘티를');
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
    const deferredSearch = useDeferredValue(search);
    const filtered = useMemo(() => {
        if (!deferredSearch.trim()) return songs;
        const q = deferredSearch.toLowerCase();
        return songs.filter((song) =>
            `${song.title} ${song.artist ?? ''}`.toLowerCase().includes(q)
        );
    }, [songs, deferredSearch]);

    const songById = useMemo(() => new Map(songs.map((song) => [song.id, song] as const)), [songs]);

    /** 콘티마다 한 번만 계산 (검색어를 칠 때마다 다시 만들지 않습니다) */
    const setlistRows = useMemo(
        () =>
            setlists.map((setlist) => {
                const ids = normalizeSetlistSongOrder(setlist.song_order);
                const ordered = ids.map((id) => songById.get(id));
                const dateLabel = WORSHIP_DATE.format(new Date(setlist.worship_date));
                return {
                    setlist,
                    ids,
                    ordered,
                    dateLabel,
                    shareText: [setlist.title, dateLabel, ...ordered.map((song, i) => `${i + 1}. ${song?.title ?? '알 수 없는 곡'}`)].join('\n'),
                    titles: ordered.map((song) => song?.title).filter(Boolean).join('||'),
                };
            }),
        [setlists, songById],
    );

    const setlistsWithSongs: SetlistWithSongs[] = useMemo(
        () =>
            setlistRows.map(({ setlist, ordered }) => ({
                id: setlist.id,
                team_id: setlist.team_id,
                title: setlist.title,
                theme: setlist.theme,
                worship_date: setlist.worship_date,
                song_order: setlist.song_order,
                created_at: setlist.created_at,
                updated_at: setlist.updated_at,
                songs: ordered.filter((song): song is LibrarySong => Boolean(song)),
            })),
        [setlistRows],
    );

    const tabs: PageTab<LibraryTab>[] = [
        { id: 'catalog', label: '곡 & 콘티', icon: <Music size={15} aria-hidden="true" /> },
        { id: 'timeline', label: '콘티 타임라인', count: setlists.length, icon: <CalendarClock size={15} aria-hidden="true" /> },
        { id: 'insights', label: '선곡 통계', icon: <BarChart3 size={15} aria-hidden="true" /> },
        { id: 'bpm', label: 'BPM & 메트로놈', icon: <SlidersHorizontal size={15} aria-hidden="true" /> },
    ];

    return (
        <div className="space-y-6">
            {/* 저장 위치 · 개수 */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn('size-1.5 rounded-full', hasBackend ? STATUS.ok.dot : STATUS.idle.dot)} aria-hidden="true" />
                    {hasBackend ? '서버 연결됨' : '브라우저 로컬 저장'}
                    <span aria-hidden="true">·</span>
                    찬양 {songs.length}곡 · 콘티 {setlists.length}개
                </p>
                {message && (
                    <p role="status" aria-live="polite" className="text-xs font-medium text-foreground">
                        {message}
                    </p>
                )}
            </div>

            <PageTabs label="곡 보관함 화면" tabs={tabs} value={activeTab} onChange={setActiveTab} />

            {activeTab === 'timeline' && <SetlistTimeline setlists={setlistsWithSongs} />}

            {activeTab === 'insights' && <SongUsageInsights setlists={setlistsWithSongs} songs={songs} />}

            {activeTab === 'bpm' && <SongBpmPresetManager songs={songs} disabled={!ready} saveAction={hasBackend ? undefined : updateBpm} />}

            {activeTab === 'catalog' && (
                <div className="grid items-start gap-10 xl:grid-cols-2 xl:gap-12">
                    {/* 곡 보관함 & 송폼 */}
                    <section aria-labelledby="library-songs" className="min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <h2 id="library-songs" className="text-[17px] font-semibold tracking-tight text-foreground">
                                곡 보관함 & 송폼
                            </h2>
                            <span className="text-xs text-muted-foreground">{filtered.length}곡 검색됨</span>
                        </div>

                        <label className="relative block">
                            <span className="sr-only">곡 검색</span>
                            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <input
                                className="h-11 w-full rounded-full bg-muted pl-11 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="곡명 또는 아티스트 검색…"
                            />
                        </label>

                        <ul className="divide-y divide-border/70">
                            {filtered.map((song) => (
                                <li key={song.id} className="py-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-left"
                                            aria-expanded={expanded === song.id}
                                            onClick={() => setExpanded((id) => (id === song.id ? null : song.id))}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-[15px] font-medium text-foreground">{song.title}</span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {[song.artist, song.original_key && `Key ${song.original_key}`, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ') || '정보 없음'}
                                                </span>
                                            </span>
                                            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
                                                송폼
                                                {expanded === song.id ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                                            </span>
                                        </button>

                                        {hasBackend ? (
                                            <form
                                                action={deleteSong}
                                                onSubmit={(e) => {
                                                    if (!window.confirm('이 곡을 삭제하시겠습니까?')) e.preventDefault();
                                                }}
                                            >
                                                <input type="hidden" name="songId" value={song.id} />
                                                <input type="hidden" name="teamId" value={teamId} />
                                                <button type="submit" title="곡 삭제" aria-label={`${song.title} 삭제`} className={iconButton}>
                                                    <Trash2 size={15} aria-hidden="true" />
                                                </button>
                                            </form>
                                        ) : (
                                            <button type="button" title="곡 삭제" aria-label={`${song.title} 삭제`} onClick={() => removeSong(song.id)} className={iconButton}>
                                                <Trash2 size={15} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>

                                    {expanded === song.id && ready && (
                                        <div className="mt-2 rounded-2xl bg-muted/60 p-4">
                                            <SongFormEditor key={song.id} songId={song.id} teamId={teamId} initialForm={readSongForm(song.id, teamId)} />
                                        </div>
                                    )}
                                </li>
                            ))}
                            {!filtered.length && <li className="py-10 text-center text-sm text-muted-foreground">표시할 곡이 없습니다.</li>}
                        </ul>

                        <details className="group border-t border-border/70 pt-4">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                                <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground" aria-hidden="true">
                                    <Plus size={18} strokeWidth={2.25} />
                                </span>
                                <span className="flex-1 text-[15px] font-medium text-foreground">새 곡 추가하기</span>
                                <ChevronDown size={16} className="text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="pt-4">
                                <SongComposer disabled={!ready} saveAction={hasBackend ? undefined : addSong} />
                            </div>
                        </details>
                    </section>

                    {/* 저장된 콘티 목록 */}
                    <section aria-labelledby="library-setlists" className="min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <h2 id="library-setlists" className="text-[17px] font-semibold tracking-tight text-foreground">
                                저장된 콘티 목록
                            </h2>
                            <span className="text-xs text-muted-foreground">{setlists.length}개</span>
                        </div>

                        <ul className="divide-y divide-border/70">
                            {setlistRows.map(({ setlist, ids, ordered, dateLabel, shareText, titles }) => (
                                <li key={setlist.id} className="py-5 first:pt-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                                <Calendar size={12} aria-hidden="true" />
                                                {dateLabel}
                                            </p>
                                            <h3 className="mt-0.5 text-[15px] font-semibold tracking-tight text-foreground">{setlist.title}</h3>
                                            {setlist.theme && <p className="mt-0.5 text-xs text-muted-foreground">{setlist.theme}</p>}
                                        </div>
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ordered.length}곡</span>
                                    </div>

                                    <ol className="mt-3 space-y-1.5 text-[13px]">
                                        {ordered.map((song, i) => (
                                            <li key={`${ids[i]}-${i}`} className="flex items-center gap-3">
                                                <span className="w-3 tabular-nums text-muted-foreground">{i + 1}</span>
                                                <span className="min-w-0 flex-1 truncate text-foreground">{song?.title ?? '곡을 찾을 수 없습니다.'}</span>
                                                {song?.original_key && <span className="shrink-0 text-xs text-muted-foreground">Key {song.original_key}</span>}
                                            </li>
                                        ))}
                                    </ol>

                                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                                        {ordered.length > 0 && (
                                            <Link className={buttonVariants({ size: 'xs' })} href={`/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}>
                                                <Radio size={13} aria-hidden="true" />
                                                예배 열기
                                            </Link>
                                        )}
                                        {ordered.length > 0 && (
                                            <Link className={buttonVariants({ variant: 'outline', size: 'xs' })} href={`/session/${DEMO_SESSION_ID}/team?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}>
                                                <UsersRound size={13} aria-hidden="true" />
                                                팀원 화면
                                            </Link>
                                        )}
                                        <Link
                                            className={buttonVariants({ variant: 'outline', size: 'xs' })}
                                            href={`/dashboard/planning?team=${encodeURIComponent(teamId)}&tab=schedule&linkSetlistId=${encodeURIComponent(setlist.id)}&linkSetlistTitle=${encodeURIComponent(setlist.title)}&linkSetlistSongs=${encodeURIComponent(titles)}`}
                                            title="이 콘티를 예배 일정에 연결하고 당번에게 알림 보내기"
                                        >
                                            <Bell size={13} aria-hidden="true" />
                                            일정 연결 & 당번 알림
                                        </Link>
                                        <Link
                                            className={buttonVariants({ variant: 'outline', size: 'xs' })}
                                            href={`/dashboard/planning?team=${encodeURIComponent(teamId)}&tab=requests&setlistId=${encodeURIComponent(setlist.id)}&setlistTitle=${encodeURIComponent(setlist.title)}`}
                                        >
                                            <MessageSquareText size={13} aria-hidden="true" />
                                            질문·요청
                                        </Link>
                                        <SetlistShareButton shareText={shareText} />
                                        {hasBackend ? (
                                            <form action={duplicateSetlistFromTemplate}>
                                                <input type="hidden" name="setlistId" value={setlist.id} />
                                                <input type="hidden" name="teamId" value={teamId} />
                                                <button className={buttonVariants({ variant: 'outline', size: 'xs' })}>
                                                    <Copy size={13} aria-hidden="true" />
                                                    다음 주 복제
                                                </button>
                                            </form>
                                        ) : (
                                            <button type="button" className={buttonVariants({ variant: 'outline', size: 'xs' })} onClick={() => duplicate(setlist.id)}>
                                                <Copy size={13} aria-hidden="true" />
                                                다음 주 복제
                                            </button>
                                        )}
                                        {hasBackend ? (
                                            <form
                                                action={deleteSetlist}
                                                onSubmit={(e) => {
                                                    if (!window.confirm('이 콘티를 삭제하시겠습니까?')) e.preventDefault();
                                                }}
                                            >
                                                <input type="hidden" name="setlistId" value={setlist.id} />
                                                <input type="hidden" name="teamId" value={teamId} />
                                                <button type="submit" title="콘티 삭제" className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-destructive hover:bg-destructive/10')}>
                                                    <Trash2 size={13} aria-hidden="true" />
                                                    삭제
                                                </button>
                                            </form>
                                        ) : (
                                            <button type="button" title="콘티 삭제" onClick={() => removeSetlist(setlist.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'text-destructive hover:bg-destructive/10')}>
                                                <Trash2 size={13} aria-hidden="true" />
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                            {!setlists.length && <li className="py-10 text-center text-sm text-muted-foreground">아직 저장된 콘티가 없습니다.</li>}
                        </ul>

                        <details className="group border-t border-border/70 pt-4">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                                <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground" aria-hidden="true">
                                    <Plus size={18} strokeWidth={2.25} />
                                </span>
                                <span className="flex-1 text-[15px] font-medium text-foreground">새 콘티 만들기</span>
                                <ChevronDown size={16} className="text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="pt-4">
                                <SetlistComposer songs={songs} teamId={teamId} disabled={!ready} saveAction={hasBackend ? undefined : addSetlist} />
                            </div>
                        </details>
                    </section>
                </div>
            )}
        </div>
    );
}
