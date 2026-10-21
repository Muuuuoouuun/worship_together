'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
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
import { buildContiSetlists, planSave } from './liveData';
import { seoulDateTime, upcomingSetlistId } from './model';
import { EMPTY_PLANNING_VIEW, buildPlanningView, type PlanningView } from './planningBridge';
import { usePlanning, type PlanningSource } from './usePlanning';
import type { ContiData, ContiEditor, SaveResult } from './context';
import { liveStartHref } from '@/components/live/links';
import { selectTeam } from '@/actions/teamActions';

/** 서버에서 읽은 콘티 한 줄 (곡 목록 없이) */
export interface ServerSetlist {
    id: string;
    team_id: string | null;
    title: string;
    theme: string | null;
    worship_date: string;
    song_order: unknown;
    created_at: string;
    updated_at: string;
}

/** 서버가 넘겨주는 입력 (lib/server/contiInputs.ts 의 getLiveContiInputs 가 한 번에 만듭니다) */
export interface LiveContiInputs {
    initialSongs: LibrarySong[];
    initialSetlists: ServerSetlist[];
    hasBackend: boolean;
    onlineTeams: { id: string; name: string }[];
    /** 지금 온라인 팀 (없으면 첫 번째 팀) */
    onlineTeamId?: string;
    /** 온라인 팀에서 콘티를 고칠 수 있는지 (팀 권한). 온라인 팀이 아니면 늘 true */
    canEditConti?: boolean;
    /** 온라인 팀에서 예배를 시작할 수 있는지 */
    canRunSession?: boolean;
    viewerName: string | null;
    /** 로그인한 사용자 id (온라인 팀 일정·요청에 필요) */
    viewerId: string | null;
}

export type LiveContiSourceKind = 'online' | 'server' | 'prototype' | 'demo';

/** 곡 보관함과 같은 규칙으로 고른 팀 (화면에 필요한 부분만) */
export interface LiveContiSource {
    kind: LiveContiSourceKind;
    teamId: string;
    /** 실제로 만든(또는 가입한) 팀 이름. 예시 팀원으로만 보고 있으면 null */
    teamName: string | null;
    /** 고를 수 있는 팀 (2개 이상일 때만 선택 상자를 보여줍니다) */
    teams: { id: string; name: string }[];
    /** 로그인 없이 볼 때 고를 수 있는 '보는 사람' 목록 */
    viewers: TeamMember[];
}

export interface LiveContiResult {
    /** 불러오기 전이거나 실패하면 null */
    data: ContiData | null;
    /** 브라우저 저장소를 읽기 전 (서버 렌더·첫 화면) */
    loading: boolean;
    /** 콘티를 불러오지 못한 이유 */
    error: string | null;
    source: LiveContiSource;
    chooseTeam: (id: string) => void;
    chooseViewer: (userId: string) => void;
    /** 팀 선택 실패 안내 */
    teamError: string;
    /** 로그인 없이 볼 때 지금 '보는 사람' (그 외에는 null) */
    localViewerId: string | null;
}

/** 곡 보관함과 같은 규칙으로 어느 팀의 콘티를 보여줄지 정합니다. */
interface Source extends LiveContiSource {
    roster: string[];
    seed: PrototypeLibrary;
    /** 일정·요청 데이터를 읽을 곳 (일정·요청 화면과 같은 규칙) */
    planning: PlanningSource;
}

/** 코멘트 소식을 읽은 시각. 로그인 없이 '보는 사람'을 바꿔도 각자 따로 기억합니다. (보는 사람별 값이 없으면 이전의 팀 단위 값을 씁니다) */
const feedSeenStorageKey = (teamId: string, userId?: string) => `worship:conti-feed-seen:v1:${encodeURIComponent(teamId)}${userId ? `:${encodeURIComponent(userId)}` : ''}`;

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

/**
 * 콘티·악보 화면과 같은 실제 데이터(곡 보관함 콘티 + 일정·요청)를 같은 규칙으로 읽고 씁니다.
 * 팀 고르기(온라인 / 서버 / 이 브라우저 팀 / 예시), 저장소 변경·1분 시계 새로고침, 편집기, 팀 소식 읽음 처리를 포함합니다.
 */
