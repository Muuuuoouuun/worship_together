import Link from 'next/link';
import { CalendarClock, UsersRound } from 'lucide-react';
import { getViewer } from '@/lib/server/viewer';
import { getTeamRepository } from '@/lib/server/teams';
import AcceptInvitation from '@/components/team/AcceptInvitation';
import LogoMark from '@/components/brand/LogoMark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '예배팀 초대', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = getTeamRepository().preview(token);
    const viewer = invite ? await getViewer() : null;
    const user = viewer ? { name: viewer.profile.name } : null;
    const already = Boolean(invite && viewer?.teams.some((team) => team.id === invite.teamId));
    return <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
        <section className="w-full max-w-[440px] rounded-[28px] border border-border bg-card p-6 sm:p-9">
            <Link href="/dashboard" className="-my-2 inline-flex min-h-9 items-center gap-2 rounded-full text-[13px] font-semibold text-foreground transition-opacity hover:opacity-80"><LogoMark bold className="size-7" />Worship Together</Link>
            <div className="mb-5 mt-7 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground"><UsersRound size={22} aria-hidden="true" /></div>
            {invite ? <>
                <p className="text-xs font-medium text-muted-foreground">함께 준비하는 예배</p>
                <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-tight">{invite.teamName}</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">예배팀에서 초대했어요. 로그인한 계정으로 참여하고 담당 역할을 함께 확인하세요.</p>
                <p className="my-6 flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground"><CalendarClock size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />{new Date(invite.expiresAt).toLocaleDateString('ko-KR')}까지 참여할 수 있습니다.</p>
                {already ? <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>이미 참여한 팀이에요 · 홈으로</Link> : user ? <><p className="mb-3 text-sm text-muted-foreground">{user.name} 님으로 참여합니다.</p><AcceptInvitation token={token} claimable={invite.claimable} userName={user.name} /></> : <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>로그인하고 참여하기</Link>}
            </> : <>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">사용할 수 없는 초대입니다</h1>
                <p className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">초대가 만료되었거나 취소되었습니다. 팀 관리자에게 새 링크를 요청해주세요.</p>
                <Link className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')} href="/dashboard/team">팀 화면으로 돌아가기</Link>
            </>}
        </section>
    </main>;
}
