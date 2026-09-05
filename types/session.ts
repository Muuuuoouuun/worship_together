import { Database, Json } from '@/types/schema';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SessionFeedbackRow = Database['public']['Tables']['session_feedback']['Row'];
export type SongRow = Database['public']['Tables']['songs']['Row'];
export type SetlistRow = Database['public']['Tables']['setlists']['Row'];
export type TeamRow = Database['public']['Tables']['teams']['Row'];

export const SESSION_FEEDBACK_ROLES = ['leader', 'instrument', 'broadcast'] as const;
export type SessionFeedbackRole = (typeof SESSION_FEEDBACK_ROLES)[number];
export const DEFAULT_SESSION_FEEDBACK_ROLE: SessionFeedbackRole = 'leader';
export const SESSION_FEEDBACK_PRESET_GROUPS = ['flow', 'tempo', 'band', 'media'] as const;
export type SessionFeedbackPresetGroup = (typeof SESSION_FEEDBACK_PRESET_GROUPS)[number];
export const DEFAULT_SESSION_FEEDBACK_PRESET_GROUP: SessionFeedbackPresetGroup = 'flow';
export const MAX_SESSION_FEEDBACK_LOG = 18;
export const MAX_SESSION_FEEDBACK_PRESETS = 12;

export function getSessionFeedbackPresetStorageKey(sessionId: string): string {
    return `worship-together:session:${sessionId}:feedback-presets`;
}

export interface SessionFeedbackEntry {
    id: string;
    clientId: string | null;
    role: SessionFeedbackRole;
    message: string;
    createdAt: string;
    teamId: string | null;
    songId: string | null;
    songTitle: string | null;
    page: number;
    section: string | null;
    recipient?: SessionCueRecipient;
    /** Local receipt time assigned by the transport; never inferred from saved history. */
    receivedAt?: string;
}

// Recipients route live notifications; they are not an authorization boundary.
export type SessionCueRecipient =
    | { kind: 'everyone' }
    | { kind: 'role'; role: SessionFeedbackRole }
    | { kind: 'member'; clientId: string };

export interface SessionParticipant {
    clientId: string;
    role: SessionFeedbackRole;
    lastSeenAt: number;
}

export function getPresetRecipient(preset: { target: string; group: SessionFeedbackPresetGroup; role: SessionFeedbackRole }): SessionCueRecipient {
    if (preset.target === '전체' || preset.target === '팀') return { kind: 'everyone' };
    const role = preset.target === '인도자' ? 'leader' : preset.target === '미디어' ? 'broadcast'
        : ['악기', '리듬'].includes(preset.target) ? 'instrument'
        : preset.group === 'media' ? 'broadcast' : preset.group === 'tempo' || preset.group === 'band' ? 'instrument' : preset.role;
    return { kind: 'role', role };
}

export interface SessionCueDelivery {
    status: 'sending' | 'sent' | 'failed';
    transport: 'local' | 'remote' | null;
    receivedBy: string[];
    saved: boolean;
    error?: string;
}

export function normalizeCueRecipient(value: unknown): SessionCueRecipient | null {
    if (value === undefined) return { kind: 'everyone' };
    if (!value || typeof value !== 'object') return null;
    const target = value as Record<string, unknown>;
    if (target.kind === 'everyone') return { kind: 'everyone' };
    if (target.kind === 'role' && typeof target.role === 'string' && isSessionFeedbackRole(target.role)) {
        return { kind: 'role', role: target.role };
    }
    if (target.kind === 'member' && typeof target.clientId === 'string' && target.clientId.length > 0) {
        return { kind: 'member', clientId: target.clientId };
    }
    return null;
}

export function isCueForParticipant(entry: SessionFeedbackEntry, clientId: string, role: SessionFeedbackRole): boolean {
    const target = normalizeCueRecipient(entry.recipient);
    return target?.kind === 'everyone' || (target?.kind === 'role' && target.role === role) ||
        (target?.kind === 'member' && target.clientId === clientId);
}

