import { getOnlineTeamName } from '@/lib/server/teams';
import ClientSessionLoader from '@/components/session/ClientSessionLoader';
import { getSessionDetail } from '@/lib/data';
import { notFound } from 'next/navigation';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ setlist?: string; team?: string }>;
};

export default async function SessionPage({ params, searchParams }: PageProps) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const detail = await getSessionDetail(id);
    if (!detail?.session.team_id) notFound();
    return <ClientSessionLoader onlineTeamName={await getOnlineTeamName(query.team)} detail={detail} setlistId={typeof query.setlist === 'string' ? query.setlist : undefined} requestedTeamId={typeof query.team === 'string' ? query.team : undefined} />;
}
