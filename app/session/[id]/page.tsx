import { getOnlineTeamName } from '@/lib/server/teams';
import ClientSessionLoader from '@/components/session/ClientSessionLoader';
import { getSessionDetail } from '@/lib/data';
import { legacySessionAccess } from '@/lib/server/legacyAccess';
import { notFound } from 'next/navigation';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ setlist?: string; team?: string }>;
};

export default async function SessionPage({ params, searchParams }: PageProps) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    // 데모 세션은 누구나, 그 밖의 세션은 로그인한 그 팀의 팀원만 (아니면 찾을 수 없음)
    const detail = await getSessionDetail(id, await legacySessionAccess());
    if (!detail?.session.team_id) notFound();
    return <ClientSessionLoader onlineTeamName={await getOnlineTeamName(query.team)} detail={detail} setlistId={typeof query.setlist === 'string' ? query.setlist : undefined} requestedTeamId={typeof query.team === 'string' ? query.team : undefined} />;
}
