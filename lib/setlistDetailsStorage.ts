export interface SongSetlistOverride {
    songId: string;
    targetKey?: string | null;
    leaderNotes?: string | null;
    customBpm?: number | null;
}

export interface SetlistDetailMetadata {
    setlistId: string;
    teamId: string;
    overrides: Record<string, SongSetlistOverride>;
    updatedAt: string;
}

export const SETLIST_DETAILS_CHANGED_EVENT = 'worship:setlist-details-changed';

export function getSetlistDetailsKey(teamId: string, setlistId: string): string {
    return `worship:setlist-details:v1:${encodeURIComponent(teamId)}:${encodeURIComponent(setlistId)}`;
}

export function readSetlistDetails(teamId: string, setlistId: string): SetlistDetailMetadata | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(getSetlistDetailsKey(teamId, setlistId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SetlistDetailMetadata;
        return parsed && typeof parsed.overrides === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function saveSetlistDetails(teamId: string, setlistId: string, overrides: Record<string, SongSetlistOverride>): void {
    if (typeof window === 'undefined') return;
    try {
        const payload: SetlistDetailMetadata = {
            setlistId,
            teamId,
            overrides,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(getSetlistDetailsKey(teamId, setlistId), JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent(SETLIST_DETAILS_CHANGED_EVENT, { detail: { teamId, setlistId } }));
    } catch {
        // Storage failure handled silently in prototype
    }
}

export const COMMON_KEYS = [
    'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
] as const;
