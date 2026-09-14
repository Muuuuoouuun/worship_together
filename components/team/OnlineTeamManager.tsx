'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Link2, Plus, RefreshCw, Sparkles, UsersRound } from 'lucide-react';
import { createOnlineTeam, issueTeamInvitation, revokeTeamInvitation, setOnlineMemberRole } from '@/actions/teamActions';
import { worshipRoles, type OnlineTeam, type WorshipRole } from '@/types/team';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import InviteShareButtons from './InviteShareButtons';

const field = 'mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

export default function OnlineTeamManager({
    teams,
    userId,
    selectedTeamId,
}: {
    teams: OnlineTeam[];
    userId: string;
    selectedTeamId?: string;
}) {
    const router = useRouter();
    const [selected, setSelected] = useState(selectedTeamId ?? teams[0]?.id ?? '');
    const team = teams.find((item) => item.id === selected) ?? teams[0];
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
                if (!result.ok) {
                    setMessage(result.error);
                    return;
                }
                setName('');
                setSelected(result.value.teamId);
                setMessage('새 팀을 만들었습니다. 초대 링크로 팀원을 모아보세요.');
                router.refresh();
            } catch {
                setMessage('팀을 저장하지 못했습니다. 연결을 확인해주세요.');
            }
        });
    }

    function createInvitation() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await issueTeamInvitation(team.id);
                if (!result.ok) {
                    setMessage(result.error);
                    return;
                }
                setInvitations((current) => ({ ...current, [team.id]: result.value }));
                setMessage('7일간 유효한 초대 링크를 만들었습니다. 이전 링크는 취소되었습니다.');
            } catch {
                setMessage('초대 링크를 만들지 못했습니다. 다시 시도해주세요.');
            }
        });
    }

    function revoke() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await revokeTeamInvitation(team.id);
                if (!result.ok) {
                    setMessage(result.error);
                    return;
                }
                setInvitations((current) => {
                    const next = { ...current };
                    delete next[team.id];
                    return next;
                });
                setMessage('이 팀의 초대 링크를 모두 취소했습니다. 기존 팀원은 유지됩니다.');
            } catch {
                setMessage('초대를 취소하지 못했습니다. 다시 시도해주세요.');
            }
        });
    }

    function assign(memberId: string, role: WorshipRole) {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await setOnlineMemberRole(team.id, memberId, role);
                setMessage(result.ok ? '담당 역할을 저장했습니다.' : result.error);
                if (result.ok) router.refresh();
            } catch {
                setMessage('역할을 저장하지 못했습니다. 다시 시도해주세요.');
            }
        });
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Check size={16} className="text-secondary" />
                <span>로그인한 계정에 소속 팀과 역할이 안전하게 보관됩니다.</span>
            </div>

            {/* 새 팀 만들기 접이식 카드 */}
            <details open={!teams.length} className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
                <summary className="min-h-11 cursor-pointer font-bold text-foreground hover:text-primary transition-colors flex items-center justify-between">
                    <span className="text-base sm:text-lg">새 예배팀 만들기</span>
                    <span className="text-xs text-muted-foreground font-normal">클릭하여 열기/닫기</span>
                </summary>
                <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 text-xs font-semibold text-foreground">
                        새 팀 명칭
                        <input
                            className={field}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={40}
                            placeholder="예: 주일 2부 찬양팀"
                        />
                    </label>
                    <button
                        type="submit"
                        className={`${button} bg-primary text-primary-foreground hover:bg-primary/90 font-bold`}
                        disabled={pending || !name.trim()}
                    >
                        <Plus size={16} />
                        <span>팀 만들기</span>
                    </button>
                </form>
            </details>

            {/* 상태 메시지 피드백 */}
            {message && (
                <div role="status" className="rounded-xl border border-secondary/20 bg-secondary/10 px-4 py-2.5 text-xs font-semibold text-secondary">
                    {pending ? '처리 중…' : message}
                </div>
            )}

            {team ? (
                <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-7">
                    {/* 팀 선택 및 콘티 링크 */}
                    <div className="flex flex-wrap items-end gap-3 pb-6 border-b border-border/60">
                        <label className="min-w-0 flex-1 text-xs font-semibold text-foreground">
                            현재 선택된 팀
                            <select
                                className={field}
                                value={team.id}
                                onChange={(event) => {
                                    setSelected(event.target.value);
                                    setMessage('');
                                }}
                            >
                                {teams.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} ({item.members.length}명)
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Link
                            className={`${button} bg-primary text-primary-foreground hover:bg-primary/90 font-bold`}
                            href={`/dashboard/songs?team=${team.id}`}
                        >
                            <Sparkles size={16} />
                            <span>이 팀의 콘티 준비</span>
                        </Link>
                    </div>

                    {/* 초대 링크 섹션 */}
                    <div className="mt-6 rounded-2xl border border-border/70 bg-muted/40 p-5 sm:p-6">
                        <div className="flex items-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                                <Link2 size={18} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">카카오톡 · 링크로 초대</h3>
                                <p className="text-xs text-muted-foreground">
                                    초대받은 팀원은 구글이나 네이버로 간편하게 참여할 수 있습니다.
                                </p>
                            </div>
                        </div>

                        {isOwner ? (
                            <div className="mt-4 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <button className={button} disabled={pending} onClick={createInvitation}>
                                        <Link2 size={15} />
                                        <span>{invite ? '새 링크로 교체 발급' : '초대 링크 만들기'}</span>
                                    </button>
                                    <button className={button} disabled={pending} onClick={revoke}>
                                        초대 링크 만료·취소
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    새 링크를 만들면 이전 링크는 자동 만료됩니다. (초대 유효 기간: 7일)
                                </p>
                                {invite && (
                                    <div className="pt-2">
                                        <div className="mb-2.5 flex items-center gap-2">
                                            <Badge variant="success" size="sm" dot>
                                                초대 가능
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                만료일: {new Date(invite.expiresAt).toLocaleDateString('ko-KR')}
                                            </span>
                                        </div>
                                        <InviteShareButtons key={invite.url} url={invite.url} teamName={team.name} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="mt-4 text-xs font-semibold text-muted-foreground">
                                초대 링크 발급은 팀 관리자 권한이 필요합니다.
                            </p>
                        )}
                    </div>

                    {/* 팀원 명단 헤더 */}
                    <div className="mt-8 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <span>팀원 명단</span>
                                <Badge variant="secondary" size="sm">
                                    {team.members.length}명
                                </Badge>
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                각 팀원에게 예배에서 섬길 담당 역할을 지정해주세요.
                            </p>
                        </div>
                        <button
                            className={`${button} text-xs py-2 h-9`}
                            disabled={pending}
                            onClick={() => router.refresh()}
                        >
                            <RefreshCw size={13} className={pending ? 'animate-spin' : ''} />
                            <span>새로고침</span>
                        </button>
                    </div>

                    {/* 팀원 목록 (아바타, 뱃지, 역할 선택) */}
                    <ul className="divide-y divide-border/60">
                        {team.members.map((member) => (
                            <li key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar
                                        name={member.name}
                                        size="default"
                                        roleVariant={member.role === 'leader' ? 'leader' : 'default'}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground truncate">{member.name}</span>
                                            {member.userId === userId && (
                                                <Badge variant="subtle" size="sm">
                                                    나
                                                </Badge>
                                            )}
                                            {member.permission === 'owner' && (
                                                <Badge variant="secondary" size="sm">
                                                    관리자
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {worshipRoles[member.role] ?? member.role}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 sm:w-48 shrink-0">
                                    <span className="sr-only">{member.name} 담당 역할</span>
                                    <select
                                        className={field}
                                        value={member.role}
                                        disabled={!isOwner || pending}
                                        onChange={(event) => assign(member.userId, event.target.value as WorshipRole)}
                                    >
                                        {Object.entries(worshipRoles).map(([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center text-muted-foreground">
                    <UsersRound className="mx-auto mb-3 size-10 text-muted-foreground/60" />
                    <p className="font-bold text-foreground">아직 참여 중인 팀이 없습니다.</p>
                    <p className="mt-1 text-xs">새 팀을 만들거나 전달받은 초대 링크를 열어 참여하세요.</p>
                </div>
            )}
        </div>
    );
}
