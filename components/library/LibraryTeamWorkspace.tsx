'use client';

import { useState, useSyncExternalStore, type ComponentProps } from 'react';
import LibraryWorkspace from './LibraryWorkspace';
import Notice from '@/components/ui/Notice';
import { Select } from '@/components/ui/input';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, selectPrototypeTeam, subscribeToTeams } from '@/lib/teamPrototype';

/** 팀 선택 칸: 다른 입력 칸과 같은 모양 (components/ui/input) */
const teamLabel = 'block text-sm font-semibold text-foreground';
const teamSelect = 'mt-1.5 sm:max-w-sm';

type Props = ComponentProps<typeof LibraryWorkspace> & { onlineTeams?: { id: string; name: string }[]; onlineTeamId?: string };
export default function LibraryTeamWorkspace(props: Props) {
    if (props.onlineTeams?.length) return <OnlineTeamLibrary {...props} />;
    return props.hasBackend ? <LibraryWorkspace {...props} /> : <PrototypeTeamLibrary {...props} />;
}

function OnlineTeamLibrary(props: Props) {
    const teams = props.onlineTeams!;
    const [selected, setSelected] = useState(props.onlineTeamId ?? teams[0].id);
    const team = teams.find(item => item.id === selected) ?? teams[0];
    return <div className="space-y-6">
        <label className={teamLabel}>준비할 온라인 팀<Select className={teamSelect} value={team.id} onChange={event => setSelected(event.target.value)}>{teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
        <LibraryWorkspace key={team.id} {...props} teamId={team.id} hasBackend={false} initialSongs={[]} initialSetlists={[]} />
    </div>;
}

function PrototypeTeamLibrary(props: Props) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const [error, setError] = useState('');
    let state;
    try { state = parseTeamSnapshot(raw); }
    catch (cause) { return <Notice tone="error">{cause instanceof Error ? cause.message : '팀 데이터를 읽지 못했습니다.'}</Notice>; }
    const team = state.teams.find(team => team.id === state.activeTeamId) ?? state.teams[0];
    const teamId = team?.id ?? props.teamId;
    return <div className="space-y-6">
        {team ? <label className={teamLabel}>준비할 팀
            <Select value={teamId} className={teamSelect} onChange={event => {
                try { selectPrototypeTeam(event.target.value); setError(''); }
                catch (cause) { setError(cause instanceof Error ? cause.message : '팀을 선택하지 못했습니다.'); }
            }}>{state.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        </label> : null}
        {error && <Notice tone="error">{error}</Notice>}
        <LibraryWorkspace key={teamId} {...props} teamId={teamId} initialSongs={team ? [] : props.initialSongs} initialSetlists={team ? [] : props.initialSetlists} />
    </div>;
}