export function useLiveContiData(props: LiveContiInputs): LiveContiResult {
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const rawTeams = useSyncExternalStore(subscribeToTeams, getTeamSnapshot, getTeamServerSnapshot);
    // 온라인 팀은 지금 팀(서버가 정해 넘겨줌)을 그대로 씁니다 — 팀을 바꾸면 서버가 다시 그려 줍니다.
    const onlineId = props.onlineTeamId ?? props.onlineTeams[0]?.id ?? '';
    const router = useRouter();
    const [version, setVersion] = useState(0);
    /** '방금·N분 전' 표시용 1분 시계 (같은 내용의 폴링은 다시 그리지 않으므로 따로 둡니다) */
    const [minute, setMinute] = useState(() => Date.now());
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
                teamName: team.name,
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
                teamName: team?.name ?? null,
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
                teamName: team.name,
                teams: state.teams.map((item) => ({ id: item.id, name: item.name })),
                roster: team.members.map((member) => member.name),
                seed: empty,
                ...local(team.id, members),
            };
        }
        return { kind: 'demo', teamId: DEMO_TEAM_ID, teamName: null, teams: [], roster: [], seed: seedFrom(DEMO_TEAM_ID, props.initialSongs, props.initialSetlists), ...local(DEMO_TEAM_ID, demoMembers) };
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
            setMinute(Date.now());
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
        const online = source.kind === 'online';
        const canEdit = !online || props.canEditConti !== false;
        const findSetlist = (id: string): LibrarySetlist | undefined => library.setlists.find((setlist) => setlist.id === id);

        return {
            canReorder: local,
            canEdit,
            storageNote: online ? '팀원 모두에게 저장돼요' : local ? '이 브라우저에 저장돼요' : '세부 정보는 이 브라우저에 저장돼요',
            createHref: '/dashboard/songs/library',
            // 온라인 팀은 서버 예배(팀원 모두 함께), 그 밖에는 이 기기의 예배 화면
            sessionHref: (setlistId) => online
                ? liveStartHref(source.teamId, setlistId)
                : `/session/${DEMO_SESSION_ID}?setlist=${encodeURIComponent(setlistId)}&team=${encodeURIComponent(source.teamId)}`,
            saveSetlist: (setlistId, draft): SaveResult => {
                if (!canEdit) return { ok: false, error: '콘티를 편집할 권한이 없어요. 코멘트는 남길 수 있어요.' };
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
    }, [loaded, source, authorName, props.canEditConti]);

    function chooseTeam(id: string) {
        if (source.kind === 'online') {
            // 지금 팀을 바꾸면 사이드바 · 홈 · 일정도 같은 팀을 봅니다.
            void selectTeam(id).then((result) => {
                if (!result.ok) {
                    setTeamError(result.error);
                    return;
                }
                setTeamError('');
                const params = new URLSearchParams(window.location.search);
                if (params.has('team')) {
                    params.delete('team');
                    router.replace(params.size ? `${window.location.pathname}?${params}` : window.location.pathname);
                }
                router.refresh();
            });
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
        const seenKey = feedSeenStorageKey(planningTeamId, userId);
        const seen = feedSeenAt[seenKey] ?? readStored(seenKey) ?? readStored(feedSeenStorageKey(planningTeamId));
        const built = buildPlanningView({ state: planning.state, members: planning.members, userId, today: loaded.value.today, now: new Date(minute), setlists: loaded.value.data.setlists, feedSeenAt: seen });
        return {
            ...built,
            sample: false,
            ready: planning.ready,
            busy: planning.busy,
            error: planning.error,
            actions: {
                dispatch: planning.dispatch,
                markFeedSeen: (at) => {
                    writeStored(seenKey, at);
                    setFeedSeenAt((current) => ({ ...current, [seenKey]: at }));
                },
            },
            planningHref: `/dashboard/planning?team=${encodeURIComponent(planningTeamId)}`,
        };
    }, [loaded, source.planning, planningTeamId, planning, feedSeenAt, minute]);

    const data: ContiData | null = loaded?.ok
        ? { ...loaded.value.data, editor, roster: source.roster.length ? source.roster : planningView.roster.map((member) => member.name), planning: planningView }
        : null;
    const localViewerId = source.planning.kind === 'local' ? source.planning.userId : null;

    return {
        data,
        loading: !loaded,
        error: loaded && !loaded.ok ? loaded.error : null,
        source,
        chooseTeam,
        chooseViewer,
        teamError,
        localViewerId,
    };
}
