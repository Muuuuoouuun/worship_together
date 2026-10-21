import { useMemo, useSyncExternalStore } from 'react';
import {
    SETLIST_DETAILS_CHANGED_EVENT,
    readSetlistDetails,
    readSetlistDetailsStamp,
    type LegacyLookup,
    type SetlistDetailMetadata,
} from '@/lib/setlistDetailsStorage';

function subscribe(onChange: () => void) {
    window.addEventListener('storage', onChange);
    window.addEventListener(SETLIST_DETAILS_CHANGED_EVENT, onChange);
    return () => {
        window.removeEventListener('storage', onChange);
        window.removeEventListener(SETLIST_DETAILS_CHANGED_EVENT, onChange);
    };
}

/**
 * 이 브라우저에 저장된 콘티 세부 정보(이번 주 Key·BPM·메모)를 읽고,
 * 다른 탭이나 콘티 화면에서 바뀌면 다시 읽습니다. 저장된 값이 없으면 null.
 */
export function useSetlistDetails(teamId: string, setlistId: string | null, legacy?: LegacyLookup): SetlistDetailMetadata | null {
    const legacyTitle = legacy?.title ?? null;
    const legacyCreatedAt = legacy?.createdAt ?? null;
    // 원문 문자열이 같으면 다시 그리지 않으므로, 다른 키가 바뀐 storage 이벤트에는 반응하지 않습니다.
    const stamp = useSyncExternalStore(
        subscribe,
        () => (setlistId ? readSetlistDetailsStamp(teamId, setlistId, legacyTitle) : ''),
        () => '',
    );
    return useMemo(() => {
        if (!setlistId || !stamp) return null;
        return readSetlistDetails(teamId, setlistId, legacyTitle && legacyCreatedAt ? { title: legacyTitle, createdAt: legacyCreatedAt } : undefined);
    }, [teamId, setlistId, legacyTitle, legacyCreatedAt, stamp]);
}
