import React from 'react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import { ArrowRight, BadgeCheck, HandHeart, ListMusic, Mic2, Play, type LucideIcon } from 'lucide-react';
import { startSession } from '@/actions/sessionActions';

interface QuickActionsProps {
    teamId: string;
    setlistId?: string;
    sessionId?: string;
}

type BaseAction = {
    icon: LucideIcon;
    label: string;
    description: string;
    color: string;
    bg: string;
    status: string;
};

type LinkAction = BaseAction & {
    href: string;
    type?: never;
};

type SessionAction = BaseAction & {
    type: 'session';
    href?: never;
};

type StaticAction = BaseAction & {
    href?: never;
    type?: never;
};

const QuickActions: React.FC<QuickActionsProps> = ({ teamId, setlistId, sessionId }) => {
    const startSessionAction = setlistId
        ? startSession.bind(null, teamId, setlistId)
        : null;
    const actions: Array<LinkAction | SessionAction | StaticAction> = [
        {
            icon: ListMusic,
            label: 'Library',
            description: 'Create songs and schedule setlists.',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            href: '/dashboard/songs',
            status: 'Open',
        },
        {
            icon: HandHeart,
            label: 'Care Requests',
            description: 'Prayer, needs, and follow-up paths.',
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            href: '/care',
            status: 'Open',
        },
        {
            icon: Mic2,
            label: sessionId ? 'Join Live' : 'Start Live',
            description: sessionId
                ? 'Re-enter the active worship session.'
                : setlistId
                    ? 'Launch a synced worship session.'
                    : 'Create a setlist to unlock live mode.',
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            status: sessionId || setlistId ? 'Ready' : 'Blocked',
            type: 'session' as const,
        },
        {
            icon: BadgeCheck,
            label: 'Serve',
            description: 'Open roles and ministry commitments.',
            color: 'text-sky-600',
            bg: 'bg-sky-500/10',
            href: '/serve',
            status: 'Open',
        },
    ];

    return (
        <div className="w-full">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-serif font-bold text-primary">
                <Play className="fill-secondary text-secondary" size={20} />
                Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {actions.map((action) => {
                    if (hasHref(action)) {
                        return (
                            <Link key={action.label} href={action.href} className="block h-full">
                                <GlassCard
                                    variant="light"
                                    className="flex h-full flex-col gap-3 p-6 transition-all hover:scale-[1.02] hover:bg-white/80"
                                >
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.bg} ${action.color}`}>
                                        <action.icon size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-primary">{action.label}</span>
                                            <ArrowRight size={16} className="text-primary/40" />
                                        </div>
                                        <p className="text-xs leading-relaxed text-primary/50">{action.description}</p>
                                    </div>
                                </GlassCard>
                            </Link>
                        );
                    }

                    if (action.type === 'session' && sessionId) {
                        return (
                            <Link key={action.label} href={`/session/${sessionId}`} className="block h-full">
                                <GlassCard
                                    variant="light"
                                    className="flex h-full flex-col gap-3 p-6 transition-all hover:scale-[1.02] hover:bg-white/80"
                                >
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.bg} ${action.color}`}>
                                        <action.icon size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-primary">{action.label}</span>
                                            <ArrowRight size={16} className="text-primary/40" />
                                        </div>
                                        <p className="text-xs leading-relaxed text-primary/50">{action.description}</p>
                                    </div>
                                </GlassCard>
                            </Link>
                        );
                    }

                    if (action.type === 'session' && startSessionAction) {
                        return (
                            <form key={action.label} action={startSessionAction}>
                                <button type="submit" className="h-full w-full text-left">
                                    <GlassCard
                                        variant="light"
                                        className="flex h-full flex-col gap-3 p-6 transition-all hover:scale-[1.02] hover:bg-white/80"
                                    >
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.bg} ${action.color}`}>
                                            <action.icon size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold text-primary">{action.label}</span>
                                                <span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/50">
                                                    {action.status}
                                                </span>
                                            </div>
                                            <p className="text-xs leading-relaxed text-primary/50">{action.description}</p>
                                        </div>
                                    </GlassCard>
                                </button>
                            </form>
                        );
                    }

                    return (
                        <GlassCard
                            key={action.label}
                            variant="light"
                            className="flex h-full flex-col gap-3 border-dashed p-6 transition-all hover:bg-white/80"
                        >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.bg} ${action.color}`}>
                                <action.icon size={24} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-primary">{action.label}</span>
                                    <span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/50">
                                        {action.status}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-primary/50">{action.description}</p>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickActions;

function hasHref(action: LinkAction | SessionAction | StaticAction): action is LinkAction {
    return typeof action.href === 'string';
}
