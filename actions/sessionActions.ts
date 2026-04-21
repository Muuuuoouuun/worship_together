'use server';

import { getSupabaseClient } from '@/lib/supabase';
import {
    getDefaultSessionFeedbackPresets,
    isSessionFeedbackRole,
    MAX_SESSION_FEEDBACK_LOG,
    MAX_SESSION_FEEDBACK_PRESETS,
    normalizeSessionState,
    type SessionCurrentState,
    type SessionFeedbackEntry,
    type SessionFeedbackRole,
    type SessionRow,
} from '@/types/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function startSession(teamId: string, setlistId: string) {
    const supabase = getSupabaseClient();

    const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const existingSession = data as { id: string } | null;

    if (existingSession) {
        redirect(`/session/${existingSession.id}`);
    }

    const { data: setlist } = await supabase
        .from('setlists')
        .select('song_order, team_id')
        .eq('id', setlistId)
        .eq('team_id', teamId)
        .maybeSingle();

    if (!setlist) {
        throw new Error('Setlist does not belong to this team');
    }

    const songIds = Array.isArray(setlist?.song_order)
        ? (setlist.song_order as unknown[]).filter((value): value is string => typeof value === 'string')
        : [];
    const initialSongId = songIds[0] ?? null;
    const initialBpm = initialSongId
        ? await getSongPresetBpm(initialSongId)
        : null;
    const startedAt = new Date().toISOString();

    const { data: newSession, error } = await supabase
        .from('sessions')
        .insert({
            team_id: teamId,
            setlist_id: setlistId,
            leader_id: null,
            is_active: true,
            current_state: {
                songId: initialSongId,
                page: 1,
                section: 'Prelude',
                bpmEnabled: false,
                bpmValue: initialBpm,
                autoBpmSync: true,
                feedbackLog: [],
                quickFeedbackPresets: getDefaultSessionFeedbackPresets(startedAt),
            },
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to start session:', error);
        throw new Error('Failed to start session');
    }

    revalidatePath('/dashboard');
    redirect(`/session/${newSession.id}`);
}

export async function updateSessionState(
    sessionId: string,
    teamId: string,
    payload: Partial<SessionCurrentState>
) {
    const { session, supabase } = await getTeamScopedSession(sessionId, teamId);

    ensureActiveSession(session);

    const currentState = normalizeSessionState(session.current_state);
    const nextState: SessionCurrentState = {
        songId: payload.songId !== undefined ? payload.songId : currentState.songId,
        page: payload.page !== undefined ? payload.page : currentState.page,
        section: payload.section !== undefined ? payload.section : currentState.section,
        bpmEnabled: payload.bpmEnabled !== undefined ? payload.bpmEnabled : currentState.bpmEnabled,
        bpmValue: payload.bpmValue !== undefined ? payload.bpmValue : currentState.bpmValue,
        autoBpmSync: payload.autoBpmSync !== undefined ? payload.autoBpmSync : currentState.autoBpmSync,
        feedbackLog: currentState.feedbackLog,
        quickFeedbackPresets: currentState.quickFeedbackPresets,
    };

    const { error } = await supabase
        .from('sessions')
        .update({ current_state: nextState })
        .eq('id', sessionId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to update session state:', error);
        throw new Error('Failed to update session state');
    }

}

async function getSongPresetBpm(songId: string): Promise<number | null> {
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
        .from('songs')
        .select('bpm')
        .eq('id', songId)
        .maybeSingle();

    if (!song || typeof song.bpm !== 'number' || !Number.isFinite(song.bpm) || song.bpm <= 0) {
        return null;
    }

    return Math.floor(song.bpm);
}

interface AppendSessionFeedbackPayload {
    clientId: string | null;
    role: SessionFeedbackRole;
    message: string;
    songId: string | null;
    songTitle: string | null;
    page: number;
    section: string | null;
}

