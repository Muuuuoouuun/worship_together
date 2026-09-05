import { useEffect, useState } from 'react';
import { readSongForm, SONG_FORM_CHANGED_EVENT } from '@/lib/songFormStorage';
import { DEFAULT_SESSION_SECTIONS } from '@/types/session';

export function useSongSections(songId: string | null, teamId: string): string[] {
    const [sections, setSections] = useState<string[]>([...DEFAULT_SESSION_SECTIONS]);
    useEffect(() => {
        function refresh() {
            const form = songId ? readSongForm(songId, teamId) : null;
            setSections(form?.sections.length ? form.sections.map((section, index) => `${index + 1}. ${section.label}`) : [...DEFAULT_SESSION_SECTIONS]);
        }
        refresh(); window.addEventListener('storage', refresh); window.addEventListener(SONG_FORM_CHANGED_EVENT, refresh);
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(SONG_FORM_CHANGED_EVENT, refresh); };
    }, [songId, teamId]);
    return sections;
}
