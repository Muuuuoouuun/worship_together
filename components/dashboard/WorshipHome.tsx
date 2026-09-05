"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ListMusic, Radio, UsersRound } from 'lucide-react';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import { getTeamSnapshot, getTeamServerSnapshot, parseTeamSnapshot, subscribeToTeams } from '@/lib/teamPrototype';
import { LIBRARY_CHANGED_EVENT, readPrototypeLibrary, type LibrarySetlist } from '@/lib/libraryPrototypeStorage';

export default function WorshipHome({ currentSessionId }: { currentSessionId?: string }) {
    const raw = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const team = useMemo(() => { try { const state = parseTeamSnapshot(raw); return state.teams.find(item => item.id === state.activeTeamId); } catch { return undefined; } }, [raw]);
    const [setlists, setSetlists] = useState<LibrarySetlist[]>([]);
    const [error, setError] = useState('');
    const [openedAt] = useState(() => Date.now());
    const teamId = team?.id ?? DEMO_TEAM_ID;
    useEffect(() => {
        function refresh() { try { setSetlists(readPrototypeLibrary(teamId)?.setlists ?? []); setError(''); } catch { setError('저장된 콘티를 읽지 못했습니다. 콘티 화면에서 저장 상태를 확인해주세요.'); } }
        refresh(); window.addEventListener('storage', refresh); window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh); };
    }, [teamId]);
    const ordered = [...setlists].sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date));
    const next = ordered.find(item => Date.parse(item.worship_date) >= openedAt) ?? ordered[ordered.length - 1];
    const liveHref = next ? `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(next.id)}&team=${encodeURIComponent(teamId)}` : `/session/${currentSessionId ?? DEMO_SESSION_ID}`;
    return <div className="mx-auto max-w-5xl space-y-6">
        <header className="py-2"><p className="text-sm font-semibold text-secondary">함께 준비하고, 같은 흐름으로 예배합니다</p><h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{team?.name ?? '우리 팀의 예배 준비'}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">팀을 모으고 콘티와 악보를 준비하세요.<br className="sm:hidden" /> 예배가 시작되면 큰 버튼으로 마음을 맞춥니다.</p></header>
        <section className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
            <p className="text-sm font-medium">{next ? '저장된 예배 콘티' : '먼저 체험해보세요'}</p>
            <h2 className="mt-3 text-2xl font-bold">{next?.title ?? '악보와 큐를 한 화면에서'}</h2>
            <p className="mt-3 text-sm leading-7">{next ? `${new Date(next.worship_date).toLocaleDateString('ko-KR')} · ${next.song_order?.length ?? 0}곡` : '샘플 예배에서 악보 필기, 시각적 BPM, 팀원에게 큐 보내기를 확인할 수 있습니다.'}</p>
            <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-card px-4 py-3 font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-primary-foreground sm:w-auto" href={liveHref}><Radio size={18} className="shrink-0" />{next ? '이 콘티로 예배 입장' : '샘플 예배 체험'}<ArrowRight size={18} className="shrink-0" /></Link>
            <p className="mt-4 text-sm leading-6">프로토타입은 이 브라우저에 저장됩니다. 실시간 큐는 같은 브라우저의 두 탭에서 수신을 확인할 수 있습니다.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/dashboard/team" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-secondary hover:bg-muted"><UsersRound className="text-secondary" /><p className="mt-4 text-xs font-medium text-muted-foreground">01 · 함께할 사람</p><h2 className="mt-2 text-xl font-bold">팀 구성 · 초대</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{team ? `${team.members.length}명 · 팀원을 초대하고 담당 역할을 나눠주세요.` : '팀을 만들고 인도자·보컬·악기·미디어 역할을 나눠주세요.'}</p></Link>
            <Link href="/dashboard/songs" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-secondary hover:bg-muted"><ListMusic className="text-secondary" /><p className="mt-4 text-xs font-medium text-muted-foreground">02 · 함께 부를 찬양</p><h2 className="mt-2 text-xl font-bold">콘티 · 악보 준비</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">곡과 송폼을 저장하고, 기존 콘티를 다음 예배에 다시 사용하세요.</p></Link>
            <Link href="/dashboard/planning" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-secondary hover:bg-muted"><CalendarDays className="text-secondary" /><p className="mt-4 text-xs font-medium text-muted-foreground">03 · 함께 맞출 시간</p><h2 className="mt-2 text-xl font-bold">일정 · 인도자 요청</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">연습·인원 배치를 확인하고, 콘티 질문과 결석·대체 요청을 남겨요.</p></Link>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <aside className="rounded-2xl border border-border bg-card p-5 text-card-foreground"><h2 className="font-bold">예배 전 확인</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>팀원의 역할과 예배 콘티를 함께 확인하세요.</li><li>필기를 마치면 팀 공유본으로 저장하고 공유 파일을 전달하세요.</li><li>예배에 들어가 BPM과 현재 섹션, 큐 수신 상태를 확인하세요.</li></ul></aside>
    </div>;
}
