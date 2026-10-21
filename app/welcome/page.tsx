import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/server/viewer';
import Onboarding from '@/components/onboarding/Onboarding';

export const metadata: Metadata = { title: '시작하기', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * 처음 로그인한 사람의 시작 화면: 팀에서 보일 이름 → 새 팀 만들기 또는 초대 코드로 참여.
 * 팀 바꾸기의 '새 팀 만들기 · 초대 코드로 참여' 도 여기로 옵니다 (?step=team).
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [viewer, params] = await Promise.all([getViewer(), searchParams]);
    if (!viewer) redirect('/login?callbackUrl=/welcome');
    const code = typeof params.code === 'string' ? params.code : '';
    return (
        <Onboarding
            name={viewer.profile.name}
            hasTeams={viewer.teams.length > 0}
            startAtTeam={params.step === 'team' || viewer.teams.length > 0 || Boolean(code)}
            initialCode={code}
        />
    );
}
