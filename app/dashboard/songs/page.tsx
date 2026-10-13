import type { Metadata } from 'next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LiveContiWorkspace from '@/components/conti/LiveContiWorkspace';
import { resolveScreen } from '@/components/conti/model';
import { getCurrentUser } from '@/lib/auth';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { getTeamRepository } from '@/lib/server/teams';
import { supabase } from '@/lib/supabase';

export const metadata: Metadata = {
    title: '콘티·악보',
};

interface SongsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SongsPage({ searchParams }: SongsPageProps) {
    const params = await searchParams;
    const tab = typeof params.tab === 'string' ? params.tab : '';
    const setlist = typeof params.setlist === 'string' && params.setlist ? params.setlist : undefined;
    const team = typeof params.team === 'string' && params.team ? params.team : undefined;
    const { screen, setlistId } = resolveScreen(tab, setlist);

    // 곡 보관함과 같은 데이터를 같은 규칙으로 읽습니다.
    const [songs, setlists, user] = await Promise.all([getSongsByTeam(DEMO_TEAM_ID), getSetlistsByTeam(DEMO_TEAM_ID), getCurrentUser()]);
    const onlineTeams = user ? getTeamRepository().list(user.id).map((item) => ({ id: item.id, name: item.name })) : [];

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <LiveContiWorkspace
                initialSongs={songs}
                initialSetlists={setlists.map(({ songs: _songs, ...row }) => {
                    void _songs;
                    return row;
                })}
                hasBackend={Boolean(supabase)}
                onlineTeams={onlineTeams}
                onlineTeamId={team}
                viewerName={user?.name ?? null}
                viewerId={user?.id ?? null}
                initialScreen={screen}
                initialSetlistId={setlistId}
            />
        </DashboardLayout>
    );
}