export function getCueDeliveryLabel(delivery: SessionCueDelivery | undefined): string {
    if (!delivery) return '전달 상태 없음';
    if (delivery.receivedBy.length > 0) return `${delivery.transport === 'local' ? '이 브라우저 · ' : ''}${delivery.receivedBy.length}개 기기 수신 · 읽음 아님`;
    if (delivery.status === 'sending') return '전송 중';
    if (delivery.status === 'failed') return delivery.error ?? '전송 실패';
    return delivery.transport === 'local' ? '이 브라우저 탭에 전송 · 수신 미확인' : '서버 전송 · 수신 미확인';
}

export interface SessionFeedbackPreset {
    id: string;
    role: SessionFeedbackRole;
    group: SessionFeedbackPresetGroup;
    label: string;
    message: string;
    target: string;
    createdAt: string;
}

const DEFAULT_SESSION_FEEDBACK_PRESET_CREATED_AT = '1970-01-01T00:00:00.000Z';

const DEFAULT_SESSION_FEEDBACK_PRESET_DEFS = [
    {
        id: 'cue-next-section',
        role: 'leader',
        group: 'flow',
        label: '다음 섹션',
        message: '다음 섹션으로 넘어갑니다.',
        target: '전체',
    },
    {
        id: 'cue-repeat-section',
        role: 'leader',
        group: 'flow',
        label: '한 번 더',
        message: '현재 섹션을 한 번 더 반복합니다.',
        target: '전체',
    },
    {
        id: 'cue-slower-tempo',
        role: 'leader',
        group: 'tempo',
        label: '느려요',
        message: '템포를 살짝 내려주세요.',
        target: '리듬',
    },
    {
        id: 'cue-faster-tempo',
        role: 'leader',
        group: 'tempo',
        label: '빨라요',
        message: '템포를 살짝 올려주세요.',
        target: '리듬',
    },
    {
        id: 'cue-longer-accompaniment',
        role: 'instrument',
        group: 'band',
        label: '반주 유지',
        message: '반주를 조금 더 길게 유지해주세요.',
        target: '악기',
    },
    {
        id: 'cue-repeat-ending',
        role: 'leader',
        group: 'flow',
        label: '엔딩',
        message: '엔딩으로 들어갑니다.',
        target: '전체',
    },
    {
        id: 'cue-next-lyrics',
        role: 'broadcast',
        group: 'media',
        label: '다음 가사',
        message: '다음 가사 슬라이드를 준비해주세요.',
        target: '미디어',
    },
    {
        id: 'cue-raise-vocal',
        role: 'broadcast',
        group: 'media',
        label: '보컬 올림',
        message: '보컬 볼륨을 살짝 올려주세요.',
        target: '미디어',
    },
] as const satisfies ReadonlyArray<{
    id: string;
    role: SessionFeedbackRole;
    group: SessionFeedbackPresetGroup;
    label: string;
    message: string;
    target: string;
}>;

export function getDefaultSessionFeedbackPresets(
    createdAt = DEFAULT_SESSION_FEEDBACK_PRESET_CREATED_AT
): SessionFeedbackPreset[] {
    return DEFAULT_SESSION_FEEDBACK_PRESET_DEFS.map((preset) => ({
        ...preset,
        createdAt,
    }));
}

export interface SessionCurrentState {
    songId: string | null;
    page: number;
    section: string | null;
    bpmEnabled: boolean;
    bpmValue: number | null;
    autoBpmSync: boolean;
    feedbackLog: SessionFeedbackEntry[];
    quickFeedbackPresets: SessionFeedbackPreset[];
}

export interface SessionDetail {
    session: SessionRow;
    setlist: SetlistRow | null;
    songs: SongRow[];
    team: TeamRow | null;
    currentState: SessionCurrentState;
}

export interface SessionFeedbackBroadcastPayload {
    entry: SessionFeedbackEntry;
    sessionId: string;
    teamId: string;
}

