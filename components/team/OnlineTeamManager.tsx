'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ClipboardList,
    Link2,
    LogOut,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Shield,
    Sparkles,
    Trash2,
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
import type { TeamPolicy } from '@/lib/permissions';
import TeamPolicyPanel from './TeamPolicyPanel';
import ProfileNameField from './ProfileNameField';
import InviteCode from './InviteCode';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Select, Textarea, searchFieldClass } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import { STATUS } from '@/components/ui/status';
import { Avatar, TONE_BLOCK } from '@/components/conti/ui';
import { cn } from '@/lib/utils';
import InviteShareButtons from './InviteShareButtons';

/** 입력 칸 위의 작은 이름표 */
const labelClass = 'block min-w-0 text-xs font-medium text-muted-foreground';
/** 섹션 제목 (레퍼런스의 '악기 담당' 크기) */
const sectionTitle = 'text-[17px] font-semibold tracking-tight text-foreground';
/** 목록 행 앞의 회색 아이콘 칸 */
const iconTile = 'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground';
/** 파트 필터 칩: 선택 = 검정 알약, 나머지 = 회색 알약 */
const filterChip = 'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

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
    currentTeamId,
    policy,
    profileName,
    activeInvite,
}: {
    teams: OnlineTeam[];
    userId: string;
    /** 지금 팀 (팀 바꾸기에서 고른 팀) */
    currentTeamId?: string;
    policy: TeamPolicy;
    profileName: string;
    /** 관리자에게만: 아직 유효한 초대 코드 */
    activeInvite: { code: string; expiresAt: string } | null;
}) {
    const router = useRouter();
    const batchInputId = useId();
    const sectionId = useId();
    const team = teams.find((item) => item.id === currentTeamId) ?? teams[0];
    const me = team?.members.find((member) => member.userId === userId);
    // 관리자 = 권한 'owner'. 팀을 만든 사람(ownerId)은 다른 관리자가 내리거나 내보낼 수 없습니다.
    const isOwner = me?.permission === 'owner';
    const isCreator = team?.ownerId === userId;
    
    // States
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [pending, startTransition] = useTransition();
    const [invitations, setInvitations] = useState<Record<string, { url?: string; code: string; expiresAt: string }>>(() => (team && activeInvite ? { [team.id]: activeInvite } : {}));
    
    // Direct Member Add state
    const [directName, setDirectName] = useState('');
    const [directRole, setDirectRole] = useState<WorshipRole>('vocal');
    
    // Batch Member Add modal state
    const [batchOpen, setBatchOpen] = useState(false);
    const [batchText, setBatchText] = useState('');
    const parsedBatch = useMemo(() => parseMemberLines(batchText), [batchText]);
    const dialogRef = useSheetDismiss(() => setBatchOpen(false), batchOpen);

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
                showFeedback('새 팀을 만들었습니다. 지금 팀으로 바꿨어요 — 초대 링크로 팀원을 모아보세요.');
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
                showFeedback('7일간 유효한 초대 링크 · 코드를 만들었습니다. 이전 초대는 취소되었습니다.');
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
        <div className="min-w-0 space-y-7">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check size={14} className="shrink-0 text-brand" aria-hidden="true" />
                <span>로그인한 계정에 소속 팀과 역할이 안전하게 보관됩니다.</span>
            </div>

            {/* 상태 메시지 피드백 */}
            {message && (
                <Notice tone={pending ? 'info' : isError ? 'error' : 'success'} className="break-words">
                    {pending ? '처리 중…' : message}
                </Notice>
            )}

            {team ? (
                <>
                    {/* 지금 팀 (다른 팀은 위의 팀 바꾸기에서) · 콘티 링크 */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-muted-foreground">지금 팀{teams.length > 1 ? ` · ${teams.length}개 팀 중` : ''}</p>
                            <p className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
                                {team.name} <span className="text-sm font-normal tabular-nums text-muted-foreground">{team.members.length}명</span>
                            </p>
                        </div>
                        <Link className={cn(buttonVariants(), 'sm:ml-auto')} href="/dashboard/songs">
                            <Sparkles aria-hidden="true" />
                            <span>이 팀의 콘티 준비</span>
                        </Link>
                    </div>

                    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_auto_1fr] xl:gap-x-12">
                        {/* 인원 넣기 섹션 (직접 추가 + 텍스트 일괄 붙여넣기) */}
                        {isOwner && (
                            <section aria-labelledby={`${sectionId}-add`} className="@container min-w-0 xl:col-start-2 xl:row-start-1">
                                <h2 id={`${sectionId}-add`} className={sectionTitle}>
                                    인원 넣기 (팀원 직접 등록)
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    초대 링크 가입을 기다리지 않고, 사역자 명단과 역할을 관리자가 바로 추가합니다.
                                </p>

                                <form onSubmit={handleAddDirectMember} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 @lg:grid-cols-[minmax(0,1fr)_10rem_auto]">
                                    <label className={cn(labelClass, 'col-span-2 @lg:col-span-1')}>
                                        팀원 이름
                                        <Input
                                            className="mt-1.5"
                                            value={directName}
                                            onChange={(e) => setDirectName(e.target.value)}
                                            placeholder="예: 김철수"
                                            maxLength={40}
                                            required
                                        />
                                    </label>
                                    <label className={labelClass}>
                                        담당 역할 (파트)
                                        <Select
                                            className="mt-1.5"
                                            value={directRole}
                                            onChange={(e) => setDirectRole(e.target.value as WorshipRole)}
                                        >
                                            {Object.entries(worshipRoles).map(([k, label]) => (
                                                <option key={k} value={k}>
                                                    {label}
                                                </option>
                                            ))}
                                        </Select>
                                    </label>
                                    <Button type="submit" disabled={pending || !directName.trim()}>
                                        <Plus aria-hidden="true" />
                                        <span>추가</span>
                                    </Button>
                                </form>

                                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setBatchOpen(true)}>
                                    <ClipboardList aria-hidden="true" />
                                    <span>명단 텍스트 일괄 붙여넣기</span>
                                </Button>
                            </section>
                        )}

                        {/* 초대 링크 섹션 */}
                        <section aria-labelledby={`${sectionId}-invite`} className={cn('min-w-0 xl:col-start-2', isOwner ? 'xl:row-start-2' : 'xl:row-start-1')}>
                            <h2 id={`${sectionId}-invite`} className={sectionTitle}>카카오톡 · 링크로 초대</h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                링크를 열거나, 앱의 &lsquo;초대 코드로 참여&rsquo;에 8자리 코드를 입력하면 참여해요.
                            </p>

                            {isOwner ? (
                                <div className="mt-4 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant={invite ? 'outline' : 'default'} disabled={pending} onClick={createInvitation}>
                                            <Link2 aria-hidden="true" />
                                            <span>{invite ? '새 링크로 교체 발급' : '초대 링크 만들기'}</span>
                                        </Button>
                                        <Button variant="outline" disabled={pending} onClick={revoke}>
                                            초대 링크 만료·취소
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        새 링크를 만들면 이전 링크는 자동 만료됩니다. (초대 유효 기간: 7일)
                                    </p>
                                    {invite && (
                                        <div className={cn('space-y-4 rounded-3xl p-4 sm:p-5', TONE_BLOCK.mint)}>
                                            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                                <span className={cn('inline-flex items-center gap-1.5 font-semibold', STATUS.ok.text)}>
                                                    <span className={cn('size-1.5 rounded-full', STATUS.ok.dot)} aria-hidden="true" />
                                                    초대 가능
                                                </span>
                                                <span className="text-muted-foreground">
                                                    만료일: {new Date(invite.expiresAt).toLocaleDateString('ko-KR')}
                                                </span>
                                            </p>
                                            <InviteCode code={invite.code} />
                                            {invite.url ? <InviteShareButtons key={invite.url} url={invite.url} teamName={team.name} /> : (
                                                <p className="text-xs text-muted-foreground">링크를 다시 보내려면 &lsquo;새 링크로 교체 발급&rsquo;을 눌러주세요 (코드도 바뀌어요).</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs font-medium text-muted-foreground">
                                    초대 링크 발급은 팀 관리자 권한이 필요합니다.
                                </p>
                            )}
                        </section>

                        {/* 팀원 명단 */}
                        <section aria-labelledby={`${sectionId}-roster`} className="min-w-0 xl:col-start-1 xl:row-span-3 xl:row-start-1">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 id={`${sectionId}-roster`} className={sectionTitle}>
                                        팀원 명단 & 역할 배분{' '}
                                        <span className="font-normal tabular-nums text-muted-foreground">{team.members.length}명</span>
                                    </h2>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                        각 팀원의 예배 담당 역할을 설정하고 관리 권한을 지정할 수 있습니다.
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" className="-mr-2 shrink-0 text-muted-foreground" disabled={pending} onClick={() => router.refresh()}>
                                    <RefreshCw className={cn(pending && 'animate-spin')} aria-hidden="true" />
                                    <span>새로고침</span>
                                </Button>
                            </div>

                            {/* 팀원 빠른 검색 & 역할별 필터 */}
                            <div className="mt-4 space-y-3">
                                <div className="relative">
                                    <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    <input
                                        type="text"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        placeholder="팀원 이름 또는 파트 검색..."
                                        className={cn(searchFieldClass, 'h-11 pl-11', memberSearch && 'pr-24')}
                                    />
                                    {memberSearch ? (
                                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                                            <span className="text-xs tabular-nums text-muted-foreground">{filteredMembers.length}명</span>
                                            <button
                                                type="button"
                                                onClick={() => setMemberSearch('')}
                                                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                                                title="검색어 지우기"
                                            >
                                                <X size={14} aria-hidden="true" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                {/* 역할별 필터 칩 */}
                                <div role="group" aria-label="파트별 필터" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
                                    <button
                                        type="button"
                                        aria-pressed={memberRoleFilter === 'all'}
                                        onClick={() => setMemberRoleFilter('all')}
                                        className={cn(filterChip, memberRoleFilter === 'all' ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
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
                                                className={cn(filterChip, memberRoleFilter === r ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
                                            >
                                                <span>{worshipRoles[r]}</span>
                                                <span className="tabular-nums opacity-60">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 팀원 목록 */}
                            {filteredMembers.length === 0 ? (
                                <div className="mt-4 rounded-3xl border border-dashed border-input px-5 py-8 text-center">
                                    <p className="text-[15px] font-medium text-foreground">조건에 일치하는 팀원이 없습니다.</p>
                                    <p className="mt-1 text-xs text-muted-foreground">검색어를 변경하거나 파트 필터를 초기화해 보세요.</p>
                                    {(memberSearch || memberRoleFilter !== 'all') && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            className="mt-4"
                                            onClick={() => { setMemberSearch(''); setMemberRoleFilter('all'); }}
                                        >
                                            <RotateCcw aria-hidden="true" />
                                            <span>검색 및 필터 초기화</span>
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <ul className="mt-2 divide-y divide-border/70">
                                    {filteredMembers.map((member) => {
                                        const isMe = member.userId === userId;
                                        const isManager = member.permission === 'owner';
                                        // 만든 사람의 줄은 본인만 바꿀 수 있습니다.
                                        const protectedRow = member.userId === team.ownerId && !isCreator;
                                        return (
                                            <li key={member.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3.5">
                                                <Avatar name={member.name} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex min-w-0 items-center gap-1.5">
                                                        <span className="truncate text-[15px] font-medium text-foreground">{member.name}</span>
                                                        {isMe && <span className="shrink-0 text-[11px] font-semibold text-brand">나</span>}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                        주 역할: {worshipRoles[member.role] ?? member.role}
                                                        <span aria-hidden="true"> · </span>
                                                        <span className={cn(isManager && 'font-medium text-foreground')}>{member.userId === team.ownerId ? '만든 사람 · 관리자' : isManager ? '관리자' : '팀원'}</span>
                                                        {member.userId.startsWith('direct-') && (
                                                            <>
                                                                <span aria-hidden="true"> · </span>
                                                                직접 등록
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className={cn('flex items-center gap-1.5', isOwner ? 'w-full pl-12 sm:w-auto sm:pl-0' : 'shrink-0')}>
                                                    <label className={cn('min-w-0', isOwner ? 'flex-1 sm:w-36 sm:flex-none' : 'w-32')}>
                                                        <span className="sr-only">{member.name} 담당 역할</span>
                                                        <Select
                                                            // 관리자가 아니면 바꿀 수 없으므로 회색 칩처럼 보여줍니다.
                                                            className={cn('h-10', !isOwner && 'disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100')}
                                                            value={member.role}
                                                            disabled={!isOwner || pending}
                                                            onChange={(event) => assign(member.userId, event.target.value as WorshipRole)}
                                                        >
                                                            {Object.entries(worshipRoles).map(([key, label]) => (
                                                                <option key={key} value={key}>
                                                                    {label}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    </label>

                                                    {isOwner && (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                title={isManager ? '관리자 권한 해제' : '관리자 권한 부여'}
                                                                className={cn('h-10 w-10 shrink-0 px-0 md:w-28', isManager ? 'text-foreground' : 'text-muted-foreground')}
                                                                disabled={pending || protectedRow || (member.userId.startsWith('direct-') && !isManager)}
                                                                onClick={() => handleTogglePermission(member.userId, member.permission)}
                                                            >
                                                                <Shield aria-hidden="true" />
                                                                <span className="hidden md:inline">{isManager ? '관리자 해제' : '관리자 지정'}</span>
                                                            </Button>

                                                            {isMe || protectedRow ? (
                                                                // 줄마다 버튼 위치가 맞도록 자기 자신 줄에는 빈 자리를 둡니다.
                                                                <span className="h-10 w-10 shrink-0 md:w-[4.5rem]" aria-hidden="true" />
                                                            ) : (
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive-outline"
                                                                    size="sm"
                                                                    title="팀에서 제외"
                                                                    className="h-10 w-10 shrink-0 px-0 md:w-[4.5rem]"
                                                                    disabled={pending}
                                                                    onClick={() => handleRemoveMember(member.userId, member.name)}
                                                                >
                                                                    <Trash2 aria-hidden="true" />
                                                                    <span className="hidden md:inline">제외</span>
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>

                    {/* 권한 · 내 이름 */}
                    {me ? (
                        <div className="grid gap-10 border-t border-border/70 pt-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-x-12">
                            <TeamPolicyPanel teamId={team.id} policy={policy} me={me} titleClassName={sectionTitle} />
                            <ProfileNameField name={profileName} titleClassName={sectionTitle} />
                        </div>
                    ) : null}
                </>
            ) : (
                <div className="rounded-3xl border border-dashed border-input px-5 py-10 text-center">
                    <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden="true">
                        <UsersRound size={18} />
                    </span>
                    <p className="mt-3 text-[15px] font-semibold text-foreground">아직 참여 중인 팀이 없습니다.</p>
                    <p className="mt-1 text-xs text-muted-foreground">새 팀을 만들거나 전달받은 초대 링크를 열어 참여하세요.</p>
                </div>
            )}

            {/* 새 팀 만들기: 레퍼런스의 '+' 펼침 줄 */}
            <details open={!teams.length} className="group/create border-y border-border/70 py-1.5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground" aria-hidden="true">
                        <Plus size={18} strokeWidth={2.25} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-foreground">새 예배팀 만들기</span>
                    <ChevronDown size={16} className="text-muted-foreground transition group-open/create:rotate-180" aria-hidden="true" />
                </summary>
                <form onSubmit={create} className="flex flex-col gap-3 pb-4 pt-2 sm:flex-row sm:items-end">
                    <label className={cn(labelClass, 'flex-1 sm:max-w-sm')}>
                        새 팀 명칭
                        <Input
                            className="mt-1.5"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={40}
                            placeholder="예: 주일 2부 찬양팀"
                        />
                    </label>
                    <Button type="submit" disabled={pending || !name.trim()}>
                        <Plus aria-hidden="true" />
                        <span>팀 만들기</span>
                    </Button>
                </form>
            </details>

            {/* 위험 구역: 팀 탈퇴 / 팀 삭제 */}
            {team && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle size={14} className={STATUS.warn.text} aria-hidden="true" />
                        <span>팀 탈퇴 및 삭제 관리</span>
                    </p>
                    {isCreator ? (
                        <Button type="button" variant="destructive-outline" size="sm" onClick={handleDeleteTeam} disabled={pending}>
                            팀 영구 삭제
                        </Button>
                    ) : (
                        <Button type="button" variant="outline" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleLeaveTeam} disabled={pending}>
                            <LogOut aria-hidden="true" />
                            <span>팀 나가기</span>
                        </Button>
                    )}
                </div>
            )}

            {/* 명단 텍스트 일괄 붙여넣기 모달 */}
            {batchOpen && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={batchInputId}
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-in fade-in sm:items-center sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setBatchOpen(false);
                    }}
                >
                    <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl animate-in slide-in-from-bottom duration-200 sm:rounded-3xl sm:pb-0 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                        {/* 모바일 바텀시트 핸들 바 */}
                        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-border sm:hidden" />

                        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={iconTile} aria-hidden="true">
                                    <ClipboardList size={18} />
                                </span>
                                <h2 id={batchInputId} className={sectionTitle}>
                                    명단 텍스트 일괄 붙여넣기
                                </h2>
                            </div>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="닫기" className="-mr-2 shrink-0 text-muted-foreground" onClick={() => setBatchOpen(false)}>
                                <X size={18} aria-hidden="true" />
                            </Button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                카카오톡이나 명단 텍스트를 줄 단위로 붙여넣으세요. 이름과 파트를 자동으로 인식합니다.
                                <br />
                                예: <code className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-foreground">김철수 보컬</code>, <code className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-foreground">이영희 (건반)</code>, <code className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-foreground">박민수 드럼</code>
                            </p>

                            <Textarea
                                className="h-36 resize-none"
                                placeholder="김철수 보컬&#10;이영희 건반&#10;박민수 드럼&#10;최기타 기타&#10;정베이스 베이스"
                                value={batchText}
                                onChange={(e) => setBatchText(e.target.value)}
                            />

                            {parsedBatch.length > 0 && (
                                <div className="max-h-36 overflow-y-auto">
                                    <p className="text-xs font-medium text-foreground">
                                        인식된 팀원 ({parsedBatch.length}명):
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {parsedBatch.map((item, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs"
                                            >
                                                <span className="font-semibold text-foreground">{item.name}</span>
                                                <span className="text-muted-foreground">({worshipRoles[item.role]})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
                                <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
                                    취소
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleAddBatchMembers}
                                    disabled={pending || parsedBatch.length === 0}
                                >
                                    {pending ? '등록 중…' : `${parsedBatch.length}명 일괄 등록하기`}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
