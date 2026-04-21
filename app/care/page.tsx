import CommunityRoutePage from '@/components/community/CommunityRoutePage';
import { ClipboardList, HandHeart, MessageCircle, ShieldCheck } from 'lucide-react';

export default function CarePage() {
    return (
        <CommunityRoutePage
            currentPath="/care"
            eyebrow="Prayer & Care"
            title="Ask for prayer and help without wondering who will see it."
            description="Care workflows need trust first: privacy, urgency, and follow-up ownership should be visible before a person shares something sensitive."
            primaryAction={{ href: '#request', label: 'Start a care request' }}
            secondaryAction={{ href: '/community', label: 'Back to community' }}
            metrics={[
                {
                    label: 'Privacy',
                    value: '4 levels',
                    detail: 'Private, leaders, group, or church-visible requests.',
                },
                {
                    label: 'Response',
                    value: '< 24h',
                    detail: 'A clear first-response target for urgent care needs.',
                },
                {
                    label: 'Queue',
                    value: 'Open',
                    detail: 'Leader-facing follow-up work will live here next.',
                },
            ]}
            sections={[
                {
                    icon: ShieldCheck,
                    title: 'Request boundaries',
                    description: 'People should know exactly where their request goes.',
                    items: ['Pick a visibility level before submitting', 'Flag urgent pastoral attention', 'Invite follow-up without public exposure'],
                },
                {
                    icon: HandHeart,
                    title: 'Respond with care',
                    description: 'Members and leaders need practical response actions.',
                    items: ['Pray for someone', 'Offer a meal, ride, or visit', 'Mark follow-up as complete'],
                },
                {
                    icon: ClipboardList,
                    title: 'Leader triage',
                    description: 'Care should not depend on memory or scattered messages.',
                    items: ['Assign an owner', 'Track status', 'See unresolved requests first'],
                },
                {
                    icon: MessageCircle,
                    title: 'Gentle language',
                    description: 'The interface should lower pressure while staying spiritually grounded.',
                    items: ['Use pastoral wording', 'Avoid public-feed mechanics', 'Keep the next step calm and concrete'],
                },
            ]}
        />
    );
}
