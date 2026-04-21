'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toggleServiceReadinessCheck } from '@/actions/preparationActions';
import GlassCard from '@/components/ui/GlassCard';
import {
    AlertCircle,
    CheckCircle2,
    CircleDashed,
    ClipboardCheck,
    FileText,
    HelpCircle,
    Music2,
    UserRoundCheck,
} from 'lucide-react';

export type PreparationCheckKey = 'notice' | 'setlist' | 'practice' | 'serviceNotes';
export type ReadinessFilter = 'all' | 'pending' | 'help' | 'ready';
export type TeamReadinessStatus = 'ready' | 'pending' | 'needs-help' | 'reviewing';

export interface PreparationCheck {
    key: PreparationCheckKey;
    label: string;
    shortLabel: string;
    description: string;
}

export interface TeamPreparationMember {
    checks: Record<PreparationCheckKey, boolean>;
    name: string;
    note: string;
    role: string;
    serviceAssignmentId?: string;
    status: TeamReadinessStatus;
    updatedAt: string;
}

export interface LeaderFollowUpItem {
    memberName: string;
    nextStep: string;
    priority?: 'high' | 'medium' | 'low';
    reason: string;
    role: string;
    status: Exclude<TeamReadinessStatus, 'reviewing'>;
}

export interface WorshipPreparationBrief {
    callTime: string;
    leaderNote: string;
    prayerFocus: string;
    rehearsalTime: string;
    serviceNotes: string;
    serviceTitle: string;
    scripture: string;
    theme: string;
    worshipFlow: string;
}

export interface TeamPreparationStatusProps {
    brief?: Partial<WorshipPreparationBrief>;
    className?: string;
    initialFilter?: ReadinessFilter;
    leaderQueue?: LeaderFollowUpItem[];
    members?: TeamPreparationMember[];
    teamId?: string;
}

const preparationChecks: PreparationCheck[] = [
    {
        key: 'notice',
        label: 'Notice read',
        shortLabel: 'Notice',
        description: 'Leader announcement and rehearsal details reviewed.',
    },
    {
        key: 'setlist',
        label: 'Setlist reviewed',
        shortLabel: 'Setlist',
        description: 'Song order, keys, flow, and transitions reviewed.',
    },
    {
        key: 'practice',
        label: 'Practice ready',
        shortLabel: 'Practice',
        description: 'Personal preparation is ready for rehearsal.',
    },
    {
        key: 'serviceNotes',
        label: 'Service notes',
        shortLabel: 'Notes',
        description: 'Prayer focus, special cues, and service notes checked.',
    },
];

const defaultBrief: WorshipPreparationBrief = {
    serviceTitle: 'Sunday Worship Preparation',
    theme: 'Grace for the week ahead',
    scripture: 'Psalm 95:1-7',
    prayerFocus: 'Prepare hearts to sing with joy and humility',
    worshipFlow: 'Open with thanksgiving, move into reflection, and end with a clear sending moment.',
    leaderNote: 'Leave room for prayer after the second song and keep the bridge cue gentle.',
    rehearsalTime: 'Saturday 7:00 PM',
    callTime: 'Sunday 8:30 AM',
    serviceNotes: 'Final key locked, lyrics updated, and prayer team joins after rehearsal.',
};

const defaultMembers: TeamPreparationMember[] = [
    {
        name: 'Grace Kim',
        role: 'Worship leader',
        status: 'ready',
        updatedAt: '12m ago',
        note: 'Ready to lead opening prayer and bridge cue.',
        checks: {
            notice: true,
            setlist: true,
            practice: true,
            serviceNotes: true,
        },
    },
    {
        name: 'Daniel Park',
        role: 'Keys',
        status: 'ready',
        updatedAt: '18m ago',
        note: 'Will follow the Pad A preset for the first two songs.',
        checks: {
            notice: true,
            setlist: true,
            practice: true,
            serviceNotes: true,
        },
    },
    {
        name: 'Hannah Lee',
        role: 'Vocal',
        status: 'pending',
        updatedAt: '31m ago',
        note: 'Reviewing harmony entry after the second chorus.',
        checks: {
            notice: true,
            setlist: true,
            practice: false,
            serviceNotes: true,
        },
    },
    {
        name: 'Joseph Choi',
        role: 'Drums',
        status: 'needs-help',
        updatedAt: '44m ago',
        note: 'Needs the final ending count confirmed before rehearsal.',
        checks: {
            notice: true,
            setlist: false,
            practice: true,
            serviceNotes: false,
        },
    },
    {
        name: 'Mina Jung',
        role: 'Slides',
        status: 'pending',
        updatedAt: '1h ago',
        note: 'Waiting for the final scripture reading text.',
        checks: {
            notice: true,
            setlist: true,
            practice: false,
            serviceNotes: false,
        },
    },
];

