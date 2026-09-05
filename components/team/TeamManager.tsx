'use client';

import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Copy, UserPlus, UsersRound } from 'lucide-react';
import TeamRosterTransfer from '@/components/team/TeamRosterTransfer';
import {
    assignPrototypeRole, createPrototypeTeam, getTeamServerSnapshot, getTeamSnapshot,
    joinPrototypeTeam, parseTeamSnapshot, selectPrototypeTeam, subscribeToTeams, teamRoles,
    type TeamRole,
} from '@/lib/teamPrototype';

const fieldClass = 'min-h-12 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const buttonClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
const panelClass = 'min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6';

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
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <header>
                <p className="text-sm font-semibold text-secondary">함께 준비하는 예배</p>
                <h1 className="mt-2 text-3xl font-bold text-primary sm:text-4xl">팀 구성과 역할</h1>
                <p className="mt-3 text-base text-muted-foreground">팀을 만들고, 팀원을 초대하고, 각자의 담당을 정하세요.</p>
            </header>

            <aside className="rounded-xl border border-border bg-muted p-4 text-sm leading-relaxed text-foreground" aria-label="프로토타입 안내">
                <strong>이 브라우저에서만 저장되는 팀 관리 체험입니다.</strong>
                <p className="mt-1">같은 기기·브라우저·사이트 주소에서 초대 참여를 체험할 수 있습니다. 다른 기기로 명단을 옮기려면 파일 내보내기·가져오기를 이용하세요. 자동 동기화나 초대·알림 발송은 지원하지 않습니다. 브라우저 데이터를 지우면 팀도 삭제됩니다.</p>
                <p className="mt-1">선택한 팀으로 콘티를 준비합니다. 역할은 담당 표시이며 로그인 권한이 아닙니다.</p>
            </aside>

            {storageError && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-destructive">{storageError}</p>}
            {notice && <p role={notice.error ? 'alert' : 'status'} className={`break-words rounded-lg border p-4 text-sm ${notice.error ? 'border-destructive/30 text-destructive' : 'border-border bg-muted text-foreground'}`}>{notice.message}</p>}

            <div className="grid gap-4 md:grid-cols-2">
                <details className={panelClass} open={!team && !initialInvite}>
                    <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-bold text-primary"><UsersRound size={20} aria-hidden="true" /> 새 팀 만들기</summary>
                    <form onSubmit={createTeam} className="mt-4 space-y-4">
                        <label className="block text-sm font-semibold" htmlFor="team-name">팀 이름
                            <input id="team-name" className={`${fieldClass} mt-2`} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="예: 주일 2부 찬양팀" required maxLength={40} />
                        </label>
                        <label className="block text-sm font-semibold" htmlFor="leader-name">인도자 이름
                            <input id="leader-name" className={`${fieldClass} mt-2`} value={leaderName} onChange={(event) => setLeaderName(event.target.value)} placeholder="예: 김은혜" required maxLength={40} autoComplete="name" />
                        </label>
                        <button className={`${buttonClass} w-full`} disabled={Boolean(storageError)} type="submit">팀 만들고 저장</button>
                    </form>
                </details>
                <details className={panelClass} open={Boolean(initialInvite)}>
                    <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-bold text-primary"><UserPlus size={20} aria-hidden="true" /> 초대로 참여 체험</summary>
                    <form onSubmit={joinTeam} className="mt-4 space-y-4">
                        <p className="text-sm text-muted-foreground">팀을 만든 이 브라우저에서 새 팀원의 이름으로 참여를 체험합니다.</p>
                        <label className="block text-sm font-semibold" htmlFor="invite-code">초대 코드 또는 링크
                            <input id="invite-code" className={`${fieldClass} mt-2`} value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="8자리 초대 코드" required maxLength={2048} spellCheck={false} autoCapitalize="characters" />
                        </label>
                        <label className="block text-sm font-semibold" htmlFor="join-name">참여할 팀원 이름
                            <input id="join-name" className={`${fieldClass} mt-2`} value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="이름을 입력하세요" required maxLength={40} autoComplete="off" />
                        </label>
                        <button className={`${buttonClass} w-full`} disabled={Boolean(storageError)} type="submit">참여하고 저장</button>
                    </form>
                </details>
            </div>

            <TeamRosterTransfer teamId={team?.id} teamName={team?.name} disabled={Boolean(storageError)} />

            {team && state ? (
                <section className={panelClass} aria-labelledby="members-heading">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <label htmlFor="active-team" className="text-sm font-semibold">관리할 팀</label>
                            <select id="active-team" className={`${fieldClass} mt-2 max-w-md`} value={team.id} onChange={(event) => perform(() => selectPrototypeTeam(event.target.value), '선택한 팀을 저장했습니다.')}>
                                {state.teams.map((item) => <option key={item.id} value={item.id}>{item.name}{item.snapshotImportedAt ? ' · 가져온 사본' : ''}</option>)}
                            </select>
                        </div>
                        <p className="shrink-0 text-sm text-muted-foreground">팀원 {team.members.length}명 · 역할 미정 {unassignedCount}명</p>
                    </div>

                    {team.snapshotImportedAt && <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">파일에서 가져온 독립된 사본입니다. 이곳에서 변경한 명단과 역할은 원래 팀에 전달되지 않습니다.</p>}

                    <div className="my-6 rounded-lg border border-border bg-background p-4">
                        <label htmlFor="current-invite" className="text-sm font-semibold">이 팀의 체험용 초대 코드</label>
                        <input id="current-invite" aria-describedby="invite-help" value={team.inviteCode} readOnly onFocus={(event) => event.target.select()} className={`${fieldClass} mt-2 font-mono text-xl tracking-widest`} />
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button type="button" className={buttonClass} onClick={() => void copyInvite(false)}><Copy size={16} aria-hidden="true" /> 코드 복사</button>
                            <button type="button" className={`${buttonClass} border border-border bg-card text-foreground`} onClick={() => void copyInvite(true)}><Copy size={16} aria-hidden="true" /> 체험용 링크 복사</button>
                        </div>
                        <p id="invite-help" className="mt-3 text-sm text-muted-foreground">복사만 하며 발송하지 않습니다. 링크도 이 브라우저에서만 동작합니다.</p>
                    </div>

                    <h2 id="members-heading" className="text-xl font-bold text-primary">팀원별 담당 역할</h2>
                    <p className="mt-2 text-sm text-muted-foreground">선택하면 바로 저장됩니다. 인도자를 바꾸려면 다른 팀원을 먼저 인도자로 지정하세요.</p>
                    <ul className="mt-4 divide-y divide-border">
                        {team.members.map((member) => (
                            <li key={member.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[1fr_12rem] sm:items-center">
                                <span className="min-w-0 break-words font-semibold">{member.name}</span>
                                <label htmlFor={`role-${member.id}`} className="block">
                                    <span className="sr-only">{member.name} 담당 역할</span>
                                    <select id={`role-${member.id}`} className={fieldClass} value={member.role} onChange={(event) => perform(() => assignPrototypeRole(team.id, member.id, event.target.value as TeamRole), `${member.name} 님의 역할을 저장했습니다.`)}>
                                        {Object.entries(teamRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : !storageError ? (
                <section className={`${panelClass} text-center`}>
                    <UsersRound className="mx-auto text-secondary" size={32} aria-hidden="true" />
                    <h2 className="mt-3 text-xl font-bold text-primary">첫 번째 예배 팀을 만들어보세요</h2>
                    <p className="mt-2 text-sm text-muted-foreground">팀 이름과 인도자 이름만 입력하면 초대 코드가 만들어집니다.</p>
                </section>
            ) : null}
        </div>
    );
}
