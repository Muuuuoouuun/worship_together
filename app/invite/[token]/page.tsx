import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';
import AcceptInvitation from '@/components/team/AcceptInvitation';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '예배팀 초대', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = getTeamRepository().preview(token);
    const user = invite ? await getCurrentUser() : null;
    return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><Link href="/dashboard" className="text-sm font-bold text-primary">Worship Together</Link><div className="mb-5 mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary"><UsersRound size={28} /></div>
        {invite ? <><p className="text-sm font-semibold text-secondary">함께 준비하는 예배</p><h1 className="mt-3 break-words text-3xl font-bold text-foreground">{invite.teamName}</h1><p className="mt-3 text-base leading-7 text-muted-foreground">예배팀에서 초대했어요. 로그인한 계정으로 참여하고 담당 역할을 함께 확인하세요.</p><p className="my-5 rounded-xl bg-muted p-3 text-sm text-foreground">{new Date(invite.expiresAt).toLocaleDateString('ko-KR')}까지 참여할 수 있습니다.</p>{user ? <><p className="mb-4 text-sm text-muted-foreground">{user.name} 님으로 참여합니다.</p><AcceptInvitation token={token} /></> : <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">로그인하고 참여하기</Link>}</> : <><h1 className="text-2xl font-bold text-foreground">사용할 수 없는 초대입니다</h1><p className="my-4 text-base leading-7 text-muted-foreground">초대가 만료되었거나 취소되었습니다. 팀 관리자에게 새 링크를 요청해주세요.</p><Link className="inline-flex min-h-12 items-center font-semibold text-primary underline" href="/dashboard/team">팀 화면으로 돌아가기</Link></>}
    </section></main>;
}
