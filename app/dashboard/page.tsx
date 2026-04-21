import type { ComponentType } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import NextWorshipCard from '@/components/dashboard/NextWorshipCard';
import SetlistSummary from '@/components/dashboard/SetlistSummary';
import QuickActions from '@/components/dashboard/QuickActions';
import TeamPreparationStatus, {
    type LeaderFollowUpItem,
    type PreparationCheckKey,
    type TeamPreparationMember,
    type WorshipPreparationBrief,
} from '@/components/dashboard/TeamPreparationStatus';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import { DEMO_TEAM_ID } from '@/lib/constants';
import {
    getUpcomingSetlist,
    getCurrentSession,
    getServicePreparationBySetlist,
    type ServicePreparationBundle,
    type ServiceAssignmentWithDetails,
} from '@/lib/data';
import {
    ArrowRight,
    BadgeCheck,
    HandHeart,
    HeartHandshake,
    MessageCircle,
    Music2,
    UsersRound,
} from 'lucide-react';

export default async function DashboardPage() {
    const [upcomingSetlist, currentSession] = await Promise.all([
        getUpcomingSetlist(DEMO_TEAM_ID),
        getCurrentSession(DEMO_TEAM_ID),
    ]);
    const preparationBundle = upcomingSetlist?.id
        ? await getServicePreparationBySetlist(DEMO_TEAM_ID, upcomingSetlist.id)
        : null;

    const worshipDate = upcomingSetlist ? new Date(upcomingSetlist.worship_date) : new Date();
    const theme = upcomingSetlist?.theme || 'General Worship';
    const songs = upcomingSetlist?.songs || [];
    const setlistId = upcomingSetlist?.id || '';
    const worshipDateLabel = upcomingSetlist
        ? worshipDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })
        : 'Not scheduled';

    return (
        <DashboardLayout currentPath="/dashboard">
            <MeshBackground />
            <div className="mx-auto flex max-w-7xl flex-col gap-10">
                <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <GlassCard className="overflow-hidden border-primary/10 bg-primary p-0 text-surface">
                        <div className="grid min-h-[22rem] gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                            <div>
                                <span className="inline-flex rounded-md bg-surface/10 px-3 py-1 text-xs font-bold uppercase text-surface/75">
                                    Today in Community
                                </span>
                                <h1 className="mt-5 max-w-3xl text-4xl font-serif font-black leading-tight md:text-6xl">
                                    Worship is one doorway into the life of the church.
                                </h1>
                                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-surface/75 md:text-base">
                                    Join the service, respond to prayer and care, serve where help is needed, or find a smaller group to belong to this week.
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                <Link
                                    href={currentSession ? `/session/${currentSession.id}` : '/community'}
                                    className="flex items-center justify-between rounded-md bg-surface p-4 text-primary transition hover:scale-[1.01]"
                                >
                                    <div>
                                        <p className="text-xs font-bold uppercase text-primary/45">
                                            My next step
                                        </p>
                                        <p className="mt-2 font-serif text-xl font-bold">
                                            {currentSession ? 'Join live worship' : 'Open community center'}
                                        </p>
                                    </div>
                                    <ArrowRight size={18} />
                                </Link>
                                <div className="rounded-md border border-surface/15 bg-surface/10 p-4">
                                    <p className="text-xs font-bold uppercase text-surface/55">
                                        Worship focus
                                    </p>
                                    <p className="mt-2 text-lg font-semibold">{theme}</p>
                                    <p className="mt-1 text-sm text-surface/65">{worshipDateLabel}</p>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <PulseCard
                            icon={Music2}
                            label="Worship"
                            value={currentSession ? 'Live now' : upcomingSetlist ? 'Upcoming' : 'Planning'}
                            detail={upcomingSetlist ? `${songs.length} songs prepared` : 'Create a setlist to unlock live mode'}
                        />
                        <PulseCard
                            icon={HandHeart}
                            label="Prayer & care"
                            value="Needs queue"
                            detail="Privacy and leader ownership are ready to shape the MVP."
                        />
                        <PulseCard
                            icon={BadgeCheck}
                            label="Serving"
                            value="Open roles"
                            detail="Volunteer needs now have a dedicated route and dashboard presence."
                        />
                        <PulseCard
                            icon={UsersRound}
                            label="Groups"
                            value="Next gathering"
                            detail="Newcomer and fellowship paths are discoverable from today."
                        />
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="space-y-6">
                        {upcomingSetlist ? (
                            <NextWorshipCard
                                worshipDate={worshipDate}
                                theme={theme}
                                songCount={songs.length}
                                teamId={DEMO_TEAM_ID}
                                setlistId={setlistId}
                                sessionId={currentSession?.id}
                            />
                        ) : (
                            <GlassCard className="border-dashed border-primary/20 bg-white/55 p-8 text-center text-primary/60">
                                <h2 className="mb-2 text-2xl font-serif font-bold text-primary">No Upcoming Worship</h2>
                                <p>Schedule a service to connect worship, care, and follow-up here.</p>
                            </GlassCard>
                        )}
                        <SetlistSummary songs={songs} />
                    </div>

                    <div className="space-y-6">
                        <GlassCard className="border-primary/10 bg-white/65">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase text-primary/35">My next step</p>
                                    <h2 className="mt-3 text-3xl font-serif font-black text-primary">
                                        Respond to one community moment.
                                    </h2>
                                    <p className="mt-3 text-sm leading-relaxed text-primary/60">
                                        The first pass keeps the choice simple: worship, prayer, serving, or a group. Personalization can decide the primary action later.
                                    </p>
                                </div>
                                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary sm:flex">
                                    <HeartHandshake size={22} />
                                </div>
                            </div>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <CommunityAction href="/care" icon={MessageCircle} label="Request care" />
                                <CommunityAction href="/serve" icon={BadgeCheck} label="Serve" />
                                <CommunityAction href="/groups" icon={UsersRound} label="Find group" />
                            </div>
                        </GlassCard>

                        <TeamPreparationStatus
                            brief={buildPreparationBrief(preparationBundle, theme)}
                            leaderQueue={buildLeaderQueue(preparationBundle)}
                            members={buildPreparationMembers(preparationBundle)}
                            teamId={DEMO_TEAM_ID}
                        />

                        <QuickActions
                            teamId={DEMO_TEAM_ID}
                            setlistId={upcomingSetlist?.id}
                            sessionId={currentSession?.id}
                        />
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
}

