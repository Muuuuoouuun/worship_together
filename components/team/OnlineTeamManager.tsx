'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Link2, Plus, RefreshCw, UsersRound } from 'lucide-react';
import { createOnlineTeam, issueTeamInvitation, revokeTeamInvitation, setOnlineMemberRole } from '@/actions/teamActions';
import { worshipRoles, type OnlineTeam, type WorshipRole } from '@/types/team';
import InviteShareButtons from './InviteShareButtons';

const field = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

export default function OnlineTeamManager({ teams, userId, selectedTeamId }: { teams: OnlineTeam[]; userId: string; selectedTeamId?: string }) {
    const router = useRouter();
    const [selected, setSelected] = useState(selectedTeamId ?? teams[0]?.id ?? '');
    const team = teams.find(item => item.id === selected) ?? teams[0];
    const isOwner = team?.ownerId === userId;
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [pending, startTransition] = useTransition();
    const [invitations, setInvitations] = useState<Record<string, { url: string; expiresAt: string }>>({});
    const invite = team ? invitations[team.id] : undefined;
    function create(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        startTransition(async () => {
            try {
                const result = await createOnlineTeam(name);
                if (!result.ok) { setMessage(result.error); return; }
                setName(''); setSelected(result.value.teamId); setMessage('팀을 만들었습니다. 초대 링크로 팀원을 모아보세요.'); router.refresh();
            } catch { setMessage('팀을 저장하지 못했습니다. 연결을 확인해주세요.'); }
        });
    }
    function createInvitation() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await issueTeamInvitation(team.id);
                if (!result.ok) { setMessage(result.error); return; }
                setInvitations(current => ({ ...current, [team.id]: result.value })); setMessage('7일간 유효한 초대 링크를 만들었습니다. 이전 링크는 더 이상 사용할 수 없습니다.');
            } catch { setMessage('초대 링크를 만들지 못했습니다. 다시 시도해주세요.'); }
        });
    }
    function revoke() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await revokeTeamInvitation(team.id);
                if (!result.ok) { setMessage(result.error); return; }
                setInvitations(current => { const next = { ...current }; delete next[team.id]; return next; }); setMessage('이 팀의 초대 링크를 모두 취소했습니다. 기존 팀원은 유지됩니다.');
            } catch { setMessage('초대를 취소하지 못했습니다. 다시 시도해주세요.'); }
        });
    }
    function assign(memberId: string, role: WorshipRole) {
        if (!team) return;
        startTransition(async () => {
            try { const result = await setOnlineMemberRole(team.id, memberId, role); setMessage(result.ok ? '담당 역할을 저장했습니다.' : result.error); if (result.ok) router.refresh(); }
            catch { setMessage('역할을 저장하지 못했습니다. 다시 시도해주세요.'); }
        });
    }
    return <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Check size={17} className="text-secondary" /> 로그인한 계정에 팀과 역할이 저장됩니다.</div>
        <details open={!teams.length} className="rounded-2xl border border-border bg-card p-5 sm:p-6"><summary className="min-h-11 cursor-pointer text-lg font-bold text-foreground">새 예배팀 만들기</summary><form onSubmit={create} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-semibold text-foreground">팀 이름<input className={field} value={name} onChange={event => setName(event.target.value)} required maxLength={40} placeholder="예: 주일 2부 예배팀" /></label><button className={`${button} bg-primary! text-primary-foreground! hover:bg-primary/90!`} disabled={pending || !name.trim()}><Plus size={17} /> 팀 만들기</button></form></details>
        <p role="status" className="text-sm leading-6 text-foreground">{pending ? '저장 중…' : message}</p>
        {team ? <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold text-foreground">함께하는 팀<select className={field} value={team.id} onChange={event => { setSelected(event.target.value); setMessage(''); }}>{teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Link className={button} href={`/dashboard/songs?team=${team.id}`}>이 팀의 콘티 준비</Link></div>
            <div className="mt-6 rounded-xl border border-border bg-muted p-4 sm:p-5"><div className="flex items-center gap-2"><Link2 size={20} /><h2 className="text-lg font-bold text-foreground">카카오톡 · 링크로 초대</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">링크를 받은 팀원은 구글이나 네이버로 로그인하고 참여할 수 있습니다.</p>
                {isOwner ? <><div className="my-4 flex flex-wrap gap-2"><button className={button} disabled={pending} onClick={createInvitation}><Link2 size={16} /> {invite ? '새 링크로 교체' : '초대 링크 만들기'}</button><button className={button} disabled={pending} onClick={revoke}>기존 초대 취소</button></div><p className="mb-3 text-xs leading-5 text-muted-foreground">새 링크를 만들면 이전 링크는 취소됩니다. 팀 관리 권한은 초대로 부여되지 않습니다.</p>{invite && <><p className="mb-3 text-sm font-semibold text-foreground">유효 기간: {new Date(invite.expiresAt).toLocaleString('ko-KR')}</p><InviteShareButtons key={invite.url} url={invite.url} teamName={team.name} /></>}</> : <p className="mt-4 text-sm font-semibold text-foreground">팀 관리자에게 초대 링크를 요청해주세요.</p>}
            </div>
            <div className="mb-2 mt-7 flex items-center justify-between gap-2"><h2 className="text-lg font-bold text-foreground">팀원 {team.members.length}명</h2><button className={button} disabled={pending} onClick={() => router.refresh()}><RefreshCw size={15} /> 새로고침</button></div>
            <p className="text-sm leading-6 text-muted-foreground">담당 역할은 예배에서 맡을 파트입니다. 팀 관리 권한과는 별개입니다.</p>
            <ul className="mt-3 divide-y divide-border">{team.members.map(member => <li key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="break-words font-bold text-foreground">{member.name}{member.userId === userId ? ' (나)' : ''}</p><p className="mt-1 text-sm text-muted-foreground">{member.permission === 'owner' ? '팀 관리자' : '팀원'}</p></div><label className="text-sm font-semibold text-foreground sm:w-44"><span className="sr-only">{member.name} 담당 역할</span><select className={field} value={member.role} disabled={!isOwner || pending} onChange={event => assign(member.userId, event.target.value as WorshipRole)}>{Object.entries(worshipRoles).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></li>)}</ul>
        </section> : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground"><UsersRound className="mx-auto mb-3" /><p>팀을 만들거나 전달받은 초대 링크를 열어주세요.</p></div>}
    </div>;
}
