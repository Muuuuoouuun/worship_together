import SessionWorkspace from '@/components/session/SessionWorkspace';
import { getSessionDetail } from '@/lib/data';
import { notFound } from 'next/navigation';

interface SessionPageProps {
    params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
    const { id } = await params;
    const sessionDetail = await getSessionDetail(id);

    if (!sessionDetail) {
        notFound();
    }

    const { currentState, session, songs, setlist, team } = sessionDetail;

    if (!session.team_id) {
        notFound();
    }

    const worshipDateLabel = setlist
        ? new Date(setlist.worship_date).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
        : '일정 미정';

    return (
        <SessionWorkspace
            session={session}
            songs={songs}
            teamId={session.team_id}
            initialState={currentState}
            teamName={team?.name ?? '예배팀'}
            setlistTitle={setlist?.title ?? '라이브 세션'}
            worshipDateLabel={worshipDateLabel}
            theme={setlist?.theme ?? null}
        />
    );
}
