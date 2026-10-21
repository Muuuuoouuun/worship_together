import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/server/viewer';
import { can } from '@/lib/permissions';
import LiveStart from '@/components/live/LiveStart';

export const metadata: Metadata = { title: '예배 시작', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * 콘티에서 '예배 시작' 을 누르면 오는 곳.
 * 진행 중인 예배가 있으면 그 예배로 들어가고, 없으면 시작 권한이 있는 사람은 확인 후 시작, 없는 사람은 시작을 기다립니다.
 */
export default async function LiveStartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const team = typeof params.team === 'string' ? params.team : undefined;
    const setlist = typeof params.setlist === 'string' && params.setlist ? params.setlist : null;
    const viewer = await getViewer(team);
    if (!viewer) {
        const back = `/live/start?${new URLSearchParams({ ...(team ? { team } : {}), ...(setlist ? { setlist } : {}) })}`;
        redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
    }
    if (!viewer.team || !viewer.member) redirect('/welcome?step=team');
    return (
        <LiveStart
            teamId={viewer.team.id}
            teamName={viewer.team.name}
            teamIds={viewer.teams.map((item) => item.id)}
            setlistId={setlist}
            canRun={can(viewer.member, viewer.policy, 'sessionRun')}
            leaders={viewer.team.members.filter((member) => !member.userId.startsWith('direct-') && can(member, viewer.policy, 'sessionRun')).map((member) => member.name)}
        />
    );
}