const defaultLeaderQueue: LeaderFollowUpItem[] = [
    {
        memberName: 'Joseph Choi',
        role: 'Drums',
        status: 'needs-help',
        reason: 'Final ending count and service note confirmation are still missing.',
        nextStep: 'Send the count-in and confirm the ending cue before rehearsal.',
        priority: 'high',
    },
    {
        memberName: 'Hannah Lee',
        role: 'Vocal',
        status: 'pending',
        reason: 'Practice check is incomplete and harmony entry needs one more pass.',
        nextStep: 'Share the chorus cue and ask for a quick confirmation.',
        priority: 'medium',
    },
    {
        memberName: 'Mina Jung',
        role: 'Slides',
        status: 'pending',
        reason: 'Final scripture text has not been received yet.',
        nextStep: 'Send the verse copy and confirm slide timing.',
        priority: 'medium',
    },
];

const statusMeta: Record<
    Exclude<TeamReadinessStatus, 'reviewing'>,
    {
        badge: string;
        detail: string;
        icon: ReactNode;
        tone: string;
    }
> = {
    ready: {
        badge: 'Ready',
        detail: 'All prep checks are complete.',
        icon: <UserRoundCheck size={14} />,
        tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    },
    pending: {
        badge: 'Pending',
        detail: 'Member is still reviewing one or more items.',
        icon: <CircleDashed size={14} />,
        tone: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    },
    'needs-help': {
        badge: 'Needs help',
        detail: 'Leader follow-up is needed before rehearsal.',
        icon: <AlertCircle size={14} />,
        tone: 'border-red-500/20 bg-red-500/10 text-red-600',
    },
};

const filterMeta: Record<
    ReadinessFilter,
    {
        label: string;
        status: TeamReadinessStatus | 'all';
    }
> = {
    all: { label: 'All', status: 'all' },
    pending: { label: 'Pending', status: 'pending' },
    help: { label: 'Help', status: 'needs-help' },
    ready: { label: 'Ready', status: 'ready' },
};

