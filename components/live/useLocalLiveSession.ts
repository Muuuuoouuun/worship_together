'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readSetlistDetails } from '@/lib/setlistDetailsStorage';
import { readSongForm } from '@/lib/songFormStorage';
import { resolveSetlistPlans } from '@/lib/stageSongPlan';
import { serviceDateLabel } from '@/lib/liveSnapshot';
import type { SessionDetail } from '@/types/session';
import { CUE_TARGET_LABEL, QUICK_CUES_ALL, cueById, type CueDefinition, type LiveCueEntry, type LiveScreenHandlers, type LiveScreenModel, type LiveSong, type LiveToast } from './model';

/*
 * 이 기기에서만 진행하는 예배 (로그인하지 않았거나 이 브라우저에 만든 체험 팀).
 * 서버 예배와 같은 화면(LiveScreen)을 쓰되, 진행 · 큐는 같은 브라우저의 다른 탭에만 전해집니다(BroadcastChannel).
 * 팀원과 함께하려면 로그인해서 팀을 만들도록 처음에 한 번 알려 줍니다 — 가짜 팀원이나 가짜 접속은 만들지 않습니다.
 */

interface LocalState {
    songIndex: number;
    sectionIndex: number;
    page: number;
    bpm: number | null;
    ended: boolean;
}

type Message = { type: 'state'; state: LocalState; from: string } | { type: 'cue'; cue: LiveCueEntry; from: string };

const ME = 'local-me';
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

function songsOf(detail: SessionDetail): LiveSong[] {
    const teamId = detail.session.team_id ?? '';
    const setlist = detail.setlist;
    const details = teamId && setlist ? readSetlistDetails(teamId, setlist.id, { title: setlist.title, createdAt: setlist.created_at }) : null;
    const plans = resolveSetlistPlans(detail.songs, details);
    return detail.songs.map((song) => {
        const plan = plans[song.id];
        return {
            id: song.id,
            title: song.title,
            key: plan?.key ?? song.original_key ?? null,
            bpm: plan?.bpm ?? song.bpm ?? null,
            meter: '4/4',
            sections: teamId ? readSongForm(song.id, teamId)?.sections.map((section) => section.label) ?? [] : [],
            note: plan?.directionNotes.join(' · ') || null,
            transitionNote: plan?.transitionNote ?? null,
            lead: details?.overrides[song.id]?.lead?.trim() || null,
        };
    });
}

function storageKey(sessionKey: string) {
    return `worship:local-live:v1:${sessionKey}`;
}

