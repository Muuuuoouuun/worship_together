import WorshipHome from '@/components/dashboard/WorshipHome';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getCurrentSession } from '@/lib/data';

export default async function DashboardPage() {
    const currentSession = await getCurrentSession(DEMO_TEAM_ID);

    return (
        <>
            <WorshipHome currentSessionId={currentSession?.id} />
        </>
    );
}
