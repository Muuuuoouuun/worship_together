'use server';

import { DEMO_TEAM_ID } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { type Database } from '@/types/schema';

type ServicePreparationRow = Database['public']['Tables']['service_preparation']['Row'];
type ServiceAssignmentRow = Database['public']['Tables']['service_assignments']['Row'];
type ServiceReadinessCheckRow = Database['public']['Tables']['service_readiness_checks']['Row'];
type SongPreparationNoteRow = Database['public']['Tables']['song_preparation_notes']['Row'];

interface ToggleServiceReadinessCheckPayload {
    teamId: string;
    serviceAssignmentId: string;
    checkKey: string;
    label?: string;
    note?: string | null;
    isComplete?: boolean;
}

interface UpdateServiceNeedsHelpNotePayload {
    teamId: string;
    serviceAssignmentId: string;
    note: string | null;
}

interface UpsertServicePreparationBriefPayload {
    teamId: string;
    setlistId: string;
    brief: string;
    scriptureReference?: string | null;
    prayerFocus?: string | null;
    worshipFlow?: string | null;
    announcement?: string | null;
    leaderNotes?: string | null;
    callTimeNotes?: string | null;
    rehearsalTime?: string | null;
    callTime?: string | null;
}

interface UpsertSongPreparationNotePayload {
    teamId: string;
    servicePreparationId: string;
    songId: string;
    note: string;
}

export async function toggleServiceReadinessCheck(
    payload: ToggleServiceReadinessCheckPayload
): Promise<{
    assignment: ServiceAssignmentRow | null;
    readinessCheck: ServiceReadinessCheckRow;
}> {
    const now = new Date().toISOString();
    const label = normalizeLabel(payload.label ?? payload.checkKey);

    if (!supabase) {
        const readinessCheck: ServiceReadinessCheckRow = {
            id: crypto.randomUUID(),
            service_assignment_id: payload.serviceAssignmentId,
            check_key: payload.checkKey,
            label,
            is_complete: payload.isComplete ?? true,
            note: normalizeNullableText(payload.note),
            created_at: now,
            updated_at: now,
        };

        return {
            assignment: null,
            readinessCheck,
        };
    }

    const assignment = await getAssignmentForTeam(payload.teamId, payload.serviceAssignmentId);

    if (!assignment) {
        throw new Error('Service assignment was not found for this team');
    }

    const { data: existingCheck, error: readError } = await supabase
        .from('service_readiness_checks')
        .select('*')
        .eq('service_assignment_id', payload.serviceAssignmentId)
        .eq('check_key', payload.checkKey)
        .maybeSingle();

    if (readError) {
        console.error('Failed to load readiness check:', readError);
        throw new Error('Failed to load readiness check');
    }

    const nextIsComplete = payload.isComplete ?? !Boolean(existingCheck?.is_complete);

    const upsertPayload = {
        service_assignment_id: payload.serviceAssignmentId,
        check_key: payload.checkKey,
        label: existingCheck?.label ?? label,
        is_complete: nextIsComplete,
        note:
            payload.note !== undefined
                ? normalizeNullableText(payload.note)
                : existingCheck?.note ?? null,
        updated_at: now,
    };

    const { data: readinessCheck, error: writeError } = await supabase
        .from('service_readiness_checks')
        .upsert(existingCheck ? { ...existingCheck, ...upsertPayload } : upsertPayload, {
            onConflict: 'service_assignment_id,check_key',
        })
        .select('*')
        .single();

    if (writeError || !readinessCheck) {
        console.error('Failed to toggle readiness check:', writeError);
        throw new Error('Failed to toggle readiness check');
    }

    await supabase
        .from('service_assignments')
        .update({ updated_at: now })
        .eq('id', payload.serviceAssignmentId);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');

    return {
        assignment,
        readinessCheck,
    };
}

