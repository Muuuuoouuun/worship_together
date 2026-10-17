'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptTeamInvitation } from '@/actions/teamActions';
import { Button } from '@/components/ui/button';

export default function AcceptInvitation({ token }: { token: string }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const router = useRouter();
    return <div><Button size="lg" className="w-full" disabled={pending} onClick={() => startTransition(async () => {
        try { const result = await acceptTeamInvitation(token); if (!result.ok) { setError(result.error); return; } router.replace(`/dashboard/team?team=${result.value.teamId}`); router.refresh(); }
        catch { setError('참여하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.'); }
    })}>{pending ? '팀에 참여하는 중…' : '이 예배팀에 참여하기'}</Button>{error && <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}</div>;
}
