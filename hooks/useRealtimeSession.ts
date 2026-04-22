import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/store/sessionStore';
import {
    isSessionFeedbackRole,
    sessionFeedbackRowToEntry,
    type SessionFeedbackBroadcastPayload,
    type SessionFeedbackEntry,
    type SessionFeedbackRow,
    type SessionRow,
} from '@/types/session';

interface UseRealtimeSessionOptions {
    sessionId: string | null;
    teamId: string | null;
}

export const useRealtimeSession = ({ sessionId, teamId }: UseRealtimeSessionOptions) => {
    const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
    const setSessionMeta = useSessionStore((state) => state.setSessionMeta);
    const mergeFeedbackEntry = useSessionStore((state) => state.mergeFeedbackEntry);

    const handleSessionUpdate = useEffectEvent((newSession: SessionRow) => {
        if (!teamId || newSession.team_id !== teamId) {
            return;
        }

        setSessionMeta(newSession);
    });

    const handleFeedbackBroadcast = useEffectEvent((payload: unknown) => {
        const broadcastPayload = normalizeFeedbackBroadcastPayload(payload, sessionId, teamId);

        if (!broadcastPayload) {
            return;
        }

        mergeFeedbackEntry(broadcastPayload.entry);
    });

    const handleFeedbackInsert = useEffectEvent((row: SessionFeedbackRow) => {
        if (!teamId || row.team_id !== teamId) {
            return;
        }

        mergeFeedbackEntry(sessionFeedbackRowToEntry(row));
    });

    useEffect(() => {
        if (!supabase || !sessionId || !teamId) {
            return;
        }

        const client = supabase;
        const channel = client
            .channel(`team:${teamId}:session:${sessionId}`, {
                config: {
                    broadcast: {
                        ack: false,
                        self: false,
                    },
                },
            })
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload) => {
                    handleSessionUpdate(payload.new as SessionRow);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'session_feedback',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    handleFeedbackInsert(payload.new as SessionFeedbackRow);
                }
            )
            .on('broadcast', { event: 'session-feedback' }, (message) => {
                handleFeedbackBroadcast(message.payload);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            channelRef.current = null;
            void client.removeChannel(channel);
        };
    }, [sessionId, teamId]);

    const broadcastFeedback = useCallback(
        async (entry: SessionFeedbackEntry) => {
            if (!sessionId || !teamId || !channelRef.current) {
                return;
            }

            await channelRef.current.send({
                type: 'broadcast',
                event: 'session-feedback',
                payload: {
                    entry,
                    sessionId,
                    teamId,
                } satisfies SessionFeedbackBroadcastPayload,
            });
        },
        [sessionId, teamId]
    );

    return { broadcastFeedback };
};

function normalizeFeedbackBroadcastPayload(
    payload: unknown,
    sessionId: string | null,
    teamId: string | null
): SessionFeedbackBroadcastPayload | null {
    if (!sessionId || !teamId || !isRecord(payload)) {
        return null;
    }

    if (payload.sessionId !== sessionId || payload.teamId !== teamId || !isRecord(payload.entry)) {
        return null;
    }

    const entry = payload.entry;
    const role = entry.role;

    if (
        typeof entry.id !== 'string' ||
        typeof entry.message !== 'string' ||
        typeof entry.createdAt !== 'string' ||
        typeof entry.page !== 'number' ||
        typeof role !== 'string' ||
        !isSessionFeedbackRole(role)
    ) {
        return null;
    }

    return {
        sessionId,
        teamId,
        entry: {
            id: entry.id,
            clientId: typeof entry.clientId === 'string' ? entry.clientId : null,
            role,
            message: entry.message,
            createdAt: entry.createdAt,
            teamId,
            songId: typeof entry.songId === 'string' ? entry.songId : null,
            songTitle: typeof entry.songTitle === 'string' ? entry.songTitle : null,
            page: entry.page,
            section: typeof entry.section === 'string' ? entry.section : null,
        },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
