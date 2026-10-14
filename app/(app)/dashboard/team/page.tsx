import TeamManager from '@/components/team/TeamManager';
import OnlineTeamManager from '@/components/team/OnlineTeamManager';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';
import Link from 'next/link';
import type { Metadata } from 'next';
import PageHeader from '@/components/ui/PageHeader';
import { ChevronDown, Link2, MessageCircle, UsersRound } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
    title: '팀·초대',
};

export default async function TeamPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const invite = typeof params.invite === 'string' ? params.invite.slice(0, 2048) : '';
    const user = await getCurrentUser();
    const teams = user ? getTeamRepository().list(user.id) : [];
    return (
        <>
            <div className="space-y-6">
                <PageHeader title="팀·초대" description="팀을 만들고 링크로 초대해 역할을 나눠요" />
                {user ? (
                    <OnlineTeamManager teams={teams} userId={user.id} selectedTeamId={typeof params.team === 'string' ? params.team : undefined} />
                ) : (
                    <section aria-labelledby="team-start" className="rounded-3xl bg-muted/60 p-5 sm:p-7">
                        <div className="flex items-center gap-2" aria-hidden="true">
                            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#fee500] text-[#191919]">
                                <MessageCircle size={19} />
                            </span>
                            <span className="flex size-10 items-center justify-center rounded-2xl bg-card text-foreground">
                                <Link2 size={18} />
                            </span>
                        </div>
                        <h2 id="team-start" className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">
                            링크 하나로 함께 시작해요
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">구글·네이버로 로그인하면 팀을 만들고, 초대받은 팀원과 역할을 같은 공간에서 확인할 수 있습니다.</p>
                        <ol className="mt-5 space-y-3">
                            {['로그인하고 팀 만들기', '카카오톡·링크로 초대하기', '팀원 참여 후 역할 나누기'].map((text, index) => (
                                <li key={text} className="flex items-center gap-3 text-[15px] text-foreground">
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold tabular-nums text-foreground ring-1 ring-border">{index + 1}</span>
                                    {text}
                                </li>
                            ))}
                        </ol>
                        <Link className={cn(buttonVariants(), 'mt-6 w-full sm:w-auto')} href="/login?next=%2Fdashboard%2Fteam">
                            <UsersRound size={17} aria-hidden="true" /> 로그인하고 팀 시작하기
                        </Link>
                    </section>
                )}
                <details open={Boolean(invite)} className="group border-t border-border/70 pt-4">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                        {user ? '이전에 저장한 기기 체험 팀' : '로그인 없이 먼저 체험하기'}
                        <ChevronDown size={16} className="text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="mt-4">
                        <TeamManager initialInvite={invite} />
                    </div>
                </details>
            </div>
        </>
    );
}
