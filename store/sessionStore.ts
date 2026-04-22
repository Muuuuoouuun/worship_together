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
        return feedbackLog;
    }

    return [...feedbackLog, entry].slice(-MAX_SESSION_FEEDBACK_LOG);
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

    initializeSession: (session, songs, initialState) => {
        const state = initialState ?? normalizeSessionState(session.current_state, songs);
        const currentSong = resolveSong(state.songId, songs);

        set({
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
            feedbackLog: state.feedbackLog,
            quickFeedbackPresets: state.quickFeedbackPresets,
        });
    },

    setSessionMeta: (session) => set({ currentSession: session, isActive: session.is_active }),

    mergeFeedbackEntry: (entry) =>
        set((state) => ({
            feedbackLog: mergeFeedbackEntry(state.feedbackLog, entry),
        })),

    syncFeedbackLog: (feedbackLog) => set({ feedbackLog }),

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
                feedbackLog: payload.feedbackLog.length > 0 ? payload.feedbackLog : state.feedbackLog,
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
