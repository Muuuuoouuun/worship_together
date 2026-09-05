'use client';

import { useState, useSyncExternalStore, type ComponentProps } from 'react';
import LibraryWorkspace from './LibraryWorkspace';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, selectPrototypeTeam, subscribeToTeams } from '@/lib/teamPrototype';

type Props = ComponentProps<typeof LibraryWorkspace> & { onlineTeams?: { id: string; name: string }[]; onlineTeamId?: string };
export default function LibraryTeamWorkspace(props: Props) {
    if (props.onlineTeams?.length) return <OnlineTeamLibrary {...props} />;
    return props.hasBackend ? <LibraryWorkspace {...props} /> : <PrototypeTeamLibrary {...props} />;
}

function OnlineTeamLibrary(props: Props) {
    const teams = props.onlineTeams!;
    const [selected, setSelected] = useState(props.onlineTeamId ?? teams[0].id);
    const team = teams.find(item => item.id === selected) ?? teams[0];
    return <div className="space-y-4"><label className="block text-sm font-semibold text-foreground">준비할 온라인 팀<select className="mt-2 min-h-12 w-full rounded-xl border border-border bg-card px-3 text-foreground sm:max-w-sm" value={team.id} onChange={event => setSelected(event.target.value)}>{teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="text-sm leading-6 text-muted-foreground">팀 명단과 역할은 함께 저장됩니다. 곡·콘티·악보는 현재 기기에 보관되며 공유 파일로 전달할 수 있습니다.</p><LibraryWorkspace key={team.id} {...props} teamId={team.id} hasBackend={false} initialSongs={[]} initialSetlists={[]} /></div>;
}

function PrototypeTeamLibrary(props: Props) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const [error, setError] = useState('');
    let state;
    try { state = parseTeamSnapshot(raw); }
    catch (cause) { return <p role="alert">{cause instanceof Error ? cause.message : '팀 데이터를 읽지 못했습니다.'}</p>; }
    const team = state.teams.find(team => team.id === state.activeTeamId) ?? state.teams[0];
    const teamId = team?.id ?? props.teamId;
    return <div className="space-y-4">
        {team ? <label className="block text-sm font-semibold">준비할 팀
            <select value={teamId} className="mt-2 min-h-11 w-full rounded-lg border border-primary/20 bg-background px-3 sm:max-w-sm" onChange={event => {
                try { selectPrototypeTeam(event.target.value); setError(''); }
                catch (cause) { setError(cause instanceof Error ? cause.message : '팀을 선택하지 못했습니다.'); }
            }}>{state.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label> : <p className="text-sm text-muted-foreground">예시 팀의 라이브러리입니다. 팀을 만들면 해당 팀의 곡과 콘티를 별도로 준비할 수 있습니다.</p>}
        {error && <p role="alert" className="text-sm">{error}</p>}
        <LibraryWorkspace key={teamId} {...props} teamId={teamId} initialSongs={team ? [] : props.initialSongs} initialSetlists={team ? [] : props.initialSetlists} />
    </div>;
}
