import React from 'react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import { Music, Clock, PlayCircle } from 'lucide-react';
import { startSession } from '@/actions/sessionActions';

interface NextWorshipCardProps {
    worshipDate: Date;
    theme?: string;
    songCount: number;
    teamId: string;
    setlistId: string;
    sessionId?: string;
}

const NextWorshipCard: React.FC<NextWorshipCardProps> = ({
    worshipDate,
    theme = 'General Worship',
    songCount,
    teamId,
    setlistId,
    sessionId,
}) => {
    const today = new Date();
    const diffTime = Math.abs(worshipDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isToday = worshipDate.toDateString() === today.toDateString();
    const startSessionAction = startSession.bind(null, teamId, setlistId);
    const actionClassName = `group relative flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 font-bold shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl sm:w-auto sm:px-8 sm:hover:scale-105 ${sessionId ? 'bg-red-500 text-white' : 'bg-primary text-surface'}`;

    return (
        <GlassCard className="relative w-full max-w-4xl overflow-hidden border-primary/10 p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                        <Clock size={16} />
                        <span>{isToday ? 'TODAY' : `D-${diffDays}`}</span>
                        {sessionId && (
                            <span className="ml-2 flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs normal-case text-red-500 animate-pulse">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                LIVE
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl font-serif font-black text-primary sm:text-3xl md:text-4xl">
                        {isToday ? 'Sunday Service' : 'Next Worship'}
                    </h2>
                    <p className="text-base text-primary/60 sm:text-lg">
                        Theme: <span className="font-semibold text-primary">{theme}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-primary/40">
                        <Music size={16} />
                        <span>{songCount} Songs Prepared</span>
                    </div>
                </div>

                {sessionId ? (
                    <Link href={`/session/${sessionId}`} className={actionClassName}>
                        <PlayCircle size={24} className="animate-pulse" />
                        <span>Join Session</span>
                        <span className="absolute inset-0 rounded-full ring-2 ring-white/20 opacity-0 animate-ping group-hover:opacity-100" />
                    </Link>
                ) : (
                    <form action={startSessionAction} className="w-full sm:w-auto">
                        <button type="submit" className={actionClassName}>
                            <PlayCircle size={24} className="group-hover:animate-pulse" />
                            <span>Start Session</span>
                            <span className="absolute inset-0 rounded-full ring-2 ring-white/20 opacity-0 animate-ping group-hover:opacity-100" />
                        </button>
                    </form>
                )}
            </div>

            <div className={`pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full blur-3xl ${sessionId ? 'bg-red-500/10' : 'bg-secondary/10'}`} />
        </GlassCard>
    );
};

export default NextWorshipCard;
