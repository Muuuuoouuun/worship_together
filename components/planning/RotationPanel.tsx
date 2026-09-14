'use client';

import { useId, useMemo, useState } from 'react';
import { canManagePlanning, planningDate, type PlanningPanelProps, type RotationGroup, type RotationTeam } from '@/types/planning';
import { worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, Users } from 'lucide-react';

const control = 'min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const button = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const primary = `${button} bg-primary text-primary-foreground`;
const disclosure = 'min-h-12 cursor-pointer rounded-lg px-2 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-ring';
const card = 'min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5';

export default function RotationPanel({ state, members, userId, busy, onCommand }: PlanningPanelProps) {
    const headingId = useId();
    const manager = canManagePlanning(members, userId);
    const names = useMemo(() => new Map(members.map(m => [m.userId, m.name])), [members]);
    const rotations = state.rotations ?? [];
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

    // 사역 밸런스(Workload) 통계: 최근 60일 내 일정에서 멤버별 배정 횟수 계산
    const workload = useMemo(() => {
        const stats = new Map<string, { total: number; confirmed: number; roles: Set<WorshipRole> }>();
        for (const member of members) {
            stats.set(member.userId, { total: 0, confirmed: 0, roles: new Set() });
        }
        for (const event of state.events) {
            if (event.cancelled) continue;
            for (const slot of event.slots) {
                if (slot.memberId && stats.has(slot.memberId)) {
                    const item = stats.get(slot.memberId)!;
                    item.total += 1;
                    if (slot.attendance === 'confirmed') item.confirmed += 1;
                    item.roles.add(slot.role);
                }
            }
        }
        return Array.from(stats.entries())
            .map(([memberId, data]) => ({
                memberId,
                name: names.get(memberId) ?? '팀원',
                ...data,
            }))
            .sort((a, b) => b.total - a.total);
    }, [members, state.events, names]);

    const run = async (command: Parameters<typeof onCommand>[0], successMsg: string) => {
        if (busy || pending) return false;
        setPending(true);
        setFeedback(null);
        try {
            const ok = await onCommand(command);
            setFeedback({ error: !ok, text: ok ? successMsg : '저장하지 못했습니다. 다시 시도해 주세요.' });
            return ok;
        } catch (e) {
            setFeedback({ error: true, text: e instanceof Error ? e.message : '요청을 처리하지 못했습니다.' });
            return false;
        } finally {
            setPending(false);
        }
    };

    // 다가오는 예정 일정 목록
    const upcomingEvents = useMemo(() => {
        const now = Date.now();
        return state.events
            .filter(e => !e.cancelled && Date.parse(e.endsAt) >= now)
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }, [state.events]);

    return (
        <section aria-labelledby={headingId} className="min-w-0 space-y-6">
            <header className="space-y-1">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="text-primary" size={22} />
                    <h2 id={headingId} className="text-xl font-bold">담당 & 로테이션 관리</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    조별 교대 및 파트별 순번 로테이션을 등록하고, 다가오는 일정에 클릭 한 번으로 배정합니다.
                </p>
            </header>

            <div role="status" aria-live="polite" className="text-sm font-semibold">
                {pending ? '처리 중…' : feedback ? (
                    <span className={feedback.error ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                        {feedback.text}
                    </span>
                ) : null}
            </div>

            {/* 1. 사역 밸런스 통계 (Workload Insight) */}
            <section aria-label="팀원별 사역 현황 통계" className={card}>
                <h3 className="flex items-center gap-2 font-bold text-base">
                    <Users size={18} className="text-secondary" />
                    팀원별 사역 현황 (서빙 횟수)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    특정 팀원에게 사역이 편중되지 않도록 최근 배정 횟수와 참여 파트를 점검하세요.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {workload.map(item => (
                        <div key={item.memberId} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                            <div className="min-w-0">
                                <p className="font-semibold truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {Array.from(item.roles).map(r => worshipRoles[r]).join(', ') || '배정 이력 없음'}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                    총 {item.total}회 배정
                                </span>
                                {item.confirmed > 0 ? (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">확정 {item.confirmed}회</p>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 2. 로테이션 생성 폼 (관리자 전용) */}
            {manager ? (
                <details className={card}>
                    <summary className={disclosure}>
                        <span className="inline-flex items-center gap-2">
                            <Plus size={16} /> 새 로테이션 그룹 만들기
                        </span>
                    </summary>
                    <div className="pt-3">
                        <RotationCreateForm
                            members={members}
                            disabled={busy || pending}
                            onSave={async group => {
                                const ok = await run({ type: 'rotation.save', group }, '새 로테이션 그룹을 생성했습니다.');
                                return ok;
                            }}
                        />
                    </div>
                </details>
            ) : null}

            {/* 3. 등록된 로테이션 그룹 목록 */}
            <section aria-label="등록된 로테이션 그룹 목록" className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">로테이션 그룹 ({rotations.length})</h3>
                </div>

                {rotations.length === 0 ? (
                    <div className={`${card} text-center py-8 space-y-2`}>
                        <ArrowLeftRight size={32} className="mx-auto text-muted-foreground opacity-50" />
                        <p className="font-semibold">등록된 로테이션이 없습니다.</p>
                        <p className="text-sm text-muted-foreground">
                            조별 교대(예: A조/B조 격주)나 파트별 순번(예: 싱어, 음향 로테이션)을 만들어 효율적으로 배정하세요.
                        </p>
                    </div>
                ) : null}

                <div className="space-y-4">
                    {rotations.map(rot => (
                        <RotationCard
                            key={rot.id}
                            rotation={rot}
                            names={names}
                            manager={manager}
                            disabled={busy || pending}
                            upcomingEvents={upcomingEvents}
                            onStep={(direction) => run({ type: 'rotation.step', rotationId: rot.id, direction }, '로테이션 순번을 변경했습니다.')}
                            onApply={(eventId) => run({ type: 'rotation.apply', rotationId: rot.id, eventId }, '로테이션 배정을 일정에 적용했습니다.')}
                            onRemove={() => run({ type: 'rotation.remove', rotationId: rot.id }, '로테이션 그룹을 삭제했습니다.')}
                        />
                    ))}
                </div>
            </section>
        </section>
    );
}

// 로테이션 카드 컴포넌트
function RotationCard({
    rotation,
    names,
    manager,
    disabled,
    upcomingEvents,
    onStep,
    onApply,
    onRemove,
}: {
    rotation: RotationGroup;
    names: Map<string, string>;
    manager: boolean;
    disabled: boolean;
    upcomingEvents: Parameters<typeof RotationPanel>[0]['state']['events'];
    onStep: (dir: 'next' | 'prev') => Promise<boolean>;
    onApply: (eventId: string) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
}) {
    const isTeam = rotation.cycleType === 'team';
    const teams = rotation.teams ?? [];
    const indivMembers = rotation.members ?? [];
    const totalSteps = isTeam ? teams.length : indivMembers.length;
    const currentStep = totalSteps > 0 ? rotation.currentStep % totalSteps : 0;

    const [selectedEventId, setSelectedEventId] = useState(upcomingEvents[0]?.id ?? '');
    const [confirmDelete, setConfirmDelete] = useState(false);

    // 현재 활성화된 순번/조 정보
    const currentTeam = isTeam && teams.length > 0 ? teams[currentStep] : null;
    const currentMemberId = !isTeam && indivMembers.length > 0 ? indivMembers[currentStep] : null;

    return (
        <article className={`${card} space-y-4`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-bold text-secondary">
                            {isTeam ? '조별 교대' : '개인 순번제'}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            {rotation.targetRole === 'all' ? '전체 역할' : worshipRoles[rotation.targetRole]}
                        </span>
                    </div>
                    <h4 className="mt-2 text-lg font-bold">{rotation.name}</h4>
                    {rotation.notes ? (
                        <p className="mt-1 text-sm text-muted-foreground">{rotation.notes}</p>
                    ) : null}
                </div>

                {manager ? (
                    confirmDelete ? (
                        <div className="flex items-center gap-1 text-xs">
                            <button
                                type="button"
                                className={`${button} text-destructive py-1 px-3 text-xs`}
                                disabled={disabled}
                                onClick={() => void onRemove()}
                            >
                                삭제 확정
                            </button>
                            <button
                                type="button"
                                className={`${button} py-1 px-2 text-xs`}
                                onClick={() => setConfirmDelete(false)}
                            >
                                취소
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="p-2 text-muted-foreground hover:text-destructive rounded-lg"
                            title="로테이션 삭제"
                            disabled={disabled}
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 size={16} />
                        </button>
                    )
                ) : null}
            </header>

            {/* 현재 순번 안내 배너 */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <span className="text-xs font-bold text-primary tracking-wide uppercase">현재 순번 (다음 배정 대상)</span>
                    {isTeam ? (
                        <div className="mt-1">
                            <strong className="text-base font-bold text-foreground">
                                {currentTeam ? `${currentStep + 1}순번: ${currentTeam.name}` : '조 없음'}
                            </strong>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {currentTeam?.memberIds.map(id => names.get(id) ?? '팀원').join(', ') || '배정된 팀원 없음'}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-1">
                            <strong className="text-base font-bold text-foreground">
                                {currentMemberId ? `${currentStep + 1}순번: ${names.get(currentMemberId) ?? '팀원'}` : '팀원 없음'}
                            </strong>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {rotation.targetRole === 'all' ? '전체 역할' : worshipRoles[rotation.targetRole]} 담당
                            </p>
                        </div>
                    )}
                </div>

                {manager && totalSteps > 0 ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={button}
                            disabled={disabled}
                            title="이전 순번으로"
                            onClick={() => void onStep('prev')}
                        >
                            <ChevronLeft size={16} /> 이전
                        </button>
                        <button
                            type="button"
                            className={button}
                            disabled={disabled}
                            title="다음 순번으로"
                            onClick={() => void onStep('next')}
                        >
                            다음 <ChevronRight size={16} />
                        </button>
                    </div>
                ) : null}
            </div>

            {/* 다가오는 일정에 원클릭 적용 섹션 */}
            {manager && totalSteps > 0 ? (
                <div className="rounded-xl border border-border bg-background p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles size={14} className="text-secondary" />
                        현재 순번을 일정에 원클릭 배정하기
                    </p>
                    {upcomingEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">배정 가능한 다가오는 일정이 없습니다.</p>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className={`${control} text-sm flex-1`}
                                value={selectedEventId}
                                onChange={e => setSelectedEventId(e.target.value)}
                            >
                                {upcomingEvents.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.title} · {planningDate(e.startsAt)}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className={`${primary} text-xs px-3 shrink-0`}
                                disabled={disabled || !selectedEventId}
                                onClick={() => void onApply(selectedEventId)}
                            >
                                배정 적용
                            </button>
                        </div>
                    )}
                </div>
            ) : null}

            {/* 전체 순환 목록 펼치기 */}
            <details>
                <summary className={disclosure}>
                    전체 순번 명단 확인하기 ({totalSteps}{isTeam ? '개 조' : '명'})
                </summary>
                <div className="mt-2 space-y-2 pt-2 border-t border-border">
                    {isTeam ? (
                        teams.map((t, idx) => (
                            <div
                                key={t.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                                    idx === currentStep ? 'bg-primary/10 font-bold text-primary border border-primary/20' : 'bg-muted/40'
                                }`}
                            >
                                <div>
                                    <span className="font-semibold">{idx + 1}순번: {t.name}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {t.memberIds.map(mid => names.get(mid) ?? '팀원').join(', ') || '팀원 없음'}
                                    </p>
                                </div>
                                {idx === currentStep ? (
                                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                        현재 차례
                                    </span>
                                ) : null}
                            </div>
                        ))
                    ) : (
                        indivMembers.map((mid, idx) => (
                            <div
                                key={mid + idx}
                                className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                                    idx === currentStep ? 'bg-primary/10 font-bold text-primary border border-primary/20' : 'bg-muted/40'
                                }`}
                            >
                                <span className="font-semibold">
                                    {idx + 1}순번: {names.get(mid) ?? '팀원'}
                                </span>
                                {idx === currentStep ? (
                                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                        현재 차례
                                    </span>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            </details>
        </article>
    );
}

// 로테이션 생성 폼 컴포넌트
function RotationCreateForm({
    members,
    disabled,
    onSave,
}: {
    members: TeamMember[];
    disabled: boolean;
    onSave: (group: {
        name: string;
        targetRole: WorshipRole | 'all';
        cycleType: 'team' | 'individual';
        teams?: RotationTeam[];
        members?: string[];
        notes?: string;
    }) => Promise<boolean>;
}) {
    const [name, setName] = useState('');
    const [cycleType, setCycleType] = useState<'team' | 'individual'>('team');
    const [targetRole, setTargetRole] = useState<WorshipRole | 'all'>('all');
    const [notes, setNotes] = useState('');

    // 조별 교대 설정용
    const [teamCount, setTeamCount] = useState(2);
    const [teams, setTeams] = useState<Array<{ name: string; memberIds: string[] }>>([
        { name: '1조', memberIds: [] },
        { name: '2조', memberIds: [] },
    ]);

    // 개인 순번제용
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [error, setError] = useState('');

    const handleTeamCountChange = (count: number) => {
        setTeamCount(count);
        setTeams(prev => {
            const next = [...prev];
            while (next.length < count) {
                next.push({ name: `${next.length + 1}조`, memberIds: [] });
            }
            return next.slice(0, count);
        });
    };

    const toggleTeamMember = (teamIdx: number, memberId: string) => {
        setTeams(prev => prev.map((t, idx) => {
            if (idx !== teamIdx) return t;
            const exists = t.memberIds.includes(memberId);
            return {
                ...t,
                memberIds: exists ? t.memberIds.filter(id => id !== memberId) : [...t.memberIds, memberId],
            };
        }));
    };

    const toggleIndivMember = (memberId: string) => {
        setSelectedMembers(prev => {
            const exists = prev.includes(memberId);
            return exists ? prev.filter(id => id !== memberId) : [...prev, memberId];
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) {
            setError('로테이션 이름을 입력해주세요.');
            return;
        }

        if (cycleType === 'team') {
            const validTeams = teams.map((t, i) => ({
                id: `team-${i + 1}`,
                name: t.name.trim() || `${i + 1}조`,
                memberIds: t.memberIds,
            }));
            if (validTeams.some(t => t.memberIds.length === 0)) {
                setError('모든 조에 최소 1명 이상의 팀원을 배정해주세요.');
                return;
            }
            const ok = await onSave({ name, cycleType, targetRole, teams: validTeams, notes });
            if (ok) {
                setName('');
                setNotes('');
            }
        } else {
            if (selectedMembers.length < 2) {
                setError('개인 순번제는 최소 2명 이상의 팀원을 선택해야 순환할 수 있습니다.');
                return;
            }
            const ok = await onSave({ name, cycleType, targetRole, members: selectedMembers, notes });
            if (ok) {
                setName('');
                setNotes('');
                setSelectedMembers([]);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {error ? <p role="alert" className="text-destructive font-medium">{error}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="font-semibold block mb-1">로테이션 이름 (필수)</label>
                    <input
                        className={control}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="예: 주일 2부 조별 교대, 싱어 순번"
                        required
                    />
                </div>
                <div>
                    <label className="font-semibold block mb-1">순환 주기 방식</label>
                    <select
                        className={control}
                        value={cycleType}
                        onChange={e => setCycleType(e.target.value as 'team' | 'individual')}
                    >
                        <option value="team">조별 교대 (1조, 2조 등 팀 단위)</option>
                        <option value="individual">개인 순번제 (파트별 1명씩 교대)</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="font-semibold block mb-1">대상 파트</label>
                <select
                    className={control}
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as WorshipRole | 'all')}
                >
                    <option value="all">전체 팀 (풀세션 조편성)</option>
                    {Object.entries(worshipRoles).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                    ))}
                </select>
            </div>

            {/* 조별 교대 설정 */}
            {cycleType === 'team' ? (
                <div className="space-y-3 rounded-xl border border-border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">조 개수 설정</span>
                        <select
                            className={`${control} w-28`}
                            value={teamCount}
                            onChange={e => handleTeamCountChange(Number(e.target.value))}
                        >
                            {[2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>{n}개 조</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {teams.map((t, idx) => (
                            <div key={idx} className="rounded-xl border border-border bg-card p-3 space-y-2">
                                <input
                                    className={`${control} font-bold`}
                                    value={t.name}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setTeams(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                                    }}
                                    placeholder={`${idx + 1}조 이름`}
                                />
                                <p className="text-xs text-muted-foreground">속할 팀원 선택 ({t.memberIds.length}명)</p>
                                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                    {members.map(m => {
                                        const checked = t.memberIds.includes(m.userId);
                                        return (
                                            <label
                                                key={m.userId}
                                                className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleTeamMember(idx, m.userId)}
                                                    className="rounded"
                                                />
                                                <span>{m.name} ({worshipRoles[m.role]})</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* 개인 순번제 설정 */
                <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/20">
                    <p className="font-semibold">순환할 팀원 선택 (체크 순서대로 순번 구성)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {members.map(m => {
                            const checked = selectedMembers.includes(m.userId);
                            const order = selectedMembers.indexOf(m.userId);
                            return (
                                <label
                                    key={m.userId}
                                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer text-xs ${
                                        checked ? 'border-primary bg-primary/10 font-bold' : 'border-border bg-card'
                                    }`}
                                    onClick={() => toggleIndivMember(m.userId)}
                                >
                                    <span>{m.name} ({worshipRoles[m.role]})</span>
                                    {checked ? (
                                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                                            {order + 1}
                                        </span>
                                    ) : null}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            <div>
                <label className="font-semibold block mb-1">메모 (선택)</label>
                <input
                    className={control}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="예: 1주/3주는 1조, 2주/4주는 2조 섬김"
                />
            </div>

            <button type="submit" className={primary} disabled={disabled}>
                로테이션 그룹 저장
            </button>
        </form>
    );
}
