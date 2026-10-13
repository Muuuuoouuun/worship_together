'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Library } from 'lucide-react';
import { createClientId } from '@/lib/clientId';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '@/lib/constants';
import {
    LIBRARY_CHANGED_EVENT,
    normalizeSetlistSongOrder,
    readPrototypeLibrary,
    savePrototypeLibrary,
    type LibrarySetlist,
    type LibrarySong,
    type PrototypeLibrary,
} from '@/lib/libraryPrototypeStorage';
import { SETLIST_DETAILS_CHANGED_EVENT, readSetlistDetails, updateSetlistDetails, type SetlistDetailMetadata } from '@/lib/setlistDetailsStorage';
import { SONG_FORM_CHANGED_EVENT, readSongForm, saveSongForm } from '@/lib/songFormStorage';
import { SONG_LINKS_CHANGED_EVENT, readSongLinks, saveSongLinks } from '@/lib/songLinksStorage';
import type { SongForm } from '@/lib/songForm';
import { getTeamServerSnapshot, getTeamSnapshot, parseTeamSnapshot, selectPrototypeTeam, subscribeToTeams } from '@/lib/teamPrototype';
import { demoMembers, readLocalActor, writeLocalActor } from '@/lib/planningDemo';
import type { TeamMember } from '@/types/team';
import ContiWorkspace from './ContiWorkspace';
import { buildContiSetlists, planSave } from './liveData';
import { seoulDateTime, upcomingSetlistId, type ScreenId } from './model';
import { EMPTY_PLANNING_VIEW, buildPlanningView, type PlanningView } from './planningBridge';
import { usePlanning, type PlanningSource } from './usePlanning';
import type { ContiData, ContiEditor, SaveResult } from './context';

interface ServerSetlist {
    id: string;
    team_id: string | null;
    title: string;
    theme: string | null;
    worship_date: string;
    song_order: unknown;
    created_at: string;
    updated_at: string;
}

interface Props {
    initialSongs: LibrarySong[];
    initialSetlists: ServerSetlist[];
    hasBackend: boolean;
    onlineTeams: { id: string; name: string }[];
    onlineTeamId?: string;
    viewerName: string | null;
    /** 로그인한 사용자 id (온라인 팀 일정·요청에 필요) */
    viewerId: string | null;
    initialScreen: ScreenId;
    initialSetlistId?: string;
}

/** 곡 보관함과 같은 규칙으로 어느 팀의 콘티를 보여줄지 정합니다. */
interface Source {
    kind: 'online' | 'server' | 'prototype' | 'demo';
    teamId: string;
    teams: { id: string; name: string }[];
    roster: string[];
    seed: PrototypeLibrary;
    /** 일정·요청 데이터를 읽을 곳 (일정·요청 화면과 같은 규칙) */
    planning: PlanningSource;
    /** 로그인 없이 볼 때 고를 수 있는 '보는 사람' 목록 */
    viewers: TeamMember[];
}

const feedSeenStorageKey = (teamId: string) => `worship:conti-feed-seen:v1:${encodeURIComponent(teamId)}`;

function readStored(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStored(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // 저장 공간 문제는 화면을 막지 않습니다.
    }
}

/** 팀원 중 저장된 선택이 있으면 그 사람, 없으면 첫 번째 (일정·요청 화면과 같은 기본값) */
function pickViewer(members: TeamMember[], stored: string | null): string {
    return members.some((member) => member.userId === stored) ? stored! : members[0]?.userId ?? '';
}

const EVENTS = ['storage', LIBRARY_CHANGED_EVENT, SETLIST_DETAILS_CHANGED_EVENT, SONG_FORM_CHANGED_EVENT, SONG_LINKS_CHANGED_EVENT];

const noopSubscribe = () => () => {};

function seedFrom(teamId: string, songs: LibrarySong[], setlists: ServerSetlist[]): PrototypeLibrary {
    return {
        version: 1,
        songs,
        setlists: setlists.map((setlist) => ({
            id: setlist.id,
            team_id: setlist.team_id,
            title: setlist.title,
            theme: setlist.theme,
            worship_date: setlist.worship_date,
            song_order: normalizeSetlistSongOrder(setlist.song_order),
            created_at: setlist.created_at,
            updated_at: setlist.updated_at,
        })),
    };
}

