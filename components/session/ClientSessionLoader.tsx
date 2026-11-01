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
import { TeamModeSkeleton } from './SessionLoadingSkeleton';

import { readSetlistDetails } from '@/lib/setlistDetailsStorage';
import { applyBpmOverrides, resolveStateBpm } from '@/lib/stageSongPlan';

/** 콘티 만들기·편집 화면에서 정한 이번 주 BPM 을 곡 BPM(템포 기본값)과 시작 BPM 에 반영합니다. */
function withSetlistBpm(detail: SessionDetail): SessionDetail {
    const { team_id: teamId, setlist_id: setlistId } = detail.session;
    if (!teamId || !setlistId) return detail;
    const legacy = detail.setlist ? { title: detail.setlist.title, createdAt: detail.setlist.created_at } : undefined;
    const songs = applyBpmOverrides(detail.songs, readSetlistDetails(teamId, setlistId, legacy));
    if (songs === detail.songs) return detail;
    const bpmValue = resolveStateBpm(detail.currentState.bpmValue, detail.currentState.songId, detail.songs, songs);
    const stored = detail.session.current_state;
    return {
        ...detail,
        songs,
        currentState: { ...detail.currentState, bpmValue },
        session: stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...detail.session, current_state: { ...stored, bpmValue } } : detail.session,
    };
}

// 예배 중 화면은 서버 예배(/live)와 같은 화면(LiveScreen)을 이 기기 모드로 씁니다.
const LocalLiveScreen = dynamic(() => import('@/components/live/LocalLiveScreen'), { loading: () => <TeamModeSkeleton /> });

export default function ClientSessionLoader({ detail, setlistId, requestedTeamId, onlineTeamName }: {
    detail: SessionDetail; setlistId?: string; requestedTeamId?: string; onlineTeamName?: string;
}) {
    const [resolved, setResolved] = useState<SessionDetail | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!setlistId) {
            setResolved(withSetlistBpm(detail.session.id === DEMO_SESSION_ID ? { ...detail, currentState: { ...detail.currentState, page: 1, feedbackLog: [] }, session: { ...detail.session, current_state: { ...detail.session.current_state as object, page: 1, feedbackLog: [] } } } : detail));
            return;
        }
        try {
            const teamId = requestedTeamId ?? detail.session.team_id!;
            const library = readPrototypeLibrary(teamId);
            const setlist = library?.setlists.find(item => item.id === setlistId) ?? (detail.setlist?.id === setlistId && detail.setlist.team_id === teamId ? detail.setlist : null);
            if (!setlist) throw new Error('이 브라우저에 저장된 콘티가 없습니다. 콘티를 저장한 기기에서 열어주세요.');
            const order = Array.isArray(setlist.song_order) ? setlist.song_order : [];
            const librarySongs = order.flatMap(id => (library?.songs ?? detail.songs).filter(song => song.id === id));
            if (!librarySongs.length) throw new Error('콘티에 등록된 곡이 없습니다. 곡을 추가해주세요.');
            const songs = applyBpmOverrides(librarySongs, readSetlistDetails(teamId, setlist.id, { title: setlist.title, createdAt: setlist.created_at }));
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
    if (!resolved) return <TeamModeSkeleton />;
    const here = setlistId
        ? `/session/${DEMO_SESSION_ID}/team?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(resolved.session.team_id!)}`
        : `/session/${resolved.session.id}/team`;
    return <LocalLiveScreen key={resolved.session.id} detail={resolved} loginHref={`/login?callbackUrl=${encodeURIComponent(here)}`} />;
}
