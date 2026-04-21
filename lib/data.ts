import { DEMO_TEAM_ID } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import {
    normalizeSessionState,
    type SessionDetail,
    type SetlistRow,
    type SongRow,
    type TeamRow,
} from '@/types/session';
import { type Database } from '@/types/schema';

type ServicePreparationRow = Database['public']['Tables']['service_preparation']['Row'];
type ServiceAssignmentRow = Database['public']['Tables']['service_assignments']['Row'];
type ServiceReadinessCheckRow = Database['public']['Tables']['service_readiness_checks']['Row'];
type SongPreparationNoteRow = Database['public']['Tables']['song_preparation_notes']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type Setlist = SetlistRow;
type Song = SongRow;

export interface SetlistWithSongs extends Setlist {
    songs: Song[];
}

export interface ServiceAssignmentWithDetails extends ServiceAssignmentRow {
    profile: ProfileRow | null;
    readinessChecks: ServiceReadinessCheckRow[];
}

export interface SongPreparationNoteWithSong extends SongPreparationNoteRow {
    song: Song | null;
}

export interface ServicePreparationBundle {
    servicePreparation: ServicePreparationRow | null;
    setlist: SetlistRow | null;
    team: TeamRow | null;
    songs: Song[];
    assignments: ServiceAssignmentWithDetails[];
    songNotes: SongPreparationNoteWithSong[];
}

export interface ServicePreparationSummary {
    servicePreparation: ServicePreparationRow;
    setlist: SetlistRow | null;
    assignmentCount: number;
    readyCount: number;
    needsHelpCount: number;
    completedChecks: number;
    totalChecks: number;
    songNoteCount: number;
}

