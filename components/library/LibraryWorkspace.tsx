'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientId } from '@/lib/clientId';
import { DEMO_SESSION_ID } from '@/lib/constants';
import type { SetlistWithSongs } from '@/lib/data';
import { hasDuplicateSongIds, normalizeSetlistSongOrder, LIBRARY_CHANGED_EVENT, readPrototypeLibrary, savePrototypeLibrary, type LibrarySong, type PrototypeLibrary } from '@/lib/libraryPrototypeStorage';
import { readSongForm } from '@/lib/songFormStorage';
import GlassCard from '@/components/ui/GlassCard';
import SongComposer from './SongComposer';
import SetlistComposer from './SetlistComposer';
import SongBpmPresetManager from './SongBpmPresetManager';
import SongFormEditor from './SongFormEditor';
import SetlistShareButton from './SetlistShareButton';
import { duplicateSetlistFromTemplate } from '@/actions/libraryActions';

export default function LibraryWorkspace({ initialSongs, initialSetlists, teamId, hasBackend }: {
    initialSongs: LibrarySong[]; initialSetlists: SetlistWithSongs[]; teamId: string; hasBackend: boolean;
}) {
    const seed: PrototypeLibrary = { version: 1, songs: initialSongs, setlists: initialSetlists.map(setlist => ({ id: setlist.id, team_id: setlist.team_id, title: setlist.title, theme: setlist.theme, worship_date: setlist.worship_date, song_order: normalizeSetlistSongOrder(setlist.song_order), created_at: setlist.created_at, updated_at: setlist.updated_at })) };
    const [library, setLibrary] = useState(seed);
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    useEffect(() => {
        function refresh() {
            if (hasBackend) { setReady(true); return; }
            try { const saved = readPrototypeLibrary(teamId); if (saved) setLibrary(saved); setReady(true); }
            catch (error) { setMessage(error instanceof Error ? error.message : '저장 데이터를 읽지 못했습니다.'); }
        }
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh); };
    }, [hasBackend, teamId]);
    function persist(change: (current: PrototypeLibrary) => PrototypeLibrary, success: string) {
        try {
            const next = change(readPrototypeLibrary(teamId) ?? library);
            savePrototypeLibrary(teamId, next); setLibrary(next); setMessage(success + ' 이 브라우저에 저장했습니다.');
        } catch (error) { setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.'); }
    }
    function bpmFrom(data: FormData): number | null {
        const value = String(data.get('bpm') ?? '').trim();
        if (!value) return null;
        const bpm = Number(value);
        if (!Number.isInteger(bpm) || bpm < 20 || bpm > 300) throw new Error('BPM은 20~300 사이 정수로 입력해주세요.');
        return bpm;
    }
    function addSong(data: FormData) {
        persist(current => {
            const title = String(data.get('title') ?? '').trim();
            if (!title) throw new Error('곡명을 입력해주세요.');
            const text = (key: string) => String(data.get(key) ?? '').trim() || null;
            const now = new Date().toISOString();
            const song: LibrarySong = { id: createClientId(), team_id: teamId, title, artist: text('artist'), original_key: text('originalKey'), bpm: bpmFrom(data), music_xml_url: text('musicXmlUrl'), data_xml: text('dataXml'), created_at: now, updated_at: now };
            return { ...current, songs: [song, ...current.songs] };
        }, '곡을');
    }
    function addSetlist(data: FormData) {
        persist(current => {
            const title = String(data.get('title') ?? '').trim();
            const date = new Date(String(data.get('worshipDate') ?? ''));
            const ids = data.getAll('songIds').map(String);
            if (hasDuplicateSongIds(ids)) throw new Error('콘티에는 같은 곡을 한 번만 추가할 수 있습니다. 후렴 반복은 곡의 송폼에서 설정해주세요.');
            if (!title || Number.isNaN(date.getTime()) || !ids.length || ids.some(id => !current.songs.some(song => song.id === id))) throw new Error('예배 제목, 일시, 곡 순서를 확인해주세요.');
            const now = new Date().toISOString();
            return { ...current, setlists: [{ id: createClientId(), team_id: teamId, title, theme: String(data.get('theme') ?? '').trim() || null, worship_date: date.toISOString(), song_order: ids, created_at: now, updated_at: now }, ...current.setlists] };
        }, '콘티를');
    }
    function updateBpm(data: FormData) {
        persist(current => ({ ...current, songs: current.songs.map(song => song.id === data.get('songId') ? { ...song, bpm: bpmFrom(data), updated_at: new Date().toISOString() } : song) }), 'BPM을');
    }
    function duplicate(id: string) {
        persist(current => {
            const original = current.setlists.find(setlist => setlist.id === id);
            if (!original) throw new Error('복제할 콘티를 찾지 못했습니다.');
            const date = new Date(original.worship_date); date.setDate(date.getDate() + 7);
            const now = new Date().toISOString();
            return { ...current, setlists: [{ ...original, id: createClientId(), title: `${original.title} (복사)`, worship_date: date.toISOString(), created_at: now, updated_at: now }, ...current.setlists] };
        }, '다음 주 콘티를');
    }
    const songs = hasBackend ? initialSongs : library.songs;
    const setlists = hasBackend ? initialSetlists : library.setlists;
    const filtered = songs.filter(song => `${song.title} ${song.artist ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    return <div className="space-y-6">
        <GlassCard className="space-y-2">
            <p className="text-sm font-semibold">{hasBackend ? '곡·콘티는 서버에 저장됩니다. 송폼은 현재 브라우저에 저장됩니다.' : '웹 프로토타입 · 이 브라우저에 저장'}</p>
            {!hasBackend && <p className="text-sm text-muted-foreground">곡·콘티·송폼은 새로고침 후에도 유지됩니다. 다른 기기로 자동 공유되지 않으며 브라우저 데이터를 지우면 삭제됩니다.</p>}
            <p className="text-sm">{songs.length}곡 · {setlists.length}개 콘티</p>
            <p role="status" aria-live="polite" className="text-sm font-semibold">{message}</p>
        </GlassCard>
        <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-6">
                <GlassCard>
                    <h2 className="text-xl font-bold">곡과 송폼</h2>
                    <label className="my-4 block text-sm">곡 검색<input className="mt-1 min-h-11 w-full rounded-lg border border-primary/20 bg-background px-3" value={search} onChange={e => setSearch(e.target.value)} placeholder="곡명 또는 아티스트" /></label>
                    <div className="space-y-3">{filtered.map(song => <div key={song.id} className="rounded-xl border border-primary/15 p-3">
                        <button type="button" className="min-h-11 w-full text-left" aria-expanded={expanded === song.id} onClick={() => setExpanded(id => id === song.id ? null : song.id)}>
                            <span className="block font-semibold">{song.title}</span><span className="text-xs text-muted-foreground">{[song.artist, song.original_key, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(' · ')} · 송폼 {expanded === song.id ? '접기' : '보기 / 편집'}</span>
                        </button>
                        {expanded === song.id && ready && <SongFormEditor key={song.id} songId={song.id} teamId={teamId} initialForm={readSongForm(song.id, teamId)} />}
                    </div>)}{!filtered.length && <p className="text-sm text-muted-foreground">표시할 곡이 없습니다.</p>}</div>
                </GlassCard>
                <details className="rounded-xl border border-primary/15 p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">새 곡 추가</summary><SongComposer disabled={!ready} saveAction={hasBackend ? undefined : addSong} /></details>
                <details className="rounded-xl border border-primary/15 p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">곡별 BPM 수정</summary><SongBpmPresetManager songs={songs} disabled={!ready} saveAction={hasBackend ? undefined : updateBpm} /></details>
            </div>
            <div className="min-w-0 space-y-6">
                <GlassCard>
                    <h2 className="mb-4 text-xl font-bold">저장된 콘티</h2>
                    <div className="space-y-4">{setlists.map(setlist => {
                        const ids = normalizeSetlistSongOrder(setlist.song_order);
                        const ordered = ids.map(id => songs.find(song => song.id === id));
                        const date = new Date(setlist.worship_date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        return <div key={setlist.id} className="rounded-xl border border-primary/15 p-3">
                            <h3 className="font-semibold">{setlist.title}</h3><p className="mt-1 text-xs text-muted-foreground">{date} (한국 시간){setlist.theme ? ` · ${setlist.theme}` : ''}</p>
                            <ol className="my-3 space-y-2 text-sm">{ordered.map((song, i) => <li key={`${ids[i]}-${i}`}>{i + 1}. {song?.title ?? '곡을 찾을 수 없습니다.'}</li>)}</ol>
                            <div className="flex flex-wrap gap-2">
                                <Link className="inline-flex min-h-12 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold" href={`/dashboard/planning?team=${encodeURIComponent(teamId)}&tab=requests&setlistId=${encodeURIComponent(setlist.id)}&setlistTitle=${encodeURIComponent(setlist.title)}`}>인도자에게 질문·요청</Link>
                                <SetlistShareButton shareText={[setlist.title, date, ...ordered.map((song, i) => `${i + 1}. ${song?.title ?? '알 수 없는 곡'}`)].join('\n')} />
                                {hasBackend ? <form action={duplicateSetlistFromTemplate}><input type="hidden" name="setlistId" value={setlist.id} /><button className="min-h-11 rounded-lg border px-3 text-sm">다음 주 복제</button></form> : <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => duplicate(setlist.id)}>다음 주 복제</button>}
                                {!hasBackend && ordered.length > 0 && <>
                                    <Link className="flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground" href={`/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}>이 콘티로 예배 열기</Link>
                                    <Link className="flex min-h-11 items-center rounded-lg border border-primary/20 px-3 text-sm" href={`/session/${DEMO_SESSION_ID}/team?setlist=${encodeURIComponent(setlist.id)}&team=${encodeURIComponent(teamId)}`}>팀원 화면</Link>
                                </>}
                            </div>
                        </div>;
                    })}{!setlists.length && <p className="text-sm">아직 저장된 콘티가 없습니다.</p>}</div>
                </GlassCard>
                <details className="rounded-xl border border-primary/15 p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">새 콘티 만들기</summary><SetlistComposer songs={songs} disabled={!ready} saveAction={hasBackend ? undefined : addSetlist} /></details>
            </div>
        </div>
    </div>;
}
