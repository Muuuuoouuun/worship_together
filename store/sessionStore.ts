import { create } from 'zustand';
import { Database } from '@/types/schema';
import {
    DEFAULT_SESSION_FEEDBACK_ROLE,
    MAX_SESSION_FEEDBACK_LOG,
    normalizeSessionState,
    type SessionCurrentState,
    type SessionFeedbackEntry,
    type SessionFeedbackPreset,
    type SessionFeedbackRole,
    type SongRow,
    type SessionCueDelivery,
} from '@/types/session';

type Session = Database['public']['Tables']['sessions']['Row'];
type Song = SongRow;

function resolveSong(songId: string | null, songs: Song[]): Song | null {
    if (!songId) {
        return songs[0] ?? null;
    }

    return songs.find((song) => song.id === songId) ?? songs[0] ?? null;
}

function mergeFeedbackEntry(
    feedbackLog: SessionFeedbackEntry[],
    entry: SessionFeedbackEntry
): SessionFeedbackEntry[] {
    if (feedbackLog.some((item) => item.id === entry.id)) {
        return feedbackLog.map((item) => item.id === entry.id ? { ...item, ...entry } : item);
    }

    return [...feedbackLog, entry].slice(-MAX_SESSION_FEEDBACK_LOG);
}

function mergeFeedbackLogs(
    currentLog: SessionFeedbackEntry[],
    incomingLog: SessionFeedbackEntry[]
): SessionFeedbackEntry[] {
    const entriesById = new Map<string, SessionFeedbackEntry>();

    [...currentLog, ...incomingLog].forEach((entry) => {
        entriesById.set(entry.id, { ...entriesById.get(entry.id), ...entry });
    });

    return Array.from(entriesById.values())
        .sort((left, right) => (
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        ))
        .slice(-MAX_SESSION_FEEDBACK_LOG);
}

interface SessionState {
    isActive: boolean;
    isMaster: boolean;
    syncEnabled: boolean;
    songs: Song[];
    currentSession: Session | null;
    currentSong: Song | null;
    currentSongId: string | null;
    currentPage: number;
    currentSection: string | null;
    bpmEnabled: boolean;
    currentBpm: number | null;
    autoBpmSync: boolean;
    feedbackLog: SessionFeedbackEntry[];
    quickFeedbackPresets: SessionFeedbackPreset[];
    selectedFeedbackRole: SessionFeedbackRole;
    cueDeliveries: Record<string, SessionCueDelivery>;
    setCueDelivery: (id: string, delivery: Partial<SessionCueDelivery>) => void;
    acknowledgeCue: (id: string, clientId: string) => void;
    initializeSession: (session: Session, songs: Song[], initialState?: SessionCurrentState) => void;
    setSessionMeta: (session: Session) => void;
    mergeFeedbackEntry: (entry: SessionFeedbackEntry) => void;
    syncFeedbackLog: (feedbackLog: SessionFeedbackEntry[]) => void;
    syncQuickFeedbackPresets: (presets: SessionFeedbackPreset[]) => void;
    setFeedbackRole: (role: SessionFeedbackRole) => void;
    toggleMaster: () => void;
    toggleSync: () => void;
    applyRemoteState: (payload: SessionCurrentState) => void;
    updateState: (payload: Partial<SessionCurrentState>) => void;
    resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    isActive: false,
    isMaster: false,
    syncEnabled: true,
    songs: [],
    currentSession: null,
    currentSong: null,
    currentSongId: null,
    currentPage: 1,
    currentSection: null,
    bpmEnabled: false,
    currentBpm: null,
    autoBpmSync: true,
    feedbackLog: [],
    quickFeedbackPresets: [],
    selectedFeedbackRole: DEFAULT_SESSION_FEEDBACK_ROLE,
    cueDeliveries: {},
    setCueDelivery: (id, delivery) => set((state) => ({
        cueDeliveries: Object.fromEntries(Object.entries({
            ...state.cueDeliveries,
            [id]: { ...(state.cueDeliveries[id] ?? { status: 'sending', transport: null, receivedBy: [], saved: false }), ...delivery },
        }).slice(-MAX_SESSION_FEEDBACK_LOG)),
    })),
    acknowledgeCue: (id, clientId) => set((state) => {
        const delivery = state.cueDeliveries[id];
        if (!delivery || delivery.receivedBy.includes(clientId)) return state;
        return { cueDeliveries: { ...state.cueDeliveries, [id]: { ...delivery, receivedBy: [...delivery.receivedBy, clientId] } } };
    }),

