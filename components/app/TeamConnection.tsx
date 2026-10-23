'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { reconnectTeamStreams, subscribeTeamStream, type StreamStatus, type TeamStreamEvent } from '@/lib/teamStream';
import { registerOnlineTeams, syncTeam, SYNC_NOTICE_EVENT, type SyncNotice } from '@/lib/teamDocSync';
import { PLANNING_CHANGED_EVENT } from '@/lib/planningDemo';
import { showAppToast } from '@/lib/appToast';
import { notifyDevice } from '@/lib/deviceNotify';
import type { LiveSessionSummary } from '@/lib/server/liveRepository';
import { DEFAULT_POLICY, type TeamPolicy } from '@/lib/permissions';

/** 공통 틀이 넘겨주는 지금 팀 정보 (로그인하고 온라인 팀이 있을 때만) */
export interface TeamConnectionInput {
    userId: string;
    userName: string;
    teamId: string;
    teamName: string;
    teams: { id: string; name: string }[];
    isAdmin: boolean;
    canRun: boolean;
    canEditConti: boolean;
    /** 지금 팀의 권한 설정 (일정 · 공지 버튼을 서버와 같은 규칙으로 보이게) */
    policy: TeamPolicy;
}

export interface TeamConnectionValue extends TeamConnectionInput {
    /** 팀에서 지금 진행 중인 예배 (없으면 null) */
    live: LiveSessionSummary | null;
    stream: StreamStatus;
}

const Context = createContext<TeamConnectionValue | null>(null);

/** 로그인하지 않았거나 온라인 팀이 없으면 null */
export function useTeamConnection(): TeamConnectionValue | null {
    return useContext(Context);
}

/** 지금 팀의 권한 설정. 온라인 팀이 없으면(이 기기 체험) 기본값 */
export function useTeamPolicy(): TeamPolicy {
    return useContext(Context)?.policy ?? DEFAULT_POLICY;
}

export const liveHref = (sessionId: string) => `/live/${encodeURIComponent(sessionId)}`;
const planningHref = (teamId: string, target: string) => `/dashboard/planning?${new URLSearchParams({ team: teamId, tab: target, inbox: '1' })}`;

/** 'planning.notice' 소식 (actions/planningActions 가 보냄) */
interface PlanningNotice {
    id: string;
    title: string;
    body: string;
    urgent: boolean;
    target: 'requests' | 'schedule' | 'rotation';
}

/**
 * 공통 틀 한 곳에서 지금 팀과 실시간으로 이어 둡니다.
 * - 팀 소식 흐름 하나: 다른 팀원이 바꾼 콘티를 받아 오고, 일정 · 요청 화면을 다시 읽게 하고, 팀 명단 · 권한이 바뀌면 화면을 새로 그립니다.
 * - 예배가 시작되면 어느 화면에 있든 알림으로 '입장' 을 띄웁니다.
 * - 이 기기의 팀 자료(콘티 · 곡 · 송폼 · 링크)를 서버와 맞춥니다.
 */
