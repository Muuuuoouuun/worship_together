"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { readPrototypeLibrary } from '@/lib/libraryPrototypeStorage';
import { getTeamSnapshot, parseTeamSnapshot } from '@/lib/teamPrototype';
import { DEMO_SESSION_ID } from '@/lib/constants';
import { normalizeSessionState, type SessionDetail } from '@/types/session';
import { readSongForm } from '@/lib/songFormStorage';
import { buttonVariants } from '@/components/ui/button';
import Notice from '@/components/ui/Notice';
import { SessionSkeleton, TeamModeSkeleton } from './SessionLoadingSkeleton';

// 각 화면은 자기 모드만 내려받습니다 (준비 화면에 무대 화면 코드가, 무대 화면에 준비 화면 코드가 섞이지 않게).
const SessionWorkspace = dynamic(() => import('./SessionWorkspace'), { loading: () => <SessionSkeleton /> });
const WorshipTeamMode = dynamic(() => import('./WorshipTeamMode'), { loading: () => <TeamModeSkeleton /> });

export default function ClientSessionLoader({ detail, setlistId, requestedTeamId, onlineTeamName, mode = 'workspace' }: {
    detail: SessionDetail; setlistId?: string; requestedTeamId?: string; onlineTeamName?: string; mode?: 'workspace' | 'team';
}) {
    const [resolved, setResolved] = useState<SessionDetail | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!setlistId) {
            setResolved(detail.session.id === DEMO_SESSION_ID ? { ...detail, currentState: { ...detail.currentState, page: 1, feedbackLog: [] }, session: { ...detail.session, current_state: { ...detail.session.current_state as object, page: 1, feedbackLog: [] } } } : detail);
            return;
        }
        try {
            const teamId = requestedTeamId ?? detail.session.team_id!;
            const library = readPrototypeLibrary(teamId);
            const setlist = library?.setlists.find(item => item.id === setlistId) ?? (detail.setlist?.id === setlistId && detail.setlist.team_id === teamId ? detail.setlist : null);
            if (!setlist) throw new Error('이 브라우저에 저장된 콘티가 없습니다. 콘티를 저장한 기기에서 열어주세요.');
            const order = Array.isArray(setlist.song_order) ? setlist.song_order : [];
            const songs = order.flatMap(id => (library?.songs ?? detail.songs).filter(song => song.id === id));
            if (!songs.length) throw new Error('콘티에 등록된 곡이 없습니다. 곡을 추가해주세요.');
            const team = parseTeamSnapshot(getTeamSnapshot()).teams.find(item => item.id === teamId);
            const form = readSongForm(songs[0].id, teamId);
            const currentState = normalizeSessionState({ songId: songs[0].id, page: 1, section: form?.sections[0] ? `1. ${form.sections[0].label}` : null }, songs);
            setResolved({
                ...detail, songs, setlist, currentState,
                session: { ...detail.session, id: `prototype-${setlist.id}`, team_id: teamId, setlist_id: setlist.id, current_state: null, is_active: true },
                team: onlineTeamName || team ? { ...detail.team!, id: teamId, name: onlineTeamName ?? team!.name } : detail.team,
            });
        } catch (cause) { setError(cause instanceof Error ? cause.message : '콘티를 불러오지 못했습니다.'); }
    }, [detail, requestedTeamId, setlistId, onlineTeamName]);
    if (error) {
        return (
            <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
                <Notice tone="error">{error}</Notice>
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/dashboard/songs">콘티로 돌아가기</Link>
            </main>
        );
    }
    if (!resolved) return mode === 'team' ? <TeamModeSkeleton /> : <SessionSkeleton />;
    const { session, songs, team, setlist, currentState } = resolved;
    const sessionHref = setlistId ? `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(session.team_id!)}` : `/session/${session.id}`;
    const common = { session, songs, teamId: session.team_id!, initialState: currentState, teamName: team?.name ?? '예배팀', setlistTitle: setlist?.title ?? '라이브 예배' };
    return mode === 'team' ? <WorshipTeamMode key={session.id} {...common} workspaceHref={sessionHref} /> : <SessionWorkspace key={session.id} {...common} sessionHref={sessionHref} worshipDateLabel={setlist ? new Date(setlist.worship_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '일정 미정'} theme={setlist?.theme ?? null} />;
}
