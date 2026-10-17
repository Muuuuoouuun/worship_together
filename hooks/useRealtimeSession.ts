import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isPrototypeSessionId } from '@/lib/constants';
import { createClientId } from '@/lib/clientId';
import { appendSessionFeedback } from '@/actions/sessionActions';
import { useSessionStore } from '@/store/sessionStore';
import {
    isCueForParticipant, isSessionFeedbackRole, normalizeCueRecipient, normalizeSessionState,
    sessionFeedbackRowToEntry,
    type SessionCueDelivery, type SessionCurrentState, type SessionFeedbackEntry,
    type SessionFeedbackRow, type SessionParticipant, type SessionRow,
} from '@/types/session';
import type { Json } from '@/types/schema';

interface UseRealtimeSessionOptions {
    sessionId: string | null;
    teamId: string | null;
    clientId?: string;
}

export type RealtimeConnectionStatus = 'idle' | 'connected' | 'reconnecting' | 'offline' | 'error';
type Packet = { sessionId: string; teamId: string; sender: string; event: string; payload: unknown };
type TransportResult = Pick<SessionCueDelivery, 'status' | 'transport' | 'error'>;

export const useRealtimeSession = ({ sessionId, teamId, clientId: suppliedClientId }: UseRealtimeSessionOptions) => {
    const [generatedClientId] = useState(createClientId);
    const clientId = suppliedClientId ?? generatedClientId;
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('idle');
    const [localTransportAvailable, setLocalTransportAvailable] = useState(false);
    const [participants, setParticipants] = useState<SessionParticipant[]>([]);
    const [lastRealtimeAt, setLastRealtimeAt] = useState<string | null>(null);
    const [lastSubscribedAt, setLastSubscribedAt] = useState<string | null>(null);
    const [lastErrorAt, setLastErrorAt] = useState<string | null>(null);
    const sendRef = useRef<((event: string, payload: unknown) => Promise<TransportResult>) | null>(null);
    const pendingEntriesRef = useRef(new Map<string, SessionFeedbackEntry>());
    /** Who is listed (device + role, in order) — presence packets and the heartbeat only re-render when this changes. */
    const participantsKeyRef = useRef('');

    useEffect(() => {
        if (!sessionId || !teamId) return;
        let disposed = false;
        let connected = false;
        let applyingRemote = false;
        let local: BroadcastChannel | null = null;
        let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
        let lastStateAt = 0;
        const peers = new Map<string, SessionParticipant>();
        const seenCues = new Set<string>();
        const nowIso = () => new Date().toISOString();
        const scopedStore = () => {
            const state = useSessionStore.getState();
            return state.currentSession?.id === sessionId && state.currentSession.team_id === teamId ? state : null;
        };
        const send = async (event: string, payload: unknown): Promise<TransportResult> => {
            if (disposed) return { status: 'failed', transport: null, error: '세션 연결이 종료되었습니다.' };
            const packet: Packet = { sessionId, teamId, sender: clientId, event, payload };
            let localSent = false;
            try { if (local) { local.postMessage(packet); localSent = true; } } catch { /* Remote may still work. */ }
            if (channel && connected && navigator.onLine) {
                try {
                    const result = await channel.send({ type: 'broadcast', event: 'session-live', payload: packet });
                    if (result === 'ok') return { status: 'sent', transport: 'remote' };
                } catch { /* A local post never implies remote delivery. */ }
                if (!disposed) setLastErrorAt(nowIso());
            }
            return localSent
                ? { status: 'sent', transport: 'local' }
                : { status: 'failed', transport: null, error: '연결 없음 · 전송하지 못했습니다.' };
        };
        sendRef.current = send;

        const receiveCue = (entry: SessionFeedbackEntry, transport: 'local' | 'remote') => {
            const state = scopedStore();
            if (!state?.isActive || entry.clientId === clientId || !isCueForParticipant(entry, clientId, state.selectedFeedbackRole)) return;
            if (!seenCues.has(entry.id)) {
                seenCues.add(entry.id);
                if (seenCues.size > 200) seenCues.delete(seenCues.values().next().value!);
                state.mergeFeedbackEntry({ ...entry, receivedAt: nowIso() });
                setLastRealtimeAt(nowIso());
            }
            // Device receipt only: this is not proof the user read the cue.
            if (entry.clientId) void send('ack', { id: entry.id, to: entry.clientId, role: state.selectedFeedbackRole, transport });
        };
        const publishState = () => {
            const state = scopedStore();
            if (!state?.isMaster || !state.isActive || !local) return;
            const at = Math.max(Date.now(), lastStateAt + 1);
            lastStateAt = at;
            local.postMessage({ sessionId, teamId, sender: clientId, event: 'state', payload: {
                at, state: snapshotState(state),
            } } satisfies Packet);
        };
        const announce = () => void send('presence', { role: useSessionStore.getState().selectedFeedbackRole });
        // lastSeenAt only drives the expiry below, so a peer that is merely still here keeps the same list.
        const publishPeers = () => {
            const next = [...peers.values()];
            const key = next.map((peer) => `${peer.clientId}:${peer.role}`).join('|');
            if (key === participantsKeyRef.current) return;
            participantsKeyRef.current = key;
            setParticipants(next);
        };
        const receive = (value: unknown, transport: 'local' | 'remote') => {
            if (disposed || !isRecord(value) || value.sessionId !== sessionId || value.teamId !== teamId ||
                typeof value.sender !== 'string' || value.sender === clientId || !isRecord(value.payload)) return;
            const payload = value.payload;
            if (value.event === 'cue') {
                const entry = normalizeFeedbackEntry(payload.entry, teamId);
                if (entry && entry.clientId === value.sender) receiveCue(entry, transport);
            } else if (value.event === 'ack' && payload.to === clientId && typeof payload.id === 'string') {
                const entry = pendingEntriesRef.current.get(payload.id);
                if (entry && typeof payload.role === 'string' && isSessionFeedbackRole(payload.role) &&
                    isCueForParticipant(entry, value.sender, payload.role)) {
                    scopedStore()?.acknowledgeCue(payload.id, value.sender);
                }
            } else if (value.event === 'presence' && typeof payload.role === 'string' && isSessionFeedbackRole(payload.role)) {
                peers.set(value.sender, { clientId: value.sender, role: payload.role, lastSeenAt: Date.now() });
                publishPeers();
            } else if (value.event === 'hello') {
                announce();
                if (transport === 'local') publishState();
            } else if (value.event === 'state' && transport === 'local' && typeof payload.at === 'number' &&
                Number.isFinite(payload.at) && payload.at > lastStateAt && isRecord(payload.state)) {
                const state = scopedStore();
                if (!state || state.isMaster || !state.syncEnabled || !state.isActive) return;
                lastStateAt = payload.at;
                applyingRemote = true;
                state.applyRemoteState(normalizeSessionState(payload.state as Json, state.songs));
                applyingRemote = false;
                setLastRealtimeAt(nowIso());
            }
        };
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                local = new BroadcastChannel(`worship-together:v1:${teamId}:${sessionId}`);
                local.onmessage = (event: MessageEvent<unknown>) => receive(event.data, 'local');
            }
        } catch { local = null; }
        queueMicrotask(() => {
            if (disposed) return;
            setLocalTransportAvailable(Boolean(local));
            participantsKeyRef.current = '';
            setParticipants((current) => (current.length === 0 ? current : []));
            setRealtimeStatus(navigator.onLine ? 'idle' : 'offline');
            setLastRealtimeAt(null);
            setLastSubscribedAt(null);
            setLastErrorAt(null);
            announce();
            void send('hello', {});
        });

        if (supabase && !isPrototypeSessionId(sessionId)) {
            channel = supabase.channel(`team:${teamId}:session:${sessionId}`, {
                config: { broadcast: { ack: true, self: false } },
            })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (message) => {
                    const row = message.new as SessionRow;
                    if (!disposed && row.id === sessionId && row.team_id === teamId) {
                        scopedStore()?.setSessionMeta(row);
                        setLastRealtimeAt(nowIso());
                    }
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_feedback', filter: `session_id=eq.${sessionId}` }, (message) => {
                    const row = message.new as SessionFeedbackRow;
                    if (!disposed && row.session_id === sessionId && row.team_id === teamId) receiveCue(sessionFeedbackRowToEntry(row), 'remote');
                })
                .on('broadcast', { event: 'session-live' }, (message) => receive(message.payload, 'remote'))
                .on('broadcast', { event: 'session-feedback' }, (message) => {
                    const payload: unknown = message.payload;
                    if (!disposed && isRecord(payload) && payload.sessionId === sessionId && payload.teamId === teamId) {
                        const entry = normalizeFeedbackEntry(payload.entry, teamId);
                        if (entry) receiveCue(entry, 'remote');
                    }
                })
                .subscribe((status) => {
                    if (disposed) return;
                    connected = status === 'SUBSCRIBED';
                    if (connected) {
                        setRealtimeStatus('connected');
                        setLastSubscribedAt(nowIso());
                        announce();
                        void send('hello', {});
                    } else {
                        setRealtimeStatus(status === 'CLOSED' || !navigator.onLine ? 'offline' : 'reconnecting');
                        setLastErrorAt(nowIso());
                    }
                });
        }
        const unsubscribe = useSessionStore.subscribe((state, previous) => {
            if (state.selectedFeedbackRole !== previous.selectedFeedbackRole) announce();
            if (!applyingRemote && state.isMaster && state.currentSession?.id === sessionId &&
                (state.isMaster !== previous.isMaster || JSON.stringify(snapshotState(state)) !== JSON.stringify(snapshotState(previous)))) {
                try { publishState(); } catch { setLastErrorAt(nowIso()); }
            }
            if (!previous.syncEnabled && state.syncEnabled) void send('hello', {});
        });
        const heartbeat = window.setInterval(() => {
            for (const [id, peer] of peers) if (Date.now() - peer.lastSeenAt > 35000) peers.delete(id);
            publishPeers();
            announce();
        }, 10000);
        const handleOffline = () => setRealtimeStatus('offline');
        const handleOnline = () => { setRealtimeStatus(connected ? 'connected' : 'reconnecting'); void send('hello', {}); };
        const handleVisibility = () => { if (!document.hidden) { announce(); void send('hello', {}); } };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibility);
        const pendingEntries = pendingEntriesRef.current;
        return () => {
            disposed = true;
            sendRef.current = null;
            pendingEntries.clear();
            unsubscribe();
            clearInterval(heartbeat);
            local?.close();
            if (channel && supabase) void supabase.removeChannel(channel);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [clientId, sessionId, teamId]);

    const broadcastFeedback = useCallback(async (entry: SessionFeedbackEntry): Promise<SessionCueDelivery> => {
        const store = useSessionStore.getState();
        const recipient = normalizeCueRecipient(entry.recipient);
        const outgoing = teamId && recipient ? normalizeFeedbackEntry({ ...entry, clientId, teamId, recipient }, teamId) : null;
        if (!sessionId || !teamId || !sendRef.current || !store.isActive || store.currentSession?.id !== sessionId || !outgoing) {
            const failure: SessionCueDelivery = { status: 'failed', transport: null, receivedBy: [], saved: false, error: '세션 또는 수신 대상을 확인해주세요.' };
            store.setCueDelivery(entry.id, failure);
            return failure;
        }
        pendingEntriesRef.current.set(entry.id, outgoing);
        if (pendingEntriesRef.current.size > 50) pendingEntriesRef.current.delete(pendingEntriesRef.current.keys().next().value!);
        store.mergeFeedbackEntry(outgoing);
        store.setCueDelivery(entry.id, { status: 'sending', transport: null, error: undefined });
        const result = await sendRef.current('cue', { entry: outgoing });
        if (useSessionStore.getState().currentSession?.id !== sessionId) return { ...result, receivedBy: [], saved: false };
        store.setCueDelivery(entry.id, result);
        return useSessionStore.getState().cueDeliveries[entry.id];
    }, [clientId, sessionId, teamId]);

    const sendFeedback = useCallback(async (entry: SessionFeedbackEntry): Promise<SessionCueDelivery> => {
        const delivery = await broadcastFeedback(entry);
        // The existing DB schema cannot retain routing. Never persist a targeted cue as an everyone cue.
        if (delivery.transport === 'remote' && sessionId && teamId && normalizeCueRecipient(entry.recipient)?.kind === 'everyone') {
            // Saving history must not lock the live cue buttons during a slow DB request.
            void appendSessionFeedback(sessionId, teamId, { ...entry, clientId }).then(() => {
                if (useSessionStore.getState().currentSession?.id === sessionId) useSessionStore.getState().setCueDelivery(entry.id, { saved: true });
            }).catch(() => {
                if (useSessionStore.getState().currentSession?.id === sessionId) useSessionStore.getState().setCueDelivery(entry.id, { saved: false, error: '실시간 전송 후 기록 저장 실패' });
            });
        }
        return useSessionStore.getState().cueDeliveries[entry.id] ?? delivery;
    }, [broadcastFeedback, clientId, sessionId, teamId]);

    return { broadcastFeedback, sendFeedback, clientId, participants, localTransportAvailable,
        lastErrorAt, lastRealtimeAt, lastSubscribedAt, realtimeStatus };
};

function snapshotState(state: ReturnType<typeof useSessionStore.getState>): SessionCurrentState {
    return { songId: state.currentSongId, page: state.currentPage, section: state.currentSection,
        bpmEnabled: state.bpmEnabled, bpmValue: state.currentBpm, autoBpmSync: state.autoBpmSync,
        feedbackLog: [], quickFeedbackPresets: state.quickFeedbackPresets };
}

function normalizeFeedbackEntry(value: unknown, teamId: string): SessionFeedbackEntry | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.clientId !== 'string' ||
        typeof value.message !== 'string' || !value.message.trim() || value.message.length > 220 ||
        typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
        typeof value.page !== 'number' || !Number.isInteger(value.page) || value.page < 1 ||
        typeof value.role !== 'string' || !isSessionFeedbackRole(value.role)) return null;
    const recipient = normalizeCueRecipient(value.recipient);
    if (!recipient) return null;
    return { id: value.id, clientId: value.clientId, role: value.role, message: value.message,
        createdAt: value.createdAt, page: value.page, teamId, recipient,
        songId: typeof value.songId === 'string' ? value.songId : null,
        songTitle: typeof value.songTitle === 'string' ? value.songTitle : null,
        section: typeof value.section === 'string' ? value.section : null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