const DEMO_SERVICE_PREPARATION_ID = '00000000-0000-0000-0000-000000000101';
const DEMO_SETLIST_ID = '00000000-0000-0000-0000-000000000102';
const DEMO_TEAM_ROW: TeamRow = {
    id: DEMO_TEAM_ID,
    name: 'Worship Together Demo Team',
    owner_id: '00000000-0000-0000-0000-000000000103',
    created_at: '2026-04-21T00:00:00.000Z',
};
const DEMO_SETLIST_ROW: SetlistRow = {
    id: DEMO_SETLIST_ID,
    team_id: DEMO_TEAM_ID,
    title: 'Sunday Service',
    worship_date: '2026-04-26T09:00:00.000Z',
    theme: 'Trust and Sending',
    song_order: ['demo-song-1', 'demo-song-2'],
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
};
const DEMO_SONGS: SongRow[] = [
    {
        id: 'demo-song-1',
        team_id: DEMO_TEAM_ID,
        title: 'Great Is Thy Faithfulness',
        artist: 'Thomas Chisholm',
        original_key: 'D',
        bpm: 72,
        music_xml_url: null,
        data_xml: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-song-2',
        team_id: DEMO_TEAM_ID,
        title: 'Build My Life',
        artist: 'Pat Barrett',
        original_key: 'G',
        bpm: 68,
        music_xml_url: null,
        data_xml: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
];
const DEMO_SERVICE_PREPARATION_ROW: ServicePreparationRow = {
    id: DEMO_SERVICE_PREPARATION_ID,
    team_id: DEMO_TEAM_ID,
    setlist_id: DEMO_SETLIST_ID,
    brief: 'Open with calm confidence, keep the bridge cue clear, and leave room for prayer after the second song.',
    scripture_reference: 'Psalm 95:1-7',
    prayer_focus: 'Ask God to prepare the room for grateful, humble worship.',
    worship_flow: 'Thanksgiving opens the room, faithfulness anchors the response, and the final song sends the church out with trust.',
    announcement: 'Please read the ending cue before rehearsal and confirm the final scripture slide.',
    leader_notes: 'Watch the dynamic lift into the chorus and confirm the final ending count with drums.',
    call_time_notes: 'Run-through starts at 7:40 AM. Slides and audio should check in 15 minutes earlier.',
    rehearsal_time: 'Saturday 7:00 PM',
    call_time: 'Sunday 8:30 AM',
    created_at: '2026-04-21T00:00:00.000Z',
    updated_at: '2026-04-21T00:00:00.000Z',
};
const DEMO_PROFILES: ProfileRow[] = [
    {
        id: 'demo-profile-1',
        username: 'Grace Kim',
        avatar_url: null,
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-profile-2',
        username: 'Daniel Park',
        avatar_url: null,
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-profile-3',
        username: 'Hannah Lee',
        avatar_url: null,
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-profile-4',
        username: 'Joseph Choi',
        avatar_url: null,
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-profile-5',
        username: 'Mina Jung',
        avatar_url: null,
        updated_at: '2026-04-21T00:00:00.000Z',
    },
];
const DEMO_ASSIGNMENTS: ServiceAssignmentRow[] = [
    {
        id: 'demo-assignment-1',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-1',
        role: 'Worship leader',
        instrument: null,
        needs_help_note: null,
        is_confirmed: true,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-2',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-2',
        role: 'Keys',
        instrument: 'Pad A',
        needs_help_note: null,
        is_confirmed: true,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-3',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-3',
        role: 'Vocal',
        instrument: null,
        needs_help_note: 'Needs harmony entry confirmed after the second chorus.',
        is_confirmed: false,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-4',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-4',
        role: 'Drums',
        instrument: null,
        needs_help_note: 'Needs the ending count confirmed before rehearsal.',
        is_confirmed: false,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-5',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-5',
        role: 'Slides',
        instrument: null,
        needs_help_note: 'Waiting for the final scripture reading text.',
        is_confirmed: false,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
];
const DEMO_CHECKS: ServiceReadinessCheckRow[] = [
    {
        id: 'demo-check-1',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'notice',
        label: 'Notice read',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-2',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'setlist',
        label: 'Setlist reviewed',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-3',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'practice',
        label: 'Practice ready',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-4',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'serviceNotes',
        label: 'Service notes',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-5',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'notice',
        label: 'Notice read',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-6',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'setlist',
        label: 'Setlist reviewed',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-7',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'practice',
        label: 'Practice ready',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-8',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'serviceNotes',
        label: 'Service notes',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-9',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'notice',
        label: 'Notice read',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-10',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'setlist',
        label: 'Setlist reviewed',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-11',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'practice',
        label: 'Practice ready',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-12',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'serviceNotes',
        label: 'Service notes',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-13',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'notice',
        label: 'Notice read',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-14',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'setlist',
        label: 'Setlist reviewed',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-15',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'practice',
        label: 'Practice ready',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-16',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'serviceNotes',
        label: 'Service notes',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-17',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'notice',
        label: 'Notice read',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-18',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'setlist',
        label: 'Setlist reviewed',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-19',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'practice',
        label: 'Practice ready',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-20',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'serviceNotes',
        label: 'Service notes',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
];
const DEMO_SONG_NOTES: SongPreparationNoteRow[] = [
    {
        id: 'demo-song-note-1',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        song_id: 'demo-song-1',
        note: 'Keep the first verse spacious and leave one extra beat before the chorus entry.',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-song-note-2',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        song_id: 'demo-song-2',
        note: 'Repeat the final chorus once and hold the tag until the pastor is ready.',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
];

function getSongIdsFromOrder(songOrder: Setlist['song_order']): string[] {
    return Array.isArray(songOrder)
        ? (songOrder as unknown[]).filter((value): value is string => typeof value === 'string')
        : [];
}

function orderSongsByIds(songIds: string[], songs: Song[]): Song[] {
    const songsById = new Map(songs.map((song) => [song.id, song]));

    return songIds
        .map((id) => songsById.get(id))
        .filter((song): song is Song => Boolean(song));
}

async function getSongsByIds(songIds: string[]): Promise<Song[]> {
    if (!supabase || songIds.length === 0) {
        return [];
    }

    const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .in('id', songIds);

    if (error) {
        console.error('Error fetching songs:', error);
        return [];
    }

    return songs ?? [];
}

async function getProfilesByIds(profileIds: string[]): Promise<ProfileRow[]> {
    if (!supabase || profileIds.length === 0) {
        return [];
    }

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

    if (error) {
        console.error('Error fetching profiles:', error);
        return [];
    }

    return profiles ?? [];
}

async function getAssignmentsByServicePreparationId(
    servicePreparationId: string
): Promise<ServiceAssignmentRow[]> {
    if (!supabase) {
        return [];
    }

    const { data: assignments, error } = await supabase
        .from('service_assignments')
        .select('*')
        .eq('service_preparation_id', servicePreparationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching service assignments:', error);
        return [];
    }

    return assignments ?? [];
}

async function getReadinessChecksByAssignmentIds(
    assignmentIds: string[]
): Promise<ServiceReadinessCheckRow[]> {
    if (!supabase || assignmentIds.length === 0) {
        return [];
    }

    const { data: checks, error } = await supabase
        .from('service_readiness_checks')
        .select('*')
        .in('service_assignment_id', assignmentIds)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching service readiness checks:', error);
        return [];
    }

    return checks ?? [];
}

async function getSongNotesByServicePreparationId(
    servicePreparationId: string
): Promise<SongPreparationNoteRow[]> {
    if (!supabase) {
        return [];
    }

    const { data: notes, error } = await supabase
        .from('song_preparation_notes')
        .select('*')
        .eq('service_preparation_id', servicePreparationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching song preparation notes:', error);
        return [];
    }

    return notes ?? [];
}

async function getSongsInOrder(songIds: string[]): Promise<Song[]> {
    return orderSongsByIds(songIds, await getSongsByIds(songIds));
}

function buildBundleFromRows({
    servicePreparation,
    setlist,
    team,
    songs,
    assignments,
    readinessChecks,
    songNotes,
    profiles,
}: {
    servicePreparation: ServicePreparationRow | null;
    setlist: SetlistRow | null;
    team: TeamRow | null;
    songs: Song[];
    assignments: ServiceAssignmentRow[];
    readinessChecks: ServiceReadinessCheckRow[];
    songNotes: SongPreparationNoteRow[];
    profiles: ProfileRow[];
}): ServicePreparationBundle {
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const checksByAssignmentId = new Map<string, ServiceReadinessCheckRow[]>();

    readinessChecks.forEach((check) => {
        const nextChecks = checksByAssignmentId.get(check.service_assignment_id) ?? [];
        nextChecks.push(check);
        checksByAssignmentId.set(check.service_assignment_id, nextChecks);
    });

    const songById = new Map(songs.map((song) => [song.id, song]));

    return {
        servicePreparation,
        setlist,
        team,
        songs,
        assignments: assignments.map((assignment) => ({
            ...assignment,
            profile: profilesById.get(assignment.profile_id) ?? null,
            readinessChecks: checksByAssignmentId.get(assignment.id) ?? [],
        })),
        songNotes: songNotes.map((note) => ({
            ...note,
            song: songById.get(note.song_id) ?? null,
        })),
    };
}

function buildDemoServicePreparationBundle(): ServicePreparationBundle {
    return buildBundleFromRows({
        servicePreparation: DEMO_SERVICE_PREPARATION_ROW,
        setlist: DEMO_SETLIST_ROW,
        team: DEMO_TEAM_ROW,
        songs: DEMO_SONGS,
        assignments: DEMO_ASSIGNMENTS,
        readinessChecks: DEMO_CHECKS,
        songNotes: DEMO_SONG_NOTES,
        profiles: DEMO_PROFILES,
    });
}

export async function getUpcomingSetlist(teamId: string): Promise<SetlistWithSongs | null> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID
            ? {
                ...DEMO_SETLIST_ROW,
                songs: DEMO_SONGS,
            }
            : null;
    }

    const now = new Date().toISOString();

    const { data: setlist, error } = await supabase
        .from('setlists')
        .select('*')
        .eq('team_id', teamId)
        .gte('worship_date', now)
        .order('worship_date', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error || !setlist) {
        console.warn('No upcoming setlist found or error:', error);
        return null;
    }

    const songIds = getSongIdsFromOrder(setlist.song_order);
    const songs = await getSongsInOrder(songIds);

    return { ...setlist, songs };
}

export async function getCurrentSession(teamId: string) {
    if (!supabase) {
        return null;
    }

    const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        return null;
    }

    return session;
}

