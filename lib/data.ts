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

type Setlist = SetlistRow;
type Song = SongRow;

export interface SetlistWithSongs extends Setlist {
    songs: Song[];
}

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

/**
 * 팀 콘티 목록. withSongs=false 이면 곡 행을 따로 불러오지 않습니다
 * (콘티·악보·곡 보관함 화면은 곡 목록을 따로 받아 song_order 로 다시 맞추므로 필요 없음).
 */
export async function getSetlistsByTeam(teamId: string, { withSongs = true }: { withSongs?: boolean } = {}): Promise<SetlistWithSongs[]> {
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

    if (!withSongs) return setlists.map((setlist) => ({ ...setlist, songs: [] }));

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