export function useLocalLiveSession(detail: SessionDetail, { exitHref = '/dashboard', loginHref }: { exitHref?: string; loginHref: string }): { model: LiveScreenModel; handlers: LiveScreenHandlers } {
    const router = useRouter();
    const songs = useMemo(() => songsOf(detail), [detail]);
    const sessionKey = `${detail.session.team_id ?? 'demo'}:${detail.setlist?.id ?? detail.session.id}`;
    const [state, setState] = useState<LocalState>(() => {
        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey(sessionKey)) ?? 'null') as LocalState | null;
            if (stored && stored.songIndex < songs.length) return stored;
        } catch { /* 처음부터 */ }
        const first = songs[0];
        return { songIndex: 0, sectionIndex: first?.sections.length ? 0 : -1, page: 1, bpm: first?.bpm ?? null, ended: false };
    });
    const [cues, setCues] = useState<LiveCueEntry[]>([]);
    const [toasts, setToasts] = useState<LiveToast[]>(() => [{
        id: 'local-only',
        kind: 'team',
        tone: 'info',
        urgency: 'low',
        title: '이 기기에서만 진행돼요',
        body: '로그인하고 팀을 만들면 팀원 모두가 함께 들어와요',
        action: '로그인',
        ttl: 8000,
        createdAt: Date.now(),
    }]);
    const tabId = useRef(nextId('tab'));
    const channel = useRef<BroadcastChannel | null>(null);
    const [startedAt] = useState(() => new Date().toISOString());

    // 같은 브라우저의 다른 탭과 진행 · 큐를 나눕니다.
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const bc = new BroadcastChannel(`worship-local-live:${sessionKey}`);
        channel.current = bc;
        bc.onmessage = (event: MessageEvent<Message>) => {
            const message = event.data;
            if (!message || message.from === tabId.current) return;
            if (message.type === 'state') setState(message.state);
            if (message.type === 'cue') {
                const cue = { ...message.cue, fromMe: false, forMe: true };
                setCues((current) => [cue, ...current].slice(0, 40));
                setToasts((current) => [{
                    id: `cue-${cue.id}`, cueEntryId: cue.id, kind: cue.target === 'all' ? 'cue-all' as const : 'cue-role' as const, tone: 'cue' as const, urgency: 'high' as const,
                    title: cue.label, from: '다른 탭', target: cue.targetLabel, ackable: true, ttl: 8000, createdAt: Date.now(),
                }, ...current].slice(0, 6));
            }
        };
        return () => {
            bc.close();
            channel.current = null;
        };
    }, [sessionKey]);

    const commit = useCallback((next: LocalState) => {
        setState(next);
        try { sessionStorage.setItem(storageKey(sessionKey), JSON.stringify(next)); } catch { /* 저장 안 돼도 진행은 계속 */ }
        channel.current?.postMessage({ type: 'state', state: next, from: tabId.current } satisfies Message);
    }, [sessionKey]);

    const move = useCallback((patch: Partial<Pick<LocalState, 'songIndex' | 'sectionIndex' | 'page' | 'bpm'>>) => {
        // 서버 세션(liveRepository.move)과 같은 규칙: 곡이 바뀌면 첫 섹션 · 1쪽 · 그 곡 BPM 에서 시작
        const next = { ...state };
        if (typeof patch.songIndex === 'number') {
            const songIndex = Math.max(0, Math.min(songs.length - 1, patch.songIndex));
            if (songIndex !== state.songIndex) Object.assign(next, { songIndex, sectionIndex: songs[songIndex].sections.length ? 0 : -1, page: 1, bpm: songs[songIndex].bpm });
        }
        const song = songs[next.songIndex];
        if (typeof patch.sectionIndex === 'number') next.sectionIndex = song.sections.length ? Math.max(0, Math.min(song.sections.length - 1, patch.sectionIndex)) : -1;
        if (typeof patch.page === 'number') next.page = Math.max(1, Math.min(99, patch.page));
        if (patch.bpm !== undefined) next.bpm = patch.bpm;
        commit(next);
    }, [state, songs, commit]);

    const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

    const handlers = useMemo<LiveScreenHandlers>(() => ({
        goSong: (index) => move({ songIndex: index }),
        goSection: (index) => move({ sectionIndex: index }),
        next: () => {
            const song = songs[state.songIndex];
            if (song && state.sectionIndex >= 0 && state.sectionIndex < song.sections.length - 1) move({ sectionIndex: state.sectionIndex + 1 });
            else if (state.songIndex < songs.length - 1) move({ songIndex: state.songIndex + 1 });
        },
        prev: () => {
            if (state.sectionIndex > 0) move({ sectionIndex: state.sectionIndex - 1 });
            else if (state.songIndex > 0) move({ songIndex: state.songIndex - 1, sectionIndex: Math.max(0, songs[state.songIndex - 1].sections.length - 1) });
        },
        setPage: (page) => move({ page }),
        setBpm: (bpm) => move({ bpm }),
        sendCue: async (cue: CueDefinition) => {
            const entry: LiveCueEntry = {
                id: nextId('cue'), cueId: cue.id, label: cue.label, target: cue.target, targetLabel: CUE_TARGET_LABEL[cue.target],
                fromUserId: ME, fromName: '나', fromMe: true, forMe: false, createdAt: new Date().toISOString(), recipients: 0, acks: [], ackedByMe: false,
            };
            setCues((current) => [entry, ...current].slice(0, 40));
            channel.current?.postMessage({ type: 'cue', cue: entry, from: tabId.current } satisfies Message);
            setToasts((current) => [{
                id: `sent-${entry.id}`, cueEntryId: entry.id, kind: 'cue-sent' as const, tone: 'success' as const, urgency: 'low' as const,
                title: `보냄 · ${cue.label}`, body: '이 브라우저의 다른 탭에만 전해져요', target: entry.targetLabel, ttl: 3500, createdAt: Date.now(),
            }, ...current].slice(0, 6));
            return true;
        },
        ack: (id) => setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, acked: true, ttl: 1200, createdAt: Date.now() } : toast))),
        dismiss,
        action: (id) => {
            dismiss(id);
            if (id === 'local-only') router.push(loginHref);
        },
        leave: () => router.push(exitHref),
        end: () => commit({ ...state, ended: true }),
    }), [move, songs, state, dismiss, router, loginHref, exitHref, commit]);

    const model = useMemo<LiveScreenModel>(() => {
        const setlist = detail.setlist;
        const teamName = detail.team?.name ?? '예배팀';
        return {
            sessionId: detail.session.id,
            teamId: detail.session.team_id ?? '',
            teamName,
            title: setlist?.title ?? '예배',
            dateLabel: setlist ? serviceDateLabel(setlist.worship_date) : null,
            theme: setlist?.theme ?? null,
            startedAt,
            songs,
            songIndex: state.songIndex,
            sectionIndex: state.sectionIndex,
            page: state.page,
            bpm: state.bpm,
            ended: state.ended,
            endedByName: state.ended ? '나' : null,
            canControl: true,
            controllerNames: [],
            lastMovedBy: null,
            members: [{ userId: ME, name: '나', role: 'leader', roleLabel: '이 기기', group: 'leader', online: true, me: true, controller: true }],
            cues,
            toasts,
            quickCues: QUICK_CUES_ALL.map((id) => cueById(id)!),
            canCueAll: true,
            connection: 'online',
            me: { userId: ME, name: '나', role: 'leader', group: 'leader' },
            exitHref,
            contiHref: setlist ? `/dashboard/songs?tab=order&setlist=${encodeURIComponent(setlist.id)}` : '/dashboard/songs',
        };
    }, [detail, songs, state, cues, toasts, exitHref, startedAt]);

    return { model, handlers };
}