export async function getSongsByTeam(teamId: string): Promise<Song[]> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID ? DEMO_SONGS : [];
    }

    const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .eq('team_id', teamId)
        .order('updated_at', { ascending: false });

    if (error || !songs) {
        console.error('Failed to fetch songs:', error);
        return [];
    }

    return songs;
}

export async function getSetlistsByTeam(teamId: string): Promise<SetlistWithSongs[]> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID
            ? [
                {
                    ...DEMO_SETLIST_ROW,
                    songs: DEMO_SONGS,
                },
            ]
            : [];
    }

    const { data: setlists, error } = await supabase
        .from('setlists')
        .select('*')
        .eq('team_id', teamId)
        .order('worship_date', { ascending: true });

    if (error || !setlists) {
        console.error('Failed to fetch setlists:', error);
        return [];
    }

    const songIdsBySetlist = setlists.map((setlist) => getSongIdsFromOrder(setlist.song_order));
    const uniqueSongIds = Array.from(new Set(songIdsBySetlist.flat()));
    const songs = await getSongsByIds(uniqueSongIds);
    const setlistsWithSongs = setlists.map((setlist, index) => ({
        ...setlist,
        songs: orderSongsByIds(songIdsBySetlist[index] ?? [], songs),
    }));

    return setlistsWithSongs;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    if (!supabase) {
        return null;
    }

    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

    if (sessionError || !session) {
        console.error('Failed to fetch session detail:', sessionError);
        return null;
    }

    const [{ data: setlist }, { data: team }] = await Promise.all([
        session.setlist_id
            ? supabase
                .from('setlists')
                .select('*')
                .eq('id', session.setlist_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        session.team_id
            ? supabase
                .from('teams')
                .select('*')
                .eq('id', session.team_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    const songIds = getSongIdsFromOrder(setlist?.song_order ?? null);
    const songs = await getSongsInOrder(songIds);

    return {
        session,
        setlist,
        songs,
        team,
        currentState: normalizeSessionState(session.current_state, songs),
    };
}

export async function getServicePreparationBySetlist(
    teamId: string,
    setlistId: string
): Promise<ServicePreparationBundle | null> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID ? buildDemoServicePreparationBundle() : null;
    }

    const { data: servicePreparation, error } = await supabase
        .from('service_preparation')
        .select('*')
        .eq('team_id', teamId)
        .eq('setlist_id', setlistId)
        .maybeSingle();

    if (error || !servicePreparation) {
        if (error) {
            console.error('Failed to fetch service preparation:', error);
        }

        return null;
    }

    return buildServicePreparationBundle(servicePreparation);
}

export async function getServicePreparationById(
    servicePreparationId: string
): Promise<ServicePreparationBundle | null> {
    if (!supabase) {
        return servicePreparationId === DEMO_SERVICE_PREPARATION_ID
            ? buildDemoServicePreparationBundle()
            : null;
    }

    const { data: servicePreparation, error } = await supabase
        .from('service_preparation')
        .select('*')
        .eq('id', servicePreparationId)
        .maybeSingle();

    if (error || !servicePreparation) {
        if (error) {
            console.error('Failed to fetch service preparation by id:', error);
        }

        return null;
    }

    return buildServicePreparationBundle(servicePreparation);
}

export async function getServicePreparationsByTeam(
    teamId: string
): Promise<ServicePreparationSummary[]> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID
            ? [buildServicePreparationSummary(buildDemoServicePreparationBundle())]
            : [];
    }

    const { data: servicePreparations, error } = await supabase
        .from('service_preparation')
        .select('*')
        .eq('team_id', teamId)
        .order('updated_at', { ascending: false });

    if (error || !servicePreparations) {
        if (error) {
            console.error('Failed to fetch service preparations:', error);
        }

        return [];
    }

    const bundles = await Promise.all(
        servicePreparations.map(async (servicePreparation) => buildServicePreparationBundle(servicePreparation))
    );

    return bundles
        .filter((bundle): bundle is ServicePreparationBundle => Boolean(bundle.servicePreparation))
        .map((bundle) => buildServicePreparationSummary(bundle));
}

