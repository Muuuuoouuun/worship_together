'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bell, CheckCheck, ChevronDown, CircleCheck, RefreshCw, X } from 'lucide-react';
import { loadPlanningContext, updateTeamPlanning } from '@/actions/planningActions';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '@/lib/planning';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';
import { emptyPlanningState, planningDate, type PlanningCommand, type PlanningState } from '@/types/planning';
import type { OnlineTeam, TeamMember } from '@/types/team';
import { demoMembers, readLocalActor, writeLocalActor } from '@/lib/planningDemo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import Notice from '@/components/ui/Notice';
import PageTabs from '@/components/ui/PageTabs';
import { TONE_BLOCK } from '@/components/conti/ui';
import RequestsPanel from './RequestsPanel';
import SchedulePanel from './SchedulePanel';
import RotationPanel from './RotationPanel';

type Props = { teams: OnlineTeam[]; userId?: string; initialTeamId?: string; initialTab?: string; initialSetlist?: { id: string; title: string } };
type TabId = 'schedule' | 'rotation' | 'requests';
const TABS: { id: TabId; title: string; shortTitle: string }[] = [
    { id: 'schedule', title: '일정 · 인원 배치', shortTitle: '일정·배치' },
    { id: 'rotation', title: '담당 & 로테이션', shortTitle: '로테이션' },
    { id: 'requests', title: '인도자에게 요청', shortTitle: '요청함' },
];

/** 상단 체험·팀 선택 칸: 작은 알약 모양 선택 상자 (모바일 확대 방지 16px, sm 이상 14px) */
const pillSelect = 'h-10 rounded-full border-border bg-card pl-3.5 pr-7';
const fieldLabel = 'mb-1 block text-[11px] font-medium text-muted-foreground';

