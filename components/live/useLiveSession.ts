'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { can } from '@/lib/permissions';
import { subscribeTeamStream, type StreamStatus } from '@/lib/teamStream';
import { notifyDevice } from '@/lib/deviceNotify';
import type { LiveCueRecord, LiveMovePatch, LivePresence, LiveSessionDetail, LiveState } from '@/lib/server/liveRepository';
import { worshipRoles } from '@/types/team';
import {
    CUE_TARGET_LABEL,
    QUICK_CUES_ALL,
    QUICK_CUES_SOUND,
    QUICK_CUES_TO_LEADER,
    cueById,
    cueGroupOf,
    type CueDefinition,
    type LiveCueEntry,
    type LiveMember,
    type LiveScreenHandlers,
    type LiveScreenModel,
    type LiveToast,
} from './model';

/*
 * 서버 예배 세션 하나를 화면 모델로 바꿉니다.
 * - 들어오면 입장(join), 15초마다 살아 있음(heartbeat), 화면을 떠나면 퇴장(leave · 창을 닫으면 sendBeacon)
 * - 팀 소식 흐름으로 진행 · 접속 · 큐 · 확인 · 마침을 받고, 끊겼다 붙으면 처음부터 다시 읽어 맞춥니다.
 * - 진행 버튼은 바로 화면에 반영(낙관적)하고 서버 결과로 맞춥니다. 큐는 보낸 뒤 확인한 사람 수를 셉니다.
 */

const HEARTBEAT_MS = 15_000;
const CUE_TTL = 8_000;
const SENT_TTL = 4_000;

type LoadState = { status: 'loading' } | { status: 'error'; message: string; code: number } | { status: 'ready'; detail: LiveSessionDetail };

function deviceIdFor(sessionId: string): string {
    const key = `worship:live-device:${sessionId}`;
    try {
        const stored = sessionStorage.getItem(key);
        if (stored) return stored;
        const id = crypto.randomUUID();
        sessionStorage.setItem(key, id);
        return id;
    } catch {
        return crypto.randomUUID();
    }
}

async function post(sessionId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`/api/live/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: body.op === 'leave',
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw Object.assign(new Error(typeof data.error === 'string' ? data.error : '처리하지 못했어요.'), { status: response.status });
    return data;
}

/** 진행 버튼을 누르자마자 보이는 값 — 서버(liveRepository.move)와 같은 규칙 */
function applyMove(state: LiveState, songs: LiveSessionDetail['session']['snapshot']['songs'], patch: LiveMovePatch): LiveState {
    const next = { ...state };
    if (typeof patch.songIndex === 'number') {
        const songIndex = Math.max(0, Math.min(songs.length - 1, patch.songIndex));
        if (songIndex !== state.songIndex) Object.assign(next, { songIndex, sectionIndex: songs[songIndex].sections.length ? 0 : -1, page: 1, bpm: songs[songIndex].bpm });
    }
    const song = songs[next.songIndex];
    if (typeof patch.sectionIndex === 'number') next.sectionIndex = song.sections.length ? Math.max(0, Math.min(song.sections.length - 1, patch.sectionIndex)) : -1;
    if (typeof patch.page === 'number') next.page = Math.max(1, Math.min(99, patch.page));
    if (patch.bpm !== undefined) next.bpm = patch.bpm;
    return next;
}

type FetchResult = { kind: 'ok'; detail: LiveSessionDetail } | { kind: 'auth' } | { kind: 'error'; message: string; code: number };

async function fetchDetail(sessionId: string): Promise<FetchResult> {
    try {
        const response = await fetch(`/api/live/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const body = await response.json().catch(() => ({})) as LiveSessionDetail & { error?: string };
        if (response.status === 401) return { kind: 'auth' };
        if (!response.ok) return { kind: 'error', message: body.error ?? '예배 세션을 불러오지 못했어요.', code: response.status };
        return { kind: 'ok', detail: body };
    } catch {
        return { kind: 'error', message: '연결을 확인한 뒤 다시 들어와 주세요.', code: 0 };
    }
}

/*
 * 입장 · 퇴장 요청은 기기마다 한 줄로 보냅니다 (동시에 보내면 서버에 거꾸로 도착할 수 있음).
 * 화면을 떠날 때의 퇴장은 잠깐 미뤄서, 바로 다시 그려지는 경우(개발 모드 이중 실행 · 같은 화면 새로 그림) 입장 · 퇴장이 오가지 않게 합니다.
 */
const presenceQueues = new Map<string, Promise<unknown>>();
const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>();
const presentDevices = new Set<string>();