const readinessCheckKeys = ['notice', 'setlist', 'practice', 'serviceNotes'] as const satisfies PreparationCheckKey[];
const readinessCheckLabels: Record<PreparationCheckKey, string> = {
    notice: 'Notice',
    setlist: 'Setlist',
    practice: 'Practice',
    serviceNotes: 'Notes',
};

function buildPreparationBrief(
    bundle: ServicePreparationBundle | null,
    fallbackTheme: string
): Partial<WorshipPreparationBrief> | undefined {
    if (!bundle?.servicePreparation) {
        return undefined;
    }

    const { servicePreparation, setlist } = bundle;

    return {
        serviceTitle: `${setlist?.title ?? 'Worship'} preparation`,
        theme: setlist?.theme ?? fallbackTheme,
        scripture: servicePreparation.scripture_reference ?? 'Scripture not added yet',
        prayerFocus: servicePreparation.prayer_focus ?? servicePreparation.brief ?? 'Prayer focus not added yet.',
        worshipFlow: servicePreparation.worship_flow ?? servicePreparation.brief ?? 'Worship flow notes are still being prepared.',
        leaderNote: servicePreparation.leader_notes ?? servicePreparation.announcement ?? 'No leader note yet.',
        rehearsalTime: servicePreparation.rehearsal_time ?? 'Rehearsal time not set',
        callTime: servicePreparation.call_time ?? servicePreparation.call_time_notes ?? 'Call time not set',
        serviceNotes: servicePreparation.announcement ?? servicePreparation.call_time_notes ?? 'No service notes yet.',
    };
}