export async function getSongPreparationNotesByServicePreparationId(
    servicePreparationId: string
): Promise<SongPreparationNoteWithSong[]> {
    const bundle = await getServicePreparationById(servicePreparationId);

    return bundle?.songNotes ?? [];
}

async function buildServicePreparationBundle(
    servicePreparation: ServicePreparationRow
): Promise<ServicePreparationBundle> {
    const [setlistResult, assignmentRows, songNoteRows] = await Promise.all([
        servicePreparation.setlist_id
            ? supabase
                ? supabase
                    .from('setlists')
                    .select('*')
                    .eq('id', servicePreparation.setlist_id)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null })
            : Promise.resolve({ data: null, error: null }),
        getAssignmentsByServicePreparationId(servicePreparation.id),
        getSongNotesByServicePreparationId(servicePreparation.id),
    ]);

    const setlist = setlistResult.data ?? null;
    const songIds = getSongIdsFromOrder(setlist?.song_order ?? null);
    const songs = await getSongsInOrder(songIds);
    const profiles = await getProfilesByIds(assignmentRows.map((assignment) => assignment.profile_id));
    const readinessChecks = await getReadinessChecksByAssignmentIds(
        assignmentRows.map((assignment) => assignment.id)
    );

    return buildBundleFromRows({
        servicePreparation,
        setlist,
        team: servicePreparation.team_id ? await getTeamById(servicePreparation.team_id) : null,
        songs,
        assignments: assignmentRows,
        readinessChecks,
        songNotes: songNoteRows,
        profiles,
    });
}

