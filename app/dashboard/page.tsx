import DashboardLayout from '@/components/dashboard/DashboardLayout';
import WorshipHome from '@/components/dashboard/WorshipHome';
import MeshBackground from '@/components/ui/MeshBackground';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getCurrentSession } from '@/lib/data';

export default async function DashboardPage() {
    const currentSession = await getCurrentSession(DEMO_TEAM_ID);

    return (
        <DashboardLayout currentPath="/dashboard">
            <MeshBackground />
            <WorshipHome currentSessionId={currentSession?.id} />
        </DashboardLayout>
    );
}