export async function updateServiceNeedsHelpNote(
    payload: UpdateServiceNeedsHelpNotePayload
): Promise<{ assignment: ServiceAssignmentRow }> {
    const now = new Date().toISOString();
    const nextNote = normalizeNullableText(payload.note);

    if (!supabase) {
        return {
            assignment: {
                id: payload.serviceAssignmentId,
                service_preparation_id: '',
                profile_id: '',
                role: 'Service member',
                instrument: null,
                needs_help_note: nextNote,
                is_confirmed: null,
                created_at: now,
                updated_at: now,
            },
        };
    }

    const assignment = await getAssignmentForTeam(payload.teamId, payload.serviceAssignmentId);

    if (!assignment) {
        throw new Error('Service assignment was not found for this team');
    }

    const { data: updatedAssignment, error } = await supabase
        .from('service_assignments')
        .update({
            needs_help_note: nextNote,
            updated_at: now,
        })
        .eq('id', payload.serviceAssignmentId)
        .select('*')
        .single();

    if (error || !updatedAssignment) {
        console.error('Failed to update needs-help note:', error);
        throw new Error('Failed to update needs-help note');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');

    return {
        assignment: updatedAssignment,
    };
}

export async function upsertServicePreparationBrief(
    payload: UpsertServicePreparationBriefPayload
): Promise<{ servicePreparation: ServicePreparationRow }> {
    const now = new Date().toISOString();
    const brief = payload.brief.trim();
    const scriptureReference = normalizeNullableText(payload.scriptureReference);
    const prayerFocus = normalizeNullableText(payload.prayerFocus);
    const worshipFlow = normalizeNullableText(payload.worshipFlow);
    const announcement = normalizeNullableText(payload.announcement);
    const leaderNotes = normalizeNullableText(payload.leaderNotes);
    const callTimeNotes = normalizeNullableText(payload.callTimeNotes);
    const rehearsalTime = normalizeNullableText(payload.rehearsalTime);
    const callTime = normalizeNullableText(payload.callTime);

    if (!supabase) {
        return {
            servicePreparation: {
                id: payload.teamId === DEMO_TEAM_ID ? '00000000-0000-0000-0000-000000000101' : crypto.randomUUID(),
                team_id: payload.teamId,
                setlist_id: payload.teamId === DEMO_TEAM_ID ? '00000000-0000-0000-0000-000000000102' : payload.setlistId,
                brief,
                scripture_reference: scriptureReference,
                prayer_focus: prayerFocus,
                worship_flow: worshipFlow,
                announcement,
                leader_notes: leaderNotes,
                call_time_notes: callTimeNotes,
                rehearsal_time: rehearsalTime,
                call_time: callTime,
                created_at: now,
                updated_at: now,
            },
        };
    }

    const { data: existingPreparation, error: loadError } = await supabase
        .from('service_preparation')
        .select('*')
        .eq('team_id', payload.teamId)
        .eq('setlist_id', payload.setlistId)
        .maybeSingle();

    if (loadError) {
        console.error('Failed to load service preparation:', loadError);
        throw new Error('Failed to load service preparation');
    }

    const upsertPayload = {
        team_id: payload.teamId,
        setlist_id: payload.setlistId,
        brief,
        scripture_reference: scriptureReference,
        prayer_focus: prayerFocus,
        worship_flow: worshipFlow,
        announcement,
        leader_notes: leaderNotes,
        call_time_notes: callTimeNotes,
        rehearsal_time: rehearsalTime,
        call_time: callTime,
        updated_at: now,
    };

    const { data: servicePreparation, error: writeError } = await supabase
        .from('service_preparation')
        .upsert(existingPreparation ? { ...existingPreparation, ...upsertPayload } : upsertPayload, {
            onConflict: 'setlist_id',
        })
        .select('*')
        .single();

    if (writeError || !servicePreparation) {
        console.error('Failed to upsert service brief:', writeError);
        throw new Error('Failed to upsert service brief');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');

    return {
        servicePreparation,
    };
}

export async function upsertSongPreparationNote(
    payload: UpsertSongPreparationNotePayload
): Promise<{ note: SongPreparationNoteRow }> {
    const now = new Date().toISOString();
    const note = payload.note.trim();

    if (!supabase) {
        return {
            note: {
                id: crypto.randomUUID(),
                service_preparation_id: payload.servicePreparationId,
                song_id: payload.songId,
                note,
                created_at: now,
                updated_at: now,
            },
        };
    }

    const servicePreparation = await getServicePreparationForTeam(
        payload.teamId,
        payload.servicePreparationId
    );

    if (!servicePreparation) {
        throw new Error('Service preparation was not found for this team');
    }

    const { data: existingNote, error: loadError } = await supabase
        .from('song_preparation_notes')
        .select('*')
        .eq('service_preparation_id', payload.servicePreparationId)
        .eq('song_id', payload.songId)
        .maybeSingle();

    if (loadError) {
        console.error('Failed to load song preparation note:', loadError);
        throw new Error('Failed to load song preparation note');
    }

    const upsertPayload = {
        service_preparation_id: payload.servicePreparationId,
        song_id: payload.songId,
        note,
        updated_at: now,
    };

    const { data: noteRow, error: writeError } = await supabase
        .from('song_preparation_notes')
        .upsert(existingNote ? { ...existingNote, ...upsertPayload } : upsertPayload, {
            onConflict: 'service_preparation_id,song_id',
        })
        .select('*')
        .single();

    if (writeError || !noteRow) {
        console.error('Failed to upsert song preparation note:', writeError);
        throw new Error('Failed to upsert song preparation note');
    }

    revalidatePath('/dashboard');

    return {
        note: noteRow,
    };
}

async function getAssignmentForTeam(
    teamId: string,
    serviceAssignmentId: string
): Promise<ServiceAssignmentRow | null> {
    const { data: assignment, error } = await supabase!
        .from('service_assignments')
        .select('*')
        .eq('id', serviceAssignmentId)
        .maybeSingle();

    if (error || !assignment) {
        return null;
    }

    const preparation = await getServicePreparationForTeam(
        teamId,
        assignment.service_preparation_id
    );

    if (!preparation) {
        return null;
    }

    return assignment;
}

async function getServicePreparationForTeam(
    teamId: string,
    servicePreparationId: string
): Promise<ServicePreparationRow | null> {
    const { data: servicePreparation, error } = await supabase!
        .from('service_preparation')
        .select('*')
        .eq('id', servicePreparationId)
        .maybeSingle();

    if (error || !servicePreparation || servicePreparation.team_id !== teamId) {
        return null;
    }

    return servicePreparation;
}

function normalizeLabel(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length > 0) {
        return trimmed.slice(0, 96);
    }

    return 'Check';
}

function normalizeNullableText(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';

    return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}