export default function TeamConnection({ value, children }: { value: TeamConnectionInput | null; children: ReactNode }) {
    const router = useRouter();
    const [live, setLive] = useState<{ teamId: string; session: LiveSessionSummary | null } | null>(null);
    const [stream, setStream] = useState<StreamStatus>('connecting');
    const teamId = value?.teamId ?? null;
    const userId = value?.userId ?? null;
    const teamKey = value?.teams.map((team) => team.id).join(',') ?? '';
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 이 기기에서 맞출 팀 목록 → 지금 팀부터 받아 오고 나머지 팀도 차례로
    useEffect(() => {
        if (!teamId) return;
        const ids = teamKey.split(',').filter(Boolean);
        registerOnlineTeams(ids);
        void syncTeam(teamId).then(() => Promise.all(ids.filter((id) => id !== teamId).map((id) => syncTeam(id))));
        const again = () => {
            if (document.visibilityState !== 'visible') return;
            reconnectTeamStreams();
            void syncTeam(teamId);
        };
        const timer = setInterval(again, 120_000);
        window.addEventListener('focus', again);
        window.addEventListener('online', again);
        document.addEventListener('visibilitychange', again);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', again);
            window.removeEventListener('online', again);
            document.removeEventListener('visibilitychange', again);
        };
    }, [teamId, teamKey]);

    // 지금 진행 중인 예배
    useEffect(() => {
        if (!teamId) return;
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/live`, { cache: 'no-store' });
                if (!response.ok) return;
                const body = await response.json() as { session: LiveSessionSummary | null };
                if (active) setLive({ teamId, session: body.session });
            } catch { /* 다음 소식에서 다시 */ }
        };
        void load();
        const unsubscribe = subscribeTeamStream(teamId, (event: TeamStreamEvent) => {
            const payload = event.payload as Record<string, unknown> | null;
            switch (event.type) {
                case 'docs.changed':
                    if (payload?.by === userId) return;
                    if (syncTimer.current) clearTimeout(syncTimer.current);
                    syncTimer.current = setTimeout(() => void syncTeam(teamId), 250);
                    return;
                case 'planning.changed':
                    if (payload?.by !== userId) window.dispatchEvent(new Event(PLANNING_CHANGED_EVENT));
                    return;
                case 'planning.notice': {
                    // 나에게 온 일정 · 요청 알림 (서버가 받는 사람에게만 보냅니다)
                    const notice = payload as unknown as PlanningNotice;
                    const href = planningHref(teamId, notice.target);
                    void notifyDevice({ title: notice.title, body: notice.body, tag: `plan-${notice.id}`, url: href });
                    // 일정 · 요청 화면은 알림 목록과 자기 알림 줄이 있어 겹쳐 띄우지 않습니다.
                    if (!window.location.pathname.startsWith('/dashboard/planning')) {
                        showAppToast({
                            id: `plan-${notice.id}`,
                            tone: notice.urgent ? 'warning' : 'info',
                            title: notice.title,
                            body: notice.body,
                            action: { label: '보기', href },
                            ttl: notice.urgent ? 15_000 : 6_000,
                        });
                    }
                    return;
                }
                case 'team.changed':
                    // 명단 · 역할 · 권한이 바뀌면 서버에서 그린 부분(팀 바꾸기 · 권한)을 새로 받습니다.
                    if (refreshTimer.current) clearTimeout(refreshTimer.current);
                    refreshTimer.current = setTimeout(() => router.refresh(), 300);
                    return;
                case 'live.started': {
                    const session = payload as unknown as LiveSessionSummary;
                    if (active) setLive({ teamId, session });
                    void notifyDevice({ title: '예배가 시작됐어요', body: `${session.startedByName}님 · ${session.title}`, tag: `live-${session.id}`, url: liveHref(session.id) });
                    if (!window.location.pathname.startsWith('/live/')) {
                        showAppToast({
                            id: `live-${session.id}`,
                            tone: 'live',
                            title: '예배가 시작됐어요',
                            body: `${session.startedByName}님 · ${session.title}`,
                            action: { label: '입장', href: liveHref(session.id) },
                            ttl: 15_000,
                        });
                    }
                    return;
                }
                case 'live.ended':
                case 'live.presence':
                case 'live.state':
                    void load();
                    return;
                case 'stream.reset':
                    // 오래 끊겨 있어 놓친 소식을 이어 받지 못함 — 팀 자료 · 일정 · 명단 · 예배를 처음부터 다시 읽습니다.
                    void syncTeam(teamId);
                    window.dispatchEvent(new Event(PLANNING_CHANGED_EVENT));
                    void load();
                    if (refreshTimer.current) clearTimeout(refreshTimer.current);
                    refreshTimer.current = setTimeout(() => router.refresh(), 300);
                    return;
                default:
            }
        }, (status) => { if (active) setStream(status); });
        return () => {
            active = false;
            unsubscribe();
            if (refreshTimer.current) clearTimeout(refreshTimer.current);
            if (syncTimer.current) clearTimeout(syncTimer.current);
        };
    }, [teamId, userId, router]);

    // 다른 팀원이 바꾼 콘티 · 권한 때문에 되돌린 저장을 알립니다.
    useEffect(() => {
        const onNotice = (event: Event) => {
            const notice = (event as CustomEvent<SyncNotice>).detail;
            if (!notice || notice.teamId !== teamId) return;
            showAppToast({
                group: `sync-${notice.kind}`,
                tone: notice.kind === 'received' ? 'info' : 'danger',
                title: notice.message,
                body: notice.detail ?? (notice.kind === 'received' ? '콘티 · 악보 화면에 바로 반영했어요' : undefined),
            });
        };
        window.addEventListener(SYNC_NOTICE_EVENT, onNotice);
        return () => window.removeEventListener(SYNC_NOTICE_EVENT, onNotice);
    }, [teamId]);

    const connection: TeamConnectionValue | null = value
        ? { ...value, live: live?.teamId === value.teamId ? live.session : null, stream }
        : null;
    return <Context.Provider value={connection}>{children}</Context.Provider>;
}
