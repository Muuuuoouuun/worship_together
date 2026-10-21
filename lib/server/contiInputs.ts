import 'server-only';
import { getCurrentUser } from '@/lib/auth';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import type { LiveContiInputs } from '@/components/conti/useLiveContiData';
import { getTeamRepository } from './teams';

/** 페이지가 한 번에 넘겨줄 콘티 입력 (처음 보여줄 온라인 팀은 각 페이지가 주소에서 정합니다) */
export type LiveContiServerInputs = Omit<LiveContiInputs, 'onlineTeamId'>;

/**
 * 콘티·악보 화면(useLiveContiData)에 넘길 입력을 읽습니다.
 * 곡 보관함과 같은 데이터를 같은 규칙으로 읽습니다.
 */
export async function getLiveContiInputs(): Promise<LiveContiServerInputs> {
    const [songs, setlists, user] = await Promise.all([getSongsByTeam(DEMO_TEAM_ID), getSetlistsByTeam(DEMO_TEAM_ID, { withSongs: false }), getCurrentUser()]);
    const onlineTeams = user ? getTeamRepository().list(user.id).map((item) => ({ id: item.id, name: item.name })) : [];
    return {
        initialSongs: songs.map((song) => ({ ...song, data_xml: null })),
        initialSetlists: setlists.map(({ songs: _songs, ...row }) => {
            void _songs;
            return row;
        }),
        hasBackend: Boolean(supabase),
        onlineTeams,
        viewerName: user?.name ?? null,
        viewerId: user?.id ?? null,
    };
}
