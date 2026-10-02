import DashboardLayout from '@/components/dashboard/DashboardLayout';
import TeamManager from '@/components/team/TeamManager';
import OnlineTeamManager from '@/components/team/OnlineTeamManager';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';
import Link from 'next/link';
import { Link2, MessageCircle, UsersRound } from 'lucide-react';

export default async function TeamPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const invite = typeof params.invite === 'string' ? params.invite.slice(0, 2048) : '';
    const user = await getCurrentUser();
    const teams = user ? getTeamRepository().list(user.id) : [];
    return (
        <DashboardLayout currentPath="/dashboard/team">
            <div className="mx-auto max-w-5xl space-y-6">
                <header><h1 className="text-2xl font-serif font-black tracking-tight text-primary sm:text-3xl">팀·초대</h1></header>
                {user ? <OnlineTeamManager teams={teams} userId={user.id} selectedTeamId={typeof params.team === 'string' ? params.team : undefined} /> : <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="border-b border-border bg-muted p-5 sm:p-7"><div className="mb-4 flex items-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fee500] text-[#191919]"><MessageCircle size={22} /></span><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-primary"><Link2 size={21} /></span></div><h2 className="text-2xl font-bold text-foreground">링크 하나로 함께 시작해요</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">구글·네이버로 로그인하면 팀을 만들고, 초대받은 팀원과 역할을 같은 공간에서 확인할 수 있습니다.</p></div>
                    <div className="space-y-5 p-5 sm:p-7"><ol className="grid gap-4 text-sm text-foreground sm:grid-cols-3">{['로그인하고 팀 만들기', '카카오톡·링크로 초대하기', '팀원 참여 후 역할 나누기'].map((text,index) => <li key={text} className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index+1}</span><span className="pt-1 font-semibold leading-6">{text}</span></li>)}</ol><Link className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground sm:w-auto" href="/login?next=%2Fdashboard%2Fteam"><UsersRound size={18} /> 로그인하고 팀 시작하기</Link></div>
                </section>}
                <details open={Boolean(invite)} className="rounded-2xl border border-border bg-card p-4 sm:p-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-muted-foreground">{user ? '이전에 저장한 기기 체험 팀' : '로그인 없이 먼저 체험하기'}</summary><div className="mt-5"><TeamManager initialInvite={invite} /></div></details>
            </div>
        </DashboardLayout>
    );
}