export function sessionFeedbackRowToEntry(row: SessionFeedbackRow): SessionFeedbackEntry {
    return {
        id: row.id,
        clientId: row.client_id,
        role: isSessionFeedbackRole(row.role) ? row.role : DEFAULT_SESSION_FEEDBACK_ROLE,
        message: row.message,
        createdAt: row.created_at,
        teamId: row.team_id,
        songId: row.song_id,
        songTitle: row.song_title,
        page: row.page,
        section: row.section,
    };
}

export const DEFAULT_SESSION_SECTIONS = [
    'Prelude',
    'Verse 1',
    'Chorus',
    'Verse 2',
    'Bridge',
    'Outro',
] as const;

type SessionStateJson = {
    autoBpmSync?: Json;
    bpmEnabled?: Json;
    bpmValue?: Json;
    feedbackLog?: Json;
    quickFeedbackPresets?: Json;
    page?: Json;
    section?: Json;
    songId?: Json;
};

export function normalizeSessionState(
    value: Json | null | undefined,
    songs: SongRow[] = []
): SessionCurrentState {
    const state = isSessionStateJson(value) ? value : {};
    const fallbackSongId = songs[0]?.id ?? null;
    const resolvedSongId = typeof state.songId === 'string' ? state.songId : fallbackSongId;
    const section =
        typeof state.section === 'string' && state.section.trim().length > 0
            ? state.section
            : DEFAULT_SESSION_SECTIONS[0];

    return {
        songId: resolvedSongId,
        page: normalizePage(state.page),
        section,
        bpmEnabled: normalizeBoolean(state.bpmEnabled, false),
        bpmValue: normalizeBpm(state.bpmValue, resolvedSongId, songs),
        autoBpmSync: normalizeBoolean(state.autoBpmSync, true),
        feedbackLog: normalizeFeedbackLog(state.feedbackLog, songs),
        quickFeedbackPresets: withDefaultFeedbackPresets(
            normalizeFeedbackPresets(state.quickFeedbackPresets)
        ),
    };
}

function isSessionStateJson(value: Json | null | undefined): value is SessionStateJson {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFeedbackLog(
    value: Json | undefined,
    songs: SongRow[]
): SessionFeedbackEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => normalizeFeedbackEntry(entry, songs))
        .filter((entry): entry is SessionFeedbackEntry => Boolean(entry))
        .slice(-MAX_SESSION_FEEDBACK_LOG);
}

function normalizeFeedbackPresets(value: Json | undefined): SessionFeedbackPreset[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => normalizeFeedbackPreset(entry))
        .filter((entry): entry is SessionFeedbackPreset => Boolean(entry))
        .slice(-MAX_SESSION_FEEDBACK_PRESETS);
}

function withDefaultFeedbackPresets(presets: SessionFeedbackPreset[]): SessionFeedbackPreset[] {
    const defaultPresets = getDefaultSessionFeedbackPresets();
    const defaultPresetIds = new Set(defaultPresets.map((preset) => preset.id));
    const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
    const customPresets = presets.filter((preset) => !defaultPresetIds.has(preset.id));
    const customLimit = Math.max(0, MAX_SESSION_FEEDBACK_PRESETS - defaultPresets.length);

    return [
        ...defaultPresets.map((preset) => ({
            ...preset,
            ...presetsById.get(preset.id),
        })),
        ...customPresets.slice(-customLimit),
    ];
}