function buildPreparationMembers(
    bundle: ServicePreparationBundle | null
): TeamPreparationMember[] | undefined {
    if (!bundle?.assignments.length) {
        return undefined;
    }

    return bundle.assignments.map((assignment) => {
        const checks = buildCheckMap(assignment);
        const isReady = readinessCheckKeys.every((key) => checks[key]);
        const hasHelp = Boolean(assignment.needs_help_note?.trim());

        return {
            checks,
            name: assignment.profile?.username ?? assignment.role,
            note: buildMemberNote(assignment, checks),
            role: assignment.instrument ? `${assignment.role} | ${assignment.instrument}` : assignment.role,
            serviceAssignmentId: assignment.id,
            status: hasHelp ? 'needs-help' : isReady ? 'ready' : 'pending',
            updatedAt: formatUpdatedAt(assignment.updated_at),
        };
    });
}

function buildLeaderQueue(
    bundle: ServicePreparationBundle | null
): LeaderFollowUpItem[] | undefined {
    const members = buildPreparationMembers(bundle);

    if (!bundle?.assignments.length || !members) {
        return undefined;
    }

    return bundle.assignments.reduce<LeaderFollowUpItem[]>((queue, assignment, index) => {
        const member = members[index];

        if (!member || member.status === 'ready') {
            return queue;
        }

        const missingLabels = readinessCheckKeys
            .filter((key) => !member.checks[key])
            .map((key) => readinessCheckLabels[key]);
        const needsHelp = member.status === 'needs-help';

        queue.push({
            memberName: member.name,
            nextStep: needsHelp
                ? 'Send a personal follow-up and resolve the open preparation question.'
                : 'Ask for a quick confirmation before rehearsal starts.',
            priority: needsHelp ? 'high' : 'medium',
            reason: assignment.needs_help_note?.trim()
                || (missingLabels.length > 0 ? `Pending checks: ${missingLabels.join(', ')}` : member.note),
            role: member.role,
            status: needsHelp ? 'needs-help' : 'pending',
        });

        return queue;
    }, []);
}

function buildCheckMap(assignment: ServiceAssignmentWithDetails): Record<PreparationCheckKey, boolean> {
    return readinessCheckKeys.reduce((checks, key) => {
        const match = assignment.readinessChecks.find((check) => check.check_key === key);

        return {
            ...checks,
            [key]: Boolean(match?.is_complete),
        };
    }, {} as Record<PreparationCheckKey, boolean>);
}

function buildMemberNote(
    assignment: ServiceAssignmentWithDetails,
    checks: Record<PreparationCheckKey, boolean>
): string {
    if (assignment.needs_help_note?.trim()) {
        return assignment.needs_help_note;
    }

    const missingLabels = readinessCheckKeys
        .filter((key) => !checks[key])
        .map((key) => readinessCheckLabels[key]);

    if (missingLabels.length > 0) {
        return `Still needs: ${missingLabels.join(', ')}.`;
    }

    return assignment.is_confirmed
        ? 'Confirmed and ready for rehearsal.'
        : 'Readiness checks are complete; service confirmation is still pending.';
}

function formatUpdatedAt(value: string | null): string {
    if (!value) {
        return 'Not updated';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Updated';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

function PulseCard({
    detail,
    icon: Icon,
    label,
    value,
}: {
    detail: string;
    icon: ComponentType<{ size?: number }>;
    label: string;
    value: string;
}) {
    return (
        <GlassCard className="border-primary/10 bg-white/60 p-5">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary/60">
                    <Icon size={18} />
                </div>
                <div>
                    <p className="text-[11px] font-bold uppercase text-primary/35">{label}</p>
                    <p className="mt-1 text-lg font-serif font-bold text-primary">{value}</p>
                    <p className="mt-1 text-sm leading-relaxed text-primary/55">{detail}</p>
                </div>
            </div>
        </GlassCard>
    );
}

function CommunityAction({
    href,
    icon: Icon,
    label,
}: {
    href: string;
    icon: ComponentType<{ size?: number }>;
    label: string;
}) {
    return (
        <Link
            href={href}
            className="flex items-center justify-center gap-2 rounded-md border border-primary/10 bg-white/75 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white"
        >
            <Icon size={16} />
            {label}
        </Link>
    );
}
