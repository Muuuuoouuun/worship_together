import { Database, Json } from '@/types/schema';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SongRow = Database['public']['Tables']['songs']['Row'];
export type SetlistRow = Database['public']['Tables']['setlists']['Row'];
export type TeamRow = Database['public']['Tables']['teams']['Row'];

export const SESSION_FEEDBACK_ROLES = ['leader', 'instrument', 'broadcast'] as const;
export type SessionFeedbackRole = (typeof SESSION_FEEDBACK_ROLES)[number];
export const DEFAULT_SESSION_FEEDBACK_ROLE: SessionFeedbackRole = 'leader';
export const MAX_SESSION_FEEDBACK_LOG = 18;
export const MAX_SESSION_FEEDBACK_PRESETS = 12;

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
}

export interface SessionFeedbackPreset {
    id: string;
    role: SessionFeedbackRole;
    label: string;
    message: string;
    createdAt: string;
}

const DEFAULT_SESSION_FEEDBACK_PRESET_CREATED_AT = '1970-01-01T00:00:00.000Z';

const DEFAULT_SESSION_FEEDBACK_PRESET_DEFS = [
    {
        id: 'cue-slower-tempo',
        role: 'leader',
        label: 'Slow tempo',
        message: 'Please bring the tempo down slightly.',
    },
    {
        id: 'cue-faster-tempo',
        role: 'leader',
        label: 'Lift tempo',
        message: 'Please lift the tempo slightly.',
    },
    {
        id: 'cue-longer-accompaniment',
        role: 'instrument',
        label: 'Extend intro',
        message: 'Please hold the accompaniment a little longer.',
    },
    {
        id: 'cue-repeat-ending',
        role: 'leader',
        label: 'Repeat ending',
        message: 'Repeat the ending one more time.',
    },
    {
        id: 'cue-next-lyrics',
        role: 'broadcast',
        label: 'Next lyrics',
        message: 'Please prepare the next lyric slide.',
    },
    {
        id: 'cue-raise-vocal',
        role: 'broadcast',
        label: 'Raise vocal',
        message: 'Please raise the vocal level slightly.',
    },
] as const satisfies ReadonlyArray<{
    id: string;
    role: SessionFeedbackRole;
    label: string;
    message: string;
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
    const customPresets = presets.filter((preset) => !defaultPresetIds.has(preset.id));

    return [
        ...defaultPresets,
        ...customPresets,
    ].slice(-MAX_SESSION_FEEDBACK_PRESETS);
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

    return {
        id: typeof value.id === 'string' ? value.id : `preset-${label.slice(0, 12)}`,
        role: isSessionFeedbackRole(value.role) ? value.role : DEFAULT_SESSION_FEEDBACK_ROLE,
        label: label.slice(0, 32),
        message: message.slice(0, 220),
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
