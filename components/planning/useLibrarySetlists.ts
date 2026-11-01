'use client';

import { useEffect, useState } from 'react';
import { LIBRARY_CHANGED_EVENT, libraryStorageKey, readPrototypeLibrary } from '@/lib/libraryPrototypeStorage';
import { summarizeLibrary, type LibrarySetlistSummary } from '@/lib/serviceLink';

/** 이 팀의 콘티 목록 (곡 보관함 — 온라인 팀은 서버와 맞춰진 사본). 바뀌면 다시 읽습니다. */
export function useLibrarySetlists(teamId: string): LibrarySetlistSummary[] {
    const [setlists, setSetlists] = useState<LibrarySetlistSummary[]>([]);
    useEffect(() => {
        const read = () => {
            try { setSetlists(summarizeLibrary(readPrototypeLibrary(teamId))); } catch { setSetlists([]); }
        };
        read();
        const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === libraryStorageKey(teamId)) read(); };
        window.addEventListener(LIBRARY_CHANGED_EVENT, read);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(LIBRARY_CHANGED_EVENT, read);
            window.removeEventListener('storage', onStorage);
        };
    }, [teamId]);
    return setlists;
}