interface Loaded {
    library: PrototypeLibrary;
    details: Record<string, SetlistDetailMetadata | null>;
    forms: Record<string, SongForm | null>;
    links: ReturnType<typeof readSongLinks>;
    today: string;
    data: Omit<ContiData, 'editor' | 'roster' | 'planning'>;
}

function legacyOf(setlist: LibrarySetlist) {
    return { title: setlist.title, createdAt: setlist.created_at };
}

function load(source: Source, now: Date): Loaded {
    const library = source.kind === 'server' ? source.seed : readPrototypeLibrary(source.teamId) ?? source.seed;
    const details = Object.fromEntries(library.setlists.map((setlist) => [setlist.id, readSetlistDetails(source.teamId, setlist.id, legacyOf(setlist))]));
    const forms = Object.fromEntries(library.songs.map((song) => [song.id, readSongForm(song.id, source.teamId)]));
    const links = readSongLinks(source.teamId);
    const today = seoulDateTime(now).date;
    const setlists = buildContiSetlists({ songs: library.songs, setlists: library.setlists, details, forms, links, today, now });
    return { library, details, forms, links, today, data: { today, setlists, thisWeekId: upcomingSetlistId(setlists, today) } };
}

export default function LiveContiWorkspace(props: Props) {
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const rawTeams = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    const [onlineId, setOnlineId] = useState(props.onlineTeamId ?? props.onlineTeams[0]?.id ?? '');
    const [version, setVersion] = useState(0);
    const [teamError, setTeamError] = useState('');
    /** 로그인 없이 볼 때 '보는 사람' (팀별로 이 브라우저에 기억) */
    const [viewerChoice, setViewerChoice] = useState<Record<string, string>>({});

    const source = useMemo<Source>(() => {
        const empty: PrototypeLibrary = { version: 1, songs: [], setlists: [] };
        const local = (teamId: string, members: TeamMember[]): Pick<Source, 'planning' | 'viewers'> => {
            const userId = pickViewer(members, viewerChoice[teamId] ?? (isClient ? readLocalActor(teamId) : null));
            return { planning: userId ? { kind: 'local', teamId, members, userId } : { kind: 'none' }, viewers: members };
        };
        let state = null;
        try {
            state = parseTeamSnapshot(rawTeams);
        } catch {
            state = null;
        }
        const team = state?.teams.find((item) => item.id === state?.activeTeamId) ?? state?.teams[0];
        // 일정·요청 화면과 같은 규칙: 첫 번째 팀원이 관리자
        const prototypeMembers = (members: { id: string; name: string; role: TeamMember['role'] }[]): TeamMember[] =>
            members.map((member, index) => ({ userId: member.id, name: member.name, role: member.role, permission: index === 0 ? 'owner' : 'member' }));
        if (props.onlineTeams.length) {
            const team = props.onlineTeams.find((item) => item.id === onlineId) ?? props.onlineTeams[0];
            return {
                kind: 'online',
                teamId: team.id,
                teams: props.onlineTeams,
                roster: [],
                seed: empty,
                planning: props.viewerId ? { kind: 'online', teamId: team.id, userId: props.viewerId } : { kind: 'none' },
                viewers: [],
            };
        }
        if (props.hasBackend) {
            // 서버 콘티를 보더라도 로그인 전의 일정·요청은 일정·요청 화면과 같은 팀(만든 팀이 있으면 그 팀)을 씁니다.
            return {
                kind: 'server',
                teamId: DEMO_TEAM_ID,
                teams: [],
                roster: [],
                seed: seedFrom(DEMO_TEAM_ID, props.initialSongs, props.initialSetlists),
                ...(team ? local(team.id, prototypeMembers(team.members)) : local(DEMO_TEAM_ID, demoMembers)),
            };
        }
        if (state && team) {
            const members = prototypeMembers(team.members);
            return {
                kind: 'prototype',
                teamId: team.id,
                teams: state.teams.map((item) => ({ id: item.id, name: item.name })),
                roster: team.members.map((member) => member.name),
                seed: empty,
                ...local(team.id, members),
            };
        }
        return { kind: 'demo', teamId: DEMO_TEAM_ID, teams: [], roster: [], seed: seedFrom(DEMO_TEAM_ID, props.initialSongs, props.initialSetlists), ...local(DEMO_TEAM_ID, demoMembers) };
    }, [props.onlineTeams, props.hasBackend, props.initialSongs, props.initialSetlists, props.viewerId, onlineId, rawTeams, viewerChoice, isClient]);

    const planning = usePlanning(source.planning);
    const planningTeamId = source.planning.kind === 'none' ? source.teamId : source.planning.teamId;
    const [feedSeenAt, setFeedSeenAt] = useState<Record<string, string | null>>({});
    /** 코멘트 작성자 이름: 팀 명단의 내 이름 (로그인 없이 볼 때는 '보는 사람') */
    const viewerUserId = source.planning.kind === 'none' ? null : source.planning.userId;
    const authorName = planning.members.find((member) => member.userId === viewerUserId)?.name ?? props.viewerName ?? '나';

    useEffect(() => {
        const refresh = () => setVersion((value) => value + 1);
        EVENTS.forEach((name) => window.addEventListener(name, refresh));
        // 자정이 지나면 '오늘'이 바뀌므로 화면을 다시 계산합니다.
        let day = seoulDateTime(new Date()).date;
        const clock = setInterval(() => {
            const next = seoulDateTime(new Date()).date;
            if (next !== day) {
                day = next;
                refresh();
            }
        }, 60_000);
        return () => {
            clearInterval(clock);
            EVENTS.forEach((name) => window.removeEventListener(name, refresh));
        };
    }, []);

    const loaded = useMemo(() => {
        if (!isClient) return null;
        try {
            return { ok: true as const, value: load(source, new Date()), version };
        } catch (cause) {
            return { ok: false as const, error: cause instanceof Error ? cause.message : '콘티를 불러오지 못했어요.', version };
        }
    }, [isClient, source, version]);

    const editor = useMemo<ContiEditor | null>(() => {
        if (!loaded?.ok) return null;
        const { library, forms, links } = loaded.value;
        const local = source.kind !== 'server';
        const findSetlist = (id: string): LibrarySetlist | undefined => library.setlists.find((setlist) => setlist.id === id);

        return {
            canReorder: local,
            storageNote: local ? '이 브라우저에 저장돼요' : '세부 정보는 이 브라우저에 저장돼요',
            createHref: '/dashboard/songs/library',
            sessionHref: (setlistId) => `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(source.teamId)}`,
            saveSetlist: (setlistId, draft): SaveResult => {
                const setlist = findSetlist(setlistId);
                if (!setlist) return { ok: false, error: '콘티를 찾지 못했어요. 새로고침 후 다시 시도해주세요.' };
                const result = planSave({ setlist, songs: library.songs, draft, canReorder: local, forms, links, now: new Date().toISOString(), createId: createClientId });
                if (!result.ok) return result;
                const { plan } = result;
                try {
                    if (plan.order) {
                        const current = readPrototypeLibrary(source.teamId) ?? source.seed;
                        savePrototypeLibrary(source.teamId, {
                            ...current,
                            setlists: current.setlists.map((item) => (item.id === setlistId ? { ...item, song_order: plan.order!, updated_at: new Date().toISOString() } : item)),
                        });
                    }
                    updateSetlistDetails(source.teamId, setlistId, { overrides: plan.overrides, owner: plan.owner, status: plan.status }, legacyOf(setlist));
                    plan.forms.forEach((form) => saveSongForm(form, source.teamId));
                    plan.links.forEach((entry) => saveSongLinks(source.teamId, entry.songId, entry.links));
                    return { ok: true };
                } catch (cause) {
                    return { ok: false, error: cause instanceof Error ? cause.message : '저장하지 못했어요.' };
                }
            },
            addComment: (setlistId, songId, text): SaveResult => {
                const setlist = findSetlist(setlistId);
                const body = text.trim().slice(0, 300);
                if (!setlist || !body) return { ok: false, error: '코멘트 내용을 입력해주세요.' };
                try {
                    const current = readSetlistDetails(source.teamId, setlistId, legacyOf(setlist));
                    updateSetlistDetails(
                        source.teamId,
                        setlistId,
                        { comments: [...(current?.comments ?? []), { id: createClientId(), songId, author: authorName, text: body, createdAt: new Date().toISOString() }] },
                        legacyOf(setlist),
                    );
                    return { ok: true };
                } catch (cause) {
                    return { ok: false, error: cause instanceof Error ? cause.message : '코멘트를 저장하지 못했어요.' };
                }
            },
        };
    }, [loaded, source, authorName]);

    function chooseTeam(id: string) {
        if (source.kind === 'online') {
            setOnlineId(id);
            return;
        }
        try {
            selectPrototypeTeam(id);
            setTeamError('');
        } catch (cause) {
            setTeamError(cause instanceof Error ? cause.message : '팀을 선택하지 못했어요.');
        }
    }

    function chooseViewer(userId: string) {
        writeLocalActor(planningTeamId, userId);
        setViewerChoice((current) => ({ ...current, [planningTeamId]: userId }));
    }

    const planningView = useMemo<PlanningView>(() => {
        if (!loaded?.ok) return EMPTY_PLANNING_VIEW;
        const userId = source.planning.kind === 'none' ? null : source.planning.userId;
        if (!userId) return { ...EMPTY_PLANNING_VIEW, ready: true };
        const seen = feedSeenAt[planningTeamId] ?? readStored(feedSeenStorageKey(planningTeamId));
        const built = buildPlanningView({ state: planning.state, members: planning.members, userId, today: loaded.value.today, now: new Date(), setlists: loaded.value.data.setlists, feedSeenAt: seen });
        return {
            ...built,
            sample: false,
            ready: planning.ready,
            busy: planning.busy,
            error: planning.error,
            actions: {
                dispatch: planning.dispatch,
                markFeedSeen: (at) => {
                    writeStored(feedSeenStorageKey(planningTeamId), at);
                    setFeedSeenAt((current) => ({ ...current, [planningTeamId]: at }));
                },
            },
            planningHref: `/dashboard/planning?team=${encodeURIComponent(planningTeamId)}`,
        };
    }, [loaded, source.planning, planningTeamId, planning, feedSeenAt]);

    const data: ContiData | null = loaded?.ok
        ? { ...loaded.value.data, editor, roster: source.roster.length ? source.roster : planningView.roster.map((member) => member.name), planning: planningView }
        : null;
    const localViewerId = source.planning.kind === 'local' ? source.planning.userId : null;

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <section className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">콘티·악보</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {source.kind === 'server' ? '서버에 저장된 콘티' : '곡 보관함에 저장된 콘티'}를 이번 주 순서·송폼·특이사항과 함께 봐요
                    </p>
                    <Link href="/dashboard/songs/deadline" className="mt-1.5 inline-flex min-h-8 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline">
                        콘티 마감 알림 목업 보기 →
                    </Link>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {source.teams.length > 1 && (
                        <label className="sr-only" htmlFor="conti-team">
                            팀 선택
                        </label>
                    )}
                    {source.teams.length > 1 && (
                        <select
                            id="conti-team"
                            value={source.teamId}
                            onChange={(event) => chooseTeam(event.target.value)}
                            className="min-h-10 max-w-40 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground"
                        >
                            {source.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {localViewerId && source.viewers.length > 1 && (
                        <label className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-2 text-xs font-semibold text-foreground">
                            <span className="text-muted-foreground">보는 사람</span>
                            <select
                                aria-label="보는 사람"
                                value={localViewerId}
                                onChange={(event) => chooseViewer(event.target.value)}
                                className="max-w-32 bg-transparent text-xs font-semibold text-foreground outline-none"
                            >
                                {source.viewers.map((member) => (
                                    <option key={member.userId} value={member.userId}>
                                        {member.name}
                                        {member.permission === 'owner' ? ' · 관리자' : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <Link
                        href="/dashboard/songs/library"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                        <Library size={15} aria-hidden="true" />
                        곡 보관함
                    </Link>
                </div>
            </section>
            {teamError && <p role="alert" className="px-1 text-sm text-destructive">{teamError}</p>}

            {!loaded ? (
                <div role="status" className="rounded-[2rem] bg-card px-6 py-16 text-center text-sm text-muted-foreground">
                    콘티를 불러오는 중…
                </div>
            ) : !loaded.ok ? (
                <div role="alert" className="rounded-[2rem] bg-card px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-foreground">{loaded.error}</p>
                    <Link href="/dashboard/songs/library" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline">
                        곡 보관함에서 확인하기
                    </Link>
                </div>
            ) : (
                data && <ContiWorkspace key={source.teamId} data={data} mode="embedded" initialScreen={props.initialScreen} initialSetlistId={props.initialSetlistId} />
            )}
        </div>
    );
}