export async function appendSessionFeedback(
    sessionId: string,
    teamId: string,
    payload: AppendSessionFeedbackPayload
) {
    const { session, supabase } = await getTeamScopedSession(sessionId, teamId);
    const message = payload.message.trim().slice(0, 220);

    ensureActiveSession(session);

    if (!message) {
        throw new Error('Feedback message is required');
    }

    if (!isSessionFeedbackRole(payload.role)) {
        throw new Error('Invalid feedback role');
    }

    const currentState = normalizeSessionState(session.current_state);
    const entry: SessionFeedbackEntry = {
        id: crypto.randomUUID(),
        clientId: payload.clientId,
        role: payload.role,
        message,
        createdAt: new Date().toISOString(),
        teamId,
        songId: payload.songId,
        songTitle: payload.songTitle,
        page: payload.page,
        section: payload.section,
    };
    const nextFeedbackLog = [
        ...currentState.feedbackLog,
        entry,
    ].slice(-MAX_SESSION_FEEDBACK_LOG);

    const nextState: SessionCurrentState = {
        ...currentState,
        feedbackLog: nextFeedbackLog,
    };

    const { error } = await supabase
        .from('sessions')
        .update({ current_state: nextState })
        .eq('id', sessionId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to append session feedback:', error);
        throw new Error('Failed to append session feedback');
    }

    return {
        entry,
        feedbackLog: nextFeedbackLog,
    };
}

interface AddSessionFeedbackPresetPayload {
    role: SessionFeedbackRole;
    label: string;
    message: string;
}

export async function addSessionFeedbackPreset(
    sessionId: string,
    teamId: string,
    payload: AddSessionFeedbackPresetPayload
) {
    const { session, supabase } = await getTeamScopedSession(sessionId, teamId);
    const label = payload.label.trim().slice(0, 32);
    const message = payload.message.trim().slice(0, 220);

    ensureActiveSession(session);

    if (!message) {
        throw new Error('Preset message is required');
    }

    if (!isSessionFeedbackRole(payload.role)) {
        throw new Error('Invalid feedback role');
    }

    const currentState = normalizeSessionState(session.current_state);
    const normalizedLabel = label || message;
    const dedupedPresets = currentState.quickFeedbackPresets.filter(
        (preset) => !(preset.role === payload.role && preset.message === message)
    );
    const nextQuickFeedbackPresets = [
        ...dedupedPresets,
        {
            id: crypto.randomUUID(),
            role: payload.role,
            label: normalizedLabel,
            message,
            createdAt: new Date().toISOString(),
        },
    ].slice(-MAX_SESSION_FEEDBACK_PRESETS);

    const nextState: SessionCurrentState = {
        ...currentState,
        quickFeedbackPresets: nextQuickFeedbackPresets,
    };

    const { error } = await supabase
        .from('sessions')
        .update({ current_state: nextState })
        .eq('id', sessionId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to add session preset:', error);
        throw new Error('Failed to add session preset');
    }

    return nextQuickFeedbackPresets;
}

export async function endSession(sessionId: string, teamId: string) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
        .from('sessions')
        .update({
            is_active: false,
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to end session:', error);
        throw new Error('Failed to end session');
    }

    revalidatePath('/dashboard');
    revalidatePath(`/session/${sessionId}`);
    redirect('/dashboard');
}

async function getTeamScopedSession(sessionId: string, teamId: string): Promise<{
    session: Pick<SessionRow, 'current_state' | 'id' | 'is_active' | 'team_id'>;
    supabase: ReturnType<typeof getSupabaseClient>;
}> {
    const supabase = getSupabaseClient();

    const { data: session, error } = await supabase
        .from('sessions')
        .select('id, team_id, is_active, current_state')
        .eq('id', sessionId)
        .eq('team_id', teamId)
        .single();

    if (error || !session) {
        console.error('Failed to fetch team-scoped session:', error);
        throw new Error('Session does not belong to this team');
    }

    return { session, supabase };
}

function ensureActiveSession(session: Pick<SessionRow, 'is_active'>) {
    if (!session.is_active) {
        throw new Error('Session is already closed');
    }
}
