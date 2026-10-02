'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    FileText,
    Link2,
    LogOut,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Shield,
    Sparkles,
    Trash2,
    UserPlus,
    UsersRound,
    X,
} from 'lucide-react';
import {
    addOnlineMember,
    addOnlineMembersBatch,
    createOnlineTeam,
    deleteOnlineTeam,
    issueTeamInvitation,
    leaveOnlineTeam,
    removeOnlineMember,
    revokeTeamInvitation,
    setOnlineMemberPermission,
    setOnlineMemberRole,
} from '@/actions/teamActions';
import { worshipRoles, type OnlineTeam, type WorshipRole } from '@/types/team';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import InviteShareButtons from './InviteShareButtons';

const field = 'mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';

function parseMemberLines(text: string): Array<{ name: string; role: WorshipRole }> {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const roleAliases: Record<string, WorshipRole> = {
        인도: 'leader', 인도자: 'leader', 리더: 'leader',
        보컬: 'vocal', 싱어: 'vocal', 찬양: 'vocal',
        건반: 'keyboard', 피아노: 'keyboard', 신디: 'keyboard', 메인: 'keyboard', 세컨: 'keyboard',
        기타: 'guitar', 일렉: 'guitar', 어쿠스틱: 'guitar', 통기타: 'guitar',
        베이스: 'bass', 베기: 'bass',
        드럼: 'drums', 퍼커션: 'drums',
        음향: 'sound', 엔지니어: 'sound',
        영상: 'media', 자막: 'media', 방송: 'media', 미디어: 'media',
    };
    const result: Array<{ name: string; role: WorshipRole }> = [];
    for (const line of lines) {
        const clean = line.replace(/[()[\],]/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = clean.split(' ');
        if (parts.length === 1) {
            result.push({ name: parts[0], role: 'member' });
        } else {
            const name = parts[0];
            let foundRole: WorshipRole = 'member';
            for (let i = 1; i < parts.length; i++) {
                const p = parts[i].toLowerCase();
                if (roleAliases[p]) {
                    foundRole = roleAliases[p];
                    break;
                }
            }
            result.push({ name, role: foundRole });
        }
    }
    return result;
}

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
    const batchInputId = useId();
    const [selected, setSelected] = useState(selectedTeamId ?? teams[0]?.id ?? '');
    const team = teams.find((item) => item.id === selected) ?? teams[0];
    const isOwner = team?.ownerId === userId || team?.members.some(m => m.userId === userId && m.permission === 'owner');
    
    // States
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [pending, startTransition] = useTransition();
    const [invitations, setInvitations] = useState<Record<string, { url: string; expiresAt: string }>>({});
    
    // Direct Member Add state
    const [directName, setDirectName] = useState('');
    const [directRole, setDirectRole] = useState<WorshipRole>('vocal');
    
    // Batch Member Add modal state
    const [batchOpen, setBatchOpen] = useState(false);
    const [batchText, setBatchText] = useState('');
    const parsedBatch = useMemo(() => parseMemberLines(batchText), [batchText]);

    // Member list search & filter
    const [memberSearch, setMemberSearch] = useState('');
    const [memberRoleFilter, setMemberRoleFilter] = useState<WorshipRole | 'all'>('all');

    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const m of team?.members ?? []) {
            counts[m.role] = (counts[m.role] ?? 0) + 1;
        }
        return counts;
    }, [team?.members]);

    const filteredMembers = useMemo(() => {
        const query = memberSearch.trim().toLowerCase();
        return (team?.members ?? []).filter((m) => {
            if (memberRoleFilter !== 'all' && m.role !== memberRoleFilter) return false;
            if (query && !m.name.toLowerCase().includes(query) && !worshipRoles[m.role]?.toLowerCase().includes(query)) {
                return false;
            }
            return true;
        });
    }, [team?.members, memberRoleFilter, memberSearch]);

    const invite = team ? invitations[team.id] : undefined;

    function showFeedback(msg: string, error = false) {
        setMessage(msg);
        setIsError(error);
    }

    function create(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        startTransition(async () => {
            try {
                const result = await createOnlineTeam(name);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                setName('');
                setSelected(result.value.teamId);
                showFeedback('새 팀을 만들었습니다. 초대 링크로 팀원을 모아보세요.');
                router.refresh();
            } catch {
                showFeedback('팀을 저장하지 못했습니다. 연결을 확인해주세요.', true);
            }
        });
    }

    function createInvitation() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await issueTeamInvitation(team.id);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                setInvitations((current) => ({ ...current, [team.id]: result.value }));
                showFeedback('7일간 유효한 초대 링크를 만들었습니다. 이전 링크는 취소되었습니다.');
            } catch {
                showFeedback('초대 링크를 만들지 못했습니다. 다시 시도해주세요.', true);
            }
        });
    }

    function revoke() {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await revokeTeamInvitation(team.id);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                setInvitations((current) => {
                    const next = { ...current };
                    delete next[team.id];
                    return next;
                });
                showFeedback('이 팀의 초대 링크를 모두 취소했습니다. 기존 팀원은 유지됩니다.');
            } catch {
                showFeedback('초대를 취소하지 못했습니다. 다시 시도해주세요.', true);
            }
        });
    }

    function assign(memberId: string, role: WorshipRole) {
        if (!team) return;
        startTransition(async () => {
            try {
                const result = await setOnlineMemberRole(team.id, memberId, role);
                showFeedback(result.ok ? '담당 역할을 저장했습니다.' : result.error, !result.ok);
                if (result.ok) router.refresh();
            } catch {
                showFeedback('역할을 저장하지 못했습니다. 다시 시도해주세요.', true);
            }
        });
    }

    function handleAddDirectMember(e: React.FormEvent) {
        e.preventDefault();
        if (!team || !directName.trim()) return;
        startTransition(async () => {
            try {
                const result = await addOnlineMember(team.id, directName.trim(), directRole);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                setDirectName('');
                showFeedback(`'${result.value.name}' 팀원을 명단에 직접 추가했습니다.`);
                router.refresh();
            } catch (err) {
                showFeedback(err instanceof Error ? err.message : '팀원을 추가하지 못했습니다.', true);
            }
        });
    }

    function handleAddBatchMembers() {
        if (!team || !parsedBatch.length) return;
        startTransition(async () => {
            try {
                const result = await addOnlineMembersBatch(team.id, parsedBatch);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                setBatchText('');
                setBatchOpen(false);
                showFeedback(`총 ${result.value.length}명의 팀원을 일괄 등록했습니다.`);
                router.refresh();
            } catch (err) {
                showFeedback(err instanceof Error ? err.message : '명단을 일괄 추가하지 못했습니다.', true);
            }
        });
    }

    function handleTogglePermission(targetUserId: string, currentPerm: 'owner' | 'member') {
        if (!team) return;
        const nextPerm = currentPerm === 'owner' ? 'member' : 'owner';
        const confirmMsg = nextPerm === 'owner'
            ? '이 팀원에게 관리자 권한을 부여하시겠습니까? 팀 관리자는 일정과 인원을 자유롭게 수정할 수 있습니다.'
            : '이 팀원의 관리자 권한을 해제하고 일반 팀원으로 변경하시겠습니까?';
        if (!window.confirm(confirmMsg)) return;

        startTransition(async () => {
            try {
                const result = await setOnlineMemberPermission(team.id, targetUserId, nextPerm);
                showFeedback(result.ok ? '권한 설정을 변경했습니다.' : result.error, !result.ok);
                if (result.ok) router.refresh();
            } catch {
                showFeedback('권한을 변경하지 못했습니다.', true);
            }
        });
    }

    function handleRemoveMember(targetUserId: string, memberName: string) {
        if (!team) return;
        if (!window.confirm(`'${memberName}' 팀원을 팀 명단에서 제외하시겠습니까?`)) return;

        startTransition(async () => {
            try {
                const result = await removeOnlineMember(team.id, targetUserId);
                showFeedback(result.ok ? `'${memberName}' 팀원을 명단에서 제외했습니다.` : result.error, !result.ok);
                if (result.ok) router.refresh();
            } catch {
                showFeedback('팀원을 제외하지 못했습니다.', true);
            }
        });
    }

    function handleLeaveTeam() {
        if (!team) return;
        if (!window.confirm(`'${team.name}' 팀에서 탈퇴하시겠습니까?`)) return;

        startTransition(async () => {
            try {
                const result = await leaveOnlineTeam(team.id);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                showFeedback('팀에서 탈퇴했습니다.');
                router.refresh();
            } catch {
                showFeedback('팀 탈퇴 중 오류가 발생했습니다.', true);
            }
        });
    }

    function handleDeleteTeam() {
        if (!team) return;
        if (!window.confirm(`정말로 '${team.name}' 팀을 삭제하시겠습니까?\n모든 일정, 인원 배치, 초대 링크가 영구히 삭제됩니다.`)) return;

        startTransition(async () => {
            try {
                const result = await deleteOnlineTeam(team.id);
                if (!result.ok) {
                    showFeedback(result.error, true);
                    return;
                }
                showFeedback('팀이 안전하게 삭제되었습니다.');
                router.refresh();
            } catch {
                showFeedback('팀 삭제 중 오류가 발생했습니다.', true);
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
                <div
                    role="status"
                    className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                        isError
                            ? 'border-destructive/30 bg-destructive/10 text-destructive'
                            : 'border-secondary/20 bg-secondary/10 text-secondary'
                    }`}
                >
                    {pending ? '처리 중…' : message}
                </div>
            )}

            {team ? (
                <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-7 space-y-6">
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

                    {/* 인원 넣기 섹션 (직접 추가 + 텍스트 일괄 붙여넣기) */}
                    {isOwner && (
                        <div className="rounded-2xl border border-border/80 bg-background/50 p-5 sm:p-6 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                        <UserPlus size={18} className="text-primary" />
                                        <span>인원 넣기 (팀원 직접 등록)</span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        초대 링크 가입을 기다리지 않고, 사역자 명단과 역할을 관리자가 바로 추가합니다.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBatchOpen(true)}
                                    className={`${button} text-xs py-2 h-9`}
                                >
                                    <FileText size={14} />
                                    <span>명단 텍스트 일괄 붙여넣기</span>
                                </button>
                            </div>

                            <form onSubmit={handleAddDirectMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                <label className="sm:col-span-6 text-xs font-semibold text-foreground">
                                    팀원 이름
                                    <input
                                        className={field}
                                        value={directName}
                                        onChange={(e) => setDirectName(e.target.value)}
                                        placeholder="예: 김철수"
                                        maxLength={40}
                                        required
                                    />
                                </label>
                                <label className="sm:col-span-4 text-xs font-semibold text-foreground">
                                    담당 역할 (파트)
                                    <select
                                        className={field}
                                        value={directRole}
                                        onChange={(e) => setDirectRole(e.target.value as WorshipRole)}
                                    >
                                        {Object.entries(worshipRoles).map(([k, label]) => (
                                            <option key={k} value={k}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="sm:col-span-2">
                                    <button
                                        type="submit"
                                        className={`${button} w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90`}
                                        disabled={pending || !directName.trim()}
                                    >
                                        <Plus size={16} />
                                        <span>추가</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 초대 링크 섹션 */}
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-5 sm:p-6">
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
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 pt-2">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <span>팀원 명단 & 역할 배분</span>
                                <Badge variant="secondary" size="sm">
                                    {team.members.length}명
                                </Badge>
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                각 팀원의 예배 담당 역할을 설정하고 관리 권한을 지정할 수 있습니다.
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

                    {/* 팀원 빠른 검색 & 역할별 필터 */}
                    <div className="space-y-3 pt-1">
                        <div className="relative flex items-center">
                            <Search size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                placeholder="팀원 이름 또는 파트 검색..."
                                className="w-full rounded-xl border border-input/80 bg-background pl-9 pr-24 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                            />
                            <div className="absolute right-2.5 flex items-center gap-1.5">
                                {memberSearch ? (
                                    <>
                                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            {filteredMembers.length}명
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setMemberSearch('')}
                                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            title="검색어 지우기"
                                        >
                                            <X size={13} />
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        {/* 역할별 필터 칩 */}
                        <div role="group" aria-label="파트별 필터" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
                            <button
                                type="button"
                                aria-pressed={memberRoleFilter === 'all'}
                                onClick={() => setMemberRoleFilter('all')}
                                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                    memberRoleFilter === 'all'
                                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                전체 ({team.members.length})
                            </button>
                            {(Object.keys(worshipRoles) as WorshipRole[]).map((r) => {
                                const count = roleCounts[r] ?? 0;
                                if (count === 0 && memberRoleFilter !== r) return null;
                                return (
                                    <button
                                        key={r}
                                        type="button"
                                        aria-pressed={memberRoleFilter === r}
                                        onClick={() => setMemberRoleFilter(memberRoleFilter === r ? 'all' : r)}
                                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all flex items-center gap-1 ${
                                            memberRoleFilter === r
                                                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                    >
                                        <span>{worshipRoles[r]}</span>
                                        <span className="text-[10px] opacity-75">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 팀원 목록 */}
                    {filteredMembers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center space-y-2">
                            <p className="text-sm font-semibold text-foreground">조건에 일치하는 팀원이 없습니다.</p>
                            <p className="text-xs text-muted-foreground">검색어를 변경하거나 파트 필터를 초기화해 보세요.</p>
                            {(memberSearch || memberRoleFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => { setMemberSearch(''); setMemberRoleFilter('all'); }}
                                    className={`${button} text-xs py-1.5 px-3 min-h-8 font-semibold inline-flex items-center gap-1.5 mt-2`}
                                >
                                    <RotateCcw size={13} />
                                    <span>검색 및 필터 초기화</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {filteredMembers.map((member) => (
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
                                                {member.permission === 'owner' ? (
                                                    <Badge variant="secondary" size="sm">
                                                        관리자
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" size="sm">
                                                        팀원
                                                    </Badge>
                                                )}
                                                {member.userId.startsWith('direct-') && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-normal">
                                                        직접 등록
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                주 역할: {worshipRoles[member.role] ?? member.role}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:shrink-0 flex-wrap">
                                        <div className="w-36">
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

                                        {isOwner && (
                                            <div className="flex items-center gap-1.5 pt-1.5 sm:pt-0">
                                                <button
                                                    type="button"
                                                    title={member.permission === 'owner' ? '관리자 권한 해제' : '관리자 권한 부여'}
                                                    className={`${button} text-xs py-2 h-11 px-2.5 ${
                                                        member.permission === 'owner' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                                                    }`}
                                                    disabled={pending}
                                                    onClick={() => handleTogglePermission(member.userId, member.permission)}
                                                >
                                                    <Shield size={15} />
                                                    <span className="hidden md:inline">{member.permission === 'owner' ? '관리자 해제' : '관리자 지정'}</span>
                                                </button>

                                                {member.userId !== userId && (
                                                    <button
                                                        type="button"
                                                        title="팀에서 제외"
                                                        className={`${button} text-xs py-2 h-11 px-2.5 text-destructive hover:bg-destructive/10 hover:border-destructive/30`}
                                                        disabled={pending}
                                                        onClick={() => handleRemoveMember(member.userId, member.name)}
                                                    >
                                                        <Trash2 size={15} />
                                                        <span className="hidden md:inline">제외</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* 위험 구역: 팀 탈퇴 / 팀 삭제 */}
                    <div className="mt-8 pt-6 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <AlertTriangle size={15} className="text-amber-500" />
                            <span>팀 탈퇴 및 삭제 관리</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isOwner ? (
                                <button
                                    type="button"
                                    onClick={handleDeleteTeam}
                                    disabled={pending}
                                    className="px-3 py-2 text-xs font-semibold text-destructive hover:underline rounded-lg hover:bg-destructive/10 transition-colors"
                                >
                                    팀 영구 삭제
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleLeaveTeam}
                                    disabled={pending}
                                    className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:underline rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                                >
                                    <LogOut size={14} />
                                    <span>팀 나가기</span>
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            ) : (
                <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center text-muted-foreground">
                    <UsersRound className="mx-auto mb-3 size-10 text-muted-foreground/60" />
                    <p className="font-bold text-foreground">아직 참여 중인 팀이 없습니다.</p>
                    <p className="mt-1 text-xs">새 팀을 만들거나 전달받은 초대 링크를 열어 참여하세요.</p>
                </div>
            )}

            {/* 명단 텍스트 일괄 붙여넣기 모달 */}
            {batchOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={batchInputId}
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setBatchOpen(false);
                    }}
                >
                    <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        {/* 모바일 바텀시트 핸들 바 */}
                        <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden shrink-0" />

                        <div className="flex items-center justify-between border-b border-border/60 p-4 sm:p-5 bg-muted/30 shrink-0">
                            <div className="flex items-center gap-2">
                                <FileText className="text-primary" size={20} />
                                <h3 id={batchInputId} className="text-base sm:text-lg font-bold text-foreground">
                                    명단 텍스트 일괄 붙여넣기
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBatchOpen(false)}
                                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                카카오톡이나 명단 텍스트를 줄 단위로 붙여넣으세요. 이름과 파트를 자동으로 인식합니다.
                                <br />
                                예: <code className="rounded bg-muted px-1">김철수 보컬</code>, <code className="rounded bg-muted px-1">이영희 (건반)</code>, <code className="rounded bg-muted px-1">박민수 드럼</code>
                            </p>

                            <textarea
                                className={`${field} h-36 py-2.5 resize-none font-mono text-xs`}
                                placeholder="김철수 보컬&#10;이영희 건반&#10;박민수 드럼&#10;최기타 기타&#10;정베이스 베이스"
                                value={batchText}
                                onChange={(e) => setBatchText(e.target.value)}
                            />

                            {parsedBatch.length > 0 && (
                                <div className="rounded-xl border border-border/80 bg-muted/40 p-3 max-h-36 overflow-y-auto space-y-1.5 text-xs">
                                    <p className="font-semibold text-foreground">
                                        인식된 팀원 ({parsedBatch.length}명):
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {parsedBatch.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 rounded-md bg-card border border-border px-2 py-1 text-[11px] font-medium"
                                            >
                                                <span className="font-bold">{item.name}</span>
                                                <span className="text-muted-foreground">({worshipRoles[item.role]})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                                <button
                                    type="button"
                                    onClick={() => setBatchOpen(false)}
                                    className={`${button} text-xs py-2`}
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddBatchMembers}
                                    disabled={pending || parsedBatch.length === 0}
                                    className={`${button} bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs py-2`}
                                >
                                    {pending ? '등록 중…' : `${parsedBatch.length}명 일괄 등록하기`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
