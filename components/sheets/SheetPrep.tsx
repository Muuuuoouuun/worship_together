'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Library } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { LIBRARY_CHANGED_EVENT, readPrototypeLibrary } from '@/lib/libraryPrototypeStorage';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';

const SheetAnnotationWorkspace = dynamic(() => import('@/components/session/SheetAnnotationWorkspace'), {
    loading: () => <div className="h-96 animate-pulse rounded-3xl bg-muted" />,
});

const noop = () => () => {};

function subscribeLibrary(callback: () => void) {
    window.addEventListener(LIBRARY_CHANGED_EVENT, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(LIBRARY_CHANGED_EVENT, callback);
        window.removeEventListener('storage', callback);
    };
}

/**
 * 악보 준비. 팀은 지금 팀(로그인한 온라인 팀) → 이 브라우저의 체험 팀 → 예시 팀 순서로 정합니다.
 * 곡 목록은 곡 보관함과 같은 저장소(온라인 팀은 팀원 모두와 동기화)에서 읽습니다.
 */
export default function SheetPrep({ initialSongId, onlineTeamId, canShare, demoSongs }: { initialSongId: string | null; onlineTeamId: string | null; canShare: boolean; demoSongs: { id: string; title: string }[] }) {
    const isClient = useSyncExternalStore(noop, () => true, () => false);
    const rawTeams = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const teamId = useMemo(() => {
        if (onlineTeamId) return onlineTeamId;
        try {
            const state = parseTeamSnapshot(rawTeams);
            return (state.teams.find((item) => item.id === state.activeTeamId) ?? state.teams[0])?.id ?? DEMO_TEAM_ID;
        } catch {
            return DEMO_TEAM_ID;
        }
    }, [onlineTeamId, rawTeams]);
    const libraryRaw = useSyncExternalStore(subscribeLibrary, () => {
        try { return localStorage.getItem(`worship-together:library:v1:${encodeURIComponent(teamId)}`) ?? ''; } catch { return ''; }
    }, () => '');
    const songs = useMemo(() => {
        void libraryRaw;
        if (!isClient) return [];
        try {
            const library = readPrototypeLibrary(teamId);
            if (library?.songs.length) return library.songs.map((song) => ({ id: song.id, title: song.title }));
        } catch { /* 아래 예시 곡 */ }
        return teamId === DEMO_TEAM_ID ? demoSongs : [];
    }, [isClient, teamId, libraryRaw, demoSongs]);
    const [picked, setPicked] = useState<string | null>(initialSongId);
    const [page, setPage] = useState(1);
    const song = songs.find((item) => item.id === picked) ?? songs[0] ?? null;

    if (!isClient) return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;
    if (!song) {
        return (
            <section className="rounded-3xl border border-dashed border-input px-5 py-10 text-center">
                <p className="text-[15px] font-semibold text-foreground">곡 보관함에 곡이 없어요</p>
                <p className="mt-1 text-sm text-muted-foreground">곡을 먼저 추가하면 곡마다 악보를 올릴 수 있어요.</p>
                <Link href="/dashboard/songs/library" className={buttonVariants({ className: 'mt-5' })}>
                    <Library aria-hidden="true" />
                    곡 보관함 열기
                </Link>
            </section>
        );
    }

    return (
        <div className="space-y-4">
            <label className="block max-w-sm text-xs font-medium text-muted-foreground">
                곡
                <Select className="mt-1.5" value={song.id} onChange={(event) => { setPicked(event.target.value); setPage(1); }}>
                    {songs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </Select>
            </label>
            {onlineTeamId ? (
                <Notice tone="info">
                    {canShare
                        ? "'팀에 공유' 한 악보는 팀원 모두의 기기와 예배 중 화면에 보여요. 내 표시는 공유하기 전까지 이 기기에만 있어요."
                        : '악보 공유는 콘티 편집 권한이 있는 팀원이 해요. 내 표시 · 메모는 이 기기에 저장돼요.'}
                </Notice>
            ) : null}
            <SheetAnnotationWorkspace key={`${teamId}:${song.id}`} teamId={teamId} songId={song.id} title={song.title} page={page} onPageChange={setPage} canTurnPage onPageCountChange={() => {}} />
        </div>
    );
}