    initializeSession: (session, songs, initialState) => {
        const state = initialState ?? normalizeSessionState(session.current_state, songs);
        const currentSong = resolveSong(state.songId, songs);

        set((current) => ({
            isMaster: current.currentSession?.id === session.id ? current.isMaster : false,
            cueDeliveries: current.currentSession?.id === session.id ? current.cueDeliveries : {},
            isActive: session.is_active,
            songs,
            currentSession: session,
            currentSong,
            currentSongId: currentSong?.id ?? null,
            currentPage: state.page,
            currentSection: state.section,
            bpmEnabled: state.bpmEnabled,
            currentBpm: state.bpmValue,
            autoBpmSync: state.autoBpmSync,
            feedbackLog: current.currentSession?.id === session.id
                ? mergeFeedbackLogs(current.feedbackLog, state.feedbackLog)
                : state.feedbackLog,
            quickFeedbackPresets: current.currentSession?.id === session.id && current.quickFeedbackPresets.length > 0
                ? current.quickFeedbackPresets
                : state.quickFeedbackPresets,
        }));
    },

    setSessionMeta: (session) => set({ currentSession: session, isActive: session.is_active }),

    mergeFeedbackEntry: (entry) =>
        set((state) => ({
            feedbackLog: mergeFeedbackEntry(state.feedbackLog, entry),
        })),

    syncFeedbackLog: (feedbackLog) => set((state) => ({ feedbackLog: mergeFeedbackLogs(state.feedbackLog, feedbackLog) })),

    syncQuickFeedbackPresets: (quickFeedbackPresets) => set({ quickFeedbackPresets }),

    setFeedbackRole: (role) => set({ selectedFeedbackRole: role }),

    toggleMaster: () => set((state) => ({ isMaster: !state.isMaster })),

    toggleSync: () => set((state) => ({ syncEnabled: !state.syncEnabled })),

    applyRemoteState: (payload) =>
        set((state) => {
            const currentSong = resolveSong(payload.songId, state.songs);

            return {
                currentSong,
                currentSongId: currentSong?.id ?? null,
                currentPage: payload.page,
                currentSection: payload.section,
                bpmEnabled: payload.bpmEnabled,
                currentBpm: payload.bpmValue,
                autoBpmSync: payload.autoBpmSync,
                feedbackLog: payload.feedbackLog.length > 0
                    ? mergeFeedbackLogs(state.feedbackLog, payload.feedbackLog)
                    : state.feedbackLog,
                quickFeedbackPresets: payload.quickFeedbackPresets,
            };
        }),

    updateState: ({ songId, page, section, bpmEnabled, bpmValue, autoBpmSync, feedbackLog, quickFeedbackPresets }) =>
        set((state) => {
            const nextSongId = songId !== undefined
                ? songId
                : state.currentSongId ?? state.songs[0]?.id ?? null;
            const currentSong = resolveSong(nextSongId, state.songs);

            return {
                currentSong,
                currentSongId: currentSong?.id ?? null,
                currentPage: page !== undefined ? page : state.currentPage,
                currentSection: section !== undefined ? section : state.currentSection,
                bpmEnabled: bpmEnabled !== undefined ? bpmEnabled : state.bpmEnabled,
                currentBpm: bpmValue !== undefined ? bpmValue : state.currentBpm,
                autoBpmSync: autoBpmSync !== undefined ? autoBpmSync : state.autoBpmSync,
                feedbackLog: feedbackLog !== undefined ? feedbackLog : state.feedbackLog,
                quickFeedbackPresets: quickFeedbackPresets !== undefined ? quickFeedbackPresets : state.quickFeedbackPresets,
            };
        }),

    resetSession: () =>
        set({
            isActive: false,
            isMaster: false,
            syncEnabled: true,
            cueDeliveries: {},
            songs: [],
            currentSession: null,
            currentSong: null,
            currentSongId: null,
            currentPage: 1,
            currentSection: null,
            bpmEnabled: false,
            currentBpm: null,
            autoBpmSync: true,
            feedbackLog: [],
            quickFeedbackPresets: [],
            selectedFeedbackRole: DEFAULT_SESSION_FEEDBACK_ROLE,
        }),
}));