async function getTeamById(teamId: string): Promise<TeamRow | null> {
    if (!supabase) {
        return teamId === DEMO_TEAM_ID ? DEMO_TEAM_ROW : null;
    }

    const { data: team, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch team:', error);
        return null;
    }

    return team ?? null;
}

function buildServicePreparationSummary(bundle: ServicePreparationBundle): ServicePreparationSummary {
    const completedChecks = bundle.assignments.reduce(
        (count, assignment) => count + assignment.readinessChecks.filter((check) => check.is_complete).length,
        0
    );
    const totalChecks = bundle.assignments.reduce(
        (count, assignment) => count + assignment.readinessChecks.length,
        0
    );
    const readyCount = bundle.assignments.filter(
        (assignment) =>
            assignment.readinessChecks.length > 0 &&
            assignment.readinessChecks.every((check) => check.is_complete)
    ).length;
    const needsHelpCount = bundle.assignments.filter(
        (assignment) => Boolean(assignment.needs_help_note && assignment.needs_help_note.trim().length > 0)
    ).length;

    return {
        servicePreparation: bundle.servicePreparation ?? DEMO_SERVICE_PREPARATION_ROW,
        setlist: bundle.setlist,
        assignmentCount: bundle.assignments.length,
        readyCount,
        needsHelpCount,
        completedChecks,
        totalChecks,
        songNoteCount: bundle.songNotes.length,
    };
}
