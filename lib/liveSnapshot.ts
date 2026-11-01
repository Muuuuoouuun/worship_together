import { readPrototypeLibrary } from './libraryPrototypeStorage';
import { readSetlistDetails } from './setlistDetailsStorage';
import { readSongForm } from './songFormStorage';
import { resolveSetlistPlans } from './stageSongPlan';

/*
 * 예배를 시작할 때 서버로 보내는 콘티 사본. 온라인 팀의 콘티는 서버와 맞춰져 있으므로(lib/teamDocSync),
 * 시작하는 기기의 저장소에서 곡 순서 · 이번 주 Key/BPM · 송폼 · 메모를 읽어 한 번에 묶습니다.
 * 세션 동안 모든 팀원은 이 사본을 함께 봅니다.
 */

export interface LiveSnapshotInput {
    setlistId: string;
    title: string;
    dateLabel: string | null;
    theme: string | null;
    songs: { id: string; title: string; key: string | null; bpm: number | null; meter: string; sections: string[]; note: string | null; transitionNote: string | null; lead: string | null }[];
}

export function serviceDateLabel(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** 콘티를 찾지 못하거나 곡이 없으면 이유를 담은 오류를 던집니다. setlistId 가 없으면 다가오는 콘티를 고릅니다. */
export function buildLiveSnapshot(teamId: string, setlistId: string | null, now = Date.now()): LiveSnapshotInput {
    const library = readPrototypeLibrary(teamId);
    if (!library || !library.setlists.length) throw new Error('이 팀에 콘티가 아직 없어요. 콘티를 먼저 만들어 주세요.');
    const upcoming = [...library.setlists]
        .sort((a, b) => Date.parse(a.worship_date) - Date.parse(b.worship_date))
        .find((item) => Date.parse(item.worship_date) >= now - 12 * 60 * 60 * 1000);
    const setlist = setlistId ? library.setlists.find((item) => item.id === setlistId) : upcoming ?? library.setlists[library.setlists.length - 1];
    if (!setlist) throw new Error('콘티를 찾지 못했어요. 콘티 화면에서 다시 시작해 주세요.');
    const songs = setlist.song_order.flatMap((id) => library.songs.filter((song) => song.id === id).slice(0, 1));
    if (!songs.length) throw new Error('이 콘티에 곡이 없어요. 곡을 추가한 뒤 시작해 주세요.');
    const details = readSetlistDetails(teamId, setlist.id, { title: setlist.title, createdAt: setlist.created_at });
    const plans = resolveSetlistPlans(songs, details);
    return {
        setlistId: setlist.id,
        title: setlist.title,
        dateLabel: serviceDateLabel(setlist.worship_date),
        theme: setlist.theme ?? null,
        songs: songs.map((song) => {
            const plan = plans[song.id];
            const override = details?.overrides[song.id];
            const form = readSongForm(song.id, teamId);
            return {
                id: song.id,
                title: song.title,
                key: plan?.key ?? song.original_key ?? null,
                bpm: plan?.bpm ?? song.bpm ?? null,
                meter: '4/4',
                sections: form?.sections.map((section) => section.label) ?? [],
                note: plan?.directionNotes.join(' · ') || null,
                transitionNote: plan?.transitionNote ?? null,
                lead: override?.lead?.trim() || null,
            };
        }),
    };
}
