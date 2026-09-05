import { isSongForm, type SongForm } from './songForm';

export const SONG_FORM_CHANGED_EVENT = 'worship:song-form-changed';
export function songFormStorageKey(songId: string, teamId: string): string {
    return `worship-together:song-form:v1:${encodeURIComponent(teamId)}:${encodeURIComponent(songId)}`;
}
/** Client-only device storage; does not claim backend/team synchronization. */
export function readSongForm(songId: string, teamId: string): SongForm | null {
    if (typeof window === 'undefined') return null;
    try {
        const value: unknown = JSON.parse(localStorage.getItem(songFormStorageKey(songId, teamId)) ?? 'null');
        return isSongForm(value) && value.songId === songId ? value : null;
    } catch { return null; }
}
export function saveSongForm(form: SongForm, teamId: string): void {
    if (!isSongForm(form)) throw new Error('송폼 형식이 올바르지 않습니다.');
    try { localStorage.setItem(songFormStorageKey(form.songId, teamId), JSON.stringify(form)); }
    catch { throw new Error('송폼을 저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해주세요.'); }
    window.dispatchEvent(new CustomEvent(SONG_FORM_CHANGED_EVENT, { detail: { songId: form.songId, teamId } }));
}
