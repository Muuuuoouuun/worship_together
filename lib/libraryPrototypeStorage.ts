import type { Database } from '@/types/schema';
export type LibrarySong = Database['public']['Tables']['songs']['Row'];
export type LibrarySetlist = Omit<Database['public']['Tables']['setlists']['Row'], 'song_order'> & { song_order: string[] };
export interface PrototypeLibrary { version: 1; songs: LibrarySong[]; setlists: LibrarySetlist[] }
export const LIBRARY_CHANGED_EVENT = 'worship:library-changed';
export const libraryStorageKey = (teamId: string) => `worship-together:library:v1:${encodeURIComponent(teamId)}`;
/** Legacy setlists keep the first occurrence; live sessions identify songs by songId. */
export function normalizeSetlistSongOrder(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
}
export function hasDuplicateSongIds(ids: readonly string[]): boolean {
    return new Set(ids).size !== ids.length;
}
export function readPrototypeLibrary(teamId: string): PrototypeLibrary | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(libraryStorageKey(teamId));
        if (!raw) return null;
        const data = JSON.parse(raw) as PrototypeLibrary;
        if (data.version !== 1 || !Array.isArray(data.songs) || !Array.isArray(data.setlists)
            || !data.songs.every(s => s && typeof s.id === 'string' && typeof s.title === 'string' && s.team_id === teamId)
            || !data.setlists.every(s => s && typeof s.id === 'string' && typeof s.title === 'string' && s.team_id === teamId && typeof s.worship_date === 'string' && Array.isArray(s.song_order) && s.song_order.every(id => typeof id === 'string'))) {
            throw new Error('invalid');
        }
        return { ...data, setlists: data.setlists.map(setlist => ({ ...setlist, song_order: normalizeSetlistSongOrder(setlist.song_order) })) };
    } catch { throw new Error('이 브라우저의 라이브러리를 읽지 못했습니다. 저장 설정이나 기존 데이터를 확인해주세요.'); }
}
export function savePrototypeLibrary(teamId: string, data: PrototypeLibrary): void {
    if (data.setlists.some(setlist => hasDuplicateSongIds(setlist.song_order))) {
        throw new Error('콘티에는 같은 곡을 한 번만 추가할 수 있습니다. 후렴 반복은 곡의 송폼에서 설정해주세요.');
    }
    try { localStorage.setItem(libraryStorageKey(teamId), JSON.stringify(data)); }
    catch { throw new Error('저장 공간이 부족하거나 브라우저 저장이 차단되었습니다. 입력 내용은 저장되지 않았습니다.'); }
    window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
}
