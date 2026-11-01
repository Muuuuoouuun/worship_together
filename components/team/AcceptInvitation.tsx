'use client';
import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptTeamInvitation } from '@/actions/teamActions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { worshipRoles, type InvitationPreview } from '@/types/team';

/**
 * 초대 받아 참여하기. 관리자가 이름만 먼저 올려 둔 명단 자리가 있으면 '내 이름' 을 골라 그 자리(역할 · 일정 배정)를 이어받습니다.
 * 참여하면 그 팀이 지금 팀이 되고 홈으로 갑니다.
 */
export default function AcceptInvitation({ token, claimable = [], userName }: { token: string; claimable?: InvitationPreview['claimable']; userName?: string }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [claim, setClaim] = useState('');
    const router = useRouter();
    const name = useId();
    const join = () => startTransition(async () => {
        try {
            const result = await acceptTeamInvitation(token, claim || undefined);
            if (!result.ok) { setError(result.error); return; }
            router.replace('/dashboard');
            router.refresh();
        } catch { setError('참여하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.'); }
    });
    return <div>
        {claimable.length ? <fieldset className="mb-5">
            <legend className="text-sm font-semibold text-foreground">명단에 내 이름이 있나요?</legend>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">관리자가 미리 올려 둔 자리를 고르면 담당 역할과 일정이 그대로 이어져요.</p>
            <div className="mt-3 grid gap-2">
                {[{ userId: '', name: userName ? `새로 참여 · ${userName}` : '새로 참여', role: null as null | keyof typeof worshipRoles }, ...claimable].map((seat) => {
                    const checked = claim === seat.userId;
                    return <label key={seat.userId || 'new'} className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 ring-1 transition-colors', checked ? 'bg-muted ring-foreground' : 'ring-border hover:bg-muted/60')}>
                        <input type="radio" name={name} value={seat.userId} checked={checked} onChange={() => setClaim(seat.userId)} className="size-4 accent-[var(--brand)]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{seat.name}</span>
                        {seat.role ? <span className="shrink-0 text-xs text-muted-foreground">{worshipRoles[seat.role]}</span> : null}
                    </label>;
                })}
            </div>
        </fieldset> : null}
        <Button size="lg" className="w-full" disabled={pending} onClick={join}>{pending ? '팀에 참여하는 중…' : claim ? '이 자리로 참여하기' : '이 예배팀에 참여하기'}</Button>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
    </div>;
}