export default function TeamPreparationStatus({
    brief: briefOverrides,
    className,
    initialFilter = 'all',
    leaderQueue: leaderQueueProp,
    members: membersProp,
    teamId,
}: TeamPreparationStatusProps = {}) {
    const router = useRouter();
    const [filter, setFilter] = useState<ReadinessFilter>(initialFilter);
    const [pendingCheckId, setPendingCheckId] = useState<string | null>(null);

    const brief = {
        ...defaultBrief,
        ...briefOverrides,
    };

    const members = membersProp ?? defaultMembers;
    const normalizedMembers = useMemo<
        Array<Omit<TeamPreparationMember, 'status'> & { status: Exclude<TeamReadinessStatus, 'reviewing'> }>
    >(
        () => members.map((member) => ({ ...member, status: normalizeStatus(member.status) })),
        [members]
    );
    const leaderQueue = leaderQueueProp ?? (membersProp === undefined ? defaultLeaderQueue : buildDefaultQueue(normalizedMembers));

    const counts = useMemo(() => {
        const ready = normalizedMembers.filter((member) => member.status === 'ready').length;
        const pending = normalizedMembers.filter((member) => member.status === 'pending').length;
        const help = normalizedMembers.filter((member) => member.status === 'needs-help').length;
        const totalChecks = normalizedMembers.length * preparationChecks.length;
        const completedChecks = normalizedMembers.reduce((sum, member) => {
            return sum + preparationChecks.filter((check) => member.checks[check.key]).length;
        }, 0);

        return {
            completedChecks,
            help,
            pending,
            ready,
            totalChecks,
        };
    }, [normalizedMembers]);

    const progress = counts.totalChecks > 0 ? Math.round((counts.completedChecks / counts.totalChecks) * 100) : 0;
    const readinessLabel = counts.help > 0 ? 'Leader follow-up needed' : counts.pending > 0 ? 'In progress' : 'Everyone ready';

    const visibleMembers = useMemo(() => {
        if (filter === 'all') {
            return normalizedMembers;
        }

        return normalizedMembers.filter((member) => member.status === filterMeta[filter].status);
    }, [filter, normalizedMembers]);

    const visibleQueue = useMemo(() => {
        if (filter === 'all') {
            return leaderQueue;
        }

        return leaderQueue.filter((item) => item.status === filterMeta[filter].status);
    }, [filter, leaderQueue]);

    const handleToggleCheck = (member: TeamPreparationMember, check: PreparationCheck) => {
        if (!teamId || !member.serviceAssignmentId || pendingCheckId) {
            return;
        }

        const nextPendingId = `${member.serviceAssignmentId}:${check.key}`;

        setPendingCheckId(nextPendingId);

        toggleServiceReadinessCheck({
            teamId,
            serviceAssignmentId: member.serviceAssignmentId,
            checkKey: check.key,
            label: check.label,
            isComplete: !member.checks[check.key],
        })
            .then(() => {
                router.refresh();
            })
            .catch((error) => {
                console.error('Failed to toggle readiness check:', error);
            })
            .finally(() => {
                setPendingCheckId(null);
            });
    };

    return (
        <GlassCard
            className={[
                'border-primary/10 bg-white/65',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                            <ClipboardCheck size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase text-primary/35">Team readiness</p>
                            <h2 className="mt-2 text-3xl font-serif font-black text-primary">
                                {brief.serviceTitle}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary/60">
                                Worship direction stays visible first, then readiness, then the people who need a gentle nudge before rehearsal.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 md:min-w-80">
                        <SummaryMetric
                            icon={<FileText size={15} />}
                            label="Ready"
                            value={String(counts.ready)}
                            tone="text-emerald-700"
                        />
                        <SummaryMetric
                            icon={<Music2 size={15} />}
                            label="Pending"
                            value={String(counts.pending)}
                            tone="text-amber-700"
                        />
                        <SummaryMetric
                            icon={<HelpCircle size={15} />}
                            label="Help"
                            value={String(counts.help)}
                            tone={counts.help > 0 ? 'text-red-600' : 'text-primary'}
                        />
                    </div>
                </header>

                <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-md border border-primary/10 bg-background/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase text-primary/35">Worship preparation brief</p>
                                <p className="mt-1 text-lg font-semibold text-primary">{brief.theme}</p>
                            </div>
                            <span className="rounded-full border border-primary/10 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/50">
                                {readinessLabel}
                            </span>
                        </div>

                        <p className="mt-4 text-sm leading-relaxed text-primary/60">{brief.worshipFlow}</p>

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                            <DetailItem label="Scripture" value={brief.scripture} />
                            <DetailItem label="Prayer focus" value={brief.prayerFocus} />
                            <DetailItem label="Rehearsal" value={brief.rehearsalTime} />
                            <DetailItem label="Call time" value={brief.callTime} />
                        </dl>

                        <div className="mt-4 rounded-md border border-primary/10 bg-white/60 p-3">
                            <p className="text-[11px] font-bold uppercase text-primary/35">Leader note</p>
                            <p className="mt-1 text-sm leading-relaxed text-primary/60">{brief.leaderNote}</p>
                        </div>
                        <div className="mt-3 rounded-md border border-primary/10 bg-white/60 p-3">
                            <p className="text-[11px] font-bold uppercase text-primary/35">Service notes</p>
                            <p className="mt-1 text-sm leading-relaxed text-primary/60">{brief.serviceNotes}</p>
                        </div>
                    </div>

                    <div className="rounded-md border border-primary/10 bg-white/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase text-primary/35">Readiness progress</p>
                                <p className="mt-1 text-3xl font-serif font-black text-primary">{progress}%</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold uppercase text-primary/35">Completed checks</p>
                                <p className="mt-1 text-lg font-semibold text-primary">
                                    {counts.completedChecks}/{counts.totalChecks || 0}
                                </p>
                            </div>
                        </div>

                        <div
                            aria-label={`Readiness progress ${progress}%`}
                            className="mt-4 h-2 overflow-hidden rounded-full bg-primary/8"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <TinyStat label="Ready" value={counts.ready} />
                            <TinyStat label="Pending" value={counts.pending} />
                            <TinyStat label="Help" value={counts.help} urgent={counts.help > 0} />
                        </div>

                        <div className="mt-4 grid gap-2">
                            {preparationChecks.map((check) => {
                                const completed = normalizedMembers.filter((member) => member.checks[check.key]).length;
                                const checkProgress = normalizedMembers.length
                                    ? Math.round((completed / normalizedMembers.length) * 100)
                                    : 0;

                                return (
                                    <div key={check.key}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-primary">{check.label}</p>
                                                <p className="text-xs leading-relaxed text-primary/45">{check.description}</p>
                                            </div>
                                            <span className="text-xs font-bold text-primary/55">
                                                {completed}/{normalizedMembers.length}
                                            </span>
                                        </div>
                                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/8">
                                            <div
                                                className="h-full rounded-full bg-primary/70"
                                                style={{ width: `${checkProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="flex flex-wrap items-center gap-2" aria-label="Readiness filters">
                    {(Object.keys(filterMeta) as ReadinessFilter[]).map((option) => {
                        const selected = option === filter;
                        const count = option === 'all'
                            ? normalizedMembers.length
                            : normalizedMembers.filter((member) => member.status === filterMeta[option].status).length;

                        return (
                            <button
                                key={option}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setFilter(option)}
                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 ${
                                    selected
                                        ? 'border-primary bg-primary text-surface shadow-sm'
                                        : 'border-primary/10 bg-white/70 text-primary/65 hover:bg-white hover:text-primary'
                                }`}
                            >
                                <span>{filterMeta[option].label}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${selected ? 'bg-white/15 text-white' : 'bg-primary/5 text-primary/50'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </section>

                <section className="overflow-hidden rounded-md border border-primary/10 bg-white/55">
                    <div className="grid grid-cols-[minmax(10rem,1.2fr)_repeat(4,minmax(4.4rem,0.5fr))_minmax(8rem,0.7fr)] gap-2 border-b border-primary/10 px-4 py-3 text-[11px] font-bold uppercase text-primary/35 max-lg:hidden">
                        <span>Member</span>
                        {preparationChecks.map((check) => (
                            <span key={check.key} className="text-center">
                                {check.shortLabel}
                            </span>
                        ))}
                        <span>Status</span>
                    </div>

                    <div className="divide-y divide-primary/10">
                        {visibleMembers.length > 0 ? (
                            visibleMembers.map((member) => {
                                const meta = statusMeta[member.status];

                                return (
                                    <div
                                        key={member.name}
                                        className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(10rem,1.2fr)_repeat(4,minmax(4.4rem,0.5fr))_minmax(8rem,0.7fr)] lg:items-center lg:gap-2"
                                    >
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/5 text-sm font-bold text-primary/65">
                                                {getInitials(member.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-sm font-semibold text-primary">{member.name}</p>
                                                    <span className="text-xs text-primary/35">{member.updatedAt}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold uppercase text-primary/35">{member.role}</p>
                                                <p className="mt-2 text-xs leading-relaxed text-primary/55 lg:max-w-md">
                                                    {member.note}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 lg:contents">
                                            {preparationChecks.map((check) => (
                                                <CheckCell
                                                    key={check.key}
                                                    checked={member.checks[check.key]}
                                                    disabled={Boolean(pendingCheckId)}
                                                    isPending={pendingCheckId === `${member.serviceAssignmentId}:${check.key}`}
                                                    label={check.shortLabel}
                                                    onToggle={
                                                        member.serviceAssignmentId && teamId
                                                            ? () => handleToggleCheck(member, check)
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </div>

                                        <div className="flex lg:justify-end">
                                            <span
                                                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${meta.tone}`}
                                                title={meta.detail}
                                            >
                                                {meta.icon}
                                                {meta.badge}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-4 py-8 text-sm text-primary/45">
                                No members match the selected filter.
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-md border border-primary/10 bg-background/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase text-primary/35">Leader follow-up queue</p>
                            <p className="mt-1 text-sm leading-relaxed text-primary/55">
                                Short, private next steps for the people who need a reply before rehearsal.
                            </p>
                        </div>
                        <span className="rounded-full border border-primary/10 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/50">
                            {visibleQueue.length} items
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {visibleQueue.length > 0 ? (
                            visibleQueue.map((item) => (
                                <div
                                    key={`${item.memberName}-${item.reason}`}
                                    className="flex flex-col gap-3 rounded-md border border-primary/10 bg-white/65 p-4 sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-primary">{item.memberName}</p>
                                            <span className="text-xs text-primary/35">{item.role}</span>
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                                    item.priority === 'high'
                                                        ? 'border-red-500/20 bg-red-500/10 text-red-600'
                                                        : item.priority === 'medium'
                                                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-700'
                                                            : 'border-primary/10 bg-primary/5 text-primary/45'
                                                }`}
                                            >
                                                {item.priority ?? 'low'}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm leading-relaxed text-primary/60">{item.reason}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-primary/45">{item.nextStep}</p>
                                    </div>

                                    <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border px-3 py-2 text-xs font-bold text-primary/60">
                                        {statusMeta[item.status].icon}
                                        {statusMeta[item.status].badge}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-md border border-dashed border-primary/10 bg-white/55 px-4 py-6 text-sm text-primary/45">
                                No follow-up items for this filter.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </GlassCard>
    );
}

function SummaryMetric({
    icon,
    label,
    tone,
    value,
}: {
    icon: ReactNode;
    label: string;
    tone: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-primary/10 bg-white/65 px-3 py-3">
            <div className={`flex items-center gap-2 text-[11px] font-bold uppercase ${tone}`}>
                {icon}
                {label}
            </div>
            <p className="mt-2 text-xl font-serif font-black text-primary">{value}</p>
        </div>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-primary/10 bg-white/55 px-3 py-3">
            <dt className="text-[11px] font-bold uppercase text-primary/35">{label}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-primary/60">{value}</dd>
        </div>
    );
}

function TinyStat({
    label,
    urgent = false,
    value,
}: {
    label: string;
    urgent?: boolean;
    value: number;
}) {
    return (
        <div
            className={`rounded-md border px-3 py-3 ${
                urgent ? 'border-red-500/20 bg-red-500/10 text-red-600' : 'border-primary/10 bg-white/65 text-primary'
            }`}
        >
            <p className="text-[11px] font-bold uppercase text-current/60">{label}</p>
            <p className="mt-1 text-lg font-serif font-black">{value}</p>
        </div>
    );
}

function CheckCell({
    checked,
    disabled = false,
    isPending = false,
    label,
    onToggle,
}: {
    checked: boolean;
    disabled?: boolean;
    isPending?: boolean;
    label: string;
    onToggle?: () => void;
}) {
    const content = (
        <>
            <span className="text-xs font-semibold text-primary/45 lg:hidden">{label}</span>
            {isPending ? (
                <CircleDashed aria-label={`${label} syncing`} className="animate-spin text-secondary" size={19} />
            ) : checked ? (
                <CheckCircle2 aria-label={`${label} complete`} className="text-emerald-600" size={19} />
            ) : (
                <CircleDashed aria-label={`${label} pending`} className="text-primary/25" size={19} />
            )}
        </>
    );

    if (!onToggle) {
        return (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary/10 bg-background/55 px-3 py-2 lg:justify-center lg:border-0 lg:bg-transparent lg:px-0">
                {content}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="flex items-center justify-between gap-2 rounded-md border border-primary/10 bg-background/55 px-3 py-2 text-left transition hover:border-primary/20 hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-55 lg:justify-center lg:border-0 lg:bg-transparent lg:px-0 lg:hover:bg-primary/5"
        >
            {content}
        </button>
    );
}

function buildDefaultQueue(members: TeamPreparationMember[]): LeaderFollowUpItem[] {
    return members
        .filter((member) => member.status !== 'ready')
        .map((member) => ({
            memberName: member.name,
            nextStep:
                member.status === 'needs-help'
                    ? 'Send the count-in and confirm the ending cue before rehearsal.'
                    : 'Ask for a quick confirmation before rehearsal starts.',
            priority: member.status === 'needs-help' ? 'high' : 'medium',
            reason: member.note,
            role: member.role,
            status: normalizeStatus(member.status),
        }));
}

function normalizeStatus(status: TeamReadinessStatus): Exclude<TeamReadinessStatus, 'reviewing'> {
    return status === 'reviewing' ? 'pending' : status;
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}
