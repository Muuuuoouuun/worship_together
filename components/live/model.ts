import type { WorshipRole } from '@/types/team';

/*
 * 예배 중 화면(실시간 세션)이 그리는 데이터. 서버 세션(useLiveSession)이 이 모양을 만들고,
 * 화면(LiveScreen)은 이것만 보고 그립니다 — 목업이나 브라우저 저장소를 직접 읽지 않습니다.
 */

/** 큐를 받는 묶음. 팀 역할(WorshipRole)이 이 묶음 중 하나로 들어갑니다. */
export type CueTarget = 'all' | 'leader' | 'band' | 'sound' | 'media';
export type CueGroup = Exclude<CueTarget, 'all'>;

export const CUE_TARGET_LABEL: Record<CueTarget, string> = {
    all: '전체',
    leader: '인도자',
    band: '찬양팀',
    sound: '음향',
    media: '미디어',
};

export function cueGroupOf(role: WorshipRole): CueGroup {
    if (role === 'leader') return 'leader';
    if (role === 'sound') return 'sound';
    if (role === 'media') return 'media';
    return 'band';
}

/** 보낼 수 있는 큐. id 는 서버가 그대로 검사하므로 바꾸면 lib/server/liveRepository 의 목록도 함께 바꿉니다. */
export interface CueDefinition {
    id: string;
    label: string;
    target: CueTarget;
}

export const CUE_LIBRARY: readonly CueDefinition[] = [
    { id: 'again', label: '한 번 더', target: 'all' },
    { id: 'ending', label: '엔딩 컷', target: 'all' },
    { id: 'prayer', label: '기도 BGM', target: 'all' },
    { id: 'next-section', label: '다음 섹션', target: 'all' },
    { id: 'slower', label: '느려요', target: 'band' },
    { id: 'faster', label: '빨라요', target: 'band' },
    { id: 'build-up', label: '반주 빌드업', target: 'band' },
    { id: 'hold', label: '반주 유지', target: 'band' },
    { id: 'monitor', label: '모니터 체크', target: 'sound' },
    { id: 'vol-up', label: '볼륨 업', target: 'sound' },
    { id: 'vol-down', label: '볼륨 다운', target: 'sound' },
    { id: 'vocal-up', label: '보컬 UP', target: 'sound' },
    { id: 'next-lyric', label: '다음 가사', target: 'media' },
];

/** 전체 큐를 보낼 수 있으면 흐름 큐 세 개, 아니면 음향에게 가는 큐 세 개가 엄지 자리에 놓입니다. */
export const QUICK_CUES_ALL = ['again', 'ending', 'prayer'] as const;
export const QUICK_CUES_SOUND = ['monitor', 'vol-up', 'vol-down'] as const;

export function cueById(id: string): CueDefinition | undefined {
    return CUE_LIBRARY.find((cue) => cue.id === id);
}

export interface LiveSong {
    id: string;
    title: string;
    /** 이번 주 Key (콘티에서 정한 값, 없으면 곡 원래 Key) */
    key: string | null;
    /** 이번 주 BPM (없으면 곡 기본 BPM) */
    bpm: number | null;
    /** 박자표 — '4/4', '6/8', '3/4' … (모르면 '4/4') */
    meter: string;
    /** 송폼 섹션 이름 순서. 송폼이 없으면 빈 배열 */
    sections: string[];
    /** 특이사항 · 인도자 메모 */
    note: string | null;
    /** 다음 곡으로 넘어갈 때의 메모 */
    transitionNote: string | null;
    /** 리드 싱어 */
    lead: string | null;
}

export interface LiveMember {
    userId: string;
    name: string;
    role: WorshipRole;
    roleLabel: string;
    group: CueGroup;
    /** 지금 예배 화면에 들어와 있음 */
    online: boolean;
    me: boolean;
    /** 진행(곡 · 섹션 넘김)을 할 수 있는 사람 */
    controller: boolean;
}

