'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bell, CalendarDays, MessageSquare, RefreshCw } from 'lucide-react';
import { loadPlanningContext, updateTeamPlanning } from '@/actions/planningActions';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '@/lib/planning';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';
import { emptyPlanningState, planningDate, type PlanningCommand, type PlanningState } from '@/types/planning';
import type { OnlineTeam, TeamMember } from '@/types/team';
import RequestsPanel from './RequestsPanel';
import SchedulePanel from './SchedulePanel';

const field = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-base text-foreground';
const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted! disabled:text-muted-foreground!';
type Props = { teams: OnlineTeam[]; userId?: string; initialTeamId?: string; initialTab?: string; initialSetlist?: { id: string; title: string } };
const demoMembers: TeamMember[] = [
    { userId: 'demo-leader', name: '예시 인도자', role: 'leader', permission: 'owner' },
    { userId: 'demo-vocal', name: '예시 보컬', role: 'vocal', permission: 'member' },
    { userId: 'demo-drums', name: '예시 드럼', role: 'drums', permission: 'member' },
    { userId: 'demo-guitar', name: '예시 기타', role: 'guitar', permission: 'member' },
];

export default function PlanningWorkspace(props: Props) {
    return props.teams.length && props.userId ? <OnlinePlanning {...props} /> : <LocalPlanning {...props} />;
}
function OnlinePlanning(props: Props) {
    const [selected, setSelected] = useState(props.initialTeamId ?? props.teams[0].id);
    const team = props.teams.find(item => item.id === selected) ?? props.teams[0];
    return <div className="space-y-5"><label className="block max-w-md text-sm font-semibold">함께 준비할 팀<select className={field} value={team.id} onChange={event => setSelected(event.target.value)}>{props.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Board key={team.id} teamId={team.id} members={team.members} userId={props.userId!} online initialTab={props.initialTab} initialSetlist={team.id === props.initialTeamId ? props.initialSetlist : undefined} /></div>;
}
function LocalPlanning(props: Props) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const [selected, setSelected] = useState(props.initialTeamId ?? '');
    const [actor, setActor] = useState('');
    const parsed = useMemo(() => { try { return { value: parseTeamSnapshot(raw), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : '팀 자료를 읽지 못했습니다.' }; } }, [raw]);
    if (!parsed.value) return <p role="alert">{parsed.error}</p>;
    const teams = parsed.value.teams;
    const team = teams.find(item => item.id === selected) ?? teams.find(item => item.id === parsed.value?.activeTeamId) ?? teams[0];
    const teamId = team?.id ?? DEMO_TEAM_ID;
    const members: TeamMember[] = team ? team.members.map((member, index) => ({ userId: member.id, name: member.name, role: member.role, permission: index === 0 ? 'owner' : 'member' })) : demoMembers;
    const userId = members.some(member => member.userId === actor) ? actor : members[0].userId;
    return <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-muted p-5"><p className="font-bold">로그인 없이 일정·요청 체험</p><p className="mt-2 text-sm leading-6 text-muted-foreground">이 브라우저에만 저장됩니다. 체험할 팀원을 바꾸면 요청 수신과 대체 지원을 확인할 수 있습니다. 실제 팀에 알림을 보내지 않습니다.</p><Link className="mt-3 inline-flex min-h-12 items-center text-sm font-bold underline underline-offset-4" href="/dashboard/team">로그인하고 온라인 팀 준비하기</Link><div className="mt-2 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">체험 팀<select className={field} value={teamId} onChange={event => { setSelected(event.target.value); setActor(''); }}>{teams.length ? teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : <option value={DEMO_TEAM_ID}>예시 예배팀</option>}</select></label><label className="text-sm font-semibold">체험할 팀원<select className={field} value={userId} onChange={event => setActor(event.target.value)}>{members.map(member => <option key={member.userId} value={member.userId}>{member.name}{member.permission === 'owner' ? ' · 관리자' : ''}</option>)}</select></label></div></section>
        <Board key={`${teamId}:${userId}`} teamId={teamId} members={members} userId={userId} online={false} initialTab={props.initialTab} initialSetlist={!props.initialTeamId || teamId === props.initialTeamId ? props.initialSetlist : undefined} />
    </div>;
}
function Board({ teamId, members, userId, online, initialTab, initialSetlist }: { teamId: string; members: TeamMember[]; userId: string; online: boolean; initialTab?: string; initialSetlist?: Props['initialSetlist'] }) {
    const searchParams = useSearchParams();
    const [inboxOpen, setInboxOpen] = useState(searchParams.get('inbox') === '1');
    const [state, setState] = useState<PlanningState>(emptyPlanningState);
    const [tab, setTab] = useState(initialTab === 'requests' ? 'requests' : 'schedule');
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState('');
    const revision = useRef(0);
    const inFlight = useRef(false);
    const polling = useRef(false);
    const seen = useRef<Set<string> | null>(null);
    const key = `worship-planning:v1:${teamId}`;
    const [roster, setRoster] = useState(members);
    const receive = useCallback((next: PlanningState) => {
        if (seen.current) {
            const newUrgent = next.notifications.find(item => item.urgent && !item.readBy.includes(userId) && !seen.current!.has(item.id));
            if (newUrgent) setToast(newUrgent.title + ' · ' + newUrgent.body);
        }
        seen.current = new Set(next.notifications.map(item => item.id));
        setState(next); setLoaded(true);
    }, [userId]);
    const refresh = useCallback(async () => {
        if (inFlight.current || polling.current) return;
        polling.current = true;
        const current = revision.current;
        try {
            const result = online ? await loadPlanningContext(teamId) : { ok: true as const, value: { state: planningForViewer(parsePlanningState(JSON.parse(localStorage.getItem(key) ?? 'null')), members, userId), members } };
            if (revision.current !== current) return;
            if (!result.ok) throw new Error(result.error);
            setRoster(result.value.members); receive(result.value.state); setError('');
        } catch (cause) { if (revision.current === current) setError(cause instanceof Error ? cause.message : '새 알림을 확인하지 못했습니다. 다시 시도해주세요.'); }
        finally { polling.current = false; }
    }, [key, online, receive, members, teamId, userId]);
    useEffect(() => {
        void refresh();
        const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
        const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) void refresh(); };
        const timer = online ? setInterval(visibleRefresh, 15000) : undefined;
        window.addEventListener('focus', visibleRefresh);
        document.addEventListener('visibilitychange', visibleRefresh);
        window.addEventListener('storage', storage);
        window.addEventListener('worship-planning-changed', visibleRefresh);
        return () => { clearInterval(timer); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); window.removeEventListener('storage', storage); window.removeEventListener('worship-planning-changed', visibleRefresh); };
    }, [key, online, refresh]);
    async function onCommand(command: PlanningCommand): Promise<boolean> {
        if (inFlight.current || !loaded) return false;
        inFlight.current = true; revision.current++; setBusy(true); setError(''); setMessage('');
        try {
            let next: PlanningState;
            if (online) { const result = await updateTeamPlanning(teamId, command); if (!result.ok) throw new Error(result.error); next = result.value; }
            else {
                const full = applyPlanningCommand(parsePlanningState(JSON.parse(localStorage.getItem(key) ?? 'null')), roster, userId, command);
                localStorage.setItem(key, JSON.stringify(full));
                next = planningForViewer(full, roster, userId);
                window.dispatchEvent(new Event('worship-planning-changed'));
            }
            receive(next); window.dispatchEvent(new Event('worship-planning-changed')); setMessage(command.type === 'notification.read' ? '확인 상태를 저장했습니다.' : online ? '팀에 저장했습니다.' : '이 브라우저에 저장했습니다.');
            return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 시도해주세요.'); return false; }
        finally { inFlight.current = false; setBusy(false); }
    }
    const unread = state.notifications.filter(item => !item.readBy.includes(userId));
    const panelProps = { state, members: roster, userId, busy: busy || !loaded, onCommand };
    return <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm leading-6 text-muted-foreground">{online ? '팀에 함께 저장 · 새 알림 자동 확인' : '기기 저장 · 체험 중'}<br />앱을 닫은 상태의 푸시 알림은 지원하지 않습니다.</p><button className={button} onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> 새로고침</button></div>
        {toast && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-secondary bg-card p-4"><p className="min-w-0 flex-1 break-words font-bold text-foreground">{toast}</p><button className={button} onClick={() => { setTab('schedule'); setToast(''); }}>긴급 요청 보기</button><button aria-label="새 알림 닫기" className={button} onClick={() => setToast('')}>닫기</button></div>}
        <details open={inboxOpen} onToggle={event => setInboxOpen(event.currentTarget.open)} className="rounded-2xl border border-border bg-card p-4"><summary className="flex min-h-12 cursor-pointer items-center gap-2 font-bold"><Bell size={19} /> 내 알림 <span className="rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground">미확인 {unread.length}</span>{unread.some(item => item.urgent) && <span className="text-sm text-secondary">긴급 확인 필요</span>}</summary><p className="mb-3 text-xs leading-5 text-muted-foreground">‘확인했어요’를 눌렀을 때만 확인 상태로 기록합니다.</p><div className="space-y-3">{[...state.notifications].sort((a,b) => Number(a.readBy.includes(userId)) - Number(b.readBy.includes(userId))).map(item => <article key={item.id} className="rounded-xl border border-border p-4"><p className="font-bold">{item.urgent ? '긴급 · ' : ''}{item.title}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{planningDate(item.createdAt)} · {item.readBy.includes(userId) ? '확인함' : '미확인'}</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => setTab(item.target)}>내용 보기</button>{!item.readBy.includes(userId) && <button className={button} disabled={busy} onClick={() => void onCommand({ type: 'notification.read', notificationId: item.id })}>확인했어요</button>}</div></article>)}{!state.notifications.length && <p className="py-3 text-sm text-muted-foreground">아직 받은 알림이 없습니다.</p>}</div></details>
        <div role="tablist" aria-label="예배 준비 메뉴" className="grid grid-cols-2 gap-2">{[{ id: 'schedule', title: '일정 · 인원 배치', icon: CalendarDays }, { id: 'requests', title: '인도자에게 요청', icon: MessageSquare }].map(item => <button key={item.id} id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} role="tab" aria-selected={tab === item.id} className={`${button} ${tab === item.id ? 'bg-primary! text-primary-foreground!' : ''}`} onClick={() => setTab(item.id)}><item.icon size={17} />{item.title}</button>)}</div>
        {error && <p role="alert" className="rounded-xl border border-destructive bg-card p-4 text-sm font-semibold text-destructive">{error}</p>}
        <p role="status" className="text-sm font-semibold">{busy ? '저장 중…' : !loaded ? '준비 자료를 불러오는 중…' : message}</p>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>{tab === 'schedule' ? <SchedulePanel {...panelProps} /> : <RequestsPanel {...panelProps} initialSetlist={initialSetlist} />}</div>
    </div>;
}
