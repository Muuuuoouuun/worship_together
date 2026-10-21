'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import LiveScreen from '../LiveScreen';
import {
    CUE_TARGET_LABEL,
    QUICK_CUES_ALL,
    QUICK_CUES_SOUND,
    cueById,
    cueGroupOf,
    type CueDefinition,
    type CueTarget,
    type LiveConnection,
    type LiveCueEntry,
    type LiveMember,
    type LiveScreenHandlers,
    type LiveScreenModel,
    type LiveSong,
    type LiveToast,
} from '../model';
import { worshipRoles, type WorshipRole } from '@/types/team';

/*
 * 개발용 미리보기 — 예배 중 화면(LiveScreen)을 메모리 속 가짜 모델로 움직여 봅니다.
 * 여기만 가짜 데이터를 씁니다 (곡 · 팀원 · 큐 기록 모두 미리보기용). 실제 화면은 서버 세션이 모델을 만듭니다.
 * 위 막대의 버튼으로 받은 큐 · 연결 끊김 · 팀원 입장 · 예배 마침 · 진행 권한을 흉내 냅니다.
 */

const ME_ID = 'preview-me';
const LEADER_NAME = '김하늘';

const SONGS: LiveSong[] = [
    {
        id: 'preview-song-1',
        title: '믿음으로 서리라',
        key: 'D',
        bpm: 72,
        meter: '4/4',
        sections: ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
        note: '브릿지 2번 반복 후 후렴',
        transitionNote: '피아노만 남기고 바로 G 로',
        lead: '이은혜',
    },
    {
        id: 'preview-song-2',
        title: '주님의 은혜',
        key: 'G',
        bpm: 68,
        meter: '6/8',
        sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Outro'],
        note: null,
        transitionNote: null,
        lead: '박소망',
    },
    {
        id: 'preview-song-3',
        title: '은혜 아니면',
        key: 'A',
        bpm: null,
        meter: '4/4',
        sections: [],
        note: '자유롭게 — 인도자 신호로 끝',
        transitionNote: null,
        lead: null,
    },
];

const TEAM: { userId: string; name: string; role: WorshipRole; online: boolean }[] = [
    { userId: 'preview-leader', name: LEADER_NAME, role: 'leader', online: true },
    { userId: ME_ID, name: '정다윗', role: 'keyboard', online: true },
    { userId: 'preview-vocal', name: '이은혜', role: 'vocal', online: true },
    { userId: 'preview-guitar', name: '박소망', role: 'guitar', online: true },
    { userId: 'preview-drums', name: '최믿음', role: 'drums', online: false },
    { userId: 'preview-sound', name: '한사랑', role: 'sound', online: true },
    { userId: 'preview-media', name: '윤기쁨', role: 'media', online: false },
];

const ME = TEAM[1];

interface PreviewState {
    songIndex: number;
    sectionIndex: number;
    page: number;
    bpm: number | null;
    canControl: boolean;
    connection: LiveConnection;
    ended: boolean;
    endedByName: string | null;
    lastMovedBy: string | null;
    online: Record<string, boolean>;
    cues: LiveCueEntry[];
    toasts: LiveToast[];
}

const MAX_TOASTS = 3;

type TriggerId = 'cue-all' | 'cue-band' | 'leader-moves' | 'connection' | 'member' | 'error' | 'fail-next' | 'control' | 'end' | 'reset';

function minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