export interface LiveCueEntry {
    id: string;
    cueId: string;
    label: string;
    target: CueTarget;
    targetLabel: string;
    fromUserId: string;
    fromName: string;
    fromMe: boolean;
    /** 내가 받는 큐인지 (보낸 사람은 받는 사람이 아닙니다) */
    forMe: boolean;
    createdAt: string;
    /** 보낼 때 받는 사람 수 (보낸 사람 제외) */
    recipients: number;
    acks: { userId: string; name: string }[];
    ackedByMe: boolean;
}

export type LiveToastKind = 'cue-all' | 'cue-role' | 'cue-sent' | 'offline' | 'online' | 'saved' | 'error' | 'team';
export type LiveToastTone = 'cue' | 'success' | 'warning' | 'danger' | 'info';
export type LiveToastUrgency = 'high' | 'normal' | 'low';

/** 화면에 뜨는 알림 하나. 큐(cue-*)는 위 가운데 아일랜드, 나머지는 넘김 버튼 위 카드 줄에 뜹니다. */
export interface LiveToast {
    id: string;
    kind: LiveToastKind;
    tone: LiveToastTone;
    urgency: LiveToastUrgency;
    title: string;
    body?: string;
    from?: string;
    target?: string;
    /** 버튼 하나 (다시 시도, 보기 …) */
    action?: string;
    ackable?: boolean;
    acked?: boolean;
    /** 보낸 큐의 확인 현황 */
    progress?: { done: number; total: number };
    group?: string;
    /** 자동으로 사라질 때까지 ms. null 이면 닫을 때까지 */
    ttl: number | null;
    createdAt: number;
    /** 받은 큐 · 보낸 큐 알림이면 그 큐 id */
    cueEntryId?: string;
}

export type LiveConnection = 'connecting' | 'online' | 'offline';

export interface LiveScreenModel {
    sessionId: string;
    teamId: string;
    teamName: string;
    /** 콘티 제목 */
    title: string;
    /** '10월 18일 (일) 오전 11:00' 같은 표시용 (없으면 null) */
    dateLabel: string | null;
    theme: string | null;
    startedAt: string;
    songs: LiveSong[];
    songIndex: number;
    /** 송폼이 없는 곡이면 -1 */
    sectionIndex: number;
    /** 악보 쪽 (1부터) */
    page: number;
    /** 지금 BPM (진행자가 바꿀 수 있음, 없으면 null) */
    bpm: number | null;
    ended: boolean;
    endedByName: string | null;
    /** 내가 곡 · 섹션 · BPM 을 움직일 수 있는지 */
    canControl: boolean;
    /** 진행할 수 있는 사람 이름 (따라가는 사람에게 '누구를 따라가는지' 보여 줄 때) */
    controllerNames: string[];
    /** 마지막으로 진행을 움직인 사람 */
    lastMovedBy: string | null;
    members: LiveMember[];
    /** 최근 큐 (새것부터) */
    cues: LiveCueEntry[];
    toasts: LiveToast[];
    /** 엄지 자리 빠른 큐 세 개 */
    quickCues: CueDefinition[];
    /** 전체에게 보낼 수 있는지 (아니면 quickCues 가 음향 큐) */
    canCueAll: boolean;
    connection: LiveConnection;
    me: { userId: string; name: string; role: WorshipRole; group: CueGroup };
    /** 나가기 링크 */
    exitHref: string;
    /** 콘티 화면 링크 */
    contiHref: string;
}

export interface LiveScreenHandlers {
    goSong: (index: number) => void;
    goSection: (index: number) => void;
    next: () => void;
    prev: () => void;
    setPage: (page: number) => void;
    setBpm: (bpm: number) => void;
    /** 성공하면 true. 실패하면 화면이 '다시 시도' 알림을 받습니다 */
    sendCue: (cue: CueDefinition) => Promise<boolean>;
    ack: (toastId: string) => void;
    dismiss: (toastId: string) => void;
    action: (toastId: string) => void;
    /** 나가기 (입장 기록을 지우고 exitHref 로) */
    leave: () => void;
    /** 예배 마치기 — canControl 일 때만 */
    end: () => void;
}