function normalizeFeedbackEntry(
    value: Json,
    songs: SongRow[]
): SessionFeedbackEntry | null {
    if (!isFeedbackEntryJson(value)) {
        return null;
    }

    const message = typeof value.message === 'string' ? value.message.trim() : '';

    if (!message) {
        return null;
    }

    const songId = typeof value.songId === 'string' ? value.songId : null;
    const songTitle =
        typeof value.songTitle === 'string'
            ? value.songTitle
            : songs.find((song) => song.id === songId)?.title ?? null;

    return {
        id: typeof value.id === 'string' ? value.id : `feedback-${message.slice(0, 12)}`,
        clientId: typeof value.clientId === 'string' ? value.clientId : null,
        role: isSessionFeedbackRole(value.role) ? value.role : DEFAULT_SESSION_FEEDBACK_ROLE,
        message,
        createdAt:
            typeof value.createdAt === 'string' && value.createdAt.trim().length > 0
                ? value.createdAt
                : '1970-01-01T00:00:00.000Z',
        teamId: typeof value.teamId === 'string' ? value.teamId : null,
        songId,
        songTitle,
        page: normalizePage(value.page),
        section:
            typeof value.section === 'string' && value.section.trim().length > 0
                ? value.section
                : null,
    };
}

function normalizeFeedbackPreset(value: Json): SessionFeedbackPreset | null {
    if (!isFeedbackEntryJson(value)) {
        return null;
    }

    const message = typeof value.message === 'string' ? value.message.trim() : '';

    if (!message) {
        return null;
    }

    const labelSource = typeof value.label === 'string' ? value.label.trim() : '';
    const label = labelSource || message;
    const role = isSessionFeedbackRole(value.role) ? value.role : DEFAULT_SESSION_FEEDBACK_ROLE;
    const group = isSessionFeedbackPresetGroup(value.group)
        ? value.group
        : inferSessionFeedbackPresetGroup(role, label, message);
    const targetSource = typeof value.target === 'string' ? value.target.trim() : '';
    const target = targetSource || getDefaultSessionFeedbackTarget(role, group);

    return {
        id: typeof value.id === 'string' ? value.id : `preset-${label.slice(0, 12)}`,
        role,
        group,
        label: label.slice(0, 32),
        message: message.slice(0, 220),
        target: target.slice(0, 24),
        createdAt:
            typeof value.createdAt === 'string' && value.createdAt.trim().length > 0
                ? value.createdAt
                : '1970-01-01T00:00:00.000Z',
    };
}

function isFeedbackEntryJson(
    value: Json | null | undefined
): value is Record<string, Json | undefined> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isSessionFeedbackRole(value: Json | null | undefined): value is SessionFeedbackRole {
    return typeof value === 'string' && SESSION_FEEDBACK_ROLES.includes(value as SessionFeedbackRole);
}

export function isSessionFeedbackPresetGroup(
    value: Json | null | undefined
): value is SessionFeedbackPresetGroup {
    return typeof value === 'string' &&
        SESSION_FEEDBACK_PRESET_GROUPS.includes(value as SessionFeedbackPresetGroup);
}

export function inferSessionFeedbackPresetGroup(
    role: SessionFeedbackRole,
    label: string,
    message: string
): SessionFeedbackPresetGroup {
    const source = `${label} ${message}`.toLowerCase();

    if (/템포|느려|빨라|bpm|박자/.test(source)) {
        return 'tempo';
    }

    if (role === 'broadcast') {
        return 'media';
    }

    if (role === 'instrument') {
        return 'band';
    }

    return DEFAULT_SESSION_FEEDBACK_PRESET_GROUP;
}

export function getDefaultSessionFeedbackTarget(
    role: SessionFeedbackRole,
    group: SessionFeedbackPresetGroup
): string {
    switch (group) {
        case 'tempo':
            return '리듬';
        case 'band':
            return '악기';
        case 'media':
            return '미디어';
        case 'flow':
        default:
            return role === 'leader' ? '전체' : '팀';
    }
}

function normalizePage(value: Json | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        return 1;
    }

    return Math.floor(value);
}

function normalizeBoolean(value: Json | undefined, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeBpm(
    value: Json | undefined,
    songId: string | null,
    songs: SongRow[]
): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    return resolveSongPresetBpm(songId, songs);
}

export function resolveSongPresetBpm(songId: string | null, songs: SongRow[]): number | null {
    if (!songId) {
        return null;
    }

    const bpm = songs.find((song) => song.id === songId)?.bpm;

    return typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0
        ? Math.floor(bpm)
        : null;
}
