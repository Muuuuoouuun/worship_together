'use client';

import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { ChevronDown, Copy, Plus, UserPlus, UsersRound } from 'lucide-react';
import TeamRosterTransfer from '@/components/team/TeamRosterTransfer';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import { Avatar } from '@/components/conti/ui';
import { ROLE_ICON } from '@/components/conti/planningUi';
import {
    assignPrototypeRole, createPrototypeTeam, getTeamServerSnapshot, getTeamSnapshot,
    joinPrototypeTeam, parseTeamSnapshot, selectPrototypeTeam, subscribeToTeams, teamRoles,
    type TeamRole,
} from '@/lib/teamPrototype';

/** 입력 칸 위의 작은 이름표 */
const labelClass = 'block text-xs font-medium text-muted-foreground';
/** 펼침 줄: 레퍼런스의 '+' 행과 같은 모양 */
const summaryClass = 'flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden';

/**
 * 로그인 없이 이 브라우저에만 저장하는 팀 체험.
 * 팀 화면의 '로그인 없이 먼저 체험하기' 펼침 안에 들어가므로 자체 페이지 제목·폭 제한을 두지 않습니다.
 */
export default function TeamManager({ initialInvite = '' }: { initialInvite?: string }) {
    const snapshot = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const { state, storageError } = useMemo(() => {
        try { return { state: parseTeamSnapshot(snapshot), storageError: '' }; }
        catch (error) { return { state: null, storageError: error instanceof Error ? error.message : '팀 데이터를 읽을 수 없습니다.' }; }
    }, [snapshot]);
    const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
    const [invite, setInvite] = useState(initialInvite);
    const [joinName, setJoinName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [leaderName, setLeaderName] = useState('');
    const team = state?.teams.find((item) => item.id === state.activeTeamId) ?? state?.teams[0];
    const unassignedCount = team?.members.filter((member) => member.role === 'member').length ?? 0;

    function perform(action: () => void, message: string): boolean {
        try {
            action();
            setNotice({ message, error: false });
            return true;
        } catch (error) {
            setNotice({ message: error instanceof Error ? error.message : '변경하지 못했습니다. 다시 시도해주세요.', error: true });
            return false;
        }
    }

    function createTeam(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (perform(() => createPrototypeTeam(teamName, leaderName), '팀을 이 브라우저에 저장했습니다. 초대 코드로 팀원 참여를 체험해보세요.')) {
            setTeamName(''); setLeaderName('');
        }
    }

    function joinTeam(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (perform(() => joinPrototypeTeam(invite, joinName), '팀원 참여를 이 브라우저에 저장했습니다. 아래에서 담당 역할을 지정해주세요.')) {
            setJoinName('');
        }
    }

    async function copyInvite(asLink: boolean) {
        if (!team) return;
        const value = asLink
            ? `${window.location.origin}/dashboard/team?invite=${encodeURIComponent(team.inviteCode)}`
            : team.inviteCode;
        try {
            await navigator.clipboard.writeText(value);
            setNotice({ message: `${asLink ? '체험용 링크' : '초대 코드'}를 복사했습니다. 같은 브라우저에서만 참여할 수 있습니다. 초대는 발송되지 않았습니다.`, error: false });
        } catch {
            setNotice({ message: '복사 권한이 없습니다. 아래 초대 코드를 길게 누르거나 선택해 직접 복사해주세요.', error: true });
        }
    }

    return (
        <div className="min-w-0 space-y-7">
            <aside className="rounded-2xl bg-muted px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground" aria-label="프로토타입 안내">
                <strong className="font-semibold text-foreground">이 브라우저에서만 저장되는 팀 관리 체험입니다.</strong>
                <p className="mt-1">같은 기기·브라우저·사이트 주소에서 초대 참여를 체험할 수 있습니다. 다른 기기로 명단을 옮기려면 파일 내보내기·가져오기를 이용하세요. 자동 동기화나 초대·알림 발송은 지원하지 않습니다. 브라우저 데이터를 지우면 팀도 삭제됩니다.</p>
                <p className="mt-1">선택한 팀으로 콘티를 준비합니다. 역할은 담당 표시이며 로그인 권한이 아닙니다.</p>
            </aside>

            {(storageError || notice) && (
                <div className="space-y-2">
                    {storageError && <Notice tone="error" className="break-words">{storageError}</Notice>}
                    {notice && <Notice tone={notice.error ? 'error' : 'success'} className="break-words">{notice.message}</Notice>}
                </div>
            )}

            {!team && !storageError && (
                <section className="rounded-3xl border border-dashed border-input px-5 py-8 text-center">
                    <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <UsersRound size={18} aria-hidden="true" />
                    </span>
                    <h2 className="mt-3 text-[15px] font-semibold text-foreground">첫 번째 예배 팀을 만들어보세요</h2>
                    <p className="mt-1 text-xs text-muted-foreground">팀 이름과 인도자 이름만 입력하면 초대 코드가 만들어집니다.</p>
                </section>
            )}

            <div className="divide-y divide-border/70 border-y border-border/70">
                <details className="group/create py-1.5" open={!team && !initialInvite}>
                    <summary className={summaryClass}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground" aria-hidden="true">
                            <Plus size={18} strokeWidth={2.25} />
                        </span>
                        <span className="flex-1 text-[15px] font-medium text-foreground">새 팀 만들기</span>
                        <ChevronDown size={16} className="text-muted-foreground transition group-open/create:rotate-180" aria-hidden="true" />
                    </summary>
                    <form onSubmit={createTeam} className="grid gap-3 pb-4 pt-2 sm:grid-cols-2">
                        <div className="min-w-0">
                            <label className={labelClass} htmlFor="team-name">팀 이름</label>
                            <Input id="team-name" className="mt-1.5" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="예: 주일 2부 찬양팀" required maxLength={40} />
                        </div>
                        <div className="min-w-0">
                            <label className={labelClass} htmlFor="leader-name">인도자 이름</label>
                            <Input id="leader-name" className="mt-1.5" value={leaderName} onChange={(event) => setLeaderName(event.target.value)} placeholder="예: 김은혜" required maxLength={40} autoComplete="name" />
                        </div>
                        <Button className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start sm:px-6" disabled={Boolean(storageError)} type="submit">팀 만들고 저장</Button>
                    </form>
                </details>
                <details className="group/join py-1.5" open={Boolean(initialInvite)}>
                    <summary className={summaryClass}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground" aria-hidden="true">
                            <UserPlus size={17} />
                        </span>
                        <span className="flex-1 text-[15px] font-medium text-foreground">초대로 참여 체험</span>
                        <ChevronDown size={16} className="text-muted-foreground transition group-open/join:rotate-180" aria-hidden="true" />
                    </summary>
                    <form onSubmit={joinTeam} className="grid gap-3 pb-4 pt-2 sm:grid-cols-2">
                        <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">팀을 만든 이 브라우저에서 새 팀원의 이름으로 참여를 체험합니다.</p>
                        <div className="min-w-0">
                            <label className={labelClass} htmlFor="invite-code">초대 코드 또는 링크</label>
                            <Input id="invite-code" className="mt-1.5" value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="8자리 초대 코드" required maxLength={2048} spellCheck={false} autoCapitalize="characters" />
                        </div>
                        <div className="min-w-0">
                            <label className={labelClass} htmlFor="join-name">참여할 팀원 이름</label>
                            <Input id="join-name" className="mt-1.5" value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="이름을 입력하세요" required maxLength={40} autoComplete="off" />
                        </div>
                        <Button className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start sm:px-6" disabled={Boolean(storageError)} type="submit">참여하고 저장</Button>
                    </form>
                </details>
            </div>

            {team && state ? (
                <section className="space-y-6" aria-labelledby="members-heading">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 flex-1 sm:max-w-sm">
                            <label htmlFor="active-team" className={labelClass}>관리할 팀</label>
                            <Select id="active-team" className="mt-1.5" value={team.id} onChange={(event) => perform(() => selectPrototypeTeam(event.target.value), '선택한 팀을 저장했습니다.')}>
                                {state.teams.map((item) => <option key={item.id} value={item.id}>{item.name}{item.snapshotImportedAt ? ' · 가져온 사본' : ''}</option>)}
                            </Select>
                        </div>
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground sm:pb-3">팀원 {team.members.length}명 · 역할 미정 {unassignedCount}명</p>
                    </div>

                    {team.snapshotImportedAt && <Notice tone="info" className="font-normal text-muted-foreground">파일에서 가져온 독립된 사본입니다. 이곳에서 변경한 명단과 역할은 원래 팀에 전달되지 않습니다.</Notice>}

                    <div className="rounded-3xl bg-muted/60 p-4 sm:p-5">
                        <label htmlFor="current-invite" className={labelClass}>이 팀의 체험용 초대 코드</label>
                        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                            <Input id="current-invite" aria-describedby="invite-help" value={team.inviteCode} readOnly onFocus={(event) => event.target.select()} className="h-12 font-mono text-lg tracking-[0.2em] sm:text-lg" />
                            <div className="grid shrink-0 grid-cols-2 gap-2">
                                <Button type="button" className="h-12" onClick={() => void copyInvite(false)}><Copy aria-hidden="true" /> 코드 복사</Button>
                                <Button type="button" variant="outline" className="h-12" onClick={() => void copyInvite(true)}><Copy aria-hidden="true" /> 체험용 링크 복사</Button>
                            </div>
                        </div>
                        <p id="invite-help" className="mt-2.5 text-xs leading-relaxed text-muted-foreground">복사만 하며 발송하지 않습니다. 링크도 이 브라우저에서만 동작합니다.</p>
                    </div>

                    <div>
                        <h2 id="members-heading" className="text-[17px] font-semibold tracking-tight text-foreground">팀원별 담당 역할</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">선택하면 바로 저장됩니다. 인도자를 바꾸려면 다른 팀원을 먼저 인도자로 지정하세요.</p>
                        <ul className="mt-2 divide-y divide-border/70">
                            {team.members.map((member) => {
                                const Icon = ROLE_ICON[member.role];
                                return (
                                    <li key={member.id} className="flex min-w-0 items-center gap-3 py-3">
                                        <Avatar name={member.name} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-[15px] font-medium text-foreground">{member.name}</p>
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                <Icon size={12} aria-hidden="true" />
                                                {teamRoles[member.role]}
                                            </p>
                                        </div>
                                        <label htmlFor={`role-${member.id}`} className="block w-36 shrink-0">
                                            <span className="sr-only">{member.name} 담당 역할</span>
                                            <Select id={`role-${member.id}`} className="h-10" value={member.role} onChange={(event) => perform(() => assignPrototypeRole(team.id, member.id, event.target.value as TeamRole), `${member.name} 님의 역할을 저장했습니다.`)}>
                                                {Object.entries(teamRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                            </Select>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </section>
            ) : null}

            <TeamRosterTransfer teamId={team?.id} teamName={team?.name} disabled={Boolean(storageError)} />
        </div>
    );
}
