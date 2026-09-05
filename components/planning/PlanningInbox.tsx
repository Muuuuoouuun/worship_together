import { getCurrentUser } from '@/lib/auth';
import PlanningInboxBadge from './PlanningInboxBadge';

export default async function PlanningInbox() {
    const user = await getCurrentUser();
    return user ? <PlanningInboxBadge key={user.id} /> : null;
}
