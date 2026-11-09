import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import PlanningInboxBadge from './PlanningInboxBadge';

export default async function PlanningInbox() {
    const user = await getCurrentUser();
    return user ? <Suspense fallback={null}><PlanningInboxBadge key={user.id} /></Suspense> : null;
}
