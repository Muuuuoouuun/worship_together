/**
 * stageNotesStorage.ts
 *
 * Provides persistence and synchronization for per-song worship team stage notes and musical hints.
 * (e.g. "후렴 2번 반복 후 피아노 솔로", "BPM 74 -> 82 가속", "A파트 핑거링만")
 */

export const STAGE_NOTE_CHANGED_EVENT = 'wt_stage_note_changed';

function getStorageKey(teamId: string, songId: string): string {
    return `wt_stage_note:${teamId}:${songId}`;
}

export function readSongStageNote(teamId: string, songId: string): string {
    if (typeof window === 'undefined' || !teamId || !songId) return '';
    try {
        return window.localStorage.getItem(getStorageKey(teamId, songId)) ?? '';
    } catch {
        return '';
    }
}

export function saveSongStageNote(teamId: string, songId: string, note: string): void {
    if (typeof window === 'undefined' || !teamId || !songId) return;
    try {
        const key = getStorageKey(teamId, songId);
        if (!note || note.trim().length === 0) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, note.trim());
        }

        window.dispatchEvent(
            new CustomEvent(STAGE_NOTE_CHANGED_EVENT, {
                detail: { teamId, songId, note: note.trim() },
            })
        );
    } catch {}
}