function initialState(control: boolean, scene: string | null): PreviewState {
    const noForm = scene === 'noform';
    const state: PreviewState = {
        songIndex: noForm ? 2 : 0,
        sectionIndex: noForm ? -1 : 2,
        page: 1,
        bpm: noForm ? null : SONGS[0].bpm,
        canControl: control,
        connection: 'online',
        ended: scene === 'ended',
        endedByName: scene === 'ended' ? LEADER_NAME : null,
        lastMovedBy: LEADER_NAME,
        online: Object.fromEntries(TEAM.map((member) => [member.userId, member.online])),
        cues: [
            cueEntry({ id: 'preview-log-2', cueId: 'vocal-up', from: TEAM[0], target: 'sound', createdAt: minutesAgo(1), recipients: 1, acks: [TEAM[5]] }),
            cueEntry({ id: 'preview-log-1', cueId: 'again', from: TEAM[0], target: 'all', createdAt: minutesAgo(4), recipients: 4, acks: [TEAM[1], TEAM[2], TEAM[3]] }),
        ],
        toasts: [],
    };
    const keep = { createdAt: 0, ttl: null };
    if (scene === 'cue') state.toasts = [{ ...incomingToast('preview-scene-cue', 'next-section', 'all'), ...keep }];
    if (scene === 'notices') {
        state.connection = 'offline';
        state.toasts = [
            { ...incomingToast('preview-scene-role', 'faster', 'band'), ...keep },
            { ...offlineToast('preview-scene-offline'), ...keep },
            { ...teamToast('preview-scene-team', '최믿음'), ...keep },
        ];
    }
    return state;
}

function cueEntry({
    id,
    cueId,
    from,
    target,
    createdAt,
    recipients,
    acks,
}: {
    id: string;
    cueId: string;
    from: (typeof TEAM)[number];
    target: CueTarget;
    createdAt: string;
    recipients: number;
    acks: (typeof TEAM)[number][];
}): LiveCueEntry {
    const cue = cueById(cueId);
    const fromMe = from.userId === ME_ID;
    const forMe = !fromMe && (target === 'all' || target === cueGroupOf(ME.role));
    return {
        id,
        cueId,
        label: cue?.label ?? cueId,
        target,
        targetLabel: CUE_TARGET_LABEL[target],
        fromUserId: from.userId,
        fromName: from.name,
        fromMe,
        forMe,
        createdAt,
        recipients,
        acks: acks.map((member) => ({ userId: member.userId, name: member.name })),
        ackedByMe: acks.some((member) => member.userId === ME_ID),
    };
}

function incomingToast(id: string, cueId: string, target: CueTarget, entryId?: string): LiveToast {
    const cue = cueById(cueId);
    const all = target === 'all';
    return {
        id,
        kind: all ? 'cue-all' : 'cue-role',
        tone: 'cue',
        urgency: all ? 'high' : 'normal',
        title: cue?.label ?? cueId,
        body: all ? '다음 섹션으로 넘어가요' : '조금 차분하게 가 주세요',
        from: LEADER_NAME,
        target: CUE_TARGET_LABEL[target],
        ackable: true,
        ttl: all ? 6000 : 5000,
        createdAt: Date.now(),
        cueEntryId: entryId,
    };
}

function offlineToast(id: string): LiveToast {
    return { id, kind: 'offline', tone: 'warning', urgency: 'normal', group: 'connection', title: '연결이 끊겼어요', body: '다시 연결하는 중 · 화면은 계속 볼 수 있어요', ttl: null, createdAt: Date.now() };
}

function teamToast(id: string, name: string): LiveToast {
    return { id, kind: 'team', tone: 'info', urgency: 'low', title: `${name}님이 들어왔어요`, body: '예배 화면에 함께하고 있어요', from: name, ttl: 4000, createdAt: Date.now() };
}

function saveErrorToast(id: string): LiveToast {
    return { id, kind: 'error', tone: 'danger', urgency: 'normal', title: '진행 상태를 저장하지 못했어요', body: '네트워크를 확인해 주세요', action: '다시 시도', ttl: null, createdAt: Date.now() };
}

function withToast(toasts: LiveToast[], toast: LiveToast) {
    const rest = toast.group ? toasts.filter((item) => item.group !== toast.group) : toasts;
    return [toast, ...rest].slice(0, MAX_TOASTS);
}

