import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { BookOpen, CalendarDays, UserPlus, UsersRound } from 'lucide-react';

export default function GroupsPage() {
    return (
        <CommunityRoutePage
            currentPath="/groups"
            eyebrow="Groups & Fellowship"
            title="Help people find a smaller room inside the church."
            description="Groups give newcomers and members a relational next step after worship, care, or serving. This route frames the future group discovery flow."
            primaryAction={{ href: '#newcomer', label: 'Start newcomer path' }}
            secondaryAction={{ href: '/community', label: 'Community center' }}
            metrics={[
                {
                    label: 'Groups',
                    value: '8 sample',
                    detail: 'Bible study, prayer, fellowship, and ministry teams.',
                },
                {
                    label: 'Next meet',
                    value: 'Wed',
                    detail: 'The route should prioritize what someone can join soon.',
                },
                {
                    label: 'Newcomer',
                    value: 'Step 1',
                    detail: 'A gentle path for people who are not ready to commit.',
                },
            ]}
            sections={[
                {
                    icon: UsersRound,
                    title: 'Small groups',
                    description: 'Show people-centered gatherings rather than only calendar events.',
                    items: ['Bible study', 'Young adults', 'Family fellowship'],
                },
                {
                    icon: UserPlus,
                    title: 'Newcomer path',
                    description: 'Offer a low-pressure sequence for first-time visitors.',
                    items: ['Meet a host', 'Ask a question', 'Choose a next gathering'],
                },
                {
                    icon: BookOpen,
                    title: 'Discipleship',
                    description: 'Connect sermon reflection with learning and accountability.',
                    items: ['Message reflection', 'Class sign-up', 'Reading plan'],
                },
                {
                    icon: CalendarDays,
                    title: 'Fellowship events',
                    description: 'Make near-term gatherings easy to discover from the dashboard.',
                    items: ['Community meal', 'Prayer night', 'Testimony evening'],
                },
            ]}
        />
    );
}
