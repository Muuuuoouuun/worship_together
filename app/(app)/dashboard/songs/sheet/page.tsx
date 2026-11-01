import type { Metadata } from 'next';
import PageHeader from '@/components/ui/PageHeader';
import SheetPrep from '@/components/sheets/SheetPrep';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSongsByTeam } from '@/lib/data';
import { can } from '@/lib/permissions';
import { getViewer } from '@/lib/server/viewer';

export const metadata: Metadata = { title: '악보 준비' };

/** 곡 하나의 악보를 올리고 표시 · 메모를 하는 곳. 예배 중 화면의 '악보' 가 여기서 공유한 악보를 보여 줍니다. */
export default async function SheetPrepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const song = typeof params.song === 'string' ? params.song : null;
    const [viewer, demoSongs] = await Promise.all([getViewer(typeof params.team === 'string' ? params.team : undefined), getSongsByTeam(DEMO_TEAM_ID)]);
    return (
        <div className="space-y-6">
            <PageHeader back={{ href: '/dashboard/songs/library', label: '곡 보관함' }} title="악보 준비" description="악보를 올리고 표시 · 메모해요. 공유한 악보는 예배 중 화면의 '악보' 에 보여요." />
            <SheetPrep
                initialSongId={song}
                onlineTeamId={viewer?.team?.id ?? null}
                canShare={viewer?.member ? can(viewer.member, viewer.policy, 'contiEdit') : true}
                demoSongs={demoSongs.map((item) => ({ id: item.id, title: item.title }))}
            />
        </div>
    );
}
