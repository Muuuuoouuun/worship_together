import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { CalendarDays, HandHeart, HeartHandshake, Music2, UsersRound } from 'lucide-react';

export default function CommunityPage() {
    return (
        <CommunityRoutePage
            currentPath="/community"
            eyebrow="Community Center"
            title="One place for worship, care, serving, and belonging."
            description="See what is happening in the church today, choose a meaningful next step, and help leaders notice the people and needs that deserve attention."
            primaryAction={{ href: '/care', label: 'Ask for prayer' }}
            secondaryAction={{ href: '/serve', label: 'Find a place to serve' }}
            metrics={[
                {
                    label: 'Today',
                    value: '4 paths',
                    detail: 'Worship, prayer, serving, and groups stay visible together.',
                },
                {
                    label: 'Care',
                    value: '24h',
                    detail: 'Requests are designed around quick first response.',
                },
                {
                    label: 'Next step',
                    value: '1 action',
                    detail: 'The dashboard should point each person toward one clear action.',
                },
            ]}
            sections={[
                {
                    icon: Music2,
                    title: 'Worship with the church',
                    description: 'Keep the existing live worship workflow close at hand.',
                    items: ['Join an active worship session', 'Review the upcoming setlist', 'Move from worship into reflection'],
                    href: '/dashboard',
                    actionLabel: 'Open today',
                },
                {
                    icon: HandHeart,
                    title: 'Prayer and care',
                    description: 'Make it easier to ask for help and easier for leaders to respond.',
                    items: ['Choose a privacy level', 'Mark urgency clearly', 'Track pastoral follow-up'],
                    href: '/care',
                    actionLabel: 'Open care',
                },
                {
                    icon: HeartHandshake,
                    title: 'Serve this week',
                    description: 'Turn broad volunteer interest into concrete ministry commitments.',
                    items: ['See open ministry needs', 'Confirm a serving slot', 'Know preparation details'],
                    href: '/serve',
                    actionLabel: 'Open serving',
                },
                {
                    icon: UsersRound,
                    title: 'Groups and fellowship',
                    description: 'Give newcomers and members a lower-pressure path into relationship.',
                    items: ['Join a small group', 'Find newcomer gatherings', 'Follow up after worship'],
                    href: '/groups',
                    actionLabel: 'Open groups',
                },
                {
                    icon: CalendarDays,
                    title: 'Community rhythm',
                    description: 'Help leaders see what needs attention before the week gets noisy.',
                    items: ['Upcoming church moments', 'Unread follow-ups', 'Open care tasks'],
                },
                {
                    icon: HeartHandshake,
                    title: 'Belonging loop',
                    description: 'Every visit should lead to worship, care, service, fellowship, or reflection.',
                    items: ['One primary action per person', 'Clear pastoral boundaries', 'Simple ways to return'],
                },
            ]}
        />
    );
}
