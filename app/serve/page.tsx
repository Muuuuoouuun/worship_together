import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { BadgeCheck, CalendarDays, CheckCircle2, ClipboardList } from 'lucide-react';

export default function ServePage() {
    return (
        <CommunityRoutePage
            currentPath="/serve"
            eyebrow="Serve This Week"
            title="Move from willingness to a confirmed ministry commitment."
            description="Serving should feel concrete: what is needed, when it happens, who owns it, and what someone should prepare before arriving."
            primaryAction={{ href: '#open-roles', label: 'View open roles' }}
            secondaryAction={{ href: '/groups', label: 'Find a team' }}
            metrics={[
                {
                    label: 'Needs',
                    value: '6 open',
                    detail: 'Sample ministry slots for the first UX pass.',
                },
                {
                    label: 'Commit',
                    value: '1 tap',
                    detail: 'Future sign-ups should confirm without extra coordination.',
                },
                {
                    label: 'Prep',
                    value: 'Clear',
                    detail: 'Every role should include arrival time and expectations.',
                },
            ]}
            sections={[
                {
                    icon: BadgeCheck,
                    title: 'Open ministry needs',
                    description: 'List concrete gaps instead of a vague call for volunteers.',
                    items: ['Welcome team for Sunday morning', 'Meal train support', 'Youth night setup'],
                },
                {
                    icon: CalendarDays,
                    title: 'Serving schedule',
                    description: 'Make the next date, arrival time, and owner obvious.',
                    items: ['Upcoming role calendar', 'Leader contact', 'Preparation notes'],
                },
                {
                    icon: CheckCircle2,
                    title: 'Commitment status',
                    description: 'People should know whether they are requested, confirmed, or waiting.',
                    items: ['Confirm availability', 'See pending requests', 'Track completed service'],
                },
                {
                    icon: ClipboardList,
                    title: 'Leader overview',
                    description: 'Ministry leads need the unanswered gaps surfaced first.',
                    items: ['Unfilled roles', 'Recently confirmed volunteers', 'Follow-up reminders'],
                },
            ]}
        />
    );
}
