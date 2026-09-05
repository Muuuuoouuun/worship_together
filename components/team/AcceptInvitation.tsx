'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptTeamInvitation } from '@/actions/teamActions';

export default function AcceptInvitation({ token }: { token: string }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const router = useRouter();
    return <div><button disabled={pending} onClick={() => startTransition(async () => {
        try { const result = await acceptTeamInvitation(token); if (!result.ok) { setError(result.error); return; } router.replace(`/dashboard/team?team=${result.value.teamId}`); router.refresh(); }
        catch { setError('참여하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.'); }
    })} className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!">{pending ? '팀에 참여하는 중…' : '이 예배팀에 참여하기'}</button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>;
}