export default function PlanningWorkspace(props: Props) {
    return props.teams.length && props.userId ? <OnlinePlanning {...props} /> : <LocalPlanning {...props} />;
}
/** 로그인한 온라인 팀: 지금 팀(위의 팀 바꾸기)의 일정 · 요청 */
function OnlinePlanning(props: Props) {
    const team = props.teams.find(item => item.id === props.initialTeamId) ?? props.teams[0];
    return <Board key={team.id} teamId={team.id} members={team.members} userId={props.userId!} online initialTab={props.initialTab} initialSetlist={props.initialSetlist} />;
}
function LocalPlanning(props: Props) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const [selected, setSelected] = useState(props.initialTeamId ?? '');
    const [actor, setActor] = useState('');
    const parsed = useMemo(() => { try { return { value: parseTeamSnapshot(raw), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : '팀 자료를 읽지 못했습니다.' }; } }, [raw]);
    const teams = parsed.value?.teams ?? [];
    const team = teams.find(item => item.id === selected) ?? teams.find(item => item.id === parsed.value?.activeTeamId) ?? teams[0];
    const teamId = team?.id ?? DEMO_TEAM_ID;
    // 콘티·악보 화면에서 고른 '보는 사람'을 이어받습니다 (같은 브라우저 저장소).
    useEffect(() => { setActor(readLocalActor(teamId)); }, [teamId]);
    if (!parsed.value) return <Notice tone="error">{parsed.error}</Notice>;
    const members: TeamMember[] = team ? team.members.map((member, index) => ({ userId: member.id, name: member.name, role: member.role, permission: index === 0 ? 'owner' : 'member' })) : demoMembers;
    const userId = members.some(member => member.userId === actor) ? actor : members[0].userId;
    return <div className="space-y-6">
        <section className="space-y-3.5 rounded-3xl bg-muted p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
                <div className="min-w-0 flex-1 basis-64">
                    <p className="text-[15px] font-semibold tracking-tight text-foreground">로그인 없이 일정·요청 체험</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">이 브라우저에만 저장됩니다. 체험할 팀원을 바꾸면 요청 수신과 대체 지원을 확인할 수 있습니다. 실제 팀에 알림을 보내지 않습니다.</p>
                </div>
                <Link className="-my-1 inline-flex min-h-9 shrink-0 items-center rounded-full text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="/dashboard/team">로그인하고 온라인 팀 준비하기</Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
                <label className="min-w-0"><span className={fieldLabel}>체험 팀</span><Select className={pillSelect} value={teamId} onChange={event => { setSelected(event.target.value); setActor(''); }}>{teams.length ? teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : <option value={DEMO_TEAM_ID}>예시 예배팀</option>}</Select></label>
                <label className="min-w-0"><span className={fieldLabel}>체험할 팀원</span><Select className={pillSelect} value={userId} onChange={event => { setActor(event.target.value); writeLocalActor(teamId, event.target.value); }}>{members.map(member => <option key={member.userId} value={member.userId}>{member.name}{member.permission === 'owner' ? ' · 관리자' : ''}</option>)}</Select></label>
            </div>
        </section>
        <Board key={`${teamId}:${userId}`} teamId={teamId} members={members} userId={userId} online={false} initialTab={props.initialTab} initialSetlist={!props.initialTeamId || teamId === props.initialTeamId ? props.initialSetlist : undefined} />
    </div>;
}
function Board({ teamId, members, userId, online, toolbar, initialTab, initialSetlist }: { teamId: string; members: TeamMember[]; userId: string; online: boolean; toolbar?: ReactNode; initialTab?: string; initialSetlist?: Props['initialSetlist'] }) {
    const searchParams = useSearchParams();
    const [inboxOpen, setInboxOpen] = useState(searchParams.get('inbox') === '1');
    const [state, setState] = useState<PlanningState>(emptyPlanningState);
    const [tab, setTab] = useState<TabId>(initialTab === 'requests' ? 'requests' : initialTab === 'rotation' ? 'rotation' : 'schedule');
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
    const onCommand = useCallback(async (command: PlanningCommand): Promise<boolean> => {
        if (inFlight.current || !loaded) return false;
        inFlight.current = true; revision.current++; setBusy(true); setError(''); setMessage('');
        try {
            let next: PlanningState;
            if (online) { const result = await updateTeamPlanning(teamId, command); if (!result.ok) throw new Error(result.error); next = result.value; }
            else {
                const full = applyPlanningCommand(parsePlanningState(JSON.parse(localStorage.getItem(key) ?? 'null')), roster, userId, command);
                localStorage.setItem(key, JSON.stringify(full));
                next = planningForViewer(full, roster, userId);
            }
            receive(next);
            window.dispatchEvent(new Event('worship-planning-changed'));
            setMessage(command.type === 'notification.read' || command.type === 'notification.readAll' ? '확인 상태를 저장했습니다.' : online ? '팀에 저장했습니다.' : '이 브라우저에 저장했습니다.');
            return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 시도해주세요.'); return false; }
        finally { inFlight.current = false; setBusy(false); }
    }, [key, loaded, online, receive, roster, teamId, userId]);

    const unread = useMemo(() => state.notifications.filter(item => !item.readBy.includes(userId)), [state.notifications, userId]);
    const panelProps = useMemo(() => ({ state, members: roster, userId, busy: busy || !loaded, onCommand }), [state, roster, userId, busy, loaded, onCommand]);
    const sorted = useMemo(() => [...state.notifications].sort((a, b) => Number(a.readBy.includes(userId)) - Number(b.readBy.includes(userId))), [state.notifications, userId]);
    const urgentUnread = unread.some(item => item.urgent);
    return <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {toolbar}
            <p className="min-w-0 flex-1 basis-56 text-xs leading-5 text-muted-foreground">{online ? '팀에 함께 저장 · 다른 팀원이 바꾸면 바로 보여요' : '기기 저장 · 체험 중'}<br />앱을 닫은 상태의 푸시 알림은 지원하지 않습니다.</p>
            <Button type="button" variant="outline" size="icon-sm" aria-label="새로고침" title="새로고침" className="ml-auto" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} aria-hidden="true" /></Button>
        </div>
        {toast && <div role="alert" className={cn('flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-3xl px-4 py-3.5', TONE_BLOCK.peach)}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" />
            <p className="min-w-0 flex-1 basis-48 break-words text-sm font-semibold text-foreground">{toast}</p>
            <div className="ml-auto flex items-center gap-1">
                <Button type="button" size="xs" onClick={() => { setTab('schedule'); setToast(''); }}>긴급 요청 보기</Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="새 알림 닫기" title="닫기" onClick={() => setToast('')}><X size={15} aria-hidden="true" /></Button>
            </div>
        </div>}
        <details open={inboxOpen} onToggle={event => setInboxOpen(event.currentTarget.open)} className="group border-y border-border/70">
            <summary className="flex cursor-pointer list-none items-center gap-3.5 rounded-2xl py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <Bell size={18} aria-hidden="true" />
                    {unread.length > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-secondary ring-2 ring-muted" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">내 알림</span>
                    <span className="mt-0.5 block truncate text-xs">
                        <span className={unread.length ? 'font-medium text-secondary' : 'text-muted-foreground'}>미확인 {unread.length}</span>
                        {urgentUnread && <span className="font-semibold text-secondary"> · 긴급 확인 필요</span>}
                    </span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                    <p className="text-xs leading-5 text-muted-foreground">‘확인’을 누르면 읽음으로 처리됩니다.</p>
                    {unread.length > 0 && (
                        <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => void onCommand({ type: 'notification.readAll' })}>
                            <CheckCheck size={13} aria-hidden="true" />
                            모두 읽음
                        </Button>
                    )}
                </div>
                {sorted.length ? <ul className="mt-1">{sorted.map(item => {
                    const read = item.readBy.includes(userId);
                    return <li key={item.id} className="flex gap-3 border-b border-border/70 py-3.5 last:border-b-0">
                        <div className="min-w-0 flex-1">
                            <p className={cn('text-sm leading-snug', read ? 'text-foreground/75' : 'font-medium text-foreground')}>{item.urgent ? <span className="font-semibold text-secondary">긴급 · </span> : ''}{item.title}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/75">{item.body}</p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground">{planningDate(item.createdAt)} · {read ? '확인함' : '미확인'}</p>
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <Button type="button" variant="outline" size="xs" onClick={() => setTab(item.target)}>내용 보기</Button>
                                {!read && <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" disabled={busy} onClick={() => void onCommand({ type: 'notification.read', notificationId: item.id })}><CircleCheck size={13} aria-hidden="true" />확인</Button>}
                            </div>
                        </div>
                        <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', read ? 'bg-transparent' : 'bg-secondary')} />
                    </li>;
                })}</ul> : <p className="py-3 text-sm text-muted-foreground">아직 받은 알림이 없습니다.</p>}
            </div>
        </details>
        <div>
            <PageTabs<TabId>
                label="예배 준비 메뉴"
                value={tab}
                onChange={setTab}
                tabs={TABS.map(item => ({ id: item.id, controls: `panel-${item.id}`, label: <><span className="hidden sm:inline">{item.title}</span><span className="sm:hidden">{item.shortTitle}</span></> }))}
            />
            {error && <Notice tone="error" className="mt-4">{error}</Notice>}
            <p role="status" className="mt-2 min-h-5 text-xs font-medium text-muted-foreground">{busy ? '저장 중…' : !loaded ? '준비 자료를 불러오는 중…' : message}</p>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-3">
                {tab === 'schedule' ? (
                    <SchedulePanel {...panelProps} />
                ) : tab === 'rotation' ? (
                    <RotationPanel {...panelProps} />
                ) : (
                    <RequestsPanel {...panelProps} initialSetlist={initialSetlist} />
                )}
            </div>
        </div>
    </div>;
}
