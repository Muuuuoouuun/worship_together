import 'server-only';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { can } from '@/lib/permissions';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import type { LiveContiInputs } from '@/components/conti/useLiveContiData';
import { getViewer } from './viewer';

/** 페이지가 한 번에 넘겨줄 콘티 입력. 온라인 팀은 지금 팀(팀 바꾸기 · ?team=)을 씁니다. */
export type LiveContiServerInputs = LiveContiInputs;

/**
 * 콘티·악보 화면(useLiveContiData)에 넘길 입력을 읽습니다.
 * 곡 보관함과 같은 데이터를 같은 규칙으로 읽습니다.
 */
export async function getLiveContiInputs(requestedTeamId?: string): Promise<LiveContiServerInputs> {
    const [songs, setlists, viewer] = await Promise.all([getSongsByTeam(DEMO_TEAM_ID), getSetlistsByTeam(DEMO_TEAM_ID, { withSongs: false }), getViewer(requestedTeamId)]);
    const onlineTeams = viewer ? viewer.teams.map((item) => ({ id: item.id, name: item.name })) : [];
    return {
        initialSongs: songs.map((song) => ({ ...song, data_xml: null })),
        initialSetlists: setlists.map(({ songs: _songs, ...row }) => {
            void _songs;
            return row;
        }),
        hasBackend: Boolean(supabase),
        onlineTeams,
        onlineTeamId: viewer?.team?.id,
        canEditConti: viewer?.member ? can(viewer.member, viewer.policy, 'contiEdit') : true,
        canRunSession: viewer?.member ? can(viewer.member, viewer.policy, 'sessionRun') : true,
        viewerName: viewer?.profile.name ?? null,
        viewerId: viewer?.user.id ?? null,
    };
}
