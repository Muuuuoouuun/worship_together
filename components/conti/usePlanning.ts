'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPlanningContext, updateTeamPlanning } from '@/actions/planningActions';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '@/lib/planning';
import { PLANNING_CHANGED_EVENT, planningStorageKey } from '@/lib/planningDemo';
import { emptyPlanningState, type PlanningCommand, type PlanningState } from '@/types/planning';
import type { TeamMember } from '@/types/team';

/**
 * 일정·요청 화면(PlanningWorkspace)과 같은 곳에서 같은 규칙으로 읽고 씁니다.
 * - local: 이 브라우저의 worship-planning:v1:<팀> 저장소
 * - online: 로그인한 온라인 팀의 서버 저장소
 */
export type PlanningSource =
    | { kind: 'none' }
    | { kind: 'local'; teamId: string; members: TeamMember[]; userId: string }
    | { kind: 'online'; teamId: string; userId: string };

export interface PlanningConnection {
    state: PlanningState;
    members: TeamMember[];
    ready: boolean;
    busy: boolean;
    error: string;
    dispatch: (command: PlanningCommand) => Promise<boolean>;
    refresh: () => Promise<void>;
}

const ONLINE_POLL_MS = 15000;

function readLocal(key: string): PlanningState {
    return parsePlanningState(JSON.parse(localStorage.getItem(key) ?? 'null'));
}

export function sourceKey(source: PlanningSource): string {
    if (source.kind === 'none') return 'none';
    if (source.kind === 'online') return `online:${source.teamId}:${source.userId}`;
    return `local:${source.teamId}:${source.userId}:${source.members.map((member) => `${member.userId}/${member.role}/${member.permission}`).join(',')}`;
}

export function usePlanning(source: PlanningSource): PlanningConnection {
    const key = sourceKey(source);
    const [state, setState] = useState<PlanningState>(emptyPlanningState);
    const [members, setMembers] = useState<TeamMember[]>(source.kind === 'local' ? source.members : []);
    const [ready, setReady] = useState(source.kind === 'none');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const sourceRef = useRef(source);
    sourceRef.current = source;
    /** 소스(팀·보는 사람)가 바뀔 때마다 올라갑니다. 이전 소스의 응답은 버립니다. */
    const epoch = useRef(0);
    /** 저장이 시작될 때 올라갑니다. 그 전에 시작한 읽기 응답은 (저장 결과를 덮지 않도록) 버립니다. */
    const revision = useRef(0);
    /** 지금 읽는 중인 소스 / 저장 중인 소스 */
    const loading = useRef<number | null>(null);
    const saving = useRef<number | null>(null);

    const refresh = useCallback(async () => {
        const current = sourceRef.current;
        if (current.kind === 'none') return;
        const myEpoch = epoch.current;
        const myRevision = revision.current;
        // 같은 소스를 이미 읽고 있거나 저장 중이면 그 결과를 기다립니다. (다른 소스의 요청은 막지 않습니다.)
        if (loading.current === myEpoch || saving.current === myEpoch) return;
        loading.current = myEpoch;
        const fresh = () => epoch.current === myEpoch && revision.current === myRevision;
        try {
            if (current.kind === 'online') {
                const result = await loadPlanningContext(current.teamId);
                if (!fresh()) return;
                if (!result.ok) throw new Error(result.error);
                setMembers(result.value.members);
                setState(result.value.state);
            } else {
                const full = readLocal(planningStorageKey(current.teamId));
                if (!fresh()) return;
                setMembers(current.members);
                setState(planningForViewer(full, current.members, current.userId));
            }
            setError('');
            setReady(true);
        } catch (cause) {
            if (fresh()) {
                setError(cause instanceof Error ? cause.message : '팀 일정을 불러오지 못했어요.');
                setReady(true);
            }
        } finally {
            if (loading.current === myEpoch) loading.current = null;
        }
    }, []);

    useEffect(() => {
        epoch.current += 1;
        setReady(source.kind === 'none');
        setError('');
        if (source.kind === 'none') {
            setState(emptyPlanningState());
            setMembers([]);
            return;
        }
        void refresh();
        const visible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        const storage = (event: StorageEvent) => {
            if (source.kind === 'local' && (event.key === planningStorageKey(source.teamId) || event.key === null)) void refresh();
        };
        const timer = source.kind === 'online' ? setInterval(visible, ONLINE_POLL_MS) : undefined;
        window.addEventListener('focus', visible);
        document.addEventListener('visibilitychange', visible);
        window.addEventListener('storage', storage);
        window.addEventListener(PLANNING_CHANGED_EVENT, visible);
        return () => {
            if (timer) clearInterval(timer);
            window.removeEventListener('focus', visible);
            document.removeEventListener('visibilitychange', visible);
            window.removeEventListener('storage', storage);
            window.removeEventListener(PLANNING_CHANGED_EVENT, visible);
        };
        // key 가 바뀌면 소스가 바뀐 것이므로 다시 읽습니다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, refresh]);

    const dispatch = useCallback(async (command: PlanningCommand): Promise<boolean> => {
        const current = sourceRef.current;
        if (current.kind === 'none' || saving.current !== null) return false;
        const myEpoch = epoch.current;
        saving.current = myEpoch;
        revision.current += 1;
        setBusy(true);
        setError('');
        try {
            if (current.kind === 'online') {
                const result = await updateTeamPlanning(current.teamId, command);
                if (!result.ok) throw new Error(result.error);
                // 저장하는 사이에 다른 팀으로 바꿨다면 그 팀의 화면에 이전 팀 결과를 보여주지 않습니다.
                if (epoch.current === myEpoch) setState(result.value);
            } else {
                const storageKey = planningStorageKey(current.teamId);
                const full = applyPlanningCommand(readLocal(storageKey), current.members, current.userId, command);
                localStorage.setItem(storageKey, JSON.stringify(full));
                setState(planningForViewer(full, current.members, current.userId));
            }
            window.dispatchEvent(new Event(PLANNING_CHANGED_EVENT));
            return true;
        } catch (cause) {
            if (epoch.current === myEpoch) setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해주세요.');
            return false;
        } finally {
            saving.current = null;
            setBusy(false);
        }
    }, []);

    return useMemo(() => ({ state, members, ready, busy, error, dispatch, refresh }), [state, members, ready, busy, error, dispatch, refresh]);
}

/** 시안 페이지용: 저장소 없이 메모리에서만 같은 규칙으로 동작합니다. */
export function useMemoryPlanning(initial: PlanningState, members: TeamMember[], userId: string): PlanningConnection {
    const [full, setFull] = useState(initial);
    const [error, setError] = useState('');
    // 규칙 위반은 setState 안이 아니라 밖에서 던져야 여기서 잡아 화면에 보여줄 수 있습니다.
    const fullRef = useRef(full);
    const dispatch = useCallback(async (command: PlanningCommand): Promise<boolean> => {
        try {
            const next = applyPlanningCommand(fullRef.current, members, userId, command);
            fullRef.current = next;
            setFull(next);
            setError('');
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '저장하지 못했어요.');
            return false;
        }
    }, [members, userId]);
    const refresh = useCallback(async () => {}, []);
    return useMemo(
        () => ({ state: planningForViewer(full, members, userId), members, ready: true, busy: false, error, dispatch, refresh }),
        [full, members, userId, error, dispatch, refresh],
    );
}
