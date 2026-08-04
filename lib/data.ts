import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import {
    getDefaultSessionFeedbackPresets,
    MAX_SESSION_FEEDBACK_LOG,
    normalizeSessionState,
    sessionFeedbackRowToEntry,
    type SessionDetail,
    type SessionFeedbackEntry,
    type SessionFeedbackRow,
    type SessionRow,
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
    name: '주일 2부 예배팀',
    owner_id: '00000000-0000-0000-0000-000000000103',
    created_at: '2026-07-02T00:00:00.000Z',
};
const DEMO_SETLIST_ROW: SetlistRow = {
    id: DEMO_SETLIST_ID,
    team_id: DEMO_TEAM_ID,
    title: '주일 2부 예배 콘티',
    worship_date: '2026-07-05T02:00:00.000Z',
    theme: '신실하신 하나님',
    song_order: ['demo-song-1', 'demo-song-2', 'demo-song-3'],
    created_at: '2026-07-02T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
};
const DEMO_SONGS: SongRow[] = [
    {
        id: 'demo-song-1',
        team_id: DEMO_TEAM_ID,
        title: '믿음으로 서리라',
        artist: '주일 2부팀',
        original_key: 'D',
        bpm: 72,
        music_xml_url: null,
        data_xml: null,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-song-2',
        team_id: DEMO_TEAM_ID,
        title: '주님의 은혜',
        artist: '주일 2부팀',
        original_key: 'G',
        bpm: 68,
        music_xml_url: null,
        data_xml: null,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-song-3',
        team_id: DEMO_TEAM_ID,
        title: '보내소서',
        artist: '주일 2부팀',
        original_key: 'A',
        bpm: 76,
        music_xml_url: null,
        data_xml: null,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
];
const DEMO_SERVICE_PREPARATION_ROW: ServicePreparationRow = {
    id: DEMO_SERVICE_PREPARATION_ID,
    team_id: DEMO_TEAM_ID,
    setlist_id: DEMO_SETLIST_ID,
    brief: '감사로 예배를 열고, 두 번째 곡 브릿지 뒤 기도 흐름을 여유 있게 둡니다.',
    scripture_reference: '시편 95:1-7',
    prayer_focus: '예배팀과 회중이 하나님의 신실하심을 기억하도록 기도합니다.',
    worship_flow: '오프닝은 잔잔하게 시작하고, 두 번째 곡에서 고백을 깊게 만든 뒤 말씀 전 기도로 연결합니다.',
    announcement: '말씀 본문 슬라이드와 3곡 엔딩 카운트를 리허설 전까지 확인해주세요.',
    leader_notes: '후렴 진입 전 한 박자 숨을 두고, 드럼과 엔딩 컷오프를 맞춥니다.',
    call_time_notes: '리허설은 9:10에 시작합니다. 미디어와 음향은 8:50까지 체크인합니다.',
    rehearsal_time: '주일 9:10',
    call_time: '주일 8:50',
    created_at: '2026-07-02T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
};
const DEMO_PROFILES: ProfileRow[] = [
    {
        id: 'demo-profile-1',
        username: '김하은',
        avatar_url: null,
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-profile-2',
        username: '최다니엘',
        avatar_url: null,
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-profile-3',
        username: '박민서',
        avatar_url: null,
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-profile-4',
        username: '정요셉',
        avatar_url: null,
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-profile-5',
        username: '장미나',
        avatar_url: null,
        updated_at: '2026-07-02T00:00:00.000Z',
    },
];
const DEMO_ASSIGNMENTS: ServiceAssignmentRow[] = [
    {
        id: 'demo-assignment-1',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-1',
        role: '인도자',
        instrument: null,
        needs_help_note: null,
        is_confirmed: true,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-2',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-2',
        role: '건반',
        instrument: 'Pad A',
        needs_help_note: null,
        is_confirmed: true,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-3',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-3',
        role: '보컬',
        instrument: null,
        needs_help_note: '두 번째 곡 브릿지 화음 진입을 리허설 후 확정해야 합니다.',
        is_confirmed: false,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-4',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-4',
        role: '드럼',
        instrument: null,
        needs_help_note: '3곡 마지막 엔딩 카운트를 리허설 전 확정해야 합니다.',
        is_confirmed: false,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-assignment-5',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        profile_id: 'demo-profile-5',
        role: '미디어',
        instrument: null,
        needs_help_note: '말씀 본문 슬라이드 최종 문구를 기다리는 중입니다.',
        is_confirmed: false,
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
];
const DEMO_CHECKS: ServiceReadinessCheckRow[] = [
    {
        id: 'demo-check-1',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'notice',
        label: '공지 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-2',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'setlist',
        label: '콘티 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-3',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'practice',
        label: '개인 준비',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-4',
        service_assignment_id: 'demo-assignment-1',
        check_key: 'serviceNotes',
        label: '예배 메모',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-5',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'notice',
        label: '공지 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-6',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'setlist',
        label: '콘티 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-7',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'practice',
        label: '개인 준비',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-8',
        service_assignment_id: 'demo-assignment-2',
        check_key: 'serviceNotes',
        label: '예배 메모',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-9',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'notice',
        label: '공지 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-10',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'setlist',
        label: '콘티 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-11',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'practice',
        label: '개인 준비',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-12',
        service_assignment_id: 'demo-assignment-3',
        check_key: 'serviceNotes',
        label: '예배 메모',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-13',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'notice',
        label: '공지 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-14',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'setlist',
        label: '콘티 확인',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-15',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'practice',
        label: '개인 준비',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-16',
        service_assignment_id: 'demo-assignment-4',
        check_key: 'serviceNotes',
        label: '예배 메모',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-17',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'notice',
        label: '공지 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-18',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'setlist',
        label: '콘티 확인',
        is_complete: true,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-19',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'practice',
        label: '개인 준비',
        is_complete: false,
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
    },
    {
        id: 'demo-check-20',
        service_assignment_id: 'demo-assignment-5',
        check_key: 'serviceNotes',
        label: '예배 메모',
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
        note: '1절은 패드 중심으로 넓게 시작하고 후렴 전 한 박자를 비워둡니다.',
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-song-note-2',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        song_id: 'demo-song-2',
        note: '브릿지는 2번 반복하고 마지막 후렴 뒤 말씀 전 기도로 자연스럽게 연결합니다.',
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
    {
        id: 'demo-song-note-3',
        service_preparation_id: DEMO_SERVICE_PREPARATION_ID,
        song_id: 'demo-song-3',
        note: '엔딩 태그를 길게 유지하되 인도자 손 신호에 맞춰 컷오프합니다.',
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
    },
];
const DEMO_SESSION_ROW: SessionRow = {
    id: DEMO_SESSION_ID,
    team_id: DEMO_TEAM_ID,
    setlist_id: DEMO_SETLIST_ID,
    leader_id: null,
    is_active: true,
    current_state: {
        songId: 'demo-song-1',
        page: 3,
        section: 'Chorus',
        bpmEnabled: true,
        bpmValue: 72,
        autoBpmSync: true,
        feedbackLog: [
            {
                id: 'demo-feedback-1',
                clientId: null,
                role: 'leader',
                message: '브릿지 2번 반복 후 후렴으로 갑니다.',
                createdAt: '2026-07-02T00:08:00.000Z',
                teamId: DEMO_TEAM_ID,
                songId: 'demo-song-1',
                songTitle: '믿음으로 서리라',
                page: 3,
                section: 'Bridge',
            },
            {
                id: 'demo-feedback-2',
                clientId: null,
                role: 'instrument',
                message: '드럼 BPM 72로 유지하고 엔딩 카운트만 확인해주세요.',
                createdAt: '2026-07-02T00:09:00.000Z',
                teamId: DEMO_TEAM_ID,
                songId: 'demo-song-1',
                songTitle: '믿음으로 서리라',
                page: 3,
                section: 'Chorus',
            },
        ],
        quickFeedbackPresets: getDefaultSessionFeedbackPresets('2026-07-02T00:00:00.000Z'),
    } as unknown as SessionRow['current_state'],
    started_at: '2026-07-02T00:00:00.000Z',
    ended_at: null,
};

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

async function getSessionFeedback(
    sessionId: string,
    teamId: string | null
): Promise<SessionFeedbackEntry[]> {
    if (!supabase || !teamId) {
        return [];
    }

    const { data: rows, error } = await supabase
        .from('session_feedback')
        .select('*')
        .eq('session_id', sessionId)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(MAX_SESSION_FEEDBACK_LOG);

    if (error || !rows) {
        if (error) {
            console.error('Failed to fetch session feedback:', error);
        }

        return [];
    }

    return (rows as SessionFeedbackRow[]).reverse().map(sessionFeedbackRowToEntry);
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
        return teamId === DEMO_TEAM_ID ? DEMO_SESSION_ROW : null;
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
    if (sessionId === DEMO_SESSION_ID) {
        const currentState = normalizeSessionState(DEMO_SESSION_ROW.current_state, DEMO_SONGS);

        return {
            session: DEMO_SESSION_ROW,
            setlist: DEMO_SETLIST_ROW,
            songs: DEMO_SONGS,
            team: DEMO_TEAM_ROW,
            currentState,
        };
    }

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
    const normalizedState = normalizeSessionState(session.current_state, songs);
    const feedbackLog = await getSessionFeedback(session.id, session.team_id);
    const currentState = {
        ...normalizedState,
        feedbackLog: feedbackLog.length > 0 ? feedbackLog : normalizedState.feedbackLog,
    };

    return {
        session,
        setlist,
        songs,
        team,
        currentState,
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