function presence(sessionId: string, device: string, op: 'join' | 'heartbeat' | 'leave', onDenied?: () => void) {
    const key = `${sessionId}:${device}`;
    const send = (operation: string) => {
        const next = (presenceQueues.get(key) ?? Promise.resolve()).then(() => post(sessionId, { op: operation, deviceId: device })).catch((error: Error & { status?: number }) => {
            if (operation === 'join' && (error.status === 403 || error.status === 404)) onDenied?.();
        });
        presenceQueues.set(key, next);
    };
    if (op === 'leave') {
        const timer = setTimeout(() => {
            pendingLeaves.delete(key);
            presentDevices.delete(key);
            send('leave');
        }, 400);
        pendingLeaves.set(key, timer);
        return;
    }
    const pending = pendingLeaves.get(key);
    if (pending) {
        // 막 나가려던 기기가 다시 들어옴 — 퇴장을 취소하고 그대로 머뭅니다.
        clearTimeout(pending);
        pendingLeaves.delete(key);
        if (op === 'join' && presentDevices.has(key)) return;
    }
    if (op === 'join') presentDevices.add(key);
    send(op);
}

let toastSeq = 0;
const toastId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(toastSeq += 1)}`;

export interface LiveSessionResult {
    model: LiveScreenModel | null;
    handlers: LiveScreenHandlers;
    /** 불러오지 못한 이유 (권한 없음 · 없는 세션 …) */
    error: { message: string; code: number } | null;
}

export function useLiveSession(sessionId: string, { exitHref = '/dashboard' }: { exitHref?: string } = {}): LiveSessionResult {
    const router = useRouter();
    const [load, setLoad] = useState<LoadState>({ status: 'loading' });
    const [toasts, setToasts] = useState<LiveToast[]>([]);
    const [stream, setStream] = useState<StreamStatus>('connecting');
    const deviceId = useRef<string>('');
    const left = useRef(false);
    const retries = useRef(new Map<string, () => void>());
    const detailRef = useRef<LiveSessionDetail | null>(null);
    // 소식 · 버튼 처리에서 최신 세션을 읽도록 그린 뒤에 맞춰 둡니다.
    useEffect(() => {
        detailRef.current = load.status === 'ready' ? load.detail : null;
    }, [load]);

    const pushToast = useCallback((toast: Omit<LiveToast, 'id' | 'createdAt'> & { id?: string }) => {
        const full: LiveToast = { ...toast, id: toast.id ?? toastId(toast.kind), createdAt: Date.now() };
        setToasts((current) => [full, ...current.filter((item) => item.id !== full.id && (!full.group || item.group !== full.group))].slice(0, 6));
        return full.id;
    }, []);

    const dismiss = useCallback((id: string) => {
        retries.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const update = useCallback((change: (detail: LiveSessionDetail) => LiveSessionDetail) => {
        setLoad((current) => (current.status === 'ready' ? { status: 'ready', detail: change(current.detail) } : current));
    }, []);

    const apply = useCallback((result: FetchResult) => {
        if (result.kind === 'auth') {
            router.replace(`/login?callbackUrl=${encodeURIComponent(`/live/${sessionId}`)}`);
            return;
        }
        if (result.kind === 'ok') setLoad({ status: 'ready', detail: result.detail });
        // 이미 보고 있던 세션은 잠깐의 연결 문제로 지우지 않습니다.
        else setLoad((current) => (current.status === 'ready' && result.code === 0 ? current : { status: 'error', message: result.message, code: result.code }));
    }, [router, sessionId]);

    const refetch = useCallback(() => fetchDetail(sessionId).then(apply), [sessionId, apply]);

    useEffect(() => {
        deviceId.current = deviceIdFor(sessionId);
        let active = true;
        void fetchDetail(sessionId).then((result) => { if (active) apply(result); });
        return () => { active = false; };
    }, [sessionId, apply]);

    const ready = load.status === 'ready';
    const teamId = ready ? load.detail.session.teamId : null;
    const ended = ready ? Boolean(load.detail.session.endedAt) : false;
    const myId = ready ? load.detail.me.userId : null;

    // 입장 · 살아 있음 · 퇴장
    useEffect(() => {
        if (!ready || ended) return;
        left.current = false;
        const device = deviceId.current;
        presence(sessionId, device, 'join', () => void refetch());
        const beat = () => {
            if (!left.current) presence(sessionId, device, 'heartbeat');
        };
        const timer = setInterval(beat, HEARTBEAT_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
        // 창을 닫거나 다른 주소로 떠나면 바로 퇴장 (응답을 기다리지 않는 sendBeacon)
        const onHide = () => {
            if (left.current) return;
            try { navigator.sendBeacon(`/api/live/${encodeURIComponent(sessionId)}`, new Blob([JSON.stringify({ op: 'leave', deviceId: device })], { type: 'text/plain' })); } catch { /* 45초 뒤 서버가 정리 */ }
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('pagehide', onHide);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('pagehide', onHide);
            // 앱 안에서 다른 화면으로 옮기면(뒤로 가기 포함) 퇴장 — 곧바로 다시 그려지는 경우(개발 모드 · 새로 그림)는 취소됩니다.
            if (!left.current) presence(sessionId, device, 'leave');
        };
    }, [ready, ended, sessionId, refetch]);

    // 실시간 소식
    useEffect(() => {
        if (!teamId || !myId) return;
        let wasOffline = false;
        const unsubscribe = subscribeTeamStream(teamId, (event) => {
            const payload = event.payload as Record<string, unknown> | null;
            if (event.type === 'team.changed' || event.type === 'stream.reset') { void refetch(); return; }
            if (!payload || payload.sessionId !== sessionId) return;
            switch (event.type) {
                case 'live.state': {
                    const state = payload.state as LiveState;
                    update((detail) => (state.version >= detail.state.version ? { ...detail, state } : detail));
                    return;
                }
                case 'live.presence': {
                    const presence = payload.presence as LivePresence[];
                    const before = new Set(detailRef.current?.presence.map((item) => item.userId) ?? []);
                    const after = new Set(presence.map((item) => item.userId));
                    const joined = presence.filter((item) => !before.has(item.userId) && item.userId !== myId);
                    const gone = (detailRef.current?.presence ?? []).filter((item) => !after.has(item.userId) && item.userId !== myId);
                    if (joined.length) pushToast({ kind: 'team', tone: 'info', urgency: 'low', group: 'presence', title: `${joined.map((item) => item.name).join(', ')}님이 들어왔어요`, ttl: 2500 });
                    else if (gone.length) pushToast({ kind: 'team', tone: 'info', urgency: 'low', group: 'presence', title: `${gone.map((item) => item.name).join(', ')}님이 나갔어요`, ttl: 2500 });
                    update((detail) => ({ ...detail, presence }));
                    return;
                }
                case 'live.cue': {
                    const cue = payload.cue as LiveCueRecord;
                    update((detail) => (detail.cues.some((item) => item.id === cue.id) ? detail : { ...detail, cues: [cue, ...detail.cues].slice(0, 40) }));
                    if (cue.fromUserId !== myId && cue.recipients.includes(myId)) {
                        pushToast({
                            id: `cue-${cue.id}`,
                            cueEntryId: cue.id,
                            kind: cue.target === 'all' ? 'cue-all' : 'cue-role',
                            tone: 'cue',
                            urgency: cue.target === 'all' ? 'high' : 'normal',
                            title: cue.label,
                            from: cue.fromName,
                            target: CUE_TARGET_LABEL[cue.target],
                            ackable: true,
                            ttl: CUE_TTL,
                        });
                        try { navigator.vibrate?.([18, 24, 32]); } catch { /* 진동 없는 기기 */ }
                        void notifyDevice({ title: cue.label, body: `${cue.fromName} → ${CUE_TARGET_LABEL[cue.target]}`, tag: `cue-${cue.id}`, url: `/live/${sessionId}` });
                    }
                    return;
                }
                case 'live.ack': {
                    const { cueId, userId, name, at } = payload as { cueId: string; userId: string; name: string; at: string };
                    const known = detailRef.current?.cues.find((cue) => cue.id === cueId);
                    const fresh = known && !known.acks.some((ack) => ack.userId === userId);
                    update((detail) => ({
                        ...detail,
                        cues: detail.cues.map((cue) => (cue.id !== cueId || cue.acks.some((ack) => ack.userId === userId) ? cue : { ...cue, acks: [...cue.acks, { userId, name, at }] })),
                    }));
                    if (known && fresh && known.fromUserId === myId) {
                        const progress = { done: known.acks.length + 1, total: known.recipients.length };
                        setToasts((current) => current.map((toast) => (toast.id === `sent-${cueId}` ? { ...toast, progress, body: `${name}님이 확인했어요` } : toast)));
                    }
                    return;
                }
                case 'live.ended':
                    update((detail) => ({ ...detail, session: { ...detail.session, endedAt: String(payload.endedAt ?? new Date().toISOString()), endedByName: (payload.endedByName as string | null) ?? null } }));
                    return;
                default:
            }
        }, (status) => {
            setStream(status);
            if (status === 'offline' && !wasOffline) {
                wasOffline = true;
                pushToast({ id: 'connection', kind: 'offline', tone: 'warning', urgency: 'normal', group: 'connection', title: '연결이 끊겼어요', body: '다시 연결하는 중 · 화면은 계속 볼 수 있어요', ttl: null });
            }
            if (status === 'online' && wasOffline) {
                wasOffline = false;
                pushToast({ id: 'connection', kind: 'online', tone: 'success', urgency: 'low', group: 'connection', title: '다시 연결됐어요', body: '놓친 진행 · 큐를 맞췄어요', ttl: 3000 });
                void refetch();
                presence(sessionId, deviceId.current, 'heartbeat');
            }
        });
        return unsubscribe;
    }, [teamId, myId, sessionId, update, pushToast, refetch]);

    const detail = load.status === 'ready' ? load.detail : null;

    /* ───── 동작 ───── */

    const move = useCallback((patch: LiveMovePatch) => {
        const current = detailRef.current;
        if (!current || current.session.endedAt) return;
        const optimistic = applyMove(current.state, current.session.snapshot.songs, patch);
        update((value) => ({ ...value, state: { ...optimistic, version: value.state.version } }));
        void post(sessionId, { op: 'move', patch }).then((body) => {
            const state = body.state as LiveState;
            update((value) => (state.version >= value.state.version ? { ...value, state } : value));
        }).catch((error: Error) => {
            pushToast({ kind: 'error', tone: 'danger', urgency: 'normal', group: 'move', title: '넘기지 못했어요', body: error.message, ttl: 4000 });
            void refetch();
        });
    }, [sessionId, update, pushToast, refetch]);

    const sendCue = useCallback(async (cue: CueDefinition): Promise<boolean> => {
        const entryId = crypto.randomUUID();
        const attempt = async (): Promise<boolean> => {
            try {
                const body = await post(sessionId, { op: 'cue', entryId, cueId: cue.id });
                const record = body.cue as LiveCueRecord;
                update((value) => (value.cues.some((item) => item.id === record.id) ? value : { ...value, cues: [record, ...value.cues].slice(0, 40) }));
                pushToast({
                    id: `sent-${record.id}`,
                    cueEntryId: record.id,
                    kind: 'cue-sent',
                    tone: 'success',
                    urgency: 'low',
                    title: `보냄 · ${record.label}`,
                    body: record.recipients.length ? `${CUE_TARGET_LABEL[record.target]}에게 보냈어요` : `지금 들어와 있는 ${CUE_TARGET_LABEL[record.target]}이 없어요`,
                    target: CUE_TARGET_LABEL[record.target],
                    progress: record.recipients.length ? { done: 0, total: record.recipients.length } : undefined,
                    ttl: SENT_TTL,
                });
                return true;
            } catch (error) {
                const id = pushToast({ kind: 'error', tone: 'danger', urgency: 'normal', group: `cue-error-${cue.id}`, title: `${cue.label} 큐를 보내지 못했어요`, body: error instanceof Error ? error.message : undefined, action: '다시 시도', ttl: null });
                retries.current.set(id, () => { void attempt(); });
                return false;
            }
        };
        return attempt();
    }, [sessionId, update, pushToast]);

    const handlers = useMemo<LiveScreenHandlers>(() => {
        const state = () => detailRef.current?.state;
        const songs = () => detailRef.current?.session.snapshot.songs ?? [];
        return {
            goSong: (index) => move({ songIndex: index }),
            goSection: (index) => move({ sectionIndex: index }),
            next: () => {
                const current = state();
                if (!current) return;
                const song = songs()[current.songIndex];
                if (song && current.sectionIndex >= 0 && current.sectionIndex < song.sections.length - 1) move({ sectionIndex: current.sectionIndex + 1 });
                else if (current.songIndex < songs().length - 1) move({ songIndex: current.songIndex + 1 });
            },
            prev: () => {
                const current = state();
                if (!current) return;
                if (current.sectionIndex > 0) move({ sectionIndex: current.sectionIndex - 1 });
                else if (current.songIndex > 0) {
                    // 앞 곡의 마지막 섹션으로 — 곡과 섹션을 한 번에 보냅니다 (서버는 곡을 먼저 바꾸고 섹션을 정합니다).
                    const previous = songs()[current.songIndex - 1];
                    move({ songIndex: current.songIndex - 1, sectionIndex: Math.max(0, previous.sections.length - 1) });
                }
            },
            setPage: (page) => move({ page }),
            setBpm: (bpm) => move({ bpm }),
            sendCue,
            ack: (id) => {
                setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, acked: true, ttl: 1200, createdAt: Date.now() } : toast)));
                const toast = toasts.find((item) => item.id === id);
                const entryId = toast?.cueEntryId ?? (id.startsWith('cue-') ? id.slice(4) : null);
                if (entryId) void post(sessionId, { op: 'ack', entryId }).catch(() => {});
            },
            dismiss,
            action: (id) => {
                const retry = retries.current.get(id);
                dismiss(id);
                retry?.();
            },
            leave: () => {
                left.current = true;
                presentDevices.delete(`${sessionId}:${deviceId.current}`);
                void post(sessionId, { op: 'leave', deviceId: deviceId.current }).catch(() => {}).finally(() => router.push(exitHref));
            },
            end: () => {
                void post(sessionId, { op: 'end' }).then(() => {
                    update((value) => ({ ...value, session: { ...value.session, endedAt: new Date().toISOString(), endedByName: value.me.name } }));
                }).catch((error: Error) => {
                    pushToast({ kind: 'error', tone: 'danger', urgency: 'normal', title: '예배를 마치지 못했어요', body: error.message, ttl: 4000 });
                });
            },
        };
    }, [move, sendCue, dismiss, toasts, sessionId, router, exitHref, update, pushToast]);

    const model = useMemo<LiveScreenModel | null>(() => {
        if (!detail) return null;
        const { session, state, presence, cues, members, policy, me } = detail;
        const online = new Set(presence.map((item) => item.userId));
        const controller = (member: typeof me) => can(member, policy, 'sessionRun');
        const liveMembers: LiveMember[] = members
            .filter((member) => !member.userId.startsWith('direct-'))
            .map((member) => ({
                userId: member.userId,
                name: member.name,
                role: member.role,
                roleLabel: worshipRoles[member.role] ?? '미정',
                group: cueGroupOf(member.role),
                online: online.has(member.userId),
                me: member.userId === me.userId,
                controller: controller(member),
            }))
            .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.controller) - Number(a.controller) || a.name.localeCompare(b.name, 'ko'));
        const canCueAll = can(me, policy, 'cueAll');
        const quickIds = canCueAll ? QUICK_CUES_ALL : cueGroupOf(me.role) === 'sound' ? QUICK_CUES_TO_LEADER : QUICK_CUES_SOUND;
        const entries: LiveCueEntry[] = cues.map((cue) => ({
            id: cue.id,
            cueId: cue.cueId,
            label: cue.label,
            target: cue.target,
            targetLabel: CUE_TARGET_LABEL[cue.target],
            fromUserId: cue.fromUserId,
            fromName: cue.fromName,
            fromMe: cue.fromUserId === me.userId,
            forMe: cue.recipients.includes(me.userId),
            createdAt: cue.createdAt,
            recipients: cue.recipients.length,
            acks: cue.acks.map((ack) => ({ userId: ack.userId, name: ack.name })),
            ackedByMe: cue.acks.some((ack) => ack.userId === me.userId),
        }));
        const controllers = liveMembers.filter((member) => member.controller && !member.me);
        return {
            sessionId: session.id,
            teamId: session.teamId,
            teamName: session.teamName,
            title: session.snapshot.title,
            dateLabel: session.snapshot.dateLabel,
            theme: session.snapshot.theme,
            startedAt: session.startedAt,
            songs: session.snapshot.songs,
            songIndex: state.songIndex,
            sectionIndex: state.sectionIndex,
            page: state.page,
            bpm: state.bpm,
            ended: Boolean(session.endedAt),
            endedByName: session.endedByName,
            canControl: controller(me),
            controllerNames: [...controllers.filter((member) => member.online), ...controllers.filter((member) => !member.online)].map((member) => member.name),
            lastMovedBy: state.movedByName,
            members: liveMembers,
            cues: entries,
            toasts,
            quickCues: quickIds.map((id) => cueById(id)!),
            canCueAll,
            connection: stream === 'online' ? 'online' : stream === 'connecting' ? 'connecting' : 'offline',
            me: { userId: me.userId, name: me.name, role: me.role, group: cueGroupOf(me.role) },
            exitHref,
            contiHref: session.snapshot.setlistId ? `/dashboard/songs?tab=order&setlist=${encodeURIComponent(session.snapshot.setlistId)}` : '/dashboard/songs',
        };
    }, [detail, toasts, stream, exitHref]);

    return { model, handlers, error: load.status === 'error' ? { message: load.message, code: load.code } : null };
}
