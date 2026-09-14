import React from 'react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Music, Clock, PlayCircle, ArrowRight } from 'lucide-react';
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
    theme = '예배 찬양',
    songCount,
    teamId,
    setlistId,
    sessionId,
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(worshipDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isToday = diffDays === 0;

    const startSessionAction = startSession.bind(null, teamId, setlistId);

    return (
        <GlassCard className="relative w-full max-w-4xl overflow-hidden border-border/80 p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={sessionId ? 'destructive' : isToday ? 'secondary' : 'default'}
                            size="sm"
                            dot
                            pulse={Boolean(sessionId || isToday)}
                        >
                            {sessionId ? 'LIVE 진행 중' : isToday ? 'TODAY' : `D-${diffDays}`}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={14} />
                            {worshipDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </span>
                    </div>

                    <h2 className="text-2xl font-serif font-black text-foreground sm:text-3xl">
                        {theme}
                    </h2>

                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Music size={15} className="text-secondary" />
                            {songCount}곡 준비됨
                        </span>
                        <span>•</span>
                        <span>예상 소요 약 {songCount * 4}분</span>
                    </div>
                </div>

                {sessionId ? (
                    <Link
                        href={`/session/${sessionId}`}
                        className="tap-bounce hover-lift group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-destructive px-6 py-4 text-sm font-bold text-destructive-foreground shadow-lg shadow-destructive/25 transition-all duration-200 hover:bg-destructive/90 animate-pulse-glow sm:w-auto"
                    >
                        <span className="relative flex items-center justify-center">
                            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-white/40" />
                            <PlayCircle size={20} className="relative z-10 transition-transform duration-200 group-hover:scale-110" />
                        </span>
                        <span>라이브 예배 입장</span>
                        <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                ) : (
                    <form action={startSessionAction} className="w-full sm:w-auto">
                        <button
                            type="submit"
                            className="tap-bounce hover-lift group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:bg-primary/90 sm:w-auto"
                        >
                            <PlayCircle size={20} className="transition-transform duration-200 group-hover:scale-110" />
                            <span>예배 세션 시작</span>
                            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </button>
                    </form>
                )}
            </div>

            <div
                className={`pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full blur-3xl ${
                    sessionId ? 'bg-destructive/10' : 'bg-primary/5'
                }`}
            />
        </GlassCard>
    );
};

export default NextWorshipCard;