export default function LivePreview({ initialControl, showBar, scene }: { initialControl: boolean; showBar: boolean; scene: string | null }) {
    const router = useRouter();
    const [state, setState] = useState<PreviewState>(() => initialState(initialControl, scene));
    const [failNext, setFailNext] = useState(false);
    const [startedAt] = useState(() => minutesAgo(12.8));
    const failRef = useRef(false);
    const seq = useRef(0);
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    const retry = useRef(new Map<string, CueDefinition>());

    useEffect(() => {
        failRef.current = failNext;
    }, [failNext]);

    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach((timer) => clearTimeout(timer));
    }, []);

    const later = useCallback((ms: number, run: () => void) => {
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            run();
        }, ms);
        timers.current.add(timer);
    }, []);

    const nextId = useCallback((prefix: string) => {
        seq.current += 1;
        return `${prefix}-${seq.current}`;
    }, []);

    const push = useCallback((toast: LiveToast) => setState((current) => ({ ...current, toasts: withToast(current.toasts, toast) })), []);

    /* ───── 진행 ───── */

    const moveSong = useCallback((current: PreviewState, index: number, by: string, lastSection = false): PreviewState => {
        const songIndex = Math.max(0, Math.min(index, SONGS.length - 1));
        const song = SONGS[songIndex];
        const sectionIndex = song.sections.length === 0 ? -1 : lastSection ? song.sections.length - 1 : 0;
        return { ...current, songIndex, sectionIndex, page: 1, bpm: song.bpm, lastMovedBy: by };
    }, []);

    const step = useCallback(
        (direction: 1 | -1, by: string) =>
            setState((current) => {
                const song = SONGS[current.songIndex];
                const target = current.sectionIndex + direction;
                if (song.sections.length > 0 && target >= 0 && target < song.sections.length) {
                    return { ...current, sectionIndex: target, page: Math.min(2, Math.floor((target / song.sections.length) * 2) + 1), lastMovedBy: by };
                }
                const songIndex = current.songIndex + direction;
                if (songIndex < 0 || songIndex >= SONGS.length) return current;
                return moveSong(current, songIndex, by, direction === -1);
            }),
        [moveSong],
    );

    /* ───── 큐 ───── */

    const sendCue = useCallback(
        (cue: CueDefinition) =>
            new Promise<boolean>((resolve) => {
                later(260, () => {
                    if (failRef.current) {
                        setFailNext(false);
                        const id = nextId('error');
                        retry.current.set(id, cue);
                        push({ id, kind: 'error', tone: 'danger', urgency: 'normal', title: '큐를 보내지 못했어요', body: `${cue.label} · 연결을 확인해 주세요`, action: '다시 시도', ttl: null, createdAt: Date.now() });
                        resolve(false);
                        return;
                    }
                    const entryId = nextId('cue');
                    const toastId = nextId('sent');
                    let recipients = 0;
                    setState((current) => {
                        const others = TEAM.filter((member) => member.userId !== ME_ID && current.online[member.userId]);
                        const receivers = others.filter((member) => cue.target === 'all' || cueGroupOf(member.role) === cue.target);
                        recipients = receivers.length;
                        const entry = cueEntry({ id: entryId, cueId: cue.id, from: ME, target: cue.target, createdAt: new Date().toISOString(), recipients: receivers.length, acks: [] });
                        const toast: LiveToast = {
                            id: toastId,
                            kind: 'cue-sent',
                            tone: 'success',
                            urgency: 'low',
                            title: `보냄 · ${cue.label}`,
                            body: `${CUE_TARGET_LABEL[cue.target]}에게 보냈어요`,
                            target: CUE_TARGET_LABEL[cue.target],
                            progress: { done: 0, total: receivers.length },
                            ttl: 3500,
                            createdAt: Date.now(),
                            cueEntryId: entryId,
                        };
                        // 받은 사람들이 차례로 확인합니다
                        receivers.forEach((member, index) => {
                            later(700 + index * 450, () =>
                                setState((latest) => ({
                                    ...latest,
                                    cues: latest.cues.map((item) => (item.id === entryId ? { ...item, acks: [...item.acks, { userId: member.userId, name: member.name }] } : item)),
                                    toasts: latest.toasts.map((item) => (item.id === toastId && item.progress ? { ...item, progress: { ...item.progress, done: item.progress.done + 1 } } : item)),
                                })),
                            );
                        });
                        return { ...current, cues: [entry, ...current.cues].slice(0, 12), toasts: withToast(current.toasts, toast) };
                    });
                    resolve(recipients >= 0);
                });
            }),
        [later, nextId, push],
    );

    const receiveCue = useCallback(
        (cueId: string, target: CueTarget) => {
            const entryId = nextId('in');
            const others = TEAM.filter((member) => member.userId !== TEAM[0].userId);
            const recipients = others.filter((member) => target === 'all' || cueGroupOf(member.role) === target).length;
            setState((current) => ({
                ...current,
                cues: [cueEntry({ id: entryId, cueId, from: TEAM[0], target, createdAt: new Date().toISOString(), recipients, acks: [] }), ...current.cues].slice(0, 12),
                toasts: withToast(current.toasts, incomingToast(nextId('toast'), cueId, target, entryId)),
            }));
        },
        [nextId],
    );

    const handlers = useMemo<LiveScreenHandlers>(
        () => ({
            goSong: (index) => setState((current) => moveSong(current, index, ME.name)),
            goSection: (index) =>
                setState((current) => {
                    const song = SONGS[current.songIndex];
                    if (index < 0 || index >= song.sections.length) return current;
                    return { ...current, sectionIndex: index, page: Math.min(2, Math.floor((index / song.sections.length) * 2) + 1), lastMovedBy: ME.name };
                }),
            next: () => step(1, ME.name),
            prev: () => step(-1, ME.name),
            setPage: (page) => setState((current) => ({ ...current, page: Math.max(1, page) })),
            setBpm: (bpm) => setState((current) => ({ ...current, bpm })),
            sendCue,
            ack: (toastId) =>
                setState((current) => {
                    const toast = current.toasts.find((item) => item.id === toastId);
                    return {
                        ...current,
                        toasts: current.toasts.map((item) => (item.id === toastId ? { ...item, acked: true } : item)),
                        cues: current.cues.map((item) =>
                            toast?.cueEntryId === item.id && !item.ackedByMe ? { ...item, ackedByMe: true, acks: [...item.acks, { userId: ME_ID, name: ME.name }] } : item,
                        ),
                    };
                }),
            dismiss: (toastId) => setState((current) => ({ ...current, toasts: current.toasts.filter((item) => item.id !== toastId) })),
            action: (toastId) => {
                const cue = retry.current.get(toastId);
                retry.current.delete(toastId);
                setState((current) => ({ ...current, toasts: current.toasts.filter((item) => item.id !== toastId) }));
                if (cue) void sendCue(cue);
            },
            leave: () => router.push('/session/drafts'),
            end: () => setState((current) => ({ ...current, ended: true, endedByName: ME.name })),
        }),
        [moveSong, step, sendCue, router],
    );

    const model = useMemo<LiveScreenModel>(() => {
        const members: LiveMember[] = TEAM.map((member) => ({
            userId: member.userId,
            name: member.name,
            role: member.role,
            roleLabel: worshipRoles[member.role],
            group: cueGroupOf(member.role),
            online: state.online[member.userId] ?? false,
            me: member.userId === ME_ID,
            controller: member.role === 'leader' || (member.userId === ME_ID && state.canControl),
        }));
        return {
            sessionId: 'preview-session',
            teamId: 'preview-team',
            teamName: '미리보기 데이터 · 주일 2부 예배팀',
            title: '주일 2부 예배',
            dateLabel: '10월 18일 (일) 오전 11:00',
            theme: '신실하신 하나님',
            startedAt,
            songs: SONGS,
            songIndex: state.songIndex,
            sectionIndex: state.sectionIndex,
            page: state.page,
            bpm: state.bpm,
            ended: state.ended,
            endedByName: state.endedByName,
            canControl: state.canControl,
            controllerNames: members.filter((member) => member.controller && !member.me).map((member) => member.name),
            lastMovedBy: state.lastMovedBy,
            members,
            cues: state.cues,
            toasts: state.toasts,
            quickCues: (state.canControl ? QUICK_CUES_ALL : QUICK_CUES_SOUND).map((id) => cueById(id)!),
            canCueAll: state.canControl,
            connection: state.connection,
            me: { userId: ME_ID, name: ME.name, role: ME.role, group: cueGroupOf(ME.role) },
            exitHref: '/session/drafts',
            contiHref: '/session/drafts',
        };
    }, [state, startedAt]);

    /* ───── 위 막대: 상황 흉내 ───── */

    function runTrigger(id: TriggerId) {
        switch (id) {
            case 'cue-all':
                return receiveCue('next-section', 'all');
            case 'cue-band':
                return receiveCue('faster', 'band');
            case 'leader-moves':
                return step(1, LEADER_NAME);
            case 'connection':
                if (state.connection === 'online') {
                    return setState((current) => ({ ...current, connection: 'offline', toasts: withToast(current.toasts, offlineToast(nextId('offline'))) }));
                }
                return setState((current) => ({
                    ...current,
                    connection: 'online',
                    toasts: withToast(current.toasts, { id: nextId('online'), kind: 'online', tone: 'success', urgency: 'low', group: 'connection', title: '다시 연결됐어요', ttl: 3000, createdAt: Date.now() }),
                }));
            case 'member': {
                const away = TEAM.find((member) => !state.online[member.userId]);
                if (!away) return;
                return setState((current) => ({ ...current, online: { ...current.online, [away.userId]: true }, toasts: withToast(current.toasts, teamToast(nextId('team'), away.name)) }));
            }
            case 'error':
                return push(saveErrorToast(nextId('error')));
            case 'fail-next':
                return setFailNext((value) => !value);
            case 'control':
                return setState((current) => ({ ...current, canControl: !current.canControl }));
            case 'end':
                return setState((current) => ({ ...current, ended: true, endedByName: LEADER_NAME }));
            case 'reset':
                return setState(initialState(initialControl, null));
        }
    }

    const triggers: { id: TriggerId; label: string; on?: boolean }[] = [
        { id: 'cue-all', label: '받은 큐 · 전체' },
        { id: 'cue-band', label: '받은 큐 · 찬양팀' },
        { id: 'leader-moves', label: `${LEADER_NAME}님이 넘김` },
        { id: 'connection', label: state.connection === 'online' ? '연결 끊김' : '다시 연결', on: state.connection !== 'online' },
        { id: 'member', label: '팀원 들어옴' },
        { id: 'error', label: '저장 오류' },
        { id: 'fail-next', label: '다음 큐 실패', on: failNext },
        { id: 'control', label: state.canControl ? '진행 권한 끄기' : '진행 권한 켜기', on: state.canControl },
        { id: 'end', label: '예배 마침' },
        { id: 'reset', label: '처음부터' },
    ];

    return (
        <div className="flex h-dvh flex-col bg-background">
            {showBar ? (
                <div role="toolbar" aria-label="미리보기 상황 흉내" className="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-2 text-xs [scrollbar-width:none]">
                    <span className="inline-flex shrink-0 items-center gap-1 px-1.5 font-medium text-secondary">
                        <FlaskConical size={13} aria-hidden="true" />
                        미리보기 데이터
                    </span>
                    {triggers.map((trigger) => (
                        <button
                            key={trigger.id}
                            type="button"
                            onClick={() => runTrigger(trigger.id)}
                            aria-pressed={trigger.on === undefined ? undefined : trigger.on}
                            className={cn(
                                'h-8 shrink-0 rounded-full px-3 font-medium ring-1 transition-colors',
                                trigger.on ? 'bg-primary text-primary-foreground ring-primary' : 'bg-card text-foreground ring-border hover:bg-muted',
                            )}
                        >
                            {trigger.label}
                        </button>
                    ))}
                </div>
            ) : null}
            <div className="relative min-h-0 flex-1">
                <LiveScreen model={model} handlers={handlers} className="h-full" />
            </div>
        </div>
    );
}
