import WorshipTeamMode from '@/components/session/WorshipTeamMode';
import { getSessionDetail } from '@/lib/data';
import { notFound } from 'next/navigation';

interface WorshipTeamModePageProps {
    params: Promise<{ id: string }>;
}

export default async function WorshipTeamModePage({ params }: WorshipTeamModePageProps) {
    const { id } = await params;
    const sessionDetail = await getSessionDetail(id);

    if (!sessionDetail) {
        notFound();
    }

    const { currentState, session, songs, setlist, team } = sessionDetail;

    if (!session.team_id) {
        notFound();
    }

    return (
        <WorshipTeamMode
            session={session}
            songs={songs}
            teamId={session.team_id}
            initialState={currentState}
            teamName={team?.name ?? '예배팀'}
            setlistTitle={setlist?.title ?? '라이브 세션'}
        />
    );
}
